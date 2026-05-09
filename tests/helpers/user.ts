/**
 * Helpers that produce unique test data so parallel test runs do not collide
 * with each other (Juice Shop persists everything to a SQLite DB until
 * the server is restarted).
 */
export interface FreshUser {
  email: string;
  password: string;
  repeatPassword?: string;
  securityAnswer: string;
  /** Index into the live security-question list. Avoids label drift across builds. */
  securityQuestionIndex: number;
}

/**
 * Returns a unique email like `qa-1714900000000-abcd@juice.test`.
 */
export function uniqueEmail(prefix = 'qa'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${rand}@juice.test`;
}

/**
 * Returns a fresh user object. Defaults pick the first security question by
 * index — labels change between Juice Shop builds and locales.
 */
export function freshUser(overrides: Partial<FreshUser> = {}): FreshUser {
  return {
    email: uniqueEmail(),
    password: 'StrongPass!23',
    securityAnswer: 'TestAnswer',
    securityQuestionIndex: 0,
    ...overrides,
  };
}
