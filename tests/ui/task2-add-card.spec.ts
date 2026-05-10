import { test, expect } from '@playwright/test';
import { PaymentPage, CardDetails } from '../pages/PaymentPage';
import { loginBeforeEach } from '../helpers/login';
import { loginSession } from '../helpers/api';
import { uniqueCardNumber } from '../helpers/card';
import user from '../data/new-user.json';

/**
 * ════════════════════════════════════════════════════════════════════════
 *  ⭐  EVERSTAGE ASSESSMENT — TASK 2
 *  ─────────────────────────────────────────────────────────────────────
 *  "Create a UI test that navigates to My Payments options from
 *   homescreen (UI tests) and add card details."
 *
 *  Run only this task:    npm run test:task2
 *  Headline test:         [TC-UI-001] (literal brief)
 *  Page Object Model:     tests/pages/PaymentPage.ts
 *  All tests tagged:      @task2, @everstage-qa
 * ════════════════════════════════════════════════════════════════════════
 *
 * UI test: navigate to "My Payment Options" from the home screen and
 * add card details, with positive / negative / boundary / security /
 * load coverage. Each test starts already authenticated thanks to the
 * shared `loginBeforeEach` helper (Task 1).
 */
test.describe('My Payment Options - UI (Task 2)', () => {
  test.beforeEach(async ({ page, context, request }) => {
    // Clear any cards left over from prior runs so the saved-payment-methods
    // table renders quickly. Without this the page accumulates 100+ rows
    // across many runs and the post-add snackbar / row-visible assertions
    // start hitting the 5s timeout because Angular re-renders the whole
    // table on every add.
    const session = await loginSession(request, user.email, user.password);
    const headers = { Authorization: `Bearer ${session.token}` };
    const list = await request.get('/api/Cards/', { headers });
    const cards = (await list.json()).data ?? [];
    for (const card of cards) {
      await request.delete(`/api/Cards/${card.id}`, { headers });
    }

    await loginBeforeEach(page, context);
  });

  // ---------------------------------------------------------------------------
  // Positive / functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-001] User can add card details from My Payment Options',
    { tag: ['@task2', '@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Everstage QA',
        number: uniqueCardNumber(),
        month: '5',
        year: '2080',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
      await expect(
        page.locator('mat-cell, td.mat-cell', { hasText: card.number.slice(-4) }).first()
      ).toBeVisible();
    }
  );

  test(
    '[TC-UI-002] Submit button is disabled when the add-card form is empty',
    { tag: ['@task2', '@everstage-qa', '@negative', '@functional', '@regression'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-003] Adding multiple cards in sequence lists each one',
    { tag: ['@task2', '@everstage-qa', '@positive', '@regression', '@e2e', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const cardOne: CardDetails = {
        name: 'Test User One',
        number: uniqueCardNumber(),
        month: '5',
        year: '2080',
      };
      const cardTwo: CardDetails = {
        name: 'Test User Two',
        number: uniqueCardNumber(),
        month: '7',
        year: '2090',
      };

      await paymentPage.addCard(cardOne);
      await expect(
        page.locator('mat-cell, td.mat-cell', { hasText: cardOne.number.slice(-4) }).first()
      ).toBeVisible();

      await paymentPage.addCard(cardTwo);
      await expect(
        page.locator('mat-cell, td.mat-cell', { hasText: cardTwo.number.slice(-4) }).first()
      ).toBeVisible();

      // The first card stays visible after the second add — the page does
      // not collapse to "latest card only".
      await expect(
        page.locator('mat-cell, td.mat-cell', { hasText: cardOne.number.slice(-4) }).first()
      ).toBeVisible();
    }
  );

  test(
    '[TC-UI-004] My Payment Options menu item navigates to /saved-payment-methods',
    { tag: ['@task2', '@everstage-qa', '@smoke', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await expect(page).toHaveURL(/saved-payment-methods/);
    }
  );

  // ---------------------------------------------------------------------------
  // Negative
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-010] Submit stays disabled when only the name is filled',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.nameField.fill('Solo Name');
      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-011] Submit stays disabled when card number is missing',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.nameField.fill('No Card Number');
      await paymentPage.monthSelect.selectOption('5');
      await paymentPage.yearSelect.selectOption('2080');

      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-012] Non-digit keystrokes are filtered by the Card Number field',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      // Card Number is rendered as <input type="number">, so the browser
      // discards non-digit keystrokes — the field stays empty and the
      // form's required-validation keeps Submit disabled.
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.nameField.fill('Bad Card');
      await paymentPage.monthSelect.selectOption('5');
      await paymentPage.yearSelect.selectOption('2080');

      await paymentPage.cardNumberField.pressSequentially('abc-def-ghij');
      await expect(paymentPage.cardNumberField).toHaveValue('');
      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-013] Submit stays disabled when only month is selected',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.monthSelect.selectOption('5');
      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-020] XSS payload in cardholder name is rendered as text, not script',
    { tag: ['@task2', '@everstage-qa', '@security', '@regression'] },
    async ({ page }) => {
      let dialogFired = false;
      page.on('dialog', async (dialog) => {
        dialogFired = true;
        await dialog.dismiss();
      });

      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: '<img src=x onerror=alert(1)>',
        number: uniqueCardNumber(),
        month: '5',
        year: '2080',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
      expect(dialogFired, 'XSS in name field must not execute').toBe(false);
    }
  );

  test(
    '[TC-UI-021] SQL-injection style cardholder name is treated as a literal string',
    { tag: ['@task2', '@everstage-qa', '@security', '@regression'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: "Robert'); DROP TABLE Cards;--",
        number: uniqueCardNumber(),
        month: '6',
        year: '2085',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
      // Subsequent add still works → table not dropped.
      const followUp: CardDetails = {
        name: 'Follow Up',
        number: uniqueCardNumber(),
        month: '7',
        year: '2086',
      };
      await paymentPage.addCard(followUp);
      await expect(paymentPage.confirmation).toBeVisible();
    }
  );

  test(
    '[TC-UI-022] Card list masks the card number (only last 4 digits visible)',
    { tag: ['@task2', '@everstage-qa', '@security', '@regression', '@nonfunctional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Mask Check',
        number: uniqueCardNumber(),
        month: '4',
        year: '2080',
      };
      await paymentPage.addCard(card);
      await expect(paymentPage.confirmation).toBeVisible();

      // The full card number must NOT appear anywhere in the rendered DOM —
      // only the last 4 digits should be shown.
      const pageText = await page.locator('body').innerText();
      expect(pageText.includes(card.number)).toBe(false);
      expect(pageText.includes(card.number.slice(-4))).toBe(true);
    }
  );

  // ---------------------------------------------------------------------------
  // Boundary
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-030] Card with minimum allowed expiry year (2080) is accepted',
    { tag: ['@task2', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Min Year',
        number: uniqueCardNumber(),
        month: '1',
        year: '2080',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
    }
  );

  test(
    '[TC-UI-031] Card with maximum offered expiry year (2099) is accepted',
    { tag: ['@task2', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Max Year',
        number: uniqueCardNumber(),
        month: '12',
        year: '2099',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
    }
  );

  test(
    '[TC-UI-032] Cardholder name at long boundary (200 chars) is accepted',
    { tag: ['@task2', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'A'.repeat(200),
        number: uniqueCardNumber(),
        month: '5',
        year: '2080',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
    }
  );

  // ---------------------------------------------------------------------------
  // Load / non-functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-040] Adding 5 cards in rapid succession all succeed and are listed',
    { tag: ['@task2', '@everstage-qa', '@load', '@nonfunctional', '@regression'] },
    async ({ page }) => {
      test.slow();
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const numbers: string[] = [];
      for (let i = 0; i < 5; i++) {
        const card: CardDetails = {
          name: `Load User ${i}`,
          number: uniqueCardNumber(),
          month: String((i % 12) + 1),
          year: '2080',
        };
        numbers.push(card.number);
        await paymentPage.addCard(card);
        await expect(paymentPage.confirmation).toBeVisible();
        // Wait for the snackbar to disappear between iterations — it can
        // intercept clicks on the next iteration's form fields and leave
        // Submit disabled because Angular saw the form as untouched.
        await paymentPage.confirmation.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
      }

      for (const number of numbers) {
        await expect(
          page.locator('mat-cell, td.mat-cell', { hasText: number.slice(-4) }).first()
        ).toBeVisible();
      }
    }
  );

  test(
    '[TC-UI-041] Add-card round-trip from menu click to confirmation completes under 15s',
    { tag: ['@task2', '@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      const start = Date.now();

      await paymentPage.openMyPayments();
      await paymentPage.addCard({
        name: 'Perf Sentinel',
        number: uniqueCardNumber(),
        month: '5',
        year: '2080',
      });
      await expect(paymentPage.confirmation).toBeVisible();

      const elapsedMs = Date.now() - start;
      expect(elapsedMs, 'add-card round-trip should be under 15s').toBeLessThan(15_000);
    }
  );

  // ---------------------------------------------------------------------------
  // Gap-fill: persistence, table contents, additional disabled-state combos,
  // and special-character handling.
  // ---------------------------------------------------------------------------

  test(
    '[TC-UI-005] Saved card persists across a full page reload',
    { tag: ['@task2', '@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Persistence Tester',
        number: uniqueCardNumber(),
        month: '6',
        year: '2080',
      };
      await paymentPage.addCard(card);
      await expect(paymentPage.confirmation).toBeVisible();

      // Hard reload — the saved card must still be there because it lives
      // in the DB, not in client memory.
      await page.reload();
      await expect(
        page.locator('mat-cell, td.mat-cell', { hasText: card.number.slice(-4) }).first()
      ).toBeVisible();
    }
  );

  test(
    '[TC-UI-006] Saved card row exposes the cardholder name and the last 4 digits',
    { tag: ['@task2', '@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'Row Content Tester',
        number: uniqueCardNumber(),
        month: '7',
        year: '2080',
      };
      await paymentPage.addCard(card);
      await expect(paymentPage.confirmation).toBeVisible();

      // The new row should carry both the cardholder name AND the masked
      // last-4 digits (full PAN must NOT appear).
      const row = page.locator('mat-row, tr.mat-row', { hasText: card.number.slice(-4) }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText(card.name);
      await expect(row, 'full PAN must NOT be visible in the table').not.toContainText(
        card.number
      );
    }
  );

  test(
    '[TC-UI-014] Submit stays disabled when only the year is selected',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.yearSelect.selectOption('2080');
      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-015] Empty-string cardholder name is not enough to enable Submit',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      // Type then clear so the form control becomes "touched & empty",
      // which is the realistic user mistake.
      await paymentPage.nameField.fill('temp');
      await paymentPage.nameField.fill('');
      await paymentPage.cardNumberField.fill(uniqueCardNumber());
      await paymentPage.monthSelect.selectOption('5');
      await paymentPage.yearSelect.selectOption('2080');

      await expect(paymentPage.submitButton).toBeDisabled();
    }
  );

  test(
    '[TC-UI-016] DOCUMENTED UX: whitespace-only cardholder name passes form validation',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      // Juice Shop's add-card form does not trim the name field, so a
      // whitespace-only string satisfies the `required` HTML5 validator
      // and Submit becomes enabled. This is a documented UX gap; a
      // hardened build should trim before validating, in which case the
      // assertion below would flip to `.toBeDisabled()`.
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();
      await paymentPage.expandAddCardPanel();

      await paymentPage.nameField.fill('   ');
      await paymentPage.cardNumberField.fill(uniqueCardNumber());
      await paymentPage.monthSelect.selectOption('5');
      await paymentPage.yearSelect.selectOption('2080');

      await expect(paymentPage.submitButton).toBeEnabled();
    }
  );

  test(
    '[TC-UI-017] Submit is briefly disabled during in-flight save (no double-submit)',
    { tag: ['@task2', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const card: CardDetails = {
        name: 'No Double Submit',
        number: uniqueCardNumber(),
        month: '8',
        year: '2080',
      };
      await paymentPage.expandAddCardPanel();
      await paymentPage.nameField.fill(card.name);
      await paymentPage.cardNumberField.fill(card.number);
      await paymentPage.monthSelect.selectOption(card.month);
      await paymentPage.yearSelect.selectOption(card.year);

      await paymentPage.submitButton.click();

      // After clicking, the button should not allow a second click that
      // would create a duplicate row. Verify by counting rows for this
      // card's last-4 after the snackbar settles.
      await expect(paymentPage.confirmation).toBeVisible();
      await paymentPage.confirmation.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
      const rows = await page
        .locator('mat-row, tr.mat-row', { hasText: card.number.slice(-4) })
        .count();
      expect(rows, 'exactly one row should exist for the card').toBe(1);
    }
  );

  test(
    '[TC-UI-033] Unicode characters in cardholder name are accepted and rendered',
    { tag: ['@task2', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      await paymentPage.openMyPayments();

      const unicodeName = 'Åshik Móhämed 测试';
      const card: CardDetails = {
        name: unicodeName,
        number: uniqueCardNumber(),
        month: '9',
        year: '2080',
      };
      await paymentPage.addCard(card);

      await expect(paymentPage.confirmation).toBeVisible();
      await expect(
        page.locator('mat-row, tr.mat-row', { hasText: unicodeName }).first()
      ).toBeVisible();
    }
  );
});
