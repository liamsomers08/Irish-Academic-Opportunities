const { test, expect } = require('@playwright/test');

async function waitForLiveData(page) {
  await expect(page.locator('#total')).toHaveText(/\d+/);
  await expect.poll(async () => Number((await page.locator('#total').textContent()) || 0), { timeout: 30_000 }).toBeGreaterThanOrEqual(1000);
  await expect(page.locator('#cc')).not.toHaveText('0');
  await expect(page.locator('#pc')).not.toHaveText('0');
  await expect(page.locator('#sc')).not.toHaveText('0');
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
  await page.locator('#q').fill('Irish Mathematical Olympiad');
  await expect(page.locator('#resultCount')).not.toHaveText(/^0 opportunities/);
  // Scope the selector to rendered finder results so hidden Upcoming/home cards
  // cannot be mistaken for the searched opportunity.
  const detail = page.locator('#results [data-detail]').first();
  await expect(detail).toBeVisible();
  await detail.click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dtitle')).toContainText('Irish Mathematical Olympiad');
  await expect(page.getByRole('link', { name: /Official page/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Report \/ update/i })).toBeVisible();
}

test('desktop production finder core journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Irish Academic Opportunities Finder/);
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

  await page.locator('#q').fill('Irish Mathematical Olympiad');
  const detail = page.locator('#results [data-detail]').first();
  await expect(detail).toBeVisible();
  await detail.click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dtitle')).toContainText('Irish Mathematical Olympiad');
  await expect(page.getByRole('button', { name: /Report \/ update/i })).toBeVisible();
  await expect(page.locator('#dialog')).toHaveCSS('border-bottom-left-radius', '0px');
});
