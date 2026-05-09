import { test, expect } from '@playwright/test';
import { loginSession, findStockableProductId } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Basket - API', () => {
  let token: string;
  let basketId: number;

  test.beforeEach(async ({ request }) => {
    // /rest/user/whoami is cookie-authenticated, so it returns no user when
    // called with only a bearer token. The login response already contains
    // the basket id (`bid`) — read it from there.
    const session = await loginSession(request, user.email, user.password);
    token = session.token;
    basketId = session.bid;

    // The unique (ProductId, BasketId) constraint on BasketItems means a
    // duplicate add returns 500. Clear the basket up front so each test
    // starts from a known empty state.
    const headers = { Authorization: `Bearer ${token}` };
    const basket = await request.get(`/rest/basket/${basketId}`, { headers });
    const products = (await basket.json()).data?.Products ?? [];
    for (const product of products) {
      const itemId = product.BasketItem?.id;
      if (itemId) await request.delete(`/api/BasketItems/${itemId}`, { headers });
    }
  });

  test('[TC-API-500] GET /rest/basket/{id} returns the user\'s basket', async ({ request }) => {
    const bid = basketId;

    const response = await request.get(`/rest/basket/${bid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Juice Shop returns either { data: { Products } } or { data: [...] }
    // depending on build. Both are acceptable shapes; we just check the
    // request succeeded with a payload.
    expect(body.data ?? body).toBeDefined();
  });

  test('[TC-API-501] POST /api/BasketItems adds an item', async ({ request }) => {
    const bid = basketId;
    // Pick a product that's currently in stock and has no per-user
    // purchase cap — Apple Juice gets drained to zero across many runs
    // and even Apple Pomace can hit a wall once order-flow tests place
    // multi-item baskets against it.
    const productId = await findStockableProductId(request, token);

    const response = await request.post('/api/BasketItems/', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ProductId: productId, BasketId: bid, quantity: 1 },
    });

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.status).toBe('success');
    expect(body.data.ProductId).toBe(productId);
  });

  test('[TC-API-502] Adding a basket item without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/BasketItems/', {
      data: { ProductId: 1, BasketId: 1, quantity: 1 },
    });
    expect(response.status()).toBe(401);
  });

  test('[TC-API-503] DOCUMENTED VULN: zero-quantity basket item is accepted', async ({
    request,
  }) => {
    // Juice Shop accepts quantity=0 (and creates the row) — a validation
    // gap. Asserted as the actual behavior; a hardened build should reject.
    // We pick a product with stock + no per-user limit so the assertion
    // observes the validation gap, not an unrelated out-of-stock 400.
    const bid = basketId;
    const productId = await findStockableProductId(request, token);
    const response = await request.post('/api/BasketItems/', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ProductId: productId, BasketId: bid, quantity: 0 },
    });
    expect([200, 201]).toContain(response.status());
  });

  test('[TC-API-504] DOCUMENTED VULN: negative-quantity basket item is accepted', async ({
    request,
  }) => {
    // Juice Shop accepts quantity=-5 — a validation gap. We pick a
    // different stockable product than TC-API-503 to dodge the
    // (ProductId, BasketId) unique constraint if both tests run within
    // the same beforeEach window.
    const bid = basketId;
    const headers = { Authorization: `Bearer ${token}` };
    const quantities = await request.get('/api/Quantitys/', { headers });
    const list = (await quantities.json()).data as Array<{
      ProductId: number;
      quantity: number;
      limitPerUser: number | null;
    }>;
    const stockable = list.filter(
      (r) => r.quantity > 0 && r.limitPerUser === null
    );
    expect(stockable.length, 'need at least 2 stockable products').toBeGreaterThanOrEqual(2);
    const productId = stockable[1].ProductId;

    const response = await request.post('/api/BasketItems/', {
      headers,
      data: { ProductId: productId, BasketId: bid, quantity: -5 },
    });
    expect([200, 201]).toContain(response.status());
  });
});
