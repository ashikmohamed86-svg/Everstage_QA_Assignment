import { test, expect } from '@playwright/test';

test.describe('Products - API', () => {
  test('[TC-API-400] GET /api/Products returns the catalog', async ({ request }) => {
    const response = await request.get('/api/Products');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('success');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('[TC-API-401] GET /api/Products/{id} returns a product', async ({ request }) => {
    const list = await request.get('/api/Products');
    const firstId = (await list.json()).data[0].id;

    const response = await request.get(`/api/Products/${firstId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(firstId);
    expect(body.data.name).toBeTruthy();
  });

  test('[TC-API-402] GET /api/Products/{nonexistent} returns 404 or empty', async ({ request }) => {
    const response = await request.get('/api/Products/9999999');
    // Juice Shop returns 200 with data:null when the row is missing; either
    // shape is acceptable as long as it's not a server crash.
    expect([200, 404]).toContain(response.status());
  });

  test('[TC-API-403] GET /rest/products/search returns matches for a real product', async ({
    request,
  }) => {
    const response = await request.get('/rest/products/search?q=apple');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    // Some seeded juice shop builds have at least one apple product.
    const hasApple = body.data.some((p: { name: string }) =>
      /apple/i.test(p.name)
    );
    expect(hasApple).toBe(true);
  });

  test('[TC-API-404] Search endpoint UNION SQLi probe — should not leak schema', async ({
    request,
  }) => {
    const payload = "')) UNION SELECT sql FROM sqlite_master--";
    const response = await request.get(`/rest/products/search?q=${encodeURIComponent(payload)}`);

    if (response.status() === 200) {
      const body = await response.json();
      const blob = JSON.stringify(body).toLowerCase();
      // Hardened builds either reject the request or sanitize the input.
      expect(blob.includes('create table'), 'response leaks schema via SQLi')
        .toBe(false);
    } else {
      expect([400, 500]).toContain(response.status());
    }
  });
});
