import { Page, Locator, expect } from '@playwright/test';

export interface CardDetails {
  name: string;
  number: string;
  month: string;
  year: string;
}

export class PaymentPage {
  readonly page: Page;
  readonly accountMenu: Locator;
  readonly ordersAndPaymentMenu: Locator;
  readonly myPaymentOptions: Locator;
  readonly addCardPanel: Locator;
  readonly nameField: Locator;
  readonly cardNumberField: Locator;
  readonly monthSelect: Locator;
  readonly yearSelect: Locator;
  readonly submitButton: Locator;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountMenu = page.locator('#navbarAccount');
    this.ordersAndPaymentMenu = page.getByRole('menuitem', { name: 'Show Orders and Payment Menu' });
    this.myPaymentOptions = page.getByRole('menuitem', { name: 'Go to saved payment methods page' });
    this.addCardPanel = page.locator('mat-expansion-panel-header', { hasText: 'Add new card' });
    this.nameField = page.getByLabel('Name', { exact: true });
    this.cardNumberField = page.getByLabel('Card Number', { exact: true });
    this.monthSelect = page.getByLabel('Expiry Month', { exact: true });
    this.yearSelect = page.getByLabel('Expiry Year', { exact: true });
    this.submitButton = page.locator('#submitButton');
    this.confirmation = page.locator('simple-snack-bar', { hasText: /card.*saved/i });
  }

  async openMyPayments(): Promise<void> {
    await this.accountMenu.click();
    await this.ordersAndPaymentMenu.click();
    await this.myPaymentOptions.click();
    await expect(this.page).toHaveURL(/saved-payment-methods/);
  }

  async expandAddCardPanel(): Promise<void> {
    if ((await this.addCardPanel.getAttribute('aria-expanded')) !== 'true') {
      await this.addCardPanel.click();
    }
  }

  async addCard(card: CardDetails): Promise<void> {
    await this.expandAddCardPanel();
    await this.nameField.fill(card.name);
    await this.cardNumberField.fill(card.number);
    await this.monthSelect.selectOption(card.month);
    await this.yearSelect.selectOption(card.year);
    await this.submitButton.click();
  }
}
