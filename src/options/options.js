// Options page script
import { StorageManager } from '../utils/storage.js';
import { download } from '../utils/helpers.js';

class OptionsController {
  constructor() {
    this.storage = new StorageManager();
    this.elements = this.getElements();
    this.init();
  }

  getElements() {
    return {
      // Status
      saveStatus: document.getElementById('saveStatus'),
      
      // API Configuration
      apiProvider: document.getElementById('apiProvider'),
      openaiSettings: document.getElementById('openaiSettings'),
      anthropicSettings: document.getElementById('anthropicSettings'),
      customSettings: document.getElementById('customSettings'),
      openaiKey: document.getElementById('openaiKey'),
      openaiModel: document.getElementById('openaiModel'),
      anthropicKey: document.getElementById('anthropicKey'),
      anthropicModel: document.getElementById('anthropicModel'),
      customEndpoint: document.getElementById('customEndpoint'),
      customKey: document.getElementById('customKey'),
      
      // Anki Configuration
      ankiDeck: document.getElementById('ankiDeck'),
      testAnkiBtn: document.getElementById('testAnkiBtn'),
      ankiStatus: document.getElementById('ankiStatus'),
      
      // Flashcard Settings
      maxPerPage: document.getElementById('maxPerPage'),
      difficulty: document.getElementById('difficulty'),
      includeSource: document.getElementById('includeSource'),
      
      // Auto Capture
      autoCaptureEnabled: document.getElementById('autoCaptureEnabled'),
      autoCaptureSettings: document.getElementById('autoCaptureSettings'),
      minDwellTime: document.getElementById('minDwellTime'),
      whitelistInput: document.getElementById('whitelistInput'),
      addWhitelistBtn: document.getElementById('addWhitelistBtn'),
      whitelistItems: document.getElementById('whitelistItems'),
      blacklistInput: document.getElementById('blacklistInput'),
      addBlacklistBtn: document.getElementById('addBlacklistBtn'),
      blacklistItems: document.getElementById('blacklistItems'),
      
      // Data Management
      exportBtn: document.getElementById('exportBtn'),
      importBtn: document.getElementById('importBtn'),
      importFile: document.getElementById('importFile'),
      clearHistoryBtn: document.getElementById('clearHistoryBtn'),
      
      // Actions
      saveBtn: document.getElementById('saveBtn'),
      resetBtn: document.getElementById('resetBtn')
    };
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateProviderSettings();
    this.updateAutoCaptureSettings();
  }

