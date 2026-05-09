import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('User identity & lookup - API', () => {
  test(
    '[TC-API-1500] GET /rest/user/whoami returns the current user when authenticated via cookie',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const token = await loginViaApi(request, user.email, user.password);

      // Juice Shop's whoami reads the `token` cookie (Passport session), so
      // a Bearer header alone is not enough — we send the token as a cookie too.
      const response = await request.get('/rest/user/whoami', {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `token=${token}`,
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user?.email).toBe(user.email);
      expect(typeof body.user?.id).toBe('number');
    }
  );

  test(
    '[TC-API-1501] GET /rest/user/whoami without a token returns an empty user',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.get('/rest/user/whoami');
      // Juice Shop returns 200 with user={} (or null) for an unauthenticated
      // caller — not great UX (better would be 401) but no PII leak.
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.user?.email).toBeUndefined();
      expect(body.user?.id).toBeUndefined();
    }
  );

  test(
    '[TC-API-1502] GET /rest/user/security-question returns the question for a known email',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get(
        `/rest/user/security-question?email=${encodeURIComponent(user.email)}`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.question).toMatchObject({
        id: expect.any(Number),
        question: expect.any(String),
      });
    }
  );

  test(
    '[TC-API-1503] DOCUMENTED VULN: security-question endpoint is an enumeration oracle',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // The endpoint discloses whether an email is registered (returns the
      // question for known emails, empty for unknown). This is a user
      // enumeration vector — flag and document.
      const known = await (
        await request.get(`/rest/user/security-question?email=${encodeURIComponent(user.email)}`)
      ).json();

      const unknownResp = await request.get(
        '/rest/user/security-question?email=does-not-exist-1234567890@juice.test'
      );
      const unknownBody = await unknownResp.json();

      expect(known.question).toBeTruthy();
      // Unknown email returns nothing meaningful — different shape ⇒ enumerable.
      expect(unknownBody.question).toBeFalsy();
    }
  );
});
