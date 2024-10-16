var CACHE_VERSION = 1;
var CURRENT_CACHES = {
  prefetch: 'prefetch-cache-v' + CACHE_VERSION
};

self.addEventListener('install', function(event) {
  var now = Date.now();
  // Here are all the current files WiFi no QR caches while Service Worker installation.
  // Add files as needed and change CACHE_VERSION at the top of the file.
  var urlsToPrefetch = [
  '/',
  '/index.html',
  '/style.css',
  '/style-responsive.css',
  '/bootstrap/dist/css/bootstrap.css',
  '/qifi.png',
  '/qifi-small.png',
  '/manifest.json',
  '/jquery/jquery-3.3.1.min.js',
  '/bootstrap/dist/js/bootstrap.min.js',
  '/jquery-qrcode/jquery.qrcode.min.js',
  '/jquery.storage.js/jquery.storage.js',
  '/print.css',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.woff2',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.eot',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.svg',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.ttf',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.woff',
  '/bootstrap/dist/fonts/glyphicons-halflings-regular.woff2'
  ];

  // All of these logging statements should be visible via the "Inspect" interface
  // for the relevant SW accessed via chrome://serviceworker-internals
  console.log('[Service Worker] Handling install event. Resources to prefetch:', urlsToPrefetch);

  event.waitUntil(
    caches.open(CURRENT_CACHES.prefetch).then(function(cache) {
      var cachePromises = urlsToPrefetch.map(function(urlToPrefetch) {
        // This constructs a new URL object using the service worker's script location as the base
        // for relative URLs.
        var url = new URL(urlToPrefetch, location.href);
        // Append a cache-bust=TIMESTAMP URL parameter to each URL's query string.
        // This is particularly important when precaching resources that are later used in the
        // fetch handler as responses directly, without consulting the network (i.e. cache-first).
        // If we were to get back a response from the HTTP browser cache for this precaching request
        // then that stale response would be used indefinitely, or at least until the next time
        // the service worker script changes triggering the install flow.
        url.search += (url.search ? '&' : '?') + 'cache-bust=' + now;
        // It's very important to use {mode: 'no-cors'} if there is any chance that
        // the resources being fetched are served off of a server that doesn't support
        // CORS (http://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
        // The drawback of hardcoding {mode: 'no-cors'} is that the response from all
        // cross-origin hosts will always be opaque
        // (https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#cross-origin-resources)
        // and it is not possible to determine whether an opaque response represents a success or failure
        // (https://github.com/whatwg/fetch/issues/14).
        var request = new Request(url, {mode: 'no-cors'});
        return fetch(request).then(function(response) {
          if (response.status >= 400) {
            throw new Error('request for ' + urlToPrefetch +
              ' failed with status ' + response.statusText);
          }
          // Use the original URL without the cache-busting parameter as the key for cache.put().
          return cache.put(urlToPrefetch, response);
        }).catch(function(error) {
          console.error('[Service Worker] Not caching ' + urlToPrefetch + ' due to ' + error);
        });
      });
      return Promise.all(cachePromises).then(function() {
        console.log('[Service Worker] Pre-fetching complete.');
      });
    }).catch(function(error) {
      console.error('[Service Worker] Pre-fetching failed:', error);
    })
  );
});

self.addEventListener('activate', function(event) {
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic will handle the case where
  // there are multiple versioned caches.
  var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
    return CURRENT_CACHES[key];
  });

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (expectedCacheNames.indexOf(cacheName) === -1) {
            // If this cache name isn't present in the array of "expected" cache names, then delete it.
            console.log('[Service Worker] Deleting out of date cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  console.log('[Service Worker] Handling fetch event for', event.request.url);
  event.respondWith(
    // caches.match() will look for a cache entry in all of the caches available to the service worker.
    // It's an alternative to first opening a specific named cache and then matching on that.
    caches.match(event.request).then(function(response) {
      if (response) {
        console.log('[Service Worker] Found response in cache:', response);
        return response;
      }
      console.log('[Service Worker] No response found in cache. About to fetch from network...');
      // event.request will always have the proper mode set ('cors, 'no-cors', etc.) so we don't
      // have to hardcode 'no-cors' like we do when fetch()ing in the install handler.
      return fetch(event.request).then(function(response) {
        console.log('[Service Worker] Response from network is:', response);
        return response;
      }).catch(function(error) {
        // This catch() will handle exceptions thrown from the fetch() operation.
        // Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
        // It will return a normal response object that has the appropriate error code set.
        console.error('[Service Worker] Fetching failed:', error);
        throw error;
      });
    })
  );
});
