/**
 * PublicApi.gs
 *
 * Small JSONP bridge for the standalone GitHub Pages frontend.
 * It deliberately reuses the existing V3 public-safe functions instead of
 * reading the master sheets directly, so private monitor/research fields stay private.
 *
 * IMPORTANT: do not create a second doGet(). Add this near the top of the
 * existing V3 doGet(e):
 *
 *   const publicApiResponse = webPublicApiMaybeHandleGet(e);
 *   if (publicApiResponse) return publicApiResponse;
 *
 * If the project already has doPost(e), add the equivalent helper call there.
 * If it does not, you may add:
 *
 *   function doPost(e) {
 *     return webPublicApiHandlePost(e);
 *   }
 */

const WEB_PUBLIC_API_ALLOWED_KINDS = Object.freeze([
  'competitions',
  'programmes',
  'scholarships'
]);

function webPublicApiMaybeHandleGet(e) {
  if (!e || !e.parameter || !e.parameter.api) return null;
  return webPublicApiHandleGet(e);
}

function webPublicApiHandleGet(e) {
  const p = (e && e.parameter) || {};
  const callback = webPublicApiSafeCallback_(p.callback);

  try {
    const action = String(p.api || '').toLowerCase();
    let data;

    switch (action) {
      case 'bootstrap':
        data = webAppGetBootstrap();
        break;

      case 'dataset': {
        const kind = String(p.kind || '').toLowerCase();
        if (WEB_PUBLIC_API_ALLOWED_KINDS.indexOf(kind) === -1) {
          throw new Error('Unsupported dataset.');
        }
        data = webAppGetDataset(kind);
        break;
      }

      case 'upcoming':
        data = webAppGetUpcoming();
        break;

      case 'related': {
        const kind = String(p.kind || '').toLowerCase();
        const id = String(p.id || '').trim();
        const limit = Math.max(1, Math.min(10, Number(p.limit || 5)));
        if (WEB_PUBLIC_API_ALLOWED_KINDS.indexOf(kind) === -1 || !id) {
          throw new Error('Invalid related-opportunity request.');
        }
        data = webAppGetRelated(kind, id, limit);
        break;
      }

      default:
        throw new Error('Unsupported API action.');
    }

    return webPublicApiJsonp_(callback, { ok: true, data: data });
  } catch (err) {
    return webPublicApiJsonp_(callback, {
      ok: false,
      error: err && err.message ? String(err.message) : 'Request failed.'
    });
  }
}

function webPublicApiHandlePost(e) {
  try {
    const raw = e && e.postData && e.postData.contents
      ? String(e.postData.contents)
      : '{}';
    const body = JSON.parse(raw);

    if (String(body.action || '').toLowerCase() !== 'feedback') {
      throw new Error('Unsupported POST action.');
    }

    const payload = body.payload || {};
    const result = webSubmitFeedback(payload);
    return webPublicApiJson_({ ok: true, data: result });
  } catch (err) {
    return webPublicApiJson_({
      ok: false,
      error: err && err.message ? String(err.message) : 'Request failed.'
    });
  }
}

function webPublicApiSafeCallback_(value) {
  const callback = String(value || '').trim();
  if (!callback) throw new Error('Missing callback.');

  // Allows the simple generated callback names used by the frontend, while
  // preventing executable callback injection.
  if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback)) {
    throw new Error('Invalid callback.');
  }
  return callback;
}

function webPublicApiJsonp_(callback, payload) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function webPublicApiJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
