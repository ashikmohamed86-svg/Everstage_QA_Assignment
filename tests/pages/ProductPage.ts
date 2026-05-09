import { Page, Locator } from '@playwright/test';

/**
 * Product detail dialog opened by clicking a product card on the search page.
 * The dialog contains tabs for product description, reviews, and a "write a
 * review" textarea (only visible to logged-in users).
 */
export class ProductPage {
  readonly page: Page;
  readonly productCards: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;
  readonly reviewTextarea: Locator;
  readonly submitReviewButton: Locator;
  readonly reviewItems: Locator;
  readonly closeDialogButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Click the inner accessible button — the mat-card wrapper isn't itself
    // the click target in this build; the nested role="button" div is.
    this.productCards = page.locator('mat-card div[role="button"][aria-label*="Click for more information"]');
    this.dialogTitle = page.locator('mat-dialog-container h1, mat-dialog-container .mat-dialog-title, app-product-details h1');
    this.dialogDescription = page.locator('mat-dialog-container .item-detail-description, mat-dialog-container [translate]');
    // Juice Shop uses a textarea inside the dialog for reviews.
    this.reviewTextarea = page.locator('mat-dialog-container textarea').first();
    this.submitReviewButton = page.locator('mat-dialog-container #submitButton, mat-dialog-container button[aria-label="Send the review"]').first();
    this.reviewItems = page.locator('mat-dialog-container .review-text');
    this.closeDialogButton = page.locator('mat-dialog-container button[aria-label="Close Dialog"]').first();
  }

  async openFirstProduct(): Promise<void> {
    await this.productCards.first().waitFor({ state: 'visible' });
    await this.productCards.first().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async writeReview(text: string): Promise<void> {
    await this.reviewTextarea.fill(text);
    await this.submitReviewButton.click();
  }

  async closeDialog(): Promise<void> {
    await this.closeDialogButton.click();
  }
}
