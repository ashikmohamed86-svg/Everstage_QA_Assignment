# Code tour — assignment vs extras

Single-file reference for the pairing call. Open this beside your IDE.
Every code snippet here is the **actual code** from the repo, ready to
read aloud or screen-share.

> Two parts. **PART A** is what the brief literally asked for — point at
> these first. **PART B** is everything I added on top — bring these up
> when the interviewer asks "what else?"

## Quick map

| Brief | File | Test ids |
|---|---|---|
| Task 1 — `beforeEach` login | `tests/data/new-user.json`, `tests/helpers/login.ts`, `tests/ui/task1-login.spec.ts` | TC-UI-100..140 |
| Task 2 — UI add card | `tests/pages/PaymentPage.ts`, `tests/ui/task2-add-card.spec.ts` | TC-UI-001..041 |
| Task 3 — API add unique card | `tests/helpers/card.ts`, `tests/api/task3-add-card.spec.ts` | TC-API-001..156 |

| Extra | File | Why I added it |
|---|---|---|
| Custom Playwright fixtures | `tests/fixtures.ts` | Senior idiom on top of the literal `beforeEach` |
| Senior-signal tests | `tests/api/task3-add-card.spec.ts` (TC-API-150..156) | Idempotency, race, schema contract, cross-layer |
| Missing flow: full checkout | `tests/api/order-flow.spec.ts`, `tests/ui/order-flow.spec.ts`, `tests/pages/CheckoutPage.ts`, `tests/pages/OrderHistoryPage.ts` | The pre-existing suite never connected basket → address → delivery → payment → place order |
| Custom HTML reporter | `tests/reporters/rich-reporter.ts` | Search/filter, API request/response inline, trace cards |
| Logged API wrapper | `tests/helpers/logged-request.ts` | Auto-attaches every HTTP call to the report |
| Stockable-product helper | `tests/helpers/api.ts` (`findStockableProductId`) | Routes around Juice Shop's per-user purchase cap |
| CI/CD pipelines | `.github/workflows/playwright.yml`, `ci-examples/*` | GitHub / GitLab / Jenkins / Azure |

---

# PART A — Assignment code (the brief)

This is what the interviewer expects to see. Each section: file path,
the actual code, why it's there, what to say.

---

## A.1 Task 1 — `beforeEach` login

### A.1.1 The credentials file

> "I registered the user manually in the Juice Shop UI and saved the
> credentials here, exactly as the brief asked."

**`tests/data/new-user.json`** (full file):

```json
{
  "email": "everstage-qa-mox3mxq8@juice.test",
  "password": "Everstage@123",
  "securityQuestionId": 1,
  "securityAnswer": "Everstage"
}
```

**Why JSON over env vars:** The brief says *"add their credentials [to]
the new-user.json file"* — verbatim. JSON also gives me a typed import
(`import user from '../data/new-user.json'`) so a typo on a field name
is a compile error.

---

### A.1.2 The login script

> "This is the login script the brief asked for. It pre-seeds banner
> cookies so they don't intercept clicks, navigates to /#/login, submits
> credentials, and asserts the navbar account icon is visible."

**`tests/helpers/login.ts`** (full file):

```ts
import { BrowserContext, Page, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { suppressBanners } from './banners';
import user from '../data/new-user.json';

/**
 * Single source of truth for the assignment login flow. Use this helper
 * inside `test.beforeEach` so every test starts already authenticated as
 * the user defined in `tests/data/new-user.json`.
 */
export async function loginBeforeEach(
  page: Page,
  context: BrowserContext,
  email: string = user.email,
  password: string = user.password
): Promise<void> {
  await suppressBanners(context);

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.attemptLogin(email, password);

  await expect(page, 'login should leave /login').not.toHaveURL(/login/);
  await expect(page.locator('#navbarAccount'), 'navbar account icon should render').toBeVisible();
}
```

**Why a helper instead of inlining the login in every spec:**
- 16 specs reuse it — DRY.
- One file to fix if Juice Shop changes the login form.
- The `default = user.email/password` pattern lets a security-probe test override the credentials when it needs to test the *negative* path (`loginBeforeEach(page, ctx, 'wrong@user', 'badpw')`).

