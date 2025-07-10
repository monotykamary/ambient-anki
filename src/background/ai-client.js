// AI client for generating flashcards
import { StorageManager } from '../utils/storage.js';

export class AIClient {
  constructor() {
    this.storage = new StorageManager();
    this.providers = {
      openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3', 'o3-pro', 'o4-mini']
      },
      anthropic: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514']
      }
    };
  }

  async generateFlashcards(pageData, settings) {
    const provider = settings.apiProvider || 'openai';
    const apiKey = await this.storage.getApiKey(provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`);
    }

    const prompt = this.buildPrompt(pageData, settings);

    try {
      let flashcards;
      
      switch (provider) {
        case 'openai':
          flashcards = await this.callOpenAI(prompt, apiKey, settings);
          break;
        case 'anthropic':
          flashcards = await this.callAnthropic(prompt, apiKey, settings);
          break;
        case 'custom':
          flashcards = await this.callCustomAPI(prompt, settings);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      return this.processFlashcards(flashcards, pageData, settings);
    } catch (error) {
      console.error('AI generation failed:', error);
      throw error;
    }
  }

  buildPrompt(pageData, settings) {
    const maxCards = settings.flashcardSettings?.maxPerPage || 5;
    const difficulty = settings.flashcardSettings?.difficulty || 'medium';
    
    const contentToUse = pageData.content.substring(0, 4000); // Limit content

    const difficultyInstructions = {
      easy: 'Create simple, factual questions with straightforward answers.',
      medium: 'Create questions that test understanding and key concepts.',
      hard: 'Create challenging questions that require deep understanding and critical thinking.'
    };

    return `You are an expert educator creating Anki flashcards from web content. 

Title: ${pageData.title}
URL: ${pageData.url}
Content: ${contentToUse}

Create ${maxCards} high-quality flashcards from this content. ${difficultyInstructions[difficulty]}

Requirements:
1. Each flashcard should have a clear question and comprehensive answer
2. Focus on the most important and memorable information
3. Avoid yes/no questions unless absolutely necessary
4. Make questions specific and unambiguous
5. Include context in the question when needed
6. Answers should be concise but complete

Return the flashcards as a JSON array with this exact format:
[
  {
    "question": "What is the main concept discussed?",
    "answer": "The main concept is...",
    "tags": ["concept", "definition"]
  }
]

Only return the JSON array, no other text.`;
  }

  async callOpenAI(prompt, apiKey, settings) {
    const model = settings.aiModel || 'gpt-4o-mini';
    
    const response = await fetch(this.providers.openai.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates Anki flashcards. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  async callAnthropic(prompt, apiKey, settings) {
    const model = settings.aiModel || 'claude-3-5-haiku-20241022';
    
    const response = await fetch(this.providers.anthropic.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: 'You are a helpful assistant that creates Anki flashcards. Always respond with valid JSON only.'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    try {
      return JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  async callCustomAPI(prompt, settings) {
    if (!settings.customApiEndpoint) {
      throw new Error('Custom API endpoint not configured');
    }

    const response = await fetch(settings.customApiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.customApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        ...settings.customApiParams
      })
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.flashcards || data;
  }

  processFlashcards(flashcards, pageData, settings) {
    if (!Array.isArray(flashcards)) {
      throw new Error('AI did not return an array of flashcards');
    }

    return flashcards.map((card, index) => {
      const processed = {
        question: card.question || card.front || '',
        answer: card.answer || card.back || '',
        tags: card.tags || [],
        source: pageData.url,
        title: pageData.title,
        createdAt: new Date().toISOString(),
        id: `${Date.now()}-${index}`
      };

      // Add source reference if enabled
      if (settings.flashcardSettings?.includeSource) {
        processed.answer += `\n\nSource: ${pageData.title}\n${pageData.url}`;
      }

      // Add default tags
      processed.tags.push('ambient-anki');
      if (pageData.siteName) {
        processed.tags.push(pageData.siteName.toLowerCase().replace(/\s+/g, '-'));
      }

      return processed;
    });
  }

  // Estimate token count (rough approximation)
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Calculate cost estimate
  estimateCost(prompt, response, provider, model) {
    const tokens = this.estimateTokens(prompt) + this.estimateTokens(JSON.stringify(response));
    
    // Rough cost estimates (update as needed)
    const costs = {
      'gpt-4o-mini': 0.00015 / 1000, // per token
      'gpt-4o': 0.0025 / 1000,
      'gpt-4.1-mini': 0.00015 / 1000,
      'gpt-4.1': 0.0025 / 1000,
      'o3': 0.015 / 1000,
      'o3-pro': 0.03 / 1000,
      'o4-mini': 0.003 / 1000,
      'claude-3-5-haiku-20241022': 0.001 / 1000,
      'claude-3-5-sonnet-20241022': 0.003 / 1000,
      'claude-3-7-sonnet-20250219': 0.003 / 1000,
      'claude-sonnet-4-20250514': 0.003 / 1000,
      'claude-opus-4-20250514': 0.015 / 1000
    };

    return tokens * (costs[model] || 0.002 / 1000);
  }
}