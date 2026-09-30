import { describe, expect, it } from 'vitest';
import { createTestContext } from '../fixtures/testContext.js';
import { SubscriptionRequestBuilder, WebhookBuilder } from '../../src/builders/testDataBuilder.js';

describe('Webhook processing', () => {
  it('processes the same event_id twice but applies the transition once', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'open' as const };
    ctx.db.saveInvoice(invoice);

    const body = new WebhookBuilder()
      .withEventId('evt_duplicate_001')
      .withSubscriptionId(subId)
      .withInvoiceId(invoice.id)
      .withAmount(1900)
      .withType('payment.succeeded')
      .build();
    const raw = JSON.stringify(body);
    const signature = ctx.signer.sign(raw);

    const first = await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', signature).send(body);
    const second = await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', signature).send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(ctx.db.findPaymentEventsBySubscription(subId)).toHaveLength(2);
    expect(ctx.db.findPaymentEventsBySubscription(subId)[0].type).toBe('payment.succeeded');
    expect(ctx.db.findPaymentEventsBySubscription(subId)[0].duplicate).toBe(false);
    expect(ctx.db.findPaymentEventsBySubscription(subId)[1].duplicate).toBe(true);
    expect(ctx.db.findPaymentEventsBySubscription(subId)[0].subscriptionId).toBe(subId);
    expect(ctx.service.getSubscription(subId)?.status).toBe('active');
  });


  it('moves a trialing subscription to past_due on a payment.failed webhook', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'open' as const };
    ctx.db.saveInvoice(invoice);

    const body = new WebhookBuilder()
      .withEventId('evt_failed_first')
      .withType('payment.failed')
      .withSubscriptionId(subId)
      .withInvoiceId(invoice.id)
      .withAmount(1900)
      .build();
    const raw = JSON.stringify(body);

    const response = await ctx.api.post('/webhooks/payment-provider')
      .set('X-Provider-Signature', ctx.signer.sign(raw))
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe('past_due');
    expect(ctx.db.findInvoicesBySubscription(subId)[0].status).toBe('failed');
  });

  it('does not reactivate a canceled subscription from a success webhook', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    await ctx.api.post(`/subscriptions/${subId}/cancel`);

    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'open' as const };
    ctx.db.saveInvoice(invoice);
    const body = new WebhookBuilder().withSubscriptionId(subId).withInvoiceId(invoice.id).withAmount(1900).build();
    const raw = JSON.stringify(body);

    const response = await ctx.api.post('/webhooks/payment-provider')
      .set('X-Provider-Signature', ctx.signer.sign(raw))
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe('canceled');
  });

  it('prevents an out-of-order failed event from regressing an active subscription', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'open' as const };
    ctx.db.saveInvoice(invoice);

    const success = new WebhookBuilder().withEventId('evt_success').withSubscriptionId(subId).withInvoiceId(invoice.id).withAmount(1900).withType('payment.succeeded').build();
    const successRaw = JSON.stringify(success);
    expect((await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', ctx.signer.sign(successRaw)).send(success)).status).toBe(200);

    const failed = new WebhookBuilder().withEventId('evt_failed_late').withSubscriptionId(subId).withInvoiceId(invoice.id).withAmount(1900).withType('payment.failed').build();
    const failedRaw = JSON.stringify(failed);
    const failedResponse = await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', ctx.signer.sign(failedRaw)).send(failed);

    expect(failedResponse.status).toBe(200);
    expect(failedResponse.body.subscription.status).toBe('active');
  });



  it('records a refund without inventing a state transition', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'paid' as const };
    ctx.db.saveInvoice(invoice);

    const body = new WebhookBuilder()
      .withEventId('evt_refund')
      .withType('payment.refunded')
      .withSubscriptionId(subId)
      .withInvoiceId(invoice.id)
      .withAmount(1900)
      .build();
    const raw = JSON.stringify(body);

    const response = await ctx.api.post('/webhooks/payment-provider')
      .set('X-Provider-Signature', ctx.signer.sign(raw))
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe('trialing');
    expect(ctx.db.findInvoicesBySubscription(subId)[0].status).toBe('refunded');
  });

  it('rejects invalid signatures and malformed payloads', async () => {
    const ctx = createTestContext();
    const payload = new WebhookBuilder().build();

    const badSignature = await ctx.api.post('/webhooks/payment-provider')
      .set('X-Provider-Signature', 'wrong')
      .send(payload);
    expect(badSignature.status).toBe(401);

    const raw = '{bad json';
    const malformed = await ctx.api.post('/webhooks/payment-provider')
      .set('Content-Type', 'application/json')
      .set('X-Provider-Signature', ctx.signer.sign(raw))
      .send(raw);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe('Malformed JSON');
  });
});
