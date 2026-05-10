# Everstage QA Automation — Presentation deck

> **Format:** 12 slides · ~15-min walkthrough · 1–2 min per slide.
> Most of the airtime sits on Tasks 1 / 2 / 3 — the brief itself.
>
> Each slide block has **on-slide content** (paste verbatim into
> PowerPoint / Keynote / Slides) and **speaker notes** (what to say
> while it's on screen). Visual cues at the bottom of each slide tell
> you what screenshot or diagram to drop in.
>
> Suggested theme: dark navy + accent-green, monospaced code blocks.
> Mirror the rich report's palette (`#0f172a` ink / `#10b981` pass-green
> / `#2563eb` accent-blue).
>
> **Quick export:** `pandoc docs/PRESENTATION.md -o EverstageQA.pptx`.

---

## Slide 1 — Title

### On the slide

> **Juice Shop QA Automation**
> Everstage Assessment Submission
>
> Playwright + TypeScript end-to-end test suite
>
> *Ashik Mohamed · 2026*

### Speaker notes

> "I'll spend about 15 minutes — the brief, then a deep dive into each
> of the three tasks, then the logic, the report, and the extras.
> Stop me whenever."

### Visual

A clean cover. Just the title, the stack, your name. Optional: a small
🧃 emoji or the OWASP Juice Shop logo.

---

## Slide 2 — The brief

### On the slide

> **Three required tasks** against OWASP Juice Shop on `localhost:3000`:
>
> 1. **Manually create a new user**, save credentials in
>    `new-user.json`, write a **login script in `beforeEach`** so
>    every test starts authenticated.
> 2. **UI test** — navigate from homescreen to *My Payments* and add
>    card details.
> 3. **API test** — add a **unique** card via the REST API.
>
> **Plus four implicit asks:**
> - Test runs out of the box
> - Be ready to troubleshoot live
> - Communicate thought process
> - **Stable locators**

### Speaker notes

> "Short brief, high bar. The grading is about *how* you think, not
> whether you can copy a Playwright tutorial. So my approach: hit the
> three literal asks cleanly, then layer on what a sales-comp platform
> actually cares about — idempotency, de-dup, audit trail,
> multi-tenant isolation."

### Visual

Three numbered bullets, each prefixed with `Task N`. Make Tasks 1 / 2
/ 3 the visual anchors of the slide.

---

## Slide 3 — What I shipped (TL;DR)

### On the slide

> **223 / 223 tests passing** · ~2-min serial runtime · 84 carry `@everstage-qa`
>
> | Layer | Count |
> |---|---|
> | UI specs | 100+ |
> | API specs | 110+ |
> | **Assignment specs** (`task1` / `task2` / `task3` prefixed for visibility) | 3 files, 93 tests |
> | Page Object Models | 12 |
> | Custom Playwright fixtures | 3 |
> | Helper modules | 7 |
> | API request/response payloads captured per run | 240+ |
> | Documented Juice Shop defects + UX gaps | 20 |
> | CI/CD pipelines (GH / GitLab / Jenkins / Azure) | 4 |

### Speaker notes

> "Headline numbers. Two things to call out: the suite scales — it's
> not just three tests with three more tests bolted on. And the
> assignment specs are *named* for visibility — `task1-login.spec.ts`,
> `task2-add-card.spec.ts`, `task3-add-card.spec.ts`. An assessor sees
> them at a glance in the file tree."

### Visual

Stat-card grid mirroring the rich report's top section. Take a
screenshot of `reports/test-report.html` — top half is enough.

---

## Slide 4 — Task 1: `beforeEach` login

### On the slide

