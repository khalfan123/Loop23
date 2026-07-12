import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import {
  correlationIdMiddleware,
  getCurrentCorrelationId,
  CORRELATION_ID_HEADER,
} from '../../server/middleware/correlation-id';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(correlationIdMiddleware);
  app.get('/slow', async (req, res) => {
    // Interleave with other requests, then read the ID from ALS —
    // under the old module-level variable this returned another request's ID.
    const delay = Number(req.query.delay ?? 20);
    await new Promise(resolve => setTimeout(resolve, delay));
    res.json({
      fromRequest: req.correlationId,
      fromAsyncContext: getCurrentCorrelationId(),
    });
  });
  await new Promise<void>(resolve => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (typeof address === 'object' && address) {
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
});

afterAll(() => {
  server?.close();
});

describe('correlationIdMiddleware', () => {
  it('propagates an inbound correlation ID and echoes it on the response', async () => {
    const res = await fetch(`${baseUrl}/slow?delay=1`, {
      headers: { [CORRELATION_ID_HEADER]: 'inbound-123' },
    });
    expect(res.headers.get(CORRELATION_ID_HEADER.toLowerCase())).toBe('inbound-123');
    const body = await res.json();
    expect(body.fromRequest).toBe('inbound-123');
    expect(body.fromAsyncContext).toBe('inbound-123');
  });

  it('generates a UUID when no inbound ID is present', async () => {
    const res = await fetch(`${baseUrl}/slow?delay=1`);
    const body = await res.json();
    expect(body.fromRequest).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.fromAsyncContext).toBe(body.fromRequest);
  });

  it('keeps IDs isolated across concurrent interleaved requests', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `concurrent-${i}`);
    const responses = await Promise.all(
      ids.map((id, i) =>
        fetch(`${baseUrl}/slow?delay=${5 + (i % 5) * 10}`, {
          headers: { [CORRELATION_ID_HEADER]: id },
        }).then(r => r.json())
      )
    );
    responses.forEach((body, i) => {
      expect(body.fromRequest).toBe(ids[i]);
      // The async-context read must match its own request, never a neighbor's
      expect(body.fromAsyncContext).toBe(ids[i]);
    });
  });
});
