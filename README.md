# Subscription & Billing Service — SDET Assignment

This repository contains a small object-oriented TypeScript test solution plus a minimal service fixture because no existing service implementation was supplied.

## Stack
- TypeScript / Node.js
- Vitest
- Express
- Supertest
- Zod
- In-memory persistence

## Structure

```text
src/
  domain/        state machine + domain models
  ports/         repository/provider interfaces
  adapters/      in-memory DB + fake payment provider
  builders/      test-data builders
  app/           billing service, HTTP API, webhook signer

tests/
  api/           CRUD/validation/cancellation
  state/         transition rules
  webhooks/      signatures/idempotency/out-of-order
  persistence/   DB + provider interaction
  fixtures/      isolated test setup + typed API client

docs/
  TEST-STRATEGY.md
```

## Run

```bash
npm install
npm test
npm run typecheck
npm run test:coverage
```

## What the tests prove
- Correct subscription creation and cancellation.
- Valid lifecycle transitions and blocked invalid transitions.
- Provider calls have the correct amount/customer/payment method and happen once per real charge.
- Provider decline/timeout moves immediate-charge subscriptions to `past_due` and records a failed invoice.
- Webhook signature verification and malformed-payload handling.
- Duplicate webhook delivery is idempotent.
- A canceled subscription is not reactivated by a later success webhook.
- A late failure webhook cannot regress an already-active subscription.
- Persisted subscription and invoice state matches API-visible outcomes.

## PR
The assignment asks for a Pull Request containing code, persistence/seed instructions, run instructions, test strategy, assumptions/tradeoffs, and responsible AI usage.

Suggested branch:

```bash
git checkout -b feature/subscription-billing-sdet-solution
```

After creating the remote repository:

```bash
git add .
git commit -m "Add subscription billing SDET automation solution"
git push -u origin feature/subscription-billing-sdet-solution
```

Then open a Pull Request from the pushed branch to the required default branch.

## Responsible AI usage
AI tools were used for drafting scaffolding and accelerating implementation. The final test logic, state-transition rules, assertions, assumptions, and tradeoffs should be reviewed and validated by the candidate before submission.
