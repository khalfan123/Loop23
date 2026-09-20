import { describe, it, expect, afterEach } from 'vitest';
import {
  evaluateCostTakeoverGates,
  isCostTakeoverEnabled,
  shouldSoftPreferLocalClone,
  rolloutBucket,
  costTakeoverRolloutPercent,
} from '../../server/voice-core/providers/local-clone-cost-takeover';

afterEach(() => {
  delete process.env.LOCAL_CLONE_TTS_BASE_URL;
  delete process.env.LOCAL_CLONE_TTS_LIVE;
  delete process.env.LOCAL_CLONE_COST_TAKEOVER;
  delete process.env.LOCAL_CLONE_COST_TAKEOVER_PERCENT;
  delete process.env.LOCAL_CLONE_COST_TAKEOVER_MIN_ATTEMPTS;
  delete process.env.LOCAL_CLONE_COST_TAKEOVER_MAX_EWMA_MS;
});

describe('local-clone-cost-takeover', () => {
  it('requires LIVE + COST_TAKEOVER', () => {
    expect(isCostTakeoverEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isCostTakeoverEnabled({
        LOCAL_CLONE_TTS_BASE_URL: 'http://x',
        LOCAL_CLONE_TTS_LIVE: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isCostTakeoverEnabled({
        LOCAL_CLONE_TTS_BASE_URL: 'http://x',
        LOCAL_CLONE_TTS_LIVE: '1',
        LOCAL_CLONE_COST_TAKEOVER: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('gates red when breaker open', () => {
    const env = {
      LOCAL_CLONE_TTS_BASE_URL: 'http://x',
      LOCAL_CLONE_TTS_LIVE: '1',
      LOCAL_CLONE_COST_TAKEOVER: '1',
    } as NodeJS.ProcessEnv;
    const gates = evaluateCostTakeoverGates(
      [{ providerId: 'local_clone', breaker: 'open', ewmaLatencyMs: 100, attempts: 10 }],
      env,
    );
    expect(gates.gatesGreen).toBe(false);
    expect(gates.reasons.some((r) => /breaker/i.test(r))).toBe(true);
  });

  it('soft prefers local_clone for EL agents with clone id when gates green', () => {
    const env = {
      LOCAL_CLONE_TTS_BASE_URL: 'http://x',
      LOCAL_CLONE_TTS_LIVE: '1',
      LOCAL_CLONE_COST_TAKEOVER: '1',
    } as NodeJS.ProcessEnv;
    expect(
      shouldSoftPreferLocalClone({
        configuredProvider: 'elevenlabs',
        localCloneVoiceId: 'lc_abc',
        env,
      }),
    ).toBe(true);
    expect(
      shouldSoftPreferLocalClone({
        configuredProvider: 'elevenlabs',
        localCloneVoiceId: null,
        env,
      }),
    ).toBe(false);
  });

  it('honors percent rollout buckets', () => {
    const env = {
      LOCAL_CLONE_TTS_BASE_URL: 'http://x',
      LOCAL_CLONE_TTS_LIVE: '1',
      LOCAL_CLONE_COST_TAKEOVER: '1',
      LOCAL_CLONE_COST_TAKEOVER_PERCENT: '0',
    } as NodeJS.ProcessEnv;
    expect(costTakeoverRolloutPercent(env)).toBe(0);
    expect(
      shouldSoftPreferLocalClone({
        configuredProvider: 'elevenlabs',
        localCloneVoiceId: 'lc_abc',
        agentId: 'agent-1',
        env,
      }),
    ).toBe(false);
    expect(rolloutBucket('agent-1')).toBeGreaterThanOrEqual(0);
    expect(rolloutBucket('agent-1')).toBeLessThan(100);
  });
});
