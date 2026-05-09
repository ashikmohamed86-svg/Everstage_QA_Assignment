import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';
import { suppressBanners } from '../helpers/banners';
import { freshUser } from '../helpers/user';
import existingUser from '../data/new-user.json';

test.describe('Registration - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  test('[TC-UI-200] User can register with valid data', async ({ page }) => {
    const register = new RegisterPage(page);
    const u = freshUser();

    await register.goto();
    await register.register(u);

    // On success Juice Shop redirects to /#/login.
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('[TC-UI-201] Submit is disabled when required fields are empty', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await expect(register.registerButton).toBeDisabled();
  });

  test('[TC-UI-202] Repeat password mismatch keeps Register disabled', async ({ page }) => {
    const register = new RegisterPage(page);
    const u = freshUser();
    await register.goto();

    await register.emailInput.fill(u.email);
    await register.passwordInput.fill(u.password);
    await register.repeatPasswordInput.fill('CompletelyDifferent!23');
    await register.pickSecurityQuestion(0);
    await register.securityAnswerInput.fill(u.securityAnswer);

    // Even with every other field valid, mismatched repeat keeps Register off.
    await expect(register.registerButton).toBeDisabled();
  });

  test('[TC-UI-203] Malformed email keeps Register disabled', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.emailInput.fill('not-an-email');
    await register.passwordInput.fill('StrongPass!23');
    await register.repeatPasswordInput.fill('StrongPass!23');

    await expect(register.registerButton).toBeDisabled();
  });

  test('[TC-UI-204] Password shorter than 5 chars is rejected (form-level)', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.emailInput.fill('shortpw-' + Date.now() + '@juice.test');
    await register.passwordInput.fill('abcd');
    await register.repeatPasswordInput.fill('abcd');

    // 4-char password fails the 5-40 char rule → Register stays disabled.
    await expect(register.registerButton).toBeDisabled();
  });

  test('[TC-UI-205] Boundary: password length of exactly 5 chars is accepted', async ({ page }) => {
    const register = new RegisterPage(page);
    const u = freshUser({ password: 'abcde', repeatPassword: 'abcde' });

    await register.goto();
    await register.register(u);

    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('[TC-UI-206] Re-registering an existing email is rejected', async ({ page }) => {
    const register = new RegisterPage(page);
    const u = freshUser({ email: existingUser.email, password: existingUser.password });

    await register.goto();
    await register.register(u);

    // Server-side rejection: an inline error or a snackbar.
    await expect(
      page.locator('.error, mat-error, simple-snack-bar', { hasText: /already in use|exists|unique/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
