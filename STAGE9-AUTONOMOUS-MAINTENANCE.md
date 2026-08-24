# Stage 9 — Autonomous Maintenance & Deployment

Release date: 24 August 2026

## Goal

Make routine production maintenance hands-off while preserving the accuracy rules of the Irish Academic Opportunities Finder.

The production chain is now designed as:

**official sources → Stage 7 monitoring → Operations Review Queue → Stage 9 extraction/confidence rules → safe master update → regression/data-quality gate → automatic public refresh**

Code releases are designed as:

**GitHub `main` → Apps Script API merge/deploy → existing `/exec` deployment → live API smoke → desktop/mobile browser smoke**

## What is automatic

### Data maintenance

Stage 7 remains the evidence layer. It monitors official/current-cycle sources, establishes baselines, detects confirmed page changes, classifies inaccessible sources, and creates review work without changing public master data.

Stage 9 consumes eligible review items every day and attempts to resolve them automatically.

It can automatically write only **green fields** when all safety conditions pass:

- competition `Status` when the source explicitly says open/available or closed;
- competition `Registration Opens`;
- competition `Registration Deadline`;
- competition `Submission Deadline`;
- programme `Application Status` when explicitly open or closed;
- programme `Application Opens`;
- programme `Application Deadline`;
- programme `Programme Start Date`;
- programme `Programme End Date`;
- scholarship/funding `Current Status` when explicitly open or closed;
- scholarship/funding `Application Deadline`.

Exact dates are written only when one unambiguous labelled date is found in relevant opportunity-specific context. Ambiguous numeric dates are not inferred.

### Confidence requirements

A change must have all of the following before Stage 9 can auto-apply it:

1. an eligible Stage 7/feedback review item;
2. a successful official/current-source fetch;
3. opportunity-specific context on the source page;
4. one explicit status signal or one exact labelled date;
5. no contradictory status signal or multiple candidate dates;
6. a Stage 9 confidence score of at least 90;
7. a non-formula target master cell;
8. room inside the configured per-run write limit.

If these conditions are not met, the item is deferred rather than guessed.

## Fields intentionally kept out of autonomous writes

### Amber — monitored and queued, not currently auto-written

- cost / price;
- application method;
- location;
- duration;
- access restrictions and selectivity;
- source URL changes.

These fields often need interpretation and can be enabled in a later extractor version if structured evidence becomes strong enough.

### Red — never auto-written by Stage 9

- eligibility rules;
- school years or ages;
- scholarship award value or coverage;
- `Finder Eligible?`;
- deletion/removal of an opportunity.

These have a high consequence if interpreted incorrectly. They stay review-only.

## Automatic rollback gate

Before each Stage 9 batch, the old cell values/formulas/number formats are snapshotted.

After the candidate writes, Stage 9 checks:

- every populated `WebApp Regression Tests` row is `PASS`;
- `Data quality issues = 0`;
- `Regression failures = 0`;
- `Regression warnings = 0`;
- `Expected researched records still missing = 0`.

If any gate fails, **all Stage 9 writes in that batch are rolled back** and the change log records `ROLLED BACK`.

No automatic update is allowed to silently leave the public dataset in a failed release state.

## Audit trail

Stage 9 creates a hidden `Autonomous Change Log` containing:

- change ID;
- timestamp;
- run ID;
- opportunity type and ID;
- opportunity name;
- field changed;
- old value;
- new value;
- confidence;
- official source URL;
- source evidence;
- outcome (`APPLIED` or `ROLLED BACK`);
- regression-gate result;
- originating review IDs.

Stage 9 also writes run summaries into the existing `Operations Run Log` and updates the `Operations Dashboard` runtime status.

## Automation Policy / kill switch

Stage 9 creates a visible `Automation Policy` tab.

Default production policy:

- Enabled: **Yes**
- Auto apply green changes: **Yes**
- Auto statuses: **Yes**
- Auto dates: **Yes**
- Regression gate: **Yes**
- Resolve explicit no-change: **No**
- Max review items per run: **24**
- Max master field writes per run: **12**
- Retry deferred after: **7 days**

Changing `Enabled` to `No` is the immediate kill switch. Stage 7 monitoring can continue while Stage 9 master writes are stopped.

## Runtime schedule

