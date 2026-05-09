import { Page, Locator } from '@playwright/test';

/**
 * Forgot password flow at /#/forgot-password.
 * The user enters their email; once recognised, the security question is shown
 * and they must supply the answer plus a new password / confirmation.
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly securityAnswerInput: Locator;
  readonly newPasswordInput: Locator;
  readonly newPasswordRepeatInput: Locator;
  readonly resetButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.securityAnswerInput = page.locator('#securityAnswer');
    this.newPasswordInput = page.locator('#newPassword');
    this.newPasswordRepeatInput = page.locator('#newPasswordRepeat');
    this.resetButton = page.locator('#resetButton');
    this.successMessage = page.locator('.confirmation, .mat-success, mat-card').filter({
      hasText: /password.*successfully changed/i,
    });
    this.errorMessage = page.locator('.error, mat-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/forgot-password');
  }

  async resetPassword(
    email: string,
    securityAnswer: string,
    newPassword: string,
    repeat?: string
  ): Promise<void> {
    await this.emailInput.fill(email);
    // After email blurs, the security question section appears.
    await this.emailInput.blur();
    await this.securityAnswerInput.waitFor({ state: 'visible' });
    await this.securityAnswerInput.fill(securityAnswer);
    await this.newPasswordInput.fill(newPassword);
    await this.newPasswordRepeatInput.fill(repeat ?? newPassword);
    await this.resetButton.click();
  }
}
