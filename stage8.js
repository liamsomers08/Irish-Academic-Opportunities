/* Stage 8: filter accuracy, normalized discovery and type-specific finder controls. */
(() => {
  'use strict';

  const STAGE8_VERSION = '8.0.0';
  const stage8FilterIds = [
    'competitionTypeFilter',
    'competitionFormatFilter',
    'residentialFilter',
    'financialNeedFilter'
  ];

  function s8Option(value, label) {
    return { value, label };
  }

  function s8AddOption(select, value, label, beforeValue = '') {
    if (!select || [...select.options].some(o => o.value === value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (beforeValue) {
      const before = [...select.options].find(o => o.value === beforeValue);
      if (before) {
        select.insertBefore(opt, before);
        return;
      }
    }
    select.appendChild(opt);
  }

  function s8InstallFields() {
    const grid = document.querySelector('.filters-grid');
    if (!grid || $('competitionTypeFilter')) return;

    grid.insertAdjacentHTML('beforeend', [
      '<div class="field hide" id="competitionTypeWrap"><label for="competitionTypeFilter">Competition type</label><select id="competitionTypeFilter"><option value="">Any competition type</option></select></div>',
      '<div class="field hide" id="competitionFormatWrap"><label for="competitionFormatFilter">Entry format</label><select id="competitionFormatFilter"><option value="">Any format</option><option value="individual">Individual entry available</option><option value="team">Team entry available</option><option value="both">Both individual &amp; team</option><option value="unknown">Not stated</option></select></div>',
      '<div class="field hide" id="residentialWrap"><label for="residentialFilter">Residential</label><select id="residentialFilter"><option value="">Any residential status</option><option value="yes">Residential</option><option value="no">Non-residential</option><option value="unknown">Not stated</option></select></div>',
      '<div class="field hide" id="financialNeedWrap"><label for="financialNeedFilter">Financial need</label><select id="financialNeedFilter"><option value="">Any financial-need basis</option><option value="required">Required / need-based</option><option value="considered">Considered</option><option value="not-required">Not required</option><option value="unknown">Not stated</option></select></div>'
    ].join(''));

    stage8FilterIds.forEach(id => {
      if (!filterIds.includes(id)) filterIds.push(id);
    });

    const status = $('statusFilter');
    s8AddOption(status, 'rolling', 'Rolling / ongoing', 'closed');

    const cost = $('costFilter');
    if (cost) {
      const unknown = [...cost.options].find(o => o.value === 'unknown');
      if (unknown) unknown.textContent = 'Not stated / varies';
    }

    const deadline = $('deadline');
    if (deadline) {
      const first = [...deadline.options].find(o => o.value === '');
      if (first) first.textContent = 'Any deadline';
      const known = [...deadline.options].find(o => o.value === 'known');
      if (known) known.textContent = 'Published exact deadline';
      s8AddOption(deadline, 'unknown', 'No exact deadline published');
    }

    const sort = $('sort');
    s8AddOption(sort, 'deadline', 'Deadline soonest', 'name');
    s8AddOption(sort, 'open', 'Open / available first', 'name');

    const deadlineLabel = document.querySelector('label[for="deadline"]');
    if (deadlineLabel) deadlineLabel.textContent = 'Application / entry deadline';

    const statusLabel = document.querySelector('label[for="statusFilter"]');
    if (statusLabel) statusLabel.textContent = 'Current / application status';

    const entryLabel = document.querySelector('label[for="entryRoute"]');
    if (entryLabel) entryLabel.textContent = 'Who applies / entry route';
  }

  function s8FillSelect(id, options, emptyLabel) {
    const el = $(id);
    if (!el) return;
    const old = el.value;
    const normalized = options.map(o => typeof o === 'string' ? s8Option(o, o) : o);
    el.innerHTML = '<option value="">' + esc(emptyLabel) + '</option>' +
      normalized.map(o => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');
    if (normalized.some(o => o.value === old)) el.value = old;
  }

  function s8KindSelection(base) {
    if (['competitions', 'programmes', 'scholarships'].includes(tab)) return tab;
    const selected = $('typeFilter')?.value || '';
    if (selected) return selected;
    const kinds = [...new Set((base || []).map(x => x.kind).filter(Boolean))];
    return kinds.length === 1 ? kinds[0] : '';
  }

  function s8TypeSubset(base, kind) {
    return kind ? (base || []).filter(x => x.kind === kind) : (base || []);
  }

  function s8ModeClass(x) {
    const s = norm([x.mode, x.location, x.scope].filter(Boolean).join(' '));
    if (!s) return 'unknown';
    if (/hybrid|blended|mixed|online\s*(and|\/|&)\s*(in.?person|on.?site)|in.?person\s*(and|\/|&)\s*online/.test(s)) return 'hybrid';
    if (/online|virtual|remote|self.?paced|mooc|distance learning/.test(s)) return 'online';
    if (/in.?person|on.?site|onsite|campus|face.?to.?face|residential/.test(s)) return 'in-person';
    return 'other';
  }

  function s8EntryClass(x) {
    const s = norm([
      x.entry, x.applicationMethod, x.accessType, x.accessRestrictions,
      x.studentDirect, x.schoolRegister, x.teacherRequired, x.status
    ].filter(Boolean).join(' '));
    if (!s) return 'unknown';
    if (/automatic|no separate application|no application required|automatically considered/.test(s)) return 'automatic';
    if (/nomination|nominated|invite only|invitation|selected by school|school selection/.test(s)) return 'nomination';
    if (/restricted|partner school|internal only|provider selection|selected schools|specific schools/.test(s)) return 'restricted';
    if (yes(x.studentDirect) || /direct student|student can apply|student application|individual application|self.?register|apply directly/.test(s)) return 'direct';
    if (yes(x.schoolRegister) || yes(x.teacherRequired) || /school must|school registration|teacher|coordinator|guidance counsellor|guidance counselor|through school|school application/.test(s)) return 'school';
    return 'other';
  }

  function s8FormatClass(x) {
    const raw = pick(x.raw, indexed(x.raw),
      'Individual / Team / Both', 'Individual / Team', 'Entry Format', 'Format', 'Participation Format');
    const s = norm(raw);
    if (!s) return 'unknown';
    const hasIndividual = /individual|solo/.test(s);
    const hasTeam = /team|group|pair/.test(s);
    if (hasIndividual && hasTeam) return 'both';
    if (hasIndividual) return 'individual';
    if (hasTeam) return 'team';
    return 'unknown';
  }

  function s8ResidentialClass(x) {
    const s = norm([x.residential, x.location, x.description].filter(Boolean).join(' '));
    if (!s) return 'unknown';
    if (/^(yes|true|y|1)$/.test(norm(x.residential)) || /\bresidential\b|overnight|accommodation included/.test(s)) return 'yes';
    if (/^(no|false|n|0)$/.test(norm(x.residential)) || /non.?residential|day programme|day program/.test(s)) return 'no';
    return 'unknown';
  }

  function s8FinancialNeedClass(x) {
    const s = norm(x.financialNeed);
    if (!s) return 'unknown';
    if (/considered|preference|taken into account|may be considered/.test(s)) return 'considered';
    if (/not required|no\b|none|not need.?based/.test(s)) return 'not-required';
    if (/required|yes\b|need.?based|means.?tested|financial need/.test(s)) return 'required';
    return 'unknown';
  }

  function s8StatusClass(x) {
    const s = norm([x.status, x.programmeStatus, x.applicationStatus].join(' '));
    if (/automatic|no separate application|no student application|automatically considered/.test(s)) return 'automatic';
    if (/rolling|ongoing|year.?round|always open/.test(s)) return 'rolling';
    if (/closed|ended|inactive|passed|finished|applications? shut/.test(s)) return 'closed';
    if (/open|available|active|accepting|applications? live|registration live/.test(s)) return 'open';
    if (/upcoming|expected|tba|next cycle|planned|future|not yet open|opening soon/.test(s)) return 'upcoming';
    return '';
  }

  function s8CostClass(x) {
    if (x.kind === 'scholarships') return 'funding';
    const s = norm([x.cost, x.costCategory, x.costNotes].filter(Boolean).join(' '));
    if (!s) return 'unknown';
    if (/\bfree\b|no cost|free of charge|€\s*0\b|eur\s*0\b|0\s*euro/.test(s)) return 'free';
    if (/not stated|unknown|\btba\b|to be confirmed|varies|variable|depends|see (the )?official|check (the )?provider/.test(s)) return 'unknown';
    if (/\bpaid\b|\bfee\b|cost category paid|[€£$]\s*\d|\b\d+(?:[.,]\d+)?\s*(?:eur|euro|gbp|pounds?|usd|dollars?|cad)\b/.test(s)) return 'paid';
    return 'unknown';
  }

  function s8DeadlineCandidates(x) {
    const out = [];
    const add = (label, value) => {
      const date = parseDateValue(value);
      if (date) out.push({ label, value, date });
    };
    add(x.kind === 'competitions' ? 'Registration deadline' : 'Application deadline', x.applicationDeadline);
    if (x.kind === 'competitions') add('Submission deadline', x.submissionDeadline);
    return out.sort((a, b) => a.date - b.date);
  }

  function s8NextDeadline(x) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return s8DeadlineCandidates(x).find(d => d.date >= now) || null;
  }

  function s8DeadlineMatch(x, value) {
    if (!value) return true;
    const all = s8DeadlineCandidates(x);
    if (value === 'known') return all.length > 0;
    if (value === 'unknown') return all.length === 0;
    const next = s8NextDeadline(x);
    if (!next) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = (next.date - now) / 86400000;
    return days >= 0 && days <= Number(value);
  }

  function s8GeographyHaystack(x) {
    return [
      x.geography, x.studyCountry, x.studyInstitution, x.county,
      x.scope, x.location, x.competitionLevel, x.mode
    ].filter(Boolean).join(' ');
  }

  function s8EntryOptions(base) {
    const observed = new Set((base || []).map(s8EntryClass));
    const candidates = [
      s8Option('direct', 'Student applies directly'),
      s8Option('school', 'School / teacher applies or registers'),
      s8Option('nomination', 'Nomination / invitation'),
      s8Option('automatic', 'Automatic / no separate application'),
      s8Option('restricted', 'Restricted / selected institutions'),
      s8Option('other', 'Other route'),
      s8Option('unknown', 'Not stated')
    ];
    return candidates.filter(o => observed.has(o.value));
  }

  function s8ModeOptions(base) {
    const observed = new Set((base || []).map(s8ModeClass));
    const candidates = [
      s8Option('in-person', 'In person'),
      s8Option('online', 'Online / virtual'),
      s8Option('hybrid', 'Hybrid / blended'),
      s8Option('other', 'Other / check details'),
      s8Option('unknown', 'Not stated')
    ];
    return candidates.filter(o => observed.has(o.value));
  }

  function s8PopulateFilters(base) {
    const kind = s8KindSelection(base);
    const effective = s8TypeSubset(base, kind);
    const scoped = kind ? effective : base;

    fillSelect('subject', unique(scoped, 'subject'), 'All subjects');
    fillSelect('geography', geographyOptions(scoped), 'Anywhere');

    const programmes = (base || []).filter(x => x.kind === 'programmes');
    const competitions = (base || []).filter(x => x.kind === 'competitions');
    const funding = (base || []).filter(x => x.kind === 'scholarships');

    s8FillSelect('mode', s8ModeOptions(programmes), 'Any mode');
    fillSelect('opportunityType', unique(programmes, 'opportunityType'), 'Any programme type');
    fillSelect('fundingType', unique(funding, 'fundingType'), 'Any funding type');
    fillSelect('awardBasis', unique(funding, 'awardBasis'), 'Any award basis');
    fillSelect('competitionTypeFilter', unique(competitions, 'competitionType'), 'Any competition type');

    s8FillSelect('entryRoute', s8EntryOptions(scoped), 'Any entry route');
  }

  function s8ToggleWrap(wrapId, show, controlId) {
    const wrap = $(wrapId);
    if (!wrap) return;
    wrap.classList.toggle('hide', !show);
    if (!show && controlId && $(controlId)) $(controlId).value = '';
  }

  function s8ApplyFilterVisibility(base) {
    const kind = s8KindSelection(base);
    const selectedOne = !!kind;
    const specificTab = ['competitions', 'programmes', 'scholarships'].includes(tab);

    if (specificTab && $('typeFilter')?.value) $('typeFilter').value = '';
    $('typeFilter')?.classList.toggle('hide', specificTab);

    s8ToggleWrap('modeWrap', kind === 'programmes', 'mode');
    s8ToggleWrap('opportunityWrap', kind === 'programmes', 'opportunityType');
    s8ToggleWrap('residentialWrap', kind === 'programmes', 'residentialFilter');

    s8ToggleWrap('fundingWrap', kind === 'scholarships', 'fundingType');
    s8ToggleWrap('awardWrap', kind === 'scholarships', 'awardBasis');
    s8ToggleWrap('financialNeedWrap', kind === 'scholarships', 'financialNeedFilter');

    s8ToggleWrap('competitionTypeWrap', kind === 'competitions', 'competitionTypeFilter');
    s8ToggleWrap('competitionFormatWrap', kind === 'competitions', 'competitionFormatFilter');

    const geoLabel = document.querySelector('label[for="geography"]');
    if (geoLabel) {
      geoLabel.textContent = kind === 'competitions' ? 'Competition reach'
        : kind === 'programmes' ? 'Location / scope'
        : kind === 'scholarships' ? 'Study country'
        : 'Geography / country';
    }

    const summary = $('filterSummary');
    if (summary) {
      if (!selectedOne) summary.textContent = 'Choose an opportunity group for type-specific filters';
      else if (kind === 'competitions') summary.textContent = 'Competition-specific filters active';
      else if (kind === 'programmes') summary.textContent = 'Programme-specific filters active';
      else summary.textContent = 'Funding-specific filters active';
    }
  }

  function s8ControlActive(id) {
    const el = $(id);
    if (!el || !el.value) return false;
    const field = el.closest('.field');
    return !field || !field.classList.contains('hide');
  }

  function s8FilterRecords(base) {
    let arr = [...base];
    const q = $('q').value.trim();

    if (tab === 'all' || tab === 'saved' || tab === 'upcoming') {
      const tf = $('typeFilter').value;
      if (tf) arr = arr.filter(x => x.kind === tf);
    }

    if (q) arr = arr.filter(x => matchesQuery(x, q));

    const sub = $('subject').value;
    if (sub) arr = arr.filter(x => includesLoose(x.subject, sub));

    const sy = $('schoolYear').value;
    if (sy) arr = arr.filter(x => schoolMatch(x, sy));

    const geo = $('geography').value;
    if (geo) arr = arr.filter(x => includesLoose(s8GeographyHaystack(x), geo));

    const cost = $('costFilter').value;
    if (cost) arr = arr.filter(x => s8CostClass(x) === cost);

    const status = $('statusFilter').value;
    if (status) arr = arr.filter(x => s8StatusClass(x) === status);

    if (s8ControlActive('mode')) {
      const mode = $('mode').value;
      arr = arr.filter(x => x.kind === 'programmes' && s8ModeClass(x) === mode);
    }

    if (s8ControlActive('opportunityType')) {
      const value = $('opportunityType').value;
      arr = arr.filter(x => x.kind === 'programmes' && includesLoose(x.opportunityType, value));
    }

    if (s8ControlActive('fundingType')) {
      const value = $('fundingType').value;
      arr = arr.filter(x => x.kind === 'scholarships' && includesLoose(x.fundingType, value));
    }

    if (s8ControlActive('awardBasis')) {
      const value = $('awardBasis').value;
      arr = arr.filter(x => x.kind === 'scholarships' && includesLoose(x.awardBasis, value));
    }

    if (s8ControlActive('entryRoute')) {
      const route = $('entryRoute').value;
      arr = arr.filter(x => s8EntryClass(x) === route);
    }

    const dh = $('deadline').value;
    if (dh) arr = arr.filter(x => s8DeadlineMatch(x, dh));

    if (s8ControlActive('competitionTypeFilter')) {
      const value = $('competitionTypeFilter').value;
      arr = arr.filter(x => x.kind === 'competitions' && includesLoose(x.competitionType, value));
    }

    if (s8ControlActive('competitionFormatFilter')) {
      const value = $('competitionFormatFilter').value;
      arr = arr.filter(x => {
        if (x.kind !== 'competitions') return false;
        const format = s8FormatClass(x);
        if (value === 'individual') return format === 'individual' || format === 'both';
        if (value === 'team') return format === 'team' || format === 'both';
        return format === value;
      });
    }

    if (s8ControlActive('residentialFilter')) {
      const value = $('residentialFilter').value;
      arr = arr.filter(x => x.kind === 'programmes' && s8ResidentialClass(x) === value);
    }

    if (s8ControlActive('financialNeedFilter')) {
      const value = $('financialNeedFilter').value;
      arr = arr.filter(x => x.kind === 'scholarships' && s8FinancialNeedClass(x) === value);
    }

    const sort = $('sort').value;
    if (sort === 'name') {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'verified') {
      arr.sort((a, b) => (parseDateValue(b.lastVerified)?.getTime() || 0) - (parseDateValue(a.lastVerified)?.getTime() || 0));
    } else if (sort === 'deadline') {
      arr.sort((a, b) => (s8NextDeadline(a)?.date?.getTime() || Infinity) - (s8NextDeadline(b)?.date?.getTime() || Infinity));
    } else if (sort === 'open') {
      const rank = { open: 0, rolling: 1, automatic: 2, upcoming: 3, '': 4, closed: 5 };
      arr.sort((a, b) =>
        (rank[s8StatusClass(a)] ?? 4) - (rank[s8StatusClass(b)] ?? 4) ||
        (s8NextDeadline(a)?.date?.getTime() || Infinity) - (s8NextDeadline(b)?.date?.getTime() || Infinity) ||
        a.name.localeCompare(b.name)
      );
    } else if (sort === 'date' || (!q && sort === 'relevance')) {
      arr.sort((a, b) => (nextDate(a)?.date?.getTime() || Infinity) - (nextDate(b)?.date?.getTime() || Infinity));
    } else if (sort === 'relevance' && q) {
      arr.sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q) || a.name.localeCompare(b.name));
    }

    return arr;
  }

  function s8FilterLabel(id) {
    const labels = {
      q: 'Search',
      typeFilter: 'Group',
      schoolYear: 'School year',
      subject: 'Subject',
      geography: 'Geography',
      costFilter: 'Cost',
      statusFilter: 'Status',
      mode: 'Mode',
      opportunityType: 'Programme type',
      fundingType: 'Funding type',
      awardBasis: 'Award basis',
      entryRoute: 'Entry route',
      deadline: 'Deadline',
      competitionTypeFilter: 'Competition type',
      competitionFormatFilter: 'Format',
      residentialFilter: 'Residential',
      financialNeedFilter: 'Financial need'
    };
    return labels[id] || id;
  }

  function s8ActiveFilterPairs() {
    const pairs = [];
    if ($('q').value) pairs.push({ id: 'q', label: 'Search', value: $('q').value });

    for (const id of filterIds) {
      const el = $(id);
      if (!el?.value || el.classList.contains('hide')) continue;
      const field = el.closest('.field');
      if (field?.classList.contains('hide')) continue;
      pairs.push({
        id,
        label: s8FilterLabel(id),
        value: el.options?.[el.selectedIndex]?.text || el.value
      });
    }
    return pairs;
  }

  function s8RenderActiveFilters() {
    const host = $('activeFilters');
    if (!host) return;
    const pairs = s8ActiveFilterPairs();
    host.innerHTML = pairs.map(p =>
      '<button type="button" class="filter-chip removable" data-filter-remove="' + esc(p.id) +
      '" aria-label="Remove ' + esc(p.label) + ' filter">' +
      '<span>' + esc(p.label) + ': ' + esc(p.value) + '</span><b aria-hidden="true">×</b></button>'
    ).join('');
    host.classList.toggle('is-empty', pairs.length === 0);
    const summary = $('filterSummary');
    if (summary && pairs.length) summary.dataset.activeCount = String(pairs.length);
    else if (summary) delete summary.dataset.activeCount;
  }

  s8InstallFields();

  /* Override shared helpers so badges, presets and existing UI use the same normalized semantics. */
  statusClass = s8StatusClass;
  costClass = s8CostClass;
  deadlineMatch = s8DeadlineMatch;
  populateFilters = s8PopulateFilters;
  applyFilterVisibility = s8ApplyFilterVisibility;
  filterRecords = s8FilterRecords;
  activeFilterPairs = function() {
    return s8ActiveFilterPairs().map(p => [p.label, p.value]);
  };
  renderActiveFilters = s8RenderActiveFilters;

  stage8FilterIds.forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => {
      visibleLimit = PAGE_SIZE;
      renderFinder();
    });
  });

  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-filter-remove]');
    if (!remove) return;
    const id = remove.dataset.filterRemove;
    if (id === 'q') $('q').value = '';
    else if ($(id)) $(id).value = '';
    visibleLimit = PAGE_SIZE;
    renderFinder();
  });

  window.IAO_STAGE8 = Object.freeze({
    version: STAGE8_VERSION,
    modeClass: s8ModeClass,
    entryClass: s8EntryClass,
    formatClass: s8FormatClass,
    residentialClass: s8ResidentialClass,
    financialNeedClass: s8FinancialNeedClass,
    deadlineCandidates: s8DeadlineCandidates,
    nextDeadline: s8NextDeadline
  });

  /* If live data completed unusually quickly before this script ran, refresh once
     so the normalized controls and Stage 8 URL parameters are still applied. */
  requestAnimationFrame(() => {
    if (tab === 'home') return;
    const params = new URLSearchParams(location.search);
    stage8FilterIds.forEach(id => {
      const value = params.get(id);
      const el = $(id);
      if (value && el && [...el.options].some(o => o.value === value)) el.value = value;
    });
    renderFinder();
  });
})();
