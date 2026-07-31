# ADR-001: AGPL-safe local clone TTS (OmniVoice strategy)

**Status:** Accepted  
**Date:** 2026-07-31  
**Owners:** Voice platform

## Context

[OmniVoice Studio](https://github.com/debpalash/OmniVoice-Studio) is a strong open-source “ElevenLabs alternative” for zero-shot cloning, but it is licensed **AGPL-3.0**. Loop9 cannot fork/modify that Studio into a proprietary SaaS without either:

1. Publishing Loop9’s modifications under AGPL, or  
2. Buying a commercial license from the maintainers.

Loop9 already routes live telephony TTS through `voice-core` (`elevenlabs` → `aws_polly` fallback) and needs μ-law / PCM 8 kHz with low first-audio latency.

## Decision

1. **Do not fork OmniVoice Studio into the Loop9 monorepo.**  
2. Treat any OpenAI-compatible `/v1/audio/speech` endpoint as an optional **`local_clone`** TTS provider behind the existing router.  
3. Run OmniVoice (or another stack) **unmodified** as a GPU sidecar / remote worker, **or** build Loop9’s own stack on **Apache/MIT engines**, **or** negotiate a commercial Studio license later.  
4. Phase rollout: preview/spike → hybrid live with Polly/EL fallback → productized Instant Clone UI → cost takeover.

## Consequences

- Phase 1 unlocks latency/quality spikes and preview synthesis without AGPL product embed.  
- Live replacement stays gated on measured TTFB/concurrency SLOs.  
- Legal/commercial review remains required before shipping a modified OmniVoice network service.

## Phases

| Phase | Goal | Exit criteria |
|-------|------|----------------|
| 0 Spike | GPU box + `/v1/audio/speech` latency vs EL | p50/p95 TTFB documented for 1–2 sentence turns |
| 1 Preview | `local_clone` in voice-core + router (opt-in) | Env-gated; Polly/EL unchanged by default |
| 2 Hybrid live | Warm models; stream into audio-bridge | Meets barge-in SLO or stays off live path |
| 3 Clone product | Consent + upload → profile IDs in Voices UI | Legal + commercial path clear |
| 4 Cost takeover | Route eligible agents off EL pool | GPU utilization + quality gates green |

## Configuration (Phase 1)

```bash
LOCAL_CLONE_TTS_BASE_URL=http://gpu-box:3900   # OpenAI-compatible root (…/v1 inferred)
LOCAL_CLONE_TTS_API_KEY=optional-bearer
LOCAL_CLONE_TTS_MODEL=tts-1                    # or engine id if the server supports it
LOCAL_CLONE_TTS_SAMPLE_RATE=24000              # PCM rate returned by the server
```

Agent preference (when wired): `voiceProvider: 'local_clone'` with the clone profile id in `openai_voice` (Phase 1, no schema migration). Router maps that to `ttsProvider: 'local_clone'` + `localCloneVoiceId`. Requires `LOCAL_CLONE_TTS_BASE_URL` or demotes to Polly.
