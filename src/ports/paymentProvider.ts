import type { PaymentOutcome, Plan } from '../domain/models.js';

export interface ChargeRequest {
  customerId: string;
  paymentMethodId: string;
  amount: number;
  currency: 'USD';
  idempotencyKey: string;
}

export interface ChargeResponse {
  outcome: PaymentOutcome;
  providerReference?: string;
}

export interface PaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResponse>;
}

export interface PaymentProviderPlanResolver {
  getPlanAmount(plan: Plan): number;
}
