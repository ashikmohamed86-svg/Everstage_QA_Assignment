import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ContactPage } from '../pages/ContactPage';
import { suppressBanners } from '../helpers/banners';
import user from '../data/new-user.json';

test.describe('Customer Feedback - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.password);
  });

  test('[TC-UI-900] User can submit feedback with comment, rating, and captcha', async ({ page }) => {
    const contact = new ContactPage(page);
    await contact.goto();
    await contact.submitFeedback('Loved the app!', 5);

    await expect(contact.confirmation).toBeVisible({ timeout: 10000 });
  });

  test('[TC-UI-901] Comment max length is enforced at 160 chars', async ({ page }) => {
    const contact = new ContactPage(page);
    await contact.goto();
    await contact.commentField.fill('x'.repeat(200));

    // Either the input is capped at maxlength=160 or a mat-error/mat-hint shows the limit.
    const value = await contact.commentField.inputValue();
    const hasLimitMsg = await page
      .locator('mat-error, mat-hint', { hasText: /160/i })
      .isVisible()
      .catch(() => false);

    expect(value.length <= 160 || hasLimitMsg).toBe(true);
  });

  test('[TC-UI-902] Submit disabled when no rating is selected', async ({ page }) => {
    const contact = new ContactPage(page);
    await contact.goto();
    await contact.commentField.fill('Some feedback without a rating');
    const answer = await contact.solveCaptcha();
    await contact.captchaAnswer.fill(answer);

    await expect(contact.submitButton).toBeDisabled();
  });

  test('[TC-UI-903] Wrong captcha answer is rejected', async ({ page }) => {
    const contact = new ContactPage(page);
    await contact.goto();
    await contact.commentField.fill('Captcha negative test');
    await contact.setRating(4);
    await contact.captchaAnswer.fill('99999');

    // Juice Shop validates the captcha client-side: if the answer is wrong,
    // the Submit button stays disabled. If the build allows submission, the
    // server replies with an error snackbar. Either outcome means the wrong
    // captcha was rejected — which is the contract we care about.
    if (await contact.submitButton.isDisabled()) {
      // Pass: client-side validation prevents submission.
      return;
    }
    await contact.submitButton.click();
    await expect(
      page.locator('simple-snack-bar', { hasText: /wrong|invalid|tried/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
