# Everstage QA Automation — Assignment brief (verbatim)

This page reproduces the brief I received from Everstage exactly as it
was written, so anyone reading this repository can see what was asked
for and judge how the implementation maps back to it.

The implementation walkthrough — including which file satisfies which
line of the brief, the locator-strategy rationale, anticipated
interview questions, and a demo script — lives in
[`INTERVIEW-PREP.md`](./INTERVIEW-PREP.md).

---

> This document contains essential instructions on setting up the codebase and dependencies
> required for the discussion. Please follow the instructions below to ensure you are well prepared.
> By doing so, we can avoid spending time on setup during the pairing exercise.
>
> ## Pre-requisites
>
> Please ensure you have the following set up on your system:
>
> - **Docker:** Install Docker on your system to run the Juice Shop application in a container.
>   Download from the [official website](https://www.docker.com/).
>
> ### Setting up Juice Shop Application
>
> We will be using JuiceShop application during our discussion, please ensure that you have
> JuiceShop application running on your system in a docker container. Run the following to
> download the image and start the container:
>
> `docker run -d -p 3000:3000 bkimminich/juice-shop`
>
> Open your web browser and navigate to http://localhost:3000 to ensure the Juice Shop
> application is up and running.
>
> Please manually register a user in JuiceShop application. We will use this to write our tests
> against.
>
> ### Things we expect to see during our technical discussion
>
> - **Test runs out of the box**: Ensure the test can be executed.
> - **Be prepared to troubleshoot** - Address any issues during test execution confidently.
> - **Communicate your thought process** - We would love to hear your thoughts while you write
>   code.
> - **Follow clean code practices** - Ensure the code has descriptive variables, indentation and
>   modularity.
> - **Locator Strategy** - Please ensure that locators choosen in test are stable and have less
>   possibility to break in future.
>
> **If you have any questions or face any issues during the setup process, please feel free to reach
> out to us. We look forward to have an insightful conversation during our time together.**
>
> ## Scenario to be completed
>
> **Task 1:** Manually create a new user and add their credentials the new-user.json file. Then create a
> login script in the beforeEach hook to login every time a test runs.
>
> **Task 2:** Create a UI test that navigates to My Payments options from homescreen(UI tests) and
> add card details
>
> **Task 3:** Create an API test that adds a unique card details

---

## How the brief maps to this repo

| Brief item | Where it's satisfied |
|---|---|
| `docker run -d -p 3000:3000 bkimminich/juice-shop` | Documented in [`README.md`](../README.md#quick-start). The CI pipelines also pull this exact image. |
| Manually register a user | Done. Credentials saved in [`tests/data/new-user.json`](../tests/data/new-user.json). |
| **Task 1** — login in `beforeEach` | [`tests/helpers/login.ts`](../tests/helpers/login.ts) (the script) and [`tests/ui/task1-login.spec.ts`](../tests/ui/task1-login.spec.ts) (15 tests). Also wrapped as a Playwright fixture in [`tests/fixtures.ts`](../tests/fixtures.ts) for cleaner reuse. |
| **Task 2** — UI add card | [`tests/ui/task2-add-card.spec.ts`](../tests/ui/task2-add-card.spec.ts) (16 tests) backed by the [`PaymentPage`](../tests/pages/PaymentPage.ts) POM. |
| **Task 3** — API add unique card | [`tests/api/task3-add-card.spec.ts`](../tests/api/task3-add-card.spec.ts) (35 tests, every card number generated via [`uniqueCardNumber()`](../tests/helpers/card.ts)). |
| **Test runs out of the box** | `npm install && npx playwright install chromium && npm test` — no env vars required. |
| **Locator strategy** | Anchor on accessible labels / roles + stable IDs, never on auto-generated Material classes. See [`INTERVIEW-PREP.md` § Locator strategy](./INTERVIEW-PREP.md#locator-strategy). |
| **Clean code practices** | POM in `tests/pages/`, helpers in `tests/helpers/`, fixtures in `tests/fixtures.ts`, no duplicated setup. See [`INTERVIEW-PREP.md` § Clean code](./INTERVIEW-PREP.md#clean-code-practices-applied). |
