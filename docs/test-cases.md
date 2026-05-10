# Juice Shop QA — Test Cases Catalog

_Generated from the live test suite (2026-05-10). Single source of truth: re-run `node tools/gen-catalog.js` after adding tests._

## Summary

- **Total: 227 tests** across 31 spec files (101 UI · 126 API)
- **Tagged with `@everstage-qa`: 158** assignment tests
- **Documented vulnerabilities / UX findings**: 33 (asserted as actual Juice Shop behavior — see [Findings](#findings-against-the-default-juice-shop-build))

### Coverage by category (from tags)

| Category | Count | Notes |
|---|---|---|
| @positive | 42 | Happy-path assertions |
| @negative | 51 | Bad input is rejected; errors are surfaced |
| @security | 45 | SQLi, XSS, JWT, IDOR/BOLA, mass-assignment, oversized payloads |
| @boundary | 18 | Values at and just past min/max limits |
| @load | 6 | Concurrent or sequential bursts; no lockouts, no 5xx |

### Coverage by assignment task

| Task | Tag | Count |
|---|---|---|
| Task 1 — Login + beforeEach | `@task1` | 18 |
| Task 2 — UI add card | `@task2` | 23 |
| Task 3 — API add card | `@task3` | 52 |

### Coverage by run bucket

| Bucket | Tag | Count | Use |
|---|---|---|---|
| smoke | `@smoke` | 9 | PR-gate slice — must pass before merge |
| regression | `@regression` | 111 | Full nightly slice |
| e2e | `@e2e` | 14 | End-to-end user journeys |
| functional | `@functional` | 70 | Behavior tests |
| nonfunctional | `@nonfunctional` | 15 | Latency, masking, robustness |

---

## How to read a test row

Each test is identified by a stable `TC-{AREA}-{NUMBER}` id embedded in its Playwright title (e.g. `[TC-API-001] POST /api/Cards/ creates a card with unique details`). The id never changes once shipped — refactors keep the same id so the dashboard can track per-test pass-rate over time.

- **Type** — derived from the test's tags. Order of precedence: Security > Load > Boundary > Negative > Positive.
- **Tags** — Playwright `{ tag: [...] }` values. Multiple per test; lets the same test appear in `@smoke`, `@security`, `@regression`, etc.
- **Documented** — for `DOCUMENTED VULN:` / `DOCUMENTED UX:` rows, the assertion encodes Juice Shop's *actual* (often vulnerable) behavior so the suite stays green on the unsafe build. Flip the assertion when running against a hardened build.

---

## Test cases by feature

### Login — API

_api/login.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-200` | — | POST /rest/user/login returns a token for valid credentials | — |
| `TC-API-201` | — | Login with wrong password returns 401 | — |
| `TC-API-202` | — | Login with non-existent email returns 401 | — |
| `TC-API-203` | — | Login without body fields returns an error | — |
| `TC-API-204` | — | DOCUMENTED VULN: SQL injection in email field bypasses auth on default Juice Shop | — |

### Registration — UI

_ui/register.spec.ts · 7 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-200` | — | User can register with valid data | — |
| `TC-UI-201` | — | Submit is disabled when required fields are empty | — |
| `TC-UI-202` | — | Repeat password mismatch keeps Register disabled | — |
| `TC-UI-203` | — | Malformed email keeps Register disabled | — |
| `TC-UI-204` | — | Password shorter than 5 chars is rejected (form-level) | — |
| `TC-UI-205` | — | Boundary: password length of exactly 5 chars is accepted | — |
| `TC-UI-206` | — | Re-registering an existing email is rejected | — |

### Registration — API

_api/register.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-300` | — | POST /api/Users/ creates a new user with valid input | — |
| `TC-API-301` | — | Re-registering an existing email is rejected | — |
| `TC-API-302` | — | DOCUMENTED VULN: Missing password is accepted on default Juice Shop | — |
| `TC-API-303` | — | DOCUMENTED VULN: Malformed email is accepted on default Juice Shop | — |

### Checkout / Order flow — UI (Bonus)

_ui/order-flow.spec.ts · 9 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-700` | Positive | End-to-end order: basket → address → delivery → payment → place order | `@everstage-qa` `@positive` `@smoke` `@e2e` `@functional` |
| `TC-UI-701` | Positive | Order confirmation surfaces a non-empty order id | `@everstage-qa` `@positive` `@regression` `@e2e` `@functional` |
| `TC-UI-702` | Positive | Placed order shows up in the user's order history | `@everstage-qa` `@positive` `@regression` `@e2e` `@functional` |
| `TC-UI-710` | Negative | Checkout button is unreachable when the basket is empty | `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-711` | Negative | DOCUMENTED UX: address selection is reset when navigating back from delivery | `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-720` | Security | DOCUMENTED VULN: /address/select is reachable without auth on default Juice Shop | `@everstage-qa` `@security` `@regression` |
| `TC-UI-721` | Security | Direct navigation to /order-completion/<random> does not reveal another user's order | `@everstage-qa` `@security` `@regression` |
| `TC-UI-730` | Boundary | Place an order with a high-quantity basket (3 of one item) | `@everstage-qa` `@boundary` `@regression` `@e2e` |
| `TC-UI-740` | Negative | DOCUMENTED UX: Juice Shop inventory depletes across test runs with no replenishment endpoint | `@everstage-qa` `@negative` `@regression` `@functional` |

### Checkout / Order flow — API (Bonus)

_api/order-flow.spec.ts · 14 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1600` | Positive | POST /rest/basket/{bid}/checkout returns an orderConfirmation id | `@everstage-qa` `@positive` `@smoke` `@e2e` `@functional` |
| `TC-API-1601` | Positive | Order is retrievable via /rest/track-order/{id} after checkout | `@everstage-qa` `@positive` `@smoke` `@e2e` `@functional` |
| `TC-API-1602` | Positive | Basket is emptied after a successful checkout | `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-API-1603` | Positive | Multi-item basket places a single order | `@everstage-qa` `@positive` `@regression` `@e2e` `@functional` |
| `TC-API-1610` | Security | Checkout without an auth token is rejected | `@everstage-qa` `@negative` `@security` `@regression` |
| `TC-API-1611` | Negative | DOCUMENTED VULN: empty-basket checkout still mints an order on default Juice Shop | `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-1612` | Negative | Checkout with a non-existent addressId fails cleanly | `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-1613` | Negative | Checkout with a non-existent deliveryMethodId fails cleanly | `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-1620` | Security | Tampered JWT cannot place an order | `@everstage-qa` `@security` `@regression` |
| `TC-API-1621` | Security | DOCUMENTED VULN: another user can checkout the assignment user's basket (BOLA) | `@everstage-qa` `@security` `@regression` |
| `TC-API-1622` | Security | SQL-injection in couponData does not bypass coupon validation | `@everstage-qa` `@security` `@regression` |
| `TC-API-1630` | Boundary | Checkout with the maximum-eta delivery method is accepted | `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-1640` | Load | 5 sequential orders all succeed and produce distinct order ids | `@everstage-qa` `@load` `@nonfunctional` `@regression` |
| `TC-API-1641` | — | Single checkout latency under 3000ms | `@everstage-qa` `@nonfunctional` `@regression` |

### Search — UI

_ui/search.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-400` | — | Searching "apple" returns at least one product | — |
| `TC-UI-401` | — | Search returns the empty-state message for a nonsense query | — |
| `TC-UI-402` | — | Empty search shows the full catalog | — |
| `TC-UI-403` | — | XSS payload in search is rendered as text, not executed | — |
| `TC-UI-404` | — | Long search term (200 chars) is handled without crash | — |

### Products & Search — API

_api/products.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-400` | — | GET /api/Products returns the catalog | — |
| `TC-API-401` | — | GET /api/Products/{id} returns a product | — |
| `TC-API-402` | — | GET /api/Products/{nonexistent} returns 404 or empty | — |
| `TC-API-403` | — | GET /rest/products/search returns matches for a real product | — |
| `TC-API-404` | — | Search endpoint UNION SQLi probe — should not leak schema | — |

### Basket / Cart — UI

_ui/basket.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-500` | — | Add a product to the basket from search | — |
| `TC-UI-501` | — | Adding the same product twice increases its basket quantity | — |
| `TC-UI-502` | — | Increment and decrement basket item updates quantity | — |
| `TC-UI-503` | — | Removing the only basket item leaves the basket empty | — |
| `TC-UI-504` | — | Empty basket — checkout button is observed (Juice Shop UX finding) | — |

### Basket / Cart — API

_api/basket.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-500` | — | GET /rest/basket/{id} returns the user's basket | — |
| `TC-API-501` | — | POST /api/BasketItems adds an item | — |
| `TC-API-502` | — | Adding a basket item without auth returns 401 | — |
| `TC-API-503` | — | DOCUMENTED VULN: zero-quantity basket item is accepted | — |
| `TC-API-504` | — | DOCUMENTED VULN: negative-quantity basket item is accepted | — |

### Address book — UI

_ui/address.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-600` | — | User can create a new address with valid input | — |
| `TC-UI-601` | — | Submit is disabled until all required fields are filled | — |
| `TC-UI-602` | — | Mobile number is enforced to numeric / sane length | — |
| `TC-UI-603` | — | Mobile number rejects non-numeric input | — |
| `TC-UI-604` | — | ZIP code accepts long input without client-side truncation | — |

### Address book — API

_api/address.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-600` | — | POST /api/Addresss creates an address | — |
| `TC-API-601` | — | GET /api/Addresss returns the user addresses | — |
| `TC-API-602` | — | DELETE /api/Addresss/{id} removes the address | — |
| `TC-API-603` | — | Address creation without token is rejected | — |
| `TC-API-604` | — | Boundary: ZIP code longer than 8 chars is rejected | — |

### Change password — UI

_ui/change-password.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-800` | — | User can change password with valid input | — |
| `TC-UI-801` | — | Wrong current password is rejected | — |
| `TC-UI-802` | — | New / repeat mismatch keeps the Change button disabled | — |
| `TC-UI-803` | — | Submit disabled while any field is empty | — |

### Forgot password — UI

_ui/forgot-password.spec.ts · 2 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-1200` | — | User can reset password with correct security answer | — |
| `TC-UI-1201` | — | Reset is rejected when security answer is wrong | — |

### Customer feedback — UI

_ui/contact.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-900` | — | User can submit feedback with comment, rating, and captcha | — |
| `TC-UI-901` | — | Comment max length is enforced at 160 chars | — |
| `TC-UI-902` | — | Submit disabled when no rating is selected | — |
| `TC-UI-903` | — | Wrong captcha answer is rejected | — |

### Customer feedback — API

_api/feedback.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-800` | — | POST /api/Feedbacks creates feedback with valid captcha | — |
| `TC-API-801` | — | Wrong captcha answer is rejected | — |
| `TC-API-802` | — | DOCUMENTED VULN: rating above 5 is accepted | — |
| `TC-API-803` | — | DOCUMENTED VULN: rating below 1 is accepted | — |

### Product details & reviews — UI

_ui/product-reviews.spec.ts · 3 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-1000` | — | Clicking a product opens the detail dialog | — |
| `TC-UI-1001` | — | Logged-in user can submit a review | — |
| `TC-UI-1002` | — | Closing the product dialog returns to the catalog | — |

### Site navigation & UX — UI

_ui/navigation.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-1100` | — | Landing page renders header, search, and product list | — |
| `TC-UI-1101` | — | About Us page is reachable from the side menu | — |
| `TC-UI-1102` | — | Language picker exposes multiple languages | — |
| `TC-UI-1103` | — | Score Board page is reachable directly via /#/score-board | — |

### Profile & order history — UI

_ui/account-areas.spec.ts · 2 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-1300` | — | Profile page is reachable for logged-in users | — |
| `TC-UI-1400` | — | Order history is reachable for logged-in users | — |

### Account-area pages reachability — UI

_ui/extra-pages.spec.ts · 10 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-1500` | Positive | Wallet page renders the current balance | `@everstage-qa` `@positive` |
| `TC-UI-1501` | Positive | Last login IP page is reachable | `@everstage-qa` `@positive` |
| `TC-UI-1502` | Positive | Privacy & Security menu route loads without redirect | `@everstage-qa` `@positive` |
| `TC-UI-1503` | Positive | Two-factor authentication setup page is reachable | `@everstage-qa` `@positive` |
| `TC-UI-1504` | Positive | Data-export page is reachable | `@everstage-qa` `@positive` |
| `TC-UI-1505` | Positive | Complain page is reachable for logged-in users | `@everstage-qa` `@positive` |
| `TC-UI-1600` | Positive | Privacy policy page is reachable without login | `@everstage-qa` `@positive` |
| `TC-UI-1601` | Positive | Photo wall page is reachable without login | `@everstage-qa` `@positive` |
| `TC-UI-1602` | Positive | Track-result lookup page is reachable | `@everstage-qa` `@positive` |
| `TC-UI-1603` | Negative | 403 error page renders the error layout | `@everstage-qa` `@negative` |

### Wallet — API

_api/wallet.spec.ts · 3 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-700` | Positive | GET /rest/wallet/balance returns the user balance | `@everstage-qa` `@positive` |
| `TC-API-701` | Security | GET /rest/wallet/balance without auth is rejected | `@everstage-qa` `@security` |
| `TC-API-702` | Security | GET /rest/wallet/balance with tampered JWT is rejected | `@everstage-qa` `@security` |

### Recycle requests — API

_api/recycle.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-900` | Positive | POST /api/Recycles creates a recycle request | `@everstage-qa` `@positive` |
| `TC-API-901` | Security | DOCUMENTED VULN: Recycle request is created with UserId=null | `@everstage-qa` `@security` |
| `TC-API-902` | Security | Recycle request without auth token is rejected | `@everstage-qa` `@security` |
| `TC-API-903` | Negative | DOCUMENTED VULN: Recycle accepts negative quantity | `@everstage-qa` `@negative` |
| `TC-API-904` | Security | DOCUMENTED VULN: GET /api/Recycles/{id} returns ALL recycles, not just the requested id | `@everstage-qa` `@security` |

### Delivery methods — API

_api/deliveries.spec.ts · 2 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1000` | Positive | GET /api/Deliverys returns the catalog of delivery methods | `@everstage-qa` `@positive` |
| `TC-API-1001` | Security | DOCUMENTED VULN: GET /api/Deliverys is reachable without authentication | `@everstage-qa` `@security` |

### Track order — API

_api/track-order.spec.ts · 3 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1100` | Positive | GET /rest/track-order/{id} returns a tracking record | `@everstage-qa` `@positive` |
| `TC-API-1101` | Negative | GET /rest/track-order/{nonexistent} still returns 200 with empty data | `@everstage-qa` `@negative` |
| `TC-API-1102` | Security | Track-order id with traversal characters does not crash the server | `@everstage-qa` `@security` |

### Two-factor authentication — API

_api/two-factor.spec.ts · 3 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1200` | Positive | GET /rest/2fa/status returns setup state for the user | `@everstage-qa` `@positive` |
| `TC-API-1201` | Security | POST /rest/2fa/setup with a tampered initialToken is rejected | `@everstage-qa` `@security` |
| `TC-API-1202` | Security | GET /rest/2fa/status without a token is rejected | `@everstage-qa` `@security` |

### Customer complaints — API

_api/complaint.spec.ts · 5 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1300` | Positive | POST /api/Complaints creates a complaint | `@everstage-qa` `@positive` |
| `TC-API-1301` | Security | DOCUMENTED VULN: Complaint stored with UserId=null | `@everstage-qa` `@security` |
| `TC-API-1302` | Positive | GET /api/Complaints returns a list | `@everstage-qa` `@positive` |
| `TC-API-1303` | Security | Complaint without auth token is rejected | `@everstage-qa` `@security` |
| `TC-API-1304` | Security | XSS payload in complaint message is stored as a literal string | `@everstage-qa` `@security` |

### Captcha endpoints — API

_api/captcha.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1400` | Positive | GET /rest/captcha returns a math captcha and answer pair | `@everstage-qa` `@positive` |
| `TC-API-1401` | Security | DOCUMENTED VULN: /rest/captcha leaks the correct answer in the response | `@everstage-qa` `@security` |
| `TC-API-1402` | Positive | GET /rest/image-captcha returns an SVG payload (authenticated) | `@everstage-qa` `@positive` |
| `TC-API-1403` | Security | GET /rest/image-captcha without auth is rejected | `@everstage-qa` `@security` |

### User identity & lookup — API

_api/whoami.spec.ts · 4 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-1500` | Positive | GET /rest/user/whoami returns the current user when authenticated via cookie | `@everstage-qa` `@positive` |
| `TC-API-1501` | Security | GET /rest/user/whoami without a token returns an empty user | `@everstage-qa` `@security` |
| `TC-API-1502` | Positive | GET /rest/user/security-question returns the question for a known email | `@everstage-qa` `@positive` |
| `TC-API-1503` | Security | DOCUMENTED VULN: security-question endpoint is an enumeration oracle | `@everstage-qa` `@security` |

### api/task3-add-card.spec.ts

_api/task3-add-card.spec.ts · 55 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-API-001` | Positive | POST /api/Cards/ creates a card with unique details | `@task3` `@everstage-qa` `@positive` `@smoke` `@e2e` `@functional` |
| `TC-API-002` | Positive | GET /api/Cards/ returns the newly created card in the list | `@task3` `@everstage-qa` `@positive` `@smoke` `@functional` |
| `TC-API-003` | Positive | DELETE /api/Cards/{id} removes the card from the list | `@task3` `@everstage-qa` `@positive` `@regression` `@functional` `@e2e` |
| `TC-API-004` | Security | GET /api/Cards/ list response masks the full card number (last 4 digits visible) | `@task3` `@everstage-qa` `@positive` `@regression` `@security` `@functional` |
| `TC-API-005` | Positive | Add card with maximum allowed expYear (2099) | `@task3` `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-API-006` | Positive | GET /api/Cards/{id} returns the requested card | `@task3` `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-API-101` | Negative | Reject card with expYear below allowed minimum | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-102` | Negative | Reject card with expMonth above maximum | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-103` | Security | Reject add-card request without auth token | `@task3` `@everstage-qa` `@negative` `@security` `@regression` |
| `TC-API-104` | Negative | Reject card with expMonth below minimum (0) | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-105` | Boundary | Reject card at expYear boundary just below minimum (2079) | `@task3` `@everstage-qa` `@negative` `@boundary` `@regression` `@functional` |
| `TC-API-106` | Security | Reject add-card request with invalid bearer token | `@task3` `@everstage-qa` `@negative` `@security` `@regression` |
| `TC-API-110` | Negative | DOCUMENTED VULN: Missing cardNum is accepted on default Juice Shop | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-111` | Negative | DOCUMENTED VULN: Missing expMonth is accepted on default Juice Shop | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-112` | Negative | DOCUMENTED VULN: Missing expYear is accepted on default Juice Shop | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-113` | Negative | Reject card with non-numeric expMonth string | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-114` | Boundary | Reject card with negative expMonth | `@task3` `@everstage-qa` `@negative` `@boundary` `@regression` `@functional` |
| `TC-API-115` | Negative | DOCUMENTED VULN: POST with an empty body is accepted on default Juice Shop | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-116` | Negative | POST with malformed JSON body is rejected | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-117` | Security | POST with cardNum containing non-digit characters is normalized or rejected | `@task3` `@everstage-qa` `@negative` `@regression` `@security` |
| `TC-API-118` | Boundary | POST with very short cardNum (4 digits) is rejected | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-119` | Boundary | POST with very long cardNum (32 digits) is rejected | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-120` | Security | SQL-injection payload in fullName is stored as a literal string | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-121` | Security | XSS payload in fullName is stored verbatim and not interpreted server-side | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-122` | Security | Cannot create a card on another userId via mass-assignment | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-123` | Security | Tampered JWT signature is rejected | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-124` | Security | Oversized fullName payload (10KB) does not crash the server | `@task3` `@everstage-qa` `@security` `@nonfunctional` `@regression` |
| `TC-API-125` | Security | Another user cannot read or delete this user's cards (IDOR probe) | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-126` | Negative | DELETE a non-existent card id is handled cleanly | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-127` | Security | PUT /api/Cards/{id} must not silently mutate a stored card | `@task3` `@everstage-qa` `@negative` `@security` `@regression` |
| `TC-API-128` | Security | POST with extra unknown fields ignores them (no mass-assignment) | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-130` | Boundary | expMonth=1 (lower valid bound) is accepted | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-131` | Boundary | expMonth=12 (upper valid bound) is accepted | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-132` | Boundary | expYear=2080 (lower valid bound) is accepted | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-133` | Boundary | expYear=2100 (just past upper bound) is rejected | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-134` | Boundary | cardNum at 16-digit standard length is accepted | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-140` | Load | 10 cards created concurrently all return 201 | `@task3` `@everstage-qa` `@load` `@nonfunctional` `@regression` |
| `TC-API-141` | Load | 25 cards created sequentially all return 201 | `@task3` `@everstage-qa` `@load` `@nonfunctional` `@regression` |
| `TC-API-142` | — | Single add-card P95 latency under 1500ms across 10 sequential calls | `@task3` `@everstage-qa` `@nonfunctional` `@regression` |
| `TC-API-150` | Negative | DOCUMENTED VULN: re-posting an identical card is accepted (no idempotency / no de-dup) | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-151` | Security | Concurrent identical-card POSTs do not crash the server | `@task3` `@everstage-qa` `@load` `@security` `@regression` |
| `TC-API-152` | Positive | Response shape is JSON-schema-stable (id, fullName, expMonth, expYear, cardNum) | `@task3` `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-API-153` | Security | DOCUMENTED VULN: PATCH on /api/Cards/{id} crashes with 500 instead of returning 405 | `@task3` `@everstage-qa` `@negative` `@security` `@regression` `@functional` |
| `TC-API-154` | Negative | POST with text/plain Content-Type is rejected with 4xx | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-155` | Boundary | cardholderName with Unicode (हिंदी, 中文, emoji) is stored verbatim | `@task3` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-API-156` | Positive | Cross-layer: card created via API is visible to a fresh authenticated session | `@task3` `@everstage-qa` `@positive` `@e2e` `@regression` `@functional` |
| `TC-API-160` | Negative | DOCUMENTED VULN: whitespace-only fullName is accepted as a valid name | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-161` | Negative | DOCUMENTED VULN: numeric fullName (12345) is coerced to a string and accepted | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-162` | Negative | DOCUMENTED VULN: string expMonth ("5") is accepted instead of strictly typed int | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-163` | Negative | expMonth=5.7 (float) is rejected by the isInt validator | `@task3` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-164` | Security | GET /api/Cards/{nonexistent-id} returns 400 "Malicious activity detected" instead of 404 | `@task3` `@everstage-qa` `@negative` `@security` `@regression` |
| `TC-API-165` | Security | GOOD: cross-user GET /api/Cards/{id} is blocked by the IDOR-detection middleware | `@task3` `@everstage-qa` `@security` `@regression` |
| `TC-API-166` | Negative | DOCUMENTED VULN: login email is case-sensitive (UPPER@x.test ≠ upper@x.test) | `@x.test` `@x.test)` `@task1` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-167` | Negative | DOCUMENTED VULN: login email leading/trailing whitespace is not trimmed | `@task1` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-API-168` | Security | DOCUMENTED VULN: array as password crashes the server with 500 | `@task1` `@everstage-qa` `@negative` `@security` `@regression` |

### ui/accessibility.spec.ts

_ui/accessibility.spec.ts · 3 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `` | — | [TC-UI-A11Y-100] Landing page has no new serious/critical axe violations | `@everstage-qa` `@nonfunctional` `@regression` |
| `` | — | [TC-UI-A11Y-101] Login page has no new serious/critical axe violations | `@everstage-qa` `@nonfunctional` `@regression` |
| `` | — | [TC-UI-A11Y-102] Saved-payment-methods page has no new serious/critical axe violations | `@everstage-qa` `@nonfunctional` `@regression` |

### ui/task1-login.spec.ts

_ui/task1-login.spec.ts · 15 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-100` | Positive | beforeEach login lands on a logged-in homepage | `@task1` `@everstage-qa` `@positive` `@smoke` `@e2e` |
| `TC-UI-101` | Positive | Logged-in user can open the account menu and see the email | `@task1` `@everstage-qa` `@positive` `@smoke` `@regression` |
| `TC-UI-102` | — | /rest/user/whoami responds with the authenticated user after beforeEach login | `@task1` `@everstage-qa` `@functional` `@regression` |
| `TC-UI-103` | Positive | Logout returns to a logged-out state | `@task1` `@everstage-qa` `@positive` `@regression` `@e2e` |
| `TC-UI-110` | Negative | Login button is disabled while either field is empty | `@task1` `@everstage-qa` `@negative` `@regression` |
| `TC-UI-111` | Negative | Login fails with a wrong password | `@task1` `@everstage-qa` `@negative` `@regression` |
| `TC-UI-112` | Negative | Login fails for an unregistered email | `@task1` `@everstage-qa` `@negative` `@regression` |
| `TC-UI-113` | Negative | Whitespace-only credentials are rejected | `@task1` `@everstage-qa` `@negative` `@regression` |
| `TC-UI-114` | Negative | Password case mismatch is rejected | `@task1` `@everstage-qa` `@negative` `@regression` |
| `TC-UI-120` | Security | DOCUMENTED VULN: SQL-injection email comment bypass logs in on default Juice Shop | `@task1` `@everstage-qa` `@security` `@regression` |
| `TC-UI-121` | Security | XSS payload in email field is not executed | `@task1` `@everstage-qa` `@security` `@regression` |
| `TC-UI-122` | Security | Error message does not disclose whether the email exists | `@task1` `@everstage-qa` `@security` `@regression` |
| `TC-UI-130` | Boundary | Very long email input is handled without crashing | `@task1` `@everstage-qa` `@boundary` `@nonfunctional` `@regression` |
| `TC-UI-131` | Boundary | Very long password input is handled without crashing | `@task1` `@everstage-qa` `@boundary` `@nonfunctional` `@regression` |
| `TC-UI-140` | Load | Load: 5 sequential failed logins in <10s do not lock or 5xx | `@task1` `@everstage-qa` `@load` `@nonfunctional` `@regression` |

### ui/task2-add-card.spec.ts

_ui/task2-add-card.spec.ts · 23 tests_

| ID | Type | Title | Tags |
|---|---|---|---|
| `TC-UI-001` | Positive | User can add card details from My Payment Options | `@task2` `@everstage-qa` `@positive` `@smoke` `@e2e` `@functional` |
| `TC-UI-002` | Negative | Submit button is disabled when the add-card form is empty | `@task2` `@everstage-qa` `@negative` `@functional` `@regression` |
| `TC-UI-003` | Positive | Adding multiple cards in sequence lists each one | `@task2` `@everstage-qa` `@positive` `@regression` `@e2e` `@functional` |
| `TC-UI-004` | — | My Payment Options menu item navigates to /saved-payment-methods | `@task2` `@everstage-qa` `@smoke` `@functional` |
| `TC-UI-005` | Positive | Saved card persists across a full page reload | `@task2` `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-UI-006` | Positive | Saved card row exposes the cardholder name and the last 4 digits | `@task2` `@everstage-qa` `@positive` `@regression` `@functional` |
| `TC-UI-010` | Negative | Submit stays disabled when only the name is filled | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-011` | Negative | Submit stays disabled when card number is missing | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-012` | Negative | Non-digit keystrokes are filtered by the Card Number field | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-013` | Negative | Submit stays disabled when only month is selected | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-014` | Negative | Submit stays disabled when only the year is selected | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-015` | Negative | Empty-string cardholder name is not enough to enable Submit | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-016` | Negative | DOCUMENTED UX: whitespace-only cardholder name passes form validation | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-017` | Negative | Submit is briefly disabled during in-flight save (no double-submit) | `@task2` `@everstage-qa` `@negative` `@regression` `@functional` |
| `TC-UI-020` | Security | XSS payload in cardholder name is rendered as text, not script | `@task2` `@everstage-qa` `@security` `@regression` |
| `TC-UI-021` | Security | SQL-injection style cardholder name is treated as a literal string | `@task2` `@everstage-qa` `@security` `@regression` |
| `TC-UI-022` | Security | Card list masks the card number (only last 4 digits visible) | `@task2` `@everstage-qa` `@security` `@regression` `@nonfunctional` |
| `TC-UI-030` | Boundary | Card with minimum allowed expiry year (2080) is accepted | `@task2` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-UI-031` | Boundary | Card with maximum offered expiry year (2099) is accepted | `@task2` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-UI-032` | Boundary | Cardholder name at long boundary (200 chars) is accepted | `@task2` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-UI-033` | Boundary | Unicode characters in cardholder name are accepted and rendered | `@task2` `@everstage-qa` `@boundary` `@regression` `@functional` |
| `TC-UI-040` | Load | Adding 5 cards in rapid succession all succeed and are listed | `@task2` `@everstage-qa` `@load` `@nonfunctional` `@regression` |
| `TC-UI-041` | — | Add-card round-trip from menu click to confirmation completes under 15s | `@task2` `@everstage-qa` `@nonfunctional` `@regression` |

---

## Findings against the default Juice Shop build

These tests are written so they **pass on the default vulnerable Juice Shop**. They document a behavior gap; on a hardened build the assertion flips. They are tagged appropriately so they appear in `@security` / `@negative` slices.

| ID | Finding | Severity hint | Spec |
|---|---|---|---|
| `TC-API-1001` | GET /api/Deliverys is reachable without authentication | High | `api/deliveries.spec.ts` |
| `TC-API-110` | Missing cardNum is accepted on default Juice Shop | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-111` | Missing expMonth is accepted on default Juice Shop | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-112` | Missing expYear is accepted on default Juice Shop | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-115` | POST with an empty body is accepted on default Juice Shop | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-1301` | Complaint stored with UserId=null | High | `api/complaint.spec.ts` |
| `TC-API-1401` | /rest/captcha leaks the correct answer in the response | Medium | `api/captcha.spec.ts` |
| `TC-API-150` | re-posting an identical card is accepted (no idempotency / no de-dup) | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-1503` | security-question endpoint is an enumeration oracle | Medium | `api/whoami.spec.ts` |
| `TC-API-153` | PATCH on /api/Cards/{id} crashes with 500 instead of returning 405 | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-160` | whitespace-only fullName is accepted as a valid name | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-161` | numeric fullName (12345) is coerced to a string and accepted | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-1611` | empty-basket checkout still mints an order on default Juice Shop | Low / UX | `api/order-flow.spec.ts` |
| `TC-API-162` | string expMonth ("5") is accepted instead of strictly typed int | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-1621` | another user can checkout the assignment user's basket (BOLA) | High | `api/order-flow.spec.ts` |
| `TC-API-166` | login email is case-sensitive (UPPER@x.test ≠ upper@x.test) | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-167` | login email leading/trailing whitespace is not trimmed | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-168` | array as password crashes the server with 500 | Low / UX | `api/task3-add-card.spec.ts` |
| `TC-API-204` | SQL injection in email field bypasses auth on default Juice Shop | High | `api/login.spec.ts` |
| `TC-API-302` | Missing password is accepted on default Juice Shop | Low / UX | `api/register.spec.ts` |
| `TC-API-303` | Malformed email is accepted on default Juice Shop | Low / UX | `api/register.spec.ts` |
| `TC-API-503` | zero-quantity basket item is accepted | Low / UX | `api/basket.spec.ts` |
| `TC-API-504` | negative-quantity basket item is accepted | Low / UX | `api/basket.spec.ts` |
| `TC-API-802` | rating above 5 is accepted | Low / UX | `api/feedback.spec.ts` |
| `TC-API-803` | rating below 1 is accepted | Low / UX | `api/feedback.spec.ts` |
| `TC-API-901` | Recycle request is created with UserId=null | High | `api/recycle.spec.ts` |
| `TC-API-903` | Recycle accepts negative quantity | Low / UX | `api/recycle.spec.ts` |
| `TC-API-904` | GET /api/Recycles/{id} returns ALL recycles, not just the requested id | Low / UX | `api/recycle.spec.ts` |
| `TC-UI-016` | whitespace-only cardholder name passes form validation | Low / UX | `ui/task2-add-card.spec.ts` |
| `TC-UI-120` | SQL-injection email comment bypass logs in on default Juice Shop | High | `ui/task1-login.spec.ts` |
| `TC-UI-711` | address selection is reset when navigating back from delivery | Low / UX | `ui/order-flow.spec.ts` |
| `TC-UI-720` | /address/select is reachable without auth on default Juice Shop | High | `ui/order-flow.spec.ts` |
| `TC-UI-740` | Juice Shop inventory depletes across test runs with no replenishment endpoint | Low / UX | `ui/order-flow.spec.ts` |

---

## Reproducing this catalog

```bash
# Re-export the test list and regenerate this doc
npx playwright test --list --reporter=json > /tmp/pw-list.json
node tools/gen-catalog.js > docs/test-cases.md
```
