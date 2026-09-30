import type { Express } from 'express';
import { InMemoryDatabase } from '../../src/adapters/inMemoryDatabase.js';
import { FakePaymentProvider } from '../../src/adapters/fakePaymentProvider.js';
import { BillingService } from '../../src/app/billingService.js';
import { WebhookSigner } from '../../src/app/signer.js';
import { buildApp } from '../../src/app/server.js';
import { BillingApiClient } from './apiClient.js';

export interface TestContext {
  db: InMemoryDatabase;
  provider: FakePaymentProvider;
  service: BillingService;
  signer: WebhookSigner;
  app: Express;
  api: BillingApiClient;
}

export class TestContextFactory {
  static create(): TestContext {
    const db = new InMemoryDatabase();
    db.seedCustomer({ id: 'cust_001' });
    db.seedPlan({ code: 'basic', amount: 1900, currency: 'USD', trialDays: 7 });
    db.seedPlan({ code: 'pro', amount: 4900, currency: 'USD', trialDays: 0 });

    const provider = new FakePaymentProvider();
    const service = new BillingService(db, provider);
    const signer = new WebhookSigner('test-secret');
    const app = buildApp(service, signer);

    return { db, provider, service, signer, app, api: new BillingApiClient(app) };
  }
}

export function createTestContext(): TestContext {
  return TestContextFactory.create();
}
