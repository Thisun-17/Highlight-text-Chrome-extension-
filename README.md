# Text Highlighter Chrome Extension

A Chrome extension that allows users to easily highlight and save text from websites, with flexible storage options and theme support.

## Features

### Text Management
- **Save & Highlight Text**: Select text on any webpage and save it with a soft pink highlight
- **Save Text Only**: Save selected text without highlighting it on the page
- **Context Menu Integration**: Right-click to access save options
- **Popup Interface**: Quick access to all features from the extension icon

### Content Organization
- **Unified Library**: View all your saved content in one place
- **Filtering**: Filter between highlighted text and plain text
- **Share Functionality**: Share saved content or copy to clipboard
- **Delete Options**: Remove individual items or clear all at once

### Visual Customization
- **Theme Support**: Choose between light and dark modes
- **System Theme Detection**: Automatically matches your operating system preference
- **Responsive Design**: Works well on all screen sizes

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `my-extension` folder
5. The extension icon should appear in your browser toolbar

## Usage

### Saving Content
1. Select text on any webpage
2. Either:
   - Click the extension icon and use the popup buttons
   - Right-click and select "Save & Highlight Text" or "Save Text Only"
   - Use keyboard shortcuts (if configured)

### Managing Saved Content
1. Click "View Saved" in the extension popup or right-click the extension icon and select "View Saved Items"
2. Use the filter buttons to switch between all items, highlights-only, or text-only views
3. Click the delete button on any card to remove it
4. Click the share button to copy content to clipboard or share via Web Share API

### Customizing Appearance
1. In the saved items view, click the theme toggle button in the top-right corner
2. The theme will be remembered for future sessions

## Storage System
The extension uses Chrome's storage API with separate storage for:
- Highlighted text (with visual formatting)
- Plain text (no highlighting)
- Legacy items (for backwards compatibility)

## Development

This extension is built using:
- HTML, CSS, and JavaScript
- Chrome Extension APIs
- CSS variables for theming

### Project Structure
- `popup.html/js`: Extension popup interface
- `content.js`: Handles in-page highlighting
- `background.js`: Manages context menus and background processes
- `saved.html/js`: Library view for all saved content
- `theme.js`: Manages theme switching
- `content-storage.js`: Handles storage operations
- `utils.js`: Utility functions for sharing and notifications