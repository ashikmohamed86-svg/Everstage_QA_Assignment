import { BrowserContext, Page, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { suppressBanners } from './banners';
import user from '../data/new-user.json';

/**
 * Single source of truth for the assignment login flow. Use this helper
 * inside `test.beforeEach` so every test starts already authenticated as
 * the user defined in `tests/data/new-user.json`.
 *
 * The helper:
 *   1. Pre-seeds cookies so the welcome / cookie / language banners do not
 *      cover form elements on first paint.
 *   2. Navigates to /#/login.
 *   3. Submits the credentials and asserts the login succeeded by checking
 *      the URL has left /login and the navbar account icon is rendered.
 *
 * If you need to drive a different account (e.g. a security probe targeting
 * the wrong-credentials path), call the underlying `LoginPage.attemptLogin`
 * directly from the test instead — this helper is only for the happy path
 * that should run before every test.
 */
export async function loginBeforeEach(
  page: Page,
  context: BrowserContext,
  email: string = user.email,
  password: string = user.password
): Promise<void> {
  await suppressBanners(context);

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.attemptLogin(email, password);

  await expect(page, 'login should leave /login').not.toHaveURL(/login/);
  await expect(page.locator('#navbarAccount'), 'navbar account icon should render').toBeVisible();
}
