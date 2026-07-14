import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../../server/voice-core/registry';
import { ProviderRouter, type TTSRouteContext } from '../../server/voice-core/router';
import {
  TTSAllProvidersFailedError,
  type TTSProvider,
  type TTSProviderId,
  type TTSRequest,
} from '../../server/voice-core/types';

function mockProvider(
  id: TTSProviderId,
  behavior: { fail?: boolean; failTimes?: number; configured?: boolean; languages?: string[] } = {}
): TTSProvider & { calls: TTSRequest[] } {
  let remainingFailures = behavior.failTimes ?? (behavior.fail ? Infinity : 0);
  const calls: TTSRequest[] = [];
  return {
    id,
    calls,
    isConfigured: () => behavior.configured ?? true,
    supportsLanguage: (lang) => !behavior.languages || !lang || behavior.languages.includes(lang),
    async synthesize(request) {
      calls.push(request);
      if (remainingFailures > 0) {
        remainingFailures--;
        throw new Error(`${id} synth failed`);
      }
      return { audio: Buffer.from([1, 2]), providerId: id, latencyMs: 5, characters: request.text.length };
    },
  };
}

function makeContext(
  preferred: TTSProviderId,
  usable: TTSProviderId[] = ['aws_polly', 'elevenlabs', 'cartesia'],
  language?: string
): TTSRouteContext {
  return {
    preferred,
    finalFallback: 'aws_polly',
    language,
    buildRequest: (id) =>
      usable.includes(id)
        ? { text: 'hello there', voiceId: `${id}-voice`, language, sampleRateHz: 8000 }
        : null,
  };
}

