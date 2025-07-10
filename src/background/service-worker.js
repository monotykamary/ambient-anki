// Background service worker for Ambient Anki
import { TabMonitor } from './tab-monitor.js';
import { AIClient } from './ai-client.js';
import { AnkiClient } from './anki-client.js';
import { StorageManager } from '../utils/storage.js';
import { CaptureQueue } from './capture-queue.js';

// Initialize services
const storage = new StorageManager();
const tabMonitor = new TabMonitor();
const aiClient = new AIClient();
const ankiClient = new AnkiClient();
const captureQueue = new CaptureQueue();

// Keep track of content script readiness
const contentScriptReady = new Map();

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Ambient Anki installed:', details.reason);
  
  // Set default settings
  if (details.reason === 'install') {
    await storage.setDefaults({
      apiProvider: 'openai',
      apiKey: '',
      ankiDeck: 'Ambient Anki',
      captureMode: 'manual',
      autoCapture: {
        enabled: false,
        minDwellTime: 30000, // 30 seconds
        blacklist: [],
        whitelist: []
      },
      flashcardSettings: {
        maxPerPage: 5,
        difficulty: 'medium',
        includeSource: true
      }
    });
  }

  // Create context menu
  chrome.contextMenus.create({
    id: 'capture-to-anki',
    title: 'Capture to Anki',
    contexts: ['page', 'selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-to-anki') {
    captureTab(tab.id, { selection: info.selectionText });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'contentScriptReady':
      if (sender.tab) {
        contentScriptReady.set(sender.tab.id, true);
      }
      break;

    case 'captureCurrentTab':
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const result = await captureTab(tab.id, request.options);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'getSettings':
      const settings = await storage.getAll();
      sendResponse({ success: true, data: settings });
      break;

    case 'saveSettings':
      try {
        // Handle API keys separately
        if (request.settings.openaiApiKey) {
          await storage.setApiKey('openai', request.settings.openaiApiKey);
          delete request.settings.openaiApiKey;
        }
        if (request.settings.anthropicApiKey) {
          await storage.setApiKey('anthropic', request.settings.anthropicApiKey);
          delete request.settings.anthropicApiKey;
        }
        
        // Merge with existing settings for partial updates
        const currentSettings = await storage.getAll();
        const mergedSettings = { ...currentSettings, ...request.settings };
        
        await storage.set(mergedSettings);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'testAnkiConnection':
      const isConnected = await ankiClient.testConnection();
      sendResponse({ success: true, connected: isConnected });
      break;

    case 'getDecks':
      try {
        const decks = await ankiClient.getDecks();
        sendResponse({ success: true, data: decks });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'getCaptureHistory':
      const history = await storage.getCaptureHistory();
      sendResponse({ success: true, data: history });
      break;

    case 'addFlashcardsToAnki':
      try {
        const ankiResults = await ankiClient.addFlashcards(request.flashcards, request.deck);
        sendResponse({ success: true, data: ankiResults });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
}

// Capture tab content and create flashcards
async function captureTab(tabId, options = {}) {
  try {
    // Check if content script is ready
    if (!contentScriptReady.get(tabId)) {
      // Inject content script if not ready
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/lib/readability.js', 'src/content/content-script.js']
      });
      
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Extract content from the page
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractContent',
      options 
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to extract content');
    }

    const pageData = response.data;

    // Check if we've already captured this URL recently
    const history = await storage.getCaptureHistory();
    const recentCapture = history.find(item => 
      item.url === pageData.url && 
      (Date.now() - new Date(item.capturedAt).getTime()) < 3600000 // 1 hour
    );

    if (recentCapture && !options.force) {
      return {
        skipped: true,
        reason: 'recently_captured',
        lastCapture: recentCapture
      };
    }

    // Get settings
    const settings = await storage.getAll();

    // Generate flashcards using AI
    const flashcards = await aiClient.generateFlashcards(pageData, settings);

    if (!flashcards || flashcards.length === 0) {
      throw new Error('No flashcards generated');
    }

    // Add flashcards to Anki
    const ankiResults = await ankiClient.addFlashcards(flashcards, settings.ankiDeck);

    // Save to history
    await storage.addToHistory({
      url: pageData.url,
      title: pageData.title,
      capturedAt: new Date().toISOString(),
      flashcardCount: flashcards.length,
      ankiResults
    });

    return {
      success: true,
      pageData,
      flashcards,
      ankiResults
    };

  } catch (error) {
    console.error('Capture failed:', error);
    throw error;
  }
}

// Set up tab monitoring for automatic capture
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const settings = await storage.getAll();
  if (settings.autoCapture?.enabled) {
    tabMonitor.startMonitoring(activeInfo.tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptReady.delete(tabId);
  tabMonitor.stopMonitoring(tabId);
});

// Handle tab monitoring events
tabMonitor.on('capture', async (tabId) => {
  const settings = await storage.getAll();
  if (settings.autoCapture?.enabled) {
    try {
      const tab = await chrome.tabs.get(tabId);
      
      // Check whitelist/blacklist
      if (!shouldCaptureUrl(tab.url, settings.autoCapture)) {
        return;
      }

      // Add to capture queue
      captureQueue.add(() => captureTab(tabId, { auto: true }));
    } catch (error) {
      console.error('Auto capture failed:', error);
    }
  }
});

// Check if URL should be captured based on whitelist/blacklist
function shouldCaptureUrl(url, autoCapture) {
  const { whitelist = [], blacklist = [] } = autoCapture;
  
  // Check blacklist first
  for (const pattern of blacklist) {
    if (new RegExp(pattern).test(url)) {
      return false;
    }
  }
  
  // If whitelist exists, URL must match
  if (whitelist.length > 0) {
    for (const pattern of whitelist) {
      if (new RegExp(pattern).test(url)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

// Process capture queue
captureQueue.on('process', async (task) => {
  try {
    await task();
  } catch (error) {
    console.error('Queue processing error:', error);
  }
});

// Export for testing
export { captureTab, shouldCaptureUrl };