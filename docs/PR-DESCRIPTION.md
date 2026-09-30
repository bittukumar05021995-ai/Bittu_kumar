# PR Description — Subscription & Billing SDET Solution

## Test strategy
This submission validates the service at API, state-machine, persistence, webhook, provider-integration, and end-to-end workflow levels. The production service was not supplied, so a deliberately small TypeScript/Express fixture is included only to make the automation executable and demonstrate test architecture.

## Real vs mocked
The HTTP layer, business rules, state machine, HMAC verification, and in-memory persistence are real. The external payment provider is replaced by a configurable fake that records call count and arguments and can return success, decline, or timeout.

## OOP / design patterns
- **State Machine** — `SubscriptionStateMachine` owns legal lifecycle transitions and blocks invalid transitions.
- **Builder** — `SubscriptionRequestBuilder` and `WebhookBuilder` make scenario data readable and reusable.
- **Adapter / Dependency Injection** — `PaymentProvider` is an interface; `FakePaymentProvider` is injected into the service.
- **Factory** — `TestContextFactory` creates a fresh DB, provider, signer, service and API client for each test, keeping tests isolated.

## API validation
Tests cover creation, retrieval support, cancellation, validation failures, response codes, payloads, signed webhooks, malformed payloads, and webhook amount/currency validation.

## Database / persistence validation
Tests validate `subscriptions`, `invoices`, `webhook_events` (represented by `PaymentEventRecord`), and audit history. The suite proves persisted state agrees with the externally visible subscription state and that duplicate webhook delivery does not create duplicate invoices.

## Webhook / provider validation
The suite covers valid signatures, invalid signatures, duplicate event IDs, out-of-order success/failure delivery, cancellation immutability, refund recording, and failure delivery. Provider tests assert amount, customer, payment method, idempotency key behavior, call count, and decline/timeout outcomes.

## Maintainability
Tests describe business intent while API details, data construction, state transitions, provider behavior, and environment setup live in separate classes/modules. Each test receives a new isolated context.

## Assumptions / tradeoffs
The assignment permits an in-memory or embedded persistence layer, so in-memory repositories are used to avoid setup friction. A production implementation should run the same suite against a containerized/embedded DB and the real schema. Concurrent webhook races are intentionally left as bonus work.

## Responsible AI usage
AI tools were used to accelerate scaffolding and review prompts. The final test scenarios, transition rules, assertions, architecture decisions, assumptions, and tradeoffs were reviewed against the assignment requirements and should be re-validated by the submitting candidate before opening the PR.
