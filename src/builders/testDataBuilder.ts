import { randomUUID } from 'node:crypto';
import type { PaymentEventType, PlanCode } from '../domain/models.js';

export class CustomerBuilder {
  private id = `cust_${randomUUID().slice(0, 8)}`;
  withId(id: string): this { this.id = id; return this; }
  build(): { id: string } { return { id: this.id }; }
}

export class SubscriptionRequestBuilder {
  private customerId = 'cust_001';
  private plan: PlanCode = 'basic';
  private paymentMethodId = 'pm_test_visa_4242';

  withCustomerId(id: string): this { this.customerId = id; return this; }
  withPlan(plan: PlanCode): this { this.plan = plan; return this; }
  withPaymentMethodId(id: string): this { this.paymentMethodId = id; return this; }

  build() {
    return {
      customer_id: this.customerId,
      plan: this.plan,
      payment_method_id: this.paymentMethodId
    };
  }
}

export class WebhookBuilder {
  private eventId = `evt_${randomUUID().slice(0, 8)}`;
  private type: PaymentEventType = 'payment.succeeded';
  private subscriptionId = 'sub_001';
  private invoiceId = 'inv_001';
  private amount = 4900;
  private currency: 'USD' = 'USD';

  withEventId(id: string): this { this.eventId = id; return this; }
  withType(type: PaymentEventType): this { this.type = type; return this; }
  withSubscriptionId(id: string): this { this.subscriptionId = id; return this; }
  withInvoiceId(id: string): this { this.invoiceId = id; return this; }
  withAmount(amount: number): this { this.amount = amount; return this; }

  build() {
    return {
      event_id: this.eventId,
      type: this.type,
      subscription_id: this.subscriptionId,
      invoice_id: this.invoiceId,
      amount: this.amount,
      currency: this.currency
    };
  }
}
