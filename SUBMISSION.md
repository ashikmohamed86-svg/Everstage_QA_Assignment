<div align="center">

# Everstage QA — Assessment Submission

### Juice Shop QA Automation · Playwright + TypeScript

![Suite](https://img.shields.io/badge/Suite-223%20%2F%20223%20green-10B981?style=flat-square)
![Runtime](https://img.shields.io/badge/Runtime-2m%2020s-2563EB?style=flat-square)
![Brief](https://img.shields.io/badge/Brief%20tasks-3%20%2F%203%20covered-5EE7FF?style=flat-square)
![Bugs](https://img.shields.io/badge/Bugs%20found-33%20active-DC2626?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Playwright%20%2B%20TS-4F6BFF?style=flat-square)

**Submitted by Ashik Mohamed** · 10 May 2026 · OWASP Juice Shop v19.2.1 · `localhost:3000`

</div>

---

## 1 · Submission package

| # | Deliverable | Link |
|:---:|---|---|
| 1 | **Repository** — full Playwright + TypeScript suite | [github.com/ashikmohamed86-svg/Everstage_QA_Assignment](https://github.com/ashikmohamed86-svg/Everstage_QA_Assignment) |
| 2 | **Presentation** — 20-slide submission deck | [Google Slides](https://docs.google.com/presentation/d/1xk47dgL5GX4yS45FBGvCnl1-jLnWrQYZpqg0MF3jl-s/edit?slide=id.p1#slide=id.p1) |
| 3 | **Test plan** — one-page focused plan | [Google Doc](https://docs.google.com/document/d/10VqAsloFgn9Q_CcnbhT3CHMscGKa64EDodBagQis2hc/edit?tab=t.0) |
| 4 | **Test cases** — 224-row catalog · 7 sheets | [Google Sheet](https://docs.google.com/spreadsheets/d/1AEHPxAKOn9nanVBu16eCOahUvZBKmv1XyJg3SBLsT9E/edit?gid=697333980#gid=697333980) |
| 5 | **Demo recording** — live run walkthrough | *(placeholder — link to be added)* |

---

## 2 · The brief, mapped

| Task | What was asked | Where it lives | Tests |
|:---:|---|---|:---:|
| **1** | Register a user manually, save creds in `new-user.json`, write a login script in `beforeEach` | `tests/helpers/login.ts` · `tests/ui/task1-login.spec.ts` | **18** |
| **2** | UI test from homescreen → My Payments → add card | `tests/pages/PaymentPage.ts` · `tests/ui/task2-add-card.spec.ts` | **23** |
| **3** | API test that adds a unique card | `tests/helpers/card.ts` · `tests/api/task3-add-card.spec.ts` | **52** |
| **+** | Implicit asks — runs out of the box · stable locators · clean code · ready to troubleshoot | covered across the whole suite | — |

> **154** assessment-tagged tests + **69** bonus = **223 / 223 green** in **2m 20s**.

---

## 3 · Bugs found — 33 active findings

<table>
<tr>
<th align="center">🔴 Critical</th>
<th align="center">🟠 High</th>
<th align="center">🟡 Medium</th>
<th align="center">🔵 Low / UX</th>
<th align="center">Total</th>
</tr>
<tr>
<td align="center"><b>2</b></td>
<td align="center"><b>8</b></td>
<td align="center"><b>7</b></td>
<td align="center"><b>16</b></td>
<td align="center"><b>33</b></td>
</tr>
</table>

Each finding is asserted as a **passing** test that encodes the unsafe behaviour. The day a bug is fixed, its test goes red — the team confirms the fix landed. Full register: test plan §7 · xlsx tab "Bugs Found" · `docs/SECURITY-FINDINGS.md`.

---

## 4 · Run it in 3 commands

```bash
docker run -d -p 3000:3000 bkimminich/juice-shop      # 1. Start Juice Shop
npm install && npx playwright install chromium        # 2. Install
npm test                                              # 3. Run all 223
```

**Sliced runs**

```bash
npm run demo                    # @everstage-qa with traces → opens rich report
npm run demo:task1              # only Task 1   (18 specs · ~25 s)
npm run demo:task2              # only Task 2   (23 specs · ~40 s)
npm run demo:task3              # only Task 3   (52 specs · ~50 s)
npm run demo:smoke              # 9-spec sanity gate (~9 s)
```

Reports — `reports/test-report.html` (custom rich, single self-contained HTML).

---

## 5 · Locator strategy (the brief asks for this)

| Tier | Method | Survives |
|:---:|---|---|
| 1 | Stable IDs — `#submitButton` | Material upgrades ✓ |
| 2 | ARIA role + name — `getByRole('button', { name: 'Login' })` | ARIA-only changes ✓ |
| 3 | ARIA label — `getByLabel('Card Number', { exact: true })` | label wording ✓ |
| 4 | Tag + text/regex | wording changes ⚠ |
| ✗ | Auto-generated CSS — `.mat-mdc-form-field-2 > div:nth-child(3)` | every release ✗ |

POMs in `tests/pages/*.ts` are the only place selectors live.

---

## 6 · Reviewer FAQ

<table>
<tr><th align="left">Question</th><th align="left">Answer</th></tr>
<tr><td>Where do I start?</td><td>Read the <a href="https://docs.google.com/presentation/d/1xk47dgL5GX4yS45FBGvCnl1-jLnWrQYZpqg0MF3jl-s/edit?slide=id.p1#slide=id.p1">presentation</a> (~10 min) → clone the <a href="https://github.com/ashikmohamed86-svg/Everstage_QA_Assignment">repo</a> → run <code>npm test</code>.</td></tr>
<tr><td>How long does the suite take?</td><td><b>~2m 20s</b> for the full 223-test run on a fresh Juice Shop image.</td></tr>
<tr><td>Why are some tests labelled "DOCUMENTED VULN"?</td><td>They assert the <b>unsafe</b> behaviour of the default Juice Shop build, so the suite stays green on the unsafe image and goes red the day the bug is fixed.</td></tr>
<tr><td>Where are the brief's three tasks?</td><td><code>tests/ui/task1-login.spec.ts</code>, <code>tests/ui/task2-add-card.spec.ts</code>, <code>tests/api/task3-add-card.spec.ts</code> — also pinned at the top of the <a href="https://docs.google.com/spreadsheets/d/1AEHPxAKOn9nanVBu16eCOahUvZBKmv1XyJg3SBLsT9E/edit?gid=697333980#gid=697333980">test cases sheet</a> as TC0001 / TC0002 / TC0003.</td></tr>
<tr><td>Locator strategy?</td><td>4-tier rule above · forbidden auto-generated CSS · POMs are the only place selectors live.</td></tr>
<tr><td>What's the rich HTML report?</td><td>Custom self-contained reporter with search, filter chips, per-test drawer, API request/response panel, and a 30-run trend dashboard. Open with <code>npm run report:rich</code>.</td></tr>
</table>

---

## 7 · Exit criteria

- [x] All three brief tasks have a passing happy-path spec
- [x] Suite runs out of the box with `npm test`
- [x] No selector relies on auto-generated CSS
- [x] Rich HTML report opens with one command
- [x] CI green on GitHub Actions · configs for GitLab / Jenkins / Azure included
- [x] **223 / 223** tests passing on a fresh Juice Shop image
- [x] **33** documented findings asserted (2 Critical · 8 High · 7 Medium · 16 Low)

<div align="center">

---

**Status — ready for review.**

*Ashik Mohamed · Everstage QA Engineering Assessment · 2026*

</div>
