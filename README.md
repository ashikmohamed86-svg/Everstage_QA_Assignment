# Juice Shop QA Automation — Everstage Assignment

Playwright + TypeScript end-to-end test suite for OWASP Juice Shop,
built as a job-assessment deliverable for **Everstage**. The three
required tasks are delivered, plus a deep-coverage expansion across UI
and REST APIs and the full checkout flow that the existing Juice Shop
suite never connected end-to-end.

> **Result on a live `localhost:3000` Juice Shop:**
> **223 / 223 tests passing**, sub-3-minute serial runtime,
> 84 of those tests carry `@everstage-qa` (the assessment scope).

## At a glance

| Metric | Value |
|---|---|
| Total tests | **223** (100% pass) |
| Assessment-scope (`@everstage-qa`) | 84 |
| **Assignment specs** (renamed for visibility) | `tests/ui/task1-login.spec.ts`, `tests/ui/task2-add-card.spec.ts`, `tests/api/task3-add-card.spec.ts` |
| Page Object Models | 12 |
| Custom Playwright fixtures | 3 (`apiSession`, `authenticatedPage`, `seededCheckout`) |
| Helper modules | 7 |
| API request/response payloads captured per run | 240+ |
| CI/CD pipelines (GH Actions / GitLab / Jenkins / Azure) | 4 |
| Custom reporters (CSV history + rich HTML) | 2 |
| Documented OWASP Juice Shop vulnerabilities + UX defects surfaced | 20 |

## For interviewers / assessors

| Document | Open this if you want… |
|---|---|
| [`docs/ASSIGNMENT.md`](docs/ASSIGNMENT.md) | The Everstage brief verbatim, plus a one-table map from each line of the brief to the file that satisfies it |
| [`docs/PRESENTATION.md`](docs/PRESENTATION.md) | **Slide-by-slide deck** (12 slides, ~15 min) focused on Tasks 1 / 2 / 3. Paste into PowerPoint / Keynote / Slides. Speaker notes + tempo guide + talking-points cheat sheet. |
| [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) | **Live demo runbook** — read it while presenting. Each slide has verbatim speech, live-coding cues (open file X, run command Y), and plain-English explanations for non-technical reviewers. Includes a pre-demo checklist, a "what to say if X fails" cheat sheet, and a tempo guide. |
| [`docs/CODE-TOUR.md`](docs/CODE-TOUR.md) | Linear demo script for the pairing call — every assignment file embedded with its actual source code, split into **PART A (brief)** and **PART B (extras)** |
| [`docs/INTERVIEW-PREP.md`](docs/INTERVIEW-PREP.md) | Locator-strategy rationale, 9 anticipated interview Q&As with prepared answers, troubleshooting cheat sheet, "what I'd add with more time" |
| [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) | The full catalogue of every test case with steps and expected results |
| [`docs/test-cases.csv`](docs/test-cases.csv) / [`.xlsx`](docs/JuiceShop-TestCases.xlsx) | Same catalogue as machine-readable CSV / polished Excel |
| this README | Architecture, scope, how to run, design decisions, findings |

---

## Table of contents

