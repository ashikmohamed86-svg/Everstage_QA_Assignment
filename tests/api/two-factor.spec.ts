import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Two-factor authentication - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test(
    '[TC-API-1200] GET /rest/2fa/status returns setup state for the user',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get('/rest/2fa/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(typeof body.setup).toBe('boolean');
      expect(body.email).toBe(user.email);
      // Setup-token + secret are issued so the user can enrol from the UI.
      expect(typeof body.secret).toBe('string');
      expect(typeof body.setupToken).toBe('string');
    }
  );

  test(
    '[TC-API-1201] POST /rest/2fa/setup with a tampered initialToken is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.post('/rest/2fa/setup', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          password: user.password,
          setupToken: 'not-a-real-token',
          initialToken: '000000',
        },
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-1202] GET /rest/2fa/status without a token is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.get('/rest/2fa/status');
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    }
  );
});
