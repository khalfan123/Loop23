/**
 * Phase 2 local_clone live controls.
 * Preview (browser) only needs BASE_URL; telephony requires LIVE=1.
 */

const TRUTHY = /^(1|true|on|yes)$/i;

export function isLocalCloneBaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.LOCAL_CLONE_TTS_BASE_URL?.trim();
}

/** Telephony / audio-bridge gate — off by default until Phase 0 SLO is green. */
export function isLocalCloneLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isLocalCloneBaseConfigured(env) && TRUTHY.test(env.LOCAL_CLONE_TTS_LIVE ?? '');
}

/**
 * Hard timeout / fail-open threshold for live synthesis (ms).
 * Default 800ms keeps barge-in tolerable; spike script uses 400ms as a stricter gate.
 */
export function localCloneMaxLatencyMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.LOCAL_CLONE_TTS_MAX_LATENCY_MS);
  if (Number.isFinite(n) && n >= 100) return Math.floor(n);
  return 800;
}

export function normalizeLocalCloneBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

/** Fire-and-forget warm request so the first live turn is not a cold start. */
export async function warmLocalCloneSidecar(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!isLocalCloneBaseConfigured(env)) return false;
  const baseRaw = env.LOCAL_CLONE_TTS_BASE_URL!.trim();
  const base = normalizeLocalCloneBaseUrl(baseRaw);
  const apiKey = env.LOCAL_CLONE_TTS_API_KEY || 'none';
  const model = env.LOCAL_CLONE_TTS_MODEL || 'tts-1';
  const voice = env.LOCAL_CLONE_TTS_WARM_VOICE || 'default';
  const timeoutMs = Math.min(localCloneMaxLatencyMs(env), 2000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/octet-stream',
      },
      body: JSON.stringify({
        model,
        voice,
        input: 'Ready.',
        response_format: 'pcm',
      }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    await res.arrayBuffer();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