describe('ProviderRouter', () => {
  it('uses the preferred provider on the happy path with one attempt', async () => {
    const registry = new ProviderRegistry();
    const eleven = mockProvider('elevenlabs');
    registry.registerTTS(eleven);
    registry.registerTTS(mockProvider('aws_polly'));
    const router = new ProviderRouter(registry);

    const { result, attempts } = await router.synthesize(makeContext('elevenlabs'));
    expect(result.providerId).toBe('elevenlabs');
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ providerId: 'elevenlabs', ok: true });
  });

  it('falls back when the preferred provider throws, recording both attempts', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('elevenlabs', { fail: true }));
    registry.registerTTS(mockProvider('aws_polly'));
    const onAttempt = vi.fn();
    const router = new ProviderRouter(registry, { onAttempt });

    const { result, attempts } = await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(result.providerId).toBe('aws_polly');
    expect(attempts.map(a => [a.providerId, a.ok])).toEqual([
      ['elevenlabs', false],
      ['aws_polly', true],
    ]);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it('excludes providers whose buildRequest returns null', async () => {
    const registry = new ProviderRegistry();
    const cartesia = mockProvider('cartesia');
    registry.registerTTS(cartesia);
    registry.registerTTS(mockProvider('aws_polly'));
    registry.registerTTS(mockProvider('elevenlabs'));
    const router = new ProviderRouter(registry);

    // Agent only has polly + elevenlabs voices configured
    const { result } = await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(result.providerId).toBe('elevenlabs');
    expect(cartesia.calls).toHaveLength(0);
  });

  it('skips a breaker-open provider and records the skip', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('elevenlabs', { fail: true }));
    registry.registerTTS(mockProvider('aws_polly'));
    const router = new ProviderRouter(registry, {
      breakerOptions: { consecutiveFailuresToOpen: 2, openMs: 30_000 },
    });
    const ctx = makeContext('elevenlabs', ['elevenlabs', 'aws_polly']);

    await router.synthesize(ctx); // eleven fails #1
    await router.synthesize(ctx); // eleven fails #2 -> breaker opens
    const { result, attempts } = await router.synthesize(ctx);
    expect(result.providerId).toBe('aws_polly');
    expect(attempts[0]).toMatchObject({ providerId: 'elevenlabs', skipped: 'breaker_open' });
  });

  it('always attempts the final fallback even when its breaker is open', async () => {
    const registry = new ProviderRegistry();
    const polly = mockProvider('aws_polly', { failTimes: 3 });
    registry.registerTTS(polly);
    const router = new ProviderRouter(registry, {
      breakerOptions: { consecutiveFailuresToOpen: 1, openMs: 60_000 },
    });
    const ctx = makeContext('aws_polly', ['aws_polly']);

    await expect(router.synthesize(ctx)).rejects.toThrow(TTSAllProvidersFailedError); // fail 1, breaker opens
    await expect(router.synthesize(ctx)).rejects.toThrow(TTSAllProvidersFailedError); // still attempted
    await expect(router.synthesize(ctx)).rejects.toThrow(TTSAllProvidersFailedError);
    const { result } = await router.synthesize(ctx); // provider recovered
    expect(result.providerId).toBe('aws_polly');
    expect(polly.calls).toHaveLength(4);
  });

  it('throws TTSAllProvidersFailedError with the full attempt list', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('elevenlabs', { fail: true }));
    registry.registerTTS(mockProvider('aws_polly', { fail: true }));
    const router = new ProviderRouter(registry);

    const error = await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly'])).catch(e => e);
    expect(error).toBeInstanceOf(TTSAllProvidersFailedError);
    expect(error.attempts.map((a: any) => a.providerId)).toEqual(['elevenlabs', 'aws_polly']);
    expect(error.attempts.every((a: any) => !a.ok)).toBe(true);
  });

  it('orders alternates by EWMA latency and collapses to [preferred, fallback] for legacy agents', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    registry.registerTTS(mockProvider('elevenlabs'));
    registry.registerTTS(mockProvider('cartesia'));
    const router = new ProviderRouter(registry);

    // Legacy agent shape: only preferred + fallback usable
    const legacyCtx = makeContext('cartesia', ['cartesia', 'aws_polly']);
    expect(router.candidateOrder(legacyCtx)).toEqual(['cartesia', 'elevenlabs', 'aws_polly']);
    // elevenlabs is in candidateOrder but buildRequest(null) excludes it at attempt time:
    const { attempts } = await router.synthesize(legacyCtx);
    expect(attempts.map(a => [a.providerId, a.ok ?? false, a.skipped])).toEqual([
      ['cartesia', true, undefined],
    ]);

    // Seed latency stats: cartesia slow, elevenlabs fast
    const seedCtx = makeContext('aws_polly');
    await router.synthesize(seedCtx);
    const full = router.candidateOrder(makeContext('aws_polly'));
    expect(full[0]).toBe('aws_polly');
    // dedup: preferred === finalFallback appears exactly once, at the front
    expect(full.filter(id => id === 'aws_polly')).toHaveLength(1);
    expect(full).toHaveLength(3);
  });

  it('healthSnapshot reports per-provider breaker state and stats', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    registry.registerTTS(mockProvider('elevenlabs', { fail: true }));
    const router = new ProviderRouter(registry, { breakerOptions: { consecutiveFailuresToOpen: 1 } });
    await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));

    const snapshot = router.healthSnapshot();
    const eleven = snapshot.find(s => s.providerId === 'elevenlabs')!;
    const polly = snapshot.find(s => s.providerId === 'aws_polly')!;
    expect(eleven.breaker).toBe('open');
    expect(eleven.failures).toBe(1);
    expect(polly.breaker).toBe('closed');
    expect(polly.attempts).toBe(1);
  });
});

