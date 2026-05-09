import { test, expect, APIRequestContext } from '@playwright/test';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

async function fetchCaptcha(
  request: APIRequestContext
): Promise<{ captchaId: number; answer: number }> {
  const response = await request.get('/rest/captcha/');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  // body is { captchaId, captcha: '1+2', answer: 3 } in non-prod builds.
  return { captchaId: body.captchaId, answer: body.answer };
}

test.describe('Feedback - API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  test('[TC-API-800] POST /api/Feedbacks creates feedback with valid captcha', async ({
    request,
  }) => {
    const { captchaId, answer } = await fetchCaptcha(request);

    const response = await request.post('/api/Feedbacks/', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        captchaId,
        captcha: String(answer),
        comment: 'API positive feedback',
        rating: 5,
      },
    });

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.status).toBe('success');
    expect(body.data.rating).toBe(5);
  });

  test('[TC-API-801] Wrong captcha answer is rejected', async ({ request }) => {
    const { captchaId } = await fetchCaptcha(request);

    const response = await request.post('/api/Feedbacks/', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        captchaId,
        captcha: '99999',
        comment: 'API wrong-captcha test',
        rating: 3,
      },
    });

    expect([401, 400, 500]).toContain(response.status());
  });

  test('[TC-API-802] DOCUMENTED VULN: rating above 5 is accepted', async ({ request }) => {
    // Juice Shop's /api/Feedbacks accepts rating=6 — no server-side bound
    // check on the rating field. Asserted as the actual behavior.
    const { captchaId, answer } = await fetchCaptcha(request);

    const response = await request.post('/api/Feedbacks/', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        captchaId,
        captcha: String(answer),
        comment: 'rating too high',
        rating: 6,
      },
    });

    expect([200, 201]).toContain(response.status());
  });

  test('[TC-API-803] DOCUMENTED VULN: rating below 1 is accepted', async ({ request }) => {
    const { captchaId, answer } = await fetchCaptcha(request);

    const response = await request.post('/api/Feedbacks/', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        captchaId,
        captcha: String(answer),
        comment: 'rating too low',
        rating: 0,
      },
    });

    expect([200, 201]).toContain(response.status());
  });
});
