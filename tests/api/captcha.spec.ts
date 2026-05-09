import { test, expect } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

test.describe('Captcha endpoints - API', () => {
  test(
    '[TC-API-1400] GET /rest/captcha returns a math captcha and answer pair',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const response = await request.get('/rest/captcha');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(typeof body.captchaId).toBe('number');
      expect(typeof body.captcha).toBe('string');
      expect(typeof body.answer).toBe('string');

      // The expression is sent in plain text (e.g. "2-8*1") and the answer
      // is computable client-side — sanity-check that the answer matches.
      // eslint-disable-next-line no-eval
      const evaluated = eval(body.captcha);
      expect(String(evaluated)).toBe(String(body.answer));
    }
  );

  test(
    '[TC-API-1401] DOCUMENTED VULN: /rest/captcha leaks the correct answer in the response',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      // The captcha endpoint returns both the puzzle and its answer — clients
      // can solve any captcha trivially. Documented as the actual behavior.
      const response = await request.get('/rest/captcha');
      const body = await response.json();
      expect(body.answer, 'a hardened build should NOT return the answer').toBeDefined();
    }
  );

  test(
    '[TC-API-1402] GET /rest/image-captcha returns an SVG payload (authenticated)',
    { tag: ['@everstage-qa', '@positive'] },
    async ({ request }) => {
      const token = await loginViaApi(request, user.email, user.password);
      const response = await request.get('/rest/image-captcha', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(typeof body.image).toBe('string');
      expect(body.image).toMatch(/^<svg /);
    }
  );

  test(
    '[TC-API-1403] GET /rest/image-captcha without auth is rejected',
    { tag: ['@everstage-qa', '@security'] },
    async ({ request }) => {
      const response = await request.get('/rest/image-captcha');
      expect(response.status()).toBe(401);
    }
  );
});
