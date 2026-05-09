import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Customer complaints - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test(
    '[TC-API-1300] POST /api/Complaints creates a complaint',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.post('/api/Complaints', {
        headers: { Authorization: `Bearer ${token}` },
        data: { message: 'API test complaint - please ignore' },
      });
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(body.data.message).toBe('API test complaint - please ignore');
      expect(typeof body.data.id).toBe('number');
    }
  );

  test(
    '[TC-API-1301] DOCUMENTED VULN: Complaint stored with UserId=null',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // Same broken-access-control finding as TC-API-901 — /api/Complaints
      // does not bind the row to the authenticated caller.
      const response = await request.post('/api/Complaints', {
        headers: { Authorization: `Bearer ${token}` },
        data: { message: 'UserId binding probe' },
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.UserId).toBeNull();
    }
  );

  test(
    '[TC-API-1302] GET /api/Complaints returns a list',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get('/api/Complaints', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);
      expect(Array.isArray((await response.json()).data)).toBe(true);
    }
  );

  test(
    '[TC-API-1303] Complaint without auth token is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.post('/api/Complaints', {
        data: { message: 'unauth probe' },
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-1304] XSS payload in complaint message is stored as a literal string',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const message = '<script>alert(1)</script>';
      const response = await request.post('/api/Complaints', {
        headers: { Authorization: `Bearer ${token}` },
        data: { message },
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.message).toBe(message);
    }
  );
});
