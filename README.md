# Irish Academic Opportunities Finder

A public discovery tool for secondary-school students in Ireland covering academic competitions, TY and enrichment programmes, summer opportunities, scholarships and funding.

## Live site

https://liamsomers08.github.io/Irish-Academic-Opportunities/

Current verified public release baseline (24 August 2026):

- 353 competitions
- 345 programmes
- 334 scholarships/funding records
- 1,032 public opportunities total

The private Google Sheet remains the maintained source of truth. A public-safe Apps Script API exposes the data used by this frontend.

## School launch resources

- `schools.html` — teacher, TY coordinator and guidance launch page
- `student-guide.html` — concise student quick-start
- `launch-pack.html` — print-ready A4 QR poster + staff launch sheet
- `about.html` — methodology, trust, date confidence and privacy-related behaviour
- `qr-code.svg` — reusable QR code pointing to the public finder

## Finder capabilities

The site includes full-text search, type-specific filters, school-year filtering, cost/geography/delivery/application filters, a unified upcoming calendar, saved opportunities, shareable views, direct opportunity URLs, printable shortlists, rich detail/provenance, related opportunities, anonymous correction reporting, mobile navigation, accessibility improvements and PWA/offline support.

### Stage 8 — filter accuracy and discovery

Stage 8 strengthens the finder without changing the public API or source workbook schema:

- deadline horizons now use application/registration/submission deadlines rather than whichever dated event happens next
- delivery mode is normalised into in-person, online/virtual, hybrid, other and not stated
- entry/application routes are grouped into student-direct, school/teacher, nomination/invitation, automatic, restricted and other/not-stated routes
- cost filtering treats TBA/varies/not-stated values conservatively instead of assuming they are paid
- rolling/ongoing opportunities have their own status class
- competition views add competition type and individual/team format filters
- programme views add a residential filter
- funding views add a financial-need filter
- combined views expose type-specific controls once an opportunity group is selected
- active filter chips can be removed individually
- new `Deadline soonest` and `Open / available first` sorts support faster decision-making

The Stage 8 frontend runtime is `stage8.js`, with matching styles in `stage8.css`. See `STAGE8-FINDER-ACCURACY.md` for the implementation and verification notes.

## Continuous operations

Stage 7 adds an owner-facing operations layer to the private source workbook:

- combined Operations Dashboard and review queue
- competition/programme/funding source monitoring
- funding monitor/queue/log parity with the older competition and programme monitors
- rotating baseline and freshness checks
- explicit manual-monitor handling for anti-bot/403/429/low-content sources
- two-successful-check confirmation before a changed source fingerprint is queued
- stale verification and status/deadline review signals
- feedback aggregation when the V3 Feedback Queue exists
- operations run logging and scheduled daily/fortnightly workflows

The private runtime is in `apps-script/OperationsV7.gs`. See `STAGE7-OPERATIONS.md` for the installation and review runbook. Monitoring findings never directly overwrite the public master records.

## Data and date principles

- Prefer official provider/organiser sources.
- Do not invent an exact date when the next cycle has not published one.
- Distinguish confirmed dates from expected/provisional dates.
- Expose source provenance and verification metadata where available.
- Keep private/admin maintenance fields out of the public payload.
- Treat the provider's official page as the final authority before an application, payment or travel decision.

Stage 8 follows the same principle: it normalises already-published public values for discovery, but does not infer missing eligibility, fee, deadline or application information.

## Release verification

See `RELEASE-VERIFICATION.md` for the Stage 5 production verification record. The live frontend also loads `stage5.js`, which performs read-only runtime release checks against the actual browser-loaded public data.

Stage 8 is an additive frontend layer and is recorded in `STAGE8-FINDER-ACCURACY.md`. Its assets are included in the PWA service-worker cache.

## Development rollback branches

Each major production stage has a rollback branch. Stage 7 begins from `backup-pre-stage7-2026-08-24`; the Stage 8 rollback point is `backup-pre-stage8-2026-08-24`.
