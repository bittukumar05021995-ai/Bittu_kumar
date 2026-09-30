import { createHmac, timingSafeEqual } from 'node:crypto';

export class WebhookSigner {
  constructor(private readonly secret: string) {}

  sign(rawBody: string): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  verify(rawBody: string, signature: string): boolean {
    const expected = this.sign(rawBody);
    const providedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
