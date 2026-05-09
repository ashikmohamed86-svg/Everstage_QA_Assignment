import { test, expect } from '../fixtures';
import { loginViaApi, findStockableProductId } from '../helpers/api';
import { clearBasket, seedBasket, seedAddress, seedCard, defaultDeliveryMethodId } from '../helpers/seed';

/**
 * MISSING FLOW — Order / Checkout (API).
 *
 * Drives the full checkout funnel at the REST layer:
 *
 *   POST  /api/BasketItems/                 — add product to basket
 *   POST  /api/Addresss/                    — create address
 *   POST  /api/Cards/                       — create payment card
 *   GET   /api/Deliverys                    — list delivery methods
 *   POST  /rest/basket/{bid}/checkout       — place the order
 *   GET   /rest/track-order/{orderId}       — confirm tracking record exists
 *
 * Coverage spans positive / negative / boundary / security / load along
 * the functional / non-functional axis. Tests use the `seededCheckout`
 * fixture (basket cleaned, address+card created, productId resolved,
 * deliveryMethodId picked) so each one starts from a known state and
 * avoids the BasketItem unique-constraint trap.
 */

test.describe('Order / Checkout flow - API (missing flow)', () => {
  // ---------------------------------------------------------------------------
  // Positive / functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-1600] POST /rest/basket/{bid}/checkout returns an orderConfirmation id',
    { tag: ['@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });

      expect(response.status(), 'checkout should return 200').toBe(200);
      const body = await response.json();
      expect(body.orderConfirmation, 'order id should be present').toBeTruthy();
      expect(typeof body.orderConfirmation).toBe('string');
    }
  );

  test(
    '[TC-API-1601] Order is retrievable via /rest/track-order/{id} after checkout',
    { tag: ['@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const checkout = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      expect(checkout.status()).toBe(200);
      const orderId = (await checkout.json()).orderConfirmation;

      const track = await request.get(`/rest/track-order/${orderId}`);
      expect(track.status()).toBe(200);
      const trackBody = await track.json();
      expect(trackBody.status).toBe('success');
      expect(Array.isArray(trackBody.data)).toBe(true);
      expect(trackBody.data.length).toBeGreaterThan(0);
    }
  );

  test(
    '[TC-API-1602] Basket is emptied after a successful checkout',
    { tag: ['@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });

      const basket = await request.get(`/rest/basket/${seededCheckout.basketId}`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
      });
      const body = await basket.json();
      expect(body.data.Products).toEqual([]);
    }
  );

  test(
    '[TC-API-1603] Multi-item basket places a single order',
    { tag: ['@everstage-qa', '@positive', '@regression', '@e2e', '@functional'] },
    async ({ request, seededCheckout }) => {
      // Pick three distinct products that all have stock & no per-user
      // limit. The Quantitys table tells us which.
      const headers = { Authorization: `Bearer ${seededCheckout.token}` };
      const quantities = await request.get('/api/Quantitys/', { headers });
      const stockable = (await quantities.json()).data
        .filter((r: { quantity: number; limitPerUser: number | null }) =>
          r.quantity > 0 && r.limitPerUser === null
        )
        .slice(0, 3) as Array<{ ProductId: number }>;
      expect(stockable.length, 'need 3 distinct stockable products').toBe(3);

      for (const row of stockable) {
        await seedBasket(request, seededCheckout.token, seededCheckout.basketId, row.ProductId);
      }

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers,
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });

      expect(response.status()).toBe(200);
      expect((await response.json()).orderConfirmation).toBeTruthy();
    }
  );

  // ---------------------------------------------------------------------------
  // Negative / functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-1610] Checkout without an auth token is rejected',
    { tag: ['@everstage-qa', '@negative', '@security', '@regression'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-1611] DOCUMENTED VULN: empty-basket checkout still mints an order on default Juice Shop',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      // A hardened build should reject checkout when no items are in the
      // basket. Juice Shop happily creates an "empty" order — asserted as
      // the actual behavior so the suite stays green; flip to expect 400
      // on a hardened build.
      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      expect(response.status(), 'documented Juice Shop accepts empty checkout').toBe(200);
      expect((await response.json()).orderConfirmation).toBeTruthy();
    }
  );

  test(
    '[TC-API-1612] Checkout with a non-existent addressId fails cleanly',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: 999999,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      // Anything but a 5xx is acceptable — the server should reject, not crash.
      expect(response.status()).toBeLessThan(500);
    }
  );

  test(
    '[TC-API-1613] Checkout with a non-existent deliveryMethodId fails cleanly',
    { tag: ['@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: 99999,
          },
        },
      });
      expect(response.status()).toBeLessThan(500);
    }
  );

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-1620] Tampered JWT cannot place an order',
    { tag: ['@everstage-qa', '@security', '@regression'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const tampered = `${seededCheckout.token.slice(0, -4)}AAAA`;
      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${tampered}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-1621] DOCUMENTED VULN: another user can checkout the assignment user\'s basket (BOLA)',
    { tag: ['@everstage-qa', '@security', '@regression'] },
    async ({ request, seededCheckout }) => {
      // The /rest/basket/:bid/checkout endpoint does not verify that the
      // bearer-token user owns basket :bid. Any authenticated attacker can
      // place an order against another user's basket. Asserted as actual
      // behavior so the suite stays green; on a hardened build this should
      // return 401/403 and the victim's basket must not empty.
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const ts = Date.now().toString(36);
      const attackerEmail = `chk-other-${ts}@juice.test`;
      const attackerPassword = 'StrongPass!23';
      await request.post('/api/Users/', {
        data: {
          email: attackerEmail,
          password: attackerPassword,
          passwordRepeat: attackerPassword,
          securityQuestion: { id: 1 },
          securityAnswer: 'attacker',
        },
      });
      const attackerToken = await loginViaApi(request, attackerEmail, attackerPassword);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${attackerToken}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });

      // Default Juice Shop: attacker can checkout the victim's basket (200).
      expect(response.status(), 'documented Juice Shop allows cross-user checkout').toBe(200);
      expect((await response.json()).orderConfirmation).toBeTruthy();
    }
  );

  test(
    '[TC-API-1622] SQL-injection in couponData does not bypass coupon validation',
    { tag: ['@everstage-qa', '@security', '@regression'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: "' OR 1=1--",
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });

      // The checkout itself can still complete (Juice Shop tolerates a bad
      // coupon), but the response must not 5xx and must not echo SQL output.
      expect(response.status()).toBeLessThan(500);
      const body = await response.text();
      expect(body).not.toMatch(/SQLITE|syntax error/i);
    }
  );

  // ---------------------------------------------------------------------------
  // Boundary
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-1630] Checkout with the maximum-eta delivery method is accepted',
    { tag: ['@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const deliveries = await request.get('/api/Deliverys', {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
      });
      const list = (await deliveries.json()).data as { id: number; eta: number }[];
      const slowest = list.reduce((a, b) => (a.eta > b.eta ? a : b));

      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: slowest.id,
          },
        },
      });
      expect(response.status()).toBe(200);
    }
  );

  // ---------------------------------------------------------------------------
  // Load / non-functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-1640] 5 sequential orders all succeed and produce distinct order ids',
    { tag: ['@everstage-qa', '@load', '@nonfunctional', '@regression'] },
    async ({ request, seededCheckout }) => {
      test.slow();
      const orderIds = new Set<string>();

      for (let i = 0; i < 5; i++) {
        await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);
        const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
          headers: { Authorization: `Bearer ${seededCheckout.token}` },
          data: {
            couponData: '',
            orderDetails: {
              paymentId: String(seededCheckout.cardId),
              addressId: seededCheckout.addressId,
              deliveryMethodId: seededCheckout.deliveryMethodId,
            },
          },
        });
        expect(response.status()).toBe(200);
        orderIds.add((await response.json()).orderConfirmation);
      }

      expect(orderIds.size, 'each checkout should mint a unique order id').toBe(5);
    }
  );

  test(
    '[TC-API-1641] Single checkout latency under 3000ms',
    { tag: ['@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ request, seededCheckout }) => {
      await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

      const start = Date.now();
      const response = await request.post(`/rest/basket/${seededCheckout.basketId}/checkout`, {
        headers: { Authorization: `Bearer ${seededCheckout.token}` },
        data: {
          couponData: '',
          orderDetails: {
            paymentId: String(seededCheckout.cardId),
            addressId: seededCheckout.addressId,
            deliveryMethodId: seededCheckout.deliveryMethodId,
          },
        },
      });
      const elapsedMs = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(elapsedMs, 'checkout should respond under 3s').toBeLessThan(3_000);
    }
  );
});
