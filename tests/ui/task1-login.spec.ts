import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { suppressBanners } from '../helpers/banners';
import { loginBeforeEach } from '../helpers/login';
import user from '../data/new-user.json';

/**
 * ════════════════════════════════════════════════════════════════════════
 *  ⭐  EVERSTAGE ASSESSMENT — TASK 1
 *  ─────────────────────────────────────────────────────────────────────
 *  "Manually create a new user and add their credentials [to] the
 *   new-user.json file. Then create a login script in the beforeEach
 *   hook to login every time a test runs."
 *
 *  Run only this task:    npm run test:task1
 *  Credentials file:      tests/data/new-user.json
 *  Login script:          tests/helpers/login.ts (`loginBeforeEach`)
 *  All tests tagged:      @task1, @everstage-qa
 * ════════════════════════════════════════════════════════════════════════
 *
 * Every test in the "authenticated session" describe block runs through the
 * shared login script in `beforeEach`, so each test starts already
 * authenticated as the user defined in `tests/data/new-user.json`. Tests
 * that need to verify the login form itself (negative / boundary /
 * security) live in the second describe block — they share banner
 * suppression but skip the credential submission so they can drive the
 * form themselves.
 */
test.describe('Login - UI (Task 1: beforeEach login)', () => {
  test.describe('authenticated session', () => {
    test.beforeEach(async ({ page, context }) => {
      await loginBeforeEach(page, context);
    });

    test(
      '[TC-UI-100] beforeEach login lands on a logged-in homepage',
      { tag: ['@task1', '@everstage-qa', '@positive', '@smoke', '@e2e'] },
      async ({ page }) => {
        await expect(page).not.toHaveURL(/login/);
        await expect(page.locator('#navbarAccount')).toBeVisible();
      }
    );

    test(
      '[TC-UI-101] Logged-in user can open the account menu and see the email',
      { tag: ['@task1', '@everstage-qa', '@positive', '@smoke', '@regression'] },
      async ({ page }) => {
        await page.locator('#navbarAccount').click();
        // The email shows up both in the sidenav (hidden until expanded) and
        // in the open account menu — anchor on the visible menuitem so the
        // assertion isn't ambiguous.
        await expect(
          page.getByRole('menuitem', { name: /go to user profile/i })
        ).toContainText(user.email);
      }
    );

    test(
      '[TC-UI-102] /rest/user/whoami responds with the authenticated user after beforeEach login',
      { tag: ['@task1', '@everstage-qa', '@functional', '@regression'] },
      async ({ page }) => {
        const response = await page.request.get('/rest/user/whoami');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.user?.email).toBe(user.email);
      }
    );

    test(
      '[TC-UI-103] Logout returns to a logged-out state',
      { tag: ['@task1', '@everstage-qa', '@positive', '@regression', '@e2e'] },
      async ({ page }) => {
        await page.locator('#navbarAccount').click();
        await page.locator('#navbarLogoutButton').click();

        await expect(page.locator('#navbarLogoutButton')).toHaveCount(0);
        await page.locator('#navbarAccount').click();
        await expect(page.locator('#navbarLoginButton')).toBeVisible();
      }
    );
  });

  test.describe('login form validation', () => {
    test.beforeEach(async ({ context }) => {
      await suppressBanners(context);
    });

    test(
      '[TC-UI-110] Login button is disabled while either field is empty',
      { tag: ['@task1', '@everstage-qa', '@negative', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await expect(loginPage.loginButton).toBeDisabled();

        await loginPage.emailInput.fill(user.email);
        await expect(loginPage.loginButton).toBeDisabled();

        await loginPage.passwordInput.fill(user.password);
        await expect(loginPage.loginButton).toBeEnabled();
      }
    );

    test(
      '[TC-UI-111] Login fails with a wrong password',
      { tag: ['@task1', '@everstage-qa', '@negative', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin(user.email, 'WrongPassword!23');

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        await expect(page).toHaveURL(/login/);
      }
    );

    test(
      '[TC-UI-112] Login fails for an unregistered email',
      { tag: ['@task1', '@everstage-qa', '@negative', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin('does-not-exist-1234567@juice.test', 'AnyPass!23');

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
      }
    );

    test(
      '[TC-UI-113] Whitespace-only credentials are rejected',
      { tag: ['@task1', '@everstage-qa', '@negative', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin('   ', '   ');

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        await expect(page).toHaveURL(/login/);
      }
    );

    test(
      '[TC-UI-114] Password case mismatch is rejected',
      { tag: ['@task1', '@everstage-qa', '@negative', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin(user.email, user.password.toUpperCase());

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
      }
    );

    test(
      '[TC-UI-120] DOCUMENTED VULN: SQL-injection email comment bypass logs in on default Juice Shop',
      { tag: ['@task1', '@everstage-qa', '@security', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin("' OR 1=1--", 'anything');

        await expect(page).not.toHaveURL(/login/);
        await expect(page.locator('#navbarAccount')).toBeVisible();
      }
    );

    test(
      '[TC-UI-121] XSS payload in email field is not executed',
      { tag: ['@task1', '@everstage-qa', '@security', '@regression'] },
      async ({ page }) => {
        let dialogFired = false;
        page.on('dialog', async (dialog) => {
          dialogFired = true;
          await dialog.dismiss();
        });

        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin('<script>alert(1)</script>@x.test', 'AnyPass!23');

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        expect(dialogFired, 'no script should execute from the email field').toBe(false);
      }
    );

    test(
      '[TC-UI-122] Error message does not disclose whether the email exists',
      { tag: ['@task1', '@everstage-qa', '@security', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.attemptLogin('does-not-exist-7654321@juice.test', 'AnyPass!23');
        const unknownError = await page.getByText('Invalid email or password.').textContent();

        await loginPage.emailInput.fill(user.email);
        await loginPage.passwordInput.fill('WrongPassword!23');
        await loginPage.loginButton.click();
        const wrongPwError = await page.getByText('Invalid email or password.').textContent();

        expect(unknownError).toBe(wrongPwError);
      }
    );

    test(
      '[TC-UI-130] Very long email input is handled without crashing',
      { tag: ['@task1', '@everstage-qa', '@boundary', '@nonfunctional', '@regression'] },
      async ({ page }) => {
        const longLocal = 'a'.repeat(300);
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin(`${longLocal}@juice.test`, 'AnyPass!23');

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        await expect(page).toHaveURL(/login/);
      }
    );

    test(
      '[TC-UI-131] Very long password input is handled without crashing',
      { tag: ['@task1', '@everstage-qa', '@boundary', '@nonfunctional', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.attemptLogin(user.email, 'A'.repeat(2000));

        await expect(page.getByText('Invalid email or password.')).toBeVisible();
        await expect(page).toHaveURL(/login/);
      }
    );

    test(
      '[TC-UI-140] Load: 5 sequential failed logins in <10s do not lock or 5xx',
      { tag: ['@task1', '@everstage-qa', '@load', '@nonfunctional', '@regression'] },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        for (let i = 0; i < 5; i++) {
          await loginPage.emailInput.fill(user.email);
          await loginPage.passwordInput.fill(`WrongPassword!${i}`);
          await loginPage.loginButton.click();
          await expect(page.getByText('Invalid email or password.')).toBeVisible();
        }

        // After the burst the legitimate password must still authenticate.
        await loginPage.emailInput.fill(user.email);
        await loginPage.passwordInput.fill(user.password);
        await loginPage.loginButton.click();
        await expect(page).not.toHaveURL(/login/);
      }
    );
  });
});