  setupEventListeners() {
    // API Provider change
    this.elements.apiProvider.addEventListener('change', () => this.updateProviderSettings());
    
    // Auto capture toggle
    this.elements.autoCaptureEnabled.addEventListener('change', () => this.updateAutoCaptureSettings());
    
    // Test Anki connection
    this.elements.testAnkiBtn.addEventListener('click', () => this.testAnkiConnection());
    
    // Domain list management
    this.elements.addWhitelistBtn.addEventListener('click', () => this.addDomain('whitelist'));
    this.elements.addBlacklistBtn.addEventListener('click', () => this.addDomain('blacklist'));
    this.elements.whitelistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addDomain('whitelist');
    });
    this.elements.blacklistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addDomain('blacklist');
    });
    
    // Data management
    this.elements.exportBtn.addEventListener('click', () => this.exportSettings());
    this.elements.importBtn.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.importSettings(e));
    this.elements.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    
    // Save and reset
    this.elements.saveBtn.addEventListener('click', () => this.saveSettings());
    this.elements.resetBtn.addEventListener('click', () => this.resetSettings());
  }

  async loadSettings() {
    const settings = await this.storage.getAll();
    
    // API Configuration
    this.elements.apiProvider.value = settings.apiProvider || 'openai';
    
    // Load API keys
    const openaiKey = await this.storage.getApiKey('openai');
    const anthropicKey = await this.storage.getApiKey('anthropic');
    const customKey = await this.storage.getApiKey('custom');
    
    if (openaiKey) this.elements.openaiKey.value = openaiKey;
    if (anthropicKey) this.elements.anthropicKey.value = anthropicKey;
    if (customKey) this.elements.customKey.value = customKey;
    
    this.elements.openaiModel.value = settings.openaiModel || 'gpt-4o-mini';
    this.elements.anthropicModel.value = settings.anthropicModel || 'claude-3-5-haiku-20241022';
    this.elements.customEndpoint.value = settings.customEndpoint || '';
    
    // Anki Configuration
    this.elements.ankiDeck.value = settings.ankiDeck || 'Ambient Anki';
    
    // Flashcard Settings
    this.elements.maxPerPage.value = settings.flashcardSettings?.maxPerPage || 5;
    this.elements.difficulty.value = settings.flashcardSettings?.difficulty || 'medium';
    this.elements.includeSource.checked = settings.flashcardSettings?.includeSource !== false;
    
    // Auto Capture
    this.elements.autoCaptureEnabled.checked = settings.autoCapture?.enabled || false;
    this.elements.minDwellTime.value = (settings.autoCapture?.minDwellTime || 30000) / 1000;
    
    // Load domain lists
    const domainRules = await this.storage.getDomainRules();
    this.loadDomainList('whitelist', domainRules.whitelist);
    this.loadDomainList('blacklist', domainRules.blacklist);
  }

  updateProviderSettings() {
    const provider = this.elements.apiProvider.value;
    
    // Hide all provider settings
    this.elements.openaiSettings.classList.add('hidden');
    this.elements.anthropicSettings.classList.add('hidden');
    this.elements.customSettings.classList.add('hidden');
    
    // Show selected provider settings
    switch (provider) {
      case 'openai':
        this.elements.openaiSettings.classList.remove('hidden');
        break;
      case 'anthropic':
        this.elements.anthropicSettings.classList.remove('hidden');
        break;
      case 'custom':
        this.elements.customSettings.classList.remove('hidden');
        break;
    }
  }

  updateAutoCaptureSettings() {
    if (this.elements.autoCaptureEnabled.checked) {
      this.elements.autoCaptureSettings.classList.remove('hidden');
    } else {
      this.elements.autoCaptureSettings.classList.add('hidden');
    }
  }

  async testAnkiConnection() {
    this.elements.testAnkiBtn.disabled = true;
    this.elements.ankiStatus.textContent = 'Testing...';
    this.elements.ankiStatus.className = 'status-text';
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testAnkiConnection' });
      
      if (response.success && response.connected) {
        this.elements.ankiStatus.textContent = 'Connected!';
        this.elements.ankiStatus.className = 'status-text success';
      } else {
        this.elements.ankiStatus.textContent = 'Not connected';
        this.elements.ankiStatus.className = 'status-text error';
      }
    } catch (error) {
      this.elements.ankiStatus.textContent = 'Connection failed';
      this.elements.ankiStatus.className = 'status-text error';
    } finally {
      this.elements.testAnkiBtn.disabled = false;
    }
  }

  addDomain(type) {
    const input = type === 'whitelist' ? this.elements.whitelistInput : this.elements.blacklistInput;
    const domain = input.value.trim();
    
    if (!domain) return;
    
    // Add to storage
    if (type === 'whitelist') {
      this.storage.addToWhitelist(domain);
    } else {
      this.storage.addToBlacklist(domain);
    }
    
    // Add to UI
    this.addDomainItem(type, domain);
    
    // Clear input
    input.value = '';
  }

  loadDomainList(type, domains) {
    const container = type === 'whitelist' ? this.elements.whitelistItems : this.elements.blacklistItems;
    container.innerHTML = '';
    
    domains.forEach(domain => this.addDomainItem(type, domain));
  }

  addDomainItem(type, domain) {
    const container = type === 'whitelist' ? this.elements.whitelistItems : this.elements.blacklistItems;
    
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <span>${domain}</span>
      <button title="Remove">×</button>
    `;
    
    item.querySelector('button').addEventListener('click', () => {
      if (type === 'whitelist') {
        this.storage.removeFromWhitelist(domain);
      } else {
        this.storage.removeFromBlacklist(domain);
      }
      item.remove();
    });
    
    container.appendChild(item);
  }

  async saveSettings() {
    const provider = this.elements.apiProvider.value;
    
    // Save API keys
    if (provider === 'openai' && this.elements.openaiKey.value) {
      await this.storage.setApiKey('openai', this.elements.openaiKey.value);
    }
    if (provider === 'anthropic' && this.elements.anthropicKey.value) {
      await this.storage.setApiKey('anthropic', this.elements.anthropicKey.value);
    }
    if (provider === 'custom' && this.elements.customKey.value) {
      await this.storage.setApiKey('custom', this.elements.customKey.value);
    }
    
    // Save other settings
    const settings = {
      apiProvider: provider,
      openaiModel: this.elements.openaiModel.value,
      anthropicModel: this.elements.anthropicModel.value,
      customEndpoint: this.elements.customEndpoint.value,
      ankiDeck: this.elements.ankiDeck.value,
      flashcardSettings: {
        maxPerPage: parseInt(this.elements.maxPerPage.value),
        difficulty: this.elements.difficulty.value,
        includeSource: this.elements.includeSource.checked
      },
      autoCapture: {
        enabled: this.elements.autoCaptureEnabled.checked,
        minDwellTime: parseInt(this.elements.minDwellTime.value) * 1000
      }
    };
    
    await this.storage.set(settings);
    
    // Show save confirmation
    this.showSaveStatus();
  }

  showSaveStatus() {
    this.elements.saveStatus.classList.remove('hidden');
    setTimeout(() => {
      this.elements.saveStatus.classList.add('hidden');
    }, 2000);
  }

  async exportSettings() {
    const settings = await this.storage.getAll();
    const domainRules = await this.storage.getDomainRules();
    
    const exportData = {
      ...settings,
      domainRules,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // Remove sensitive data
    delete exportData.captureHistory;
    
    const json = JSON.stringify(exportData, null, 2);
    download('ambient-anki-settings.json', json);
  }

  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate version
      if (data.version !== '1.0.0') {
        alert('Incompatible settings file version');
        return;
      }
      
      // Import settings
      await this.storage.set(data);
      
      // Import domain rules
      if (data.domainRules) {
        await this.storage.set({
          domainWhitelist: data.domainRules.whitelist || [],
          domainBlacklist: data.domainRules.blacklist || []
        });
      }
      
      // Reload settings
      await this.loadSettings();
      this.updateProviderSettings();
      this.updateAutoCaptureSettings();
      
      this.showSaveStatus();
    } catch (error) {
      alert('Failed to import settings: ' + error.message);
    }
    
    // Reset file input
    event.target.value = '';
  }

  async clearHistory() {
    if (confirm('Are you sure you want to clear all capture history? This cannot be undone.')) {
      await this.storage.clearHistory();
      alert('Capture history cleared');
    }
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      await this.storage.clear();
      window.location.reload();
    }
  }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});