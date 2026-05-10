# Juice Shop QA — Security Findings

_Live-probed against `bkimminich/juice-shop` running on `http://localhost:3000`.
Each finding is asserted as a passing test that encodes the **vulnerable**
production behavior, so the regression suite stays green on the unsafe build
and goes red the day the build is hardened._

## Scoring

| Tier | Meaning |
|---|---|
| **Critical** | Unauthenticated access to another user's data, complete auth bypass, or stored credentials/tokens leaked. |
| **High** | Authenticated bypass of authorisation, mass-assignment, IDOR/BOLA, server crash via predictable input. |
| **Medium** | Information leaks (enumeration oracles, secret return values), validation gaps with security impact. |
| **Low / UX** | Validation gaps with no immediate security impact; quality-of-service or hygiene issues. |

## At-a-glance

| Tier | Count | Findings |
|---|---|---|
| Critical | 2  | TC-UI-120, TC-API-204 |
| High     | 8  | TC-API-901, TC-API-1301, TC-API-904, TC-API-1621, TC-API-1001, TC-UI-720, TC-API-153, TC-API-168 |
| Medium   | 7  | TC-API-1401, TC-API-1503, TC-API-110, TC-API-111, TC-API-112, TC-API-115, TC-API-302 |
| Low / UX | 15 | TC-API-503, TC-API-504, TC-API-802, TC-API-803, TC-API-303, TC-API-150, TC-API-160, TC-API-161, TC-API-162, TC-API-166, TC-API-167, TC-API-903, TC-API-1611, TC-UI-016, TC-UI-711 |

---

## Critical

### TC-UI-120 / TC-API-204 — SQL-injection auth bypass on the login form
**Surface**: `POST /rest/user/login`, both via the UI form and direct API.
**Repro**: Submit `email = "' OR 1=1--"` (or any admin-comment variant) with any password. The server returns a valid session token and the UI redirects out of `/login`.
**Impact**: Complete authentication bypass. An attacker logs in as the first matching user (typically `admin@juice-sh.op`).
**Fix sketch**: Replace the string-concatenated `WHERE email = ...` with a parameterised query; reject email values that don't match RFC-5322. Both fixes are required.

---

## High

### TC-API-901 — Recycle requests created with `UserId = null`
**Surface**: `POST /api/Recycles`.
**Repro**: With a valid bearer token, post any well-formed recycle payload. The created row has `UserId: null` regardless of the caller.
**Impact**: The endpoint never binds the row to the authenticated user. A second user cannot be held accountable for, billed for, or notified about the request.
**Fix sketch**: Server should ignore any client-supplied UserId and bind it from `req.user.id`.

### TC-API-1301 — Complaints stored with `UserId = null`
**Surface**: `POST /api/Complaints`. Same shape as TC-API-901 — caller is authenticated, row is unowned.
**Fix sketch**: Same — stamp `UserId` server-side from the session.

### TC-API-904 — `GET /api/Recycles/{id}` returns *all* recycles, not just the requested id
**Surface**: `GET /api/Recycles/{id}` ignores the `{id}` path parameter and returns the full `Recycles` collection.
**Impact**: Information disclosure — an authenticated user can enumerate every recycle request in the system, including those belonging to other users.
**Fix sketch**: The controller must filter `WHERE id = :id AND UserId = :authUserId`.

### TC-API-1621 — BOLA: another user can checkout the assignment user's basket
**Surface**: `POST /rest/basket/{bid}/checkout`.
**Repro**: User A populates their basket. User B authenticates and POSTs to `/rest/basket/{A's bid}/checkout` — the order is placed against User A's basket.
**Impact**: Broken Object-Level Authorisation (BOLA / IDOR-on-mutation). User B drains User A's wallet for goods.
**Fix sketch**: Verify `Basket.UserId === req.user.id` before placing the order.

### TC-API-1001 — `GET /api/Deliverys` is reachable without authentication
**Surface**: Public delivery-method catalogue is reachable with no auth header. Currently the `data` exposed is non-sensitive (price/eta), but the API is documented as auth-required and the same un-gated route pattern affects other models (Recycles, Cards, etc.) on default Juice Shop.
**Fix sketch**: Add the standard JWT middleware to the route.

