# Stage 8 — Finder Accuracy & Type-Specific Discovery

Release date: 24 August 2026

Stage 8 is a frontend-only upgrade to the production finder. It improves the meaning and consistency of filters while preserving the existing private Google Sheet, public-safe Apps Script API and Stage 7 operations architecture.

## Release baseline

- 353 competitions
- 345 programmes
- 334 scholarships/funding records
- 1,032 public opportunities total

No opportunity master records are changed by Stage 8.

## Why this stage was needed

The production finder already exposed the required filter labels, but several controls still depended on literal source wording. That meant equivalent values such as `Online`, `Virtual` and `Remote` could fragment into separate choices, and application-route wording could vary widely by provider.

The previous deadline-horizon filter also used the next dated milestone for a record. For a competition, that could be a first round or final rather than the registration/submission deadline; for a programme, it could be the programme start date. Stage 8 separates deadline discovery from the general upcoming-date timeline.

## Stage 8 changes

### Deadline semantics

`Application / entry deadline` now considers only:

- application/registration deadline for all opportunity groups; and
- submission deadline for competitions where one is separately stored.

The horizon choices therefore mean that the opportunity has a future application/entry/submission deadline within the selected window.

Stage 8 also adds:

- `Published exact deadline`
- `No exact deadline published`
- `Deadline soonest` sort

This does not change the separate Upcoming calendar, which should continue to show useful rounds, programme starts, results and other dated events.

### Normalised delivery mode

Programme delivery values are grouped for discovery into:

- In person
- Online / virtual
- Hybrid / blended
- Other / check details
- Not stated

The underlying public record remains unchanged and the richer detail view continues to show the stored wording.

### Normalised entry/application route

Existing public fields are grouped into:

- Student applies directly
- School / teacher applies or registers
- Nomination / invitation
- Automatic / no separate application
- Restricted / selected institutions
- Other route
- Not stated

The classifier can use the existing public route, application method, access restrictions and published direct/school/teacher flags. It does not create a route when the public data contains no usable evidence.

### Conservative cost classification

Stage 8 distinguishes free, paid, funding and unknown/variable states more carefully. Values such as `TBA`, `varies`, `not stated`, `depends` or instructions to check the provider are no longer treated as paid merely because the field is non-empty.

### Status normalisation

The existing Open, Upcoming, Automatic and Closed classes are retained, with a separate `Rolling / ongoing` state added for year-round or rolling opportunities.

### Competition-specific controls

Competition views add:

- Competition type
- Entry format: individual available, team available, both, or not stated

### Programme-specific controls

Programme views expose:

- Programme type
- Delivery mode
- Residential status

### Funding-specific controls

Funding views expose:

- Funding type
- Award basis
- Financial-need basis

### Combined finder behaviour

On `All`, `Saved` and other mixed views, common filters remain visible. Once the user selects Competitions, Programmes or Funding, the corresponding type-specific controls become available.

Type-specific filter state is cleared when it becomes inapplicable, preventing a hidden programme filter from silently affecting a competition view.

### Active filters

Active filter chips are now buttons. Each can be removed independently, and the filter heading shows the number of currently active filters.

### Shareable URLs

The four new controls are added to the existing filter parameter registry, so they participate in:

- shared finder URLs
- browser URL state
- clear/reset behaviour
- reload restoration

A post-load guard covers the edge case where live API loading completes before the Stage 8 extension initialises.

## Files

- `stage8.js` — normalisation, filter logic, type-specific controls and URL-state integration
- `stage8.css` — removable filter chips and type-specific control styling
- `index.html` — loads the Stage 8 assets
- `sw.js` — caches the Stage 8 assets under `irish-academic-opportunities-v10-stage8-finder`
- `README.md` — release documentation

## Safety and data-integrity boundary

Stage 8 follows the same data principles as the rest of the finder:

- it does not invent an exact date;
- it does not infer eligibility from absence of information;
- it does not infer a fee from an unknown/variable cost;
- it does not write any normalised category back into the maintained masters;
- it does not expose private monitor/research fields;
- the stored provider/current-cycle wording remains visible in the detail view.

Normalisation is a discovery aid only.

## Verification performed

Before release:

- `stage8.js` passed JavaScript syntax validation with Node's `--check` parser;
- the new filter IDs are added to the existing `filterIds` registry;
- `index.html` loads `stage8.css` and `stage8.js` after the stable finder layers;
- the PWA service worker caches both Stage 8 assets and uses a new cache key;
- hidden type-specific controls clear their values when no longer applicable;
- specific opportunity tabs clear stale mixed-view `typeFilter` state;
- the Stage 8 post-load guard reapplies Stage 8 URL parameters if the live API resolves before the extension initialises.

The upgrade does not require an Apps Script redeployment because it consumes fields that are already present in the public dataset.

## Rollback

The pre-Stage-8 production point is preserved at:

`backup-pre-stage8-2026-08-24`

Rolling back to that branch removes the Stage 8 frontend layer without changing the Google Sheet, API or Stage 7 monitoring runtime.
