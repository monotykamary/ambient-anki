// Content script for extracting page content
(function() {
  'use strict';

  // Helper function to extract page metadata
  function extractMetadata() {
    const metadata = {
      title: document.title || '',
      url: window.location.href,
      description: '',
      author: '',
      publishDate: '',
      language: document.documentElement.lang || 'en',
      favicon: ''
    };

    // Try to get description
    const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (descriptionMeta) {
      metadata.description = descriptionMeta.getAttribute('content') || '';
    }

    // Try to get author
    const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]');
    if (authorMeta) {
      metadata.author = authorMeta.getAttribute('content') || '';
    }

    // Try to get publish date
    const dateMeta = document.querySelector('meta[property="article:published_time"], meta[name="publish_date"], time[datetime]');
    if (dateMeta) {
      metadata.publishDate = dateMeta.getAttribute('content') || dateMeta.getAttribute('datetime') || '';
    }

    // Get favicon
    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (favicon) {
      metadata.favicon = favicon.href;
    }

    return metadata;
  }

  // Extract content using Readability
  function extractContent() {
    try {
      // Clone the document to avoid modifying the original
      const documentClone = document.cloneNode(true);
      
      // Initialize Readability
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article && article.content) {
        return {
          title: article.title || document.title,
          content: article.textContent || article.content,
          excerpt: article.excerpt || '',
          byline: article.byline || '',
          length: article.length || 0,
          siteName: article.siteName || ''
        };
      }
    } catch (error) {
      console.error('Readability parsing failed:', error);
    }

    // Fallback extraction if Readability fails
    return extractFallbackContent();
  }

  // Fallback content extraction
  function extractFallbackContent() {
    // Remove script and style elements
    const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, object, embed');
    elementsToRemove.forEach(el => el.remove());

    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '.content',
      '#main',
      '.main',
      'body'
    ];

    let contentElement = null;
    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement && contentElement.textContent.trim().length > 200) {
        break;
      }
    }

    if (!contentElement) {
      contentElement = document.body;
    }

    // Get text content and clean it up
    const textContent = contentElement.textContent
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit to 10k characters

    return {
      title: document.title,
      content: textContent,
      excerpt: textContent.substring(0, 200) + '...',
      byline: '',
      length: textContent.length,
      siteName: window.location.hostname
    };
  }

  // Check if page is suitable for capture
  function isPageSuitable() {
    // Skip certain URLs
    const skipPatterns = [
      /^about:/,
      /^chrome:/,
      /^chrome-extension:/,
      /^file:/,
      /localhost:8765/, // AnkiConnect
      /^https?:\/\/[^\/]*\/(login|signin|signup|register)/i,
      /^https?:\/\/[^\/]*google\.[^\/]*\/search/,
      /^https?:\/\/[^\/]*\/search/
    ];

    const currentUrl = window.location.href;
    for (const pattern of skipPatterns) {
      if (pattern.test(currentUrl)) {
        return false;
      }
    }

    // Check if page has enough content
    const bodyText = document.body.textContent || '';
    if (bodyText.trim().length < 300) {
      return false;
    }

    return true;
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      if (!isPageSuitable()) {
        sendResponse({
          success: false,
          error: 'Page not suitable for capture',
          reason: 'insufficient_content'
        });
        return true;
      }

      try {
        const metadata = extractMetadata();
        const content = extractContent();
        
        sendResponse({
          success: true,
          data: {
            ...metadata,
            ...content,
            extractedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    } else if (request.action === 'checkSuitability') {
      sendResponse({
        suitable: isPageSuitable()
      });
    }
    
    return true; // Keep message channel open for async response
  });

  // Notify background script that content script is ready
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });
})();