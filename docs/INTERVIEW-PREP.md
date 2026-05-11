# Interview prep — talking points & Q&A cheat sheet

_Companion to the deep-dive in [`docs/CODE-ANALYSIS.md`](CODE-ANALYSIS.md).
This doc is the scannable version — read it the night before the call and on
the walk in. Every section is ≤ 1 page so you can flip to one mid-conversation._

---

## 30-second elevator pitch

> "I built a Playwright + TypeScript end-to-end suite for OWASP Juice Shop —
> 226 tests covering UI and REST APIs. The brief asked for three things: a
> shared `beforeEach` login, a UI add-card flow, and an API add-card flow. I
> delivered all three, plus the **full checkout funnel** the existing Juice
> Shop test pack never connected end-to-end. While building it I found **32
> real bugs** in default Juice Shop — they're encoded as passing tests so the
> suite doubles as a regression net the day the build is hardened. Two custom
> reporters: a CSV-history dashboard for trends, and a self-contained rich
> HTML report that embeds every API call, trace, and screenshot per test.
> Whole thing runs in 1m 46s on CI."

Numbers worth memorising:

| Metric | Value |
|---|---|
| Total tests | **226** (100% pass) |
| Assignment-scope tests (`@everstage-qa`) | 157 |
| Documented bugs | **32** (2 critical · 8 high · 7 medium · 15 low) |
| Page Object Models | 12 |
| Custom Playwright fixtures | 3 |
| Helper modules | 7 |
| Wall time (serial, on CI) | 1m 46s |
| CI runtime end-to-end (with Juice Shop pull + bootstrap) | 3m 40s |

---

## 5-minute live walkthrough (the order to show things)

1. **Open the repo on GitHub** — point to the green ✓ badge on `main`. "Tests pass on every push."
2. **Open `reports/test-report.html`** — _the_ artefact reviewers should remember.
   - **Top stats** → "226 tests passed, 1m46s, and **25 bugs found**." (point to the red bug card)
   - **Click the red bugs card** → smooth-scrolls to the Bugs panel.
   - **Click one row** → quick fix appears with a copy button.
   - **Click "Show this test in the list"** → scrolls to the actual test with API capture + trace.
3. **Open one test row** → expand to show the captured request/response payloads.
4. **Switch to `docs/SECURITY-FINDINGS.md`** — same intel, with severity + repro.
5. **Switch to `docs/test-cases.md`** — auto-generated catalogue (`node tools/gen-catalog.js`).
6. **Open `.github/workflows/playwright.yml`** — "This is what runs end-to-end on every push to main."

Total: 4-5 min, no live test runs needed.

---

## The Report — talking points

### Why two reporters?

> "Different audiences. CSV reporter answers **'is this test getting flakier
> over time?'** — append-only history, simple bar dashboard. Rich reporter
> answers **'why did this specific run fail?'** — every API call, error
> stack, screenshot embedded in one HTML file you can email."

### The rich reporter — what's in it

1. **Header stats** — total / passed / failed / **bugs found** / flaky / runtime.
2. **Pass-rate trend** — last 30 runs, each bar coloured by pass rate (green > 95%, amber > 80%, red < 80%). Hover for `passed/total + timestamp`.
3. **Coverage by tag** — three groups: Assignment (`@everstage-qa`, `@task1/2/3`), CI Gates (`@smoke`, `@regression`, `@e2e`), Test Category (`@positive`, `@negative`, `@security`, etc.). Each click → filter the test list.
4. **🐞 Bugs found** — the 32 documented findings as red "BUG FOUND" cards. Severity dropdown, kind dropdown, sort dropdown, **click a severity pill to filter, click any row → expand the Quick Fix + Copy-fix button.**
5. **Filter bar** — search + status + layer + category + assignment + CI gate chips. Reset-all button shows up when anything is active.
6. **Test list** — grouped by area / category / file / tag. Click a row → captured API calls, error stack, attachments, traces, screenshots.

### Why a custom reporter instead of just Playwright's HTML?

