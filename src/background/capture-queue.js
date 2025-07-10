// Queue for managing capture requests
export class CaptureQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = options.maxConcurrent || 1;
    this.activeCount = 0;
    this.listeners = new Map();
    this.rateLimiter = {
      tokens: options.rateLimit || 10,
      maxTokens: options.rateLimit || 10,
      refillRate: options.refillRate || 1, // tokens per minute
      lastRefill: Date.now()
    };

    // Start refill timer
    setInterval(() => this.refillTokens(), 60000); // Every minute
  }

  add(task, priority = 0) {
    this.queue.push({ task, priority, addedAt: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.process();
  }

  async process() {
    if (this.processing || this.activeCount >= this.maxConcurrent) {
      return;
    }

    const item = this.queue.shift();
    if (!item) {
      return;
    }

    // Check rate limit
    if (!this.consumeToken()) {
      // Put it back and wait
      this.queue.unshift(item);
      setTimeout(() => this.process(), 60000); // Try again in a minute
      return;
    }

    this.processing = true;
    this.activeCount++;

    try {
      this.emit('process', item.task);
      await item.task();
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.activeCount--;
      this.processing = false;
      
      // Process next item
      if (this.queue.length > 0) {
        setTimeout(() => this.process(), 1000); // Small delay between captures
      }
    }
  }

  consumeToken() {
    this.refillTokens();
    if (this.rateLimiter.tokens > 0) {
      this.rateLimiter.tokens--;
      return true;
    }
    return false;
  }

  refillTokens() {
    const now = Date.now();
    const timePassed = (now - this.rateLimiter.lastRefill) / 60000; // Minutes
    const tokensToAdd = Math.floor(timePassed * this.rateLimiter.refillRate);
    
    if (tokensToAdd > 0) {
      this.rateLimiter.tokens = Math.min(
        this.rateLimiter.maxTokens,
        this.rateLimiter.tokens + tokensToAdd
      );
      this.rateLimiter.lastRefill = now;
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

  getQueueLength() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}