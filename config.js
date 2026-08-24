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

// The page initially contains preview copy in the static HTML so it remains
// useful if the API is unavailable. While the live Apps Script API is loading,
// make the status explicit rather than implying that preview mode is final.
if (window.IRISH_OPPORTUNITIES_CONFIG.API_BASE_URL) {
  const markConnecting = () => {
    const status = document.getElementById('status');
    if (status && status.textContent === 'Frontend preview') {
      status.textContent = 'Connecting to live data…';
    }
  };

  markConnecting();
  document.addEventListener('DOMContentLoaded', markConnecting, { once: true });

  // Warm the connection to Apps Script as early as possible.
  ['https://script.google.com', 'https://script.googleusercontent.com'].forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    document.head.appendChild(link);
  });
}