1. [Assignment scope](#assignment-scope)
2. [Quick start](#quick-start)
3. [What the suite covers](#what-the-suite-covers)
4. [Tag matrix & how to slice the suite](#tag-matrix--how-to-slice-the-suite)
5. [Project layout](#project-layout)
6. [Design decisions](#design-decisions)
7. [Findings against the default Juice Shop build](#findings-against-the-default-juice-shop-build)
8. [Reports & dashboards](#reports--dashboards)
9. [Troubleshooting](#troubleshooting)

---

## Assignment scope

The brief had three required tasks. All are delivered, plus a fourth flow
(checkout/order placement) that the original Juice Shop suite never
exercised end-to-end.

| Task | What it asks for | Where it lives |
|---|---|---|
| **Task 1 — beforeEach login** | Manually create a new user, save credentials in `tests/data/new-user.json`, run a login script in `beforeEach` so every test starts authenticated. | `tests/data/new-user.json`, `tests/helpers/login.ts`, `tests/fixtures.ts#authenticatedPage`, `tests/ui/task1-login.spec.ts` (15 tests) |
| **Task 2 — UI: add card** | Navigate to *My Payment Options* from the home screen and add card details. | `tests/ui/task2-add-card.spec.ts` (23 tests), `tests/pages/PaymentPage.ts` |
| **Task 3 — API: add card** | Add unique card details via the REST API. | `tests/api/task3-add-card.spec.ts` (46 tests) |
| **Bonus — Order flow** | Full checkout funnel (basket → address → delivery → payment → place order → order confirmation). The pre-existing suite never connected these pieces. | `tests/ui/order-flow.spec.ts`, `tests/api/order-flow.spec.ts`, `tests/pages/CheckoutPage.ts`, `tests/pages/OrderHistoryPage.ts` (22 tests) |

Every assignment test carries `@everstage-qa` plus `@task1` / `@task2` /
`@task3` so an assessor can run exactly the tests the brief asked for:

```bash
npm run test:everstage    # all assignment tests
npm run test:task1        # Task 1 only
npm run test:task2        # Task 2 only
npm run test:task3        # Task 3 only
```

---

## Quick start

```bash
# 1. Install deps + Playwright's Chromium
npm install
npx playwright install --with-deps chromium

# 2. Make sure Juice Shop is running on http://localhost:3000
#    (e.g. `docker run -p 3000:3000 bkimminich/juice-shop`)

# 3. Run everything
npm test                      # ~2 minutes serial, 191 tests

# Or slice it
npm run test:smoke            # PR-gate slice (~9 tests, <1m)
npm run test:regression       # nightly slice
npm run test:e2e              # full user-journey tests
npm run test:security         # security probes only
npm run test:order-flow       # missing checkout funnel (22 tests)

# Headed mode (watch the browser drive itself)
npm run test:headed
npm run test:everstage -- --headed --workers=1
```

The shared assignment account is created on the live server and stored in
`tests/data/new-user.json`:

```json
{ "email": "everstage-qa-mox3mxq8@juice.test", "password": "Everstage@123" }
```

Tests resolve the user's basket id and security question dynamically so the
suite still works after the database is reset — no hard-coded ids.

---

## What the suite covers

| Module | UI tests | API tests | Notes |
|---|---|---|---|
| Login                           | `TC-UI-100..140` | `TC-API-200..204` | Includes `beforeEach` login (Task 1), SQLi auth-bypass, XSS, no email enumeration, 5-fail burst load |
| Registration                    | `TC-UI-200..206` | `TC-API-300..303` | Boundary password length, malformed email, duplicate email |
| Search                          | `TC-UI-400..404` | `TC-API-400..404` | XSS in search, 200-char query |
| Basket / Cart                   | `TC-UI-500..504` | `TC-API-500..504` | Increment / decrement, zero / negative qty docs vulns |
| Address book                    | `TC-UI-600..604` | `TC-API-600..604` |  |
| Change password                 | `TC-UI-800..803` | — |  |
| Customer feedback               | `TC-UI-900..903` | `TC-API-800..803` |  |
| Product details / reviews       | `TC-UI-1000..1002` | — |  |
| Site navigation & UX            | `TC-UI-1100..1103` | — |  |
| Forgot password                 | `TC-UI-1200..1201` | — |  |
| Profile / order history         | `TC-UI-1300, 1400` | — |  |
| Account-area pages              | `TC-UI-1500..1505` | — |  |
| Public information pages        | `TC-UI-1600..1603` | — |  |
| **Payment cards (Task 2 + 3)**  | `TC-UI-001..041` | `TC-API-001..142` | Full add-card matrix on UI and API |
| Wallet                          | — | `TC-API-700..702` |  |
| Recycle                         | — | `TC-API-900..904` |  |
| Delivery methods                | — | `TC-API-1000..1001` |  |
| Track order                     | — | `TC-API-1100..1102` |  |
| Two-factor authentication       | — | `TC-API-1200..1202` |  |
| Complaints                      | — | `TC-API-1300..1304` |  |
| Captcha endpoints               | — | `TC-API-1400..1403` |  |
| Identity / lookup               | — | `TC-API-1500..1503` |  |
| **Order / Checkout flow (NEW)** | `TC-UI-700..730` | `TC-API-1600..1641` | The missing flow — full e2e checkout |

Live test catalogue with steps and expected results: `docs/test-cases.csv`
and `docs/JuiceShop-TestCases.xlsx`.

### Test-case categories

Every test fits at least one of:

- **Positive** — happy path works.
- **Negative** — bad input is rejected; errors are surfaced.
- **Boundary** — values at and just past min/max limits.
- **Security** — SQLi probes, XSS payloads, IDOR / BOLA probes, JWT
  tampering, oversized payloads. Documented vulnerabilities in default
  Juice Shop are asserted as *actual* behavior so the suite stays green
  on the unsafe build, with comments explaining how to flip the assertion
  on a hardened build.
- **Load** — N concurrent or sequential calls; no lockouts, no 5xx.
- **Functional** — tests product behavior.
- **Non-functional** — latency budgets, masking / PII handling, accessibility-affecting selectors.

---

## Tag matrix & how to slice the suite

Each test carries a layered tag set so the same suite drives a fast PR
gate, a thorough nightly run, or a focused security audit.

| Tag | Used for | npm script |
|---|---|---|
| `@everstage-qa` | All assignment tests | `npm run test:everstage` |
| `@task1`        | Task 1 — login + beforeEach | `npm run test:task1` |
| `@task2`        | Task 2 — UI add card | `npm run test:task2` |
| `@task3`        | Task 3 — API add card | `npm run test:task3` |
| `@smoke`        | Critical happy paths — must pass before merge | `npm run test:smoke` |
| `@regression`   | Full nightly slice | `npm run test:regression` |
| `@e2e`          | End-to-end user journeys | `npm run test:e2e` |
| `@positive`     | Happy-path assertions | `npm run test:positive` (via grep) |
| `@negative`     | Bad-input handling | `npm run test:negative` |
| `@boundary`     | At-the-limit values | `npm run test:boundary` |
| `@security`     | SQLi / XSS / JWT / IDOR / BOLA probes | `npm run test:security` |
| `@load`         | Concurrent + burst tests | `npm run test:load` |
| `@functional`   | Behavior tests | `npm run test:functional` |
| `@nonfunctional`| Latency, masking, robustness | `npm run test:nonfunctional` |

Combine tags with Playwright's `--grep`:

```bash
# Smoke + e2e for a critical-path PR gate
npx playwright test --grep "@smoke|@e2e"

# Negative + security only — quick threat-model check
npx playwright test --grep "@negative|@security"
```

---

## Project layout

```
tests/
  fixtures.ts                       # Custom Playwright fixtures (test.extend)
  api/                              # Playwright API specs
    add-card.spec.ts                # Task 3
    address.spec.ts
    basket.spec.ts
    captcha.spec.ts
    complaint.spec.ts
    deliveries.spec.ts
    feedback.spec.ts
    login.spec.ts
    order-flow.spec.ts              # NEW — checkout funnel
    products.spec.ts
    recycle.spec.ts
    register.spec.ts
    track-order.spec.ts
    two-factor.spec.ts
    wallet.spec.ts
    whoami.spec.ts
  ui/                               # Playwright UI specs
    account-areas.spec.ts
    add-card.spec.ts                # Task 2
    address.spec.ts
    basket.spec.ts
    change-password.spec.ts
    contact.spec.ts
    extra-pages.spec.ts
    forgot-password.spec.ts
    login.spec.ts                   # Task 1
    navigation.spec.ts
    order-flow.spec.ts              # NEW — checkout funnel
    product-reviews.spec.ts
    register.spec.ts
    search.spec.ts
  pages/                            # Page Object Models
    AddressPage.ts                  ContactPage.ts                LoginPage.ts
    BasketPage.ts                   ForgotPasswordPage.ts         OrderHistoryPage.ts (NEW)
    ChangePasswordPage.ts           CheckoutPage.ts (NEW)         PaymentPage.ts
    ProductPage.ts                  RegisterPage.ts               SearchPage.ts
  helpers/
    api.ts                          # loginViaApi, loginSession, findStockableProductId
    banners.ts                      # cookie / welcome / language banner suppression
    card.ts                         # uniqueCardNumber()
    login.ts                        # loginBeforeEach() (Task 1)
    seed.ts                         # NEW — clearBasket, seedBasket, seedAddress, seedCard, …
    user.ts                         # uniqueEmail(), freshUser()
  data/
    new-user.json                   # Task 1 — assignment user credentials
  reporters/
    csv-reporter.ts                 # Custom reporter -> reports/run-history.csv + dashboard.html

docs/
  test-cases.csv                    # Catalogue of every TC-* case
  JuiceShop-TestCases.xlsx          # Polished Excel deliverable

reports/
  run-history.csv                   # Appended on every run
  dashboard.html                    # Auto-rendered HTML dashboard with pass-rate trends
  summary.md                        # Markdown summary (paste into PRs / Slack)
  junit.xml                         # JUnit XML for CI consumers
```

---

## Design decisions

**Page Object Model.** Selectors live in `tests/pages/*` so when Juice
Shop changes a button, you fix it once. Each POM exposes both *named
locators* (`paymentPage.submitButton`) and *user-intent methods*
(`paymentPage.addCard(card)`) — tests read like the brief, not like
HTML scraping.

**Custom Playwright fixtures.** `tests/fixtures.ts` provides three
fixtures via `test.extend`:

  - `apiSession` — REST login, returns `{ token, bid, email }`.
  - `authenticatedPage` — UI login, banners suppressed, navbar visible.
  - `seededCheckout` — basket cleaned + address + card + stockable
    productId + delivery method id, all in parallel, returned as a
    single object.

Tests declare what they need (`async ({ authenticatedPage, seededCheckout })
=>`) and Playwright instantiates lazily — a test that doesn't ask for
`seededCheckout` doesn't pay for it.

**Single-source seed helpers.** `tests/helpers/seed.ts` consolidates
basket / address / card / delivery setup. Used by both API and UI
order-flow specs so the same recipe runs at both layers.

**Stock-aware product picker.** `findStockableProductId()` queries
`/api/Quantitys/` and picks a product with `quantity > 0` and
`limitPerUser === null`. Apple Juice (the seed default) drains to zero
and hits the per-user 5-purchase cap across many runs — the helper makes
the suite resilient against that. The UI variant additionally
constrains to products visible on page 1 of the alphabetically-sorted
home grid.

**`bid` from the login response, not `whoami`.** Juice Shop's
`/rest/user/whoami` is cookie-authenticated, so it returns no user when
called with only a bearer token. The login response already contains
the basket id (`bid`) — we read it from there.

**Documented vulnerabilities asserted as actual behavior.** The default
Juice Shop is intentionally vulnerable. Tests like SQLi auth bypass,
empty-basket checkout, and BOLA cross-user checkout assert the *actual*
unsafe behavior so the suite stays green; comments explain how to flip
the assertion on a hardened build. This is more useful than red tests
that everyone learns to ignore.

**Data uniqueness for parallel-safety.** `uniqueEmail()`,
`uniqueCardNumber()` produce 10⁹–10¹² unique values so parallel and
re-run executions don't collide on the unique-key constraints in
SQLite. Mutating tests register their own user via the API rather than
touching the shared assignment account.

**Per-test cleanup, not setup.** The add-card UI spec deletes all cards
in `beforeEach` so the table renders quickly even after 100+
accumulated rows from prior runs. The basket and order-flow specs do
the same with basket items. This keeps the suite green even on a
long-lived database.

---

## Senior-engineer signal items (Everstage-aligned)

The following test cases sit *above and beyond* the literal brief — they
exercise the things a sales-comp / payout platform actually cares about,
even though the demo app is a generic juice shop:

| Test | What it proves | Everstage parallel |
|---|---|---|
| `[TC-API-150]` Re-posting an identical card → idempotency check | The system either dedupes or admits it doesn't | Duplicate commission entries on the same closed-won deal |
| `[TC-API-151]` Concurrent identical-card POSTs (race) | No 5xx, no lost requests under contention | Payout processing at scale |
| `[TC-API-152]` Response shape contract test | Schema-stable across deploys; sensitive fields never leak | Audit-trail integrity for SOC 2 |
| `[TC-API-153]` Wrong HTTP method (PATCH on POST endpoint) | HTTP semantics rigor; documents 500 as a defect | API hygiene for SOC 2 / partner integrations |
| `[TC-API-154]` Wrong `Content-Type` is rejected with 4xx | Server doesn't crash on malformed clients | Hardening against bad-actor / mis-configured callers |
| `[TC-API-155]` Cardholder name with Unicode (Hindi, Chinese, emoji) | Non-Latin payee names round-trip exactly | Global commission statements |
| `[TC-API-156]` Cross-layer: API write visible in fresh session | Contract integrity across token boundaries | "The write went nowhere" failure mode |
| `[TC-API-122]` Mass-assignment probe (`UserId` spoofing) | Authenticated user can't write to another user's row | Multi-tenant isolation |
| `[TC-API-125]` IDOR: cross-user read/delete | Same as above, on read/delete paths | Multi-tenant isolation |
| `[TC-API-128]` Extra fields ignored (no `isAdmin: true` injection) | Mass-assignment safety | Privilege-escalation hygiene |
| `[TC-UI-022]` / `[TC-API-004]` Card masking on read paths | PCI-style PAN handling | Sensitive payee data masking |
| `[TC-API-1621]` BOLA probe — checkout another user's basket | Authorization checked per resource, not just per session | Multi-tenant payout integrity |

Documented vulnerabilities (intentional in Juice Shop) are asserted as
**actual** behavior so the suite stays green on the unsafe build, with a
one-line note in each test on how to flip the assertion for a hardened
build.

## Findings against the default Juice Shop build

These are the documented Juice Shop vulnerabilities the suite explicitly
catches. Each is asserted as *current* behavior, with a one-line note on
how a hardened build should respond.

| Test | Behavior on default Juice Shop | Hardened-build expectation |
|---|---|---|
| `[TC-UI-120]`, `[TC-API-204]` | SQLi `' OR 1=1--` in email logs in as admin | 401, no token |
| `[TC-API-302]` | `/api/Users/` accepts blank password | 400 |
| `[TC-API-303]` | `/api/Users/` accepts malformed email | 400 |
| `[TC-API-110/111/112]` | `/api/Cards/` accepts missing `cardNum`, `expMonth`, `expYear` | 400 |
| `[TC-API-503/504]` | `/api/BasketItems/` accepts `quantity=0` and `quantity=-5` | 400 |
| `[TC-API-1001]` | `/api/Deliverys/` is reachable without auth | 401 |
| `[TC-API-1503]` | `/rest/user/security-question?email=` is a user-enumeration oracle | constant-shape response |
| `[TC-API-1611]` | `/rest/basket/{bid}/checkout` mints an order on an empty basket | 400 |
| `[TC-API-1621]` | `/rest/basket/{bid}/checkout` honors a foreign `bid` (BOLA) | 401/403, victim's basket untouched |
| `[TC-UI-720]` | `/#/address/select` is reachable without auth | redirect to `/#/login` |
| `[TC-UI-711]` | Browser-back from delivery wipes the address selection | selection preserved |

The non-vulnerability findings — e.g. checkout latency budgets, PAN
masking on `GET /api/Cards/`, JWT tampering rejection, no XSS execution
in cardholder name — round out the suite and are checked on every run.

---

## Reports & dashboards

Two custom reporters run alongside Playwright's built-in HTML / JUnit reporters:

### Rich HTML report (recommended)

`tests/reporters/rich-reporter.ts` produces `reports/test-report.html` —
a single self-contained file (no CDN dependencies, opens offline) that
makes the run readable for both engineers and non-technical stakeholders.

  - **Top-level stats**: total / passed / failed / flaky / runtime, all
    in big numbers at the top so a hiring manager scanning the page in
    five seconds gets the headline.
  - **Live search bar** — filter by test id, title, file, tag, or error
    text. Try `@security` or `TC-API-001`.
  - **Filter chips** — slice by status (passed/failed/flaky/skipped),
    layer (UI/API), category (positive/negative/boundary/security/load/
    functional/non-functional), assignment scope (`⭐ Assessment cases`
    / Task 1 / Task 2 / Task 3) or CI gate (`@smoke` / `@regression` / `@e2e`).
  - **Group by** — area, category, file, or tag. Collapsible groups so
    you can drill from "all 207" to "the 22 security probes" in one click.
  - **Per-test detail drawer** — click any test row to expand inline.
    Shows: status with plain-English explanation, full step tree,
    attached **API request/response payloads** (headers, body, timing,
    redacted auth), error message + stack on failures, console output,
    inline screenshot thumbnails, embedded video player, and a
    **Playwright trace card** for every recorded `trace.zip` (with a
    one-click "Copy `npx playwright show-trace …` command", a download
    link, and an "Open in trace.playwright.dev" button).
  - **Charts** — pass-rate trend across the last 30 runs, plus a
    coverage-by-tag bar chart of pass / fail per tag.
  - **Plain-English explainers** — each detail panel has a short blurb
    explaining what the test category means (so a non-technical reviewer
    knows what "Security probe" or "Boundary check" actually verifies).
  - **Print friendly** and mobile-responsive.

```bash
npm run report:rich         # opens reports/test-report.html
npm run test:with-traces    # full suite WITH traces forced on so every test
                            # gets a trace.zip rendered in the report
```

Live search supports the same input the filter chips do: type
`@everstage-qa` or `TC-API-1600` or `BOLA` to narrow the list. Search and
filters compose, so `@security` typed in the box AND the `✗ Failed` chip
will give you "all failing security probes".

### Trend dashboard + CSV history

`tests/reporters/csv-reporter.ts` accumulates run history:

  - Appends one row per test per run to `reports/run-history.csv`.
  - Renders `reports/dashboard.html` with per-test pass-rate over time.
  - Writes `reports/summary.md` for PR / Slack pasting.

```bash
npm run report      # standard Playwright HTML report
npm run dashboard   # custom dashboard with pass-rate trends
npm run trace       # Playwright trace viewer for the latest failed test
```

`reports/junit.xml` is also written for CI consumers.

### Continuous integration

Pipelines for the four major CI systems are ready to drop in:

| File | CI system |
|---|---|
| `.github/workflows/playwright.yml` | **GitHub Actions** (active, daily 06:00 UTC + on push/PR + manual dispatch with tag-grep input) |
| `ci-examples/.gitlab-ci.yml`       | GitLab CI (publishes the rich report to GitLab Pages) |
| `ci-examples/Jenkinsfile`          | Jenkins (declarative pipeline, HTML Publisher plugin) |
| `ci-examples/azure-pipelines.yml`  | Azure DevOps |

All four use Microsoft's official Playwright image so browsers + OS deps
ship preinstalled, and they all pull `bkimminich/juice-shop:latest` as a
sidecar service. The pipelines bootstrap the assignment user via the
Juice Shop API on first boot so they work against a brand-new container.

The Playwright config is environment-driven — no per-CI forks needed:

| Env var | Local default | CI default | Effect |
|---|---|---|---|
| `CI`         | unset       | `true`              | Truthy ⇒ `workers=2`, `retries=3`, `forbidOnly=true`, screenshots/video only on failure |
| `BASE_URL`   | `http://localhost:3000` | (same) | Point at a non-default Juice Shop |
| `TRACE_MODE` | `on`        | `retain-on-failure` | `on` records a trace for every test (rich-report trace cards populated); `retain-on-failure` only keeps traces for failures (smaller CI artifact) |

After every run, the rich `test-report.html`, JUnit XML, run-history
CSV, dashboard, summary, and `test-results/` (traces, screenshots,
videos) are uploaded as artifacts. See `ci-examples/README.md` for the
full breakdown.

### Capturing API request/response data

Every shared API helper (`loginViaApi`, `loginSession`, `seedAddress`,
`seedCard`, `seedBasket`, `clearBasket`, `findStockableProductId`,
`defaultDeliveryMethodId`) goes through the `logged()` wrapper from
`tests/helpers/logged-request.ts`, which attaches each HTTP call as JSON
to Playwright's `TestInfo`. The rich reporter renders those attachments
in the detail drawer, so even tests written before the wrapper existed
show their setup traffic in the report.

To capture additional calls inside an individual spec, use the wrapper
directly:

```ts
import { logged } from '../helpers/logged-request';

test('...', async ({ request }) => {
  const api = logged(request);
  const res = await api.post('/api/Cards/', { headers, data });
  // request + response now visible under "API calls" in the report
});
```

Auth headers are redacted automatically (only the first 12 chars of the
bearer token are shown), so the report is safe to share.

---

## Troubleshooting

**"We are out of stock" on basket-add tests.** The seed product (Apple
Juice) gets drained over many test runs and has a `limitPerUser=5` cap.
The suite already handles this via `findStockableProductId` — but if
*every* product drains, restart the Juice Shop container to reset the
DB.

**`#checkoutButton` is disabled in UI tests.** Means the basket is
empty when checkout was reached. The order-flow spec seeds the basket
via API in each test, so this should not happen — but if you've added a
new test, make sure it calls `seedBasket(...)` before
`checkoutFromBasket()`.

**`whoami` returns `{ user: undefined }`.** That's correct — Juice Shop's
whoami is cookie-auth only. Use `loginSession()` (returns the `bid`
directly) instead of `loginViaApi()` + a follow-up whoami call.

**Tests run slow against an old DB.** The user has accumulated state
(cards / addresses / orders). The per-test cleanup in `beforeEach`
hooks keeps each individual test fast; if the whole DB is too big, just
restart Juice Shop.

---

*Built with Playwright `^1.48` and TypeScript `^5.4`. Tested against
OWASP Juice Shop on `http://localhost:3000`.*
