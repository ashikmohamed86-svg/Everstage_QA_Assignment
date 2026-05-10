# Demo runbook — Everstage QA Assessment

> A single doc you read **while presenting**. Each slide block has:
>
> - 📊 **On the projector** — what the audience sees on the slide.
> - 🎤 **Say** — the verbatim words. Read it. Don't ad-lib until you've done it once.
> - 🖥️ **Do** — what to open or run on your machine.
> - 🪄 **Plain English** — what to add for the non-technical reviewer
>   (recruiters, hiring managers without QA backgrounds).
>
> **Total runtime:** ~30 min including live demo + Q&A.
>
> Companion to [`PRESENTATION.md`](./PRESENTATION.md) (the slide source)
> and [`CODE-TOUR.md`](./CODE-TOUR.md) (the code reference).

---

## Pre-demo checklist (do all of this 5 minutes before the call)

Run through this in order so nothing surprises you on screen-share.

```bash
# 1. Juice Shop is up
docker ps | grep juice-shop || docker run -d -p 3000:3000 bkimminich/juice-shop

# 2. Open Juice Shop in a browser tab — confirm the homepage loads
open http://localhost:3000

# 3. Confirm the assignment user can log in (a quick API ping)
curl -s -X POST http://localhost:3000/rest/user/login \
  -H "Content-Type: application/json" \
  -d "$(cat tests/data/new-user.json | head -3 | tr -d '\n')}" \
  | head -c 200 && echo

# 4. Pre-warm the smoke run so npm cache is hot
npm run test:smoke > /dev/null 2>&1

# 5. Open a fresh report so the URL is in your tab history
npm run report:rich
```

**Open these tabs / windows in order before screen-share starts:**

1. The slide deck (PowerPoint / Keynote / browser)
2. VS Code with `tests/` folder expanded
3. Terminal in `~/EverStage`
4. A browser tab on `reports/test-report.html`
5. A browser tab on `http://localhost:3000`

**Cmd-Tab order should be:** slides → IDE → terminal → report → Juice Shop.

---

## Slide 1 — Title (15 s)

### 📊 On the projector
> **Juice Shop QA Automation**
> Everstage Assessment Submission · Playwright + TypeScript
> *Ashik Mohamed · 2026*

### 🎤 Say (verbatim)
> "Hi, I'm Ashik. Over the next 30 minutes I'll walk through the
> three required tasks from your assessment, then show what I added
> on top, and finish with a live run of the test suite. Stop me at
> any point — happy to detour wherever you'd like to dig in."

### 🪄 Plain English
> "This presentation has two parts: first I'll show you the three
> things you asked for, then a few extras I built around them. There
> will be a live demo near the end."

---

## Slide 2 — The brief (1 min)

### 📊 On the projector
> 1. Manually create a new user → save credentials in `new-user.json`
>    → write a login script in `beforeEach`
> 2. UI test — homescreen → My Payments → add card details
> 3. API test — add a *unique* card via REST
>
> Plus: tests run out of the box · stable locators · clean code · ready to troubleshoot live

### 🎤 Say
> "These are the exact three tasks from your brief. Plus four
> implicit asks at the bottom: the suite has to run cleanly out of
> the box, locators have to be stable, code has to be clean, and I
> have to be ready to troubleshoot live. I designed the whole
> submission around hitting those literal asks first, then layering
> on what a sales-comp platform actually cares about."

### 🪄 Plain English
> "Each of the three tasks is a small piece of testing work. Test 1
> proves people can log in. Test 2 proves people can add a credit
> card through the website. Test 3 proves the same thing through the
> behind-the-scenes API. Their assessment is grading both *what* I
> built and *how* I built it."

---

## Slide 3 — What I shipped (TL;DR) (1 min)

### 📊 On the projector
> **223 / 223 tests passing** · ~2-min serial runtime · 84 carry `@everstage-qa`
>
> Headline counts: 12 Page Object Models · 3 custom Playwright fixtures
> · 7 helper modules · 240+ API calls captured per run · 4 CI/CD
> pipelines · 20 documented Juice Shop defects.

### 🎤 Say
> "Two hundred and twenty-three tests, all green, in two minutes. Of
> those, eighty-four are tagged with `@everstage-qa` — the
> assessment scope. The other one-thirty-nine are extras I'll get to.
> One thing I want to flag now: the three assignment specs are named
> `task1-login.spec.ts`, `task2-add-card.spec.ts`, and
> `task3-add-card.spec.ts` — I prefixed them so an assessor sees them
> at a glance in the file tree."

