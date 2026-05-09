import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config.
 *
 *   BASE_URL    — point the suite at a non-default Juice Shop instance.
 *                 Defaults to http://localhost:3000.
 *   CI          — when set (any truthy value), the config switches to a
 *                 leaner profile: traces / videos only on failure (keeps
 *                 CI artifacts small) and an extra retry to absorb
 *                 transient network blips.
 *   TRACE_MODE  — explicit override for trace capture
 *                 ('on' | 'off' | 'retain-on-failure' | 'on-first-retry').
 *                 If unset, defaults to 'on' locally and
 *                 'retain-on-failure' in CI.
 */
const isCI = !!process.env.CI;

const traceMode =
  (process.env.TRACE_MODE as 'on' | 'off' | 'retain-on-failure' | 'on-first-retry' | undefined) ??
  (isCI ? 'retain-on-failure' : 'on');

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  // CI gets one more retry to absorb transient network flakes.
  retries: isCI ? 3 : 2,
  // GitHub Actions / GitLab CI parallelise nicely; locally we keep
  // serial so the assignment user can watch headed runs end-to-end.
  workers: isCI ? 2 : 1,
  forbidOnly: isCI,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['./tests/reporters/csv-reporter.ts'],
    ['./tests/reporters/rich-reporter.ts'],
    // GitHub Actions annotations — only loaded when running in GH.
    ...(process.env.GITHUB_ACTIONS ? [['github'] as ['github']] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    // Locally: every test gets a trace so the rich report's trace cards
    // are populated. In CI: only failures, to keep artifact size sane.
    trace: traceMode,
    screenshot: isCI ? 'only-on-failure' : 'on',
    video: isCI ? 'retain-on-failure' : 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
