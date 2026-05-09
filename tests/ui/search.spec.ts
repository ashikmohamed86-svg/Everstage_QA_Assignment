import { test, expect } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';
import { suppressBanners } from '../helpers/banners';

test.describe('Search - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  test('[TC-UI-400] Searching "apple" returns at least one product', async ({ page }) => {
    const search = new SearchPage(page);
    await search.search('apple');

    await expect(page.locator('mat-card', { hasText: /apple/i }).first()).toBeVisible();
  });

  test('[TC-UI-401] Search returns the empty-state message for a nonsense query', async ({
    page,
  }) => {
    const search = new SearchPage(page);
    await search.search('zzzz-no-such-product-zzzz');

    await expect(search.noResultsMessage).toBeVisible({ timeout: 10000 });
  });

  test('[TC-UI-402] Empty search shows the full catalog', async ({ page }) => {
    const search = new SearchPage(page);
    await search.search('');

    await expect(page.locator('mat-card').first()).toBeVisible();
    expect(await search.productCardCount()).toBeGreaterThan(1);
  });

  test('[TC-UI-403] XSS payload in search is rendered as text, not executed', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', (d) => {
      alertFired = true;
      d.dismiss();
    });

    const search = new SearchPage(page);
    await search.search('<script>alert(1)</script>');

    await page.waitForTimeout(500);
    expect(alertFired).toBe(false);
  });

  test('[TC-UI-404] Long search term (200 chars) is handled without crash', async ({ page }) => {
    const search = new SearchPage(page);
    await search.search('a'.repeat(200));

    await expect(page).toHaveURL(/search/);
  });
});
