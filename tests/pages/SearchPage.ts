import { Page, Locator } from '@playwright/test';

/**
 * Top-level search.
 *
 * The most reliable path is to drive the URL directly: /#/search?q=apple — that
 * is what the in-page search bar does on submit, and it works across builds.
 * We do NOT wait for `networkidle` because Juice Shop's SPA fires periodic
 * background requests that prevent it from ever settling.
 */
export class SearchPage {
  readonly page: Page;
  readonly productCards: Locator;
  readonly noResultsMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productCards = page.locator('mat-card');
    this.noResultsMessage = page.getByText(/no results found/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/search');
  }

  async search(term: string): Promise<void> {
    if (term === '') {
      await this.page.goto('/#/search');
    } else {
      await this.page.goto(`/#/search?q=${encodeURIComponent(term)}`);
    }
  }

  async productCardCount(): Promise<number> {
    return this.productCards.count();
  }
}
