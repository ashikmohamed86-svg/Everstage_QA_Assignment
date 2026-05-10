import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginBeforeEach } from '../helpers/login';
import { suppressBanners } from '../helpers/banners';

/**
 * Lightweight accessibility coverage. We don't gate the build on a clean
 * axe-core scan (Juice Shop is intentionally imperfect), but we do assert:
 *   - axe completes without crashing (the scanner can navigate the page).
 *   - the count of *serious* / *critical* impact violations doesn't grow
 *     beyond the baseline captured here.
 *
 * If the team hardens the build, lower the BASELINE numbers — failing tests
 * mean accessibility *got better*, which is exactly the regression net we
 * want.
 */

const BASELINES: Record<string, number> = {
  // page → max acceptable count of (serious + critical) issues
  '/#/': 20,
  '/#/login': 10,
  '/#/saved-payment-methods': 25,
};

async function countSeriousIssues(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  return { count: serious.length, ids: serious.map((v) => v.id) };
}

test.describe('Accessibility - UI', () => {
  test(
    '[TC-UI-A11Y-100] Landing page has no new serious/critical axe violations',
    { tag: ['@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ page, context }) => {
      await suppressBanners(context);
      await page.goto('/#/');
      await page.waitForLoadState('networkidle');

      const result = await countSeriousIssues(page);
      const max = BASELINES['/#/'];
      expect(
        result.count,
        `serious/critical axe issues on / (ids: ${result.ids.join(', ')})`
      ).toBeLessThanOrEqual(max);
    }
  );

  test(
    '[TC-UI-A11Y-101] Login page has no new serious/critical axe violations',
    { tag: ['@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ page, context }) => {
      await suppressBanners(context);
      await page.goto('/#/login');
      await page.waitForLoadState('networkidle');

      const result = await countSeriousIssues(page);
      const max = BASELINES['/#/login'];
      expect(
        result.count,
        `serious/critical axe issues on /login (ids: ${result.ids.join(', ')})`
      ).toBeLessThanOrEqual(max);
    }
  );

  test(
    '[TC-UI-A11Y-102] Saved-payment-methods page has no new serious/critical axe violations',
    { tag: ['@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ page, context }) => {
      await loginBeforeEach(page, context);
      await page.goto('/#/saved-payment-methods');
      await page.waitForLoadState('networkidle');

      const result = await countSeriousIssues(page);
      const max = BASELINES['/#/saved-payment-methods'];
      expect(
        result.count,
        `serious/critical axe issues on /saved-payment-methods (ids: ${result.ids.join(', ')})`
      ).toBeLessThanOrEqual(max);
    }
  );
});