### 🖥️ Do
> Switch to **VS Code** for 5 seconds, point at the file tree:
> ```
> tests/ui/task1-login.spec.ts      ← Task 1
> tests/ui/task2-add-card.spec.ts   ← Task 2
> tests/api/task3-add-card.spec.ts  ← Task 3
> ```
> Then switch back to slides.

### 🪄 Plain English
> "All 223 tests pass. The three test files that match your brief are
> labeled `task1`, `task2`, `task3` — so you don't have to hunt for
> them."

---

## Slide 4 — Task 1: `beforeEach` login (3 min, code walkthrough)

### 📊 On the projector
Two side-by-side code panes (slide content from `PRESENTATION.md` slide 4).

### 🎤 Say (intro)
> "Task 1. The brief is: register a user manually, save the
> credentials in a JSON file, and write a login script that runs
> before every test. Three pieces — let me show you each."

### 🖥️ Do — open three files in this order

**File 1:** `tests/data/new-user.json`

```json
{
  "email": "everstage-qa-mox3mxq8@juice.test",
  "password": "Everstage@123",
  "securityQuestionId": 1,
  "securityAnswer": "Everstage"
}
```

> 🎤 *"This is the credentials file. I registered this user manually
> in the Juice Shop UI — went to /register, filled the form, picked
> a security question. Then saved the credentials here, exactly as
> the brief says."*
>
> 🪄 *Plain English: "It's a small settings file with the username
> and password the test will use to log in."*

**File 2:** `tests/helpers/login.ts`

> 🎤 *"This is the login script itself. Four steps: pre-seed cookies
> so Juice Shop's three banners don't intercept clicks; navigate to
> the login page; submit the credentials; and assert that we
> actually got logged in by checking the navbar shows the account
> icon."*
>
> Point at the four numbered comments inline. Then —
>
> 🎤 *"Why is this a separate file? Because every test reuses it. I
> don't repeat the login steps 16 times across 16 specs. One change
> here fixes them all."*
>
> 🪄 *Plain English: "I wrote the login as a tiny reusable function
> so every test can call it the same way."*

**File 3:** `tests/ui/task1-login.spec.ts`

> 🎤 *"And here's where the brief comes together. Look at line 20-22
> — that's `test.beforeEach`, which runs before every test in this
> file. It calls our login script. So every test starts already
> authenticated. Exactly what the brief asked for."*

### 🎤 Say (close-out)
> "Four design decisions I'll defend if you ask: I used a JSON file
> over environment variables because the brief said so verbatim. I
> pre-seed cookies instead of clicking-to-dismiss because clicks
> race with page paint. I extracted the script to a helper because
> 16 specs reuse it. And I anchored every locator on a stable HTML
> ID — `#email`, `#password`, `#loginButton` — so this code keeps
> working when Juice Shop upgrades Angular Material."

### 🖥️ Do — run Task 1 live
Switch to terminal:

```bash
npm run test:task1
```

> Wait for output (~15 s). Should show 15 tests passing.
>
> 🎤 *"Fifteen tests, all green. Same login script powers every one
> of them."*

---

## Slide 5 — Task 2: UI add card (3 min, code walkthrough)

### 📊 On the projector
Slide 5 content from `PRESENTATION.md`.

### 🎤 Say (intro)
> "Task 2. Brief is: write a UI test that goes from the homescreen
> to My Payments and adds a card. Two files to look at — the test
> itself, and the page object that holds the locators."

### 🖥️ Do — open two files

**File 1:** `tests/pages/PaymentPage.ts`

> 🎤 *"This is the Page Object Model — POM. It holds every locator
> for the My Payments page in one place. Look at the constructor —
> each line is a Playwright locator with a comment showing which
> tier of stability it lives at."*
>
> Scroll to the locator declarations, point at:
>
> ```ts
> this.accountMenu = page.locator('#navbarAccount');                 // ✓ stable ID
> this.ordersAndPaymentMenu = page.getByRole('menuitem', { ... });   // ✓ ARIA
> this.nameField = page.getByLabel('Name', { exact: true });         // ✓ accessible label
> ```
>
> 🎤 *"Four-tier hierarchy — stable IDs first, ARIA roles second,
> ARIA labels third, tag-plus-text last. I never anchor on
> auto-generated Material classes because those change with every
> Angular Material upgrade. I never use positional XPath because any
> DOM reorder breaks it."*

**File 2:** `tests/ui/task2-add-card.spec.ts` line 36

