import { Page, Locator, expect } from '@playwright/test';

/**
 * Basket / cart at /#/basket.
 * Add-to-basket happens from the search/landing page on each product card.
 */
export class BasketPage {
  readonly page: Page;
  readonly basketRows: Locator;
  readonly checkoutButton: Locator;
  readonly emptyBasketMessage: Locator;
  readonly addToBasketButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.basketRows = page.locator('mat-row, tr.mat-row');
    this.checkoutButton = page.locator('#checkoutButton');
    this.emptyBasketMessage = page.getByText(/your basket is empty/i);
    this.addToBasketButtons = page.locator('button[aria-label="Add to Basket"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/basket');
  }

  async openFromHeader(): Promise<void> {
    await this.page.locator('button[aria-label="Show the shopping cart"]').click();
    await expect(this.page).toHaveURL(/basket/);
  }

  /**
   * Adds a stockable product card to the basket. Resolves a product with
   * `quantity > 0` and no per-user purchase cap by querying
   * `/api/Quantitys/` + `/api/Products/`, then clicks that product's card
   * by its accessible name. This avoids the brittle "click index 0" or
   * "click index 1" approach — Juice Shop's first few products
   * (Apple Juice, Orange Juice, Eggfruit Juice) drain to zero across many
   * test runs and clicking them surfaces an out-of-stock snackbar rather
   * than a successful add. Returns the success snackbar locator so the
   * caller can await it before continuing.
   */
  async addFirstProductToBasket(): Promise<Locator> {
    // Resolve a product that is BOTH:
    //   1. orderable (`quantity > 0` and `limitPerUser === null`), and
    //   2. visible on page 1 of the home grid.
    //
    // The home grid sorts alphabetically, so we replicate that sort and
    // restrict to the first 12 entries. Without this, the helper happily
    // picks (say) Raspberry Juice — which is fine API-wise but lives on
    // page 2 of the grid, so the click locator never resolves.
    const [productsRes, quantitiesRes] = await Promise.all([
      this.page.request.get('/api/Products/'),
      this.page.request.get('/api/Quantitys/'),
    ]);
    const products = (await productsRes.json()).data as Array<{ id: number; name: string }>;
    const quantities = (await quantitiesRes.json()).data as Array<{
      ProductId: number;
      quantity: number;
      limitPerUser: number | null;
    }>;
    const qById = new Map(quantities.map((q) => [q.ProductId, q]));

    // Prefer products with plenty of stock — the increment test in
    // tests/ui/basket.spec.ts needs to bump quantity from 1 to 2, which
    // is blocked if the picked product only has 1 unit left.
    const grid = [...products].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
    const candidates = grid.filter((p) => {
      const q = qById.get(p.id);
      return q && q.quantity > 5 && q.limitPerUser === null;
    });
    candidates.sort((a, b) => (qById.get(b.id)!.quantity - qById.get(a.id)!.quantity));
    const target = candidates[0] ?? grid.find((p) => {
      const q = qById.get(p.id);
      return q && q.quantity > 0 && q.limitPerUser === null;
    });
    if (!target) {
      throw new Error('No stockable product on page 1 of the grid — every entry is drained or capped');
    }

    const card = this.page.locator('mat-card', { hasText: target.name }).first();
    await card.locator('button[aria-label="Add to Basket"]').click();

    return this.page.locator('simple-snack-bar', { hasText: /placed|added/i });
  }

  async incrementFirstRow(): Promise<void> {
    // Quantity buttons in this Juice Shop build expose only their SVG icon —
    // no aria-label — so we anchor on the FontAwesome data-icon.
    await this.basketRows.first()
      .locator('button:has(svg[data-icon="plus-square"])')
      .click();
  }

  async decrementFirstRow(): Promise<void> {
    await this.basketRows.first()
      .locator('button:has(svg[data-icon="minus-square"])')
      .click();
  }

  async deleteFirstRow(): Promise<void> {
    await this.page
      .locator('button[aria-label="Remove from Basket"], button[aria-label*="Remove"]')
      .first()
      .click();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