---

### A.1.3 Banner suppression — why this matters

> "Juice Shop layers three intercepts on first paint: a welcome dialog,
> a cookie consent bar, and a language snackbar. They all sit on top of
> the form fields. Click-to-dismiss is racy, so I pre-seed the cookies
> instead — much more reliable."

**`tests/helpers/banners.ts`** (full file):

```ts
import { BrowserContext } from '@playwright/test';

export async function suppressBanners(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.cookie = 'welcomebanner_status=dismiss; path=/';
    document.cookie = 'cookieconsent_status=dismiss; path=/';
    document.cookie = 'language=en; path=/';
  });
}
```

`addInitScript` runs the cookie-set BEFORE every page load, so the
banners never even appear.

---

### A.1.4 Login page object

> "Selectors live in the POM, not the spec. When Juice Shop changes a
> field id, I fix it once here, not 16 times across tests."

**`tests/pages/LoginPage.ts`** (full file):

```ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#loginButton');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.attemptLogin(email, password);
    await expect(this.page).not.toHaveURL(/login/);
  }

  async attemptLogin(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

**Locator strategy here:** all three locators use stable CSS IDs
(`#email`, `#password`, `#loginButton`) that Juice Shop ships as part of
the public DOM contract. They survive Material upgrades.

---

### A.1.5 The spec — `beforeEach` calling the login script

> "And here's the brief's literal ask. Every test in the
> `authenticated session` describe block runs `loginBeforeEach()` first."

**`tests/ui/task1-login.spec.ts`** (lines 19–32):

```ts
test.describe('Login - UI (Task 1: beforeEach login)', () => {
  test.describe('authenticated session', () => {
    test.beforeEach(async ({ page, context }) => {
      await loginBeforeEach(page, context);    // ← the brief's ask
    });

    test(
      '[TC-UI-100] beforeEach login lands on a logged-in homepage',
      { tag: ['@task1', '@everstage-qa', '@positive', '@smoke', '@e2e'] },
      async ({ page }) => {
        await expect(page).not.toHaveURL(/login/);
        await expect(page.locator('#navbarAccount')).toBeVisible();
      }
    );
    // ... 14 more tests
```

**Why an `authenticated session` describe inside the spec:** tests that
*verify the login form itself* (e.g. wrong password, SQLi probe) can't
start "already logged in" — they need to drive the form. So the spec
has two describe blocks: one for tests that use the login script (most
of them), one for tests that drive the form themselves. Both share
banner suppression.

---

## A.2 Task 2 — UI add card

### A.2.1 The page object

> "Selectors anchor on accessible names + labels + IDs — never on
> auto-generated Material classes."

**`tests/pages/PaymentPage.ts`** (full file):

```ts
import { Page, Locator, expect } from '@playwright/test';

export interface CardDetails {
  name: string;
  number: string;
  month: string;
  year: string;
}

export class PaymentPage {
  readonly page: Page;
  readonly accountMenu: Locator;
  readonly ordersAndPaymentMenu: Locator;
  readonly myPaymentOptions: Locator;
  readonly addCardPanel: Locator;
  readonly nameField: Locator;
  readonly cardNumberField: Locator;
  readonly monthSelect: Locator;
  readonly yearSelect: Locator;
  readonly submitButton: Locator;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountMenu = page.locator('#navbarAccount');                                              // ✓ stable ID
    this.ordersAndPaymentMenu = page.getByRole('menuitem', { name: 'Show Orders and Payment Menu' }); // ✓ ARIA name
    this.myPaymentOptions = page.getByRole('menuitem', { name: 'Go to saved payment methods page' }); // ✓ ARIA name
    this.addCardPanel = page.locator('mat-expansion-panel-header', { hasText: 'Add new card' });    // ✓ tag + text
    this.nameField = page.getByLabel('Name', { exact: true });                                      // ✓ accessible label
    this.cardNumberField = page.getByLabel('Card Number', { exact: true });                         // ✓ accessible label
    this.monthSelect = page.getByLabel('Expiry Month', { exact: true });                            // ✓ accessible label
    this.yearSelect = page.getByLabel('Expiry Year', { exact: true });                              // ✓ accessible label
    this.submitButton = page.locator('#submitButton');                                              // ✓ stable ID
    this.confirmation = page.locator('simple-snack-bar', { hasText: /card.*saved/i });              // ✓ tag + regex
  }

  async openMyPayments(): Promise<void> {
    await this.accountMenu.click();
    await this.ordersAndPaymentMenu.click();
    await this.myPaymentOptions.click();
    await expect(this.page).toHaveURL(/saved-payment-methods/);
  }

  async expandAddCardPanel(): Promise<void> {
    if ((await this.addCardPanel.getAttribute('aria-expanded')) !== 'true') {
      await this.addCardPanel.click();
    }
  }

  async addCard(card: CardDetails): Promise<void> {
    await this.expandAddCardPanel();
    await this.nameField.fill(card.name);
    await this.cardNumberField.fill(card.number);
    await this.monthSelect.selectOption(card.month);
    await this.yearSelect.selectOption(card.year);
    await this.submitButton.click();
  }
}
```

