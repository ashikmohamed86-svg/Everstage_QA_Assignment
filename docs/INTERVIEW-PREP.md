# Everstage QA — Interview prep & code walkthrough

> A field guide to demoing this repository in a 5–30 min pairing
> session. The brief is in [`ASSIGNMENT.md`](./ASSIGNMENT.md). This
> document explains *what to point at*, *why each choice was made*, and
> *what they're likely to ask* — so you can talk while you scroll
> instead of reading code cold.

## Table of contents

1. [Demo scripts (5 / 15 / 30 min)](#demo-scripts)
2. [Task-by-task walkthrough](#task-walkthrough)
   - [Task 1 — `beforeEach` login](#task-1--beforeeach-login)
   - [Task 2 — UI add card](#task-2--ui-add-card)
   - [Task 3 — API add unique card](#task-3--api-add-unique-card)
3. [Locator strategy](#locator-strategy)
4. [Clean-code practices applied](#clean-code-practices-applied)
5. [Anticipated interview questions + answers](#anticipated-interview-questions--answers)
6. [Troubleshooting cheat sheet (live during the call)](#troubleshooting-cheat-sheet)
7. [What I'd add with more time](#what-id-add-with-more-time)

---

## Demo scripts

### 5-minute version (the elevator demo)

| Step | What to do | What to say |
|---|---|---|
| 1 | Open `README.md` | "Three required tasks are checked, plus I added the missing checkout flow. 214 tests, all green, 2-min runtime." |
| 2 | Open `tests/data/new-user.json` | "Task 1 starts here — credentials I registered manually." |
| 3 | Open `tests/helpers/login.ts` | "This is the login script. It runs in the `beforeEach` hook of every spec." |
| 4 | Open `tests/ui/task2-add-card.spec.ts` line 36 | "Task 2 — the happy-path UI add-card. Watch the tags." |
| 5 | Open `tests/api/task3-add-card.spec.ts` line 44 | "Task 3 — the equivalent at the API layer with a unique card per run." |
| 6 | `npm run test:smoke` | (Smoke runs in ~9 s — proves the suite is wired correctly.) |
| 7 | `npm run report:rich` | "And this is the report — searchable, filterable, with API request/response captured for every test." |

### 15-minute version

Add to the 5-min script:

- Open `tests/fixtures.ts` and explain the three custom fixtures (`apiSession`, `authenticatedPage`, `seededCheckout`). "I started with raw `beforeEach` per the brief, then wrapped it as a fixture so other specs can declare what they need without copy-pasting the recipe."
- Open `tests/pages/PaymentPage.ts` and walk through the locator choices (one or two examples is enough — see [Locator strategy](#locator-strategy)).
- Open `tests/helpers/seed.ts` and `tests/helpers/logged-request.ts`. "Every API helper goes through `logged()` so the rich report captures request + response payloads automatically."
- Open the rich report's detail drawer for any one test. "Plain-English explainer at the top, full step tree, API call panel, attached trace card."
- `npm run test:everstage` — the full assignment slice, ~1 min.

### 30-minute version

Add the senior-signal items:

- Open `tests/api/task3-add-card.spec.ts` and walk through `[TC-API-150]` (idempotency probe), `[TC-API-151]` (concurrent race), `[TC-API-152]` (response-shape contract), `[TC-API-156]` (cross-layer consistency). Explain how each one maps to a real Everstage concern (commission de-dup, payout race, audit trail, contract integrity).
- Open `.github/workflows/playwright.yml`. "CI is wired — service container for Juice Shop, daily 06:00 UTC schedule, the rich report uploaded as an artifact, JUnit annotated on PRs."
- Open `tests/reporters/rich-reporter.ts`. "Custom reporter — about 1k lines, self-contained HTML, no CDN. Generated alongside the standard Playwright report so you don't lose anything."

---

## Task walkthrough

### Task 1 — `beforeEach` login

**The brief**: *"Manually create a new user and add their credentials the new-user.json file. Then create a login script in the beforeEach hook to login every time a test runs."*

**Files to point at**:

| File | What it is | Key lines |
|---|---|---|
| [`tests/data/new-user.json`](../tests/data/new-user.json) | The credentials of the user I registered manually via the Juice Shop UI | full file |
| [`tests/helpers/login.ts`](../tests/helpers/login.ts) | The login *script* — pre-seeds banner cookies, navigates to `/#/login`, submits credentials, asserts the navbar shows the account icon | `loginBeforeEach()` at line 23 |
| [`tests/ui/task1-login.spec.ts`](../tests/ui/task1-login.spec.ts) | Where `beforeEach` calls the script | line 20–22 inside the `authenticated session` describe block |
| [`tests/fixtures.ts`](../tests/fixtures.ts) | A second, fixture-based version of the same login (see "Why two versions?" below) | `authenticatedPage` at line 48 |

**What to say**:

> "I registered the user manually in Juice Shop and saved the credentials in `new-user.json` — that's exactly the brief. The login script itself is `loginBeforeEach()` in `tests/helpers/login.ts` — I extracted it into a shared helper because the same login is reused by every assignment spec. In the spec, `test.beforeEach` calls it, just like the brief asks. I also wrapped it as a Playwright fixture in `tests/fixtures.ts` so newer tests can declare `async ({ authenticatedPage })` instead of writing the `beforeEach` boilerplate — both work, both are tested, the fixture is just a cleaner reuse pattern."

**Why two versions of the same login?**
- The brief says "create a login script in the `beforeEach` hook." That's what `loginBeforeEach()` is — a literal `beforeEach` script.
- The fixture (`authenticatedPage`) is a *refinement* — same logic, declared as a Playwright fixture so specs that need a logged-in page can ask for one as a parameter.
- Both call the same login flow under the hood, so there's exactly **one** way to log in.

**Why a JSON file and not env vars?**
- The brief says "add their credentials [to] the new-user.json file." Verbatim.
- JSON also gives me a typed import (`import user from '../data/new-user.json'`) so a typo on a field name is a compile error.
- For CI I'd switch to env vars (or a secrets manager) — the JSON file mirrors that pattern.

---

### Task 2 — UI add card

**The brief**: *"Create a UI test that navigates to My Payments options from homescreen (UI tests) and add card details."*

**Files to point at**:

| File | What it is |
|---|---|
| [`tests/ui/task2-add-card.spec.ts`](../tests/ui/task2-add-card.spec.ts) | 16 tests — happy path, validation, security, boundary, load |
| [`tests/pages/PaymentPage.ts`](../tests/pages/PaymentPage.ts) | Page Object Model for the My Payments page |

**The two tests to pull up first**:

| Test id | Line | What it proves |
|---|---|---|
| `[TC-UI-001]` | line 36 in `add-card.spec.ts` | The literal brief — navigate to My Payments, fill the form, save, see the card in the list |
| `[TC-UI-004]` | line 109 | The navigation step alone — "My Payment Options" menu item lands on `/saved-payment-methods` |

**What to say**:

> "The literal brief is `[TC-UI-001]` — log in, click the account menu, navigate through Orders & Payment → My Payment Options, fill the form, click save. Then I added 15 more tests around that single happy path: empty form keeps Submit disabled, partial fill keeps Submit disabled, non-digit keystrokes filtered, XSS in the cardholder name is rendered as text, SQL-injection-style names are stored verbatim, boundary expiry years, and a load test that adds 5 cards in rapid succession. All of those go through the same `PaymentPage` POM in `tests/pages/PaymentPage.ts`."

**Why a POM?**
- One source of truth for selectors: when Juice Shop changes a button, I fix it in *one* file, not 16 tests.
- Method-level intent: tests read `paymentPage.addCard(card)` instead of "click this, fill that, click that" — the test is a story, not a script.
- Easier to swap implementations (e.g., switch the card-number input from text to a Stripe Elements iframe) without touching tests.

**Why I clear all cards in `beforeEach` (line 15)**:
- After many runs, the user accumulates 100+ cards. The post-add snackbar / row-visible assertions start hitting the 5 s timeout because Angular re-renders the whole table on every add.
- Cleanup-first beats any per-test wait, and it leaves the user in a known state.

---

### Task 3 — API add unique card

**The brief**: *"Create an API test that adds a unique card details."*

**Files to point at**:

| File | What it is |
|---|---|
| [`tests/api/task3-add-card.spec.ts`](../tests/api/task3-add-card.spec.ts) | 35 tests covering positive, validation, security, boundary, load, and cross-layer concerns |
| [`tests/helpers/card.ts`](../tests/helpers/card.ts) | `uniqueCardNumber()` — generates a Visa-like 16-digit number per call so re-runs and parallel runs never collide |
| [`tests/helpers/logged-request.ts`](../tests/helpers/logged-request.ts) | Wraps every API call with attachment-based logging so the rich report shows request + response inline |

**The headline test**:

```ts
// tests/api/task3-add-card.spec.ts, line 44
test(
  '[TC-API-001] POST /api/Cards/ creates a card with unique details',
  { tag: ['@task3', '@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
  async ({ request }) => {
    const payload = validCard();   // ← uniqueCardNumber() under the hood

    const response = await request.post('/api/Cards/', {
      headers: authHeaders(),
      data: payload,
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('success');
    expect(body.data).toMatchObject({ /* ... */ });
    expect(String(body.data.cardNum)).toContain(payload.cardNum.slice(-4));
  }
);
```

**What "unique" means in `uniqueCardNumber()`** (line 5–10 of `tests/helpers/card.ts`):

```ts
export function uniqueCardNumber(): string {
  const seed = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
  return `4111${seed}`;
}
```

10¹² possible values — re-runs, parallel workers, even runs in the same millisecond won't collide on the unique-key constraint that Juice Shop's SQLite uses.

**Senior-signal tests to mention** (these are above and beyond the brief):

| Test | What it adds |
|---|---|
| `[TC-API-150]` Idempotency probe | Re-posts the same card → documents whether the system de-dupes (Juice Shop doesn't; a hardened build returns 409). Direct map to **Everstage commission de-dup**. |
| `[TC-API-151]` Concurrent race | Two parallel POSTs of the same card → no 5xx, no lost requests. Map to **payout processing at scale**. |
| `[TC-API-152]` Response-shape contract | Required fields present, sensitive fields banned (`cvv`, `pin`, `pan`). Map to **audit-trail integrity for SOC 2**. |
| `[TC-API-156]` Cross-layer consistency | Card created in one session is visible to a fresh-session GET. Catches "the write went nowhere" failures. |

---

## Locator strategy

The brief explicitly calls this out: *"Please ensure that locators chosen in test are stable and have less possibility to break in future."* Open [`tests/pages/PaymentPage.ts`](../tests/pages/PaymentPage.ts) when this comes up.

### The hierarchy I follow (best to worst)

1. **Stable IDs** — `#navbarAccount`, `#submitButton`, `#email`, `#password`. Juice Shop ships these as part of the public DOM contract; they survive Material upgrades.
2. **Accessible role + name** — `getByRole('menuitem', { name: 'Show Orders and Payment Menu' })`. The accessible name is part of WCAG, so it's stable across UI redesigns AND it doubles as an a11y check.
3. **Accessible label** — `getByLabel('Card Number', { exact: true })`. Forms expose labels for screen readers — same stability story.
4. **Text content with a tag scope** — `page.locator('mat-cell, td.mat-cell', { hasText: card.number.slice(-4) })`. Used when verifying the card list shows the new row.
5. **Custom `data-*` attributes** — would use these if I owned the app. I don't, so I anchor on what's already there.

### What I *don't* use, and why

| Anti-pattern | Why it's brittle |
|---|---|
| Auto-generated Material classes (`.mat-mdc-button-base`) | Change with every Angular Material upgrade |
| XPath positional selectors (`//div[3]/button[1]`) | Break when DOM order shifts (e.g. an A/B test, a new badge) |
| CSS nth-child unless absolutely necessary | Same — DOM order is a stylesheet concern, not a contract |
| Auto-generated mat ids (`mat-radio-155-input`) | Regenerated on every render |

### Two illustrative examples to walk through

```ts
// PaymentPage.ts — stable
this.accountMenu = page.locator('#navbarAccount');                // ✓ ID
this.ordersAndPaymentMenu = page.getByRole('menuitem', { name: 'Show Orders and Payment Menu' });  // ✓ ARIA name
this.nameField = page.getByLabel('Name', { exact: true });        // ✓ Label
this.submitButton = page.locator('#submitButton');                // ✓ ID
this.confirmation = page.locator('simple-snack-bar', { hasText: /card.*saved/i }); // ✓ Tag + text

// CheckoutPage.ts — illustrating an interesting case
// The "Continue" button on the address page has aria-label="Proceed to payment selection"
// and visible text "Continue". I anchor on the aria-label because the text is shared
// with multiple buttons across the funnel.
this.addressContinueButton = page.locator('button[aria-label="Proceed to payment selection"]');
```

---

## Clean-code practices applied

The brief says: *"Ensure the code has descriptive variables, indentation and modularity."*

### Modularity

- `tests/pages/` — Page Object Models. One file per page, one class per page.
- `tests/helpers/` — pure helpers (login, banner suppression, unique data, API logging, fixture seeding). No state, no shared mutable.
- `tests/fixtures.ts` — Playwright fixtures. Tests opt in by parameter name; what they don't ask for, they don't pay for.
- `tests/data/` — fixture data files (currently just `new-user.json`).
- `tests/reporters/` — custom reporters; testing the test framework itself stays out of the test path.
- `tests/api/` and `tests/ui/` — flat by spec, never nested by feature/spec because Playwright's grep + tag filtering handles cross-cutting slices.

### Naming

- Test ids in titles: `[TC-UI-001]`, `[TC-API-150]` — searchable in CI logs, link-able in the catalog (`docs/test-cases.csv`).
- Tag taxonomy: `@everstage-qa` / `@task1` / `@task2` / `@task3` for assignment scope; `@positive` / `@negative` / `@boundary` / `@security` / `@load` for category; `@functional` / `@nonfunctional` for axis; `@smoke` / `@regression` / `@e2e` for CI gate.
- Function names that read like English: `seedAddress`, `clearBasket`, `findStockableProductId`, `loginBeforeEach`.
- Short, predictable variable names inside small scopes (`r` / `q` / `p`); descriptive names in module-level code.

### "Don't repeat yourself" — concrete examples

- `loginBeforeEach()` is called by 16 specs, defined once.
- `seedAddress`, `seedCard`, `seedBasket`, `clearBasket`, `clearCards` live in `tests/helpers/seed.ts`. The two order-flow specs (UI + API) consume the same helpers — same setup at both layers.
- `validCard()` factory in `tests/api/task3-add-card.spec.ts` line 13 produces a baseline card and lets each test override only what it cares about (`validCard({ expMonth: 13 })`).

### Comment discipline

Comments explain **why**, not **what**:

```ts
// tests/helpers/seed.ts, around line 28
/**
 * Empties the user's basket. Juice Shop's BasketItem table has a unique
 * (ProductId, BasketId) constraint — re-adding the same product 500s — so
 * tests must start from a known empty state.
 */
export async function clearBasket(...) { ... }
```

No "// loop over products" comments. The code is self-explanatory; the docblock captures the surprising constraint that explains *why the function exists at all*.

---

## Anticipated interview questions + answers

These are the questions I'd expect and how I'd answer them. Every answer points to a specific file/line so I can show the code instead of waving hands.

### "Walk me through your folder structure."

> "Two top-level directories: `tests/` for everything Playwright touches, `docs/` for human-readable artifacts.
>
> Inside `tests/`, the split is by responsibility:
> - `api/` and `ui/` are spec files. Flat, one feature per file.
> - `pages/` is the POM. One class per page.
> - `helpers/` is pure functions — login, banner suppression, unique data, API logging.
> - `fixtures.ts` is the Playwright fixture layer — `apiSession`, `authenticatedPage`, `seededCheckout`.
> - `data/` is fixture JSON. Currently just the assignment user.
> - `reporters/` is the custom rich HTML reporter and the CSV history reporter."

### "Why Playwright over Cypress?"

> "Three reasons:
> 1. **Native API testing.** Playwright's `request` fixture lets me drive REST endpoints directly. Cypress now has `cy.request` but it goes through the renderer. The Task 3 API spec needs a clean APIRequestContext.
> 2. **Auto-waiting.** Locators retry until visible/enabled. Cuts the flake budget in half.
> 3. **Trace viewer** — the per-step DOM snapshots have saved me hours debugging flaky tests."

### "How would you scale this to 500 tests?"

> "Four levers:
> 1. **Shard across CI runners.** Playwright supports `--shard 1/N`. With 4 runners, 500 tests run in 25% of the wall-clock time.
> 2. **Parallel workers per shard.** Currently I run with `workers=1` locally so a reviewer can watch a headed run. CI gets `workers=2`. With test isolation in place (each spec cleans its own state), I'd push to 4–6.
> 3. **Tag slicing.** `@smoke` runs in 9 s and gates every PR. `@regression` runs nightly. `@security` runs weekly. The same suite serves three audiences.
> 4. **`storageState` instead of `beforeEach` login.** For Task 1 I follow the brief literally, but at 500 tests the per-test login adds up. I'd save the session to `auth.json` after one login and reuse it via `test.use({ storageState })` for all tests that don't need fresh creds."

### "How would you test commission calculation accuracy?" *(the Everstage-specific one)*

> "Pure data-driven tests. Imagine a `commissions.spec.ts` that reads from `commissions.cases.csv`:
>
> ```
> rep, deal_value, plan, accelerator, expected_commission
> alice, 10000, plan_a, false, 1000.00
> alice, 10000, plan_a, true, 1500.00
> bob, 0, plan_b, false, 0.00
> ```
>
> Each row is one test. The assertion compares to the cents (`expect(actual).toBeCloseTo(expected, 2)`) — never use floats with `.toBe`.
>
> Edge cases I'd add up front:
> - Negative commissions (clawbacks)
> - Capped earnings (over-attainment ceilings)
> - Accelerators / decelerators at threshold boundaries
> - Currency rounding (USD vs INR vs EUR — different decimal precision rules)
> - Statement period boundaries (deal closes 23:59:59 on day N — does it land in this period or next?)
> - Tax / withholding deltas if those flow through
>
> The test data lives in version control alongside the spec, so a comp analyst can update a calculation, push, and the test catches whether the new logic matches their golden file."

### "How do you handle flaky tests?"

> "Three layers:
> 1. **Eliminate the cause.** Before retrying, I find the timing/state issue. Example: my UI add-card load test was failing because the snackbar from one iteration intercepted clicks on the next. Fixed by waiting for snackbar dismissal between iterations, not by adding a retry.
> 2. **Configurable retries.** The Playwright config has `retries: 2` locally, `retries: 3` in CI. CI gets the extra retry to absorb genuine network blips.
> 3. **The rich report flags flaky** — any test that passed on retry shows as a yellow `↻ flaky` badge in the report so a reviewer can investigate without digging through logs."

### "How do you handle test isolation in parallel runs?"

> "Three strategies, layered:
> 1. **Unique data.** `uniqueCardNumber()` generates 10¹² possible values; `uniqueEmail()` is timestamp + random. Re-runs, parallel workers, even concurrent millisecond collisions are mathematically improbable.
> 2. **Per-test cleanup.** The add-card UI spec deletes all cards in `beforeEach`. Order-flow specs clear the basket. Each test starts from a known state.
> 3. **Per-worker users (for true parallel scale).** I'd register a fresh user per worker (`test-${workerIndex}@…`) so the basket / cards / addresses never overlap. The brief asks for one shared user so I follow that, but in production I'd parameterize."

### "How do you handle test data?"

> "Three sources, by purpose:
> 1. **`tests/data/new-user.json`** — fixture data for the brief's shared user.
> 2. **Generated at runtime** — `uniqueCardNumber()`, `uniqueEmail()`, `freshUser()` in `tests/helpers/`. Anything that has to be unique per test.
> 3. **Resolved from the live system** — `findStockableProductId()` in `tests/helpers/api.ts` queries `/api/Quantitys/` and picks a product with stock. The suite would otherwise break when Juice Shop's Apple Juice gets drained across many runs.
>
> Sensitive data is **redacted in logs**. The `logged()` wrapper in `tests/helpers/logged-request.ts` masks the `Authorization` and `Cookie` headers in attachments — only the first 12 chars of a bearer token are visible."

### "How would you debug a failing CI test?"

> "Four artifacts, in order of usefulness:
> 1. **Rich HTML report** — `reports/test-report.html` is uploaded as a CI artifact. Open it, click the failing test, see the assertion message + step tree + API call dumps.
> 2. **Trace viewer** — every test gets a `trace.zip` in CI on failure. `npx playwright show-trace …` opens a DOM-snapshot timeline. The trace card in the rich report has a one-click 'copy command' button.
> 3. **Screenshot + video** — auto-attached on failure.
> 4. **The actual failure stack** — the rich report shows the full stack with the assertion line highlighted."

### "Why no Allure?"

> "I built a custom rich reporter instead. Three reasons:
> 1. Allure needs a Java runtime and a generation step. The custom reporter is a single self-contained HTML — no toolchain, opens offline, mailable.
> 2. The custom reporter knows about *this* assignment — it groups tags into Assignment / CI gates / Test category, surfaces the API request/response payloads inline (Allure doesn't), and renders trace cards with copy-to-clipboard CLI commands.
> 3. If a team prefers Allure, the JUnit XML output is also written, so a downstream Allure step would still work."

### "What would you change about Juice Shop if you owned it?"

> "From the bugs the suite documents:
> - Add `data-testid` attributes to the long-lived form fields. Right now I anchor on accessible labels — those work, but `data-testid` is more explicit.
> - Fix the BOLA on `/rest/basket/:bid/checkout` — the bearer-token user should own the basket id.
> - Reject empty-basket checkout with 400.
> - Return 405 with an `Allow` header on PATCH `/api/Cards/{id}` instead of 500.
> - Mask the full PAN in the POST response, not just the GET list.
> - Implement a `limitPerUser` UX hint on the product cards (the test suite has to navigate around stockouts because nothing in the UI shows them)."

### DSA round (likely follow-up)

Practice these on LeetCode the night before:

- **Strings**: anagram, valid palindrome, longest substring without repeating chars
- **Arrays**: two-sum, three-sum, max subarray (Kadane's)
- **Hash maps**: group anagrams, top-K frequent
- **Sliding window**: longest substring with at-most-K distinct
- **Sorting**: merge intervals
- **Greedy**: jump game, gas station
- **DP basics**: climbing stairs, house robber, coin change

Don't go deep on graphs/trees unless they signal it; for QA roles the bar is usually easy/medium on strings + arrays.

---

## Troubleshooting cheat sheet

When something breaks live during the call, here's the order to check:

| Symptom | First thing to check |
|---|---|
| `connect ECONNREFUSED 127.0.0.1:3000` | Juice Shop isn't running. `docker ps` to confirm; `docker run -d -p 3000:3000 bkimminich/juice-shop` to start. |
| Login fails for the assignment user | The user doesn't exist yet (Docker container was rebuilt). Register via the UI at `/#/register`, OR run the API curl command from the GitHub Actions workflow's *Bootstrap user* step. |
| All add-card tests fail with "out of stock" | The user has hit the per-product `limitPerUser` cap. `findStockableProductId()` already routes around this for new tests, but legacy tests with hard-coded `ProductId: 1` would break. Restart the container to reset DB. |
| `#checkoutButton` is disabled in UI tests | The basket is empty. Check the `seedBasket()` call ran. |
| Search input loses focus after typing one char | Should not happen — the rich reporter preserves focus across re-renders. If it does, hard-refresh the report. |
| Trace cards say "no trace recorded" on a passing run | The local default is `trace: 'on'` — if you see this, run `TRACE_MODE=on npm test` to force it on. |
| Tests pass locally but fail in CI | Check the `CI` env var-driven config — CI uses `workers=2` and `retain-on-failure`. If a test relies on serial ordering, it'll surface here. |

---

## What I'd add with more time

A short, honest list. Mention this when they ask "what's next" — it shows you know what *isn't* done.

1. **Visual regression**. Playwright's snapshot testing on a couple of key pages. I skipped because Juice Shop has random featured-product banners that produce false positives.
2. **Accessibility scan with axe-core**. One-line per page: `await injectAxe(page); await checkA11y(page)`. The locator strategy already pulls on aria attributes, so the bones are there.
3. **Contract testing with Pact**. The cross-layer test (`TC-API-156`) is a poor man's version. A real Pact contract would version the request/response schema and break the build when the API drifts.
4. **Per-worker user**. The brief says one shared user; I'd parameterize for true parallel safety at scale.
5. **Mutation testing**. Run Stryker on the helpers/seed.ts code to confirm tests *actually* catch regressions, not just exercise the code.
6. **Lighthouse / Core Web Vitals**. Performance assertions for the home / payments pages.
7. **`storageState` for the non-Task-1 specs**. Once I'm out of "literal brief" territory, the per-test login is wasted work.
8. **Error-boundary tests**. Force the SPA to crash (e.g. malformed API response) and assert the error UI renders, not a white screen.

---

*Last refresh: this doc tracks the state of the suite as of the most recent commit. If file line numbers drift, `grep -n "loginBeforeEach\|TC-UI-001\|TC-API-001" tests/` always finds the canonical references.*
