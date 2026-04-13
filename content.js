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
 * We run before LinkedIn's script and replace the built-in "fetch",
 * "XMLHttpRequest", "navigator.sendBeacon", and image "src" with our own
 * versions. When LinkedIn's script tries to use any of these with a
 * "chrome-extension://" URL, we silently return a fake successful response
 * instead of making a real request. So:
 *
 *   - No thousands of real requests = no memory spike
 *   - No errors in the console at all
 *   - LinkedIn's script still runs; it just gets a silent 200 OK for those probes
 *
 * LinkedIn probes via fetch/XHR/sendBeacon on some pages and via Image
 * (img.src) on others (e.g. profile pages /in/). We block all of these.
 *
 * We only block requests to chrome-extension:// URLs. All other requests
 * (your normal LinkedIn traffic, images, API calls) go through unchanged.
 *
 * PRIVACY: This extension does not collect, store, or send any data.
 * It only runs on LinkedIn and only changes how fetch/XHR/Image/sendBeacon
 * behave for chrome-extension:// URLs.
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
    if (input instanceof URL) {
      return input.href;  // URL objects use .href
    }
    if (input && typeof input.url === 'string') {
      return input.url;   // Request object has a .url property
    }
    return '';
  }

  // -------------------------------------------------------------------------
  // Override window.fetch — persistent via defineProperty getter/setter
  // -------------------------------------------------------------------------
  // Problem: LinkedIn's own interceptor overwrites window.fetch after we set it,
  // which breaks our block. To survive that, we define a getter/setter on
  // window.fetch so that whenever LinkedIn (or anyone) replaces window.fetch,
  // our setter automatically re-wraps their new function with our check.
  // This way the chrome-extension:// block is always in the call chain.

  var realFetch = window.fetch;

  function wrapFetch(fn) {
    return function (input, init) {
      var url = getUrlFromFetchInput(input);
      if (url && url.indexOf(BLOCKED_URL_PREFIX) === 0) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return fn.apply(this, arguments);
    };
  }

  var _currentFetch = wrapFetch(realFetch);

  Object.defineProperty(window, 'fetch', {
    get: function () { return _currentFetch; },
    set: function (newFetch) {
      // When LinkedIn overwrites window.fetch with its own interceptor,
      // wrap that interceptor so our check still runs first.
      _currentFetch = wrapFetch(newFetch);
    },
    configurable: false
  });

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
    this._blockedByProbeFilter = (typeof url === 'string' && url.indexOf(BLOCKED_URL_PREFIX) === 0);
    if (this._blockedByProbeFilter) return;
    return realOpen.apply(this, arguments);
  };

  RealXHR.prototype.send = function (body) {
    if (this._blockedByProbeFilter) {
      Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
      Object.defineProperty(this, 'status', { value: 200, configurable: true });
      Object.defineProperty(this, 'responseText', { value: '', configurable: true });
      this.dispatchEvent(new Event('readystatechange'));
      this.dispatchEvent(new Event('load'));
      return;
    }
    return realSend.apply(this, arguments);
  };

  // -------------------------------------------------------------------------
  // Override Image src (profile pages and some bundles use this to probe)
  // -------------------------------------------------------------------------
  // LinkedIn also probes by doing:  img = new Image(); img.src = "chrome-extension://...";
  // Setting img.src to a chrome-extension URL triggers a network request and console error.
  // We override the src setter so that when the value is a chrome-extension URL we set
  // a harmless 1x1 transparent pixel instead, so no request is made.
  var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imgDesc && imgDesc.set) {
    var nativeSetSrc = imgDesc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function (val) {
        if (typeof val === 'string' && val.indexOf(BLOCKED_URL_PREFIX) === 0) {
          val = BLANK_IMG;
        }
        nativeSetSrc.call(this, val);
      },
      get: imgDesc.get,
      configurable: true,
      enumerable: true
    });
  }

  // -------------------------------------------------------------------------
  // Override navigator.sendBeacon
  // -------------------------------------------------------------------------
  if (navigator.sendBeacon) {
    var realSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' && url.indexOf(BLOCKED_URL_PREFIX) === 0) {
        return true;
      }
      return realSendBeacon(url, data);
    };
  }
})();
