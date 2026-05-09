import { test, expect } from '@playwright/test';
import { suppressBanners } from '../helpers/banners';

test.describe('Site navigation & UX - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  test('[TC-UI-1100] Landing page renders header, search, and product list', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('mat-toolbar.navbar-toolbar')).toBeVisible();
    await expect(page.locator('mat-card').first()).toBeVisible();
  });

  test('[TC-UI-1101] About Us page is reachable from the side menu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open sidenav/i }).click();
    // The sidenav renders an <a> link, not a button, for navigational items.
    await page.getByRole('link', { name: /go to about us page/i }).click();

    await expect(page).toHaveURL(/about/);
  });

  test('[TC-UI-1102] Language picker exposes multiple languages', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /language selection menu/i }).click();

    // Each language is rendered as a mat-radio-button (not a menu-item button).
    const options = page.locator('.mat-mdc-menu-panel mat-radio-button.language-option');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThan(1);
  });

  test('[TC-UI-1103] Score Board page is reachable directly via /#/score-board', async ({ page }) => {
    await page.goto('/#/score-board');
    await expect(page).toHaveURL(/score-board/);
    await expect(page.locator('app-score-board, app-challenge-card, mat-card').first())
      .toBeVisible();
  });
});