> **Brief:** *"Manually create a new user, save credentials in
> `new-user.json`, create a login script in `beforeEach` so every test
> runs through it."*
>
> ```ts
> // tests/helpers/login.ts — the login script
> export async function loginBeforeEach(page, context) {
>   await suppressBanners(context);     // 1. cookie-bypass for 3 banners
>
>   const loginPage = new LoginPage(page);
>   await loginPage.goto();             // 2. navigate to /#/login
>   await loginPage.attemptLogin(user.email, user.password);  // 3. submit
>
>   await expect(page).not.toHaveURL(/login/);                 // 4. assert
>   await expect(page.locator('#navbarAccount')).toBeVisible();
> }
>
> // tests/ui/task1-login.spec.ts — calling it in beforeEach
> test.beforeEach(async ({ page, context }) => {
>   await loginBeforeEach(page, context);   // ← the brief's literal ask
> });
> ```
>
> **Logic — four decisions:**
> 1. **JSON file** (`new-user.json`) over env vars — brief says so verbatim
> 2. **Banner suppression via cookie pre-seed** in `addInitScript` — beats click-to-dismiss races
> 3. **Helper function** + `beforeEach` — DRY across 16 specs
> 4. **Stable locators** (`#email`, `#password`, `#loginButton`) — survive Material upgrades

### Speaker notes

> "Four intentional choices. One: brief said `new-user.json` — verbatim
> — so I respected it, even though env vars would be the CI default.
> Two: Juice Shop layers a welcome dialog, cookie consent bar, and
> language snackbar on first paint — they all sit on top of the form.
> Click-to-dismiss is racy, so I pre-seed the cookies via
> `addInitScript`. Three: I extracted the login into a helper so all
> 16 specs reuse it. Four: every locator anchors on a stable ID.
> Fifteen tests in this spec, all green."

### Visual

Two side-by-side code panes — left `helpers/login.ts`, right the
`beforeEach` in the spec. Highlight the `beforeEach` line in green.

---

## Slide 5 — Task 2: UI add card

### On the slide

> **Brief:** *"Create a UI test that navigates to My Payments options
> from homescreen and add card details."*
>
> ```ts
> // tests/ui/task2-add-card.spec.ts — the literal-brief test
> test('[TC-UI-001] User can add card details from My Payment Options',
>   { tag: ['@task2', '@everstage-qa', '@positive', '@smoke', '@e2e'] },
>   async ({ page }) => {
>     const paymentPage = new PaymentPage(page);
>     await paymentPage.openMyPayments();
>
>     await paymentPage.addCard({
>       name: 'Everstage QA',
>       number: uniqueCardNumber(),    // ← unique per run
>       month: '5',
>       year: '2080',
>     });
>
>     await expect(paymentPage.confirmation).toBeVisible();
>     await expect(
>       page.locator('mat-cell, td.mat-cell',
>         { hasText: card.number.slice(-4) }).first()
>     ).toBeVisible();
>   });
> ```
>
> **Logic:**
> - **POM (`PaymentPage`)** — selectors live in one file; tests read like a story (`paymentPage.addCard(card)`).
> - **Two assertions** — success snackbar AND row in the table. Catches "the form fired but the data didn't land."
> - **Cleanup-first `beforeEach`** — clears all cards via API before each test. After many runs the table balloons to 100+ rows; cleanup-first beats any per-test wait.
> - **22 more tests** around this happy path: empty form keeps Submit disabled, partial fill, non-digit chars filtered, XSS-as-text, SQLi name stored verbatim, boundary expiry years, 5-card load test.

### Speaker notes

> "The headline test is the literal brief — log in, navigate to My
> Payments, fill the form, save. Two assertions, intentional: the
> snackbar AND the row appearing. Then 22 more tests around the same
> flow, all going through the same `PaymentPage` POM. The
> `beforeEach` clears cards via API up front — Angular re-renders the
> whole table on every add, so on a stale account the assertions hit
> a 5-second timeout."

### Visual

Code on top, the four-bullet logic below. Optional: a screenshot of
the live "My Payments" page with a card row visible.

---

## Slide 6 — Task 3: API add unique card

### On the slide

