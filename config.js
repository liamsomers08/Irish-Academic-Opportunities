window.IRISH_OPPORTUNITIES_CONFIG = Object.freeze({
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxtdwmsst7y-Olb5GKT0VtWXravSZ_4zysV5W1iybTk13DByyW3OayyvGCanhFebtRokg/exec',

  // Used only when the public API cannot be reached. These counts reflect the
  // evidence-quality publication gate verified against the live master on 26 August 2026.
  FALLBACK_COUNTS: {
    competitions: 331,
    programmes: 343,
    scholarships: 333
  },
  FALLBACK_UPDATED_LABEL: 'Verified evidence-qualified public master 26 August 2026',
  DEFAULT_TAB: 'home',
  PAGE_SIZE: 30,
  SITE_NAME: 'Irish Academic Opportunities Finder'
});

// A corrupted local save value should never be able to stop the application
// before its UI loads.
try {
  const stored = JSON.parse(localStorage.getItem('iao_saved') || '[]');
  if (!Array.isArray(stored)) localStorage.removeItem('iao_saved');
} catch (_) {
  localStorage.removeItem('iao_saved');
}

function syncVerifiedFallbackCounts_() {
  const c = window.IRISH_OPPORTUNITIES_CONFIG.FALLBACK_COUNTS;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  set('cc', c.competitions);
  set('pc', c.programmes);
  set('sc', c.scholarships);
  set('total', c.competitions + c.programmes + c.scholarships);
}

syncVerifiedFallbackCounts_();
document.addEventListener('DOMContentLoaded', syncVerifiedFallbackCounts_, { once: true });

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

    cache.set(key, promise);
    // Mark speculative failures as handled immediately. The original rejected
    // promise remains in the cache so the loader can detect it and retry the
    // normal request without producing an unhandled-rejection warning.
    promise.catch(() => {});
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

// Stage 8 mobile polish is loaded as an isolated enhancement layer so desktop
// behavior and the existing finder/data pipeline remain unchanged.
(function loadStage8MobilePolish() {
  if (!document.querySelector('link[data-stage8-mobile]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './stage8-mobile.css';
    css.dataset.stage8Mobile = 'true';
    document.head.appendChild(css);
  }

  const loadScript = () => {
    if (document.querySelector('script[data-stage8-mobile]')) return;
    const script = document.createElement('script');
    script.src = './stage8-mobile.js';
    script.dataset.stage8Mobile = 'true';
    document.body.appendChild(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadScript, { once: true });
  } else {
    loadScript();
  }
})();

// Geographic search is a post-core enhancement. Loading at DOMContentLoaded
// guarantees finder-data.js has declared its matching/scoring functions before
// this layer extends them, while still being ready before a user can search.
(function loadGeographicSearch() {
  const loadScript = () => {
    if (document.querySelector('script[data-geographic-search]')) return;
    const script = document.createElement('script');
    script.src = './geo-search.js';
    script.dataset.geographicSearch = 'true';
    document.body.appendChild(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadScript, { once: true });
  } else {
    loadScript();
  }
})();

// Stage 5 release verification should run exactly once. index.html already
// declares stage5.js, so do not inject a second copy after window load. The
// fallback injection remains for pages that use this config without declaring it.
window.addEventListener('load', () => {
  const alreadyDeclared = [...document.scripts].some((script) => {
    const src = script.getAttribute('src') || '';
    return /(?:^|\/)stage5\.js(?:[?#]|$)/.test(src);
  });
  if (alreadyDeclared || document.querySelector('script[data-stage5-release-guard]')) return;
  const script = document.createElement('script');
  script.src = './stage5.js';
  script.dataset.stage5ReleaseGuard = 'true';
  document.body.appendChild(script);
}, { once: true });