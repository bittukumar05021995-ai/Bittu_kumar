import { randomUUID } from 'node:crypto';
import type { PaymentEventType, PaymentOutcome, Subscription, SubscriptionStatus } from '../domain/models.js';
import type { PaymentProvider } from '../ports/paymentProvider.js';
import { InMemoryDatabase } from '../adapters/inMemoryDatabase.js';
import { SubscriptionStateMachine } from '../domain/stateMachine.js';

interface CreateInput {
  customer_id: string;
  plan: string;
  payment_method_id: string;
}

interface WebhookInput {
  event_id: string;
  type: PaymentEventType;
  subscription_id: string;
  invoice_id: string;
  amount: number;
  currency: 'USD';
}

export class BillingService {
  constructor(
    private readonly db: InMemoryDatabase,
    private readonly provider: PaymentProvider,
    private readonly stateMachine = new SubscriptionStateMachine()
  ) {}

  async createSubscription(input: CreateInput): Promise<Subscription> {
    if (!this.db.hasCustomer(input.customer_id)) {
      throw new Error('Unknown customer');
    }

    const plan = this.db.getPlan(input.plan);
    if (!plan) {
      throw new Error('Unknown plan');
    }

    if (!input.payment_method_id) {
      throw new Error('Payment method is required');
    }

    const subscription: Subscription = {
      id: `sub_${randomUUID().slice(0, 8)}`,
      customerId: input.customer_id,
      plan: plan.code,
      status: 'trialing',
      createdAt: new Date().toISOString()
    };

    this.db.saveSubscription(subscription);

    if (plan.trialDays > 0) {
      return subscription;
    }

    const invoice = this.createInvoice(subscription, plan.amount);
    const result = await this.provider.charge({
      customerId: input.customer_id,
      paymentMethodId: input.payment_method_id,
      amount: plan.amount,
      currency: plan.currency,
      idempotencyKey: `initial_${subscription.id}`
    });

    this.applyChargeOutcome(subscription.id, invoice.id, result.outcome, result.providerReference, 'initial charge');
    return this.db.getSubscription(subscription.id)!;
  }

  getSubscription(id: string): Subscription | undefined {
    return this.db.getSubscription(id);
  }

  cancelSubscription(id: string): Subscription {
    const subscription = this.requireSubscription(id);
    const next = this.transition(subscription, 'canceled', 'customer/API cancel');
    this.db.updateSubscription(next);
    return next;
  }

  async processWebhook(input: WebhookInput): Promise<{ duplicate: boolean; subscription: Subscription }> {
    const existing = this.db.hasPaymentEvent(input.event_id);
    const subscription = this.requireSubscription(input.subscription_id);

    if (existing) {
      this.db.recordPaymentEvent({
        eventId: input.event_id,
        type: input.type,
        subscriptionId: input.subscription_id,
        invoiceId: input.invoice_id,
        amount: input.amount,
        currency: input.currency,
        processedAt: new Date().toISOString(),
        duplicate: true
      });
      return { duplicate: true, subscription };
    }

    const invoice = this.db.getInvoice(input.invoice_id);
    if (!invoice) {
      throw new Error('Unknown invoice');
    }

    if (invoice.subscriptionId !== subscription.id) {
      throw new Error('Invoice does not belong to subscription');
    }

    if (invoice.amount !== input.amount || invoice.currency !== input.currency) {
      throw new Error('Webhook amount/currency mismatch');
    }

    this.db.recordPaymentEvent({
      eventId: input.event_id,
      type: input.type,
      subscriptionId: input.subscription_id,
      invoiceId: input.invoice_id,
      amount: input.amount,
      currency: input.currency,
      processedAt: new Date().toISOString(),
      duplicate: false
    });

    if (input.type === 'payment.succeeded') {
      if (invoice.status !== 'paid' && invoice.status !== 'refunded') {
        invoice.status = 'paid';
        this.db.updateInvoice(invoice);
      }
      if (subscription.status === 'canceled' || subscription.status === 'active') {
        return { duplicate: false, subscription };
      }
      const next = this.transition(subscription, 'active', 'payment.succeeded');
      this.db.updateSubscription(next);
      return { duplicate: false, subscription: next };
    }

    if (input.type === 'payment.failed') {
      // A late failure must not regress an invoice that already succeeded.
      if (invoice.status !== 'paid' && invoice.status !== 'refunded') {
        invoice.status = 'failed';
        this.db.updateInvoice(invoice);
      }
      if (subscription.status === 'active' || subscription.status === 'canceled') {
        return { duplicate: false, subscription };
      }
      const next = this.transition(subscription, 'past_due', 'payment.failed');
      this.db.updateSubscription(next);
      return { duplicate: false, subscription: next };
    }

    invoice.status = 'refunded';
    this.db.updateInvoice(invoice);
    return { duplicate: false, subscription };
  }

  async retryCharge(id: string, paymentMethodId: string): Promise<Subscription> {
    const subscription = this.requireSubscription(id);
    if (subscription.status !== 'past_due') {
      throw new Error(`Charge retry not allowed from ${subscription.status}`);
    }

    const plan = this.db.getPlan(subscription.plan)!;
    const invoice = this.createInvoice(subscription, plan.amount);
    const result = await this.provider.charge({
      customerId: subscription.customerId,
      paymentMethodId,
      amount: plan.amount,
      currency: plan.currency,
      idempotencyKey: `retry_${subscription.id}_${invoice.id}`
    });

    this.applyChargeOutcome(subscription.id, invoice.id, result.outcome, result.providerReference, 'retry charge');
    return this.db.getSubscription(subscription.id)!;
  }

  markRetriesExhausted(id: string): Subscription {
    const subscription = this.requireSubscription(id);
    const next = this.transition(subscription, 'canceled', 'retries exhausted');
    this.db.updateSubscription(next);
    return next;
  }

  private applyChargeOutcome(
    id: string,
    invoiceId: string,
    outcome: PaymentOutcome,
    providerReference: string | undefined,
    reason: string
  ): void {
    const subscription = this.requireSubscription(id);
    const invoice = this.db.getInvoice(invoiceId)!;
    invoice.providerReference = providerReference;

    if (outcome === 'success') {
      invoice.status = 'paid';
      this.db.updateInvoice(invoice);
      const next = this.transition(subscription, 'active', reason);
      this.db.updateSubscription(next);
      return;
    }

    invoice.status = 'failed';
    this.db.updateInvoice(invoice);
    if (subscription.status !== 'canceled') {
      const next = this.transition(subscription, 'past_due', reason);
      this.db.updateSubscription(next);
    }
  }

  private createInvoice(subscription: Subscription, amount: number) {
    const invoice = {
      id: `inv_${randomUUID().slice(0, 8)}`,
      subscriptionId: subscription.id,
      amount,
      currency: 'USD' as const,
      status: 'open' as const
    };
    this.db.saveInvoice(invoice);
    return invoice;
  }

  private transition(subscription: Subscription, to: SubscriptionStatus, reason: string): Subscription {
    this.stateMachine.transition(subscription.status, to);
    this.db.saveAudit({
      subscriptionId: subscription.id,
      from: subscription.status,
      to,
      reason,
      at: new Date().toISOString()
    });
    return {
      ...subscription,
      status: to,
      ...(to === 'canceled' ? { canceledAt: new Date().toISOString() } : {})
    };
  }

  private requireSubscription(id: string): Subscription {
    const subscription = this.db.getSubscription(id);
    if (!subscription) throw new Error('Unknown subscription');
    return subscription;
  }
}
