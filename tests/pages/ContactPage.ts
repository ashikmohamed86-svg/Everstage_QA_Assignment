import { Page, Locator } from '@playwright/test';

/**
 * Customer Feedback page at /#/contact.
 *
 * The form contains: comment textarea, rating (star buttons), captcha question,
 * captcha answer field, and a Submit button.
 */
export class ContactPage {
  readonly page: Page;
  readonly commentField: Locator;
  readonly ratingStars: Locator;
  readonly captchaQuestionLabel: Locator;
  readonly captchaAnswer: Locator;
  readonly submitButton: Locator;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.commentField = page.locator('#comment');
    // The rating widget is a <mat-slider id="rating"> with a nested
    // <input type="range">. Setting that input is what updates the
    // Angular form control.
    this.ratingStars = page.locator('#rating input[type="range"]');
    this.captchaQuestionLabel = page.locator('#captcha').first();
    this.captchaAnswer = page.locator('#captchaControl');
    this.submitButton = page.locator('#submitButton');
    this.confirmation = page.locator('simple-snack-bar', { hasText: /thank you|received/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/contact');
    // The captcha element is hydrated after the form renders.
    await this.captchaQuestionLabel.waitFor({ state: 'visible' });
  }

  /**
   * Reads the human-readable arithmetic captcha shown on the page (e.g. "1+2=")
   * and computes its answer. Throws if the format is unexpected so the test
   * fails fast rather than submitting garbage.
   */
  async solveCaptcha(): Promise<string> {
    const raw = (await this.captchaQuestionLabel.innerText()).trim();
    const expr = raw.replace(/=$/, '').trim();
    if (!/^[\d+\-*/() ]+$/.test(expr)) {
      throw new Error(`Unexpected captcha format: '${raw}'`);
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`'use strict'; return (${expr})`)();
    return String(result);
  }

  async setRating(stars: number): Promise<void> {
    const slider = this.ratingStars.first();
    await slider.focus();
    // Slider min=1, so reset to 1, then advance with ArrowRight to land on
    // `stars`. Keyboard interaction triggers the Angular form-control update
    // that mat-slider exposes (programmatic value writes don't).
    await slider.press('Home');
    for (let i = 1; i < stars; i++) {
      await slider.press('ArrowRight');
    }
  }

  async submitFeedback(comment: string, stars: number): Promise<void> {
    await this.commentField.fill(comment);
    await this.setRating(stars);
    const answer = await this.solveCaptcha();
    await this.captchaAnswer.fill(answer);
    await this.submitButton.click();
  }
}
