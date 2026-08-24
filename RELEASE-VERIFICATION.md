# Stage 5 — Production Verification & Release

Verified: **24 August 2026**

This file records the production-verification pass performed after Stages 1–4.

## Release gate

The live Google Sheet contains a dedicated WebApp V3.1 QA layer. The latest available regression output was inspected directly from the live master.

### Public dataset counts

- Competitions: **353**
- Programmes: **345**
- Scholarships & funding: **334**
- Total public opportunities: **1,032**

The previous website fallback still said 268 competitions / 947 total. Stage 5 corrected the website fallback configuration and the Sheet's `Start Here` summary to the verified counts above.

### Backend regression suite

All recorded WebApp regression tests were **PASS**:

- Competitions load — 353 records
- Programmes load — 345 records
- Scholarships load — 334 records
- C001 remains searchable
- P001 remains searchable
- S001 remains searchable
- PressPass remains intentionally excluded
- Fyziklani remains intentionally excluded
- Competitions public payload has no private admin-field leakage
- Programmes public payload has no private admin-field leakage
- Scholarships public payload has no private admin-field leakage
- Upcoming events are chronological — 448 future date events in the regression dataset
- Researched patch records are present
- Competition public IDs are unique
- Programme public IDs are unique
- Scholarship public IDs are unique

Recorded regression failures: **0**

Recorded regression warnings: **0**

WebApp data-quality issues: **0**

Expected researched records still missing: **0**

## Rich-field verification anchors

Representative live master records were inspected to confirm that the data needed by the Stage 1–3 frontend exists in the source of truth.

### C001 — Irish Mathematical Olympiad

Verified source fields include school-year eligibility, entry route, official/current-cycle links, round dates, cost/category, cost evidence and notes, eligibility evidence and notes.

### P001 — STEM@Universi-TY Friday On-Campus

Verified source fields include TY eligibility, access type, location, delivery mode, duration, selectivity, cost/evidence, current dates, application method, description, eligibility evidence, monitoring source, last-verified date and verification confidence.

### S001 — Naughton Scholarships

Verified source fields include applicant stage, funding type, award basis, course area, eligibility restrictions, application route, award value, coverage, cycle/deadline, current status, official source and last-verified date.

A new read-only browser release guard (`stage5.js`) now checks the mapped public payload after startup. It verifies minimum dataset counts, unique IDs, C001/P001/S001 anchors, rich-detail fields, chronological calendar output, direct-link wiring and feedback-handler presence. It also probes the Related API; related-API failure remains non-blocking because Stage 3 already has a local similarity fallback.

The guard publishes its result as `window.IAO_RELEASE_HEALTH` for browser diagnostics and only displays a public warning for critical live-data regressions.

## Legacy Data Quality tab

The older general `Data Quality` tab still showed 41 entries during this pass. It is **not** being used as the WebApp release gate because many entries are stale or overly broad.

Examples inspected:

- C255 was previously flagged as having no official source, but the current master now contains the HTAI official site and correctly marks the competition `Needs Review`.
- C259 was flagged similarly, but the current master now has a UCC source and is correctly marked `Not Available` because the current competition located is university-level rather than a verified secondary-school competition.
- Identical scholarship names such as `Sports Scholarship` refer to distinct providers/institutions (for example NCI, University of Stirling and Loughborough University) and must not be auto-merged merely because their names match.

The dedicated `WebApp Duplicate Review` sheet correctly labels duplicate candidates **review only — never auto-merge/delete**.

## Operational monitoring backlog

The WebApp release itself is green, but the admin dashboard also exposes maintenance work that belongs in the continuous-operation stage:

- Competition monitor rows: 345
- Competition pending baselines: 77
- Competition monitor error rows: 16
- Programme pending baselines: 300

These are freshness/monitoring operations issues rather than current public-payload regression failures. They should be addressed in the continuous-maintenance stage.

## Feedback verification

Static wiring is present end-to-end in source:

- Stage 3 anonymous feedback form
- POST to the configured Apps Script endpoint
- `PublicApi.gs` routes `action: feedback` to `webSubmitFeedback(payload)`

The admin dashboard currently reports 0 total feedback items. No synthetic public feedback item was inserted during this pass because the available verification environment could not execute the cross-origin Apps Script POST and then inspect the Apps Script feedback store. The frontend therefore retains its anonymous report flow, but a first real browser submission should be checked in the admin dashboard when release testing is performed from a normal browser.

## Host verification limitation

The verification environment could inspect GitHub production source and the connected live Google Sheet, but its external DNS/safe-URL layer could not independently load the GitHub Pages host or the exact Apps Script deployment URL. This is an environment limitation, not evidence of a site failure.

To reduce reliance on one-off manual testing, Stage 5 added the runtime release guard described above.

## Stage 5 production fixes

- Updated verified website fallback counts to 353 / 345 / 334.
- Updated fallback verification label to 24 August 2026.
- Updated the live Sheet `Start Here` count summary.
- Added protection against corrupted `iao_saved` localStorage values stopping application startup.
- Added runtime production release verification (`stage5.js`).
- Added a live Related API probe with non-blocking fallback status.
- Added Stage 5 asset to the service-worker cache and bumped the cache generation.

## Release status

**Backend WebApp regression gate: PASS**

**Public WebApp data-quality gate: PASS**

**Repository/source integration: PASS**

**External browser smoke test from this verification environment: NOT EXECUTABLE**
