import { test as base, expect, Page, BrowserContext, APIRequestContext } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { suppressBanners } from './helpers/banners';
import { loginSession, LoginSession, findStockableProductId } from './helpers/api';
import {
  clearBasket,
  seedAddress,
  seedCard,
  defaultDeliveryMethodId,
} from './helpers/seed';
import user from './data/new-user.json';

/**
 * Custom Playwright fixtures.
 *
 * The assignment runs the same login + seed boilerplate for nearly every
 * test. Encoding it as fixtures means specs declare what they need
 * (a session token, a logged-in page, a fully-seeded checkout) instead
 * of repeating the recipe. Playwright instantiates each fixture lazily
 * — a test that doesn't ask for `seededCheckout` doesn't pay for it.
 *
 *   apiSession        — REST login: returns { token, bid, email }
 *   authenticatedPage — UI login: navbarAccount visible, banners gone
 *   seededCheckout    — apiSession + clean basket + 1 address + 1 card +
 *                       a stockable productId + the default deliveryMethodId
 */
export interface SeededCheckout {
  token: string;
  basketId: number;
  addressId: number;
  cardId: number;
  productId: number;
  deliveryMethodId: number;
}

interface CustomFixtures {
  apiSession: LoginSession;
  authenticatedPage: Page;
  seededCheckout: SeededCheckout;
}

export const test = base.extend<CustomFixtures>({
  apiSession: async ({ request }, use) => {
    const session = await loginSession(request, user.email, user.password);
    await use(session);
  },

  authenticatedPage: async ({ page, context }, use) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.attemptLogin(user.email, user.password);
    await expect(page, 'login should leave /login').not.toHaveURL(/login/);
    await expect(page.locator('#navbarAccount'), 'navbar account icon should render').toBeVisible();
    await use(page);
  },

  seededCheckout: async ({ request, apiSession }, use) => {
    await clearBasket(request, apiSession.token, apiSession.bid);
    const [addressId, cardId, productId, deliveryMethodId] = await Promise.all([
      seedAddress(request, apiSession.token),
      seedCard(request, apiSession.token),
      findStockableProductId(request, apiSession.token),
      defaultDeliveryMethodId(request, apiSession.token),
    ]);
    await use({
      token: apiSession.token,
      basketId: apiSession.bid,
      addressId,
      cardId,
      productId,
      deliveryMethodId,
    });
  },
});

export { expect } from '@playwright/test';
export type { Page, BrowserContext, APIRequestContext };