> "Playwright's HTML report is great for one developer debugging one run —
> but it doesn't answer 'how has this suite trended?' or 'which bugs are we
> still asserting?' My reporter is **append-only** (every run lives in
> `run-history.csv`) and surfaces the documented findings front-and-centre
> so reviewers don't miss them."

### Key code paths

| File | What to say |
|---|---|
| `tests/reporters/rich-reporter.ts` | Single TS file emits a self-contained HTML. CSS + state + render logic all inline inside a template literal. **Gotcha I hit**: `\w` inside a template gets stripped → use `\\w`. State persistence: `state.expanded`, `state.collapsedGroups`, `state.expandedFindings` survive re-renders. |
| `tests/reporters/csv-reporter.ts` | Schema-aware: detects old-format `run-history.csv` and rotates to `.legacy-{ts}.csv` so the new `tags` and `retries` columns don't silently drop. Writes `dashboard.html` + `summary.md` + `junit.xml`. |
| `tests/helpers/logged-request.ts` | Wraps Playwright's `request` so every API call is captured and embedded into the rich report (visible in the per-test "API calls" panel). |

---

## CI/CD — talking points

### What runs in GitHub Actions

1. Pull `bkimminich/juice-shop:latest` as a service container on port 3000.
2. Set up Node 20, `npm ci`, `playwright install chromium`.
3. **Wait for Juice Shop** to answer `/rest/admin/application-version` (curl loop on the runner host).
4. **Bootstrap the assignment user** — register via `POST /api/Users/`, login, link a security answer. Idempotent.
5. **Run Playwright** — workers=2, retries=3, trace=retain-on-failure (all controlled via `process.env.CI`).
6. **Upload artefacts**:
   - `playwright-report-html` → rich report + dashboard + summary + junit + run-history (30-day retention).
   - `playwright-traces` → trace zips + screenshots + videos (14-day retention).
7. **Publish JUnit Check Run** via `dorny/test-reporter` so the commit gets a green ✓ summary.
8. **Step summary** — appends `summary.md` to the run summary so it shows directly in the Actions UI.

### Triggers
- Every push to `main`.
- Every pull request against `main`.
- Daily 06:00 UTC scheduled regression sweep.
- Manual `workflow_dispatch` with optional `grep` (e.g. `@security`) and `trace_mode` inputs.

### Why these settings

| Setting | Why |
|---|---|
| `workers=2` | Faster than serial, but order-flow specs share a basket/session per worker — too many workers cause cross-talk. 2 is the sweet spot. |
| `retries=3` | Absorbs transient network flakes (CI containers, GitHub runners). The dashboard shows retries inline so you don't miss real flake. |
| `trace=retain-on-failure` | `trace=on` produces 200+ MB per run on the full suite. Retain-on-failure gives debug info exactly where you need it. |
| Drop `--health-cmd` | Latest Juice Shop image ships without `wget`/`curl`; in-job curl-loop on the runner covers the same timing. |
| `permissions: checks: write` | `dorny/test-reporter` posts a Check Run; default GITHUB_TOKEN is read-only on push events. |

### Cross-platform CI examples
`ci-examples/` ships ready-to-use stubs for GitLab, Jenkins, and Azure Pipelines. Same shape, same artefacts.

---

## Logic & architecture — talking points

### Page Object Model
> "Selectors live in `tests/pages/*` — never in test bodies. When Juice Shop
> rebrands a button, I fix it in one file. Each POM exposes **locators as
> fields and actions as methods**; the page object never calls `expect`,
> assertions stay in the test file."

### Helpers
- `helpers/login.ts` — single source of truth for the `beforeEach` login. Used by every UI spec. **(Task 1 core)**
- `helpers/api.ts` — `loginViaApi`, `loginSession`, `findStockableProductId(minQty)`.
- `helpers/banners.ts` — pre-seeds cookies so welcome / cookie / language banners don't cover form elements.
- `helpers/card.ts` — `uniqueCardNumber()` — Visa-prefixed, 12 random digits. Collision-safe across parallel runs.
- `helpers/user.ts` — fresh-account factories for tests that mutate state (forgot-password etc.).
- `helpers/seed.ts` — idempotent basket / order-flow seeding.
- `helpers/logged-request.ts` — proxies the Playwright `request` fixture, captures every call into the rich report.

