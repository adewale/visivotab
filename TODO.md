# GPlusTab — Remaining Tasks

Audited against Google Chrome's **Modern Web Guidance** `chrome-extensions` skill.

---

## Completed

### Core Migration
- [x] Migrated `manifest.json` to Manifest V3 (`service_worker`, `host_permissions`)
- [x] Removed all Google+ / `gapi.plusone` integration
- [x] Moved inline scripts to external `background.js` / `flickrset.js`
- [x] Replaced `localStorage` with `chrome.storage.local`
- [x] Switched all URLs from HTTP to HTTPS
- [x] Modernized CSS (removed `-webkit-` prefixes)
- [x] Removed the `management` permission and app-launcher feature

### Service Worker Fixes
- [x] Replaced `XMLHttpRequest` with `fetch()` (XHR unavailable in SW)
- [x] Replaced `DOMParser` / XML with Flickr JSON API (DOMParser unavailable in SW)
- [x] Replaced `setTimeout` polling with `chrome.alarms` (SW terminates after ~30s idle)
- [x] Use `chrome.runtime.onInstalled` / `onStartup` lifecycle events
- [x] Added error handling with try/catch on all async operations
- [x] Converted `.then()` chains to `async/await`
- [x] Removed dead code (`fetchPool` was never called)
- [x] Updated README to remove Google+ "+1 button" reference
- [x] Added `alarms` permission to manifest

### Testing
- [x] Set up Vitest with jest-chrome mocking
- [x] Extracted testable pure functions with dependency injection
- [x] Created `src/photo-cache.js` for background worker logic
- [x] Created `src/newtab.js` for new tab page logic
- [x] Added property-based testing with fast-check
- [x] Created test fixtures from real Flickr API structure (prevents mock drift)
- [x] Created test data builders for consistent setup
- [x] Added boundary value tests (0, empty, edge cases)
- [x] Increased assertion density (3+ per test)
- [x] **59 unit tests passing**

### Icons
- [x] Removed `.jpg` icons (Chrome uses default icon when none specified)
- [ ] **Optional**: Add proper PNG icons at 16/48/128px if custom branding desired

---

## Remaining — Chrome Web Store Publishing

These are required to publish on the Chrome Web Store:

- [ ] **Privacy policy** — Required because the extension fetches from the Flickr API
      and stores data via `chrome.storage`. Host on HTTPS, link in the developer dashboard.
- [ ] **Screenshots** — At least one at 1280×800 or 640×400 showing the new tab in action.
      (Note: `gplustab_screenshot.jpg` exists at 1280×800 — may need updating)
- [ ] **Promo tile** — 440×280 small promotional tile image.
- [ ] **CHROMEWEBSTORE.md** — Single source of truth for the listing with:
      - Name, version, description
      - Plain-English justification for `storage` and `alarms` permissions
      - Justification for `https://api.flickr.com/` host permission
- [ ] **Developer account** — $5 one-time fee, 2FA enabled before publishing.
- [ ] **Package the ZIP** — Exclude `.git/`, `node_modules/`, `TODO.md`, `CHROMEWEBSTORE.md`,
      `test/`, `src/`, `package.json`, `vitest.config.js`.

---

## Testing Guide

### Run Unit Tests

```bash
npm test          # Run all tests once
npm run test:watch  # Run tests in watch mode
```

### Testing Best Practices Applied