> 🎤 *"And here's the literal-brief test. Twenty lines. Three
> calls — `openMyPayments()`, `addCard(card)`, then two assertions.
> The test reads like English; the *how* lives in the POM."*
>
> Point at the two assertions:
>
> ```ts
> await expect(paymentPage.confirmation).toBeVisible();
> await expect(
>   page.locator('mat-cell, td.mat-cell',
>     { hasText: card.number.slice(-4) }).first()
> ).toBeVisible();
> ```
>
> 🎤 *"Two assertions, intentional. The first confirms the snackbar
> showed up — that means the form fired. The second confirms the
> card actually appears in the saved-cards table — that means the
> data round-tripped. If the form fired but the data didn't land,
> the second assertion fails and we know exactly which half of the
> system broke."*

### 🎤 Say (close-out)
> "Twenty-three tests in this file total. Validation cases — empty
> form keeps Submit disabled, partial fills, non-digit chars
> filtered. Security probes — XSS in the cardholder name renders as
> text, SQLi-style names are stored verbatim. Boundary cases — min /
> max expiry years. A load test — five cards added in a row. All
> driven through the same `PaymentPage` POM."

### 🖥️ Do — run Task 2 live
```bash
npm run test:task2
```

> Wait for output (~30 s).

### 🪄 Plain English
> "This test logs in, clicks through the menus to find the My
> Payments page, fills the credit card form, hits save, and checks
> two things: that a confirmation message appeared, and that the
> card actually shows up in the list. If either check fails, the
> test fails and tells us exactly what broke."

---

## Slide 6 — Task 3: API add unique card (4 min — most depth)

### 📊 On the projector
Slide 6 content from `PRESENTATION.md`.

### 🎤 Say (intro)
> "Task 3. The API equivalent of Task 2 — but with one specific
> word in the brief that I want to call out: *unique*. Add **unique**
> card details. Let me show you what 'unique' actually means in
> code."

### 🖥️ Do — open three files

**File 1:** `tests/helpers/card.ts` (the whole file is 10 lines)

```ts
export function uniqueCardNumber(): string {
  const seed = Math.floor(Math.random() * 1e12)
    .toString().padStart(12, '0');
  return `4111${seed}`;       // 10¹² possible values
}
```

> 🎤 *"This is the uniqueness generator. Visa-prefix `4111` plus
> twelve random digits. That's ten-to-the-twelfth — a trillion —
> possible values. I picked random over timestamp because two
> parallel test workers in the same millisecond would collide on a
> timestamp. Random gives effectively zero collision probability,
> even at hundreds of concurrent runs."*

**File 2:** `tests/api/task3-add-card.spec.ts` lines 13-19 (the factory)

```ts
const validCard = (overrides = {}) => ({
  fullName: 'API Test User',
  cardNum: uniqueCardNumber(),    // ← unique per call
  expMonth: 5,
  expYear: 2080,
  ...overrides,
});
```

> 🎤 *"This is the factory pattern. Every test starts from the same
> baseline and overrides only what it cares about. So a boundary
> test reads `validCard({ expYear: 2079 })` instead of repeating the
> whole payload — much easier to scan."*

**File 3:** Same file, line 44 — the headline test (`[TC-API-001]`)

> 🎤 *"And the headline test — POST to `/api/Cards/`, assert 201,
> assert the response shape, and assert the response masks the card
> number with only the last four digits visible. That last
> assertion is a PCI-style invariant — you should never echo a full
> credit-card number back."*

### 🎤 Say (senior-signal callout)
> "Now let me show you four tests in this file that go above and
> beyond the brief. Scroll down to TC-API-150 through 156."

### 🖥️ Do — scroll to TC-API-150 area, walk through four

> 🎤 *"TC-API-150: idempotency. I post the same card twice. On a
> hardened build the second one should fail with 409 Conflict. Juice
> Shop accepts both — I documented that as a defect in the comment.
> This maps directly to a real concern at Everstage: duplicate
> commission entries on the same closed-won deal."*

> 🎤 *"TC-API-151: race condition. Two parallel POSTs of the same
> card, fired with `Promise.all`. The bar is 'no 5xx, no lost
> requests.' This maps to payout processing at scale."*

> 🎤 *"TC-API-152: response shape contract. Required fields present,
> sensitive fields banned — `cvv`, `pin`, `pan`. This catches an
> accidental field leak across deploys."*

