import { describe, expect, it } from 'vitest';
import { SubscriptionStateMachine } from '../../src/domain/stateMachine.js';

describe('Subscription lifecycle state machine', () => {
  const machine = new SubscriptionStateMachine();

  it.each([
    ['trialing', 'active'],
    ['trialing', 'past_due'],
    ['trialing', 'canceled'],
    ['active', 'past_due'],
    ['active', 'canceled'],
    ['past_due', 'active'],
    ['past_due', 'canceled']
  ] as const)('allows %s -> %s', (from, to) => {
    expect(machine.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['canceled', 'active'],
    ['canceled', 'past_due'],
    ['active', 'trialing'],
    ['active', 'active']
  ] as const)('blocks %s -> %s', (from, to) => {
    expect(machine.canTransition(from, to)).toBe(false);
    expect(() => machine.transition(from, to)).toThrow(`Invalid subscription transition: ${from} -> ${to}`);
  });
});
