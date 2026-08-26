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
        data = webPublicApiFilteredBootstrap_(webAppGetBootstrap());
        break;

      case 'dataset': {
        const kind = String(p.kind || '').toLowerCase();
        if (WEB_PUBLIC_API_ALLOWED_KINDS.indexOf(kind) === -1) {
          throw new Error('Unsupported dataset.');
        }
        data = webPublicApiFilterPayload_(webAppGetDataset(kind), kind);
        break;
      }

      case 'upcoming':
        data = webPublicApiFilterUpcoming_(webAppGetUpcoming());
        break;

      case 'related': {
        const kind = String(p.kind || '').toLowerCase();
        const id = String(p.id || '').trim();
        const limit = Math.max(1, Math.min(10, Number(p.limit || 5)));
        if (WEB_PUBLIC_API_ALLOWED_KINDS.indexOf(kind) === -1 || !id) {
          throw new Error('Invalid related-opportunity request.');
        }
        data = webPublicApiFilterPayload_(webAppGetRelated(kind, id, limit), kind);
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

/**
 * Public publication gate.
 *
 * Competitions are public only when the master explicitly marks them Available.
 * Programmes and scholarships are public only when Finder Eligible is not No;
 * the current V3 public-safe payload normally contains only eligible rows already,
 * but this second gate prevents an internal review/exclusion row leaking publicly.
 */
function webPublicApiRecordAllowed_(record, kind) {
  if (!record || typeof record !== 'object') return false;
  const idx = {};
  Object.keys(record).forEach(function(key) {
    idx[webPublicApiCanon_(key)] = record[key];
  });
  const get = function() {
    for (let i = 0; i < arguments.length; i++) {
      const value = idx[webPublicApiCanon_(arguments[i])];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };

  if (kind === 'competitions') {
    return webPublicApiCanon_(get('Status', 'status', 'Current Status')) === 'available';
  }

  const finderEligible = webPublicApiCanon_(get('Finder Eligible?', 'finderEligible'));
  if (finderEligible && !/^(yes|true|y|1)$/.test(finderEligible)) return false;

  if (kind === 'programmes') {
    const programmeStatus = webPublicApiCanon_(get('Programme Status', 'programmeStatus'));
    const researchStatus = webPublicApiCanon_(get('Research Status', 'researchStatus'));
    if (/underreview|needsreview|unverified|notavailable/.test(programmeStatus + researchStatus)) return false;
  }

  return true;
}

function webPublicApiFilterPayload_(payload, kind) {
  if (Array.isArray(payload)) {
    return payload.filter(function(record) {
      return webPublicApiRecordAllowed_(record, kind);
    });
  }
  if (!payload || typeof payload !== 'object') return payload;
  const clone = Object.assign({}, payload);
  if (Array.isArray(clone.records)) {
    clone.records = clone.records.filter(function(record) {
      return webPublicApiRecordAllowed_(record, kind);
    });
  }
  if (Array.isArray(clone.items)) {
    clone.items = clone.items.filter(function(record) {
      return webPublicApiRecordAllowed_(record, kind);
    });
  }
  return clone;
}

function webPublicApiFilteredBootstrap_(bootstrap) {
  if (!bootstrap || typeof bootstrap !== 'object') return bootstrap;
  const clone = Object.assign({}, bootstrap);
  const counts = {};
  WEB_PUBLIC_API_ALLOWED_KINDS.forEach(function(kind) {
    const filtered = webPublicApiFilterPayload_(webAppGetDataset(kind), kind);
    const list = Array.isArray(filtered) ? filtered :
      (filtered && Array.isArray(filtered.records) ? filtered.records :
      (filtered && Array.isArray(filtered.items) ? filtered.items : []));
    counts[kind] = list.length;
  });
  clone.counts = Object.assign({}, clone.counts || {}, counts);
  return clone;
}

function webPublicApiFilterUpcoming_(payload) {
  const allowedIds = {};
  WEB_PUBLIC_API_ALLOWED_KINDS.forEach(function(kind) {
    const filtered = webPublicApiFilterPayload_(webAppGetDataset(kind), kind);
    const list = Array.isArray(filtered) ? filtered :
      (filtered && Array.isArray(filtered.records) ? filtered.records :
      (filtered && Array.isArray(filtered.items) ? filtered.items : []));
    list.forEach(function(record) {
      const id = webPublicApiRecordId_(record);
      if (id) allowedIds[id] = true;
    });
  });

  const filterList = function(list) {
    return list.filter(function(record) {
      const id = webPublicApiRecordId_(record);
      return !id || allowedIds[id] === true;
    });
  };

  if (Array.isArray(payload)) return filterList(payload);
  if (!payload || typeof payload !== 'object') return payload;
  const clone = Object.assign({}, payload);
  if (Array.isArray(clone.records)) clone.records = filterList(clone.records);
  if (Array.isArray(clone.items)) clone.items = filterList(clone.items);
  return clone;
}

function webPublicApiRecordId_(record) {
  if (!record || typeof record !== 'object') return '';
  const idx = {};
  Object.keys(record).forEach(function(key) {
    idx[webPublicApiCanon_(key)] = record[key];
  });
  return String(
    idx.id || idx.competitionid || idx.programmeid || idx.scholarshipid || ''
  ).trim();
}

function webPublicApiCanon_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