> 🎤 *"TC-API-156: cross-layer consistency. I create a card, log
> out, log back in with a fresh token, and assert the card is still
> there. This catches the 'write went nowhere' failure mode — where
> you save data but a different server or cache doesn't see it."*

### 🖥️ Do — run Task 3 live
```bash
npm run test:task3
```

> Wait for output (~12 s, fastest of the three).
>
> 🎤 *"Fifty-five tests in this file. All green."*

### 🪄 Plain English
> "This is the same 'add a card' workflow as Task 2, but talking
> directly to the server's API instead of clicking buttons. Each
> test uses a fresh credit card number — generated randomly —
> because the database won't accept duplicates. Above that I added
> four tests that check things real payment systems care about: did
> the system create two cards by mistake when I clicked twice? Did
> a sensitive field accidentally leak? Did the data actually save?"

---

## Slide 7 — Logic: 5 engineering decisions (90 s)

### 📊 On the projector
Five-bullet slide from `PRESENTATION.md` slide 7.

### 🎤 Say
> "Beyond the test code, five engineering decisions I'll defend.
>
> **One: custom Playwright fixtures**. I have three — `apiSession`,
> `authenticatedPage`, and `seededCheckout`. They're lazy: a test
> that doesn't ask for `seededCheckout` doesn't pay for it. And
> they compose — `seededCheckout` reuses `apiSession` for free.
>
> **Two: single source of truth for setup**. Every helper for
> seeding addresses, cards, basket items, and clearing them lives
> in `tests/helpers/seed.ts`. UI tests and API tests use the same
> functions. No duplication.
>
> **Three: a layered tag taxonomy**. Each test carries multiple
> tags — scope, type, CI gate, axis — so the same suite is a
> nine-second smoke gate AND a two-minute regression run, by tag
> grep alone.
>
> **Four: stockable-product helper**. Juice Shop drains products to
> zero across many runs and has per-user purchase caps. The helper
> queries the live state and picks a survivor. Defensive coding
> against live data — this was actually the trickiest bug I hit,
> happy to dive deeper if you want.
>
> **Five: logged API wrapper**. Every shared helper goes through
> it. Auth headers are auto-redacted. It powers the rich report's
> API-call cards, which I'll show you in two slides."

### 🪄 Plain English
> "Five behind-the-scenes decisions that make the suite faster and
> easier to debug. The first three reduce duplication so changes are
> cheap to make. The fourth handles a real-world quirk — the test
> server runs out of products to buy after a few runs. The fifth
> records every server conversation for debugging."

---

## Slide 8 — Report & debugging (3 min, live demo)

### 📊 On the projector
Slide 8 content + the screenshot of the rich report.

### 🎤 Say (intro)
> "This is the part most candidates skip — what happens *after* the
> tests run. If a test fails in CI at 2am, what do you see? Let me
> show you."

### 🖥️ Do — switch to your browser tab on `reports/test-report.html`

Walk through the report in this order:

1. **Top stats cards**
   > 🎤 *"Headline numbers — total, passed, failed, flaky, runtime.
   > A non-technical reader can read this in five seconds."*

2. **Search bar — type `@security`**
   > 🎤 *"Live search. Type `@security` and the list filters to the
   > forty security tests. Type `TC-API-150` and you jump straight
   > to the idempotency probe."*

3. **Filter chips — click `⭐ Assessment cases`**
   > 🎤 *"Filter chips. I added an 'Assessment scope' row so an
   > assessor can isolate the eighty-four assignment tests in one
   > click."*

4. **Coverage-by-tag panel (right side)**
   > 🎤 *"Tag coverage, grouped by purpose — Assignment scope, CI
   > gates, Test category. Click any bar and the test list below
   > filters to that tag."*

5. **Click any test row to expand**
   > 🎤 *"And this is the part I'm proudest of. Click any test —
   > you get a plain-English explainer at the top, the full step
   > tree on the left, and on the right side, every API call this
   > test made, with the request body and the response body shown
   > inline. Auth tokens are redacted. So if a test fails, you see
   > exactly what it sent and what came back without ever leaving
   > the page."*

6. **Scroll down to the trace card on the same expanded test**
   > 🎤 *"And every test gets a Playwright trace card. Click the
   > 'Copy show-trace command' button — it copies the exact
   > terminal command to open a step-by-step DOM-snapshot timeline.
   > For debugging a flaky test in CI, this is gold."*

### 🎤 Say (close-out)
> "Why a custom report and not Allure? Three reasons. One: this is a
> single self-contained HTML file — opens offline, mailable. Two:
> it knows about *this* assignment — the chip-row groups are tuned
> for the brief. Three: the API call panel and the copy-trace
> button don't exist anywhere else."

