# Stage 6 — Distribution & School Launch

Release date: 24 August 2026

## Goal

Move the Irish Academic Opportunities Finder from a technically complete web app to a resource that can be distributed directly to students, teachers, TY coordinators and guidance counsellors.

## Public entry points

- Finder: https://liamsomers08.github.io/Irish-Academic-Opportunities/
- For schools & guidance: https://liamsomers08.github.io/Irish-Academic-Opportunities/schools.html
- Student quick-start: https://liamsomers08.github.io/Irish-Academic-Opportunities/student-guide.html
- About & trust: https://liamsomers08.github.io/Irish-Academic-Opportunities/about.html
- Printable launch pack: https://liamsomers08.github.io/Irish-Academic-Opportunities/launch-pack.html

## Distribution assets added

### `schools.html`

School-facing landing page for teachers, TY coordinators and guidance teams. Includes:

- three-minute student start;
- suggested classroom/year-group rollout;
- explanation of Teacher mode and Upcoming;
- trust/research summary;
- copy-ready student announcement;
- links to all launch resources;
- reusable QR code.

### `student-guide.html`

Concise student guide covering:

- school-year-first searching;
- keyword/search examples;
- useful filters;
- saving opportunities;
- reading date confidence;
- checking Upcoming;
- official-provider verification;
- correction reporting.

### `launch-pack.html`

Print-ready A4 material containing:

1. a student-facing QR poster;
2. a staff/guidance launch sheet;
3. a suggested 10-minute launch exercise;
4. Teacher mode guidance;
5. a copy-ready Classroom/Teams message.

The page can be printed directly or saved as PDF using the browser print dialog.

### `about.html`

Public trust/methodology page covering:

- scope;
- provider-first sourcing;
- verification metadata;
- date confidence;
- no-invented-date principle;
- role of official provider pages;
- browser-local saved items;
- anonymous correction workflow;
- public/private data separation;
- release-quality checks;
- non-endorsement caveat.

### `qr-code.svg`

Reusable QR code pointing to the root public finder URL.

## Finder integration

The homepage now:

- starts with the verified 1,032-record release baseline before live bootstrap completes;
- exposes a `For schools` header link;
- includes a school-launch callout on Discover;
- links to school resources in the footer;
- loads the Stage 5 runtime release guard that was previously created but not wired into `index.html`.

## PWA / discovery integration

- Stage 6 launch pages/assets are included in the service worker cache.
- PWA manifest includes a `For schools & guidance` shortcut.
- `schools.html`, `student-guide.html` and `about.html` are included in the sitemap.
- `launch-pack.html` is intentionally `noindex` because it is a print utility rather than a search landing page.

## Maintained Google Sheet

The `Start Here` tab now includes a `PUBLIC WEBSITE & SCHOOL LAUNCH` section linking to:

- the public web finder;
- school/guidance launch page;
- student quick-start;
- printable launch pack.

## Suggested school rollout

1. Add the finder link to the school guidance/TY/academic-opportunities channel.
2. Print one or more QR posters for guidance noticeboards, libraries or club areas.
3. Post the copy-ready message in Classroom/Teams.
4. Use a 10-minute class launch: school year → one interest → save three opportunities → inspect one official source.
5. Re-share Upcoming around high-deadline periods.
6. Encourage students/staff to use the anonymous correction workflow when something changes.

## Custom domain

No custom domain is activated in Stage 6 because no domain was selected. The launch materials use the stable GitHub Pages URL. A custom domain can be introduced later without changing the source-of-truth/API architecture; QR codes and printed materials should then be regenerated to point at the chosen canonical domain.

## Rollback

Pre-Stage-6 rollback branch:

`backup-pre-stage6-2026-08-24`
