#!/usr/bin/env npx tsx
/**
 * Phase 0 latency spike: OpenAI-compatible local clone TTS vs optional ElevenLabs.
 *
 * Usage:
 *   LOCAL_CLONE_TTS_BASE_URL=http://127.0.0.1:3900 \
 *   LOCAL_CLONE_VOICE_ID=default \
 *   npx tsx scripts/spike-local-clone-tts.ts
 *
 * Optional:
 *   LOCAL_CLONE_TTS_API_KEY, LOCAL_CLONE_TTS_MODEL
 *   ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID  (compare TTFB)
 */
const BASE = (process.env.LOCAL_CLONE_TTS_BASE_URL || '').replace(/\/$/, '');
const VOICE = process.env.LOCAL_CLONE_VOICE_ID || 'default';
const MODEL = process.env.LOCAL_CLONE_TTS_MODEL || 'tts-1';
const KEY = process.env.LOCAL_CLONE_TTS_API_KEY || '';
const TEXT =
  process.env.SPIKE_TEXT ||
  'Hello, thanks for calling. How can I help you today?';

async function timeLocalClone(): Promise<{ ttfbMs: number; totalMs: number; bytes: number }> {
  if (!BASE) throw new Error('Set LOCAL_CLONE_TTS_BASE_URL');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (KEY) headers.Authorization = `Bearer ${KEY}`;
  const t0 = performance.now();
  const res = await fetch(`${BASE}/v1/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      input: TEXT,
      voice: VOICE,
      response_format: 'pcm',
    }),
  });
  const ttfbMs = performance.now() - t0;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`local_clone ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const totalMs = performance.now() - t0;
  return { ttfbMs, totalMs, bytes: buf.length };
}

async function timeElevenLabs(): Promise<{ ttfbMs: number; totalMs: number; bytes: number } | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return null;
  const t0 = performance.now();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/pcm',
    },
    body: JSON.stringify({
      text: TEXT,
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    }),
  });
  const ttfbMs = performance.now() - t0;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`elevenlabs ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { ttfbMs, totalMs: performance.now() - t0, bytes: buf.length };
}

async function main() {
  console.log('Spike text:', TEXT.slice(0, 80));
  console.log('Local clone:', BASE || '(missing)');
  const runs = Number(process.env.SPIKE_RUNS || '3');
  const localRuns: Awaited<ReturnType<typeof timeLocalClone>>[] = [];
  for (let i = 0; i < runs; i++) {
    const r = await timeLocalClone();
    localRuns.push(r);
    console.log(`local_clone run ${i + 1}: ttfb=${r.ttfbMs.toFixed(0)}ms total=${r.totalMs.toFixed(0)}ms bytes=${r.bytes}`);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(
    `local_clone avg: ttfb=${avg(localRuns.map((r) => r.ttfbMs)).toFixed(0)}ms total=${avg(localRuns.map((r) => r.totalMs)).toFixed(0)}ms`,
  );

  try {
    const el = await timeElevenLabs();
    if (el) {
      console.log(`elevenlabs: ttfb=${el.ttfbMs.toFixed(0)}ms total=${el.totalMs.toFixed(0)}ms bytes=${el.bytes}`);
    } else {
      console.log('elevenlabs: skipped (set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID to compare)');
    }
  } catch (e) {
    console.warn('elevenlabs compare failed:', e instanceof Error ? e.message : e);
  }

  const avgTtfb = avg(localRuns.map((r) => r.ttfbMs));
  if (avgTtfb > 400) {
    console.warn(
      `WARN: avg TTFB ${avgTtfb.toFixed(0)}ms > 400ms gate — keep local_clone off live path until cold-start/GPU tuned (ADR-001 Phase 0).`,
    );
    process.exitCode = 2;
  } else {
    console.log('OK: avg TTFB within Phase 0 gate (<400ms).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
