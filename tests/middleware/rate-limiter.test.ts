import { describe, it, expect, vi } from 'vitest';
import {
  createRateLimiter,
  MemoryRateLimitStore,
  type RateLimitStore,
} from '../../server/middleware/rateLimiter';

function makeReq(ip = '1.2.3.4'): any {
  return { ip, headers: {}, socket: { remoteAddress: ip } };
}

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) { headers[name] = value; },
  } as any;
}

async function run(middleware: any, req: any): Promise<{ error?: any; res: any }> {
  const res = makeRes();
  return new Promise((resolve) => {
    middleware(req, res, (error?: any) => resolve({ error, res }));
  });
}

describe('MemoryRateLimitStore', () => {
  it('counts hits within a fixed window and resets after it', () => {
    const store = new MemoryRateLimitStore();
    const t0 = 1_000_000;
    expect(store.hit('k', 1000, t0).count).toBe(1);
    expect(store.hit('k', 1000, t0 + 500).count).toBe(2);
    // Past the window (anchored at firstRequest): fresh entry
    expect(store.hit('k', 1000, t0 + 1500).count).toBe(1);
  });

  it('isolates keys and reports top offenders', () => {
    const store = new MemoryRateLimitStore();
    store.hit('a', 1000, 0);
    store.hit('b', 1000, 0);
    store.hit('b', 1000, 1);
    expect(store.size()).toBe(2);
    expect(store.top(1)).toEqual([{ key: 'b', count: 2 }]);
  });
});

describe('createRateLimiter', () => {
  it('allows up to maxRequests then rejects with RateLimitError and headers', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      store: new MemoryRateLimitStore(),
    });
    const req = makeReq();

    const first = await run(limiter, req);
    expect(first.error).toBeUndefined();
    expect(first.res.headers['X-RateLimit-Limit']).toBe('2');
    expect(first.res.headers['X-RateLimit-Remaining']).toBe('1');

    await run(limiter, req);
    const third = await run(limiter, req);
    expect(third.error).toBeDefined();
    expect(third.error.name).toBe('RateLimitError');
    expect(third.res.headers['Retry-After']).toBeDefined();
  });

  it('tracks different client keys independently', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      store: new MemoryRateLimitStore(),
    });
    expect((await run(limiter, makeReq('1.1.1.1'))).error).toBeUndefined();
    expect((await run(limiter, makeReq('2.2.2.2'))).error).toBeUndefined();
    expect((await run(limiter, makeReq('1.1.1.1'))).error).toBeDefined();
  });

  it('honors skip()', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 0,
      skip: () => true,
      store: new MemoryRateLimitStore(),
    });
    expect((await run(limiter, makeReq())).error).toBeUndefined();
  });

  it('supports an async store (Redis-shaped) through the same middleware', async () => {
    const asyncStore: RateLimitStore = {
      hit: async (_key, _windowMs, now) => ({ count: 3, firstRequest: now, lastRequest: now }),
      size: () => 0,
      top: () => [],
    };
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, store: asyncStore });
    const { error } = await run(limiter, makeReq());
    expect(error?.name).toBe('RateLimitError');
  });

  it('fails open when the store errors (an outage must not down the API)', async () => {
    const brokenStore: RateLimitStore = {
      hit: async () => { throw new Error('redis down'); },
      size: () => 0,
      top: () => [],
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, store: brokenStore });
    const { error } = await run(limiter, makeReq());
    expect(error).toBeUndefined();
    errorSpy.mockRestore();
  });
});
