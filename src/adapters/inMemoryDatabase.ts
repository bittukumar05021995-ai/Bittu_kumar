import type { AuditEvent, Customer, Invoice, PaymentEventRecord, Plan, Subscription } from '../domain/models.js';

export class InMemoryDatabase {
  private readonly customers = new Map<string, Customer>();
  private readonly plans = new Map<string, Plan>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly invoices = new Map<string, Invoice>();
  private readonly paymentEvents: PaymentEventRecord[] = [];
  private readonly auditEvents: AuditEvent[] = [];

  seedCustomer(customer: Customer): void {
    this.customers.set(customer.id, customer);
  }

  hasCustomer(id: string): boolean {
    return this.customers.has(id);
  }

  seedPlan(plan: Plan): void {
    this.plans.set(plan.code, plan);
  }

  getPlan(code: string): Plan | undefined {
    return this.plans.get(code);
  }

  saveSubscription(subscription: Subscription): void {
    this.subscriptions.set(subscription.id, structuredClone(subscription));
  }

  getSubscription(id: string): Subscription | undefined {
    const value = this.subscriptions.get(id);
    return value ? structuredClone(value) : undefined;
  }

  updateSubscription(subscription: Subscription): void {
    this.subscriptions.set(subscription.id, structuredClone(subscription));
  }

  saveInvoice(invoice: Invoice): void {
    if (this.invoices.has(invoice.id)) {
      throw new Error(`Invoice already exists: ${invoice.id}`);
    }
    this.invoices.set(invoice.id, structuredClone(invoice));
  }

  updateInvoice(invoice: Invoice): void {
    this.invoices.set(invoice.id, structuredClone(invoice));
  }

  getInvoice(id: string): Invoice | undefined {
    const value = this.invoices.get(id);
    return value ? structuredClone(value) : undefined;
  }

  findInvoicesBySubscription(subscriptionId: string): Invoice[] {
    return [...this.invoices.values()]
      .filter((invoice) => invoice.subscriptionId === subscriptionId)
      .map((invoice) => structuredClone(invoice));
  }

  recordPaymentEvent(event: PaymentEventRecord): void {
    this.paymentEvents.push(structuredClone(event));
  }

  hasPaymentEvent(eventId: string): boolean {
    return this.paymentEvents.some((event) => event.eventId === eventId);
  }

  findPaymentEventsBySubscription(subscriptionId: string): PaymentEventRecord[] {
    return this.paymentEvents
      .filter((event) => event.subscriptionId === subscriptionId)
      .map((event) => structuredClone(event));
  }

  saveAudit(event: AuditEvent): void {
    this.auditEvents.push(structuredClone(event));
  }

  findAuditBySubscription(subscriptionId: string): AuditEvent[] {
    return this.auditEvents
      .filter((event) => event.subscriptionId === subscriptionId)
      .map((event) => structuredClone(event));
  }
}
