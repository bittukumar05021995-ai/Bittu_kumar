import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { BillingService } from './billingService.js';
import type { WebhookSigner } from './signer.js';

const createSchema = z.object({
  customer_id: z.string().min(1),
  plan: z.string().min(1),
  payment_method_id: z.string().min(1)
});

const webhookSchema = z.object({
  event_id: z.string().min(1),
  type: z.enum(['payment.succeeded', 'payment.failed', 'payment.refunded']),
  subscription_id: z.string().min(1),
  invoice_id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.literal('USD')
});

export function buildApp(service: BillingService, signer: WebhookSigner) {
  const app = express();

  app.use('/webhooks/payment-provider', express.raw({ type: 'application/json' }));
  app.use(express.json());

  app.post('/subscriptions', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

    try {
      const result = await service.createSubscription(parsed.data);
      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = ['Unknown customer', 'Unknown plan', 'Payment method is required'].includes(message) ? 400 : 409;
      return res.status(status).json({ error: message });
    }
  });

  app.get('/subscriptions/:id', (req, res) => {
    const result = service.getSubscription(req.params.id);
    return result ? res.status(200).json(result) : res.status(404).json({ error: 'Unknown subscription' });
  });

  app.post('/subscriptions/:id/cancel', (req, res) => {
    try {
      const result = service.cancelSubscription(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(message === 'Unknown subscription' ? 404 : 409).json({ error: message });
    }
  });

  app.post('/webhooks/payment-provider', async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.header('X-Provider-Signature') ?? '';
    if (!signer.verify(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON' });
    }

    const parsed = webhookSchema.safeParse(payload);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid webhook payload' });

    try {
      const result = await service.processWebhook(parsed.data);
      return res.status(200).json({ duplicate: result.duplicate, subscription: result.subscription });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message === 'Unknown subscription' || message === 'Unknown invoice' ? 404 : 409;
      return res.status(status).json({ error: message });
    }
  });

  // Intentionally last: errors should be serialized consistently for unexpected failures.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return app;
}