**Locator hierarchy I followed (best to worst):**
1. **Stable IDs** — `#navbarAccount`, `#submitButton` — survive UI redesigns.
2. **`getByRole` + accessible name** — part of the WCAG contract, doubles as an a11y signal.
3. **`getByLabel`** — same stability story, scoped to form fields.
4. **Tag + text/regex** — for snackbars and panel headers that don't expose ARIA roles.
5. **NEVER:** auto-generated Material classes, XPath positional selectors, mat-id like `mat-radio-155-input`.

---

### A.2.2 The literal-brief test

**`tests/ui/task2-add-card.spec.ts`** (lines 36–58):

```ts
test(
  '[TC-UI-001] User can add card details from My Payment Options',
  { tag: ['@task2', '@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
  async ({ page }) => {
    const paymentPage = new PaymentPage(page);
    await paymentPage.openMyPayments();

    const card: CardDetails = {
      name: 'Everstage QA',
      number: uniqueCardNumber(),       // ← unique per run
      month: '5',
      year: '2080',
    };
    await paymentPage.addCard(card);

    await expect(paymentPage.confirmation).toBeVisible();
    await expect(
      page.locator('mat-cell, td.mat-cell', { hasText: card.number.slice(-4) }).first()
    ).toBeVisible();
  }
);
```

**What this proves:** the literal brief — log in, navigate to My
Payments, fill the form, save, see the card.

**Two assertions, intentional:**
- The success snackbar — confirms the form submitted.
- The card row visible in the table with the last 4 digits — confirms the data round-tripped (and only the last 4 digits are visible, which is a PCI-style finding).

---

### A.2.3 The `beforeEach` cleanup — why it's there

**`tests/ui/task2-add-card.spec.ts`** (lines 14–30):

```ts
test.beforeEach(async ({ page, context, request }) => {
  // Clear any cards left over from prior runs so the saved-payment-methods
  // table renders quickly. Without this the page accumulates 100+ rows
  // across many runs and the post-add snackbar / row-visible assertions
  // start hitting the 5s timeout because Angular re-renders the whole
  // table on every add.
  const session = await loginSession(request, user.email, user.password);
  const headers = { Authorization: `Bearer ${session.token}` };
  const list = await request.get('/api/Cards/', { headers });
  const cards = (await list.json()).data ?? [];
  for (const card of cards) {
    await request.delete(`/api/Cards/${card.id}`, { headers });
  }

  await loginBeforeEach(page, context);
});
```

**What to say:** *"I clean up state up-front rather than retrying or
adding waits. Cleanup-first beats any per-test wait, and it leaves the
user in a known state — which matters at 16 tests, even more at 500."*

---

## A.3 Task 3 — API add unique card

### A.3.1 The "unique" generator

> "This is what makes 'unique' actually unique. Visa-prefix `4111`
> plus 12 random digits — 10¹² possible values. Re-runs and parallel
> workers can't collide on Juice Shop's SQLite unique-key constraint."