Based on [testing-best-practices](https://github.com/adewale/testing-best-practices):

| Practice | Implementation |
|----------|----------------|
| **Property-based testing** | fast-check for invariants (escaping, URL structure, cover-fit math) |
| **Mock drift prevention** | Real Flickr API response structure in `test/fixtures/flickr-api.js` |
| **Test data builders** | `test/builders.js` for consistent, readable test setup |
| **Assertion density** | 3+ meaningful assertions per test |
| **Boundary values** | Empty arrays, 0 dimensions, threshold values |
| **Exhaustive testing** | All 9 transform-origin values verified |
| **Dependency injection** | Storage and fetch passed as parameters |

### What Unit Tests Cover (59 tests)

**`src/photo-cache.js`** (18 tests):
- `constructImageUrl()` — Builds Flickr static URLs from photo metadata
- `createCachedPhoto()` — Creates cache entries with size optimization logic
- `fetchPhotoset()` — Fetches and parses Flickr JSON API (with injected fetch)
- `buildInitialCache()` — Populates storage with shuffled photos (with injected storage)
- `refreshCache()` — Rotates cache: removes oldest, adds new (with injected deps)

**`src/newtab.js`** (21 tests):
- `escapeHtml()` — XSS prevention for user-generated content
- `selectRandomPhoto()` — Random selection from photo array
- `calculateImageTransform()` — Cover-fit scaling math for background images
- `buildFlickrPhotoUrl()` — Constructs photo page URLs
- `pickRandomTransformOrigin()` — Ken Burns effect origin points

### What Can Be Tested Without a Browser

| Category | Testable | How |
|----------|----------|-----|
| Pure functions | ✅ Yes | Direct unit tests |
| API parsing | ✅ Yes | Mock `fetch`, test response handling |
| Storage logic | ✅ Yes | Inject mock storage object |
| Error handling | ✅ Yes | Mock failures, verify graceful handling |
| DOM manipulation | ❌ No | Requires browser/jsdom |
| Chrome APIs | ❌ No | Requires browser extension context |
| Visual rendering | ❌ No | Requires browser |

### What Playwright Can Test (Integration/E2E)

Playwright can load the extension in a real Chromium instance:

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ]
});

// Test scenarios Playwright CAN verify:
```

| Scenario | How to Test |
|----------|-------------|
| Extension loads without errors | Check service worker status, no console errors |
| New tab displays a photo | Navigate to `chrome://newtab`, assert `#bg img` exists |
| Photo cache populates | Query `chrome.storage.local`, assert `photoCache.length > 0` |
| Byline shows photo info | Assert `#wrapper` contains title/owner text |
| Click opens Flickr | Click byline, assert navigation to flickr.com |
| Mouse movement reveals byline | Simulate mouse move, assert `#wrapper` opacity changes |
| Window resize recalculates | Resize viewport, verify image transform updates |
| Alarm triggers refresh | Use `chrome.alarms.create` with short delay, verify cache updates |

**Playwright Limitations for Extensions**:
- Cannot directly access `chrome.*` APIs from test code
- Must use `page.evaluate()` to interact with extension context
- Cannot test service worker lifecycle directly (use DevTools Protocol)
- `chrome://newtab` may redirect; use extension's own HTML path instead

### Example Playwright Test

```javascript
// test/e2e/extension.spec.js
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const extensionPath = path.resolve(__dirname, '../../');

test.describe('GPlusTab Extension', () => {
  let context;
  let page;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('displays photo on new tab', async () => {
    page = await context.newPage();
    await page.goto('file://' + path.join(extensionPath, 'flickrset.html'));

    // Wait for image to load (may take time for API fetch on first run)
    await page.waitForSelector('#bg img', { timeout: 10000 });

    const img = await page.$('#bg img');
    expect(img).not.toBeNull();

    const src = await img.getAttribute('src');
    expect(src).toContain('flickr');
  });

  test('shows byline on mouse movement', async () => {
    page = await context.newPage();
    await page.goto('file://' + path.join(extensionPath, 'flickrset.html'));
    await page.waitForSelector('#bg img', { timeout: 10000 });

    // Initially hidden
    const initialOpacity = await page.$eval('#wrapper', el =>
      getComputedStyle(el).opacity
    );
    expect(initialOpacity).toBe('0');

    // Move mouse
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 100);

    // Should become visible
    await page.waitForFunction(() =>
      getComputedStyle(document.getElementById('wrapper')).opacity === '1'
    );
  });
});
```

---

## Architecture

```
visivotab/
├── manifest.json          # MV3 extension manifest
├── background.js          # Service worker entry point (imports from src/)
├── flickrset.js           # New tab page entry point (imports from src/)
├── flickrset.html         # New tab page HTML
├── src/
│   ├── photo-cache.js     # Testable: Flickr API, caching logic
│   └── newtab.js          # Testable: UI helpers, pure functions
├── test/
│   ├── photo-cache.test.js
│   └── newtab.test.js
├── package.json
└── vitest.config.js
```

**Key design decisions for testability**:
1. **Pure functions** — No side effects, easy to test with any input
2. **Dependency injection** — `storage` and `fetch` passed as parameters
3. **Separation** — Entry points (`background.js`, `flickrset.js`) wire dependencies;
   logic lives in `src/` modules that don't depend on browser globals
