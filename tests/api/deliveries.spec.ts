import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Delivery methods - API', () => {
  test(
    '[TC-API-1000] GET /api/Deliverys returns the catalog of delivery methods',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const token = await loginViaApi(request, user.email, user.password);
      const response = await request.get('/api/Deliverys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);

      for (const method of body.data) {
        expect(method).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          price: expect.any(Number),
          eta: expect.any(Number),
        });
      }

      const names = body.data.map((d: { name: string }) => d.name.toLowerCase());
      expect(names.some((n: string) => n.includes('day'))).toBe(true);
    }
  );

  test(
    '[TC-API-1001] DOCUMENTED VULN: GET /api/Deliverys is reachable without authentication',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // Delivery method catalog is exposed without an auth token on default
      // Juice Shop. Treated as low severity (catalog data, no PII) but
      // documented so a hardened build can flip the assertion to expect 401.
      const response = await request.get('/api/Deliverys');
      expect(response.status()).toBe(200);
    }
  );
});
