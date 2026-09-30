import { describe, expect, it } from 'vitest';
import { createTestContext } from '../fixtures/testContext.js';
import { SubscriptionRequestBuilder } from '../../src/builders/testDataBuilder.js';

describe('Subscription API', () => {
  it('creates a trialing subscription and returns a consistent resource', async () => {
    const ctx = createTestContext();
    const payload = new SubscriptionRequestBuilder().withPlan('basic').build();

    const response = await ctx.api.post('/subscriptions').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('trialing');
    expect(ctx.provider.getCallCount()).toBe(0);
    expect(ctx.db.getSubscription(response.body.id)?.status).toBe('trialing');
  });

  it('rejects an unknown plan and does not persist or charge', async () => {
    const ctx = createTestContext();
    const payload = new SubscriptionRequestBuilder().build();
    const invalidPayload = { ...payload, plan: 'does-not-exist' };

    const response = await ctx.api.post('/subscriptions').send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
    expect(ctx.provider.getCallCount()).toBe(0);
  });

  it('rejects an unknown customer and does not persist or charge', async () => {
    const ctx = createTestContext();
    const payload = new SubscriptionRequestBuilder().withCustomerId('cust_missing').build();

    const response = await ctx.api.post('/subscriptions').send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Unknown customer');
    expect(ctx.provider.getCallCount()).toBe(0);
  });

  it('activates an immediate-charge plan and verifies provider arguments', async () => {
    const ctx = createTestContext();

    const response = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('pro').build()
    );

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('active');
    expect(ctx.provider.getCallCount()).toBe(1);
    expect(ctx.provider.getCalls()[0]).toMatchObject({
      customerId: 'cust_001',
      paymentMethodId: 'pm_test_visa_4242',
      amount: 4900,
      currency: 'USD'
    });
    expect(ctx.db.findInvoicesBySubscription(response.body.id)[0]?.status).toBe('paid');
  });

  it('rejects cancellation of an already canceled subscription', async () => {
    const ctx = createTestContext();
    const create = await ctx.api.post('/subscriptions').send(
      new SubscriptionRequestBuilder().withPlan('basic').build()
    );

    expect((await ctx.api.post(`/subscriptions/${create.body.id}/cancel`)).status).toBe(200);
    const second = await ctx.api.post(`/subscriptions/${create.body.id}/cancel`);

    expect(second.status).toBe(409);
    expect(second.body.error).toContain('Invalid subscription transition');
  });
});
