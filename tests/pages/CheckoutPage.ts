import { Page, Locator, expect } from '@playwright/test';

/**
 * Drives the multi-step checkout flow:
 *
 *   /#/basket  →  /#/address/select  →  /#/delivery-method
 *              →  /#/payment/shop   →  /#/order-summary  →  /#/order-completion/{id}
 *
 * Selectors anchor on each "Continue" button's aria-label, which Juice
 * Shop sets per step and which is more stable than the auto-generated
 * Material element ids:
 *
 *   - Address page  → "Proceed to payment selection"
 *   - Delivery page → "Proceed to delivery method selection" (sic; goes to payment)
 *   - Payment page  → "Proceed to review"
 *   - Summary page  → "#checkoutButton" (place order)
 */
export class CheckoutPage {
  readonly page: Page;
  readonly checkoutButton: Locator;
  readonly addressRadios: Locator;
  readonly addressContinueButton: Locator;
  readonly deliveryRadios: Locator;
  readonly deliveryContinueButton: Locator;
  readonly cardRadios: Locator;
  readonly paymentContinueButton: Locator;
  readonly placeOrderButton: Locator;
  readonly thankYouMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkoutButton = page.locator('#checkoutButton');

    this.addressRadios = page.locator('mat-radio-button');
    this.addressContinueButton = page.locator('button[aria-label="Proceed to payment selection"]');

    this.deliveryRadios = page.locator('mat-radio-button');
    this.deliveryContinueButton = page.locator(
      'button[aria-label="Proceed to delivery method selection"]'
    );

    this.cardRadios = page.locator('mat-radio-button');
    this.paymentContinueButton = page.locator('button[aria-label="Proceed to review"]');

    this.placeOrderButton = page.locator('#checkoutButton');
    this.thankYouMessage = page.getByText(/thank you for your purchase/i).first();
  }

  async openBasket(): Promise<void> {
    await this.page.locator('button[aria-label="Show the shopping cart"]').click();
    await expect(this.page).toHaveURL(/basket/);
  }

  async checkoutFromBasket(): Promise<void> {
    await this.checkoutButton.click();
    await expect(this.page).toHaveURL(/address\/select/);
  }

  async selectFirstAddress(): Promise<void> {
    await this.addressRadios.first().click();
    await expect(this.addressContinueButton).toBeEnabled();
    await this.addressContinueButton.click();
    await expect(this.page).toHaveURL(/delivery-method/);
  }

  async selectFirstDelivery(): Promise<void> {
    await this.deliveryRadios.first().click();
    await expect(this.deliveryContinueButton).toBeEnabled();
    await this.deliveryContinueButton.click();
    await expect(this.page).toHaveURL(/payment/);
  }

  async selectFirstCard(): Promise<void> {
    // The "Other Payment Options" panel contains the card radios — expand it
    // if it isn't already.
    const cardPanel = this.page.locator('mat-expansion-panel-header', {
      hasText: /other payment options/i,
    });
    if (await cardPanel.count()) {
      const expanded = await cardPanel.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await cardPanel.first().click();
    }

    // Wait for the radio list to render before clicking the first one.
    await this.cardRadios.first().waitFor({ state: 'visible' });
    await this.cardRadios.first().click();
    await expect(this.paymentContinueButton).toBeEnabled();
    await this.paymentContinueButton.click();
    await expect(this.page).toHaveURL(/order-summary/);
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
    await expect(this.page).toHaveURL(/order-completion/);
  }
}
