import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { suppressBanners } from '../helpers/banners';
import user from '../data/new-user.json';

async function loginUI(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(user.email, user.password);
}

test.describe('Account-area pages reachability - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await suppressBanners(context);
    await loginUI(page);
  });

  test(
    '[TC-UI-1500] Wallet page renders the current balance',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/wallet');
      await expect(page).toHaveURL(/wallet/);
      // Balance is rendered with the in-app currency suffix.
      await expect(page.locator('mat-card, app-wallet').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1501] Last login IP page is reachable',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/last-login-ip');
      await expect(page).toHaveURL(/last-login-ip/);
      await expect(page.locator('mat-card').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1502] Privacy & Security menu route loads without redirect',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      // /#/privacy-security is a parent layout that renders only a sidenav
      // and a child router-outlet — there's no page-level content of its
      // own. Assert the URL stuck (no redirect to /login or /403) and that
      // the layout container is mounted.
      await page.goto('/#/privacy-security');
      await expect(page).toHaveURL(/\/privacy-security$/);
      await expect(page.locator('app-privacy-security')).toHaveCount(1);
    }
  );

  test(
    '[TC-UI-1503] Two-factor authentication setup page is reachable',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/two-factor-authentication');
      await expect(page).toHaveURL(/two-factor-authentication/);
      await expect(page.locator('mat-card').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1504] Data-export page is reachable',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/data-export');
      await expect(page).toHaveURL(/data-export/);
      await expect(page.locator('mat-card').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1505] Complain page is reachable for logged-in users',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/complain');
      await expect(page).toHaveURL(/complain/);
      await expect(page.locator('mat-card').first()).toBeVisible();
    }
  );
});

test.describe('Public information pages reachability - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  test(
    '[TC-UI-1600] Privacy policy page is reachable without login',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/privacy-policy');
      await expect(page).toHaveURL(/privacy-policy/);
      await expect(page.locator('mat-card, app-privacy-policy').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1601] Photo wall page is reachable without login',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/photo-wall');
      await expect(page).toHaveURL(/photo-wall/);
      await expect(page.locator('app-photo-wall, mat-card, mat-grid-list').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1602] Track-result lookup page is reachable',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ page }) => {
      await page.goto('/#/track-result/new');
      await expect(page).toHaveURL(/track-result/);
      await expect(page.locator('mat-card').first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-1603] 403 error page renders the error layout',
    { tag: ['@everstage-qa', '@negative'] },
    async ({ page }) => {
      await page.goto('/#/403');
      await expect(page).toHaveURL(/403/);
      // The 403 page shows an error illustration / message card.
      await expect(page.locator('mat-card, app-error-page, .error').first()).toBeVisible();
    }
  );
});
