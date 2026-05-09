# CI/CD pipelines

Ready-to-paste pipeline definitions for the four most common CI systems.
The active GitHub Actions workflow lives at
`.github/workflows/playwright.yml`. Everything in this folder is example
material — drop the relevant file at your repo root (or
`.gitlab-ci.yml` / `Jenkinsfile` / `azure-pipelines.yml`) and adjust to
taste.

| File | Platform | Notes |
|---|---|---|
| `../.github/workflows/playwright.yml` | GitHub Actions | Already active. Service container for Juice Shop, daily schedule, manual `workflow_dispatch` with tag-grep + trace-mode inputs, JUnit annotation on PRs, rich HTML report uploaded as artifact. |
| `.gitlab-ci.yml`                      | GitLab CI      | Three stages (install → test → report), GitLab Pages publishes the rich report at the project URL on `main`. |
| `Jenkinsfile`                         | Jenkins        | Declarative pipeline using the official Playwright Docker image, parameterised tag-grep + trace-mode, publishes the rich HTML report via the Jenkins HTML Publisher plugin. |
| `azure-pipelines.yml`                 | Azure DevOps   | npm cache, JUnit publish, two artifacts (rich report + traces). |

## Knobs every pipeline reads

The `playwright.config.ts` is environment-driven so no platform-specific
forks are needed:

| Env var       | Default (local)            | Default (CI) | What it does |
|---|---|---|---|
| `CI`          | unset                      | `true`       | Truthy ⇒ leaner profile: `workers=2`, `retries=3`, `forbidOnly=true`, screenshots/video on failure only. |
| `BASE_URL`    | `http://localhost:3000`    | `http://localhost:3000` | Point the suite at a non-default Juice Shop instance. |
| `TRACE_MODE`  | `on`                       | `retain-on-failure` | `on` records a Playwright trace for *every* test (the rich report's "trace cards" all populate). `retain-on-failure` only keeps traces for failures (cheaper artifact). Other values: `on-first-retry`, `off`. |

## Required CI image

Every pipeline uses Microsoft's official Playwright image
(`mcr.microsoft.com/playwright:v1.48.0-jammy`) which already has Node,
the browsers, and all OS deps preinstalled. If you build your own image,
make sure to run `npx playwright install --with-deps chromium` before
the test step.

## Required service: Juice Shop

The suite hits `http://localhost:3000` by default. The pipelines either
spin up `bkimminich/juice-shop:latest` as a service container (GitHub
Actions, GitLab) or via plain `docker run` (Jenkins, Azure). The
bootstrap step also seeds the assignment user defined in
`tests/data/new-user.json` so a brand-new container is immediately
testable.

## What gets uploaded

After every run the pipelines archive:

  - `reports/test-report.html` — rich self-contained dashboard
  - `reports/last-run.json` — raw structured data (one record per test)
  - `reports/dashboard.html` — pass-rate trend dashboard
  - `reports/junit.xml` — JUnit XML for native CI test-result parsing
  - `reports/run-history.csv` — append-only history (only meaningful if
    cached / committed back to the repo across runs)
  - `test-results/**/trace.zip` — Playwright traces (only present for
    failures by default in CI; set `TRACE_MODE=on` to capture all)
