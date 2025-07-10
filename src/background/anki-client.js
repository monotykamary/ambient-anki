// AnkiConnect client for communicating with Anki
export class AnkiClient {
  constructor() {
    this.endpoint = 'http://localhost:8765';
    this.version = 6;
  }

  async invoke(action, params = {}) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          version: this.version,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`AnkiConnect HTTP error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`AnkiConnect error: ${result.error}`);
      }

      return result.result;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to Anki. Make sure Anki is running with AnkiConnect addon installed.');
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.invoke('version');
      return result >= this.version;
    } catch (error) {
      return false;
    }
  }

  async getDecks() {
    return await this.invoke('deckNames');
  }

  async createDeck(deckName) {
    return await this.invoke('createDeck', { deck: deckName });
  }

  async ensureDeckExists(deckName) {
    const decks = await this.getDecks();
    if (!decks.includes(deckName)) {
      await this.createDeck(deckName);
    }
  }

  async getModels() {
    return await this.invoke('modelNames');
  }

  async addNote(note) {
    return await this.invoke('addNote', { note });
  }

  async addNotes(notes) {
    return await this.invoke('addNotes', { notes });
  }

  async addFlashcards(flashcards, deckName) {
    // Ensure deck exists
    await this.ensureDeckExists(deckName);

    // Check available models
    const models = await this.getModels();
    const modelName = models.includes('Basic') ? 'Basic' : models[0];

    if (!modelName) {
      throw new Error('No note models available in Anki');
    }

    // Convert flashcards to Anki notes
    const notes = flashcards.map(card => ({
      deckName,
      modelName,
      fields: {
        Front: card.question,
        Back: card.answer
      },
      tags: card.tags || [],
      options: {
        allowDuplicate: false,
        duplicateScope: 'deck',
        duplicateScopeOptions: {
          deckName,
          checkChildren: false,
          checkAllModels: false
        }
      }
    }));

    // Try to add notes in batch
    try {
      const noteIds = await this.addNotes(notes);
      
      // Check which notes were added successfully
      const results = noteIds.map((id, index) => ({
        success: id !== null,
        noteId: id,
        flashcard: flashcards[index],
        error: id === null ? 'Duplicate or invalid note' : null
      }));

      const successCount = results.filter(r => r.success).length;
      
      return {
        total: flashcards.length,
        success: successCount,
        failed: flashcards.length - successCount,
        results
      };
    } catch (error) {
      // Fallback to adding one by one if batch fails
      console.warn('Batch add failed, trying individual adds:', error);
      return await this.addFlashcardsIndividually(notes, flashcards);
    }
  }

  async addFlashcardsIndividually(notes, flashcards) {
    const results = [];
    
    for (let i = 0; i < notes.length; i++) {
      try {
        const noteId = await this.addNote(notes[i]);
        results.push({
          success: true,
          noteId,
          flashcard: flashcards[i]
        });
      } catch (error) {
        results.push({
          success: false,
          flashcard: flashcards[i],
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      total: flashcards.length,
      success: successCount,
      failed: flashcards.length - successCount,
      results
    };
  }

  async findNotes(query) {
    return await this.invoke('findNotes', { query });
  }

  async notesInfo(noteIds) {
    return await this.invoke('notesInfo', { notes: noteIds });
  }

  async updateNote(note) {
    return await this.invoke('updateNote', { note });
  }

  async deleteNotes(noteIds) {
    return await this.invoke('deleteNotes', { notes: noteIds });
  }

  async sync() {
    return await this.invoke('sync');
  }

  // Check if a flashcard already exists
  async isDuplicate(question, deckName) {
    try {
      const query = `deck:"${deckName}" "front:${question.replace(/"/g, '\\"')}"`;
      const noteIds = await this.findNotes(query);
      return noteIds.length > 0;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
  }

  // Get statistics
  async getStats() {
    try {
      const decks = await this.getDecks();
      const stats = {};
      
      for (const deck of decks) {
        const noteIds = await this.findNotes(`deck:"${deck}"`);
        stats[deck] = noteIds.length;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      return {};
    }
  }

  // Get deck configuration
  async getDeckConfig(deckName) {
    return await this.invoke('getDeckConfig', { deck: deckName });
  }

  // Set deck configuration
  async setDeckConfig(config) {
    return await this.invoke('saveDeckConfig', { config });
  }
}