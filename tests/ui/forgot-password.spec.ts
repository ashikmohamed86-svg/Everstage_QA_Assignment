import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { suppressBanners } from '../helpers/banners';
import { freshUser } from '../helpers/user';

/**
 * Forgot-password flow exercises a fresh user every test so we never alter
 * the password of the shared assessment account.
 */
test.describe('Forgot Password - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  test('[TC-UI-1200] User can reset password with correct security answer', async ({ page }) => {
    const reg = new RegisterPage(page);
    const u = freshUser();
    await reg.goto();
    await reg.register(u);
    await expect(page).toHaveURL(/login/, { timeout: 15000 });

    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    const newPassword = 'BrandNewPass!23';

    // Wait for the underlying PUT to complete before navigating away —
    // otherwise the subsequent login can race the password update.
    const resetCallPromise = page.waitForResponse(
      (r) => r.url().includes('/rest/user/reset-password') && r.request().method() === 'POST'
    );
    await fp.resetPassword(u.email, u.securityAnswer, newPassword);
    const resetResponse = await resetCallPromise;
    expect(resetResponse.ok(), 'reset-password call should succeed').toBeTruthy();

    // Now the new password works on a fresh login — strongest end-to-end check.
    const login = new LoginPage(page);
    await login.goto();
    await login.login(u.email, newPassword);
    await expect(page).not.toHaveURL(/login/);
  });

  test('[TC-UI-1201] Reset is rejected when security answer is wrong', async ({ page }) => {
    const reg = new RegisterPage(page);
    const u = freshUser();
    await reg.goto();
    await reg.register(u);
    await expect(page).toHaveURL(/login/, { timeout: 15000 });

    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    await fp.resetPassword(u.email, 'totally-wrong-answer', 'NewerPass!23');

    // The original password must still work; the new one must not.
    const login = new LoginPage(page);
    await login.goto();
    await login.attemptLogin(u.email, 'NewerPass!23');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
  });
});
