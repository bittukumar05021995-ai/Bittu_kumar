import { describe, expect, it } from 'vitest';
import { createTestContext } from '../fixtures/testContext.js';
import { SubscriptionRequestBuilder, WebhookBuilder } from '../../src/builders/testDataBuilder.js';

describe('Persistence and provider interaction', () => {
  it('persists coherent subscription, invoice, and audit records after successful payment', async () => {
    const ctx = createTestContext();
    const response = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );
    const subId = response.body.id as string;

    expect(response.body.status).toBe('active');
    expect(ctx.db.getSubscription(subId)?.status).toBe('active');

    const invoices = ctx.db.findInvoicesBySubscription(subId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ status: 'paid', amount: 4900, currency: 'USD' });
    expect(invoices[0].providerReference).toMatch(/^success_ref/);

    const audit = ctx.db.findAuditBySubscription(subId);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ from: 'trialing', to: 'active' });
  });

  it('does not call the provider for rejected creation or duplicate webhook delivery', async () => {
    const ctx = createTestContext();
    const invalid = await ctx.api.post('/subscriptions').send({ customer_id: 'cust_missing', plan: 'pro', payment_method_id: 'pm_test' });
    expect(invalid.status).toBe(400);
    expect(ctx.provider.getCallCount()).toBe(0);

    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );
    const subId = create.body.id as string;
    const invoice = { id: `inv_${subId.slice(-6)}`, subscriptionId: subId, amount: 1900, currency: 'USD' as const, status: 'open' as const };
    ctx.db.saveInvoice(invoice);
    const body = new WebhookBuilder().withEventId('evt_one').withSubscriptionId(subId).withInvoiceId(invoice.id).withAmount(1900).build();
    const raw = JSON.stringify(body);
    const signature = ctx.signer.sign(raw);

    await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', signature).send(body);
    await ctx.api.post('/webhooks/payment-provider').set('X-Provider-Signature', signature).send(body);

    expect(ctx.provider.getCallCount()).toBe(0);
    expect(ctx.db.findPaymentEventsBySubscription(subId)).toHaveLength(2);
    expect(ctx.db.findPaymentEventsBySubscription(subId)[1].duplicate).toBe(true);
  });

  it('handles provider decline and timeout without creating a false success', async () => {
    const ctx = createTestContext();
    ctx.provider.setOutcome('decline');
    const declined = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );
    expect(declined.status).toBe(201);
    expect(declined.body.status).toBe('past_due');
    expect(ctx.db.findInvoicesBySubscription(declined.body.id)[0].status).toBe('failed');

    const timeoutCtx = createTestContext();
    timeoutCtx.provider.setOutcome('timeout');
    const timedOut = await timeoutCtx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );
    expect(timedOut.status).toBe(201);
    expect(timedOut.body.status).toBe('past_due');
    expect(timeoutCtx.db.findInvoicesBySubscription(timedOut.body.id)[0].status).toBe('failed');
  });

  it('covers past_due -> active and past_due -> canceled lifecycle operations', async () => {
    const ctx = createTestContext();
    ctx.provider.setOutcome('decline');
    const created = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );
    const subId = created.body.id as string;
    expect(created.body.status).toBe('past_due');

    ctx.provider.setOutcome('success');
    const retried = await ctx.service.retryCharge(subId, 'pm_test_visa_4242');
    expect(retried.status).toBe('active');
    expect(ctx.provider.getCallCount()).toBe(2);

    const ctx2 = createTestContext();
    ctx2.provider.setOutcome('decline');
    const created2 = await ctx2.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );
    const subId2 = created2.body.id as string;
    expect(created2.body.status).toBe('past_due');
    const canceled = ctx2.service.markRetriesExhausted(subId2);
    expect(canceled.status).toBe('canceled');
  });
});