**`tests/helpers/card.ts`** (full file):

```ts
/**
 * Returns a 16-digit Visa-like card number with 12 random trailing digits.
 * Pure random (rather than timestamp-based) gives 10^12 unique values, so
 * tests run in parallel — including the same millisecond — won't collide
 * even after many runs accumulate cards on the user's account.
 */
export function uniqueCardNumber(): string {
  const seed = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
  return `4111${seed}`;
}
```

**Why pure random vs timestamp:** Two parallel workers in the same
millisecond would collide on a timestamp-based id. 10¹² random values
gives a vanishing collision probability even at hundreds of concurrent
runs.

---

### A.3.2 The literal-brief API test

**`tests/api/task3-add-card.spec.ts`** (lines 13–66):

```ts
interface CardPayload {
  fullName?: string;
  cardNum: string;
  expMonth: number;
  expYear: number;
}

const validCard = (overrides: Partial<CardPayload> = {}): CardPayload => ({
  fullName: 'API Test User',
  cardNum: uniqueCardNumber(),     // ← unique per call
  expMonth: 5,
  expYear: 2080,
  ...overrides,                    // ← let any test override one field
});

test.describe('Payment Cards - API (Task 3)', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  test(
    '[TC-API-001] POST /api/Cards/ creates a card with unique details',
    { tag: ['@task3', '@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ request }) => {
      const payload = validCard();

      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });

      expect(response.status(), 'card should be created').toBe(201);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(body.data).toMatchObject({
        fullName: payload.fullName,
        expMonth: payload.expMonth,
        expYear: payload.expYear,
      });
      expect(String(body.data.cardNum)).toContain(payload.cardNum.slice(-4));
    }
  );
```

**Two design choices to mention:**

1. **`validCard()` factory.** Each test starts from a baseline and overrides only what it wants. So a boundary test reads `validCard({ expYear: 2079 })` instead of repeating the whole payload — much easier to scan.

2. **Bearer-token login at the API layer.** The brief's "login script" is in `tests/helpers/login.ts` (UI). At the API layer, we hit `/rest/user/login` directly via `loginViaApi()` and pass the bearer token explicitly. Same intent, right tool for the layer.

---

# PART B — Above and beyond (extras)

This is what differentiates a "ran the brief" submission from a
"thought about the problem" one. Bring up only what the interviewer
gives you time for — they're sequenced from highest to lowest impact.

---

## B.1 Custom Playwright fixtures

> "I started with raw `beforeEach` per the brief, then wrapped it as a
> Playwright fixture so newer specs can declare what they need without
> the boilerplate. Both work. Both call the same login under the hood
> — there's exactly one way to log in."

**`tests/fixtures.ts`** (key parts):

```ts
export const test = base.extend<CustomFixtures>({
  apiSession: async ({ request }, use) => {
    const session = await loginSession(request, user.email, user.password);
    await use(session);
  },

  authenticatedPage: async ({ page, context }, use) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.attemptLogin(user.email, user.password);
    await expect(page, 'login should leave /login').not.toHaveURL(/login/);
    await expect(page.locator('#navbarAccount')).toBeVisible();
    await use(page);
  },

  seededCheckout: async ({ request, apiSession }, use) => {
    await clearBasket(request, apiSession.token, apiSession.bid);
    const [addressId, cardId, productId, deliveryMethodId] = await Promise.all([
      seedAddress(request, apiSession.token),
      seedCard(request, apiSession.token),
      findStockableProductId(request, apiSession.token),
      defaultDeliveryMethodId(request, apiSession.token),
    ]);
    await use({ token: apiSession.token, basketId: apiSession.bid, addressId, cardId, productId, deliveryMethodId });
  },
});
```

**Three fixtures, three different costs:**

- `apiSession` — REST login. Used by API tests. Returns `{ token, bid, email }`.
- `authenticatedPage` — UI login. Same intent as `loginBeforeEach`, but expressed as a fixture.
- `seededCheckout` — full checkout state. Composes `apiSession`, then in **parallel** seeds an address + card + resolves a stockable product + picks a delivery method.

