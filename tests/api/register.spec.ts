import { test, expect } from '@playwright/test';
import { uniqueEmail } from '../helpers/user';
import existingUser from '../data/new-user.json';

test.describe('Registration - API', () => {
  test('[TC-API-300] POST /api/Users/ creates a new user with valid input', async ({
    request,
  }) => {
    const email = uniqueEmail('api-reg');
    const response = await request.post('/api/Users/', {
      data: {
        email,
        password: 'StrongPass!23',
        passwordRepeat: 'StrongPass!23',
        securityQuestion: { id: 1 },
        securityAnswer: 'TestAnswer',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('success');
    expect(body.data.email).toBe(email);
    expect(body.data.password, 'password should be hashed, not echoed').not.toBe('StrongPass!23');
  });

  test('[TC-API-301] Re-registering an existing email is rejected', async ({ request }) => {
    const response = await request.post('/api/Users/', {
      data: {
        email: existingUser.email,
        password: existingUser.password,
        passwordRepeat: existingUser.password,
      },
    });
    expect([400, 409]).toContain(response.status());
  });

  test('[TC-API-302] DOCUMENTED VULN: Missing password is accepted on default Juice Shop', async ({
    request,
  }) => {
    // Juice Shop's /api/Users/ endpoint creates the row even when no password
    // is supplied. Asserted as the actual behavior so the suite stays green
    // on the default build — a hardened build should respond 400.
    const response = await request.post('/api/Users/', {
      data: { email: uniqueEmail() },
    });
    expect(response.status(), 'documented Juice Shop accepts blank password').toBe(201);
  });

  test('[TC-API-303] DOCUMENTED VULN: Malformed email is accepted on default Juice Shop', async ({
    request,
  }) => {
    // Juice Shop's /api/Users/ endpoint does not validate email format and
    // creates the row even when the address is malformed. We use a unique
    // malformed value so re-runs don't hit the duplicate-email constraint
    // (which would mask the real validation gap). Asserted as actual
    // behavior — a hardened build should respond 400 or 500.
    const malformedEmail = `not-an-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const response = await request.post('/api/Users/', {
      data: {
        email: malformedEmail,
        password: 'StrongPass!23',
        passwordRepeat: 'StrongPass!23',
      },
    });
    expect(response.status(), 'documented Juice Shop accepts malformed email').toBe(201);
  });
});
