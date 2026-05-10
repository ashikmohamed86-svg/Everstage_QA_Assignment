import { test, expect } from '../fixtures';
import { CheckoutPage } from '../pages/CheckoutPage';
import { BasketPage } from '../pages/BasketPage';
import { OrderHistoryPage } from '../pages/OrderHistoryPage';
import { seedBasket } from '../helpers/seed';
import { findStockableProductId } from '../helpers/api';

/**
 * MISSING FLOW — Order / Checkout (UI).
 *
 * The pre-existing suite covered basket, address book, and saved cards
 * individually but never connected them through the checkout funnel.
 * This file exercises the full UX:
 *
 *     login → basket → address → delivery → payment → order summary
 *           → place order → order confirmation
 *
 * Tests use two fixtures from `tests/fixtures.ts`:
 *
 *   - `authenticatedPage` — page already logged in as the assignment user
 *     (banners suppressed, navbar visible).
 *   - `seededCheckout`    — backend state already seeded: empty basket,
 *     fresh address + card, a stockable productId, and the default
 *     deliveryMethodId — so each test only exercises the checkout funnel
 *     itself, not the per-test plumbing around it.
 */

test.describe('Order / Checkout flow - UI (missing flow)', () => {
  // ---------------------------------------------------------------------------
  // Positive / functional / e2e
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-700] End-to-end order: basket → address → delivery → payment → place order',
    { tag: ['@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ authenticatedPage: page, request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const checkout = new CheckoutPage(page);
      await page.goto('/#/basket');
      await expect(page).toHaveURL(/basket/);

      await checkout.checkoutFromBasket();
      await checkout.selectFirstAddress();
      await checkout.selectFirstDelivery();
      await checkout.selectFirstCard();
      await checkout.placeOrder();

      await expect(page).toHaveURL(/order-completion/);
      await expect(page.getByText(/thank you for your purchase/i).first()).toBeVisible();
    }
  );

  test(
    '[TC-UI-701] Order confirmation surfaces a non-empty order id',
    { tag: ['@everstage-qa', '@positive', '@regression', '@e2e', '@functional'] },
    async ({ authenticatedPage: page, request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const checkout = new CheckoutPage(page);
      await page.goto('/#/basket');
      await checkout.checkoutFromBasket();
      await checkout.selectFirstAddress();
      await checkout.selectFirstDelivery();
      await checkout.selectFirstCard();
      await checkout.placeOrder();

      const url = new URL(page.url());
      const orderId = url.hash.split('/').pop();
      expect(orderId, 'order id segment should be non-empty').toBeTruthy();
      expect(orderId!.length).toBeGreaterThan(4);
    }
  );

  test(
    '[TC-UI-702] Placed order shows up in the user\'s order history',
    { tag: ['@everstage-qa', '@positive', '@regression', '@e2e', '@functional'] },
    async ({ authenticatedPage: page, request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const checkout = new CheckoutPage(page);
      await page.goto('/#/basket');
      await checkout.checkoutFromBasket();
      await checkout.selectFirstAddress();
      await checkout.selectFirstDelivery();
      await checkout.selectFirstCard();
      await checkout.placeOrder();

      const orderHistory = new OrderHistoryPage(page);
      await orderHistory.openFromAccountMenu();
      await expect(orderHistory.firstRow).toBeVisible();
    }
  );

  // ---------------------------------------------------------------------------
  // Negative / functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-710] Checkout button is unreachable when the basket is empty',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ authenticatedPage: page }) => {
      const basket = new BasketPage(page);
      await basket.goto();

      // Either no checkout button is rendered, or it is disabled. Both are
      // acceptable; an enabled checkout on an empty basket is NOT.
      const checkoutBtn = page.locator('#checkoutButton');
      if (await checkoutBtn.count()) {
        await expect(checkoutBtn).toBeDisabled();
      } else {
        await expect(basket.emptyBasketMessage).toBeVisible();
      }
    }
  );

  test(
    '[TC-UI-711] DOCUMENTED UX: address selection is reset when navigating back from delivery',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ authenticatedPage: page, request, seededCheckout }) => {
      // Juice Shop does NOT persist the address radio selection across a
      // browser-back from /delivery-method to /address/select. The user
      // has to pick again. Asserted as the actual behavior; a hardened
      // build should preserve selection so this test would flip to
      // expecting a checked radio.
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const checkout = new CheckoutPage(page);
      await page.goto('/#/basket');
      await checkout.checkoutFromBasket();
      await checkout.selectFirstAddress();
      await expect(page).toHaveURL(/delivery-method/);

      await page.goBack();
      await expect(page).toHaveURL(/address\/select/);

      const checkedRadios = page.locator(
        'mat-radio-button.mat-mdc-radio-checked, mat-radio-button[aria-checked="true"]'
      );
      await expect(checkedRadios).toHaveCount(0);
      await expect(checkout.addressContinueButton).toBeDisabled();
    }
  );

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-720] DOCUMENTED VULN: /address/select is reachable without auth on default Juice Shop',
    { tag: ['@everstage-qa', '@security', '@regression'] },
    async ({ authenticatedPage: page }) => {
      // A hardened build should redirect unauthenticated users to /#/login
      // when they hit checkout-protected routes. Juice Shop renders the
      // /address/select page anyway. Asserted as actual behavior; flip to
      // expect /login on a hardened build.
      await page.locator('#navbarAccount').click();
      await page.locator('#navbarLogoutButton').click();

      await page.goto('/#/address/select');
      await expect(page).toHaveURL(/address\/select/);
    }
  );

  test(
    '[TC-UI-721] Direct navigation to /order-completion/<random> does not reveal another user\'s order',
    { tag: ['@everstage-qa', '@security', '@regression'] },
    async ({ authenticatedPage: page }) => {
      await page.goto('/#/order-completion/this-is-not-a-real-order-id');
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/Apple Juice|Banana Juice|paymentId/i);
    }
  );

  // ---------------------------------------------------------------------------
  // Boundary
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-730] Place an order with a high-quantity basket (3 of one item)',
    { tag: ['@everstage-qa', '@boundary', '@regression', '@e2e'] },
    async ({ authenticatedPage: page, request, seededCheckout }) => {
      // The default seededCheckout.productId is picked with quantity >= 1.
      // For this boundary test we need >= 3 in stock — Juice Shop's inventory
      // depletes across runs (no replenishment endpoint), so the default
      // first-stockable product is often down to 1 by the time we get here.
      // See TC-UI-740 (DOCUMENTED UX) for the underlying finding.
      const productId = await findStockableProductId(request, seededCheckout.token, 3);
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, productId, 3);

      const checkout = new CheckoutPage(page);
      await page.goto('/#/basket');
      await checkout.checkoutFromBasket();
      await checkout.selectFirstAddress();
      await checkout.selectFirstDelivery();
      await checkout.selectFirstCard();
      await checkout.placeOrder();

      await expect(page).toHaveURL(/order-completion/);
    }
  );

  test(
    '[TC-UI-740] DOCUMENTED UX: Juice Shop inventory depletes across test runs with no replenishment endpoint',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      // Probe: ask for the first-in-stock product, then ask for a product
      // with quantity >= 100. The first call always succeeds (some product
      // is in stock); the second call may fail on a heavily-used Juice Shop
      // database. Either way, this test asserts the *shape* — Juice Shop
      // exposes /api/Quantitys/ but no /api/Quantitys/replenish.
      const stockable = await findStockableProductId(request, seededCheckout.token, 1);
      expect(typeof stockable).toBe('number');

      const replenish = await request.post('/api/Quantitys/replenish', {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: { ProductId: stockable, quantity: 999 },
      });
      // Hardened build: the route is missing → 404. Default Juice Shop
      // returns 500 ("Unexpected path"). Either is acceptable for asserting
      // "no replenishment API exists". What's NOT acceptable is 200/201.
      expect(replenish.status(), 'no replenishment endpoint should exist').not.toBe(200);
      expect(replenish.status(), 'no replenishment endpoint should exist').not.toBe(201);
    }
  );
});
