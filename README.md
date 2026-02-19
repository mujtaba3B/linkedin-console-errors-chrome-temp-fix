# LinkedIn continuous console errors on Chrome (temp fix)

A tiny Chrome extension that stops LinkedIn’s “extension probing” from spamming your console and using lots of memory.

## What’s the problem?

LinkedIn’s site runs code that tries to detect which Chrome extensions you have. It does this by trying to load a file from **about 3000 known extension URLs**. For example:

```
chrome-extension://some-id/some-file.png
```

When you don’t have that extension, the request fails. Chrome logs each failure. After a minute you get **thousands of errors** and the tab can use a lot of memory. Same issue discussed here:

- [Reddit: LinkedIn continuous console errors on Google Chrome](https://www.reddit.com/r/linkedin/comments/1qwsmjg/linkedin_continuous_console_errors_on_google/)

LinkedIn has said they’re working on a fix. Until then, this extension is a **temporary workaround**.

## What does this extension do?

It runs **before** LinkedIn’s script and changes how `fetch` and `XMLHttpRequest` work **only for** URLs that start with `chrome-extension://`. For those URLs it immediately returns “failed” without sending a real network request. So:

- No thousands of real requests → no memory spike  
- No thousands of console errors  
- All other LinkedIn traffic (pages, API, images) is unchanged  

**Privacy:** The extension does not collect, store, or send any data. It only runs on LinkedIn and only blocks those probe requests.

## Quick install (no Git needed)

1. Open **[this repository](https://github.com/mujtaba3B/linkedin-console-errors-chrome-temp-fix)** on GitHub.
2. Click the green **Code** button → **Download ZIP**. Unzip the folder.
3. In Chrome go to **chrome://extensions/**, turn **Developer mode** on (top right), click **Load unpacked**, and select the unzipped folder (the one that contains `manifest.json`).
4. Reload LinkedIn. The console errors should stop.

## Detailed install (load unpacked)

1. Download or clone [this repository](https://github.com/mujtaba3B/linkedin-console-errors-chrome-temp-fix) so you have a folder with:
   - `manifest.json`
   - `content.js`
   - (optional) `README.md`

2. Open Chrome and go to **chrome://extensions/**

3. Turn **Developer mode** on (top right)

4. Click **Load unpacked**

5. Select the folder that contains `manifest.json` and `content.js`

6. Reload LinkedIn. The console errors and memory issue should stop.

## What’s in each file?

- **manifest.json** – Tells Chrome: “Run `content.js` on LinkedIn pages, as early as possible (`document_start`), in the page’s own context (`world: MAIN`) so we can override `fetch` before LinkedIn’s script runs.”
- **content.js** – The code that overrides `fetch` and `XMLHttpRequest` and blocks any request whose URL starts with `chrome-extension://`. Heavily commented so you can read and share it.

## Will this break my other extensions?

No. This only affects **requests that the LinkedIn page makes** (e.g. LinkedIn’s own script calling `fetch("chrome-extension://...")`). Your other extensions are loaded by Chrome, not by the page, and their content scripts run in a separate context. They keep working normally.

## When LinkedIn fixes the issue

You can disable or remove this extension. It’s only a temporary fix until LinkedIn ships their fix.