> **Brief:** *"Create an API test that adds a unique card details."*
>
> ```ts
> // tests/helpers/card.ts — what "unique" means in practice
> export function uniqueCardNumber(): string {
>   const seed = Math.floor(Math.random() * 1e12)
>     .toString().padStart(12, '0');
>   return `4111${seed}`;              // 10¹² possible values
> }
>
> // tests/api/task3-add-card.spec.ts — the headline
> test('[TC-API-001] POST /api/Cards/ creates a card with unique details',
>   async ({ request }) => {
>     const payload = validCard();     // ← uniqueCardNumber() inside
>     const response = await request.post('/api/Cards/', {
>       headers: authHeaders(), data: payload,
>     });
>     expect(response.status()).toBe(201);
>     expect((await response.json()).data.fullName).toBe(payload.fullName);
>   });
> ```
>
> **Logic — uniqueness:** Visa-prefix `4111` + 12 random digits = **10¹² unique values**. Random rather than timestamp-based, so two parallel workers in the *same millisecond* don't collide on Juice Shop's SQLite unique-key constraint.
>
> **55 tests** in this file: positive · negative · auth · payload validation · security (SQLi/XSS/JWT/IDOR/BOLA) · boundary · load · **idempotency · concurrent race · schema-contract · cross-layer**.

### Speaker notes

> "The 'unique' bit is non-trivial — two parallel workers in the same
> millisecond would collide on a timestamp. 10¹² random values gives
> effectively zero collision probability even at hundreds of
> concurrent runs. Then 54 more tests in this file, four of which are
> the senior-signal ones: idempotency, race, schema-contract,
> cross-layer. Each one maps to a real Everstage concern — duplicate
> commission entries, payout race, audit-trail integrity, the 'write
> went nowhere' failure mode."

### Visual

Code block on top with `uniqueCardNumber()` highlighted. Below: a
small table of the four senior-signal tests with their Everstage
parallels.

---

## Slide 7 — Logic — engineering decisions

### On the slide

> **Five decisions worth defending:**
>
> 1. **Custom Playwright fixtures** (`tests/fixtures.ts`)
>    - `apiSession` — REST login → `{ token, bid, email }`
>    - `authenticatedPage` — UI login + banners gone
>    - `seededCheckout` — basket clean + address + card + product + delivery, all in **`Promise.all`**
>    - Lazy: a test that doesn't ask for `seededCheckout` doesn't pay for it
>
> 2. **Single source of truth for setup** (`tests/helpers/seed.ts`)
>    - `seedAddress`, `seedCard`, `seedBasket`, `clearBasket`, `clearCards`
>    - Used at both UI and API layers — same recipe, no duplication
>
> 3. **Tag taxonomy** (compose freely with `--grep`)
>    - Scope: `@everstage-qa` / `@task1` / `@task2` / `@task3`
>    - Type: `@positive` / `@negative` / `@boundary` / `@security` / `@load`
>    - CI gate: `@smoke` / `@regression` / `@e2e`
>    - Axis: `@functional` / `@nonfunctional`
>
> 4. **Stockable-product helper** (`findStockableProductId()`) — Juice Shop drains products and has per-user purchase caps; the helper queries the live state and picks a survivor
>
> 5. **Logged API wrapper** (`logged()`) — every shared helper goes through it; auth headers redacted; powers the rich report's API call cards

### Speaker notes

> "Five engineering decisions I'll defend in any review. Fixtures
> over `beforeEach` for non-Task-1 paths because they're lazy and
> composable. `seed.ts` so UI and API tests share setup. Tag taxonomy
> so the same suite is a 9-second smoke gate AND a 2-minute
> regression. The stockable-product helper because Apple Juice gets
> drained to zero across many runs — defensive against live state.
> The logged wrapper because debugging API tests without seeing the
> request body is a waste of time."

### Visual

5-row numbered list. Use code-style font for the file paths.

---

## Slide 8 — Report & debugging

### On the slide

> **Custom rich HTML report** — `reports/test-report.html`, single self-contained file, no CDN.
>
> **What you can do in it:**
> - **Live search** — `@security`, `TC-API-001`, error text
> - **Filter chips** — status / layer / category / **Assignment scope** / CI gate
> - **Group-by** — area / category / file / tag, collapsible
> - **Pass-rate trend chart** — last 30 runs, color-coded
> - **Coverage-by-tag** — Assignment / CI gates / Category groups, click-to-filter
>
> **Per-test detail drawer** (click any row):
> - Plain-English explainer of the test category
> - Full step tree with timing
> - **API request/response inline** — auth-redacted, pretty-printed JSON
> - Inline screenshot thumbnails + embedded video player
> - **Playwright trace card** with one-click *Copy `npx playwright show-trace`*
>
> ```bash
> npm run demo                    # run assessment + open the report
> npm run demo:task1              # one-task variants
> npm run demo:task2
> npm run demo:task3
> ```