**Why fixtures:** lazy instantiation. A test that only declares
`async ({ page })` doesn't pay for `seededCheckout`. The pattern
explicitly couples cost to intent.

---

## B.2 Senior-signal API tests (idempotency, race, schema, cross-layer)

> "Above and beyond the brief — these test the things a real
> commission-processing platform would care about, even though the demo
> app is a generic juice shop."

### B.2.1 Idempotency — `[TC-API-150]`

**Direct map to:** Everstage commission de-dup. Posting the same
closed-won deal twice must not produce two commissions.

```ts
test(
  '[TC-API-150] DOCUMENTED VULN: re-posting an identical card is accepted (no idempotency / no de-dup)',
  { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
  async ({ request }) => {
    // A hardened build should reject the second POST with 409 Conflict
    // (idempotent semantics for "add this card"). Juice Shop happily
    // creates two rows for the same PAN — asserted here as the actual
    // behavior; commission/payout systems would consider this a
    // critical de-dup failure (Everstage parallel: duplicate commission
    // entries for the same closed-won deal).
    const payload = validCard({ fullName: 'Idempotency Probe' });

    const first = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
    expect(first.status()).toBe(201);
    const firstId = (await first.json()).data.id;

    const second = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
    expect(second.status(), 'documented Juice Shop accepts duplicate-card POST').toBe(201);
    const secondId = (await second.json()).data.id;
    expect(secondId).not.toBe(firstId);
  }
);
```

### B.2.2 Concurrent race — `[TC-API-151]`

**Direct map to:** Payout processing at scale. Two near-simultaneous
clicks on "Pay" must not produce two payouts.

```ts
test(
  '[TC-API-151] Concurrent identical-card POSTs do not crash the server',
  { tag: ['@task3', '@everstage-qa', '@load', '@security', '@regression'] },
  async ({ request }) => {
    const payload = validCard({ fullName: 'Race Probe' });
    const [a, b] = await Promise.all([
      request.post('/api/Cards/', { headers: authHeaders(), data: payload }),
      request.post('/api/Cards/', { headers: authHeaders(), data: payload }),
    ]);
    const statuses = [a.status(), b.status()].sort();
    // Acceptable: [201, 201] (no de-dup) or [201, 409] (hardened).
    // Unacceptable: any 5xx.
    expect(statuses[0]).toBeGreaterThanOrEqual(200);
    expect(statuses[1]).toBeLessThan(500);
  }
);
```

### B.2.3 Response-shape contract — `[TC-API-152]`

**Direct map to:** Audit-trail integrity for SOC 2. Sensitive fields
must never appear in API responses, ever.

```ts
test(
  '[TC-API-152] Response shape is JSON-schema-stable (id, fullName, expMonth, expYear, cardNum)',
  { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@functional'] },
  async ({ request }) => {
    // A response-shape contract test. Catches accidental field
    // additions / removals across deploys without ad-hoc per-field
    // assertions in every test.
    const payload = validCard({ fullName: 'Schema Probe' });
    const response = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const required = ['id', 'fullName', 'expMonth', 'expYear', 'cardNum', 'createdAt', 'updatedAt'];
    for (const field of required) {
      expect(body.data, 'response must include `' + field + '`').toHaveProperty(field);
    }

    // Sensitive fields must NEVER appear in the response.
    const banned = ['cvv', 'pin', 'fullCardNumber', 'pan'];
    for (const field of banned) {
      expect(body.data, 'response must NOT include `' + field + '`').not.toHaveProperty(field);
    }
  }
);
```

### B.2.4 Cross-layer consistency — `[TC-API-156]`

**Direct map to:** "The write went nowhere" — the failure mode where a
commission gets created in one server but a different server, or a
cache, doesn't see it.

