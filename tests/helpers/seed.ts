import { APIRequestContext, expect } from '@playwright/test';
import { uniqueCardNumber } from './card';
import { logged } from './logged-request';

/**
 * Single source of truth for "make Juice Shop look like a fresh, ready
 * customer" — addresses, cards, basket items, and basket-clearing. Both
 * the API and UI order-flow specs lean on these so the same setup runs
 * in both layers and we don't repeat ourselves.
 *
 * Every helper returns the created entity's id (when applicable) so
 * callers can pass it into checkout payloads without an extra round-trip.
 */

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

// ---------------------------------------------------------------------------
// Basket
// ---------------------------------------------------------------------------

/**
 * Empties the user's basket. Juice Shop's BasketItem table has a unique
 * (ProductId, BasketId) constraint — re-adding the same product 500s — so
 * tests must start from a known empty state.
 */
export async function clearBasket(
  request: APIRequestContext,
  token: string,
  basketId: number
): Promise<void> {
  const api = logged(request);
  const headers = { Authorization: `Bearer ${token}` };
  const basket = await api.get(`/rest/basket/${basketId}`, { headers });
  const products = (await basket.json()).data?.Products ?? [];
  for (const product of products) {
    const itemId = product.BasketItem?.id;
    if (itemId) await api.delete(`/api/BasketItems/${itemId}`, { headers });
  }
}

/**
 * Adds a single product to the user's basket. The product must be in
 * stock (caller usually resolves this via `findStockableProductId`).
 *
 * Throws (rather than soft-failing) if the server rejects the add — the
 * error includes the response body, which is far more useful than the
 * status-only assertions that produce "Expected 201, received 400" in
 * Playwright's default reporter.
 */
export async function seedBasket(
  request: APIRequestContext,
  token: string,
  basketId: number,
  productId: number,
  quantity = 1
): Promise<void> {
  const api = logged(request);
  const response = await api.post('/api/BasketItems/', {
    headers: authHeaders(token),
    data: { ProductId: productId, BasketId: basketId, quantity },
  });
  if (![200, 201].includes(response.status())) {
    const body = await response.text();
    throw new Error(
      `seedBasket failed (status ${response.status()}, product ${productId}): ${body}`
    );
  }
}

// ---------------------------------------------------------------------------
// Address book
// ---------------------------------------------------------------------------

export interface AddressOverrides {
  fullName?: string;
  mobileNum?: number;
  zipCode?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Creates a delivery address against the authenticated user. Overrides
 * any field individually; defaults are deliberately innocuous so tests
 * can grep on `seedAddress(...)` and not need to scan a wall of fields.
 */
export async function seedAddress(
  request: APIRequestContext,
  token: string,
  overrides: AddressOverrides = {}
): Promise<number> {
  const api = logged(request);
  const response = await api.post('/api/Addresss/', {
    headers: authHeaders(token),
    data: {
      fullName: 'Order Flow QA',
      mobileNum: 9876543210,
      zipCode: '560001',
      streetAddress: 'Checkout Test Lane 42',
      city: 'Bangalore',
      state: 'KA',
      country: 'India',
      ...overrides,
    },
  });
  expect(response.status(), 'address should be created').toBe(201);
  return (await response.json()).data.id;
}

// ---------------------------------------------------------------------------
// Payment cards
// ---------------------------------------------------------------------------

export interface CardOverrides {
  fullName?: string;
  cardNum?: string;
  expMonth?: number;
  expYear?: number;
}

/**
 * Creates a payment card on the authenticated user. The card number
 * defaults to a fresh `uniqueCardNumber()` so parallel + repeated runs
 * don't collide.
 */
export async function seedCard(
  request: APIRequestContext,
  token: string,
  overrides: CardOverrides = {}
): Promise<number> {
  const api = logged(request);
  const response = await api.post('/api/Cards/', {
    headers: authHeaders(token),
    data: {
      fullName: 'Order Flow QA',
      cardNum: uniqueCardNumber(),
      expMonth: 5,
      expYear: 2080,
      ...overrides,
    },
  });
  expect(response.status(), 'card should be created').toBe(201);
  return (await response.json()).data.id;
}

/** Deletes every saved card for the authenticated user. */
export async function clearCards(
  request: APIRequestContext,
  token: string
): Promise<void> {
  const api = logged(request);
  const headers = { Authorization: `Bearer ${token}` };
  const list = await api.get('/api/Cards/', { headers });
  const cards = (await list.json()).data ?? [];
  for (const card of cards) {
    await api.delete(`/api/Cards/${card.id}`, { headers });
  }
}

// ---------------------------------------------------------------------------
// Delivery methods
// ---------------------------------------------------------------------------

/** Returns the id of the *first* delivery method (typically One Day Delivery). */
export async function defaultDeliveryMethodId(
  request: APIRequestContext,
  token: string
): Promise<number> {
  const api = logged(request);
  const response = await api.get('/api/Deliverys', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), 'Deliverys catalog must be reachable').toBeTruthy();
  return (await response.json()).data[0].id;
}
