/**
 * Phase 4 — cost takeover: prefer local_clone over ElevenLabs when gates allow.
 * Soft path: runtime prefer (keeps EL hybrid fail-open).
 * Hard path: migrate API flips voiceProvider on eligible agents.
 */
import { isLocalCloneLiveEnabled, localCloneMaxLatencyMs } from './local-clone-config';
import type { TTSProviderId } from '../types';

const TRUTHY = /^(1|true|on|yes)$/i;

export interface CostTakeoverHealthSnap {
  providerId: TTSProviderId;
  breaker: 'closed' | 'open' | 'half_open';
  ewmaLatencyMs: number | null;
  attempts?: number;
  failures?: number;
}

export interface CostTakeoverGateResult {
  enabled: boolean;
  live: boolean;
  gatesGreen: boolean;
  reasons: string[];
  maxEwmaMs: number;
  minAttempts: number;
  rolloutPercent: number;
}

export function isCostTakeoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isLocalCloneLiveEnabled(env) && TRUTHY.test(env.LOCAL_CLONE_COST_TAKEOVER ?? '');
}

export function costTakeoverRolloutPercent(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.LOCAL_CLONE_COST_TAKEOVER_PERCENT);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

export function costTakeoverMinAttempts(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.LOCAL_CLONE_COST_TAKEOVER_MIN_ATTEMPTS);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 0; // 0 = allow soft takeover before warm stats exist
}

export function costTakeoverMaxEwmaMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.LOCAL_CLONE_COST_TAKEOVER_MAX_EWMA_MS);
  if (Number.isFinite(n) && n >= 100) return Math.floor(n);
  return localCloneMaxLatencyMs(env);
}

/** Stable 0–99 bucket from an id for percent rollout. */
export function rolloutBucket(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100;
}

export function evaluateCostTakeoverGates(
  health: CostTakeoverHealthSnap[] | undefined,
  env: NodeJS.ProcessEnv = process.env,
): CostTakeoverGateResult {
  const live = isLocalCloneLiveEnabled(env);
  const enabled = isCostTakeoverEnabled(env);
  const maxEwmaMs = costTakeoverMaxEwmaMs(env);
  const minAttempts = costTakeoverMinAttempts(env);
  const rolloutPercent = costTakeoverRolloutPercent(env);
  const reasons: string[] = [];

  if (!live) reasons.push('LOCAL_CLONE_TTS_LIVE is off');
  if (!TRUTHY.test(env.LOCAL_CLONE_COST_TAKEOVER ?? '')) {
    reasons.push('LOCAL_CLONE_COST_TAKEOVER is off');
  }

  const snap = health?.find((h) => h.providerId === 'local_clone');
  if (snap?.breaker === 'open') {
    reasons.push('local_clone circuit breaker is open');
  }
  if (snap && minAttempts > 0 && (snap.attempts ?? 0) < minAttempts) {
    reasons.push(`local_clone needs ≥${minAttempts} warm attempts (have ${snap.attempts ?? 0})`);
  }
  if (
    snap &&
    snap.ewmaLatencyMs !== null &&
    snap.ewmaLatencyMs !== undefined &&
    snap.ewmaLatencyMs > maxEwmaMs
  ) {
    reasons.push(`local_clone EWMA ${Math.round(snap.ewmaLatencyMs)}ms > ${maxEwmaMs}ms gate`);
  }

  const gatesGreen = reasons.length === 0 && enabled;
  return { enabled, live, gatesGreen, reasons, maxEwmaMs, minAttempts, rolloutPercent };
}

/**
 * Soft takeover: EL-configured agents that already have a clone profile id
 * should prefer local_clone (hybrid EL remains as fail-open).
 */
export function shouldSoftPreferLocalClone(params: {
  configuredProvider: string | undefined;
  localCloneVoiceId: string | undefined | null;
  agentId?: string | null;
  health?: CostTakeoverHealthSnap[];
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = params.env ?? process.env;
  if (!params.localCloneVoiceId) return false;
  if (params.configuredProvider === 'local_clone') return true;
  if (params.configuredProvider !== 'elevenlabs') return false;

  const gates = evaluateCostTakeoverGates(params.health, env);
  if (!gates.gatesGreen) return false;

  if (params.agentId && gates.rolloutPercent < 100) {
    if (rolloutBucket(params.agentId) >= gates.rolloutPercent) return false;
  }
  return true;
}
