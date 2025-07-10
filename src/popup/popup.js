// Popup script for Ambient Anki
import { formatTimeAgo, truncate } from '../utils/helpers.js';

class PopupController {
  constructor() {
    this.elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      captureBtn: document.getElementById('captureBtn'),
      captureStatus: document.getElementById('captureStatus'),
      captureStatusText: document.getElementById('captureStatusText'),
      autoCapture: document.getElementById('autoCapture'),
      deckSelect: document.getElementById('deckSelect'),
      recentList: document.getElementById('recentList'),
      previewModal: document.getElementById('previewModal'),
      flashcardList: document.getElementById('flashcardList'),
      cancelBtn: document.getElementById('cancelBtn'),
      addToAnkiBtn: document.getElementById('addToAnkiBtn'),
      openOptions: document.getElementById('openOptions'),
      viewHistory: document.getElementById('viewHistory')
    };

    this.flashcards = [];
    this.currentPageData = null;

    this.init();
  }

  async init() {
    // Set up event listeners
    this.setupEventListeners();

    // Check Anki connection
    await this.checkAnkiConnection();

    // Load settings
    await this.loadSettings();

    // Load recent captures
    await this.loadRecentCaptures();
  }

  setupEventListeners() {
    this.elements.captureBtn.addEventListener('click', () => this.captureCurrentPage());
    this.elements.autoCapture.addEventListener('change', (e) => this.toggleAutoCapture(e.target.checked));
    this.elements.deckSelect.addEventListener('change', (e) => this.updateDeck(e.target.value));
    this.elements.cancelBtn.addEventListener('click', () => this.hidePreview());
    this.elements.addToAnkiBtn.addEventListener('click', () => this.addFlashcardsToAnki());
    this.elements.openOptions.addEventListener('click', () => this.openOptions());
    this.elements.viewHistory.addEventListener('click', () => this.viewHistory());
  }

  async checkAnkiConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testAnkiConnection' });
      
      if (response.success && response.connected) {
        this.updateStatus('connected', 'Anki Connected');
        await this.loadDecks();
      } else {
        this.updateStatus('error', 'Anki Not Connected');
        this.showError('Please ensure Anki is running with AnkiConnect addon');
      }
    } catch (error) {
      this.updateStatus('error', 'Connection Error');
    }
  }

  updateStatus(status, text) {
    this.elements.statusDot.className = `status-dot ${status}`;
    this.elements.statusText.textContent = text;
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        const settings = response.data;
        this.elements.autoCapture.checked = settings.autoCapture?.enabled || false;
        
        // Select current deck
        if (settings.ankiDeck && this.elements.deckSelect.options.length > 0) {
          this.elements.deckSelect.value = settings.ankiDeck;
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async loadDecks() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDecks' });
      if (response.success) {
        const decks = response.data;
        this.elements.deckSelect.innerHTML = decks
          .map(deck => `<option value="${deck}">${deck}</option>`)
          .join('');
        
        // Load current deck from settings
        await this.loadSettings();
      }
    } catch (error) {
      this.elements.deckSelect.innerHTML = '<option>Failed to load decks</option>';
    }
  }

  async loadRecentCaptures() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCaptureHistory' });
      if (response.success && response.data.length > 0) {
        const recent = response.data.slice(-5).reverse(); // Last 5, newest first
        this.elements.recentList.innerHTML = recent
          .map(capture => this.createRecentItem(capture))
          .join('');
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  createRecentItem(capture) {
    return `
      <div class="recent-item" data-url="${capture.url}">
        <div class="recent-item-title">${truncate(capture.title, 40)}</div>
        <div class="recent-item-meta">
          <span>${capture.flashcardCount} cards</span>
          <span>•</span>
          <span>${formatTimeAgo(capture.capturedAt)}</span>
        </div>
      </div>
    `;
  }

  async captureCurrentPage() {
    this.showCaptureStatus('Extracting content...');
    this.elements.captureBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'captureCurrentTab',
        options: { preview: true }
      });

      if (response.success) {
        if (response.data.skipped) {
          this.showCaptureStatus(`Already captured ${formatTimeAgo(response.data.lastCapture.capturedAt)}`, 'warning');
          setTimeout(() => this.hideCaptureStatus(), 3000);
        } else {
          this.currentPageData = response.data.pageData;
          this.flashcards = response.data.flashcards;
          this.showPreview();
        }
      } else {
        this.showCaptureStatus(response.error || 'Capture failed', 'error');
        setTimeout(() => this.hideCaptureStatus(), 3000);
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.showCaptureStatus('Capture failed', 'error');
      setTimeout(() => this.hideCaptureStatus(), 3000);
    } finally {
      this.elements.captureBtn.disabled = false;
    }
  }

  showCaptureStatus(text, type = 'info') {
    this.elements.captureStatus.classList.remove('hidden');
    this.elements.captureStatusText.textContent = text;
    this.elements.captureStatusText.className = type;
  }

  hideCaptureStatus() {
    this.elements.captureStatus.classList.add('hidden');
  }

  showPreview() {
    this.elements.flashcardList.innerHTML = this.flashcards
      .map((card, index) => this.createFlashcardItem(card, index))
      .join('');
    
    this.elements.previewModal.classList.remove('hidden');
    this.hideCaptureStatus();
  }

  hidePreview() {
    this.elements.previewModal.classList.add('hidden');
    this.flashcards = [];
    this.currentPageData = null;
  }

  createFlashcardItem(card, index) {
    return `
      <div class="flashcard-item">
        <div class="flashcard-question">
          <strong>Q:</strong> ${card.question}
        </div>
        <div class="flashcard-answer">
          <strong>A:</strong> ${card.answer}
        </div>
        <textarea 
          id="question-${index}" 
          data-index="${index}" 
          data-field="question"
          placeholder="Edit question..."
        >${card.question}</textarea>
        <textarea 
          id="answer-${index}" 
          data-index="${index}" 
          data-field="answer"
          placeholder="Edit answer..."
        >${card.answer}</textarea>
      </div>
    `;
  }

  async addFlashcardsToAnki() {
    // Get edited values
    const textareas = this.elements.flashcardList.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      const index = parseInt(textarea.dataset.index);
      const field = textarea.dataset.field;
      this.flashcards[index][field] = textarea.value;
    });

    this.elements.addToAnkiBtn.disabled = true;
    this.elements.addToAnkiBtn.textContent = 'Adding...';

    try {
      const deck = this.elements.deckSelect.value;
      const response = await chrome.runtime.sendMessage({
        action: 'addFlashcardsToAnki',
        flashcards: this.flashcards,
        deck: deck
      });

      if (response.success) {
        this.hidePreview();
        this.showSuccess(`Added ${response.data.success} cards to Anki`);
        await this.loadRecentCaptures();
      } else {
        this.showError(response.error || 'Failed to add cards');
      }
    } catch (error) {
      console.error('Add to Anki error:', error);
      this.showError('Failed to add cards to Anki');
    } finally {
      this.elements.addToAnkiBtn.disabled = false;
      this.elements.addToAnkiBtn.textContent = 'Add to Anki';
    }
  }

  async toggleAutoCapture(enabled) {
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: {
          autoCapture: { enabled }
        }
      });
    } catch (error) {
      console.error('Failed to save auto capture setting:', error);
      this.elements.autoCapture.checked = !enabled; // Revert
    }
  }

  async updateDeck(deck) {
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { ankiDeck: deck }
      });
    } catch (error) {
      console.error('Failed to save deck setting:', error);
    }
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
  }

  viewHistory() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
  }

  showError(message) {
    // You could implement a toast notification here
    console.error(message);
  }

  showSuccess(message) {
    // You could implement a toast notification here
    console.log(message);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});