### 🪄 Plain English
> "When tests fail, you need to know *why* fast. This report shows
> every test, lets you search and filter, and when you click a test
> it shows you exactly what the test did, every server message, and
> a one-click way to replay the test step-by-step."

---

## Slide 9 — Extras above the brief (90 s)

### 📊 On the projector
Three-column layout from `PRESENTATION.md` slide 9.

### 🎤 Say
> "Brief asked for three things. I delivered three things plus —
>
> **Tests:** a missing checkout flow that the existing Juice Shop
> suite never connected end-to-end. Found four real defects in it.
> Nine more defects I uncovered by driving Juice Shop interactively
> with Playwright's MCP — login is case-sensitive, whitespace isn't
> trimmed, an array as password crashes the server with 500. And
> four senior-signal API tests I just walked through.
>
> **Infrastructure:** four CI/CD pipelines — GitHub Actions is
> active, with drop-in equivalents for GitLab, Jenkins, and Azure.
> All use the official Playwright Docker image, spin up Juice Shop
> as a service container, and self-bootstrap the assignment user
> via the API. The custom rich reporter we just looked at, plus a
> CSV history reporter that builds a pass-rate trend chart over
> time. And demo shortcuts — `npm run demo` runs the assessment
> tests with traces, and opens the report.
>
> **Documentation:** six docs covering the brief verbatim, a code
> tour, an interview Q&A prep sheet, the test plan, this slide
> deck, and a machine-readable test catalog."

### 🪄 Plain English
> "I went past what was asked. I added more tests, real CI
> infrastructure, the custom report you just saw, and full
> documentation. The 'docs' folder has six files — anyone joining
> this project tomorrow could read those and start contributing the
> same day."

---

## Slide 10 — Locator strategy (1 min)

### 📊 On the projector
4-tier table + 3 anti-patterns from `PRESENTATION.md` slide 10.

### 🎤 Say
> "Brief explicitly asks: 'Locator strategy — locators chosen in
> tests are stable and have less possibility to break in future.'
> So a strict hierarchy.
>
> Stable IDs first — they're public DOM contract, survive Material
> upgrades. ARIA role plus accessible name second — defined by WCAG,
> so they're stable AND they double as accessibility checks. ARIA
> label third. Tag-plus-text last, only when ARIA isn't available.
>
> Three things I never use: auto-generated Material classes —
> they change with every Angular Material upgrade. Positional XPath
> — any DOM reorder breaks it. Auto-generated mat-ids — regenerated
> on every render. All twelve Page Object Models in the suite
> follow this hierarchy."

### 🪄 Plain English
> "How do tests find the buttons and fields? They use the most
> stable identifier first — an HTML ID — and fall back to less
> stable ones only when needed. I never use shortcuts that look
> easy but break when the website is updated."

---

## Slide 11 — Results (1 min)

### 📊 On the projector
Slide 11 content + the report screenshot.

### 🎤 Say
> "Two-twenty-three tests. All green. Two-minute serial runtime.
> Eighty-four are tagged for the assessment scope. The rest are
> extras and the existing-suite expansion.
>
> Twenty documented Juice Shop defects in the suite. SQLi auth
> bypass, BOLA on checkout, mass-assignment probes, the
> case-sensitive login, the unhandled-input 500 — all classics.
> Each one is asserted as the *actual* unsafe behavior so the suite
> stays green. Comments in each test say how to flip the assertion
> on a hardened build. Red tests get ignored over time. Documented
> green ones don't."

### 🖥️ Do — final live run
```bash
npm run demo
```

> Lets it run for ~1 minute while you talk through Slide 12. The
> rich report opens automatically when it's done.

### 🪄 Plain English
> "Every test passes. The suite finishes in two minutes. It also
> documents twenty bugs in the Juice Shop application itself —
> these are intentional bugs in the demo app — so a future team
> running this against a real version of the app would see them
> light up immediately."

---

## Slide 12 — Q&A / closing (5 min+)

### 📊 On the projector
Three reverse-questions from `PRESENTATION.md` slide 12.

### 🎤 Say (closing)
> "Thanks for the time. Three things I'd love your feedback on:
> Did the locator strategy land? Did the senior-signal tests connect
> to your domain? And anything missing for a real production
> deploy? Open to questions, criticism, anything."

### 🖥️ If they ask…