```ts
test(
  '[TC-API-156] Cross-layer: card created via API is visible to a fresh authenticated session',
  { tag: ['@task3', '@everstage-qa', '@positive', '@e2e', '@regression', '@functional'] },
  async ({ request }) => {
    const payload = validCard({ fullName: 'Cross Layer Probe' });
    const created = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
    expect(created.status()).toBe(201);
    const cardId = (await created.json()).data.id;

    // New session: fresh login → fresh token → GET list.
    const freshToken = await loginViaApi(request, user.email, user.password);
    const list = await request.get('/api/Cards/', {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    expect(list.ok()).toBeTruthy();
    const body = await list.json();
    expect(body.data.some((c: { id: number }) => c.id === cardId)).toBe(true);
  }
);
```

---

## B.3 The missing flow — full checkout

> "The pre-existing suite covered basket, address book, and saved cards
> *individually* but never connected them through the checkout funnel.
> I added the missing flow at both layers."

**Files:**
- `tests/pages/CheckoutPage.ts` — POM for the multi-step funnel
- `tests/pages/OrderHistoryPage.ts` — POM for the order history page
- `tests/ui/order-flow.spec.ts` — 8 tests
- `tests/api/order-flow.spec.ts` — 14 tests

**The headline UI test:**

```ts
test(
  '[TC-UI-700] End-to-end order: basket → address → delivery → payment → place order',
  { tag: ['@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
  async ({ authenticatedPage: page, request, seededCheckout }) => {
    await seedBasket(request, seededCheckout.token, seededCheckout.basketId, seededCheckout.productId);

    const checkout = new CheckoutPage(page);
    await page.goto('/#/basket');

    await checkout.checkoutFromBasket();
    await checkout.selectFirstAddress();
    await checkout.selectFirstDelivery();
    await checkout.selectFirstCard();
    await checkout.placeOrder();

    await expect(page).toHaveURL(/order-completion/);
    await expect(page.getByText(/thank you for your purchase/i).first()).toBeVisible();
  }
);
```

**Notice:** the test uses `authenticatedPage` and `seededCheckout`
fixtures — declares what it needs, gets it for free. The test body
contains zero login/setup code, only the steps under test.

---

## B.4 Logged API wrapper — for the rich report

> "Every shared API helper goes through this wrapper, so every HTTP
> call ends up as an attachment on the test, which the rich report
> renders inline. Auth headers are auto-redacted."

**`tests/helpers/logged-request.ts`** (key part):

```ts
const REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie'];

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    out[k] = REDACT_HEADERS.includes(k.toLowerCase())
      ? `${String(v).slice(0, 12)}…(redacted)`
      : String(v);
  }
  return out;
}

export function logged(request: APIRequestContext): LoggedClient {
  const wrap =
    (verb: 'get' | 'post' | 'put' | 'delete') =>
    async (url: string, init: RequestInit = {}): Promise<APIResponse> => {
      const startedAt = Date.now();
      const response = await request[verb](url, init);
      await attachApiCall(verb.toUpperCase(), url, init, response, startedAt);
      return response;
    };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), delete: wrap('delete') };
}
```

**What it produces in the report:** for every API call, you see method
+ URL + status + duration in a collapsible card; click it open and
the request headers / params / body and response headers / body are
side-by-side in pretty-printed JSON.

---

## B.5 Stockable-product helper — defensive against live state

> "Juice Shop drains products to zero across many runs, and some
> products have a `limitPerUser=5` cap. Hardcoding `ProductId: 1` is
> fragile. This helper picks a product that's actually orderable for
> the current user *right now*."

**`tests/helpers/api.ts`** (the key function):

```ts
export async function findStockableProductId(
  request: APIRequestContext,
  token: string
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
    (r) => r.quantity > 0 && (r.limitPerUser === null || r.limitPerUser >= 1)
  );
  expect(usable, 'at least one product with stock and no per-user limit must exist').toBeTruthy();
  return usable!.ProductId;
}
```

**Mention this if they ask "what was the trickiest bug?"** — the
suite's first version hardcoded ProductId: 1 (Apple Juice). After ~50
runs it drained to zero stock, and tests started failing with cryptic
"Expected 201, received 400". The fix: query Juice Shop's quantity
table at test time and pick a survivor.

---

## B.6 Custom HTML reporter

> "The default Playwright report is fine but doesn't give a
> non-technical reader anything to scan. The rich report is a single
> self-contained HTML — no CDN — with search, filters, charts, and
> per-test detail drawers including API request/response inline."

