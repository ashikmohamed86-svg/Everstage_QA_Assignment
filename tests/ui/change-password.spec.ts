import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { suppressBanners } from '../helpers/banners';
import { freshUser } from '../helpers/user';

/**
 * These tests register a brand-new user before each scenario so we never
 * mutate the credentials of the shared assessment account.
 */
test.describe('Change Password - UI', () => {
  test.beforeEach(async ({ context }) => {
    await suppressBanners(context);
  });

  async function registerAndLogin(page: import('@playwright/test').Page) {
    const reg = new RegisterPage(page);
    const u = freshUser();
    await reg.goto();
    await reg.register(u);
    await expect(page).toHaveURL(/login/, { timeout: 15000 });

    const login = new LoginPage(page);
    await login.goto();
    await login.login(u.email, u.password);
    return u;
  }

  test('[TC-UI-800] User can change password with valid input', async ({ page }) => {
    const u = await registerAndLogin(page);
    const cp = new ChangePasswordPage(page);
    await cp.goto();
    await cp.change(u.password, 'NewStrong!23');

    await expect(cp.successBanner).toBeVisible({ timeout: 10000 });
  });

  test('[TC-UI-801] Wrong current password is rejected', async ({ page }) => {
    await registerAndLogin(page);
    const cp = new ChangePasswordPage(page);
    await cp.goto();
    await cp.change('WrongOld!23', 'NewStrong!23');

    // Wrong current password leaves the success banner absent.
    await expect(cp.successBanner).toHaveCount(0);
  });

  test('[TC-UI-802] New / repeat mismatch keeps the Change button disabled', async ({ page }) => {
    const u = await registerAndLogin(page);
    const cp = new ChangePasswordPage(page);
    await cp.goto();
    await cp.currentPassword.fill(u.password);
    await cp.newPassword.fill('NewStrong!23');
    await cp.newPasswordRepeat.fill('DifferentRepeat!23');

    // Form-level validation: mismatch disables Change.
    await expect(cp.changeButton).toBeDisabled();
  });

  test('[TC-UI-803] Submit disabled while any field is empty', async ({ page }) => {
    await registerAndLogin(page);
    const cp = new ChangePasswordPage(page);
    await cp.goto();

    await expect(cp.changeButton).toBeDisabled();
  });
});
