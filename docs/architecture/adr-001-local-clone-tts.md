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

## Configuration (Phase 1–2)

```bash
LOCAL_CLONE_TTS_BASE_URL=http://gpu-box:3900   # OpenAI-compatible root (…/v1 inferred)
LOCAL_CLONE_TTS_API_KEY=optional-bearer
LOCAL_CLONE_TTS_MODEL=tts-1                    # or engine id if the server supports it
LOCAL_CLONE_TTS_SAMPLE_RATE=24000              # PCM rate returned by the server

# Phase 2 — hybrid live (off by default; preview/browser only needs BASE_URL)
LOCAL_CLONE_TTS_LIVE=1                         # allow local_clone on telephony audio-bridge
LOCAL_CLONE_TTS_MAX_LATENCY_MS=800             # abort + fail-open to EL/Polly when exceeded
LOCAL_CLONE_TTS_WARM_VOICE=default             # voice id used for process-wide warm ping
```

Agent preference: `voiceProvider: 'local_clone'` with the clone profile id in `openai_voice` (Phase 1, no schema migration). Router maps that to `ttsProvider: 'local_clone'` + `localCloneVoiceId`.

## Phase 3 — Instant Clone product

- Voices UI **Instant Clone** tab: consent copy (`loop9-voice-clone-v1`) + audio upload → `voice_clone_profiles`
- APIs: `GET/POST /api/voice-clones`, `DELETE /api/voice-clones/:id`, `POST /api/voice-clones/:id/preview`, `GET /api/voice-clones/consent`
- Agents column: `local_clone_voice_id` (migration `0016_voice_clone_profiles.sql`)
- Optional remote register: `LOCAL_CLONE_CLONE_URL` (multipart); otherwise a local `lc_*` profile id is issued for sidecar mapping
- Live still requires Phase 2 `LOCAL_CLONE_TTS_LIVE=1`

Legal note: Instant Clone stores consent metadata and samples for audit. Do not embed modified OmniVoice Studio without AGPL compliance or a commercial license.

## Phase 4 — Cost takeover

Soft (runtime) and hard (DB) paths to stop burning ElevenLabs pool characters when a clone profile is available.

```bash
LOCAL_CLONE_COST_TAKEOVER=1                 # master switch (also requires LIVE=1)
LOCAL_CLONE_COST_TAKEOVER_PERCENT=100       # 0–100 agent id rollout bucket
LOCAL_CLONE_COST_TAKEOVER_MIN_ATTEMPTS=0    # require N warm local_clone attempts before soft prefer
LOCAL_CLONE_COST_TAKEOVER_MAX_EWMA_MS=800   # EWMA latency gate (defaults to MAX_LATENCY_MS)
```

- **Soft:** EL agents that already have `localCloneVoiceId` prefer `local_clone` in `buildTTSRouteContext` when gates are green; hybrid EL → Polly fail-open unchanged.
- **Hard (assign + flip):** Instant Clone panel / migrate API permanently moves agents off the EL pool:
  - `GET …/cost-takeover/status` — gate flags + `eligibleCount` / `linkableCount` / `readyProfileCount` / `alreadyOnLocalCloneCount`
  - `GET …/cost-takeover/eligible` — `{ agents, linkable, gates }` (`agents` = already have clone id; `linkable` = all EL agents)
  - `POST …/cost-takeover/migrate` body: `voiceCloneProfileId` | `providerProfileId`, optional `agentIds`, `dryRun`, `force`
  - With a clone id: assign `localCloneVoiceId` / `openaiVoice` onto selected (or all linkable) EL agents, then set `voiceProvider=local_clone`
  - Without a clone id: flip only eligible agents that already have `local_clone_voice_id`
  - Gates red → 409 unless `dryRun` or `force` (ops override)
- Voices UI **Hard cost takeover** panel: pick ready clone → select EL agents → dry run / migrate / force.

Quality gates reuse Phase 2: live flag, circuit breaker, EWMA, latency abort.