### TC-UI-720 — `/address/select` is reachable without auth
**Surface**: Direct browser navigation to `/#/address/select` does not redirect to login.
**Impact**: Routes intended for the checkout funnel are reachable by unauthenticated traffic. Combined with TC-API-1621 this is a stepping stone for the full BOLA chain.
**Fix sketch**: Wrap the route in an `AuthGuard`.

### TC-API-153 — `PATCH /api/Cards/{id}` returns 500 instead of 405
**Surface**: A method the API doesn't implement crashes the request handler with a stack-trace 5xx instead of a clean 405 Method Not Allowed.
**Impact**: Unhandled-error path returns server internals; trivially weaponised into log-flooding / availability-degradation if the route is callable from an unauthenticated context.
**Fix sketch**: Reject unsupported methods with 405 + `Allow` header at the router layer.

### TC-API-168 — Sending an array as `password` crashes the server (500)
**Surface**: `POST /rest/user/login` with `{ password: [] }` (or any non-string).
**Impact**: Unauthenticated 500 — denial-of-service via malformed body.
**Fix sketch**: Validate request shape with a schema (zod / ajv) before handing to bcrypt.

---

## Medium

### TC-API-1401 — `/rest/captcha` returns the answer alongside the puzzle
**Surface**: The math-captcha endpoint returns `{ captcha: "2-8*1", answer: "-6" }`. A client can solve any captcha trivially by reading the answer field.
**Impact**: Defeats the captcha entirely as a bot deterrent.
**Fix sketch**: Store the answer server-side in a session-bound cache; return only the captcha id and the puzzle.

### TC-API-1503 — `/rest/user/security-question?email=` is an enumeration oracle
**Surface**: GET with a known email returns the security question; with an unknown email it returns an empty body. Trivially enumerates registered users.
**Fix sketch**: Always return the same shape; or rate-limit + require a valid CSRF / captcha.

### TC-API-110 / TC-API-111 / TC-API-112 / TC-API-115 / TC-API-302 — Missing required fields on `POST /api/Cards/` and `POST /api/Users/` are silently accepted
The endpoints persist a row even when `cardNum`, `expMonth`, `expYear`, password, or the entire body is missing. The DB ends up with `null` columns that downstream code does not expect; tests TC-API-150/160/161/162 follow the same pattern (idempotency, type-coercion).
**Fix sketch**: Schema validation at the controller boundary; required-field checks before insert.

---

## Low / UX

These don't immediately hand an attacker a payload, but they paper over deeper validation gaps and are listed so the engineering team has the full picture:

| ID | Behaviour |
|---|---|
| `TC-API-503` | Basket item with `quantity = 0` is accepted. |
| `TC-API-504` | Basket item with `quantity = -1` is accepted. |
| `TC-API-802` | Feedback rating > 5 is accepted. |
| `TC-API-803` | Feedback rating < 1 is accepted. |
| `TC-API-303` | Email field is not validated — `not-an-email` registers a user. |
| `TC-API-150` | Re-posting an identical card creates duplicate rows (no idempotency). |
| `TC-API-160` | `fullName = "   "` is accepted as a valid card name. |
| `TC-API-161` | `fullName = 12345` is silently coerced to the string "12345". |
| `TC-API-162` | `expMonth = "5"` (string) is accepted instead of strictly typed int. |
| `TC-API-166` | Login email is case-sensitive (`UPPER@x.test ≠ upper@x.test`). |
| `TC-API-167` | Login email leading/trailing whitespace is not trimmed. |
| `TC-API-903` | Recycle accepts negative quantity. |
| `TC-API-1611` | Empty-basket checkout still mints an order. |
| `TC-UI-016`  | Whitespace-only cardholder name passes form validation. |
| `TC-UI-711`  | Address selection is reset when navigating back from delivery (UX, not security). |

---

## How to flip the suite to "hardened-build mode"

Each finding is encoded as a passing test that asserts the *current* (vulnerable) behaviour. To run the suite against a hardened build:

1. Run `npm run test:everstage` against the hardened target.
2. The findings listed above will fail — that's the desired signal.
3. Update the assertions to expect the hardened response (e.g. `expect(status).toBe(401)` instead of `200`), or simply delete the `DOCUMENTED VULN:` test if the hardened build closes the gap entirely.

A diff template is intentionally not provided so each engineer can pick the right shape per endpoint.

---

_Generated alongside `docs/test-cases.md`. Re-run `node tools/gen-catalog.js` after adding tests; this doc is hand-curated._