### Fixtures (`tests/fixtures.ts`)
Three custom fixtures that compose:
1. `apiSession` — logged-in token + basket id, **cached per worker** (so we don't login 200 times).
2. `authenticatedPage` — extends `page`, runs `beforeEach` login inline.
3. `seededCheckout` — `apiSession` + clean basket + 1 address + 1 saved card + a `stockable productId` + the default delivery method. Lets the order-flow tests focus on the checkout funnel itself, not the setup.

### Tagging strategy
Every test carries layered tags so one test runs in many slices:

| Layer | Tags | Purpose |
|---|---|---|
| Assignment | `@everstage-qa`, `@task1/2/3` | "Run exactly what the brief asked for." |
| CI gate | `@smoke`, `@regression`, `@e2e` | "What runs on push vs nightly vs end-to-end." |
| Category | `@positive`, `@negative`, `@boundary`, `@security`, `@load`, `@functional`, `@nonfunctional` | "What kind of risk does this cover?" |

`npm run test:task1` → 15 tests. `npm run test:security` → 45 tests. `npm run test:smoke` → 9 tests. **The same test appears in multiple slices.**

### The documented-findings pattern
> "Standard security-test pattern fails on a vulnerable build. That makes CI
> red every day until the team fixes it — so people stop reading the alerts.
> I flipped it: tests assert that the **buggy** behavior is still present.
> They stay green on the unsafe build. The day the team hardens the
> endpoint, the test goes red — _exactly when the team needs to confirm
> the fix landed_. 32 of these. Each one has a quick-fix suggestion in the
> rich report and a full write-up in `docs/SECURITY-FINDINGS.md`."

---

## ~30 expected questions with prepared answers

### Architecture

**Q: Why Playwright over Cypress / Selenium / WebdriverIO?**
A: Built-in API testing (no extra framework for the REST tests), built-in trace viewer, cross-browser without a Selenium grid. Cypress can't easily switch browser contexts mid-test or hit two domains. Selenium has no first-class API testing.

**Q: Why TypeScript?**
A: Page Object locators get auto-complete in the IDE. Refactoring is safe — rename a method on `LoginPage` and every test that calls it lights up red. `tsc --noEmit` runs in CI as a free regression check.

**Q: Why a Page Object Model and not Playwright's built-in component testing?**
A: Juice Shop is an Angular app — the components are upstream, not mine. POMs give me a stable contract on top of the rendered DOM. Component testing makes sense when you own the components.

**Q: How do you handle authentication state between tests?**
A: The `apiSession` fixture logs in once per worker via the API, caches the token, and reuses it. The `authenticatedPage` fixture extends `page` and runs the UI login inline in `beforeEach`. Tests that need a fresh user call `freshUser()` from `helpers/user.ts`.

**Q: Why a custom reporter instead of off-the-shelf (Allure, ReportPortal)?**
A: Allure/ReportPortal want a separate server. I wanted a single HTML file you can email. Custom reporter is ~2000 lines, builds in one pass, no server, no auth — open it in any browser.

### Test design

**Q: How do you make sure tests don't pollute each other?**
A: Three layers. (1) Mutating tests use `freshUser()` so they get a brand-new account. (2) Card numbers come from `uniqueCardNumber()` — 12 random trailing digits, 10^12 unique values. (3) The seed helpers (`seedBasket`) are idempotent and clear state before they fill it.

**Q: What's your locator strategy?**
A: Prefer in this order: `getByRole` → `getByLabel` → `getByText` → `id`/`name` attr → CSS as last resort. Juice Shop doesn't use `data-testid`, so when text-based locators are too flaky I fall back to the unique `id` attrs Angular Material assigns.

**Q: How do you stabilise flaky tests?**
A: First, identify root cause via the trace. Common: race between Angular re-render and a click. Fix: `await expect(locator).toBeVisible()` before interacting, or `waitForResponse`. Never just bump the timeout. The CSV dashboard surfaces per-test pass-rate so flaky tests are easy to spot.

**Q: What's `findStockableProductId` doing?**
A: Juice Shop's inventory persists across runs and drains. The helper queries `/api/Quantitys/` and returns a product id with at least `minQty` stock + no `limitPerUser` cap. Made it generic when TC-UI-730 (high-quantity boundary) started failing because the default product was down to 1.

**Q: Why is your suite green when there are 32 known bugs?**
A: That's by design. Each `DOCUMENTED VULN` test asserts the vulnerable behavior is **still present**. Green = bug still there. Red = bug fixed (or accidentally changed). CI doesn't go red for every known vuln — but a real regression still surfaces immediately.

### CI/CD

**Q: Walk me through your workflow.**
A: See the CI section above. Service container → wait → bootstrap user → run tests → upload artefacts → publish Check Run.

**Q: Why workers=2?**
A: Order-flow specs share a basket per worker; too many workers cause cross-talk on the basket id. 2 was the empirical sweet spot — full suite drops from 5m serial to 2m at 2 workers, then plateaus.

**Q: What happens if Juice Shop's `latest` image breaks the suite tomorrow?**
A: The bootstrap step would error out with a clear "register http=400" line in the log because the registration body shape changed. Pin the image to a known-good SHA: `bkimminich/juice-shop:v17.0.0` instead of `:latest`.

**Q: How do you handle secrets?**
A: There are no real secrets — the assignment user is a throw-away account on a local Juice Shop. For a real product, I'd use GitHub Encrypted Secrets, never commit credentials. The `bootstrap` step reads `tests/data/new-user.json` which is intentionally public test data.

**Q: How would you scale this to 1000 tests?**
A: Sharding via `playwright test --shard=1/4`. The custom reporter aggregates shard results via the JUnit XML stage. Move from GitHub Actions to a self-hosted runner pool for parallel browser pre-warming. Probably split UI and API into separate workflows so API failures don't block fast UI feedback.

**Q: Why isn't there visual regression?**
A: Out of scope for this assessment — Juice Shop changes its theme regularly so visual diffs would be noisy. Easy to add with `expect(page).toHaveScreenshot()` if needed.

**Q: How do you handle the `dorny/test-reporter` permission issue?**
A: Default `GITHUB_TOKEN` is read-only on push events. Need `permissions: checks: write` on the workflow. Set it once at the top of `playwright.yml`.

### Reports & artefacts

**Q: What's in `reports/run-history.csv`?**
A: One row per test per run. Columns: `run_id, run_timestamp, test_id, area, priority, type, title, tags, status, duration_ms, retries, error_message`. Append-only. The dashboard reads it and renders per-test pass-rate over time.

**Q: Why JUnit XML?**
A: CI consumers. GitHub Actions, Jenkins, GitLab, Azure all understand JUnit. Lets the team see test status without opening my custom HTML.

**Q: How do you surface a documented bug in the report?**
A: Test title starts with `DOCUMENTED VULN:` or `DOCUMENTED UX:`. The rich reporter regex-matches that prefix in `data.records`, plus a hard-coded severity tier (Critical/High/Medium/Low) and a quick-fix string. 32 entries in `QUICK_FIX` dictionary inside `renderFindings`.

**Q: What does the "Copy fix" button do?**
A: `navigator.clipboard.writeText("TC-API-1301: Server must ignore client-supplied UserId...")`. Useful for pasting into Jira / Slack. Falls back silently if clipboard API is blocked.

### Engineering decisions

**Q: Why not use `data-testid` attributes?**
A: Juice Shop is upstream — I don't own its source. Asking the team to add testids is the right long-term move; for now, role-based and label-based locators work.

**Q: Why two new-user files (`new-user.json` vs `freshUser()`)?**
A: `new-user.json` is the **shared assignment account** for tests that need a stable identity (login, profile, address book). `freshUser()` creates a brand-new account for **mutating tests** (change-password, forgot-password) that would otherwise change the shared account's credentials and break parallel runs.

**Q: Why a single `npm test` command instead of a Makefile?**
A: Node ecosystem convention. Everyone with `npm` can run it; nobody needs a Makefile interpreter.

**Q: How would you onboard a new engineer to this suite?**
A: `docs/ARCHITECTURE.md` (one-page diagram-led tour) → `docs/test-cases.md` (catalogue) → `docs/CODE-ANALYSIS.md` if they need every file. Then `npm run test:smoke && npm run report:rich` to see what passing looks like.

**Q: What would you do differently with another week?**
A: 1) Move secrets to GitHub Secrets and stop using a fixed assignment user. 2) Add visual regression on the bug panel itself (`expect(page).toHaveScreenshot()` of `reports/test-report.html`). 3) Wire the rich report to push to GitHub Pages so reviewers don't have to download the artefact. 4) Implement at least the top-3 quick fixes in a Juice Shop PR upstream — turn the suite into a regression net for those fixes.

