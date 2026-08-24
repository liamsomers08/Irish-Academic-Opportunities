window.IRISH_OPPORTUNITIES_CONFIG = Object.freeze({
  // Paste the deployed Google Apps Script /exec URL here after installing
  // apps-script/PublicApi.gs and publishing a new web-app version.
  API_BASE_URL: '',

  // These are used only while the public API is not connected.
  // They reflect the live master summary checked on 23/24 August 2026.
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
