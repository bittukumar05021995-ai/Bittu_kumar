import type { SubscriptionStatus } from './models.js';

const transitions: Record<SubscriptionStatus, ReadonlySet<SubscriptionStatus>> = {
  trialing: new Set(['active', 'past_due', 'canceled']),
  active: new Set(['past_due', 'canceled']),
  past_due: new Set(['active', 'canceled']),
  canceled: new Set()
};

export class SubscriptionStateMachine {
  canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    return transitions[from].has(to);
  }

  transition(from: SubscriptionStatus, to: SubscriptionStatus): SubscriptionStatus {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid subscription transition: ${from} -> ${to}`);
    }
    return to;
  }
}
