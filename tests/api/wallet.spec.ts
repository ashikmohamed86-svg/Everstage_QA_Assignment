import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Wallet - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test(
    '[TC-API-700] GET /rest/wallet/balance returns the user balance',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get('/rest/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(typeof body.data).toBe('number');
      expect(body.data).toBeGreaterThanOrEqual(0);
    }
  );

  test(
    '[TC-API-701] GET /rest/wallet/balance without auth is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.get('/rest/wallet/balance');
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-702] GET /rest/wallet/balance with tampered JWT is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const tampered = `${token.slice(0, -4)}AAAA`;
      const response = await request.get('/rest/wallet/balance', {
        headers: { Authorization: `Bearer ${tampered}` },
      });
      expect(response.status()).toBe(401);
    }
  );
});
