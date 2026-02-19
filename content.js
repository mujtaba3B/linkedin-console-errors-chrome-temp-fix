/**
 * LinkedIn Extension Probe Blocker
 * ===============================
 *
 * WHAT PROBLEM DOES THIS FIX?
 * ---------------------------
 * LinkedIn's website runs a script that tries to detect which Chrome extensions
 * you have installed. It does this by trying to fetch a file from ~3000 known
 * extension URLs, one by one. For example:
 *
 *   fetch("chrome-extension://some-extension-id/some-file.png")
 *
 * When the extension isn't installed, each of those requests fails and Chrome
 * logs an error. After a minute you get thousands of errors and your browser
 * can run out of memory. See: https://www.reddit.com/r/linkedin/comments/1qwsmjg/
 *
 * WHAT DOES THIS EXTENSION DO?
 * ---------------------------
 * We run before LinkedIn's script and replace the built-in "fetch" and
 * "XMLHttpRequest" with our own versions. When LinkedIn's script later tries
 * to fetch any URL that starts with "chrome-extension://", we immediately
 * say "failed" without actually sending a network request. So:
 *
 *   - No thousands of real requests = no memory spike
 *   - No thousands of errors in the console
 *   - LinkedIn's script still runs; it just gets "failed" for those probes
 *
 * We only block requests to chrome-extension:// URLs. All other requests
 * (your normal LinkedIn traffic, images, API calls) go through unchanged.
 *
 * PRIVACY: This extension does not collect, store, or send any data.
 * It only runs on LinkedIn and only changes how fetch/XHR behave for
 * chrome-extension:// URLs.
 */

(function () {
  'use strict';

  // The URL prefix we want to block. LinkedIn probes URLs like:
  //   chrome-extension://abcdef123456/path/to/file.png
  var BLOCKED_URL_PREFIX = 'chrome-extension://';

  // -------------------------------------------------------------------------
  // Helper: get the URL from a fetch() call
  // -------------------------------------------------------------------------
  // fetch() can be called with a URL string:     fetch("https://example.com")
  // or with a Request object:                    fetch(request)
  // We need the URL string so we can check if it starts with chrome-extension://
  function getUrlFromFetchInput(input) {
    if (typeof input === 'string') {
      return input;
    }
    if (input && typeof input.url === 'string') {
      return input.url;   // Request object has a .url property
    }
    return '';
  }

  // -------------------------------------------------------------------------
  // Override window.fetch
  // -------------------------------------------------------------------------
  // Save the real fetch so we can call it for normal requests.
  var realFetch = window.fetch;

  // Replace window.fetch with our version.
  window.fetch = function (input, init) {
    var url = getUrlFromFetchInput(input);

    // If this is a request to a chrome-extension:// URL, don't actually do it.
    // Just return a rejected promise so the caller gets "failed" immediately.
    if (url && url.indexOf(BLOCKED_URL_PREFIX) === 0) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    // For everything else, use the real fetch.
    return realFetch.apply(this, arguments);
  };

  // -------------------------------------------------------------------------
  // Override XMLHttpRequest (same idea as fetch)
  // -------------------------------------------------------------------------
  // Some code uses the older XMLHttpRequest instead of fetch. We need to
  // block those too. We wrap .open() to remember the URL, and .send() to
  // check it before sending.
  var RealXHR = window.XMLHttpRequest;
  var realOpen = RealXHR.prototype.open;
  var realSend = RealXHR.prototype.send;

  RealXHR.prototype.open = function (method, url) {
    // Store the URL on this request so we can check it in send().
    this._requestUrl = url;
    return realOpen.apply(this, arguments);
  };

  RealXHR.prototype.send = function (body) {
    // If this request is to a chrome-extension:// URL, abort it and don't send.
    if (this._requestUrl && this._requestUrl.indexOf(BLOCKED_URL_PREFIX) === 0) {
      this.abort();
      return;
    }

    // For everything else, use the real send.
    return realSend.apply(this, arguments);
  };
})();
