import { BrowserContext } from '@playwright/test';

/**
 * Juice Shop renders three layered intercepts on first load that all pin
 * themselves over the form elements we need to interact with:
 *
 *   1. A welcome dialog (gated by the `welcomebanner_status` cookie)
 *   2. A cookie consent bar (gated by `cookieconsent_status`)
 *   3. A "Language has been changed to English" snackbar (suppressed when
 *      `language` cookie is already set)
 *
 * Pre-seeding all three cookies avoids the racy click-to-dismiss approach.
 */
export async function suppressBanners(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.cookie = 'welcomebanner_status=dismiss; path=/';
    document.cookie = 'cookieconsent_status=dismiss; path=/';
    document.cookie = 'language=en; path=/';
  });
}
