# Stage 7 — Continuous Operations & Automation

Release date: 24 August 2026

Stage 7 adds the maintenance layer that keeps the Irish Academic Opportunities Finder current after launch. It is intentionally review-first: monitoring creates evidence and queues work, but it never writes an unverified web-page change directly into the public opportunity masters.

## Current release baseline

- 353 public competitions
- 345 public programmes
- 334 public scholarship/funding records
- 1,032 public opportunities total
- WebApp data-quality issues: 0
- WebApp regression failures: 0

## Live workbook additions

The maintained Google Sheet now includes:

- `Operations Dashboard` — visible owner-facing health summary
- `_ScholarshipMonitor` — funding source-monitor state
- `Scholarship Update Queue` — funding source changes requiring review
- `Scholarship Update Log` — audit trail for reviewed funding changes
- `Operations Review Queue` — combined competition/programme/funding/feedback review queue
- `Operations Run Log` — scheduled-run metrics and outcomes

The existing competition and programme monitor/queue/log architecture is retained. During Stage 7 the competition monitor was reconciled with the expanded master and C347–C354 were added as pending baselines. `OperationsV7.gs` also rechecks competition monitor coverage on install and before daily/baseline runs so future additions are automatically brought into the monitor when they have a usable official/current source.

### Current operations backlog at Stage 7 creation

- Competition pending baselines: 85
- Competition fetch-error rows: 16
- Competition open monitor items: 15
- Programme pending baselines: 275
- Programme fetch-error rows: 0
- Programme open monitor items: 0
- Funding master pending baselines: 336
- Funding fetch-error rows: 0
- Funding open monitor items: 0

The 15 currently open competition monitor items were copied into the combined `Operations Review Queue`; this does not change any master opportunity record.

## Runtime file

`apps-script/OperationsV7.gs` is the private Stage 7 Apps Script runtime.

It must be added to the **existing bound Apps Script project** that already contains the V3 web-app code. It is not a replacement for `PublicApi.gs`, and none of its admin functions should be exposed through the public API.

### One-time installation

1. Open the existing Apps Script project attached to the live Student Finder spreadsheet.
2. Add a new script file named `OperationsV7`.
3. Paste the contents of `apps-script/OperationsV7.gs` into it and save.
4. Select `stage7Install` in the Apps Script function selector and run it once.
5. Approve the required spreadsheet, external-request and trigger permissions.
6. Optionally run `stage7RunNow()` once for an immediate normal pass.
7. To accelerate initial baseline completion, run `stage7BootstrapBaselines()` manually when desired; each call is bounded rather than attempting every URL in one execution.

Do **not** create a second `doGet()` or `doPost()` for Stage 7.

## Scheduled cadence

`stage7Install()` creates only Stage 7-owned triggers and does not delete unrelated project triggers.

- Daily rotating monitor: approximately 06:15 Europe/Dublin
- Monday review trigger: approximately 07:15 Europe/Dublin
- The Monday function is scheduled weekly but self-gates to at least 12 days between full review sweeps, preserving the existing roughly fortnightly review cadence.

## Daily source-monitor behaviour

Each daily run checks up to 30 sources per opportunity type — competitions, programmes and funding — for a maximum normal batch of 90 URLs.

Selection deliberately mixes:

1. missing baselines,
2. rows with prior technical errors, and
3. the oldest successfully monitored rows.

This means the initial backlog is reduced without starving existing monitored sources of rechecks.

### Baselines

When a source has no fingerprint and a successful readable response is obtained, Stage 7 records the fingerprint as its initial baseline. Creating a baseline does **not** create a change alert.

### Confirmed source changes

A different fingerprint is not immediately treated as a substantive change. Stage 7 stores it as a candidate in Script Properties and requires the **same changed fingerprint on two consecutive successful checks** before it creates a review item.

Even after confirmation, the system only queues the finding. It never changes a deadline, status, eligibility rule, price or award value in the master automatically.

## Manual-monitor classification

HTTP responses commonly caused by bot/access controls are handled separately from genuine source failures.

The current manual-monitor class includes HTTP 401, 403, 405, 406, 418, 429 and 451, plus pages returning too little readable content for a meaningful fingerprint.

These produce an `Operations Review Queue` item such as `Manual source monitoring required`. They are **not** treated as evidence that the opportunity is closed or its link is invalid.

This is especially important for sources already known to resist automated fetches, including some RSB, Goethe-Institut, gov.ie, SETU and similar pages.

## Technical errors

Other failures increment `Consecutive Errors`. After three consecutive failures, Stage 7 creates a `Repeated fetch error` review item while still leaving the master data unchanged.

## Fortnightly health review

The review sweep inspects the maintained masters using their actual headers and queues, rather than fixes, issues such as:

- missing official/current sources,
- explicit `Needs Review` statuses,
- verification evidence older than 90 days,
- an apparently open/available status whose stored application/entry deadline has passed.

The last check is intentionally a review signal only; recurring opportunities can legitimately remain available after a particular stored cycle deadline.

## Feedback

If the V3 `webSubmitFeedback()` flow has created a `Feedback Queue`, Stage 7 reads its headers dynamically and copies open feedback into the combined `Operations Review Queue`. Stage 7 does not create or redefine the V3 feedback schema itself.

## Review workflow

`Operations Review Queue` supports these statuses:

- New
- Reviewed - no data change
- Data updated
- Ignore / false positive
- Source inaccessible
- Deferred
- Resolved

A monitor result may update its own queue/log state, but changes to `Competitions`, `Programmes` or `Scholarships` should continue to be made only after verifying the official provider/current-cycle source.

## Non-negotiable data rules

- Prefer official organiser/provider/current-cycle sources.
- Never replace TBA or an unpublished date with a guessed exact date.
- Never infer a fee, award value, eligibility rule or cycle status from a page fingerprint alone.
- Never auto-delete an opportunity because a monitor cannot fetch its source.
- Keep monitor, research and operations fields private from the public API.
- Preserve an audit trail for every verified master-field change.

## Rollback

The pre-Stage-7 production point is preserved at:

`backup-pre-stage7-2026-08-24`

Stage 7 workbook additions are operational/admin layers only; the public Stage 1–6 finder behaviour is not redesigned by this release.

## Deployment boundary

The Google Sheet structure and GitHub Stage 7 runtime are prepared in this release. The connected tools used to build this stage do not expose the bound Apps Script project itself, and a plugin search found no available Apps Script integration. Therefore the one-time `OperationsV7.gs` install and `stage7Install()` execution must be performed in the existing Apps Script editor before the scheduled source checks are considered active.
