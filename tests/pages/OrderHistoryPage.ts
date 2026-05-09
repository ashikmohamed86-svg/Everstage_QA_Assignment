import { Page, Locator, expect } from '@playwright/test';

/**
 * Order history page at `/#/order-history`. Reached via:
 *
 *   navbarAccount → "Show Orders and Payment Menu" → "Go to order history page"
 *
 * Each placed order renders as one `mat-row` / `tr.mat-row`.
 */
export class OrderHistoryPage {
  readonly page: Page;
  readonly accountMenu: Locator;
  readonly ordersAndPaymentMenu: Locator;
  readonly orderHistoryMenu: Locator;
  readonly rows: Locator;
  readonly firstRow: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountMenu = page.locator('#navbarAccount');
    this.ordersAndPaymentMenu = page.getByRole('menuitem', {
      name: /show orders and payment menu/i,
    });
    this.orderHistoryMenu = page.getByRole('menuitem', { name: /go to order history page/i });
    this.rows = page.locator('mat-row, tr.mat-row');
    this.firstRow = this.rows.first();
  }

  /** Navigates to /#/order-history via the account menu. */
  async openFromAccountMenu(): Promise<void> {
    await this.accountMenu.click();
    await this.ordersAndPaymentMenu.click();
    await this.orderHistoryMenu.click();
    await expect(this.page).toHaveURL(/order-history/);
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/order-history');
    await expect(this.page).toHaveURL(/order-history/);
  }

  async rowCount(): Promise<number> {
    return await this.rows.count();
  }
}
