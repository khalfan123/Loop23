import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  probeWebhookEndpoint,
  validateWebhookUrlFormat,
} from '../../server/services/automation-copilot-webhook-probe';

describe('automation-copilot webhook probe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects empty and malformed URLs', () => {
    expect(validateWebhookUrlFormat('').ok).toBe(false);
    expect(validateWebhookUrlFormat('not-a-url').ok).toBe(false);
    expect(validateWebhookUrlFormat('ftp://example.com/hook').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://example.com/hook').ok).toBe(true);
  });

  it('rejects plain http (https-only)', () => {
    const result = validateWebhookUrlFormat('http://example.com/webhook');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/https/i);
  });

  it('rejects localhost / private hosts', () => {
    expect(validateWebhookUrlFormat('http://localhost:5678/webhook').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://localhost/hook').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://127.0.0.1/hook').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://192.168.1.10/hook').ok).toBe(false);
  });

  it('rejects cloud metadata and internal hosts', () => {
    expect(validateWebhookUrlFormat('https://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://metadata.google.internal/').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://foo.internal/hook').ok).toBe(false);
    expect(validateWebhookUrlFormat('https://metadata/').ok).toBe(false);
  });

  it('marks incorrect endpoint on HTTP 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );
    const result = await probeWebhookEndpoint({
      url: 'https://example.com/wrong-path',
      method: 'POST',
      samplePayload: { event: 'call.completed' },
      timeoutMs: 3000,
    });
    expect(result.status).toBe('error');
    expect(result.detail).toMatch(/incorrect endpoint/i);
    expect(result.httpStatus).toBe(404);
  });

  it('passes on HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const result = await probeWebhookEndpoint({
      url: 'https://example.com/webhook',
      method: 'POST',
      samplePayload: { event: 'call.completed' },
      timeoutMs: 3000,
    });
    expect(result.status).toBe('ok');
    expect(result.httpStatus).toBe(200);
  });

  it('rejects redirects without following them', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/secret' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await probeWebhookEndpoint({
      url: 'https://example.com/webhook',
      method: 'POST',
      samplePayload: {},
      timeoutMs: 3000,
    });
    expect(result.status).toBe('error');
    expect(result.detail).toMatch(/redirect/i);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('fails on connection errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 93.184.216.34:443');
      }),
    );
    const result = await probeWebhookEndpoint({
      url: 'https://example.com/webhook',
      method: 'POST',
      samplePayload: {},
      timeoutMs: 3000,
    });
    expect(result.status).toBe('error');
    expect(result.detail).toMatch(/incorrect or unreachable|ECONNREFUSED/i);
  });
});
