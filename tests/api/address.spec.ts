import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

interface AddressBody {
  country: string;
  fullName: string;
  mobileNum: string | number;
  zipCode: string;
  streetAddress: string;
  city: string;
  state?: string;
}

const validAddress = (overrides: Partial<AddressBody> = {}): AddressBody => ({
  country: 'India',
  fullName: 'API Address Tester',
  mobileNum: 9876543210,
  zipCode: '560001',
  streetAddress: '221B Baker Street',
  city: 'Bangalore',
  state: 'KA',
  ...overrides,
});

test.describe('Addresses - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test('[TC-API-600] POST /api/Addresss creates an address', async ({ request }) => {
    const response = await request.post('/api/Addresss/', {
      headers: { Authorization: `Bearer ${token}` },
      data: validAddress(),
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.status).toBe('success');
    expect(body.data.streetAddress).toBe('221B Baker Street');
  });

  test('[TC-API-601] GET /api/Addresss returns the user addresses', async ({ request }) => {
    const created = await request.post('/api/Addresss/', {
      headers: { Authorization: `Bearer ${token}` },
      data: validAddress({ streetAddress: 'Get Test Lane' }),
    });
    const id = (await created.json()).data.id;

    const list = await request.get('/api/Addresss/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.ok()).toBeTruthy();

    const body = await list.json();
    expect(body.data.some((a: { id: number }) => a.id === id)).toBe(true);
  });

  test('[TC-API-602] DELETE /api/Addresss/{id} removes the address', async ({ request }) => {
    const created = await request.post('/api/Addresss/', {
      headers: { Authorization: `Bearer ${token}` },
      data: validAddress({ streetAddress: 'Delete Me' }),
    });
    const id = (await created.json()).data.id;

    const del = await request.delete(`/api/Addresss/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status()).toBe(200);
  });

  test('[TC-API-603] Address creation without token is rejected', async ({ request }) => {
    const response = await request.post('/api/Addresss/', { data: validAddress() });
    expect(response.status()).toBe(401);
  });

  test('[TC-API-604] Boundary: ZIP code longer than 8 chars is rejected', async ({ request }) => {
    const response = await request.post('/api/Addresss/', {
      headers: { Authorization: `Bearer ${token}` },
      data: validAddress({ zipCode: '123456789' }),
    });
    expect([400, 500]).toContain(response.status());
  });
});
