// Final Stage 9 production browser gate: exercise only controls visible to real users.
const { test, expect } = require('@playwright/test');

async function waitForLiveData(page) {
  await expect(page.locator('#total')).toHaveText(/\d+/);
  await expect.poll(
    async () => page.evaluate(() => (typeof allData === 'function' ? allData().length : 0)),
    { timeout: 45_000 }
  ).toBeGreaterThan(0);
  await expect(page.locator('#cc')).not.toHaveText('0');
  await expect(page.locator('#pc')).not.toHaveText('0');
  await expect(page.locator('#sc')).not.toHaveText('0');
}

async function assertSingleReleaseVerifier(page) {
  await expect.poll(
    async () => page.locator('script[src$="stage5.js"]').count(),
    { timeout: 10_000 }
  ).toBe(1);
}

async function assertReleaseHealth(page) {
  await expect.poll(
    async () => page.evaluate(() => ({
      mode: window.IAO_RELEASE_HEALTH?.mode || '',
      ready: window.IAO_RELEASE_HEALTH?.releaseReady === true,
      criticalFailures: (window.IAO_RELEASE_HEALTH?.checks || []).filter(x => x?.severity === 'critical' && !x?.pass).map(x => x.name)
    })),
    { timeout: 35_000 }
  ).toMatchObject({ mode: 'live', ready: true, criticalFailures: [] });

  await expect(page.getByText('Release verification detected incomplete live opportunity data.', { exact: false })).toHaveCount(0);
  await expect(page.locator('#siteNotice.site-notice.on.error')).toHaveCount(0);
}

async function assertGeographicSearch(page) {
  await expect.poll(
    async () => page.evaluate(() => window.IAO_GEO_SEARCH?.VERSION || ''),
    { timeout: 15_000 }
  ).toBe('geo-search-2026-08-25a');

  const geo = await page.evaluate(() => {
    const byId = id => allData().find(x => x.id === id);
    const counties = ['Carlow','Cavan','Clare','Cork','Donegal','Dublin','Galway','Kerry','Kildare','Kilkenny','Laois','Leitrim','Limerick','Longford','Louth','Mayo','Meath','Monaghan','Offaly','Roscommon','Sligo','Tipperary','Waterford','Westmeath','Wexford','Wicklow','Antrim','Armagh','Down','Fermanagh','Derry','Tyrone'];
    return {
      unresolvedCounties: counties.filter(county => !window.IAO_GEO_SEARCH.resolve(county)?.counties?.includes(county)),
      newbridgeCounty: window.IAO_GEO_SEARCH.resolve('Newbridge')?.counties?.[0] || '',
      naasCounty: window.IAO_GEO_SEARCH.resolve('Naas TY')?.counties?.[0] || '',
      naasRemainder: window.IAO_GEO_SEARCH.resolve('Naas TY')?.remainder || '',
      belfastRegion: window.IAO_GEO_SEARCH.resolve('Belfast')?.regions?.[0] || '',
      kildareLocalProgramme: matchesQuery(byId('P042'), 'Newbridge'),
      dublinOnlyProgramme: matchesQuery(byId('P001'), 'Newbridge'),
      nationalCompetition: matchesQuery(byId('C001'), 'Newbridge'),
      limerickRestrictedCompetition: matchesQuery(byId('C002'), 'Newbridge')
    };
  });

  expect(geo.unresolvedCounties).toEqual([]);
  expect(geo.newbridgeCounty).toBe('Kildare');
  expect(geo.naasCounty).toBe('Kildare');
  expect(geo.naasRemainder).toBe('ty');
  expect(geo.belfastRegion).toBe('Northern Ireland');
  expect(geo.kildareLocalProgramme).toBe(true);
  expect(geo.dublinOnlyProgramme).toBe(false);
  expect(geo.nationalCompetition).toBe(true);
  expect(geo.limerickRestrictedCompetition).toBe(false);

  await page.locator('.nav [data-tab="all"]').click();
  await page.locator('#q').fill('Newbridge');
  await expect(page.locator('#resultCount')).not.toHaveText(/^0 opportunities/);
  await expect(page.locator('#results [data-detail="P042"]')).toBeVisible();

  await page.locator('#q').fill('Kildare TY');
  await expect(page.locator('#resultCount')).not.toHaveText(/^0 opportunities/);
  await expect(page.locator('#results [data-detail="P042"]')).toBeVisible();
}

async function enterCompetitions(page) {
  // Use the visible Discover route rather than the desktop-only header nav.
  const route = page.locator('#home .path[data-tab="competitions"]');
  await expect(route).toBeVisible();
  await route.click();
  await expect(page.locator('#finder')).toBeVisible();
  await expect(page.locator('#title')).toHaveText('Competitions');
}

async function openKnownCompetition(page) {
  await enterCompetitions(page);
  await page.locator('#q').fill('C001');
  await expect(page.locator('#resultCount')).not.toHaveText(/^0 opportunities/);
  // Scope the selector to rendered finder results so hidden Upcoming/home cards
  // cannot be mistaken for the searched opportunity.
  const detail = page.locator('#results [data-detail]').first();
  await expect(detail).toBeVisible();
  await detail.click();
  const dialog = page.locator('#dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#dtitle')).toContainText('Irish Mathematical Olympiad');
  await expect(dialog.getByRole('link', { name: /Official page/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Report \/ update/i })).toBeVisible();
}

test('desktop production finder core journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Irish Academic Opportunities Finder/);
  await waitForLiveData(page);
  await assertSingleReleaseVerifier(page);
  await assertReleaseHealth(page);
  await assertGeographicSearch(page);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForLiveData(page);
  await openKnownCompetition(page);

  await page.locator('#dialog [data-save]').click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await page.locator('#closeDialog').click();

  await page.locator('.nav [data-tab="upcoming"]').click();
  await expect(page.locator('#upcomingHub')).toBeVisible();
  await expect(page.locator('#calendarCount')).not.toHaveText(/^0 dated events$/);

  await page.goto('./schools.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Give students one place');
  await expect(page.getByRole('link', { name: /Open the live finder/i })).toBeVisible();
});

test('mobile production progressive disclosure and detail journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await waitForLiveData(page);
  await assertSingleReleaseVerifier(page);
  await assertReleaseHealth(page);

  const heroToggle = page.locator('#mobileHeroSearchToggle');
  await expect(heroToggle).toBeVisible();
  await expect(page.locator('#heroForm')).not.toBeVisible();
  await heroToggle.click();
  await expect(page.locator('#heroForm')).toBeVisible();

  await enterCompetitions(page);
  const refine = page.locator('#mobileRefine');
  await expect(refine).toBeVisible();
  await expect(page.locator('.filters')).not.toBeVisible();
  await refine.click();
  await expect(page.locator('.filters')).toBeVisible();
  await page.locator('#schoolYear').selectOption({ label: 'TY' });
  await expect(refine.locator('.mobile-filter-count')).toHaveText(/[1-9]/);
  // Clear the filter after proving progressive disclosure/counting so the
  // C001 regression anchor does not depend on any particular school-year map.
  await page.locator('#schoolYear').selectOption('');

  await page.locator('#q').fill('C001');
  const detail = page.locator('#results [data-detail]').first();
  await expect(detail).toBeVisible();
  await detail.click();
  const dialog = page.locator('#dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#dtitle')).toContainText('Irish Mathematical Olympiad');
  await expect(dialog.getByRole('button', { name: /Report \/ update/i })).toBeVisible();
  await expect(dialog).toHaveCSS('border-bottom-left-radius', '0px');
});