### Speaker notes

> "The report is the second-most-important artifact after the test
> code. Three things make it different from Playwright's default
> report. One: it knows about *this* assignment — the chip-row has
> 'Assignment scope' as a filter. Two: every API call is rendered
> inline — request method, URL, status, duration, request body,
> response body — auth-redacted. No more flipping to the trace viewer
> for a single payload. Three: trace cards have a copy-to-clipboard
> button for `npx playwright show-trace …` so any engineer can paste
> it into a terminal."

### Visual

**Take three live screenshots from the rich report:**
1. The top — stat cards + trend chart + coverage-by-tag panel.
2. A test row expanded with the API call panel open.
3. A trace card with the "Copy show-trace command" button.

---

## Slide 9 — Extras above the brief

### On the slide

> **Tests:**
> - **Missing checkout flow** (UI + API) — basket → address → delivery → payment → place order. The pre-existing Juice Shop suite never connected these. Found 4 defects.
> - **9 live-probed defects** (`TC-API-160..168`) discovered via Playwright MCP exploration — case-sensitive login, untrimmed whitespace, type-coercion gaps, unhandled-input 500.
> - **4 senior-signal tests** (`TC-API-150..156`) — idempotency, concurrent race, schema-contract, cross-layer consistency.
>
> **Infrastructure:**
> - **CI/CD: 4 pipelines** — GitHub Actions (active), GitLab, Jenkins, Azure. All use the official Playwright Docker image, spin up Juice Shop as a service container, and self-bootstrap the assignment user.
> - **Custom HTML reporter** (~1k lines) + **CSV history reporter** for pass-rate trends.
> - **Demo shortcuts** — `npm run demo`, `demo:task1/2/3`, `demo:smoke`, `demo:full`.
>
> **Documentation:**
> - 6 docs covering: brief verbatim · code tour · interview Q&A · test plan · slide deck · machine-readable test catalog (CSV + Excel)

### Speaker notes

> "Above the brief, 10 things, grouped into Tests / Infra / Docs. The
> two I'd lean on hardest in the conversation are the missing
> checkout flow — because it shows I noticed what was *absent* from
> the existing suite — and the 9 live-probed defects, because they
> show I drove the actual app and found things rather than just
> writing what the brief asked for."

### Visual

Three-column layout (Tests / Infrastructure / Documentation).
Color-code each column with the same accents as the report's
coverage-by-tag panel.

---

## Slide 10 — Locator strategy

### On the slide

> The brief explicitly calls this out — *"locators chosen in test are
> stable and have less possibility to break in future."*
>
> | Tier | Example | Why it's stable |
> |---|---|---|
> | 1. **Stable IDs** | `#submitButton`, `#navbarAccount` | Public DOM contract |
> | 2. **ARIA role + name** | `getByRole('menuitem', { name: 'Show Orders…' })` | WCAG-defined; doubles as a11y check |
> | 3. **ARIA label** | `getByLabel('Card Number')` | Same stability story |
> | 4. **Tag + text/regex** | `locator('simple-snack-bar', { hasText: /saved/i })` | For elements without ARIA roles |
>
> **What I never use:**
> - ❌ Auto-generated Material classes (`.mat-mdc-button-base`)
> - ❌ XPath positional selectors (`//div[3]/button[1]`)
> - ❌ Auto-generated mat-ids (`mat-radio-155-input`)
>
> 12 POMs in `tests/pages/` apply this hierarchy uniformly.

### Speaker notes

> "Strict hierarchy — stable IDs first, then ARIA. I never anchor on
> auto-generated Material classes because they change with every
> Angular Material upgrade, and I never use positional XPath because
> any DOM reorder breaks it. Open `tests/pages/PaymentPage.ts` and
> you'll see ten examples of this hierarchy in action — each locator
> has an inline comment showing which tier it lives at."

### Visual

The 4-tier table on top. Below: red-X bullets for the anti-patterns.
Optionally a small code snippet from `PaymentPage.ts` showing 3–4
locators with tier annotations.

---

## Slide 11 — Results

### On the slide

