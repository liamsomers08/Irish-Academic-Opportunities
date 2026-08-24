window.IRISH_OPPORTUNITIES_CONFIG = Object.freeze({
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxtdwmsst7y-Olb5GKT0VtWXravSZ_4zysV5W1iybTk13DByyW3OayyvGCanhFebtRokg/exec',

  // These are used only if the public API cannot be reached.
  FALLBACK_COUNTS: {
    competitions: 268,
    programmes: 345,
    scholarships: 334
  },
  FALLBACK_UPDATED_LABEL: 'Master checked 23 August 2026',
  DEFAULT_TAB: 'home',
  PAGE_SIZE: 30,
  SITE_NAME: 'Irish Academic Opportunities Finder'
});

// Make the loading state explicit while the live Apps Script API responds.
if (window.IRISH_OPPORTUNITIES_CONFIG.API_BASE_URL) {
  const markConnecting = () => {
    const status = document.getElementById('status');
    if (status && status.textContent === 'Frontend preview') {
      status.textContent = 'Connecting to live data…';
    }
  };

  markConnecting();
  document.addEventListener('DOMContentLoaded', markConnecting, { once: true });

  // Warm the two Google hosts used by Apps Script web apps.
  ['https://script.google.com', 'https://script.googleusercontent.com'].forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    document.head.appendChild(link);
  });
}

// Parallel JSONP prefetch layer.
//
// The current page loader intentionally remains simple and asks for bootstrap,
// competitions, programmes, scholarships and upcoming in sequence. Apps Script
// can take a few seconds per request, so that serial pattern makes the page feel
// much slower than necessary. This small adapter starts the four heavy requests
// together as soon as the first bootstrap request is made, caches their JSONP
// payloads, then supplies them to the existing loader when it asks for each one.
// If any prefetch fails, that request automatically falls back to the page's
// normal JSONP behaviour.
(function installParallelApiPrefetch() {
  const base = window.IRISH_OPPORTUNITIES_CONFIG.API_BASE_URL;
  if (!base || !document.head) return;

  const head = document.head;
  const nativeAppend = head.appendChild.bind(head);
  const cache = new Map();
  let launched = false;

  function requestKey(url) {
    try {
      if (!String(url).startsWith(base)) return '';
      const parsed = new URL(url);
      const api = String(parsed.searchParams.get('api') || '').toLowerCase();
      if (api === 'dataset') {
        const kind = String(parsed.searchParams.get('kind') || '').toLowerCase();
        return kind ? `dataset:${kind}` : '';
      }
      return api;
    } catch (_) {
      return '';
    }
  }

  function prefetch(key, params) {
    if (cache.has(key)) return;

    const promise = new Promise((resolve, reject) => {
      const callback = `iao_prefetch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const url = new URL(base);

      Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
      url.searchParams.set('callback', callback);

      const timer = setTimeout(() => finish(new Error('prefetch timeout')), 15000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
      }

      function finish(error, payload) {
        cleanup();
        error ? reject(error) : resolve(payload);
      }

      window[callback] = (payload) => finish(null, payload);
      script.onerror = () => finish(new Error('prefetch network error'));
      script.src = url.toString();
      nativeAppend(script);
    });

    // Attach a catch immediately so a failed speculative request never creates
    // an unhandled-rejection warning. The existing loader will simply retry it.
    cache.set(key, promise.catch((error) => {
      cache.delete(key);
      throw error;
    }));
  }

  function launchHeavyRequests() {
    if (launched) return;
    launched = true;

    prefetch('dataset:competitions', { api: 'dataset', kind: 'competitions' });
    prefetch('dataset:programmes', { api: 'dataset', kind: 'programmes' });
    prefetch('dataset:scholarships', { api: 'dataset', kind: 'scholarships' });
    prefetch('upcoming', { api: 'upcoming' });
  }

  head.appendChild = function patchedAppend(node) {
    const isScript = node && String(node.tagName || '').toUpperCase() === 'SCRIPT';
    if (!isScript || !node.src || !String(node.src).startsWith(base)) {
      return nativeAppend(node);
    }

    const key = requestKey(node.src);

    // Bootstrap is still sent normally, but use that moment to start every
    // larger request in parallel.
    if (key === 'bootstrap') {
      launchHeavyRequests();
      return nativeAppend(node);
    }

    const pending = cache.get(key);
    if (!pending) return nativeAppend(node);

    let callback = '';
    try {
      callback = new URL(node.src).searchParams.get('callback') || '';
    } catch (_) {}

    pending.then((payload) => {
      if (callback && typeof window[callback] === 'function') {
        queueMicrotask(() => window[callback](payload));
      }
    }).catch(() => {
      // The speculative request failed. If the original loader callback still
      // exists, issue its normal network request now.
      if (!callback || typeof window[callback] === 'function') nativeAppend(node);
    });

    return node;
  };
})();
