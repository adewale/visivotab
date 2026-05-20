# GPlusTab — Remaining Tasks

Status of the Manifest V3 migration and outstanding work, audited against Google
Chrome's official **Modern Web Guidance** `chrome-extensions` skill
(`GoogleChrome/modern-web-guidance`).

## Done
- [x] Migrated `manifest.json` to Manifest V3 (`service_worker`, `host_permissions`)
- [x] Removed all Google+ / `gapi.plusone` integration
- [x] Moved inline scripts to external `background.js` / `flickrset.js`
- [x] Replaced `localStorage` with `chrome.storage.local`
- [x] Switched all URLs from HTTP to HTTPS
- [x] Modernized CSS (removed `-webkit-` prefixes)
- [x] Removed the `management` permission and the app-launcher feature that depended on it

---

## Critical — extension's background worker is currently broken in MV3

These are MV3 service-worker limitations. Each one throws at runtime, so the photo
cache never populates. (Earlier review passes missed these because they assumed the
service worker had DOM/legacy APIs.)

- [ ] **Replace `XMLHttpRequest` with `fetch()`** — `background.js:33,48`.
      `XMLHttpRequest` does not exist in MV3 service workers; `new XMLHttpRequest()`
      throws `ReferenceError`. Rewrite `fetchSet`/`fetchPool` using `await fetch(...)`.
- [ ] **Replace `DOMParser` with the Flickr JSON API** — `background.js:63-65`.
      `DOMParser` is unavailable in service workers (no DOM). Request
      `&format=json&nojsoncallback=1` from Flickr and parse with `await res.json()`
      instead of parsing XML.
- [ ] **Replace the `setTimeout` polling loop with `chrome.alarms`** —
      `background.js:79,82` (`againAndAgain`). Service workers terminate after ~30s
      idle, so the 5-minute `longTimeout` refresh never fires. Use `chrome.alarms`
      (min 30s interval) and add the `"alarms"` permission to `manifest.json`.
- [ ] **Trigger work from lifecycle events, not top-level `.then()`** —
      `background.js:137-139`. Use `chrome.runtime.onInstalled` and
      `chrome.runtime.onStartup` to seed the cache; register listeners at the top level.

## High

- [ ] **Convert icons to PNG and add the 16×16 size** — `manifest.json:19-22`.
      Guidance: each icon must be a real PNG at 16, 48, and 128 px (currently `.jpg`,
      and 16 px is missing). Either supply `icon16.png/48/128` or omit `"icons"` entirely.
- [ ] **Add error handling to all network/async operations** — `background.js`.
      No handling for failed Flickr requests or `storage` errors; wrap in try/catch.
- [ ] **Use `async/await` instead of `.then()` chains** — `background.js:137`
      (`initConfig().then(...)`). Guidance rule #5: never use `.then()` chains.

## Chrome Web Store readiness (from guidance "Publishing" section)

- [ ] **Privacy policy** — required because the extension fetches from the Flickr API
      and stores data via `chrome.storage`. Host it on HTTPS and link it in the dashboard.
- [ ] **Screenshots** — at least one at 1280×800 or 640×400.
- [ ] **Promo tile** — 440×280 small promo tile.
- [ ] **`CHROMEWEBSTORE.md`** — single source of truth for the listing: name, version,
      description, and a plain-English justification for the `storage` permission and the
      `https://api.flickr.com/` host permission.
- [ ] **Packaging** — ZIP must exclude `.git/`, `TODO.md`, `CHROMEWEBSTORE.md`, and any dev files.
- [ ] **Developer account** — $5 one-time fee, 2FA enabled before publishing.

## Cleanup / minor

- [ ] **Remove dead code: `fetchPool`** — `background.js:32-45` is never called
      (only `fetchSet` is used).
- [ ] **Update README** — still references the Google+ "+1 button"; remove it.
- [ ] **Hardcoded Flickr API key** — `background.js:5` ships a real API key in the
      bundle. Acceptable for a personal Flickr read-only key, but note it is publicly
      visible to anyone who inspects the extension.

---

## Notes on what is already compliant
- No `eval()` / inline scripts / inline event handlers (CSP-safe).
- No `tabs` permission requested (the extension never reads `tab.url`/`tab.title`).
- `host_permissions` are narrowly scoped (`https://api.flickr.com/`, not `<all_urls>`).
- No `chrome.action` usage, so no `"action"` key is required.
- No side panel, offscreen document, content scripts, or context menus to configure.