> **223 / 223 tests passing** against a fresh Juice Shop · **2-min** serial runtime
>
> | Slice | Tests | Runtime | Command |
> |---|---|---|---|
> | `@smoke` (PR gate) | 9 | ~10 s | `npm run test:smoke` |
> | `@everstage-qa` (assessment) | 84 | ~1 min | `npm run test:everstage` |
> | Full suite | 223 | ~2 min | `npm test` |
> | Per task | 15 / 23 / 55 | ~10–30 s each | `npm run test:task{1,2,3}` |
>
> **Coverage by category:**
> Positive 40 · Negative 39 · Boundary 17 · Security 40 · Load 5 · Functional 57 · Non-functional 12
>
> **Findings:** **20 documented Juice Shop defects** asserted as actual behavior, with hardened-build expectations in test comments. None of the suite is red on the default unsafe build — but the documented behaviors are visible to any reviewer.

### Speaker notes

> "All green. Twenty documented defects — classic SQLi auth-bypass,
> BOLA on checkout, mass-assignment probes, the case-sensitive login
> I found via MCP probing. Every one is asserted as the *actual*
> unsafe behavior so the suite stays green; comments say 'flip this
> assertion on a hardened build.' Red tests get ignored over time;
> documented green ones don't."

### Visual

Take the screenshot of the rich report's top stat cards (showing 223
passed, 0 failed, runtime, etc.).

---

## Slide 12 — Q&A

### On the slide

> **Thanks.**
>
> Repository — *github.com/...*
> Run the demo — `npm run demo`
> Code walkthrough — `docs/CODE-TOUR.md`
> Interview Q&A — `docs/INTERVIEW-PREP.md`
>
> **Three things I'd love your feedback on:**
> 1. Did the locator strategy land?
> 2. Did the senior-signal tests connect to your domain?
> 3. Anything missing for a real production deploy?

### Speaker notes

> "Open the floor. The three reverse-questions signal that I treat
> this as a conversation, not a checklist. If they ask 'how would you
> scale this?', point at the tag matrix. If they ask 'how would you
> debug a CI failure?', open the rich report and click any test row."

### Visual

Three big reverse-questions in the middle of the slide. Optionally a
small QR code linking to the GitHub repo.

---

# Appendix — speaker-tempo guide

| Slide | Time | Notes |
|---|---|---|
| 1 Title | 15 s | |
| 2 Brief | 60 s | |
| 3 TL;DR | 60 s | |
| 4 Task 1 | **120 s** ★ | Brief deep-dive |
| 5 Task 2 | **120 s** ★ | Brief deep-dive |
| 6 Task 3 | **150 s** ★ | Brief deep-dive — most senior-signal |
| 7 Logic | 90 s | |
| 8 Report | 120 s | Live demo if possible |
| 9 Extras | 90 s | |
| 10 Locators | 60 s | |
| 11 Results | 60 s | |
| 12 Q&A | 5 min+ | |

**Total walkthrough:** ~15 minutes (without Q&A).
★ Slides 4 / 5 / 6 are the brief itself — spend most of your prep here.

If they cut you to **8 minutes**: drop slides 7, 9, 10. Keep Tasks 1 /
2 / 3 deep, the report demo (slide 8), and the closing.

---

# Appendix — talking-points cheat sheet

| If they ask… | Pivot to slide | Say |
|---|---|---|
| "Why Playwright?" | 7 | Native API testing, auto-waiting cuts flake budget, trace viewer is best-in-class |
| "Why two ways to log in?" | 4 | Brief literally said `beforeEach`; the fixture is a refinement, both call the same script |
| "How would you scale to 500 tests?" | 7 | Shard runners, tag slicing, `storageState` for non-auth tests |
| "How would you test commission accuracy?" | 6 | Data-driven tests with golden CSV inputs, decimal precision via `toBeCloseTo` |
| "What was the trickiest bug?" | 9 | Apple Juice stockout — fixed by `findStockableProductId()` querying live state |
| "Why no Allure?" | 8 | Self-contained HTML, knows about *this* assignment, JUnit XML still emitted for downstream |
| "How do you handle credentials in CI?" | 4 | Locally JSON; in CI swap to env vars + secrets manager — JSON file mirrors the pattern |
