# Code Analysis — interview deep-dive

> The nuclear-option prep doc. Walks every file in the repo, explains
> *why* it exists, and lists the questions an interviewer is likely to
> ask along with **prepared answers** you can read aloud.
>
> Companion to [`CODE-TOUR.md`](./CODE-TOUR.md) (5-minute demo script)
> and [`INTERVIEW-PREP.md`](./INTERVIEW-PREP.md) (Q&A general tactics).
> This doc is exhaustive — keep it open in a side window during the call.

## Table of contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Test data](#2-test-data)
3. [Helpers (7 files)](#3-helpers)
4. [Page Object Models (12 files)](#4-page-object-models)
5. [Fixtures](#5-fixtures)
6. [The three task specs](#6-the-three-task-specs)
7. [Supporting API specs](#7-supporting-api-specs)
8. [Supporting UI specs](#8-supporting-ui-specs)
9. [Reporters](#9-reporters)
10. [Config files](#10-config-files)
11. [CI/CD](#11-cicd)
12. [Cross-cutting concerns](#12-cross-cutting-concerns)
13. [Anticipated questions (50+)](#13-anticipated-questions)
14. [Quick-find map](#14-quick-find-map)

---

## 1. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│  tests/data/new-user.json     ← assessment user credentials     │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  tests/helpers/  (pure functions, no state)                     │
│    ├─ banners.ts        suppress Juice Shop's 3 banners         │
│    ├─ card.ts           uniqueCardNumber() — 10¹² values         │
│    ├─ login.ts          loginBeforeEach() — Task 1 script       │
│    ├─ user.ts           uniqueEmail() + freshUser() factories   │
│    ├─ api.ts            loginViaApi, loginSession, find product │
│    ├─ logged-request.ts wraps APIRequestContext + attaches JSON │
│    └─ seed.ts           clearBasket, seedAddress, seedCard, …   │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  tests/fixtures.ts  (custom Playwright fixtures)                │
│    ├─ apiSession        REST login → { token, bid, email }      │
│    ├─ authenticatedPage UI login + banners gone                 │
│    └─ seededCheckout    basket clean + address + card + product │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  tests/pages/   (Page Object Models — 12 files)                 │
│  tests/ui/      (UI specs — 14 files, ~1.6k LoC)                │
│  tests/api/     (API specs — 16 files, ~2.5k LoC)               │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  tests/reporters/                                               │
│    ├─ csv-reporter.ts  per-run CSV + history dashboard          │
│    └─ rich-reporter.ts self-contained HTML with search/filter   │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  .github/workflows/playwright.yml   ← active CI                 │
│  ci-examples/{gitlab,jenkins,azure} ← drop-in equivalents       │
└─────────────────────────────────────────────────────────────────┘
```

**The mental model in one sentence:** *data flows down through pure
helpers, fixtures compose those helpers and supply them to tests,
tests use page objects to drive the UI or the API directly, and the
output flows back up to two reporters.*

**Why this layout works:**

- **Helpers are pure** — no shared state, easy to test, easy to reason
  about. The 7 helper files total ~600 LoC and have zero overlap.
- **Fixtures are lazy** — a test that doesn't ask for `seededCheckout`
  doesn't pay for it. Playwright instantiates per test, per declared
  parameter.
- **POMs are dumb** — they hold locators and intent methods, no
  assertions, no orchestration. Tests are the only place expectations
  live.
- **Specs are tag-rich** — every test carries 3-6 tags so the same
  suite is a 9-second smoke gate AND a 2-minute regression run.

---

## 2. Test data

### `tests/data/new-user.json` (4 lines)

```json
{
  "email": "everstage-qa-mox3mxq8@juice.test",
  "password": "Everstage@123",
  "securityQuestionId": 1,
  "securityAnswer": "Everstage"
}
```

**Purpose:** Task 1's literal ask. Credentials for the user I
manually registered in the Juice Shop UI.

**Decisions:**
- **JSON over env vars** because the brief says
  `"add their credentials [to] the new-user.json file"` verbatim. In
  CI I'd switch to env vars + a secrets manager.
- **Typed import** — `import user from '../data/new-user.json'`. With
  `resolveJsonModule: true` in `tsconfig.json`, a typo on a field name
  is a *compile-time* error.
- **Security answer + question id** included so forgot-password and
  reset-related tests can use the same user without re-registration.

**If they ask: "Why not env vars?"**
> "The brief said `new-user.json` literally. I respected the wording.
> In a production setup I'd parameterize — read from env vars with the
> JSON file as a fallback, so locally I work from `new-user.json` and
> CI gets credentials from GitHub Secrets without code changes."

**If they ask: "Isn't committing a password to git unsafe?"**
> "For a Juice Shop test user on localhost, this is the equivalent of
> a fixture username. Juice Shop is intentionally vulnerable; this
> user has zero real-world reuse. For a real product I'd use a CI
> secrets manager and the JSON would only carry the email."

---

## 3. Helpers

### 3.1 `tests/helpers/banners.ts` (20 lines)

```ts
export async function suppressBanners(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.cookie = 'welcomebanner_status=dismiss; path=/';
    document.cookie = 'cookieconsent_status=dismiss; path=/';
    document.cookie = 'language=en; path=/';
  });
}
```

**Why this exists:** Juice Shop layers three intercepts on first
paint — a welcome dialog, cookie consent bar, and language snackbar
— that all sit on top of the form fields. Click-to-dismiss races
with page paint, especially in headless mode.

**Why `addInitScript` and not `page.addCookies`:** `addInitScript`
runs *before every page load*, so the cookies are set as the document
is being parsed. With `addCookies` you have a tiny window where the
DOM is up but the cookies haven't been applied yet — that's where
the banners briefly flicker into existence.

**Three cookies, three banners — one helper.**

**If they ask: "Could you just dismiss them with click events?"**
> "Yes, but it's flaky. The welcome dialog and cookie bar can render
> in any order depending on network timing, and they sometimes get
> hidden behind each other. Pre-seeding cookies eliminates the race
> entirely — the banners never even render."

---

### 3.2 `tests/helpers/card.ts` (10 lines)

```ts
export function uniqueCardNumber(): string {
  const seed = Math.floor(Math.random() * 1e12)
    .toString().padStart(12, '0');
  return `4111${seed}`;
}
```

**Purpose:** make Task 3's *unique* card requirement actually unique.

**Math:** `4111` prefix (Visa test space) + 12 random digits =
**10¹² possible values**. Two parallel workers in the same
millisecond have a vanishing collision probability.

**Why random and not timestamp:** A timestamp-based id would collide
when two test workers in CI start in the same millisecond (and
parallel test runners CAN start in the same millisecond). Random gives
us probability-zero in practice.

**If they ask: "Why not a sequence counter?"**
> "A sequence counter would need shared state — between specs, between
> workers, across runs. Random is stateless: every call is independent.
> Tradeoff: random allows theoretical collisions; sequence guarantees
> uniqueness. At 10¹² random values the probability of any collision
> across the whole test history is well under one in a million."

---

### 3.3 `tests/helpers/user.ts` (36 lines)

```ts
export function uniqueEmail(prefix = 'qa'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${rand}@juice.test`;
}

export function freshUser(overrides: Partial<FreshUser> = {}): FreshUser {
  return {
    email: uniqueEmail(),
    password: 'StrongPass!23',
    securityAnswer: 'TestAnswer',
    securityQuestionIndex: 0,
    ...overrides,
  };
}
```

**Purpose:** factory for ad-hoc test users (registration tests,
forgot-password tests, IDOR-probe tests where I need a *second* user).

**Why timestamp + random (and not just random):** Email lookups are
visual — when I'm debugging, I want to know *when* a user was created.
The base-36 timestamp at the start of every email is human-readable
("mxp4f3" → today, "mxa9z2" → last week").

**Factory pattern:** `freshUser({ securityAnswer: 'specific' })` lets
each test override only what it cares about. Same pattern as
`validCard()` in the API spec.

---

### 3.4 `tests/helpers/login.ts` (37 lines) — **Task 1 core**

```ts
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
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator('#navbarAccount')).toBeVisible();
}
```

**Why this is the most important file in the assignment:** the brief
explicitly says *"create a login script in the `beforeEach` hook to
login every time a test runs"*. This **is** that script.

**Five intentional design choices:**

1. **Function signature** — takes `page` and `context` separately
   (not just `page`) because banner suppression operates on
   `BrowserContext`, not on a `Page`.
2. **Default params** — `email` and `password` default to the
   assignment user but can be overridden, so a security-probe test
   can call `loginBeforeEach(page, ctx, "wrong@user", "bad")` and use
   the same plumbing.
3. **Two assertions at the end** — URL leaves `/login` AND
   `#navbarAccount` is visible. Both have to pass for the login to be
   considered successful. The URL check is fast; the navbar check
   confirms the post-login render actually happened.
4. **No try/catch** — if login fails, the test must fail. No silent
   recovery; no "log it as a warning."
5. **`Promise<void>` return type** — explicit, satisfies
   `strict: true` in tsconfig.

**If they ask: "Why is this a function and not inline?"**
> "16 specs reuse this exact sequence. If Juice Shop changes the
> login form tomorrow, I fix it in one place. The brief said 'create
> a login script' — that's what a script *is*: reusable code."

**If they ask: "Why default parameters instead of always reading from `new-user.json`?"**
> "It's a small flexibility lever. Most tests use the default —
> they call `loginBeforeEach(page, ctx)` with no args. But a test
> that verifies the *wrong password* flow needs to drive the login
> form with bad credentials. Default params let one helper serve both."

---

### 3.5 `tests/helpers/api.ts` (122 lines)

Houses three exports:

#### `loginViaApi(request, email, password): Promise<string>`

Hits `POST /rest/user/login`, asserts it succeeded, returns the
bearer token. Wraps the response through `logged()` so the request +
response are captured for the rich report.

```ts
export async function loginViaApi(request, email, password) {
  const api = logged(request);
  const response = await api.post('/rest/user/login', { data: { email, password } });
  expect(response.ok(), 'login should succeed').toBeTruthy();
  const body = await response.json();
  expect(body?.authentication?.token).toBeTruthy();
  return body.authentication.token;
}
```

#### `loginSession(request, email, password): Promise<LoginSession>`

Same as above but returns `{ token, bid, email }`. The `bid` (basket
id) lives in the login response — Juice Shop's `whoami` is
cookie-authenticated, so a bearer-only request can't resolve it. By
reading `bid` from the login response we save a round-trip *and* avoid
the cookie-auth trap.

**This is the trickiest design choice in the file.** Initially I had
`whoami`-based basket-id resolution and it returned `undefined` in
the Playwright `request` fixture (which has no cookie jar by default).
Reading `bid` from `/rest/user/login` is the elegant fix.

#### `findStockableProductId(request, token, minQty = 1): Promise<number>`

The most "live-state defensive" function in the codebase. Queries
`/api/Quantitys/` and picks a product with `quantity >= minQty` and
`limitPerUser` either null or large enough.

**Why this exists:** Juice Shop's seed Apple Juice has
`limitPerUser: 5`. After enough test runs, the assessment user hits
that cap and adding ProductId=1 returns 400. Hard-coding ProductId=1
in a test is fragile against accumulated state.

**The `minQty` parameter** is for boundary tests that need >1 of one
item (e.g. "place an order with 3 of one product").

**If they ask: "What was the trickiest bug you hit?"**
> "Apple Juice — Juice Shop's first seed product — gets drained to
> zero quantity across many runs. Some products also have a
> per-user-purchase cap of 5. I initially hard-coded ProductId: 1 in
> tests, and after about 50 runs everything started 400'ing with
> 'out of stock'. The fix is this helper — query the live quantity
> table at test time and pick a survivor. Defensive coding against
> live data."

---

### 3.6 `tests/helpers/logged-request.ts` (121 lines)

The wrapper that makes the rich report's API-call panel possible.

```ts
export function logged(request: APIRequestContext): LoggedClient {
  const wrap = (verb: 'get' | 'post' | 'put' | 'delete') =>
    async (url: string, init: RequestInit = {}): Promise<APIResponse> => {
      const startedAt = Date.now();
      const response = await request[verb](url, init);
      await attachApiCall(verb.toUpperCase(), url, init, response, startedAt);
      return response;
    };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), delete: wrap('delete') };
}
```

**What it does:** wraps the four common HTTP verbs on
`APIRequestContext`. Every call captures method + URL + headers +
body, hits the server, captures the response status + headers + body,
and uses `test.info().attach()` to bind a JSON blob to the running
test as a Playwright attachment.

**Why a wrapper and not a global Playwright API hook:** Playwright
doesn't have a built-in "intercept all API requests" hook for
`APIRequestContext` (that exists for `page.route()` on the UI side,
but not for API tests). A wrapper is the cleanest way.

**Header redaction:**

```ts
const REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie'];
function redactHeaders(headers) {
  // ... replaces every sensitive header value with
  // `<first-12-chars>…(redacted)`
}
```

So the rich report can show that a request *was* authenticated
without leaking the full bearer token.

**If they ask: "How are you not leaking credentials in your reports?"**
> "Three things. One: the `logged()` wrapper redacts authorization
> and cookie headers — only the first 12 characters of any bearer
> token show, the rest is `(redacted)`. Two: the JSON file in
> `tests/data/` is a Juice Shop test user, not a real one. Three: in
> CI the credentials come from GitHub Secrets, not the JSON."

---

### 3.7 `tests/helpers/seed.ts` (180 lines)

Single source of truth for "make Juice Shop look like a fresh customer."

Six exports:
- `clearBasket(request, token, basketId)` — empties BasketItems
- `seedBasket(request, token, basketId, productId, quantity)` — adds one product
- `seedAddress(request, token, overrides?)` — POSTs to `/api/Addresss/`
- `seedCard(request, token, overrides?)` — POSTs to `/api/Cards/` with a fresh `uniqueCardNumber()`
- `clearCards(request, token)` — deletes every card on the account
- `defaultDeliveryMethodId(request, token)` — GETs `/api/Deliverys` and returns `data[0].id`

**Why every function takes `request + token` as parameters:** keeps
them stateless and reusable from any test, any fixture, any layer.
No global session.

**Why `seedBasket` is loud on failure** — it throws with the actual
response body:

```ts
if (![200, 201].includes(response.status())) {
  const body = await response.text();
  throw new Error(
    `seedBasket failed (status ${response.status()}, product ${productId}): ${body}`
  );
}
```

Default Playwright would say "expected 201, received 400" with no
clue why. This wrapper surfaces the actual error from Juice Shop
("We are out of stock!") so the next person debugging a flake doesn't
have to fire up the trace viewer.

---

## 4. Page Object Models

12 POMs in `tests/pages/`, each one per page. Common pattern:

```ts
export class XyzPage {
  readonly page: Page;
  readonly locatorA: Locator;
  readonly locatorB: Locator;

  constructor(page: Page) {
    this.page = page;
    this.locatorA = page.locator('#stable-id');     // tier 1
    this.locatorB = page.getByRole('button', ...);  // tier 2
  }

  async goto(): Promise<void> { ... }
  async intentMethod(...): Promise<void> { ... }
}
```

**Selector hierarchy (best → worst):**

| Tier | Example | Why stable |
|---|---|---|
| 1. Stable IDs | `#submitButton`, `#navbarAccount` | Public DOM contract; survives Material upgrades |
| 2. ARIA role + name | `getByRole('menuitem', { name: 'Show Orders…' })` | Part of WCAG; doubles as a11y check |
| 3. ARIA label | `getByLabel('Card Number')` | Same stability story, form-field scoped |
| 4. Tag + text/regex | `locator('simple-snack-bar', { hasText: /saved/i })` | For elements without ARIA roles |

**Anti-patterns I avoid:**
- ❌ Auto-generated Material classes (`.mat-mdc-button-base`)
- ❌ Positional XPath (`//div[3]/button[1]`)
- ❌ Auto-generated mat-ids (`mat-radio-155-input`)

### Per-page deep-dives:

#### `LoginPage.ts` (30 lines)

Three locators — `#email`, `#password`, `#loginButton`. Two methods —
`goto()` and `attemptLogin(email, password)`. The simplest POM in the
suite; nothing to over-engineer.

#### `RegisterPage.ts` (103 lines) — most-complex form POM

Handles the security-question dropdown which is a `mat-select` —
trickier than a regular `<select>` because Material renders an
overlay. Has helper `pickSecurityQuestion(index)` that tries 3
different open strategies (click, focus+ArrowDown, JS-dispatched
click on the inner trigger) — Material's mat-select intermittently
swallows the first click as a "gain focus" event without opening the
overlay.

**If they ask: "Why three strategies?"**
> "Empirically observed flake. mat-select sometimes processes the
> first click as a focus event without opening the panel. I tried
> debouncing with explicit waits — flaky. Then I tried different
> open techniques in sequence — works every time. This is exactly the
> kind of fragility a POM hides from the test."

#### `PaymentPage.ts` (58 lines) — **Task 2 core**

Eleven locators, four methods: `openMyPayments()`,
`expandAddCardPanel()`, `addCard()`, and the `confirmation` locator.

The most interesting line:
```ts
this.confirmation = page.locator('simple-snack-bar', { hasText: /card.*saved/i });
```

— a regex-text match scoped to a tag, not an ID. Why? The snackbar
element has no ID, role, or aria-label — Juice Shop's i18n team
renders different text depending on locale. The regex catches "card
saved", "Card has been saved", "card was saved" etc. without
hard-coding any specific wording.

#### `BasketPage.ts` (110 lines)

Contains `addFirstProductToBasket()` which is more clever than its
name suggests. It:
1. Calls `findStockableProductId()` to pick a product on page 1 of
   the alphabetically-sorted grid that has stock AND no per-user limit
2. Clicks that product's specific card (not just "card index 0")
3. Returns the snackbar locator so the test can `await` it

**This is the bit that turned a flaky basket test into a stable one.**

#### `CheckoutPage.ts` (96 lines)

Drives the 5-step checkout funnel:
`basket → /#/address/select → /#/delivery-method → /#/payment/shop → /#/order-summary → /#/order-completion/{id}`

Each step has its own "continue" button with a different `aria-label`:
- Address page: `"Proceed to payment selection"`
- Delivery page: `"Proceed to delivery method selection"` (sic — points to payment)
- Payment page: `"Proceed to review"`

— I anchor on the `aria-label` rather than the visible "Continue"
text because every step has a button labeled "Continue" and they're
all visible simultaneously in the DOM if a previous step's panel
isn't fully unmounted.

#### `OrderHistoryPage.ts` (45 lines)

Simple POM for `/#/order-history`. Two methods — `openFromAccountMenu()`
(account dropdown → Orders & Payment → Order History) and `goto()`
for direct navigation. Three locators including `firstRow` which the
order-placed-successfully test asserts visibility on.

#### `AddressPage.ts`, `ChangePasswordPage.ts`, `ContactPage.ts`, `ForgotPasswordPage.ts`, `ProductPage.ts`, `SearchPage.ts`

Smaller POMs (30-90 lines each) for the supporting suite. Each one
follows the same constructor + intent-methods pattern. The
`AddressPage` deals with the same `mat-select`-overlay issue as
`RegisterPage` (country dropdown).

---

## 5. Fixtures

### `tests/fixtures.ts` (78 lines)

Three custom Playwright fixtures via `test.extend`:

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
    await expect(page).not.toHaveURL(/login/);
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
    await use({ token, basketId, addressId, cardId, productId, deliveryMethodId });
  },
});
```

**Three things to mention:**

1. **`Promise.all`** in `seededCheckout` — the four seed steps are
   independent, so they run in parallel. This is the kind of detail
   that matters when you have 50+ checkout tests.

2. **Composition** — `seededCheckout` declares `apiSession` as a
   dependency. Playwright resolves it automatically; the fixture
   doesn't reimplement login.

3. **Laziness** — a test that declares `async ({ page })` doesn't pay
   for `seededCheckout`. Playwright only instantiates the fixtures a
   test asks for.

**If they ask: "Why have BOTH `loginBeforeEach` AND `authenticatedPage`?"**
> "The brief literally says 'create a login script in the beforeEach
> hook'. That's `loginBeforeEach()` — a function I call from
> `test.beforeEach`. The fixture (`authenticatedPage`) is a
> refinement on top — same logic, packaged as a Playwright fixture
> so newer specs can declare `async ({ authenticatedPage })` instead
> of writing the beforeEach. Both work, both call the same login
> under the hood — there's exactly one way to log in. The
> coexistence is intentional: literal brief + senior idiom."

---

## 6. The three task specs

### 6.1 `tests/ui/task1-login.spec.ts` (254 lines, 15 tests)

**The brief:** *Manually create a new user and add their credentials
the new-user.json file. Then create a login script in the beforeEach
hook to login every time a test runs.*

**Structure — two describe blocks:**

```ts
test.describe('Login - UI (Task 1: beforeEach login)', () => {
  test.describe('authenticated session', () => {
    test.beforeEach(async ({ page, context }) => {
      await loginBeforeEach(page, context);  // ← THE LITERAL BRIEF
    });
    // 4 tests that assume "already logged in"
  });

  test.describe('login form validation', () => {
    test.beforeEach(async ({ context }) => {
      await suppressBanners(context);
      // intentionally skip the login — these tests drive the form
    });
    // 11 tests for wrong-password, SQLi, XSS, boundary, load
  });
});
```

**Why two describe blocks:** Tests that verify the *login form itself*
(e.g. "wrong password is rejected", "SQLi doesn't bypass auth") can't
start "already logged in" — they need to drive the form. So they
share banner suppression but skip the credential submission.

**Test coverage:**
- 4 positive — beforeEach-logged-in, account menu visible, whoami,
  logout flow
- 5 negative — empty fields, wrong password, unregistered email,
  whitespace-only, case mismatch
- 3 security — SQLi auth bypass (documented vuln), XSS, no email
  enumeration
- 2 boundary — very long email, very long password
- 1 load — 5 sequential failed logins don't lock/5xx

**If they ask: "Walk me through TC-UI-120."**
> "It's the documented SQL-injection authentication bypass — one of
> Juice Shop's headline OWASP challenges. Passing
> `' OR 1=1--` as email and any password logs you in as admin. I
> assert the *actual* unsafe behavior (URL leaves /login, navbar
> visible) so the test passes on the default unsafe build. The
> comment in the test says how to flip the assertion on a hardened
> build. The point is to keep the suite green while making the gap
> visible in code review."

---

### 6.2 `tests/ui/task2-add-card.spec.ts` (565 lines, 23 tests)

**The brief:** *Create a UI test that navigates to My Payments options
from homescreen and add card details.*

**The literal-brief test:**

```ts
test('[TC-UI-001] User can add card details from My Payment Options',
  { tag: ['@task2', '@everstage-qa', '@positive', '@smoke', '@e2e'] },
  async ({ page }) => {
    const paymentPage = new PaymentPage(page);
    await paymentPage.openMyPayments();
    await paymentPage.addCard({
      name: 'Everstage QA',
      number: uniqueCardNumber(),
      month: '5',
      year: '2080',
    });
    await expect(paymentPage.confirmation).toBeVisible();
    await expect(
      page.locator('mat-cell, td.mat-cell', { hasText: card.number.slice(-4) }).first()
    ).toBeVisible();
  });
```

**Two assertions, intentional:**
- **Snackbar visible** — confirms the form fired.
- **Row in table with last-4 digits** — confirms the data
  round-tripped *and* that only the last 4 digits show (PCI hint).

**The `beforeEach` does cleanup, not setup:**

```ts
test.beforeEach(async ({ page, context, request }) => {
  // Clear all cards via API so the saved-cards table doesn't balloon
  // to 100+ rows across many runs. Angular re-renders the whole table
  // on every add and the 5s assertion timeout starts firing.
  const session = await loginSession(request, user.email, user.password);
  const headers = { Authorization: `Bearer ${session.token}` };
  const list = await request.get('/api/Cards/', { headers });
  for (const card of (await list.json()).data) {
    await request.delete(`/api/Cards/${card.id}`, { headers });
  }
  await loginBeforeEach(page, context);
});
```

**Why cleanup-first beats per-test wait:** waiting longer doesn't fix
the problem — the page just takes longer. Resetting state does. This
is one of those patterns that scales: 16 tests, 100+ test runs, table
always renders in <1s.

**23 tests broken down:**
- 4 positive (TC-UI-001..004)
- 4 negative form-validation
- 3 security (XSS, SQLi-name, PAN masking)
- 3 boundary (min/max year, 200-char name)
- 2 load + perf (5 cards, P95 latency)
- Plus 7 newer ones for the live-probed defects

---

### 6.3 `tests/api/task3-add-card.spec.ts` (1066 lines, 55 tests)

**The brief:** *Create an API test that adds a unique card details.*

**Why this is the biggest spec in the suite:** the API surface is
the richest — every input field, every header, every status code is
testable in 30ms. So I went deep.

**Structure (in order):**
1. Positive cases (TC-API-001..005) — POST, GET, DELETE, masking, max year
2. Negative — validation (TC-API-101..114) — bad expMonth/Year, missing fields, types
3. Security (TC-API-120..125) — SQLi/XSS in name, mass-assignment, JWT tamper, oversized, IDOR
4. Boundary (TC-API-130..134) — expMonth=1/12, expYear=2080/2100, 16-digit
5. Load (TC-API-140..142) — 10 concurrent, 25 sequential, P95 latency budget
6. Senior-signal tests (TC-API-150..156) — idempotency, race, schema, PATCH semantics, content-type, Unicode, cross-layer
7. Live-probed defects (TC-API-160..168) — discovered via Playwright MCP exploration of the running app

**The four senior-signal tests** are the differentiators in any
review. Walk through them on Slide 6 of the deck:

- **TC-API-150** Idempotency — re-posting an identical card is
  accepted (no de-dup). Maps to commission duplicate-entry risk.
- **TC-API-151** Concurrent race — two parallel POSTs of the same
  card; neither 5xx, neither lost.
- **TC-API-152** Schema contract — required fields present, banned
  fields (`cvv`, `pin`, `pan`) absent.
- **TC-API-156** Cross-layer consistency — card created in one
  session is visible to a fresh-session GET. Catches the
  "write went nowhere" / cache-only failure mode.

**The `validCard()` factory** at the top:

```ts
const validCard = (overrides: Partial<CardPayload> = {}): CardPayload => ({
  fullName: 'API Test User',
  cardNum: uniqueCardNumber(),
  expMonth: 5,
  expYear: 2080,
  ...overrides,
});
```

Every test starts from the same baseline and overrides only what it
needs. So a boundary test reads `validCard({ expYear: 2079 })`
instead of 4 lines of object literal — easier to scan and harder to
typo.

**If they ask: "Why so many tests for one endpoint?"**
> "The brief specifically called out 'unique card' — so the headline
> is about uniqueness. But every public POST endpoint has a contract:
> what status codes does it return, what shapes does it accept, what
> security probes does it survive, what happens under load. I treat
> each one as a contract test. Forty-six of these are status-code
> assertions that take milliseconds each — the full file runs in
> under 12 seconds. The ROI on coverage breadth is enormous."

---

## 7. Supporting API specs

15 more API specs in `tests/api/`. Brief tour:

| Spec | LoC | Purpose |
|---|---|---|
| `address.spec.ts` | 86 | CRUD on `/api/Addresss/` (typo in Juice Shop endpoint, intentional) |
| `basket.spec.ts` | 113 | POST `/api/BasketItems/`, documented zero/negative-qty vulns |
| `captcha.spec.ts` | 62 | `/rest/captcha/`, throttling under load |
| `complaint.spec.ts` | 80 | Form POSTs, file-upload edge cases |
| `deliveries.spec.ts` | 46 | `/api/Deliverys` catalog test |
| `feedback.spec.ts` | 92 | Customer feedback POST, XSS in comment |
| `login.spec.ts` | 52 | Original API login probe (existed before assignment) |
| `order-flow.spec.ts` | 418 | Full checkout funnel — basket → checkout → track-order |
| `products.spec.ts` | 63 | `/api/Products/` list / search |
| `recycle.spec.ts` | 113 | `/api/Recycles/` — Juice Shop's quirky recycle-pickup endpoint |
| `register.spec.ts` | 68 | `/api/Users/`, password-rule probes, duplicate-email |
| `track-order.spec.ts` | 42 | `/rest/track-order/{id}` |
| `two-factor.spec.ts` | 55 | `/rest/2fa/setup`, `/rest/2fa/verify` |
| `wallet.spec.ts` | 48 | `/rest/wallet/balance` and top-up |
| `whoami.spec.ts` | 81 | `/rest/user/whoami` cookie-auth quirks |

**Why include the supporting specs in an assignment for Task 3?** Two reasons:
1. **Demonstrates the same architectural patterns at scale** — POMs,
   logged() wrapping, tag taxonomy.
2. **Catches real Juice Shop bugs** the brief didn't ask about (e.g.
   captcha doesn't actually throttle, recycle endpoint accepts
   negative quantity, wallet allows arbitrary top-up).

---

## 8. Supporting UI specs

14 more UI specs in `tests/ui/`:

| Spec | LoC | Purpose |
|---|---|---|
| `accessibility.spec.ts` | 87 | axe-core scan (recent addition) |
| `account-areas.spec.ts` | 38 | Logged-in account pages reachable |
| `address.spec.ts` | 87 | UI address create/edit |
| `basket.spec.ts` | 126 | Basket add/inc/dec/delete |
| `change-password.spec.ts` | 68 | `/#/privacy-security/change-password` |
| `contact.spec.ts` | 68 | Customer-feedback form |
| `extra-pages.spec.ts` | 129 | About / Score Board / Wallet UI |
| `forgot-password.spec.ts` | 61 | `/#/forgot-password` flow |
| `navigation.spec.ts` | 41 | Header / sidenav / footer routing |
| `order-flow.spec.ts` | 226 | Full checkout funnel UI |
| `product-reviews.spec.ts` | 48 | Read / write reviews |
| `register.spec.ts` | 88 | `/#/register` form |
| `search.spec.ts` | 54 | XSS in search, empty state |

---

## 9. Reporters

### 9.1 `tests/reporters/csv-reporter.ts` (711 lines)

**Purpose:** historical trend data. Appends one CSV row per test per
run to `reports/run-history.csv`, then regenerates
`reports/dashboard.html` from the rolling history.

**Why CSV:** trivially diffable, opens in Excel, importable into
anything. Future-proof — even if my fancy HTML reporter dies, the
CSV history is still readable in 10 years.

**Three artifacts written:**
- `reports/run-history.csv` — append-only history (every test of every run)
- `reports/dashboard.html` — per-test pass-rate over the last 30 runs
- `reports/summary.md` — for PR-comment / Slack-paste

### 9.2 `tests/reporters/rich-reporter.ts` (1885 lines) — **the big one**

**Purpose:** single self-contained HTML report (`reports/test-report.html`)
with search, filter chips, charts, and per-test detail drawers.

**The reporter class** is short (~150 lines). Collects per-test data
via `onTestEnd`, including:
- Status, duration, retry count
- Error message + stack
- Step tree (all `await test.step(...)` calls)
- Attachments (screenshots, videos, traces, JSON dumps from `logged()`)
- stdout / stderr capture

**The rest of the file** (~1700 lines) is two big template strings:
- `STYLE` — inlined CSS (zero CDN — opens offline)
- `SCRIPT` — vanilla JS that runs in the browser to render the
  dashboard from the embedded JSON

**Why no framework:** the report has to open as a single file. A
React build would mean a `<script>` tag pointing somewhere. Vanilla
JS + a `document.createElement` helper is ~200 lines of plumbing.

**What it can do that Playwright's default report cannot:**
- Live search bar (focus-preserving across re-renders — fixed in an earlier round)
- Filter chips for "Assignment scope" (`@everstage-qa`, `@task1/2/3`)
- Per-test inline API request/response cards (the rich reporter
  parses `api-call:*` attachments from `logged()` back into structured form)
- Trace cards with copy-to-clipboard `npx playwright show-trace` command
- Pass-rate trend chart (color-coded green/lime/amber/red)
- Coverage-by-tag panel grouped by purpose

**If they ask: "Why custom reporter, not Allure?"**
> "Three reasons. One: Allure needs a Java runtime and a generation
> step — this reporter is a single HTML, opens offline, mailable.
> Two: it knows about *this* assignment — chip-row groups are tuned
> for the brief, API request/response panels are inline. Three: the
> trace card's copy-show-trace button doesn't exist anywhere else.
> If your team prefers Allure, the JUnit XML output is still emitted
> so a downstream Allure step would still work."

---

## 10. Config files

### `playwright.config.ts` (60 lines)

Three things to call out:

**1. Environment-driven config**
```ts
const isCI = !!process.env.CI;
const traceMode = process.env.TRACE_MODE ?? (isCI ? 'retain-on-failure' : 'on');
```
Local → traces on every test (rich report populated). CI →
retain-on-failure (smaller artifacts). One config, no per-CI forks.

**2. Reporter array**
```ts
reporter: [
  ['list'], ['html', ...], ['junit', ...],
  ['./tests/reporters/csv-reporter.ts'],
  ['./tests/reporters/rich-reporter.ts'],
  ...(process.env.GITHUB_ACTIONS ? [['github']] : []),
],
```
Multiple reporters in parallel. The GitHub Actions annotation
reporter is conditionally added only when running in GH.

**3. CI-only retry bump**
```ts
retries: isCI ? 3 : 2,
workers: isCI ? 2 : 1,
```
CI absorbs more transient flakes (network blips, slow runners).
Locally one worker so a reviewer can watch a headed run end-to-end.

### `package.json` (~35 npm scripts)

Worth memorizing:
- `npm test` — full suite
- `npm run test:smoke` / `:regression` / `:e2e` — CI gates
- `npm run test:task1` / `:task2` / `:task3` — per-task slices
- `npm run test:everstage` — the 84 assessment tests
- `npm run demo` — assessment with traces + opens report (your demo button)
- `npm run report:rich` — opens the rich report
- `npm run dashboard` — opens the trend dashboard

### `tsconfig.json` (~12 lines)

`strict: true`, `resolveJsonModule: true`, ES2022 target. Catches
typos at compile time. The `resolveJsonModule: true` is why
`import user from '../data/new-user.json'` works AND why missing
fields are compile errors.

---

## 11. CI/CD

### `.github/workflows/playwright.yml` (~180 lines)

The active workflow:
- Triggers: push to main, PRs, daily 06:00 UTC, manual dispatch (with
  tag-grep + trace-mode inputs)
- Service container: `bkimminich/juice-shop:latest`
- Bootstrap step: registers the assignment user + links the security
  answer via API (idempotent — works on a fresh container)
- Concurrency group: cancels in-progress runs on the same branch
- Artifacts: rich report HTML, traces, JUnit XML, run-history CSV — retained 30 days

### `ci-examples/`

Drop-in equivalents for GitLab CI, Jenkins, Azure DevOps. None of
them are active — they're reference templates. All four pipelines
use Microsoft's official Playwright Docker image so browsers + OS
deps ship preinstalled.

### `.github/workflows/pages.yml`

Publishes `docs/site/index.html` to GitHub Pages (the AI-generated
submission landing page).

---

## 12. Cross-cutting concerns

### Locator strategy
Already covered in §4. Strict 4-tier hierarchy. Open
`PaymentPage.ts` for the canonical example.

### Test data strategy
- `tests/data/new-user.json` — fixture data
- `tests/helpers/{card,user}.ts` — runtime-unique generators (10¹²
  values each)
- `tests/helpers/api.ts#findStockableProductId` — live-state-defensive picker
- Sensitive data redacted in `logged-request.ts`

### Tagging strategy
Every test carries 3–6 tags:
- **Scope**: `@everstage-qa` + `@task1/2/3`
- **Type**: `@positive`, `@negative`, `@boundary`, `@security`, `@load`
- **Axis**: `@functional`, `@nonfunctional`
- **CI gate**: `@smoke`, `@regression`, `@e2e`

Compose with `--grep`. The same suite is a 9-second smoke gate AND
a 2-minute nightly regression.

### Reporting strategy
Two reporters in parallel:
- `csv-reporter.ts` — long-term history + trend dashboard
- `rich-reporter.ts` — per-run dashboard with search/filter/API/traces

Standard Playwright HTML + JUnit XML also emitted for compatibility.

### CI/CD strategy
- `playwright.config.ts` is environment-driven — `CI=true` flips
  workers/retries/trace mode
- One workflow active (GH Actions), three more in `ci-examples/` for
  copy-paste portability
- Bootstrap step makes the workflow self-contained against a brand-new
  Juice Shop container

---

## 13. Anticipated questions

### Architecture (10)

**Q1. Walk me through your folder structure.**
> "Two top-level: `tests/` for Playwright, `docs/` for human docs.
> Inside `tests/`: `api/` and `ui/` for specs, `pages/` for POMs,
> `helpers/` for pure functions, `fixtures.ts` for the fixture
> layer, `data/` for fixture data, `reporters/` for the two custom
> reporters. No nesting beyond two levels — Playwright's `--grep`
> handles cross-cutting slices."

**Q2. Why Playwright over Cypress / WebdriverIO?**
> "Three reasons. Native API testing via `request` fixture — clean
> for Task 3. Auto-waiting cuts the flake budget in half. Trace
> viewer is best-in-class — step-by-step DOM snapshots are gold
> for debugging."

**Q3. Why TypeScript not JavaScript?**
> "Compile-time guard rails. `resolveJsonModule` + `strict: true`
> means a typo on `user.passwod` is a build error instead of a
> 1am production page. For tests specifically — strict types catch
> a whole class of fixture mismatches before they hit the runner."

**Q4. How would you scale this to 500 tests?**
> "Four levers. Shard runners with `--shard 1/N`. Bump
> `workers=4-6` in CI. Switch non-Task-1 tests to `storageState` so
> they reuse a saved session. Slice via tags — smoke runs on every
> PR, regression nightly, security weekly."

**Q5. Why isn't this monorepo?**
> "Single deliverable, single team, single CI pipeline. Monorepo
> adds tooling cost. If this grew to multiple apps under test I'd
> consider it; right now Juice Shop is the only target."

**Q6. Is your code modular?**
> "Three layers: pure helpers → fixtures composing helpers → tests
> consuming fixtures. POMs are dumb — they hold selectors only.
> Specs do orchestration. No file imports another file from the
> same layer; data flows one direction."

**Q7. How do you avoid test interdependencies?**
> "Three mechanisms. One: every test cleans the state it touches
> (`beforeEach` in `task2-add-card.spec.ts` deletes all cards via
> API). Two: unique generators (`uniqueCardNumber`, `uniqueEmail`)
> mean no two tests collide on the same primary key. Three: the
> `seededCheckout` fixture starts every checkout test from a known
> empty basket."

**Q8. What's the most senior pattern in this codebase?**
> "Probably the `logged()` wrapper. It turns every API helper into
> a no-cost source of structured request/response data — every
> shared helper goes through it, auth headers are redacted, and the
> rich reporter renders the calls inline. Without that one wrapper,
> debugging API tests means firing up the trace viewer."

**Q9. Why two ways to log in (`loginBeforeEach` + `authenticatedPage`)?**
> "Brief said 'create a login script in the beforeEach hook' — that's
> `loginBeforeEach`. The fixture (`authenticatedPage`) is a
> refinement on top, declared as a Playwright fixture so newer specs
> can ask for a logged-in page as a parameter. Both call the same
> login under the hood — there's exactly one way to authenticate."

**Q10. What didn't you build that you'd add with more time?**
> "Eight things, in order: visual regression (Playwright snapshots),
> accessibility scan with axe-core globally, contract testing with
> Pact, `storageState` for non-Task-1 specs, per-worker users for
> true parallel safety, mutation testing with Stryker on the helpers,
> Lighthouse / Core Web Vitals checks, and error-boundary tests for
> the SPA."

### Per-task (15)

**Q11. Why is `new-user.json` a JSON file and not env vars?**
> "Brief said `new-user.json` verbatim. In CI I'd switch to env vars
> + GitHub Secrets — the JSON file mirrors that pattern, so the
> import statement doesn't change."

**Q12. What does `suppressBanners` do exactly?**
> "Pre-seeds three cookies — `welcomebanner_status=dismiss`,
> `cookieconsent_status=dismiss`, `language=en` — via
> `addInitScript`, which runs *before* every page load. That makes
> the welcome dialog, cookie consent bar, and language snackbar
> never render in the first place. Click-to-dismiss is racy in
> headless mode."

**Q13. Walk me through `loginBeforeEach`.**
> "Four steps. Suppress banners. Navigate to `/#/login`. Submit the
> credentials via `LoginPage.attemptLogin`. Assert the URL has left
> `/login` AND the navbar account icon is visible. Two assertions
> because URL change is fast but doesn't guarantee the post-login
> render completed — the navbar check guarantees the SPA actually
> hydrated the authenticated state."

**Q14. What if Juice Shop changes the login form tomorrow?**
> "I fix it in one place — `tests/pages/LoginPage.ts`. The three
> locators `#email`, `#password`, `#loginButton` are public DOM
> contract IDs. If they change, I update the POM and every login
> across 16 specs starts working again."

**Q15. Why are there two `describe` blocks in `task1-login.spec.ts`?**
> "Tests in the 'authenticated session' block start *already logged
> in* — the `beforeEach` runs the login script. Tests in 'login form
> validation' need to drive the login form themselves (wrong
> password, SQLi probe, etc.), so they share banner suppression but
> skip the credential submission."

**Q16. Walk me through TC-UI-001 — the literal-brief Task 2 test.**
> "Five lines. Open My Payments via the account menu. Add a card
> with a unique number, expMonth 5, expYear 2080. Assert the
> success snackbar visible. Assert the card row visible in the
> table, matched by the last-4 digits — which is also a PCI check,
> because the test naturally fails if Juice Shop ever echoes back
> the full card number."

**Q17. Why does the `beforeEach` in `task2-add-card.spec.ts` clean up cards?**
> "After many runs the assignment user accumulates 100+ cards.
> Angular re-renders the whole saved-cards table on every add. The
> 5-second assertion timeout starts firing. Cleanup-first means the
> table always renders in <1s. Resetting state is cheaper than
> waiting for state to stabilize."

**Q18. What's `uniqueCardNumber()` doing under the hood?**
> "Visa-prefix 4111 plus 12 random digits. Ten-to-the-twelfth
> possible values — effectively zero collision probability even at
> hundreds of concurrent runs. Pure random rather than timestamp
> because two parallel workers in the same millisecond would
> collide on a timestamp."

**Q19. Why so many tests in `task3-add-card.spec.ts` (55)?**
> "The brief specifically called out 'unique card' — that's the
> headline. But every public POST endpoint has a contract: status
> codes, payload shapes, security probes, performance budgets. Each
> is a millisecond test. The whole file runs in 12 seconds — ROI
> on coverage breadth is enormous."

**Q20. What does TC-API-150 prove?**
> "Idempotency. POST the same card twice. On a hardened build the
> second should return 409 Conflict. Juice Shop accepts both and
> creates two rows — documented as a defect. Direct map to
> commission-de-dup at a sales-comp platform like Everstage:
> posting the same closed-won deal twice can't produce two
> commissions."

**Q21. Walk me through TC-API-151 — the concurrent race test.**
> "Two parallel POSTs of the same card via `Promise.all`. Assertion
> is just 'no 5xx, no lost requests' — acceptable outcomes are
> `[201, 201]` (no de-dup, current behavior) or `[201, 409]`
> (hardened). What's NOT acceptable is a server crash."

**Q22. TC-API-156 — what's special about cross-layer?**
> "It catches the 'write went nowhere' failure mode. I create a card,
> log out, log back in with a fresh token, GET the cards list, assert
> the card is in there. If a write somehow only landed in a server's
> cache and never made it to durable storage, this test catches it."

**Q23. What's the difference between TC-API-160 and TC-API-103?**
> "TC-API-103 is the brief-aligned test: 'POST without auth header
> returns 401'. TC-API-160 is a documented-defect test: 'POST with
> a whitespace-only fullName is *accepted* as a valid name'. The
> first is what Juice Shop does correctly. The second is what
> Juice Shop does wrong — discovered via Playwright MCP probing."

**Q24. How did you find the 9 live-probed defects (TC-API-160..168)?**
> "I drove Juice Shop interactively with Playwright MCP, trying
> edge cases the brief didn't ask about: whitespace-only name,
> numeric name, string expMonth, float expMonth, case-sensitive
> login, untrimmed whitespace, array as password. Some are
> validation gaps — like accepting `'5'` for expMonth. Some are
> usability defects — like case-sensitive email login. One is a
> resilience defect — sending `password: [...]` crashes the server
> with 500."

**Q25. What's the @everstage-qa tag for?**
> "Scope marker. 84 of the 223 tests carry it — that's the
> assessment-relevant subset. The other 139 are extras. With
> `npm run test:everstage` you run exactly the brief, in about a
> minute. With `npm test` you run everything in 2 minutes."

### Engineering decisions (15)

**Q26. Why is `logged-request.ts` a wrapper not a global hook?**
> "Playwright doesn't have a built-in 'intercept all API requests'
> hook for `APIRequestContext`. It exists on the UI side via
> `page.route()`, but not for API tests. A wrapper is the cleanest
> approach. Every shared helper goes through it. Tests that don't
> need the logging can use the raw `request` directly."

**Q27. Why does `seedBasket()` throw with the actual body?**
> "Default Playwright errors say 'expected 201, received 400' with
> no clue why. The next person debugging a flake has to fire up the
> trace viewer to see what the server returned. By throwing with the
> body — `seedBasket failed (status 400, product 1): out of stock` —
> the failure message tells them the cause immediately."

**Q28. Why does the rich reporter have 1885 lines in one file?**
> "Self-containment. The output is a single HTML file. To embed
> CSS and JS, the reporter holds them as TypeScript template
> strings. Could split into multiple files at build time, but
> that would add a build step for what's currently a single .ts
> file. Tradeoff intentional."

**Q29. Why no Allure?**
> "Allure needs Java runtime + generation step. My rich reporter is
> a single HTML, opens offline, knows about *this* assignment (the
> chip-row groups are tuned for the brief), shows API request/response
> inline. Plus JUnit XML is still emitted — if a team prefers
> Allure, downstream chaining works."

**Q30. Why `Promise.all` in `seededCheckout`?**
> "The four seed steps — clear basket, seed address, seed card, find
> stockable product, get delivery method — are independent. Running
> them serially is ~400ms total; in parallel it's ~100ms. With 22
> checkout tests, that saves ~7 seconds per full run."

**Q31. How does `findStockableProductId` work?**
> "Queries `/api/Quantitys/`, filters to products with
> `quantity >= minQty` and either no per-user limit OR a high
> enough limit. Returns the first match. Defensive against
> accumulated state — Apple Juice gets drained to zero across many
> runs, but Banana Juice (stock 97, no limit) stays addable."

**Q32. What's `minQty` for?**
> "The high-quantity boundary test seeds 3 of one product. Without
> `minQty`, if the picked product has only 2 left, the third
> `seedBasket` call would 400. By passing `minQty=3`, the helper
> filters to products with enough stock for the full operation."

**Q33. Why three custom fixtures (`apiSession`, `authenticatedPage`, `seededCheckout`)?**
> "Three different costs, three different scopes. `apiSession` is
> 'just a token' — cheap, used by all API tests. `authenticatedPage`
> is 'a logged-in browser page' — costs a browser launch, used by
> all UI tests. `seededCheckout` is 'full backend state for a
> checkout' — most expensive, used only by checkout tests.
> Playwright instantiates them lazily based on what each test
> declares."

**Q34. Why do you set `forbidOnly: isCI`?**
> "If someone leaves a `.only()` on a single test and pushes to CI,
> the CI run would silently skip everything else and pass. With
> `forbidOnly: true`, the run errors out — 'test.only is forbidden
> in CI'. Catches a real footgun."

**Q35. Why `workers=1` locally and `workers=2` in CI?**
> "Locally, one worker lets a reviewer watch a headed run
> end-to-end without 4 browser windows popping up. In CI, two
> workers cut the runtime in half — and the order-flow specs are
> designed parallel-safe (every test seeds its own state)."

**Q36. What's the BasketItem unique constraint issue?**
> "Juice Shop's BasketItem table has a unique `(ProductId, BasketId)`
> constraint. POST'ing the same product twice for the same basket
> doesn't bump quantity — it 500s. So every checkout test calls
> `clearBasket()` first, and the increment test uses the basket
> page's plus button instead of two POSTs."

**Q37. Why is `whoami` cookie-auth only?**
> "Juice Shop's `whoami` reads the `token` cookie set by a successful
> login. Playwright's `APIRequestContext` doesn't have a cookie jar
> by default. So a bearer-only request returns `{ user: undefined }`.
> The fix: read `bid` from the login response (it's in there
> alongside the token) instead of asking whoami."

**Q38. How does the report's search bar work?**
> "Vanilla JS `oninput` handler. State is one variable — `state.search`.
> Every keystroke triggers a full re-render of the test list.
> Earlier this destroyed input focus after every character — I fixed
> it by capturing `document.activeElement` + cursor position before
> re-render and restoring after."

**Q39. Why are documented vulns asserted as PASSING (not failing)?**
> "Red tests get ignored over time. If TC-UI-120 (SQLi auth bypass)
> showed as a permanent failure, in 6 months someone would just
> add it to a skip list. By asserting the *actual* unsafe behavior
> as passing, the suite stays green AND the comments make the gap
> visible in code review. A real deploy that fixes the bug makes
> this test fail meaningfully — the assertion has to be flipped."

**Q40. How would you adapt this suite for a different product?**
> "Three layers to swap. `tests/pages/` — replace POMs with the new
> product's pages. `tests/helpers/` — replace login/seed/card with
> the new product's auth/data shapes. `tests/data/new-user.json` —
> new credentials. The fixtures, reporters, CI, and tag taxonomy
> stay the same."

### Live debugging (10)

**Q41. A test fails in CI at 2am. What do you do?**
> "Open the GitHub Actions run, download the `playwright-report-html`
> artifact, open `test-report.html`. Click the failing test. Read
> the plain-English explainer, scan the step tree, check the API
> request/response panel, click the trace card, copy the
> show-trace command, paste into terminal. Three minutes from
> incident to root cause."

**Q42. A test is flaky — passes 9 times, fails 1. How do you debug?**
> "Three layers. One: read the assertion message in the rich report's
> 'flaky' badge tooltip. Two: open the trace.zip for the failed
> attempt — Playwright's trace viewer shows DOM snapshots step-by-step.
> Three: if the cause is still unclear, run that single test in a
> loop locally — `for i in {1..50}; do npx playwright test --grep
> TC-UI-001; done`."

**Q43. Walk me through how you'd diagnose this hypothetical: `expected status 201, received 400`.**
> "Open the rich report. Click the test row. Scroll to API calls.
> Find the POST /api/Cards/ — see the actual request body and the
> actual response body. Almost always the response body explains it:
> 'Validation error: cardNum required' or 'Out of stock' or 'Bad
> bearer token'. Auth headers redacted but enough is shown to know
> the request was authenticated."

**Q44. What if `npm test` fails on first run after a clean clone?**
> "Three things to check, in order. One: is Juice Shop running?
> `curl localhost:3000/rest/admin/application-version`. Two: does
> the assignment user exist? If not, register manually via the UI
> or run the bootstrap step from the GH Actions workflow. Three:
> `npm install` and `npx playwright install chromium` — Playwright's
> browser cache is per-machine."

**Q45. How would you handle a Juice Shop version bump?**
> "Test it locally first: `docker pull bkimminich/juice-shop:latest`,
> restart the container, `npm test`. If anything breaks, the rich
> report tells me which test and which line. Update the affected
> POM (selector drift) or assertion (behavior change). Document in
> a CHANGELOG entry. Pin to a specific tag in production CI."

**Q46. What if Playwright bumps a major version?**
> "Same flow but bigger blast radius. Read the migration guide.
> Pin to the new version. Run the suite locally. Common drift:
> `getByRole` accessibility-name matching gets stricter, or
> trace format changes. POMs absorb most of it; specs rarely need
> changes."

**Q47. How do you handle a slow test?**
> "Profile first. The rich report shows per-step duration in the
> detail drawer. Identify which step is slow. Common causes:
> network round-trip (use `Promise.all`), unnecessary wait
> (replace with assertion), DOM thrash from accumulated state
> (cleanup-first in beforeEach). I'd never `--slowmo` my way out
> of a slow test."

**Q48. A test passes locally but fails in CI. What's your first instinct?**
> "Three suspects, in order. One: timing — CI is slower, network
> is slower; double-check there's no implicit time assumption.
> Two: parallel — CI runs 2 workers, local runs 1. Could be a
> race on shared state (the user's basket, the user's cards).
> Three: trace mode — CI uses `retain-on-failure`, local uses
> `on`. Re-run CI with `TRACE_MODE=on` via workflow_dispatch
> to get a trace."

**Q49. How do you investigate a test that "just hangs"?**
> "Default Playwright timeout is 30s — it'll surface. The trace
> shows what the last action was waiting for. Usually one of:
> a locator that doesn't exist (typo in selector), a Material
> overlay that didn't open (mat-select flake — there's a 3-strategy
> workaround in `RegisterPage`), or a navigation that errored
> silently (cookie missing, server returning HTML for what should
> be JSON)."

**Q50. If you had to debug live during the interview, what would you do first?**
> "Open the rich report — `npm run report:rich`. Click the failing
> test row. Read the assertion message and the API call panel
> first. 90% of failures are obvious from those two pieces. If
> still unclear, copy the show-trace command and open the trace
> viewer. Talk through what I'm seeing — they want to see how I
> *think*, not just the answer."

---

## 14. Quick-find map

| If they ask about… | Open this file | Key lines / functions |
|---|---|---|
| The credentials file | `tests/data/new-user.json` | full file |
| The Task 1 login script | `tests/helpers/login.ts` | `loginBeforeEach()` ~line 23 |
| The Task 1 `beforeEach` call | `tests/ui/task1-login.spec.ts` | lines 20-22 |
| Banner suppression | `tests/helpers/banners.ts` | full file |
| The uniqueness generator | `tests/helpers/card.ts` | `uniqueCardNumber()` |
| The Task 2 happy path | `tests/ui/task2-add-card.spec.ts` | `[TC-UI-001]` ~line 36 |
| The Payment POM | `tests/pages/PaymentPage.ts` | locator declarations 24-34 |
| The Task 3 happy path | `tests/api/task3-add-card.spec.ts` | `[TC-API-001]` ~line 44 |
| The `validCard` factory | `tests/api/task3-add-card.spec.ts` | lines 13-19 |
| The 4 senior-signal tests | `tests/api/task3-add-card.spec.ts` | `TC-API-150..156` |
| Live-probed defects | `tests/api/task3-add-card.spec.ts` | `TC-API-160..168` |
| Custom fixtures | `tests/fixtures.ts` | three exports |
| Logged API wrapper | `tests/helpers/logged-request.ts` | `logged()` ~line 60 |
| Stockable product helper | `tests/helpers/api.ts` | `findStockableProductId()` |
| Seed helpers (clear/add) | `tests/helpers/seed.ts` | 6 exports |
| Locator strategy examples | `tests/pages/PaymentPage.ts` | constructor 24-34 |
| The missing checkout flow | `tests/ui/order-flow.spec.ts`, `tests/api/order-flow.spec.ts` | both files |
| Custom rich reporter | `tests/reporters/rich-reporter.ts` | reporter class ~line 80, render code below |
| CSV history reporter | `tests/reporters/csv-reporter.ts` | `onTestEnd` ~line 60 |
| Playwright config | `playwright.config.ts` | full file (60 lines) |
| The CI pipeline | `.github/workflows/playwright.yml` | service container ~line 67, bootstrap ~line 103 |
| The other CI examples | `ci-examples/{gitlab-ci.yml,Jenkinsfile,azure-pipelines.yml}` | each one |
| Demo shortcuts | `package.json` | `demo`, `demo:task1/2/3` scripts |

---

# Appendix — sentences worth memorizing

For when the answer needs to land in one breath:

- **"The brief literally said `new-user.json` — I respected the wording. In CI I'd parameterize."**
- **"Two assertions, intentional: snackbar visible AND the card row in the table — catches half-failures where the form fires but the data doesn't land."**
- **"10¹² possible values — random not timestamp, so two parallel workers in the same millisecond don't collide."**
- **"The fixture is a refinement on top of the literal beforeEach — both call the same login under the hood."**
- **"Red tests get ignored. Documented green ones don't — that's why I assert vulnerabilities as actual behavior with a hardened-build comment."**
- **"`logged()` redacts authorization and cookie headers — only the first 12 chars of a bearer token show in any attachment."**
- **"Apple Juice gets drained to zero quantity across many runs — `findStockableProductId` queries live state and picks a survivor."**
- **"Tag taxonomy: scope, type, axis, CI gate. The same suite is a 9-second smoke gate AND a 2-minute regression."**
- **"The rich report is a single self-contained HTML — opens offline, mailable, knows about *this* assignment."**
- **"Playwright config is environment-driven — `CI=true` flips workers, retries, and trace mode. No per-CI forks."**
