import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../server/storage', () => ({
  storage: { getGlobalSetting: vi.fn() },
}));
vi.mock('../../server/services/stripe-service', () => ({
  getStripeClient: vi.fn(async () => null),
}));

import { storage } from '../../server/storage';
import {
  validateRazorpayWebhook,
  validateTwilioWebhook,
  createHmacWebhookValidator,
  type RawBodyRequest,
} from '../../server/middleware/webhookValidation';

const getGlobalSetting = storage.getGlobalSetting as ReturnType<typeof vi.fn>;

function makeReq(headers: Record<string, string>, body: any = { ok: true }): RawBodyRequest {
  const rawBody = Buffer.from(JSON.stringify(body));
  return {
    headers,
    body,
    rawBody,
    protocol: 'https',
    originalUrl: '/api/webhooks/test',
    get: () => 'example.com',
  } as unknown as RawBodyRequest;
}

function makeRes() {
  const res: any = {
    statusCode: 0,
    jsonBody: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.jsonBody = payload; return this; },
  };
  return res;
}

function hmac(secret: string, body: any): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

beforeEach(() => {
  getGlobalSetting.mockReset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('fail-closed policy (production)', () => {
  it('rejects a Razorpay webhook when no secret is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEBHOOK_ALLOW_UNSIGNED', '');
    getGlobalSetting.mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(makeReq({ 'x-razorpay-signature': 'sig' }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a Twilio webhook missing the signature header', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEBHOOK_ALLOW_UNSIGNED', '');
    const res = makeRes();
    const next = vi.fn();
    await validateTwilioWebhook(makeReq({}) as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a generic webhook missing the signature header', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEBHOOK_ALLOW_UNSIGNED', '');
    const validator = createHmacWebhookValidator({
      provider: 'acme', signatureHeader: 'X-Acme-Signature', secretKey: 'acme_secret',
    });
    const res = makeRes();
    const next = vi.fn();
    await validator(makeReq({}), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('honors the WEBHOOK_ALLOW_UNSIGNED escape hatch', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEBHOOK_ALLOW_UNSIGNED', 'true');
    getGlobalSetting.mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(makeReq({ 'x-razorpay-signature': 'sig' }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});

describe('dev/test permissiveness', () => {
  it('allows an unverifiable webhook outside production (legacy dev ergonomics)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    getGlobalSetting.mockResolvedValue(undefined);
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(makeReq({ 'x-razorpay-signature': 'sig' }), res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('signature verification', () => {
  it('accepts a valid Razorpay HMAC signature', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getGlobalSetting.mockResolvedValue({ value: 'topsecret' });
    const body = { event: 'payment.captured' };
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(
      makeReq({ 'x-razorpay-signature': hmac('topsecret', body) }, body),
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it('rejects an invalid signature in any environment', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    getGlobalSetting.mockResolvedValue({ value: 'topsecret' });
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(makeReq({ 'x-razorpay-signature': 'deadbeef' }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a same-length wrong signature (timing-safe path)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getGlobalSetting.mockResolvedValue({ value: 'topsecret' });
    const body = { event: 'payment.captured' };
    const good = hmac('topsecret', body);
    const bad = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    const res = makeRes();
    const next = vi.fn();
    await validateRazorpayWebhook(makeReq({ 'x-razorpay-signature': bad }, body), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid generic-validator signature with env-var secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ACME_WEBHOOK_SECRET', 'acme-secret');
    getGlobalSetting.mockResolvedValue(undefined);
    const validator = createHmacWebhookValidator({
      provider: 'acme', signatureHeader: 'X-Acme-Signature',
      secretKey: 'acme_secret', secretEnvVar: 'ACME_WEBHOOK_SECRET',
    });
    const body = { hello: 'world' };
    const res = makeRes();
    const next = vi.fn();
    await validator(makeReq({ 'x-acme-signature': hmac('acme-secret', body) }, body), res, next);
    expect(next).toHaveBeenCalled();
  });
});
