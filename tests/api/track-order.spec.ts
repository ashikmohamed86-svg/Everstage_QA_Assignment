import { test, expect } from '@playwright/test';

test.describe('Track order - API', () => {
  test(
    '[TC-API-1100] GET /rest/track-order/{id} returns a tracking record',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get('/rest/track-order/0');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);
    }
  );

  test(
    '[TC-API-1101] GET /rest/track-order/{nonexistent} still returns 200 with empty data',
    { tag: ['@everstage-qa', '@negative'] },
    async ({ request }) => {
      const response = await request.get('/rest/track-order/this-id-does-not-exist-1234567890');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);
    }
  );

  test(
    '[TC-API-1102] Track-order id with traversal characters does not crash the server',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.get('/rest/track-order/' + encodeURIComponent('../../etc/passwd'));
      // 4xx or 200 (with empty data) — anything but 5xx is fine; the server
      // must not leak filesystem contents.
      expect(response.status()).toBeLessThan(500);
      const text = await response.text();
      expect(text).not.toMatch(/root:x:0:0/);
    }
  );
});
