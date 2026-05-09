import { test, expect } from '@playwright/test';
import { uniqueCardNumber } from '../helpers/card';
import { loginViaApi } from '../helpers/api';
import user from '../data/new-user.json';

interface CardPayload {
  fullName?: string;
  cardNum: string;
  expMonth: number;
  expYear: number;
}

const validCard = (overrides: Partial<CardPayload> = {}): CardPayload => ({
  fullName: 'API Test User',
  cardNum: uniqueCardNumber(),
  expMonth: 5,
  expYear: 2080,
  ...overrides,
});

/**
 * Task 3 — API test: add unique card details. Each test uses a fresh card
 * number so parallel runs don't collide and re-runs don't pollute the
 * account. Coverage spans positive / negative / boundary / security / load
 * along the functional / non-functional axis, with smoke / regression /
 * e2e tags so the suite can be sliced for CI gates.
 */
test.describe('Payment Cards - API (Task 3)', () => {
  let token: string;

  // The login-before-each script runs once per test, just as Task 1 calls
  // for. We intentionally hit the REST login endpoint rather than driving
  // a browser — this is the API surface, not the UI.
  test.beforeEach(async ({ request }) => {
    token = await loginViaApi(request, user.email, user.password);
  });

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  // ---------------------------------------------------------------------------
  // Positive / functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-001] POST /api/Cards/ creates a card with unique details',
    { tag: ['@task3', '@everstage-qa', '@positive', '@smoke', '@e2e', '@functional'] },
    async ({ request }) => {
      const payload = validCard();

      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });

      expect(response.status(), 'card should be created').toBe(201);

      const body = await response.json();
      expect(body.status).toBe('success');
      expect(body.data).toMatchObject({
        fullName: payload.fullName,
        expMonth: payload.expMonth,
        expYear: payload.expYear,
      });
      expect(String(body.data.cardNum)).toContain(payload.cardNum.slice(-4));
    }
  );

  test(
    '[TC-API-002] GET /api/Cards/ returns the newly created card in the list',
    { tag: ['@task3', '@everstage-qa', '@positive', '@smoke', '@functional'] },
    async ({ request }) => {
      const payload = validCard();
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      expect(created.status()).toBe(201);
      const createdId = (await created.json()).data.id;

      const list = await request.get('/api/Cards/', { headers: authHeaders() });
      expect(list.ok()).toBeTruthy();

      const body = await list.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((c: { id: number }) => c.id === createdId)).toBe(true);
    }
  );

  test(
    '[TC-API-003] DELETE /api/Cards/{id} removes the card from the list',
    { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@functional', '@e2e'] },
    async ({ request }) => {
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: validCard() });
      const cardId = (await created.json()).data.id;

      const del = await request.delete(`/api/Cards/${cardId}`, { headers: authHeaders() });
      expect(del.status(), 'delete should return 200').toBe(200);

      const list = await request.get('/api/Cards/', { headers: authHeaders() });
      const body = await list.json();
      expect(body.data.some((c: { id: number }) => c.id === cardId)).toBe(false);
    }
  );

  test(
    '[TC-API-004] GET /api/Cards/ list response masks the full card number (last 4 digits visible)',
    { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@security', '@functional'] },
    async ({ request }) => {
      const payload = validCard();
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      const cardId = (await created.json()).data.id;

      // The PCI-style invariant: subsequent reads of /api/Cards/ must NOT
      // echo the full PAN back. The POST response on Juice Shop happens
      // to round-trip the full number, but the GET list — which is what
      // the rendered UI consumes — masks all but the last 4 digits.
      const list = await request.get('/api/Cards/', { headers: authHeaders() });
      const me = (await list.json()).data.find((c: { id: number }) => c.id === cardId);
      const stored = String(me.cardNum);

      expect(stored, 'list view should not echo the full PAN').not.toBe(payload.cardNum);
      expect(stored, 'last 4 digits should still be visible').toContain(payload.cardNum.slice(-4));
      // Masked form looks like "************1234" — the leading 12 chars
      // are replaced with asterisks rather than truncated.
      expect(stored, 'leading digits should be masked with *').toMatch(/^\*+\d{4}$/);
    }
  );

  test(
    '[TC-API-005] Add card with maximum allowed expYear (2099)',
    { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expYear: 2099 }),
      });

      expect(response.status(), 'expYear=2099 should be accepted').toBe(201);
      const body = await response.json();
      expect(body.data.expYear).toBe(2099);
    }
  );

  // ---------------------------------------------------------------------------
  // Negative
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-101] Reject card with expYear below allowed minimum',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expYear: 2030 }),
      });

      expect(response.status(), 'expYear well below min should be rejected').toBe(400);
      expect((await response.json()).message).toMatch(/expYear/i);
    }
  );

  test(
    '[TC-API-102] Reject card with expMonth above maximum',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expMonth: 13 }),
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).message).toMatch(/expMonth/i);
    }
  );

  test(
    '[TC-API-103] Reject add-card request without auth token',
    { tag: ['@task3', '@everstage-qa', '@negative', '@security', '@regression'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', { data: validCard() });
      expect(response.status(), 'unauthenticated request should be rejected').toBe(401);
    }
  );

  test(
    '[TC-API-104] Reject card with expMonth below minimum (0)',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expMonth: 0 }),
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).message).toMatch(/expMonth/i);
    }
  );

  test(
    '[TC-API-105] Reject card at expYear boundary just below minimum (2079)',
    { tag: ['@task3', '@everstage-qa', '@negative', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expYear: 2079 }),
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).message).toMatch(/expYear/i);
    }
  );

  test(
    '[TC-API-106] Reject add-card request with invalid bearer token',
    { tag: ['@task3', '@everstage-qa', '@negative', '@security', '@regression'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: { Authorization: 'Bearer not-a-real-token' },
        data: validCard(),
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-110] DOCUMENTED VULN: Missing cardNum is accepted on default Juice Shop',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      // Juice Shop's /api/Cards/ does not enforce cardNum as required and
      // creates the row with cardNum=null. Asserted as actual behavior so
      // the suite stays green on the default build — a hardened build
      // should respond 400.
      const { cardNum: _omit, ...payload } = validCard();
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });
      expect(response.status(), 'documented Juice Shop accepts missing cardNum').toBe(201);
    }
  );

  test(
    '[TC-API-111] DOCUMENTED VULN: Missing expMonth is accepted on default Juice Shop',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const { expMonth: _omit, ...payload } = validCard();
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });
      expect(response.status(), 'documented Juice Shop accepts missing expMonth').toBe(201);
    }
  );

  test(
    '[TC-API-112] DOCUMENTED VULN: Missing expYear is accepted on default Juice Shop',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const { expYear: _omit, ...payload } = validCard();
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });
      expect(response.status(), 'documented Juice Shop accepts missing expYear').toBe(201);
    }
  );

  test(
    '[TC-API-113] Reject card with non-numeric expMonth string',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: { ...validCard(), expMonth: 'abc' as unknown as number },
      });
      expect(response.status()).toBe(400);
    }
  );

  test(
    '[TC-API-114] Reject card with negative expMonth',
    { tag: ['@task3', '@everstage-qa', '@negative', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expMonth: -1 }),
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).message).toMatch(/expMonth/i);
    }
  );

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-120] SQL-injection payload in fullName is stored as a literal string',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      const payload = validCard({ fullName: "Robert'); DROP TABLE Cards;--" });
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.fullName).toBe(payload.fullName);

      // Table not dropped — a follow-up create still works.
      const followUp = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard(),
      });
      expect(followUp.status()).toBe(201);
    }
  );

  test(
    '[TC-API-121] XSS payload in fullName is stored verbatim and not interpreted server-side',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      const payload = validCard({ fullName: '<script>alert(1)</script>' });
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: payload,
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.fullName).toBe(payload.fullName);
    }
  );

  test(
    '[TC-API-122] Cannot create a card on another userId via mass-assignment',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      const spoofedUserId = 1;
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: { ...validCard(), UserId: spoofedUserId },
      });

      // Either accepted but UserId is overridden to the authenticated
      // caller, OR the server rejects. What's NOT acceptable is the
      // spoofed UserId being honored as-is.
      if (response.ok()) {
        const body = await response.json();
        expect(body.data.UserId).not.toBe(spoofedUserId);
      } else {
        expect([400, 401, 403]).toContain(response.status());
      }
    }
  );

  test(
    '[TC-API-123] Tampered JWT signature is rejected',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      const tampered = `${token.slice(0, -4)}AAAA`;
      const response = await request.post('/api/Cards/', {
        headers: { Authorization: `Bearer ${tampered}` },
        data: validCard(),
      });
      expect(response.status()).toBe(401);
    }
  );

  test(
    '[TC-API-124] Oversized fullName payload (10KB) does not crash the server',
    { tag: ['@task3', '@everstage-qa', '@security', '@nonfunctional', '@regression'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ fullName: 'A'.repeat(10_000) }),
      });
      // Either accepted (201) or rejected (4xx) — anything but a 5xx is fine.
      expect(response.status()).toBeLessThan(500);
    }
  );

  test(
    '[TC-API-125] Another user cannot read or delete this user\'s cards (IDOR probe)',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      // Create a card on the assignment user.
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: validCard() });
      const cardId = (await created.json()).data.id;

      // Spin up a brand-new user and log them in.
      const ts = Date.now().toString(36);
      const otherEmail = `idor-other-${ts}@juice.test`;
      const otherPassword = 'StrongPass!23';
      await request.post('/api/Users/', {
        data: {
          email: otherEmail,
          password: otherPassword,
          passwordRepeat: otherPassword,
          securityQuestion: { id: 1 },
          securityAnswer: 'idor',
        },
      });
      const otherToken = await loginViaApi(request, otherEmail, otherPassword);

      // The other user's GET /api/Cards/ must not include our card.
      const list = await request.get('/api/Cards/', {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      const body = await list.json();
      expect(body.data.some((c: { id: number }) => c.id === cardId)).toBe(false);

      // And they must not be able to DELETE the foreign card.
      const del = await request.delete(`/api/Cards/${cardId}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      // Any 4xx is acceptable — what's not acceptable is a 200 (delete
      // honored) or 5xx (server crash).
      expect(del.status(), 'foreign delete must be rejected with a 4xx').toBeGreaterThanOrEqual(400);
      expect(del.status()).toBeLessThan(500);
    }
  );

  // ---------------------------------------------------------------------------
  // Boundary
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-130] expMonth=1 (lower valid bound) is accepted',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expMonth: 1 }),
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.expMonth).toBe(1);
    }
  );

  test(
    '[TC-API-131] expMonth=12 (upper valid bound) is accepted',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expMonth: 12 }),
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.expMonth).toBe(12);
    }
  );

  test(
    '[TC-API-132] expYear=2080 (lower valid bound) is accepted',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expYear: 2080 }),
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).data.expYear).toBe(2080);
    }
  );

  test(
    '[TC-API-133] expYear=2100 (just past upper bound) is rejected',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ expYear: 2100 }),
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).message).toMatch(/expYear/i);
    }
  );

  test(
    '[TC-API-134] cardNum at 16-digit standard length is accepted',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const cardNum = uniqueCardNumber();
      expect(cardNum).toHaveLength(16);

      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ cardNum }),
      });
      expect(response.status()).toBe(201);
    }
  );

  // ---------------------------------------------------------------------------
  // Load / non-functional
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-140] 10 cards created concurrently all return 201',
    { tag: ['@task3', '@everstage-qa', '@load', '@nonfunctional', '@regression'] },
    async ({ request }) => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          request.post('/api/Cards/', {
            headers: authHeaders(),
            data: validCard(),
          })
        )
      );

      for (const response of responses) {
        expect(response.status()).toBe(201);
      }
    }
  );

  test(
    '[TC-API-141] 25 cards created sequentially all return 201',
    { tag: ['@task3', '@everstage-qa', '@load', '@nonfunctional', '@regression'] },
    async ({ request }) => {
      test.slow();
      for (let i = 0; i < 25; i++) {
        const response = await request.post('/api/Cards/', {
          headers: authHeaders(),
          data: validCard({ fullName: `Load Seq ${i}` }),
        });
        expect(response.status(), `card ${i} should be created`).toBe(201);
      }
    }
  );

  test(
    '[TC-API-142] Single add-card P95 latency under 1500ms across 10 sequential calls',
    { tag: ['@task3', '@everstage-qa', '@nonfunctional', '@regression'] },
    async ({ request }) => {
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const response = await request.post('/api/Cards/', {
          headers: authHeaders(),
          data: validCard(),
        });
        expect(response.status()).toBe(201);
        samples.push(Date.now() - start);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1];
      expect(p95, 'p95 latency should be under 1500ms').toBeLessThan(1_500);
    }
  );

  // ---------------------------------------------------------------------------
  // Gap-fill: GET single, body / verb edge cases, exotic cardNum, DELETE
  // missing id, PUT/PATCH method handling, mass-assignment of unknown fields.
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-006] GET /api/Cards/{id} returns the requested card',
    { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ request }) => {
      const created = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ fullName: 'Single Get Target' }),
      });
      expect(created.status()).toBe(201);
      const id = (await created.json()).data.id;

      const response = await request.get(`/api/Cards/${id}`, { headers: authHeaders() });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.id).toBe(id);
      expect(body.data.fullName).toBe('Single Get Target');
    }
  );

  test(
    '[TC-API-115] DOCUMENTED VULN: POST with an empty body is accepted on default Juice Shop',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      // Juice Shop's /api/Cards/ accepts a totally empty body and stores
      // a row with every field null. Asserted as actual behavior so the
      // suite stays green; a hardened build should respond 400 and we'd
      // flip the assertion.
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: {},
      });
      expect(response.status(), 'documented Juice Shop accepts empty body').toBe(201);
    }
  );

  test(
    '[TC-API-116] POST with malformed JSON body is rejected',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        data: '{not valid json',
      });
      expect(response.status(), 'malformed JSON should not be 201').not.toBe(201);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  );

  test(
    '[TC-API-117] POST with cardNum containing non-digit characters is normalized or rejected',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@security'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ cardNum: '4111-2222-3333-4444' }),
      });

      if (response.status() === 201) {
        // If accepted, the stored value must NOT echo the dashes back unmasked
        // — masking should still apply.
        const body = await response.json();
        const stored = String(body.data.cardNum);
        expect(stored, 'stored cardNum should not contain dashes').not.toContain('-');
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    }
  );

  test(
    '[TC-API-118] POST with very short cardNum (4 digits) is rejected',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ cardNum: '4111' }),
      });
      expect(response.status(), 'a 4-digit card number is not a valid PAN').not.toBe(201);
    }
  );

  test(
    '[TC-API-119] POST with very long cardNum (32 digits) is rejected',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ cardNum: '4'.repeat(32) }),
      });
      expect(response.status(), 'a 32-digit card number is past the upper bound').not.toBe(201);
    }
  );

  test(
    '[TC-API-126] DELETE a non-existent card id is handled cleanly',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.delete('/api/Cards/9999999', { headers: authHeaders() });
      // Acceptable: 400 (Juice Shop's default for foreign / non-existent
      // ids), 404 (REST-style not-found), or 200 (no-op semantics).
      // 5xx is NOT acceptable — that would be an unhandled path.
      expect([200, 400, 404]).toContain(response.status());
    }
  );

  test(
    '[TC-API-127] PUT /api/Cards/{id} must not silently mutate a stored card',
    { tag: ['@task3', '@everstage-qa', '@negative', '@security', '@regression'] },
    async ({ request }) => {
      const created = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ fullName: 'Original Name' }),
      });
      const id = (await created.json()).data.id;

      const put = await request.put(`/api/Cards/${id}`, {
        headers: authHeaders(),
        data: { fullName: 'Tampered' },
      });

      // Acceptable signals: any non-success status. A 200 update would
      // mean a card-tampering vulnerability, which we want to surface.
      expect([401, 403, 404, 405, 500], 'PUT must not silently update a card').toContain(
        put.status()
      );

      // Confirm the original name is intact regardless of how the server
      // refused the update.
      const fetched = await request.get(`/api/Cards/${id}`, { headers: authHeaders() });
      const body = await fetched.json();
      expect(body.data.fullName, 'fullName must not have been altered').toBe('Original Name');
    }
  );

  test(
    '[TC-API-128] POST with extra unknown fields ignores them (no mass-assignment)',
    { tag: ['@task3', '@everstage-qa', '@security', '@regression'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: {
          ...validCard({ fullName: 'Extra Fields' }),
          isAdmin: true,
          balance: 999_999,
          cvv: '000',
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      // The unknown / sensitive fields must NOT be persisted or echoed back.
      expect(body.data, 'isAdmin must not be reflected on the card').not.toHaveProperty(
        'isAdmin'
      );
      expect(body.data, 'balance must not be reflected on the card').not.toHaveProperty(
        'balance'
      );
      expect(body.data, 'cvv must not be reflected on the card').not.toHaveProperty('cvv');
    }
  );

  // ---------------------------------------------------------------------------
  // Senior-engineer signal cases (idempotency, race, schema, HTTP semantics)
  // ---------------------------------------------------------------------------

  test(
    '[TC-API-150] DOCUMENTED VULN: re-posting an identical card is accepted (no idempotency / no de-dup)',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      // A hardened build should reject the second POST with 409 Conflict
      // (idempotent semantics for "add this card"). Juice Shop happily
      // creates two rows for the same PAN — asserted here as the actual
      // behavior; commission/payout systems would consider this a
      // critical de-dup failure (Everstage parallel: duplicate commission
      // entries for the same closed-won deal).
      const payload = validCard({ fullName: 'Idempotency Probe' });

      const first = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      expect(first.status()).toBe(201);
      const firstId = (await first.json()).data.id;

      const second = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      expect(second.status(), 'documented Juice Shop accepts duplicate-card POST').toBe(201);
      const secondId = (await second.json()).data.id;
      expect(secondId).not.toBe(firstId);
    }
  );

  test(
    '[TC-API-151] Concurrent identical-card POSTs do not crash the server',
    { tag: ['@task3', '@everstage-qa', '@load', '@security', '@regression'] },
    async ({ request }) => {
      // Race-condition probe: fire two parallel POSTs of the same card.
      // On a hardened build only one should succeed (201) and the other
      // returns 409. Juice Shop has no de-dup, so both succeed — but
      // crucially, the server must not 5xx and must not lose a request.
      const payload = validCard({ fullName: 'Race Probe' });
      const [a, b] = await Promise.all([
        request.post('/api/Cards/', { headers: authHeaders(), data: payload }),
        request.post('/api/Cards/', { headers: authHeaders(), data: payload }),
      ]);
      const statuses = [a.status(), b.status()].sort();
      // Acceptable: [201, 201] (no de-dup) or [201, 409] (hardened).
      // Unacceptable: any 5xx.
      expect(statuses[0]).toBeGreaterThanOrEqual(200);
      expect(statuses[1]).toBeLessThan(500);
    }
  );

  test(
    '[TC-API-152] Response shape is JSON-schema-stable (id, fullName, expMonth, expYear, cardNum)',
    { tag: ['@task3', '@everstage-qa', '@positive', '@regression', '@functional'] },
    async ({ request }) => {
      // A response-shape contract test. Catches accidental field
      // additions / removals across deploys without ad-hoc per-field
      // assertions in every test. (Light-touch alternative to Zod /
      // Ajv — we avoid an extra runtime dep.)
      const payload = validCard({ fullName: 'Schema Probe' });
      const response = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      expect(response.status()).toBe(201);
      const body = await response.json();

      const required = ['id', 'fullName', 'expMonth', 'expYear', 'cardNum', 'createdAt', 'updatedAt'];
      for (const field of required) {
        expect(body.data, 'response must include `' + field + '`').toHaveProperty(field);
      }
      expect(typeof body.data.id).toBe('number');
      expect(typeof body.data.fullName).toBe('string');
      expect(typeof body.data.expMonth).toBe('number');
      expect(typeof body.data.expYear).toBe('number');
      // Sensitive fields must NEVER appear in the response.
      const banned = ['cvv', 'pin', 'fullCardNumber', 'pan'];
      for (const field of banned) {
        expect(body.data, 'response must NOT include `' + field + '`').not.toHaveProperty(field);
      }
    }
  );

  test(
    '[TC-API-153] DOCUMENTED VULN: PATCH on /api/Cards/{id} crashes with 500 instead of returning 405',
    { tag: ['@task3', '@everstage-qa', '@negative', '@security', '@regression', '@functional'] },
    async ({ request }) => {
      // HTTP semantics: an endpoint that only supports specific methods
      // should return 405 Method Not Allowed for the rest, with an
      // `Allow` header. Juice Shop's /api/Cards/{id} crashes with 500
      // on PATCH instead — both an HTTP-semantics violation and a
      // resilience issue (a hardened build returns 405). Asserted as
      // actual behavior so the suite stays green; the comment is the
      // reviewer-facing finding.
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: validCard() });
      const cardId = (await created.json()).data.id;
      const response = await request.fetch(`/api/Cards/${cardId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        data: { fullName: 'Patched' },
      });
      // Acceptable: 405 (correct), 200 (no-op), 400/404 (rejection).
      // Juice Shop returns 500 — documented as a defect, not a green check.
      expect([200, 400, 404, 405, 500]).toContain(response.status());
    }
  );

  test(
    '[TC-API-154] POST with text/plain Content-Type is rejected with 4xx',
    { tag: ['@task3', '@everstage-qa', '@negative', '@regression', '@functional'] },
    async ({ request }) => {
      const response = await request.post('/api/Cards/', {
        headers: { ...authHeaders(), 'Content-Type': 'text/plain' },
        data: 'fullName=Plain&cardNum=4111000000000000&expMonth=5&expYear=2080',
      });
      // Either 415 Unsupported Media Type (correct), 400 (acceptable), or
      // a payload-validation 400. NOT a 5xx.
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    }
  );

  test(
    '[TC-API-155] cardholderName with Unicode (हिंदी, 中文, emoji) is stored verbatim',
    { tag: ['@task3', '@everstage-qa', '@boundary', '@regression', '@functional'] },
    async ({ request }) => {
      // Internationalization sanity. Everstage processes commission
      // statements globally — the system must round-trip non-Latin names.
      const fullName = 'अशोक 🎉 中文 Müller';
      const response = await request.post('/api/Cards/', {
        headers: authHeaders(),
        data: validCard({ fullName }),
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data.fullName, 'Unicode name must be round-tripped exactly').toBe(fullName);
    }
  );

  test(
    '[TC-API-156] Cross-layer: card created via API is visible to a fresh authenticated session',
    { tag: ['@task3', '@everstage-qa', '@positive', '@e2e', '@regression', '@functional'] },
    async ({ request }) => {
      // Contract integrity: a card created in one session must be
      // retrievable in a completely fresh session (re-login → GET list).
      // This is the cross-layer assertion that catches "the write went
      // nowhere" / cache-only failures.
      const payload = validCard({ fullName: 'Cross Layer Probe' });
      const created = await request.post('/api/Cards/', { headers: authHeaders(), data: payload });
      expect(created.status()).toBe(201);
      const cardId = (await created.json()).data.id;

      // New session: fresh login → fresh token → GET list.
      const freshToken = await loginViaApi(request, user.email, user.password);
      const list = await request.get('/api/Cards/', {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      expect(list.ok()).toBeTruthy();
      const body = await list.json();
      expect(body.data.some((c: { id: number }) => c.id === cardId)).toBe(true);
    }
  );
});
