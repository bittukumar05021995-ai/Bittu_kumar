export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type PlanCode = 'basic' | 'pro';
export type PaymentOutcome = 'success' | 'decline' | 'timeout';
export type PaymentEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

export interface Customer {
  id: string;
}

export interface Plan {
  code: PlanCode;
  amount: number;
  currency: 'USD';
  trialDays: number;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  createdAt: string;
  canceledAt?: string;
}

export type InvoiceStatus = 'open' | 'paid' | 'failed' | 'refunded';

export interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: 'USD';
  status: InvoiceStatus;
  providerReference?: string;
}

export interface PaymentEventRecord {
  eventId: string;
  type: PaymentEventType;
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  currency: 'USD';
  processedAt: string;
  duplicate: boolean;
}

export interface AuditEvent {
  subscriptionId: string;
  from: SubscriptionStatus;
  to: SubscriptionStatus;
  reason: string;
  at: string;
}
