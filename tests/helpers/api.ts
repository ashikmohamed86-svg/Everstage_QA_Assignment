import { APIRequestContext, expect } from '@playwright/test';
import { logged } from './logged-request';

/**
 * Shared API helpers so each spec doesn't reimplement login or registration.
 *
 * Every helper here goes through `logged(request)` so each HTTP round-trip
 * is captured as a Playwright attachment. The rich HTML reporter
 * (`tests/reporters/rich-reporter.ts`) renders those attachments under
 * each test's "API calls" panel, so a hiring manager — or a debugging
 * engineer — can read the request and response side-by-side without
 * cracking open a trace viewer.
 */

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const api = logged(request);
  const response = await api.post('/rest/user/login', {
    data: { email, password },
  });
  expect(response.ok(), 'login should succeed').toBeTruthy();
  const body = await response.json();
  expect(body?.authentication?.token, 'login response should include a token').toBeTruthy();
  return body.authentication.token;
}

export interface LoginSession {
  token: string;
  /** basket id, returned alongside the token in /rest/user/login */
  bid: number;
  email: string;
}

/**
 * Like `loginViaApi` but also returns the basket id (`bid`) and email so
 * callers can drive checkout and basket APIs without a follow-up
 * `/rest/user/whoami` round-trip — Juice Shop's whoami is cookie-auth
 * only, so the bearer token alone won't resolve it.
 */
export async function loginSession(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<LoginSession> {
  const api = logged(request);
  const response = await api.post('/rest/user/login', { data: { email, password } });
  expect(response.ok(), 'login should succeed').toBeTruthy();
  const body = await response.json();
  expect(body?.authentication?.token, 'login response should include a token').toBeTruthy();
  return {
    token: body.authentication.token,
    bid: body.authentication.bid,
    email: body.authentication.umail,
  };
}

/**
 * Returns the id of a product that's currently in stock (with at least
 * `minQty` units available) AND has no per-user purchase limit. Juice Shop
 * drains some products to zero across many test runs (Apple Juice in
 * particular), and others have a `limitPerUser=5` cap that the assignment
 * user hits after enough purchases. Picking on the fly keeps order-flow
 * tests resilient against accumulated state.
 *
 * Pass `minQty` when the test needs to seed several units of one item
 * (e.g. the high-quantity boundary test seeds 3 of one product).
 */
export async function findStockableProductId(
  request: APIRequestContext,
  token: string,
  minQty = 1
): Promise<number> {
  const api = logged(request);
  const response = await api.get('/api/Quantitys/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), 'Quantitys endpoint should respond').toBeTruthy();
  const body = await response.json();
  const rows = (body.data ?? []) as Array<{
    ProductId: number;
    quantity: number;
    limitPerUser: number | null;
  }>;
  const usable = rows.find(
    (r) => r.quantity >= minQty && (r.limitPerUser === null || r.limitPerUser >= minQty)
  );
  expect(
    usable,
    `at least one product with quantity >= ${minQty} and no per-user limit must exist`
  ).toBeTruthy();
  return usable!.ProductId;
}

export interface RegisterPayload {
  email: string;
  password: string;
  passwordRepeat?: string;
  securityQuestion?: { id: number };
  securityAnswer?: string;
}

export async function registerUserViaApi(
  request: APIRequestContext,
  payload: RegisterPayload
): Promise<{ id: number }> {
  const api = logged(request);
  const response = await api.post('/api/Users/', {
    data: {
      email: payload.email,
      password: payload.password,
      passwordRepeat: payload.passwordRepeat ?? payload.password,
      securityQuestion: payload.securityQuestion ?? { id: 1 },
      securityAnswer: payload.securityAnswer ?? 'test-answer',
    },
  });
  expect(response.status(), 'register should return 201').toBe(201);
  const body = await response.json();
  return { id: body.data.id };
}
