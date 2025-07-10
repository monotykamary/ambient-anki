// Tab monitoring for automatic capture
export class TabMonitor {
  constructor() {
    this.tabs = new Map(); // tabId -> { startTime, timeoutId }
    this.listeners = new Map();
  }

  startMonitoring(tabId, dwellTime = 30000) {
    // Clear existing monitoring for this tab
    this.stopMonitoring(tabId);

    // Start new monitoring
    const timeoutId = setTimeout(() => {
      this.emit('capture', tabId);
      this.tabs.delete(tabId);
    }, dwellTime);

    this.tabs.set(tabId, {
      startTime: Date.now(),
      timeoutId
    });
  }

  stopMonitoring(tabId) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      clearTimeout(tab.timeoutId);
      this.tabs.delete(tabId);
    }
  }

  stopAll() {
    for (const [tabId] of this.tabs) {
      this.stopMonitoring(tabId);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, ...args) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(...args));
  }

  getMonitoredTabs() {
    return Array.from(this.tabs.keys());
  }

  getDwellTime(tabId) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      return Date.now() - tab.startTime;
    }
    return 0;
  }
}