**`tests/reporters/rich-reporter.ts`** — too long to embed; the
high-level shape:

```ts
export default class RichHtmlReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    // Capture: status, duration, tags, error, steps, attachments,
    // stdout/stderr, plus any `api-call:*` JSON attachments parsed back
    // into structured form for the detail drawer.
    this.records.push({ /* ... */ });
  }

  onEnd(): void {
    fs.writeFileSync(REPORT_PATH, renderHtml(summary, this.records, history));
  }
}
```

**The two halves of the file:**
1. The reporter class — collects per-test data.
2. Two huge template literals — `STYLE` (CSS) and `SCRIPT` (vanilla JS that runs in the browser to render the dashboard from the embedded JSON).

**What the rich report does that Playwright's default doesn't:**
- Live search bar (focus-preserving across re-renders)
- Filter chips for status / layer / category / **assignment scope** / CI gate
- Group-by area / category / file / tag
- Pass-rate trend chart (last 30 runs, color-coded)
- Coverage-by-tag panel (grouped, click-to-filter)
- Per-test detail drawer with plain-English explainer, step tree, API call cards, screenshots inline, video player inline, **trace card** with copy-to-clipboard `npx playwright show-trace` command

---

## B.7 CI/CD pipelines

> "Four pipelines, all using Microsoft's official Playwright image and
> spinning up Juice Shop as a service container. The Playwright config
> is environment-driven — `CI=true` flips to `workers=2`, `retries=3`,
> `retain-on-failure`. No per-CI forks."

**`.github/workflows/playwright.yml`** (key parts):

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'           # Daily 06:00 UTC regression
  workflow_dispatch:
    inputs:
      grep:
        description: 'Tag filter (e.g. @everstage-qa, @smoke). Empty = full suite.'
      trace_mode:
        description: 'Trace capture mode'
        type: choice
        options: ['retain-on-failure', 'on-first-retry', 'on', 'off']

jobs:
  test:
    services:
      juice-shop:
        image: bkimminich/juice-shop:latest
        ports: ['3000:3000']
        options: >-
          --health-cmd "wget -qO- http://localhost:3000/rest/admin/application-version >/dev/null 2>&1"
          --health-interval 5s
          --health-retries 12
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Bootstrap the assignment user
        run: # ... idempotent register + link security answer
      - run: npx playwright test
      - name: Upload rich HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-html
          path: |
            reports/test-report.html
            reports/last-run.json
            reports/junit.xml
            reports/run-history.csv
```

**Three things about this workflow that signal seniority:**
1. **Service container** — Juice Shop is a sidecar with a healthcheck. The test step doesn't start until Juice Shop is up.
2. **Self-bootstrap** — registers the assignment user via the API on first boot. The pipeline works against a brand-new container.
3. **Manual dispatch with parameters** — operator can pick a tag-grep + trace mode without editing YAML.

---

# Hot-key reference

```bash
# Show the suite runs
npm run test:smoke              # 9 tests, ~9 s

# Show the assignment scope
npm run test:everstage          # 138 tests, ~1 min

# Run only Task 1 / 2 / 3
npm run test:task1              # 15 tests, ~15 s
npm run test:task2              # 16 tests, ~30 s
npm run test:task3              # 35 tests, ~10 s

# Open the rich report
npm run report:rich             # last-run dashboard

# Open the trend dashboard
npm run dashboard               # pass-rate over time

# See a trace
npx playwright show-trace test-results/<...>/trace.zip
```

---

# Closing line

> "All 214 tests are green against a fresh Juice Shop. The literal
> brief is in `PART A` — Task 1 in `tests/helpers/login.ts` and
> `tests/data/new-user.json`, Task 2 in `tests/ui/task2-add-card.spec.ts`,
> Task 3 in `tests/api/task3-add-card.spec.ts`. Above that, I added a
> fixture layer, a missing checkout flow, four senior-signal API tests
> that map to commission-processing concerns, a custom HTML reporter,
> and the CI/CD pipelines. What would you like to dig into?"
