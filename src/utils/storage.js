// Storage manager for Chrome extension
export class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  async get(key) {
    const result = await this.storage.get(key);
    return result[key];
  }

  async getAll() {
    return await this.storage.get(null);
  }

  async set(data) {
    await this.storage.set(data);
  }

  async remove(keys) {
    await this.storage.remove(keys);
  }

  async clear() {
    await this.storage.clear();
  }

  async setDefaults(defaults) {
    const existing = await this.getAll();
    const merged = { ...defaults };
    
    // Only set values that don't exist
    for (const key in existing) {
      if (existing[key] !== undefined) {
        merged[key] = existing[key];
      }
    }
    
    await this.set(merged);
  }

  // API key encryption (basic - in production use better encryption)
  async setApiKey(provider, key) {
    const encrypted = btoa(key); // Basic encoding
    await this.set({ [`${provider}ApiKey`]: encrypted });
  }

  async getApiKey(provider) {
    const encrypted = await this.get(`${provider}ApiKey`);
    return encrypted ? atob(encrypted) : null;
  }

  // Capture history management
  async getCaptureHistory(limit = 100) {
    const history = await this.get('captureHistory') || [];
    return history.slice(-limit);
  }

  async addToHistory(capture) {
    const history = await this.getCaptureHistory(1000);
    history.push({
      ...capture,
      id: Date.now().toString()
    });
    
    // Keep only last 1000 captures
    if (history.length > 1000) {
      history.shift();
    }
    
    await this.set({ captureHistory: history });
  }

  async clearHistory() {
    await this.set({ captureHistory: [] });
  }

  // Domain rules management
  async getDomainRules() {
    return {
      whitelist: await this.get('domainWhitelist') || [],
      blacklist: await this.get('domainBlacklist') || []
    };
  }

  async addToWhitelist(domain) {
    const whitelist = await this.get('domainWhitelist') || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await this.set({ domainWhitelist: whitelist });
    }
  }

  async addToBlacklist(domain) {
    const blacklist = await this.get('domainBlacklist') || [];
    if (!blacklist.includes(domain)) {
      blacklist.push(domain);
      await this.set({ domainBlacklist: blacklist });
    }
  }

  async removeFromWhitelist(domain) {
    const whitelist = await this.get('domainWhitelist') || [];
    const filtered = whitelist.filter(d => d !== domain);
    await this.set({ domainWhitelist: filtered });
  }

  async removeFromBlacklist(domain) {
    const blacklist = await this.get('domainBlacklist') || [];
    const filtered = blacklist.filter(d => d !== domain);
    await this.set({ domainBlacklist: filtered });
  }

  // Listen for storage changes
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
}