| Question | What to do |
|---|---|
| "How would you scale this to 500 tests?" | Open `package.json`, point at the tag-grep scripts. "Shard runners by tag, switch from per-test login to `storageState`, parallel workers — Playwright config already supports it." |
| "What was the trickiest bug?" | Open `tests/helpers/api.ts`, scroll to `findStockableProductId`. "Apple Juice gets drained to zero across runs. I query live state and pick a survivor." |
| "How would you debug a CI failure?" | Switch to the rich report. Click any test row. "Plain-English explainer, step tree, API request/response inline, copy-trace button. Engineer never needs to leave the page." |
| "Why no Allure?" | "The custom rich reporter is a single self-contained HTML file. Opens offline, mailable, knows about the assignment. JUnit XML still emitted so Allure could chain on if your team prefers." |
| "How do you handle credentials in CI?" | Open `playwright.config.ts`. "Locally JSON; CI flips on `process.env.CI` and switches to env-var-driven config. The CI workflow YAML uses GitHub Secrets." |
| "Why did you do X instead of Y?" | (any specific design choice) | Open `docs/INTERVIEW-PREP.md` — it has 9 prepared answers. Scroll to the matching question. |

---

## Plain-English glossary (for non-technical assessors)

If anyone in the room isn't an engineer, sprinkle these explanations in
casually as you go.

| Jargon | Plain English |
|---|---|
| **Playwright** | A tool that drives a real web browser to test apps end-to-end |
| **Test suite** | A collection of automated tests run together |
| **`beforeEach`** | Code that runs before every single test in a file |
| **POM (Page Object Model)** | One file per page that holds where every button and field is, so tests can call methods like "click login" instead of "find element by ID 12345" |
| **Fixture** | A reusable bit of setup the test framework provides on demand |
| **Locator** | The way the test code finds a specific button or field on the page |
| **REST API** | The behind-the-scenes way the website talks to the server (no buttons, just data) |
| **Token / bearer token** | A digital ID card the user gets after logging in, sent with every request |
| **Idempotent** | Doing the same thing twice has the same effect as doing it once (e.g., clicking "save" twice shouldn't create two records) |
| **BOLA / IDOR** | Security bugs where one user can access another user's data |
| **Trace / trace viewer** | A frame-by-frame replay of what the test did — you can see exactly what the browser saw at every step |
| **CI/CD** | Software that runs the tests automatically every time someone changes the code |
| **Smoke test** | A quick subset of tests that catch obvious breakage in under a minute |
| **Regression test** | The full suite, run nightly, to catch anything that's slowly broken over time |
| **Tag** | A label on a test (like `@security`) so you can run all tests with a label at once |
| **Service container** | A stand-in copy of the app that the CI server runs while testing |

---

## If something goes wrong on stage

| Symptom | What to do | What to say |
|---|---|---|
| `connect ECONNREFUSED 127.0.0.1:3000` | `docker run -d -p 3000:3000 bkimminich/juice-shop` then retry | "Juice Shop took a moment to start — let me restart the container." |
| One test fails (`401`) | The session expired between tests or the user got deleted. Re-register: `curl -X POST localhost:3000/api/Users/ ...` | "The test user got cleaned up between runs — I'll re-register it. Real CI does this automatically in the bootstrap step." |
| The report doesn't open | `open reports/test-report.html` directly | "Let me open it manually." |
| You blank on a question | Open `docs/INTERVIEW-PREP.md`, search for keywords | "Good question — let me find the file that answers it." |

---

## Tempo cheat sheet

| Slide | Time | Cumulative |
|---|---|---|
| 1 Title | 0:15 | 0:15 |
| 2 Brief | 1:00 | 1:15 |
| 3 TL;DR | 1:00 | 2:15 |
| 4 Task 1 + run | 3:00 | 5:15 |
| 5 Task 2 + run | 3:00 | 8:15 |
| 6 Task 3 + run | 4:00 | 12:15 |
| 7 Logic | 1:30 | 13:45 |
| 8 Report demo | 3:00 | 16:45 |
| 9 Extras | 1:30 | 18:15 |
| 10 Locators | 1:00 | 19:15 |
| 11 Results + final demo run | 1:00 | 20:15 |
| 12 Q&A | 5:00–10:00 | 25:15–30:15 |

**If you're losing time:** drop slides 7, 9, 10. Tasks 1/2/3 and the
report demo are non-negotiable.

**If you're ahead of schedule:** spend extra time on slide 6's
senior-signal tests (TC-API-150 through 156) — that's where you
differentiate.
