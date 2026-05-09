import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

interface RecyclePayload {
  AddressId?: number;
  quantity: number;
  isPickup: boolean;
  date: string;
}

const validRecycle = (overrides: Partial<RecyclePayload> = {}): RecyclePayload => ({
  AddressId: 1,
  quantity: 5,
  isPickup: false,
  date: '2099-01-01',
  ...overrides,
});

test.describe('Recycle requests - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test(
    '[TC-API-900] POST /api/Recycles creates a recycle request',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.post('/api/Recycles', {
        headers: { Authorization: `Bearer ${token}` },
        data: validRecycle(),
      });
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(body.data).toMatchObject({
        AddressId: 1,
        quantity: 5,
        isPickup: false,
      });
      expect(typeof body.data.id).toBe('number');
    }
  );

  test(
    '[TC-API-901] DOCUMENTED VULN: Recycle request is created with UserId=null',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // Juice Shop's /api/Recycles endpoint does NOT bind the request to the
      // authenticated user — every row is persisted with UserId=null. This is
      // a broken-access-control / mass-assignment finding; asserted here as
      // actual behavior so the suite stays green on the default build.
      const response = await request.post('/api/Recycles', {
        headers: { Authorization: `Bearer ${token}` },
        data: validRecycle(),
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.UserId).toBeNull();
    }
  );

  test(
    '[TC-API-902] Recycle request without auth token is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.post('/api/Recycles', { data: validRecycle() });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-903] DOCUMENTED VULN: Recycle accepts negative quantity',
    { tag: ['@everstage-qa', '@negative'] },
    async ({ request }) => {
      // Juice Shop persists negative quantities — should be 400 in a hardened build.
      const response = await request.post('/api/Recycles', {
        headers: { Authorization: `Bearer ${token}` },
        data: validRecycle({ quantity: -10 }),
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.quantity).toBe(-10);
    }
  );

  test(
    '[TC-API-904] DOCUMENTED VULN: GET /api/Recycles/{id} returns ALL recycles, not just the requested id',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // Juice Shop's GET-by-id on /api/Recycles ignores the {id} segment and
      // returns the full collection — a broken object-level authorization
      // (information disclosure) finding. Asserted as actual behavior.
      const created = await request.post('/api/Recycles', {
        headers: { Authorization: `Bearer ${token}` },
        data: validRecycle(),
      });
      const id = (await created.json()).data.id;

      const fetched = await request.get(`/api/Recycles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(fetched.status()).toBe(200);

      const body = await fetched.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);
      // Caller's record is in the list — and so are other users' records.
      expect(body.data.some((r: { id: number }) => r.id === id)).toBe(true);
    }
  );
});
