# Deep Focus Browser Bridge

This unpacked browser extension reports the active tab URL to the Deep Focus desktop app at `http://127.0.0.1:17321/browser-event`.

During focus mode, the desktop app remains the source of truth for the unproductive URL list. If the desktop app replies with `{"action":"block"}`, the extension closes the exact active tab.

## Local Install

### Edge or Chrome

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this folder: `extensions/deepfocus-browser`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose Load Temporary Add-on.
3. Select `extensions/deepfocus-browser/manifest.json`.

The extension is intentionally not packaged for the Chrome Web Store yet.
