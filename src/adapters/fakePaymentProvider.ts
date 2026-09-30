import type { ChargeRequest, ChargeResponse, PaymentProvider } from '../ports/paymentProvider.js';
import type { PaymentOutcome } from '../domain/models.js';

export class FakePaymentProvider implements PaymentProvider {
  private readonly calls: ChargeRequest[] = [];
  private outcome: PaymentOutcome = 'success';

  setOutcome(outcome: PaymentOutcome): void {
    this.outcome = outcome;
  }

  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    this.calls.push(structuredClone(request));
    if (this.outcome === 'timeout') {
      return { outcome: 'timeout' };
    }

    return {
      outcome: this.outcome,
      providerReference: `${this.outcome}_ref_${this.calls.length}`
    };
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getCalls(): ChargeRequest[] {
    return this.calls.map((call) => structuredClone(call));
  }
}
