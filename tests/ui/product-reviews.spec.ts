import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';
import { suppressBanners } from '../helpers/banners';
import user from '../data/new-user.json';

test.describe('Product details and reviews - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.password);
    await page.goto('/#/search');
  });

  test('[TC-UI-1000] Clicking a product opens the detail dialog', async ({ page }) => {
    const product = new ProductPage(page);
    await product.openFirstProduct();

    // The dialog itself opening is the contract — different builds use
    // different inner class names for the description.
    await expect(page.locator('mat-dialog-container')).toBeVisible();
  });

  test('[TC-UI-1001] Logged-in user can submit a review', async ({ page }) => {
    const product = new ProductPage(page);
    await product.openFirstProduct();

    const reviewText = `Automated test review ${Date.now()}`;
    await product.writeReview(reviewText);

    // Juice Shop pops a snackbar "Your review has been saved." — that's the
    // canonical success signal. Earlier we OR'd against the dialog as a
    // fallback, but the dialog stays open after submission and that broke
    // strict mode. The snackbar alone is reliable.
    await expect(
      page.locator('simple-snack-bar', { hasText: /review.*saved/i })
    ).toBeVisible({ timeout: 8000 });
  });

  test('[TC-UI-1002] Closing the product dialog returns to the catalog', async ({ page }) => {
    const product = new ProductPage(page);
    await product.openFirstProduct();
    await product.closeDialog();

    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
  });
});
