# Ambient Anki

A Chrome extension that automatically captures web pages and converts them into Anki flashcards using AI.

## Features

- **Manual Capture**: Click to capture any webpage and generate flashcards
- **Automatic Capture**: Automatically captures pages based on dwell time
- **AI-Powered**: Uses OpenAI or Claude to generate high-quality Q&A flashcards
- **Smart Extraction**: Uses Mozilla's Readability for clean content extraction
- **Domain Filtering**: Whitelist/blacklist domains for automatic capture
- **Flashcard Preview**: Review and edit flashcards before adding to Anki
- **Multiple AI Providers**: Support for OpenAI, Anthropic Claude, or custom APIs

## Prerequisites

1. **Anki Desktop**: Download and install from [ankiweb.net](https://apps.ankiweb.net/)
2. **AnkiConnect**: Install the AnkiConnect addon in Anki:
   - Open Anki → Tools → Add-ons → Get Add-ons
   - Enter code: `2055492159`
   - Restart Anki
3. **API Key**: Get an API key from:
   - [OpenAI](https://platform.openai.com/api-keys) for GPT models
   - [Anthropic](https://console.anthropic.com/) for Claude models

## Installation

### Development Version

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ambient-anki.git
   cd ambient-anki
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `ambient-anki` directory

### Production Version

1. Download the latest release from the Releases page
2. Extract the ZIP file
3. Load as unpacked extension in Chrome

## Setup

1. **Start Anki**: Make sure Anki is running with AnkiConnect
2. **Configure API Key**: 
   - Click the extension icon
   - Go to Settings
   - Enter your API key
   - Select your preferred AI model
3. **Test Connection**: 
   - Click "Test Anki Connection" to verify AnkiConnect is working
   - The status indicator should turn green

## Usage

### Manual Capture

1. Navigate to any webpage with educational content
2. Click the Ambient Anki extension icon
3. Click "Capture Current Page"
4. Review the generated flashcards
5. Edit if needed and click "Add to Anki"

### Automatic Capture

1. Enable "Auto Capture" in settings
2. Configure minimum dwell time (default: 30 seconds)
3. Add domains to whitelist (only these will be captured) or blacklist (never capture)
4. Browse normally - pages will be captured automatically

### Testing

Open `test/test.html` in your browser to test the extension with sample content.

## Configuration Options

### AI Settings
- **Provider**: Choose between OpenAI, Anthropic, or custom API
- **Model**: Select specific model (GPT-3.5, GPT-4, Claude variants)
- **Max Cards**: Number of flashcards to generate per page (1-20)
- **Difficulty**: Easy, Medium, or Hard questions

### Capture Settings
- **Minimum Dwell Time**: How long to stay on a page before auto-capture
- **Include Source**: Add source URL to flashcard answers
- **Domain Rules**: Whitelist/blacklist specific domains

### Anki Settings
- **Default Deck**: Which deck to add cards to
- **Card Type**: Currently supports Basic cards

## Privacy & Security

- API keys are stored locally in Chrome's secure storage
- No data is sent to external servers except AI providers
- Page content is only processed when you explicitly capture
- Sensitive pages (banking, email) are automatically excluded

## Troubleshooting

### Anki Not Connected
- Ensure Anki is running
- Check AnkiConnect is installed and enabled
- Verify no firewall is blocking localhost:8765

### No Flashcards Generated
- Check your API key is valid
- Ensure the page has sufficient text content
- Try a different AI model or provider

### Extension Not Working
- Check Chrome DevTools console for errors
- Ensure all permissions are granted
- Try reloading the extension

## Development

### Project Structure
```
ambient-anki/
├── src/
│   ├── background/     # Service worker and core logic
│   ├── content/        # Content extraction scripts
│   ├── popup/          # Extension popup UI
│   ├── options/        # Settings page
│   └── utils/          # Helper utilities
├── icons/              # Extension icons
├── test/               # Test pages
└── manifest.json       # Extension manifest
```

### Building
```bash
npm run build
```

### Creating a Release
```bash
npm run zip
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

If you find this extension helpful, consider buying me a coffee!

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/monotykamary)

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Mozilla Readability for content extraction
- AnkiConnect for Anki integration
- OpenAI and Anthropic for AI capabilities