// History page script
import { formatTimeAgo, sortBy } from '../utils/helpers.js';

class HistoryController {
  constructor() {
    this.history = [];
    this.filteredHistory = [];
    this.elements = {
      searchInput: document.getElementById('searchInput'),
      sortSelect: document.getElementById('sortSelect'),
      historyList: document.getElementById('historyList'),
      emptyState: document.getElementById('emptyState')
    };
    
    this.init();
  }

  async init() {
    await this.loadHistory();
    this.setupEventListeners();
    this.filterAndRender(); // Use filterAndRender instead of render to apply initial sort
  }

  setupEventListeners() {
    this.elements.searchInput.addEventListener('input', () => this.filterAndRender());
    this.elements.sortSelect.addEventListener('change', () => this.filterAndRender());
  }

  async loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCaptureHistory' });
      if (response.success) {
        this.history = response.data || [];
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  filterAndRender() {
    const searchTerm = this.elements.searchInput.value.toLowerCase();
    const sortOption = this.elements.sortSelect.value;

    // Filter
    this.filteredHistory = this.history.filter(item => {
      if (!searchTerm) return true;
      return (
        item.title.toLowerCase().includes(searchTerm) ||
        item.url.toLowerCase().includes(searchTerm)
      );
    });

    // Sort
    switch (sortOption) {
      case 'date-desc':
        this.filteredHistory = sortBy(this.filteredHistory, 'capturedAt', true);
        break;
      case 'date-asc':
        this.filteredHistory = sortBy(this.filteredHistory, 'capturedAt', false);
        break;
      case 'cards-desc':
        this.filteredHistory = sortBy(this.filteredHistory, 'flashcardCount', true);
        break;
      case 'cards-asc':
        this.filteredHistory = sortBy(this.filteredHistory, 'flashcardCount', false);
        break;
    }

    this.render();
  }

  render() {
    if (this.filteredHistory.length === 0) {
      this.elements.historyList.innerHTML = '';
      this.elements.emptyState.classList.remove('hidden');
      return;
    }

    this.elements.emptyState.classList.add('hidden');
    this.elements.historyList.innerHTML = this.filteredHistory
      .map(item => this.createHistoryItem(item))
      .join('');
  }

  createHistoryItem(item) {
    const successRate = item.ankiResults 
      ? `${item.ankiResults.success}/${item.ankiResults.total}`
      : `${item.flashcardCount}/${item.flashcardCount}`;

    return `
      <div class="history-item">
        <div class="history-header">
          <div class="history-title">${item.title}</div>
          <div class="history-date">${formatTimeAgo(item.capturedAt)}</div>
        </div>
        <div class="history-url">${item.url}</div>
        <div class="history-stats">
          <div class="stat-item">
            <span>📚</span>
            <span>${item.flashcardCount} cards generated</span>
          </div>
          <div class="stat-item">
            <span>✅</span>
            <span>${successRate} added to Anki</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new HistoryController();
});