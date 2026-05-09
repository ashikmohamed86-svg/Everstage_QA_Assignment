import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { suppressBanners } from '../helpers/banners';
import user from '../data/new-user.json';

/**
 * Account-area pages that the catalog currently doesn't cover: profile and
 * order history. Both are gated by an auth token and live at server-rendered
 * routes (not hash routes) for profile, and a hash route for order-history.
 */
test.describe('Account areas - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.password);
  });

  test('[TC-UI-1300] Profile page is reachable for logged-in users', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByText('User Profile')).toBeVisible();
    // The email is rendered as an <input> value rather than text content;
    // assert against the value attribute so getByText doesn't miss it.
    await expect(page.locator(`input[value="${user.email}"]`)).toBeVisible();
  });

  test('[TC-UI-1400] Order history is reachable for logged-in users', async ({ page }) => {
    await page.goto('/#/order-history');

    await expect(page).toHaveURL(/order-history/);
    // Either the page title or the empty-state copy is visible — either is a
    // valid signal that the route rendered without redirecting back to login.
    const title = page.getByText('Order History');
    const emptyState = page.getByText(/no orders|have not placed any orders|no results found/i);
    await expect(title.or(emptyState).first()).toBeVisible({ timeout: 10000 });
  });
});