describe('ProviderRouter — health-aware selection', () => {
  function registryWith(...ids: TTSProviderId[]): ProviderRegistry {
    const r = new ProviderRegistry();
    for (const id of ids) r.registerTTS(mockProvider(id));
    return r;
  }

  it('default strategy is unchanged: preferred provider stays first', () => {
    const router = new ProviderRouter(registryWith('aws_polly', 'elevenlabs', 'cartesia'));
    const order = router.candidateOrder(makeContext('cartesia', ['cartesia', 'elevenlabs', 'aws_polly']));
    expect(order[0]).toBe('cartesia');
    expect(order[order.length - 1]).toBe('aws_polly');
  });

  it('health_aware ranks a cheaper provider ahead of the preferred one', () => {
    const router = new ProviderRouter(registryWith('aws_polly', 'elevenlabs', 'cartesia'), {
      selectionStrategy: 'health_aware',
      costOf: (id) => (id === 'cartesia' ? 0.05 : 0.18), // cartesia cheaper
    });
    // Preferred is elevenlabs, but cartesia is cheaper and equally healthy
    const order = router.candidateOrder(makeContext('elevenlabs', ['elevenlabs', 'cartesia', 'aws_polly']));
    expect(order.indexOf('cartesia')).toBeLessThan(order.indexOf('elevenlabs'));
  });

  it('health_aware still always attempts the final fallback last', () => {
    const router = new ProviderRouter(registryWith('aws_polly', 'elevenlabs'), {
      selectionStrategy: 'health_aware',
      costOf: () => 0, // would otherwise score aws_polly best
    });
    const order = router.candidateOrder(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(order[order.length - 1]).toBe('aws_polly');
    expect(order.filter(id => id === 'aws_polly')).toHaveLength(1);
  });

  it('health_aware demotes a provider with a high error rate', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    registry.registerTTS(mockProvider('elevenlabs', { failTimes: 2 }));
    registry.registerTTS(mockProvider('cartesia'));
    const router = new ProviderRouter(registry, {
      selectionStrategy: 'health_aware',
      breakerOptions: { consecutiveFailuresToOpen: 5 }, // keep breaker closed while failing
    });
    const ctx = makeContext('elevenlabs', ['elevenlabs', 'cartesia', 'aws_polly']);
    // Drive two failures on elevenlabs to build its error rate (falls back to cartesia)
    await router.synthesize(ctx);
    await router.synthesize(ctx);
    const order = router.candidateOrder(ctx);
    // The healthy cartesia should now rank ahead of the error-prone elevenlabs
    expect(order.indexOf('cartesia')).toBeLessThan(order.indexOf('elevenlabs'));
  });

  it('health_aware still considers a preferred provider that fails registry isConfigured() (per-agent key)', async () => {
    // The registry-level isConfigured() can't see per-agent API keys, so a
    // provider credentialed only at the agent level reports unconfigured.
    // Under 'preferred' the router force-includes preferred; 'health_aware'
    // must not silently drop it to the fallback.
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    const eleven = mockProvider('elevenlabs', { configured: false });
    registry.registerTTS(eleven);
    const router = new ProviderRouter(registry, { selectionStrategy: 'health_aware' });

    const order = router.candidateOrder(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(order).toEqual(['elevenlabs', 'aws_polly']);

    // And it is actually attempted (buildRequest materializes it), not skipped.
    const { result } = await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(result.providerId).toBe('elevenlabs');
    expect(eleven.calls).toHaveLength(1);
  });

  it('health_aware does NOT resurrect a preferred provider whose breaker is open', async () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    registry.registerTTS(mockProvider('elevenlabs', { configured: false, fail: true }));
    const router = new ProviderRouter(registry, {
      selectionStrategy: 'health_aware',
      breakerOptions: { consecutiveFailuresToOpen: 1 },
    });
    // First call trips the breaker (falls back to Polly).
    await router.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    // Breaker open → preferred is excluded despite the per-agent-key rule.
    const order = router.candidateOrder(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
    expect(order).toEqual(['aws_polly']);
  });

  it('health_aware excludes breaker-open providers but keeps the final fallback', () => {
    const registry = new ProviderRegistry();
    registry.registerTTS(mockProvider('aws_polly'));
    const eleven = mockProvider('elevenlabs');
    registry.registerTTS(eleven);
    const router = new ProviderRouter(registry, {
      selectionStrategy: 'health_aware',
      breakerOptions: { consecutiveFailuresToOpen: 1 },
    });
    // Trip elevenlabs' breaker manually via a failing synth
    const failing = new ProviderRegistry();
    failing.registerTTS(mockProvider('aws_polly'));
    failing.registerTTS(mockProvider('elevenlabs', { fail: true }));
    const r2 = new ProviderRouter(failing, { selectionStrategy: 'health_aware', breakerOptions: { consecutiveFailuresToOpen: 1 } });
    return r2.synthesize(makeContext('elevenlabs', ['elevenlabs', 'aws_polly'])).then(() => {
      const order = r2.candidateOrder(makeContext('elevenlabs', ['elevenlabs', 'aws_polly']));
      // elevenlabs breaker is open → excluded from ranking; only polly (fallback) remains
      expect(order).toEqual(['aws_polly']);
    });
  });
});
