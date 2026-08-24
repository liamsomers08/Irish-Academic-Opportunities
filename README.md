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

## Data and date principles

- Prefer official provider/organiser sources.
- Do not invent an exact date when the next cycle has not published one.
- Distinguish confirmed dates from expected/provisional dates.
- Expose source provenance and verification metadata where available.
- Keep private/admin maintenance fields out of the public payload.
- Treat the provider's official page as the final authority before an application, payment or travel decision.

## Release verification

See `RELEASE-VERIFICATION.md` for the Stage 5 production verification record. The live frontend also loads `stage5.js`, which performs read-only runtime release checks against the actual browser-loaded public data.

## Development rollback branches

Each major production stage has a rollback branch. Stage 6 begins from `backup-pre-stage6-2026-08-24`.
