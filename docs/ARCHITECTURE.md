# Architecture

A short, diagram-led tour of the suite for anyone reviewing the code.

## Layout

```
EverStage/
├── tests/
│   ├── ui/             # Playwright UI specs (browser-driven)
│   ├── api/            # Playwright API specs (request fixture only)
│   ├── pages/          # Page Object Models — selectors + actions
│   ├── helpers/        # Shared utilities (login, banners, factories, seeds)
│   ├── reporters/      # Custom reporters (csv + rich HTML)
│   ├── fixtures.ts     # Shared Playwright fixtures (e.g. authenticated page)
│   └── data/new-user.json   # Shared test account credentials
│
├── docs/
│   ├── test-cases.md   # Auto-generated catalogue of every test
│   ├── test-cases.csv  # Same data, machine-readable
│   ├── TEST-PLAN.md    # Strategy doc — risks, scope, exit criteria
│   ├── SECURITY-FINDINGS.md  # 32 documented vulns / UX gaps with severity
│   ├── ARCHITECTURE.md       # ← you are here
│   └── site/                 # Static landing page deployed to GitHub Pages
│
├── reports/            # Generated every run (gitignored except baselines)
│   ├── dashboard.html  # csv-reporter output — historical pass-rate trends
│   ├── test-report.html  # rich-reporter output — interactive failure drill-down
│   ├── summary.md      # Markdown summary for PR / Slack
│   ├── junit.xml       # CI consumers
│   └── run-history.csv # Append-only ledger of every run
│
├── tools/gen-catalog.js     # Regenerates docs/test-cases.{md,csv}
├── playwright.config.ts     # 1 browser, 2 retries, custom reporters wired in
└── .github/workflows/       # GitHub Actions
```

## Data flow on a single run

```
playwright.config.ts
        │
        ▼
   spec files               ──reads──►  tests/data/new-user.json
        │                                        │
        ▼                                        ▼
   PageObject / api helper          tests/helpers/login.ts
        │                                        │
        ▼                                        ▼
   live Juice Shop ◄────HTTP / browser───── beforeEach login
        │
        ▼
   reporter chain ──►  list  (terminal)
                      html   (playwright-report/)
                      junit  (reports/junit.xml)
                      csv    (reports/run-history.csv ➜ dashboard.html)
                      rich   (reports/test-report.html + summary.md)
```

Both custom reporters consume the same Playwright TestCase / TestResult events.
- **csv-reporter** — appends a row per test to `reports/run-history.csv`, then re-renders `dashboard.html` with historical pass-rate-per-test, per-tag breakdowns, and a list of recent runs. Best for "is this test getting flakier?" questions.
- **rich-reporter** — emits a single self-contained `reports/test-report.html` with the full per-test detail (steps, errors, captured API calls, attachments, screenshots, video links). Best for "why did this test fail?" debugging.

## Tagging system

Every test carries a layered tag set. The same test can appear in multiple slices:

| Tag layer | Examples | Purpose |
|---|---|---|
| **Assignment** | `@everstage-qa`, `@task1`, `@task2`, `@task3` | "Run exactly what the brief asked for." |
| **CI gate** | `@smoke`, `@regression`, `@e2e` | "What runs on every push vs nightly vs end-to-end suite." |
| **Category** | `@positive`, `@negative`, `@boundary`, `@security`, `@load`, `@functional`, `@nonfunctional` | "What kind of risk does this test cover?" |

Each layer maps to an `npm run test:*` script (see README) so an assessor can run any slice in one command.

## Page Object Models

Each page object exposes:
- **Locators** as fields (e.g. `loginPage.emailInput`).
- **Actions** as methods (e.g. `loginPage.login(email, password)`).
- **No assertions** — assertions live in the test file. The page object never calls `expect`.

This keeps the test bodies readable and the selectors swappable in one place when Juice Shop renames a button.

## Helpers

| File | Responsibility |
|---|---|
| `helpers/api.ts`        | `loginViaApi`, `registerUserViaApi` — small wrappers around the auth endpoints used by API specs and seed scripts. |
| `helpers/login.ts`      | `loginBeforeEach(page, context)` — the Task 1 helper called from every UI spec's `beforeEach`. |
| `helpers/logged-request.ts` | Wraps Playwright's `request` fixture so every call gets logged with method/URL/status into the rich-reporter's "API calls" panel. |
| `helpers/banners.ts`    | Suppresses Juice Shop's welcome + cookie banners via cookies set before navigation. |
| `helpers/card.ts`       | `uniqueCardNumber()` — Visa-prefixed 16-digit number with random tail; collision-safe across parallel runs. |
| `helpers/user.ts`       | `freshUser()`, `uniqueEmail()` — fresh-account factories so mutating tests never collide with the shared assignment account. |
| `helpers/seed.ts`       | Idempotent setup helpers (e.g. ensure a basket exists for a user) used in e2e flows. |

## Custom fixtures

`tests/fixtures.ts` extends Playwright's base test with an `authenticatedPage` fixture. UI specs that don't care about the login mechanics can do `test('...', async ({ authenticatedPage }) => { ... })` and skip the boilerplate.

## CI

`.github/workflows/playwright.yml` runs the smoke slice on every push to `feat/qa-assignment`, the full assignment slice nightly, and uploads `playwright-report/`, `reports/test-report.html`, and `reports/junit.xml` as build artifacts. Equivalent stubs for GitLab, Jenkins, and Azure live in `ci-examples/`.

## Why this shape

- **POM + helpers + fixtures** → tests stay declarative; selector changes hit one file.
- **Per-task tags** → an assessor can run "exactly what the brief asked for" in one command.
- **Two reporters** → trend-over-time lives in CSV/dashboard; per-failure drill-down lives in the rich HTML; junit covers CI dashboards.
- **Documented findings** → the suite is also a security audit. 32 vulns/UX gaps live as passing tests against the vulnerable build; flipping any single assertion turns the suite into a regression net for a hardened build.
