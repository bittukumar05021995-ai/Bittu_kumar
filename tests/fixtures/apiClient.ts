import type { Express } from 'express';
import request from 'supertest';

export class BillingApiClient {
  constructor(private readonly app: Express) {}

  get(path: string) {
    return request(this.app).get(path);
  }

  post(path: string) {
    return request(this.app).post(path);
  }
}
