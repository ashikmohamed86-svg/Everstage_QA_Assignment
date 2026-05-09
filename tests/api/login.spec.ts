import { test, expect } from '@playwright/test';
import user from '../data/new-user.json';

test.describe('Login - API', () => {
  test('[TC-API-200] POST /rest/user/login returns a token for valid credentials', async ({
    request,
  }) => {
    const response = await request.post('/rest/user/login', {
      data: { email: user.email, password: user.password },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.authentication?.token).toBeTruthy();
    expect(body.authentication?.umail).toBe(user.email);
  });

  test('[TC-API-201] Login with wrong password returns 401', async ({ request }) => {
    const response = await request.post('/rest/user/login', {
      data: { email: user.email, password: 'WrongPassword!23' },
    });
    expect(response.status()).toBe(401);
  });

  test('[TC-API-202] Login with non-existent email returns 401', async ({ request }) => {
    const response = await request.post('/rest/user/login', {
      data: { email: 'no-such-user-99999@juice.test', password: 'AnyPass!23' },
    });
    expect(response.status()).toBe(401);
  });

  test('[TC-API-203] Login without body fields returns an error', async ({ request }) => {
    const response = await request.post('/rest/user/login', { data: {} });
    expect([400, 401]).toContain(response.status());
  });

  test('[TC-API-204] DOCUMENTED VULN: SQL injection in email field bypasses auth on default Juice Shop', async ({
    request,
  }) => {
    // Juice Shop is intentionally vulnerable to authentication bypass via
    // SQLi in the email field — this is one of the headline OWASP demos.
    // We assert the *actual* behavior so this test is green on the default
    // build, while making the security gap visible. A hardened build should
    // reverse this assertion (`.not.toBe(200)`).
    const response = await request.post('/rest/user/login', {
      data: { email: "' OR 1=1 --", password: 'whatever' },
    });
    expect(response.status(), 'documented Juice Shop SQLi auth bypass').toBe(200);
    const body = await response.json();
    expect(body.authentication?.token, 'token issued for SQLi payload').toBeTruthy();
  });
});