### Live debugging — "demo recovery cheat sheet"

If a test fails during the demo:
1. **Open the trace viewer**: `npx playwright show-trace test-results/<dir>/trace.zip` — frame-by-frame UI playback.
2. **Open the rich report's row**: every captured request/response is right there.
3. **Re-run just that test**: `npx playwright test --grep "TC-API-001"`.

If the browser dies:
- `npx playwright install chromium --force` rebuilds the bundle.

If Juice Shop's data is stale:
- `docker rm -f $(docker ps -q --filter ancestor=bkimminich/juice-shop)` then `docker run -p 3000:3000 bkimminich/juice-shop` for a fresh DB.

If the user is deleted between runs:
- Re-run `tests/api/register.spec.ts` — first test registers the assignment user.

---

## "If they ask X, open Y" quick-find

| If they ask… | Open this |
|---|---|
| The brief explanation | `README.md` (top) |
| Architecture diagram | `README.md` mermaid block, or `docs/ARCHITECTURE.md` |
| Why a test is shaped this way | `docs/CODE-ANALYSIS.md`, section for that file |
| Security findings | `docs/SECURITY-FINDINGS.md` (also the Bugs panel in the rich report) |
| The full test catalogue | `docs/test-cases.md` or `docs/test-cases.csv` |
| Test plan / strategy | `docs/TEST-PLAN.md` |
| How the report works | `tests/reporters/rich-reporter.ts` (line 200-ish onward is the renderer) |
| How the bootstrap works | `.github/workflows/playwright.yml`, "Bootstrap the assignment user" step |
| Why workers=2 | This doc, "Why these settings" table |
| Why findings stay green | This doc, "The documented-findings pattern" |

---

## Sentences worth memorising

These are short enough to drop mid-conversation without sounding scripted.

- _"Each Page Object exposes locators as fields and actions as methods. Assertions live in the test, never in the page object."_
- _"Tests assert that the bug is still present, so green = bug still there. The day it's fixed, the test goes red — exactly when the team needs to know."_
- _"The custom reporter answers two questions Playwright's default doesn't: how is the suite trending, and what bugs are we still tracking?"_
- _"The CI workflow is fully self-bootstrapping — fresh Juice Shop, registered user, security answer linked, all in 40 seconds before the first test."_
- _"Three layers of tags mean the same test runs in `@task2`, `@smoke`, `@e2e`, and `@regression` without duplication."_
- _"Workers=2 isn't a guess — it's the empirical sweet spot. The order-flow specs share a basket per worker, so more parallelism causes cross-talk."_

---

_Last reviewed: 2026-05-11. Deep-dive in [`docs/CODE-ANALYSIS.md`](CODE-ANALYSIS.md). Anything missing? Add a Q with the answer here so you've practised it before the call._
