import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AddressPage, AddressDetails } from '../pages/AddressPage';
import { suppressBanners } from '../helpers/banners';
import user from '../data/new-user.json';

const validAddress = (overrides: Partial<AddressDetails> = {}): AddressDetails => ({
  country: 'India',
  fullName: 'QA Tester',
  mobileNumber: '9876543210',
  zipCode: '560001',
  address: '221B Baker Street, Test Lane',
  city: 'Bangalore',
  state: 'KA',
  ...overrides,
});

test.describe('Address - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await suppressBanners(context);
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.password);
  });

  test('[TC-UI-600] User can create a new address with valid input', async ({ page }) => {
    const address = new AddressPage(page);
    await address.create(validAddress());

    // Juice Shop confirms creation via a snackbar; the post-submit redirect
    // varies (sometimes /address/saved, sometimes /search), so the snackbar
    // is the stable success signal.
    await expect(address.confirmation).toBeVisible({ timeout: 10000 });
  });

  test('[TC-UI-601] Submit is disabled until all required fields are filled', async ({ page }) => {
    const address = new AddressPage(page);
    await address.gotoCreate();

    await expect(address.submitButton).toBeDisabled();

    // Fill everything except the mobile number.
    const a = validAddress();
    await address.countryField.fill(a.country);
    await address.nameField.fill(a.fullName);
    await address.zipField.fill(a.zipCode);
    await address.addressField.fill(a.address);
    await address.cityField.fill(a.city);

    await expect(address.submitButton).toBeDisabled();
  });

  test('[TC-UI-602] Mobile number is enforced to numeric / sane length', async ({ page }) => {
    // Mobile is a <input type=number>: the browser silently drops non-digits
    // and Juice Shop validates the resulting number range. We assert the
    // observable signal: with very long input the Submit button cannot enable.
    const address = new AddressPage(page);
    await address.gotoCreate();
    await address.fill(validAddress({ mobileNumber: '12345678901234567' }));

    await expect(address.submitButton).toBeDisabled();
  });

  test('[TC-UI-603] Mobile number rejects non-numeric input', async ({ page }) => {
    // Mobile is <input type="number">, which makes Playwright's fill() refuse
    // non-digit text. To exercise the actual UX, we type via the keyboard so
    // the browser's native filtering applies, then assert the value contains
    // only digits.
    const address = new AddressPage(page);
    await address.gotoCreate();
    await address.mobileField.click();
    await page.keyboard.type('abc-def');

    await expect(address.mobileField).toHaveValue(/^\d*$/);
  });

  test('[TC-UI-604] ZIP code accepts long input without client-side truncation', async ({ page }) => {
    // The ZIP field has no maxlength on this Juice Shop build, so the client
    // does not truncate. We assert that the field preserves whatever the
    // server-side validation will decide on.
    const address = new AddressPage(page);
    await address.gotoCreate();
    await address.zipField.fill('1234567890');

    await expect(address.zipField).toHaveValue('1234567890');
  });
});