- Stage 7 rotating source checks: approximately 06:15 Europe/Dublin
- Stage 7 fortnightly review: Monday approximately 07:15, subject to the existing 12-day gate
- Stage 9 autonomous review/apply: approximately 08:15 Europe/Dublin

This ordering lets Stage 7 create fresh evidence before Stage 9 processes it.

## Automatic provisioning

`apps-script/Stage9Provision.gs` is a version-aware provisioning hook. The first normal Apps Script execution after a new Stage 9 deployment automatically:

- creates/repairs the Stage 9 policy/log sheets;
- creates the Stage 9 daily trigger if it is missing;
- updates the Operations Dashboard;
- records provisioning in the Operations Run Log.

There is no recurring manual `stage9Install()` step.

## Safe GitHub → Apps Script deployment

Workflow: `.github/workflows/apps-script-deploy.yml`

A normal `clasp push` is intentionally **not** used because this GitHub repository only manages some of the files in the bound Apps Script project. Apps Script `projects.updateContent` replaces the whole project, so an incomplete push could erase working remote files.

The production workflow instead:

1. validates every GitHub-managed `.gs` file;
2. obtains a Google OAuth access token;
3. downloads the complete current bound Apps Script project;
4. refuses to continue if the remote project or `appsscript` manifest is missing;
5. overlays the GitHub `apps-script/*.gs` files onto that complete remote project;
6. preserves all other remote files;
7. updates Apps Script HEAD;
8. creates an immutable Apps Script version;
9. updates the existing public web-app deployment ID;
10. smoke-checks the live public bootstrap API.

This makes future backend code changes deploy automatically from `main` without copy/paste in the Apps Script editor.

## Automatic public browser testing

Workflow: `.github/workflows/production-smoke.yml`

The production site is tested:

- after relevant frontend pushes;
- after a successful Apps Script backend deployment;
- once each day;
- on manual workflow dispatch.

The Playwright suite checks the real GitHub Pages site on desktop and a 390×844 mobile viewport.

Coverage includes:

- homepage and live dataset counts;
- competition finder;
- search for the Irish Mathematical Olympiad regression anchor;
- opportunity detail dialog;
- official-page link;
- visible `Report / update` action;
- Save behavior;
- Upcoming calendar;
- school-launch page;
- mobile collapsed hero search;
- mobile collapsed Filters & sort;
- mobile active-filter count;
- mobile opportunity detail sheet.

Failure traces, screenshots and video are retained as GitHub Actions artifacts.

## One-time credential bootstrap before the first automatic Apps Script deployment

The automation code is complete, but Google intentionally requires user OAuth credentials for Apps Script project/deployment management. The Apps Script API does not support replacing this with a service account for this workflow.

The repository therefore needs these GitHub Actions secrets once:

- `APPS_SCRIPT_ID` — the bound Apps Script project's Script ID;
- `GOOGLE_OAUTH_CLIENT_ID`;
- `GOOGLE_OAUTH_CLIENT_SECRET`;
- `GOOGLE_OAUTH_REFRESH_TOKEN`.

The refresh token must be for a Google user who can edit/deploy the bound Apps Script project and must include at least:

- `https://www.googleapis.com/auth/script.projects`
- `https://www.googleapis.com/auth/script.deployments`

The Apps Script API must also be enabled for the Google Cloud project used by that OAuth client, and Apps Script API access must be allowed for the account.

These are **one-time deployment credentials**, not a recurring maintenance task. Do not commit them to the repository.

The current public web-app deployment ID is already encoded in the workflow because it is part of the public `/exec` URL, not a secret.

## Rollback

Pre-Stage-9 source is preserved at:

`backup-pre-stage9-autonomy-2026-08-24`

At the data level, Stage 9 also performs automatic per-batch rollback whenever the release gate fails.

## Production definition of “fully automated”

After the one-time Google/GitHub credential bootstrap succeeds:

- routine source monitoring requires no manual start;
- eligible high-confidence field changes require no manual write;
- failed/ambiguous sources are automatically deferred or classified;
- regression rollback is automatic;
- Sheet changes are automatically visible through the existing public API;
- backend code deployment from GitHub is automatic;
- live API verification is automatic;
- desktop/mobile browser smoke testing is automatic;
- every automatic change remains auditable and reversible.

Human review remains available for red/ambiguous cases, but the production system does not depend on a human to keep routine data and code deployment running.
