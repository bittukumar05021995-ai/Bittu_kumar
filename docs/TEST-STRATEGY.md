# Subscription & Billing Service — Test Strategy

## 1. Assumptions
- No production service was provided, so this submission uses a minimal TypeScript/Express service fixture.
- Persistence is an in-memory repository that models queryable `subscriptions`, `invoices`, `webhook_events`, and audit history.
- The payment provider is external and is represented only through a `PaymentProvider` interface plus a configurable fake.
- Basic has a 7-day trial; Pro charges immediately at $49.00.

## 2. Scope
- API request/response validation for create, retrieve, cancel, and webhook handling.
- Subscription lifecycle/state-machine validation.
- DB/persistence consistency and absence of duplicate side effects.
- Payment provider interaction and failure simulation.
- Webhook signatures, malformed payloads, idempotency, cancellation immutability, and out-of-order delivery.

## 3. Real vs mocked
- Real: test HTTP layer, service/business logic, repositories used as an in-memory persistence substitute, HMAC signing/verification.
- Mocked: payment provider; no real external network call is made.

## 4. Design patterns
- State Machine: `SubscriptionStateMachine` owns legal transitions and blocks impossible moves.
- Builder: `SubscriptionRequestBuilder`, `WebhookBuilder`, and `CustomerBuilder` keep scenarios intention-focused.
- Dependency Injection / Adapter seam: `PaymentProvider` interface allows `FakePaymentProvider` substitution.
- Factory: `TestContextFactory` builds an isolated database/provider/service/API stack for each test, preventing shared state and setup duplication.

## 5. Key invariants
- A subscription cannot move out of `canceled`.
- An active subscription is not regressed by a late `payment.failed` event.
- Duplicate `event_id` is a no-op and never triggers a provider call.
- Provider receives exactly one call per genuine charge attempt.
- Persisted invoice status matches the payment outcome.
- API-visible subscription state matches persisted state.

## 6. Known limitations / tradeoffs
- In-memory storage is used to keep setup deterministic and self-contained; a production suite should use a containerized/embedded DB against the actual schema.
- Concurrency/racing webhook processing is not covered; it is explicitly bonus scope in the assignment.
- The fixture is intentionally small and does not model taxation, multi-currency, proration, or notification side effects.

## 7. Red / Blue / Green workflow used
1. Red: identify an invariant and write a failing test.
2. Blue: add the smallest implementation/fixture change to satisfy it.
3. Green: refactor into state machine, builders, provider seam, and repositories while keeping tests passing.
