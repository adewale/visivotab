# GPlusTab — Remaining Tasks

Audited against Google Chrome's **Modern Web Guidance** `chrome-extensions` skill.

---

## Completed

- [x] Migrated `manifest.json` to Manifest V3 (`service_worker`, `host_permissions`)
- [x] Removed all Google+ / `gapi.plusone` integration
- [x] Moved inline scripts to external `background.js` / `flickrset.js`
- [x] Replaced `localStorage` with `chrome.storage.local`
- [x] Switched all URLs from HTTP to HTTPS
- [x] Modernized CSS (removed `-webkit-` prefixes)
- [x] Removed the `management` permission and app-launcher feature
- [x] Replaced `XMLHttpRequest` with `fetch()` (XHR unavailable in service workers)
- [x] Replaced `DOMParser` / XML with Flickr JSON API (DOMParser unavailable in SW)
- [x] Replaced `setTimeout` polling with `chrome.alarms` (SW terminates after ~30s idle)
- [x] Use `chrome.runtime.onInstalled` / `onStartup` lifecycle events
- [x] Added error handling with try/catch on all async operations
- [x] Converted `.then()` chains to `async/await`
- [x] Removed dead code (`fetchPool` was never called)
- [x] Updated README to remove Google+ "+1 button" reference
- [x] Added `alarms` permission to manifest

---

## Remaining — Icons

- [ ] **Convert icons to PNG and add 16×16 size** — `manifest.json:18-21`
      Current icons are `.jpg` and missing the 16px size. Guidance: supply real PNGs
      at 16, 48, and 128 px, or omit `"icons"` entirely and let Chrome use a default.

---

## Remaining — Chrome Web Store Publishing

These are required to publish on the Chrome Web Store:

- [ ] **Privacy policy** — Required because the extension fetches from the Flickr API
      and stores data via `chrome.storage`. Host on HTTPS, link in the developer dashboard.
- [ ] **Screenshots** — At least one at 1280×800 or 640×400 showing the new tab in action.
- [ ] **Promo tile** — 440×280 small promotional tile image.
- [ ] **CHROMEWEBSTORE.md** — Single source of truth for the listing with:
      - Name, version, description
      - Plain-English justification for `storage` and `alarms` permissions
      - Justification for `https://api.flickr.com/` host permission
- [ ] **Developer account** — $5 one-time fee, 2FA enabled before publishing.
- [ ] **Package the ZIP** — Exclude `.git/`, `TODO.md`, `CHROMEWEBSTORE.md`, dev files.

---

## Testing

### Manual Testing

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select this directory
4. Open a new tab — should display a photo from the Flickr set
5. Check the service worker console (click "service worker" link on the extension card)
   for errors; verify "Flickr API" fetch succeeds and `photoCache` populates

### Programmatic Testing

**Unit tests** (recommended setup):

```bash
npm init -y
npm install --save-dev vitest jest-chrome
```

Create `background.test.js`:
```javascript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { chrome } from 'jest-chrome';

// Mock chrome APIs
global.chrome = chrome;

// Mock fetch
global.fetch = vi.fn();

describe('background service worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
    chrome.alarms.create.mockResolvedValue();
  });

  it('fetches photos from Flickr JSON API', async () => {
    const mockResponse = {
      stat: 'ok',
      photoset: {
        photo: [
          { id: '1', title: 'Test', farm: 1, server: '1', secret: 'abc' }
        ]
      }
    };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    // Import and test fetchPhotoset
    // ... test implementation
  });

  it('stores photos in chrome.storage.local', async () => {
    // Test that buildInitialCache calls chrome.storage.local.set
  });

  it('schedules refresh alarm', async () => {
    // Test that scheduleRefresh creates an alarm
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'refreshPhotoCache',
      { periodInMinutes: 5 }
    );
  });
});
```

**Integration tests with Puppeteer**:

```javascript
import puppeteer from 'puppeteer';
import path from 'path';

const extensionPath = path.resolve(__dirname);

const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ]
});

// Open new tab (triggers the extension)
const page = await browser.newPage();
await page.goto('chrome://newtab');

// Verify photo loaded
const bgDiv = await page.$('#bg img');
expect(bgDiv).not.toBeNull();

// Check storage was populated
const storageData = await page.evaluate(() => {
  return new Promise(resolve => {
    chrome.storage.local.get(['photoCache'], resolve);
  });
});
expect(storageData.photoCache.length).toBeGreaterThan(0);

await browser.close();
```

**What to test**:
1. `fetchPhotoset()` returns parsed photo array from Flickr JSON
2. `buildInitialCache()` populates `chrome.storage.local` with up to 30 photos
3. `refreshCache()` rotates photos (removes oldest, adds new)
4. `chrome.alarms` is created with correct interval
5. Error handling: API failures don't crash the service worker
6. New tab page (`flickrset.js`) renders a cached photo

---

## Notes — Already Compliant

- No `eval()` / inline scripts (CSP-safe)
- No `tabs` permission (we don't read `tab.url` / `tab.title`)
- `host_permissions` narrowly scoped to `https://api.flickr.com/`
- Event listeners registered at top level of service worker
- All chrome API calls use `async/await`
- State persisted in `chrome.storage`, not global variables
