import { Page, Locator } from '@playwright/test';

/**
 * Change Password page at /#/privacy-security/change-password.
 *
 * Selectors derived from the live DOM. Juice Shop renders the success / error
 * banner as a `role="status"` region inside the page (not a global snackbar),
 * so we anchor on that.
 */
export class ChangePasswordPage {
  readonly page: Page;
  readonly currentPassword: Locator;
  readonly newPassword: Locator;
  readonly newPasswordRepeat: Locator;
  readonly changeButton: Locator;
  readonly successBanner: Locator;
  readonly errorBanner: Locator;

  // Backwards-compat aliases for previously-written specs.
  get successSnackbar(): Locator {
    return this.successBanner;
  }
  get errorSnackbar(): Locator {
    return this.errorBanner;
  }

  constructor(page: Page) {
    this.page = page;
    this.currentPassword = page.getByLabel('Field to enter the current password');
    this.newPassword = page.getByLabel('Field for the new password');
    this.newPasswordRepeat = page.getByLabel('Field to repeat the new password');
    this.changeButton = page.getByRole('button', { name: 'Button to confirm the change' });
    this.successBanner = page.locator('[role="status"]', { hasText: /successfully changed/i });
    this.errorBanner = page.locator('[role="status"], simple-snack-bar', {
      hasText: /current password.*not correct|password.*do not match|wrong/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/privacy-security/change-password');
    await this.currentPassword.waitFor({ state: 'visible' });
  }

  async change(current: string, next: string, repeat?: string): Promise<void> {
    await this.currentPassword.fill(current);
    await this.newPassword.fill(next);
    await this.newPasswordRepeat.fill(repeat ?? next);
    await this.changeButton.click();
  }
}
