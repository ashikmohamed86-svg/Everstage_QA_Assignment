import { Page, Locator } from '@playwright/test';

export interface NewUser {
  email: string;
  password: string;
  repeatPassword?: string;
  /** 0-based index of the security question (the label list varies per build / locale). */
  securityQuestionIndex?: number;
  securityAnswer?: string;
}

/**
 * Registration page: /#/register.
 * Selectors derived from the live DOM snapshot — aria-label is the most stable
 * anchor since Juice Shop auto-generates element ids per render.
 */
export class RegisterPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly repeatPasswordInput: Locator;
  readonly securityQuestionDropdown: Locator;
  readonly securityAnswerInput: Locator;
  readonly registerButton: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly repeatPasswordError: Locator;
  readonly securityAnswerError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email address field');
    this.passwordInput = page.getByLabel('Field for the password');
    this.repeatPasswordInput = page.getByLabel('Field to confirm the password');
    this.securityQuestionDropdown = page.getByLabel('Selection list for the security question');
    this.securityAnswerInput = page.getByLabel('Field for the answer to the security question');
    this.registerButton = page.getByRole('button', { name: 'Button to complete the registration' });
    this.emailError = page.locator('mat-error, .error').filter({ hasText: /email/i });
    this.passwordError = page.locator('mat-error, .error, .mat-hint, em').filter({ hasText: /password.*5|5.*characters/i });
    this.repeatPasswordError = page.locator('mat-error, .error').filter({ hasText: /match|repeat|do not/i });
    this.securityAnswerError = page.locator('mat-error, .error').filter({ hasText: /answer/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/register');
    // Wait for the registration page's background fetches (e.g. /api/SecurityQuestions
    // via the question dropdown's data binding) to settle so the panel can open
    // first try once we click it.
    await this.page.waitForLoadState('networkidle');
  }

  /** Picks the Nth security question. Defaults to the first one. */
  async pickSecurityQuestion(index = 0): Promise<void> {
    // mat-select intermittently swallows the first click as a "gain focus"
    // event without opening the panel. We try (a) click, (b) focus + ArrowDown
    // (standard ARIA combobox open), and as a last resort (c) dispatch a click
    // directly on the inner trigger via JS — one of these always opens it.
    const options = this.page.locator('mat-option');
    const tryStrategies = async () => {
      await this.securityQuestionDropdown.click();
      if (await options.first().isVisible({ timeout: 1500 }).catch(() => false)) return true;

      await this.securityQuestionDropdown.focus();
      await this.page.keyboard.press('ArrowDown');
      if (await options.first().isVisible({ timeout: 1500 }).catch(() => false)) return true;

      await this.securityQuestionDropdown.evaluate((host) => {
        const trigger = host.querySelector('.mat-mdc-select-trigger, .mat-select-trigger') as HTMLElement | null;
        trigger?.click();
      });
      return await options.first().isVisible({ timeout: 2000 }).catch(() => false);
    };

    let opened = false;
    for (let attempt = 0; attempt < 2 && !opened; attempt++) {
      opened = await tryStrategies();
      if (!opened) await this.page.waitForTimeout(400);
    }
    await options.first().waitFor({ state: 'visible', timeout: 5000 });
    await options.nth(index).click();
  }

  async fill(user: NewUser): Promise<void> {
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.repeatPasswordInput.fill(user.repeatPassword ?? user.password);
    // Pause until any pending requests finish — the password-strength
    // validator and the security-question fetch both run async on this page,
    // and clicking the dropdown mid-flight reliably loses the click event.
    await this.page.waitForLoadState('networkidle');
    await this.pickSecurityQuestion(user.securityQuestionIndex ?? 0);
    await this.securityAnswerInput.fill(user.securityAnswer ?? 'TestAnswer');
  }

  async register(user: NewUser): Promise<void> {
    await this.fill(user);
    await this.registerButton.click();
  }

  async submitDisabled(): Promise<boolean> {
    return await this.registerButton.isDisabled();
  }
}
