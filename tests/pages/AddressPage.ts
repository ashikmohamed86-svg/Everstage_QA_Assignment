import { Page, Locator, expect } from '@playwright/test';

export interface AddressDetails {
  country: string;
  fullName: string;
  mobileNumber: string;
  zipCode: string;
  address: string;
  city: string;
  state?: string;
}

/**
 * "My Addresses" page (/#/address/saved) and the "New Address" form
 * (/#/address/create).
 *
 * Selectors come from the live DOM snapshot — fields expose accessible
 * labels (Country, Name, Mobile Number, ZIP Code, Address, City, State)
 * which are stable across Juice Shop builds.
 */
export class AddressPage {
  readonly page: Page;
  readonly accountMenu: Locator;
  readonly ordersAndPaymentMenu: Locator;
  readonly myAddressesMenu: Locator;
  readonly addNewAddressButton: Locator;
  readonly countryField: Locator;
  readonly nameField: Locator;
  readonly mobileField: Locator;
  readonly zipField: Locator;
  readonly addressField: Locator;
  readonly cityField: Locator;
  readonly stateField: Locator;
  readonly submitButton: Locator;
  readonly confirmation: Locator;
  readonly addressRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountMenu = page.locator('#navbarAccount');
    this.ordersAndPaymentMenu = page.getByRole('menuitem', { name: 'Show Orders and Payment Menu' });
    this.myAddressesMenu = page.getByRole('menuitem', { name: 'Go to saved address page' });
    this.addNewAddressButton = page.getByRole('button', { name: /add new address/i });

    this.countryField = page.getByRole('textbox', { name: 'Country' });
    this.nameField = page.getByRole('textbox', { name: 'Name' });
    // Mobile is rendered as input type=number → exposed as "spinbutton".
    this.mobileField = page.getByRole('spinbutton', { name: 'Mobile Number' });
    this.zipField = page.getByRole('textbox', { name: 'ZIP Code' });
    this.addressField = page.getByRole('textbox', { name: 'Address' });
    this.cityField = page.getByRole('textbox', { name: 'City' });
    this.stateField = page.getByRole('textbox', { name: 'State' });

    this.submitButton = page.getByRole('button', { name: /^Submit$/ });
    this.confirmation = page.locator('simple-snack-bar', { hasText: /address.*added|saved|created/i });
    this.addressRows = page.locator('mat-row, tr.mat-row');
  }

  async openMyAddresses(): Promise<void> {
    await this.accountMenu.click();
    await this.ordersAndPaymentMenu.click();
    await this.myAddressesMenu.click();
    await expect(this.page).toHaveURL(/address\/saved/);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/#/address/create');
    await this.countryField.waitFor({ state: 'visible' });
  }

  async fill(details: AddressDetails): Promise<void> {
    await this.countryField.fill(details.country);
    await this.nameField.fill(details.fullName);
    await this.mobileField.fill(details.mobileNumber);
    await this.zipField.fill(details.zipCode);
    await this.addressField.fill(details.address);
    await this.cityField.fill(details.city);
    if (details.state !== undefined) {
      await this.stateField.fill(details.state);
    }
  }

  async create(details: AddressDetails): Promise<void> {
    await this.gotoCreate();
    await this.fill(details);
    await this.submitButton.click();
  }
}
