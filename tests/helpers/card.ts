/**
 * Returns a 16-digit Visa-like card number with 12 random trailing digits.
 * Pure random (rather than timestamp-based) gives 10^12 unique values, so
 * tests run in parallel — including the same millisecond — won't collide
 * even after many runs accumulate cards on the user's account.
 */
export function uniqueCardNumber(): string {
  const seed = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
  return `4111${seed}`;
}
