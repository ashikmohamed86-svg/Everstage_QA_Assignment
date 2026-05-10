<!-- Replace the placeholders, delete sections that don't apply. -->

## What & why

<!-- One paragraph: what problem this solves, why now. Link issues if any. -->

## Test impact

- [ ] Added new tests (list TC ids: `TC-???-...`)
- [ ] Updated existing tests
- [ ] No test changes — code path is already covered

Scope: `@smoke` / `@regression` / `@security` / etc.

## How was this verified?

```bash
# paste the exact command(s) you ran and the result
npm run test:everstage
```

## Screenshots / report

<!-- Drop in `reports/test-report.html` highlights or a screenshot. -->

## Risk & rollback

- **Blast radius**: <!-- e.g. test-only / reporter / page object / helper -->
- **Rollback**: <!-- one-line revert plan -->

## Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:everstage` passes locally
- [ ] `docs/test-cases.md` regenerated if tests were added/renamed (`node tools/gen-catalog.js`)
- [ ] `CHANGELOG.md` updated for user-visible changes
