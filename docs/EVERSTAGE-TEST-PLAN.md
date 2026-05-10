<div align="center">

# Everstage QA — Test Plan

### Juice Shop QA Automation · pairing-exercise submission

![Status](https://img.shields.io/badge/Suite-223%20%2F%20223%20green-10B981?style=flat-square)
![Runtime](https://img.shields.io/badge/Runtime-~2%20min-2563EB?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Playwright%20%2B%20TypeScript-4F6BFF?style=flat-square)
![Brief](https://img.shields.io/badge/Brief%20tasks-3%20%2F%203%20covered-5EE7FF?style=flat-square)
![CI](https://img.shields.io/badge/CI-4%20pipelines-8B5CF6?style=flat-square)

**Ashik Mohamed** · OWASP Juice Shop v19.2.1 · `localhost:3000`

</div>

> **One-page test plan.** Every section earns its place by mapping back to the brief.

---

## Contents

| § | Section |
|---|---|
| 1 | [Brief at a glance](#1--brief-at-a-glance) |
| 2 | [Scope](#2--scope) |
| 3 | [Coverage by task](#3--coverage-by-task) |
| 4 | [Locator strategy](#4--locator-strategy) |
| 5 | [Test architecture](#5--test-architecture) |
| 6 | [How to run](#6--how-to-run) |
| 7 | [Risks & mitigations](#7--risks--mitigations) |
| 8 | [Roadmap](#8--roadmap) |
| 9 | [Exit criteria](#9--exit-criteria) |

---

## 1 · Brief at a glance

<table>
<tr>
<th>Task</th><th>What the brief asks</th><th>Where it lives</th><th align="center">Tests</th>
</tr>
<tr>
<td align="center"><b>1</b></td>
<td>Register a user manually, save creds in <code>new-user.json</code>, write a login script in <code>beforeEach</code></td>
<td><code>tests/helpers/login.ts</code><br><code>tests/ui/task1-login.spec.ts</code></td>
<td align="center"><b>15</b></td>
</tr>
<tr>
<td align="center"><b>2</b></td>
<td>UI test from homescreen → My Payments → add card</td>
<td><code>tests/pages/PaymentPage.ts</code><br><code>tests/ui/task2-add-card.spec.ts</code></td>
<td align="center"><b>23</b></td>
</tr>
<tr>
<td align="center"><b>3</b></td>
<td>API test that adds a unique card</td>
<td><code>tests/helpers/card.ts</code><br><code>tests/api/task3-add-card.spec.ts</code></td>
<td align="center"><b>46</b></td>
</tr>
<tr>
<td align="center"><b>+</b></td>
<td>Implicit asks — runs out of the box · stable locators · clean code · ready to troubleshoot</td>
<td colspan="2" align="center">covered across all of the above</td>
</tr>
</table>

<div align="center">

> **84** assessment-tagged tests &nbsp;+&nbsp; **139** bonus  &nbsp;=&nbsp;  **223 / 223 green**  in ~2 min

</div>

---

## 2 · Scope

<table>
<tr>
<td valign="top" width="50%">

**In scope**

- Login (UI)
- Add-card (UI + API)
- Validation, negative paths
- Basic security — XSS / SQLi reflection
- Boundary inputs
- Light load (5–10× concurrent)

</td>
<td valign="top" width="50%">

**Out of scope**

- Pen-test exploitation
- Performance benchmarking past P95
- Mobile viewports
- Visual regression
- Full accessibility audit

→ tracked in [§ 8 Roadmap](#8--roadmap)

</td>
</tr>
</table>

**Environments** — local Docker is primary. CI uses the identical image so behavior is reproducible.

---

## 3 · Coverage by task

### Task 1 — `beforeEach` login &nbsp; · &nbsp; **15 tests**

| Type | What it covers |
|---|---|
| Happy path | login succeeds · navbar account icon visible · URL no longer matches `/login` |
| Negative | wrong password · unknown email · empty fields · locked account |
| Resilience | banner cookies pre-seeded so popups never intercept clicks |
| Cleanup | each test starts unauthenticated; `beforeEach` does the work |

> **Acceptance** — every spec across the suite reuses `loginBeforeEach()`; failure of any login step fails fast with a readable assertion.

### Task 2 — UI add card &nbsp; · &nbsp; **23 tests**

| Type | What it covers |
|---|---|
| Happy path | nav → My Payments · fill form · save · confirmation snackbar + row appears |
| Validation | empty form / partial fill keeps Submit disabled · non-digit chars filtered |
| Security | XSS in cardholder name renders as text · SQLi-style strings stored verbatim |
| Boundary | expiry **2080 / 2099** · 200-character name |
| Load | 5 cards rapid succession · round-trip < 15 s |

> **Acceptance** — `[TC-UI-001]` (the literal brief) passes on a clean Juice Shop with the registered user.

### Task 3 — API unique card &nbsp; · &nbsp; **46 tests**

| Type | What it covers |
|---|---|
| CRUD | `POST` / `GET` / `DELETE` `/api/Cards` |
| Uniqueness | `uniqueCardNumber()` = `4111` + 12 random digits → 10¹² values, no collisions across parallel runs |
| Boundary | `expMonth` 0 / 1 / 12 / 13 · `expYear` 2079 → 2100 |
| Auth | JWT tampering · missing token · IDOR cross-tenant |
| Security | mass-assignment · SQLi / XSS in `fullName` |
| Load | 10× concurrent POSTs · P95 latency < 1500 ms |

> **Acceptance** — `[TC-API-001]` returns `201` with `data.cardNum` containing the last 4 of a fresh unique number.

---

## 4 · Locator strategy

> The brief explicitly asks for **stable locators** — this is the rulebook the suite follows.

| Tier | Method | Example | Survives |
|:---:|---|---|:---:|
| **1** | Stable IDs | `page.locator('#submitButton')` | Material upgrades &nbsp;✓ |
| **2** | ARIA role + name | `getByRole('button', { name: 'Login' })` | ARIA-only changes &nbsp;✓ |
| **3** | ARIA label | `getByLabel('Card Number', { exact: true })` | label wording stable &nbsp;✓ |
| **4** | Tag + text/regex | `locator('simple-snack-bar', { hasText: /saved/i })` | wording changes &nbsp;⚠ |
| **✗** | Auto-generated CSS | `.mat-mdc-form-field-2 > div:nth-child(3)` | every release &nbsp;✗ |

**Rule** — reach for the highest tier that uniquely identifies the element. POMs in `tests/pages/*.ts` are the only place selectors live.

---

## 5 · Test architecture

```text
tests/
├── data/new-user.json          ← the brief's literal credential file
├── helpers/                    ← login · card · banners · api wrappers
├── pages/                      ← one POM per page (12 files)
├── fixtures.ts                 ← apiSession · authenticatedPage · seededCheckout
├── ui/task1-login.spec.ts      ← Task 1
├── ui/task2-add-card.spec.ts   ← Task 2
├── api/task3-add-card.spec.ts  ← Task 3
└── reporters/rich-reporter.ts  ← custom HTML report
```

Two layers — **UI** + **API** — sharing helpers, fixtures, and one Playwright runner.

**Tag-driven slicing**

`@task1` &nbsp;·&nbsp; `@task2` &nbsp;·&nbsp; `@task3` &nbsp;·&nbsp; `@everstage-qa` &nbsp;·&nbsp; `@smoke` &nbsp;·&nbsp; `@regression` &nbsp;·&nbsp; `@security` &nbsp;·&nbsp; `@boundary` &nbsp;·&nbsp; `@load`

---

## 6 · How to run

```bash
# 1. Start Juice Shop
docker run -d -p 3000:3000 bkimminich/juice-shop

# 2. Install dependencies
npm install && npx playwright install chromium

# 3. Run tests
npm test                    # all 223
npm run test:everstage      # 84 @everstage-qa specs
npm run demo                # @everstage-qa with traces → opens rich report
npm run demo:task1          # only Task 1  (15 specs · ~25 s)
npm run demo:task2          # only Task 2  (23 specs · ~40 s)
npm run demo:task3          # only Task 3  (46 specs · ~50 s)
npm run demo:smoke          # 9-spec sanity gate (~9 s)
```

**Reports** — `reports/test-report.html` (custom rich, single self-contained HTML) and `playwright-report/` (default).

---

## 7 · Risks & mitigations

| # | Risk | Mitigation |
|:---:|---|---|
| 1 | Apple Juice stockout breaks order-flow specs | `findStockableProductId()` queries `/api/Quantitys` live |
| 2 | Dismiss-cookies banner intercepts clicks on first run | `suppressBanners()` pre-seeds the cookies |
| 3 | Material UI upgrade breaks selectors | 4-tier locator rule · auto-generated CSS forbidden |
| 4 | Card-table re-render slows assertions | `beforeEach` clears all cards via `DELETE /api/Cards/:id` |
| 5 | Parallel runs collide on card number | `uniqueCardNumber()` 10¹² space · per-worker `storageState` planned |

---

## 8 · Roadmap

> Sequenced, not forgotten.

`Visual regression`  &nbsp;·&nbsp;  `axe-core accessibility`  &nbsp;·&nbsp;  `storageState (6× throughput)`  &nbsp;·&nbsp;  `per-worker users`  &nbsp;·&nbsp;  `mutation testing — Stryker`  &nbsp;·&nbsp;  `Pact contract on /api/Cards`  &nbsp;·&nbsp;  `Lighthouse perf budget`  &nbsp;·&nbsp;  `Firefox + WebKit nightly`

---

## 9 · Exit criteria

- [x] All three brief tasks have a passing happy-path spec
- [x] Suite runs out of the box with `npm test`
- [x] No selector relies on auto-generated CSS
- [x] Rich HTML report opens with one command
- [x] CI green on GitHub Actions · configs for GitLab / Jenkins / Azure included
- [x] **223 / 223** tests passing on a fresh Juice Shop image

<div align="center">

---

**Status — ready for review.**

*Ashik Mohamed · Everstage QA Engineering Assessment · 2026*

</div>
