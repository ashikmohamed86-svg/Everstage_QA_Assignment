# Changelog

The narrative of how this assignment was delivered, in reverse chronological
order. Branch: `feat/qa-assignment`.

## 1.4.0 — Assessment polish (2026-05-10)

- **Security findings doc** — `docs/SECURITY-FINDINGS.md` promotes the 32
  `DOCUMENTED VULN`/`UX` rows into a tiered audit (Critical/High/Medium/Low) with
  surface, repro, impact, and a fix sketch per finding.
- **Architecture doc** — `docs/ARCHITECTURE.md` is a one-page diagram-led tour.
- **Accessibility coverage** — `tests/ui/accessibility.spec.ts` runs `@axe-core/playwright`
  against landing, login, and saved-payment-methods.
- **Static landing page** — `docs/site/index.html` (formerly `website/index.html`)
  promoted to a tracked artefact and auto-deployed to GitHub Pages via
  `.github/workflows/pages.yml`.
- **Cleanup** — `.DS_Store`, LibreOffice locks, and `reports/last-run.json` (2.5 MB
  regenerated every run) are no longer tracked.

## 1.3.0 — Reporter polish (2026-05-09)

- Stack the rich-report's chart row vertically; tag groups render in a responsive
  multi-column grid.
- Strict tag-name whitelist filters out junk tags Playwright auto-extracts from
  email substrings in test titles (`@x.test` etc.).
- Persist collapsed-group state across re-renders so clicking a UI test no longer
  re-shows a collapsed API group.
- Sticky filter bar; area-tinted group headers (UI=blue, API=purple); expanded
  rows get a left accent and soft horizontal shift.

## 1.2.0 — Test catalogue (2026-05-08)

- `docs/test-cases.md` and `docs/test-cases.csv` regenerated from the live suite
  via `tools/gen-catalog.js`. 223 tests · 97 UI · 126 API · 32 documented
  findings.

## 1.1.0 — Coverage expansion (2026-05-08)

- 38 new tests covering wallet, recycle, deliveries, track-order, two-factor,
  complaints, captcha, identity, and account-area pages.
- Custom reporter overhaul: tag-aware HTML dashboard, markdown summary,
  JUnit XML, automatic legacy-CSV rotation when the schema changes.
- Tag-based npm scripts: `test:everstage`, `test:task1/2/3`, `test:security`,
  `test:negative`, `test:boundary`, `test:load`.

## 1.0.0 — Initial delivery (2026-05-07)

- 191-test Playwright suite covering Tasks 1–3 plus full bonus checkout flow.
- Page Object Model, shared helpers, custom CSV reporter with HTML dashboard,
  CI examples for GitHub Actions, GitLab, Jenkins, and Azure Pipelines.
- Catalogue (`docs/test-cases.csv` + `docs/JuiceShop-TestCases.xlsx`) and
  test plan (`docs/TEST-PLAN.md`) shipped alongside the code.
