# Voice Quality 90%+ Design (Mixed Twilio OpenAI + Bedrock/Polly)

Date: 2026-04-07  
Status: Proposed baseline (approved by user, pending spec-quality checks)  
Owner: Voice platform

## 1) Objective

Raise production call quality to 90%+ readiness for mixed traffic across:
- Twilio + OpenAI Realtime
- Twilio + Bedrock/Polly

Focus dimensions:
1. Call flow smoothness >= 90
2. Phone phrasing conciseness >= 90 in Arabic, Chinese, English, French, Hindi
3. Premium response latency targets (aggressive)
4. Human-like specialist behavior via dynamic specialist routing at call start
5. Advanced denoising in noisy real-world calls

## 2) Success Metrics (Definition of Done)

## 2.0 Metric Definitions (authoritative)
- Score range: all quality scores are 0-100.
- Source of truth: QA benchmark pipeline in `QaAnalysisService` and gate endpoint.
- Current gate API contract (as-is today):
  - `POST /api/qa/benchmark/gate`
  - Request body fields:
    - `minReadinessScore`
    - `maxTopRiskFrequencyPct`
    - `allowNoData`
    - `limit`
  - Response fields (current minimum):
    - `passed: boolean`
    - `failures: string[]`
    - `thresholdConfig`
    - `summary.avgRetellReadiness: number`
    - `summary.analyzedCalls: number`
    - `regressions.topRisks: Array<{ risk: string; percentage: number }>`
  - Note: current API does not yet return explicit `status`, `failureCodes`, or engine `coverage` objects.
- Target gate API extension (P0 deliverable in this design):
  - Add response fields:
    - `status: "pass" | "fail" | "insufficient_data"`
    - `failureCodes: string[]` (machine-readable failure reasons)
    - `coverage: { mixedTrafficMode: boolean; openaiSharePct: number; bedrockSharePct: number; meetsCoverageRule: boolean }`
    - `evaluationWindow: { limit: number }`
  - Status semantics:
    - `pass`: all blocking criteria pass.
    - `fail`: enough data exists and one or more blocking criteria fail.
    - `insufficient_data`: minimum sample or mixed-traffic engine coverage rule is not satisfied.
- Measurement window: rolling last 200 completed calls OR last 14 days (whichever yields more calls).
- Minimum data requirements:
  - At least 20 analyzed calls overall.
  - At least 10 analyzed calls per language cohort (AR/ZH/EN/FR/HI) before enforcing per-language strict gates.
- Engine coverage rule (blocking in mixed-traffic mode): each engine must contribute at least 20% of analyzed calls; otherwise gate returns `insufficient_data`.
- Mixed-traffic mode definition: both Twilio OpenAI and Twilio Bedrock/Polly receive production calls in the measured window.
- Language cohorting: primary caller language inferred from transcript and language lock state.
- Noisy-call cohort definition: calls with low input signal quality from telephony/noise estimator or repeated ASR uncertainty markers above configured threshold.
- Dimension score definitions for readiness formula (0-100 each):
  - `callFlow`: turn-taking smoothness, timeout recovery, and no stalled loops.
  - `conciseness`: phone-safe short spoken phrasing and overlong-turn penalties.
  - `grounding`: low hallucination risk and confidence-aware factual behavior.
  - `interruption`: barge-in success and stale-audio suppression quality.
  - `emotion`: sentiment adaptation and de-escalation appropriateness.
  - `resolution`: issue completion or timely escalation for blocked intents.
  - `multilingual`: language/dialect consistency and low drift across turns.

### 2.1 Quality Scores
- Overall readiness: >= 90 (weighted score formula below; gating is strict in section 5.2)
- Call flow smoothness: >= 90
- Phone phrasing conciseness: >= 90 per language (AR/ZH/EN/FR/HI)

Weighted readiness formula (0-100):
`readiness = round(0.20*callFlow + 0.18*conciseness + 0.20*grounding + 0.12*interruption + 0.10*emotion + 0.12*resolution + 0.08*multilingual)`

### 2.2 Latency SLO
- Metric: time from `speech_end_ts` to first assistant audio chunk sent to telephony (`first_audio_ts`).
- Population: all turns except explicit tool-heavy turns marked as `external_tool_blocking=true`.
- Targets:
  - p50 < 1.2s
  - p95 < 1.8s

### 2.3 Conversational Reliability
- Unresolved-loop policy: escalate on >2 unresolved loops for same intent.
- Specialist misroute rate: <= 6% (daily rolling).
  - Misroute signal sources: explicit transfer corrections within first 3 turns, agent swap due to wrong specialist tags, or QA misroute annotation.
- Interruption stability:
  - barge-in success rate >= 95%
  - duplicate playback after interruption <= 1.5%
    - Duplicate playback definition: after a barge-in event, assistant repeats >= 70% semantically equivalent content already played in the previous interrupted assistant segment.
    - Aggregation unit: interrupted assistant turns.
    - Window: same rolling window as section 2.0.

### 2.4 Audio Quality
- Denoising acceptance on noisy-call cohort:
  - >= 15% improvement in noisy-call ASR confidence proxy OR >= 12% reduction in repeat prompts.
  - No more than +180ms median added preprocessing latency.
- SNR/quality proxy tracked per call and compared pre/post rollout on same noise buckets.
- ASR confidence proxy definition:
  - Use normalized ASR confidence from transcription service when available.
  - If unavailable, use inverse uncertainty proxy: fewer clarification retries + lower uncertain phrase rate.
  - Improvement is measured against pre-rollout baseline on matched noisy-call cohorts (same engine and language buckets).

## 3) Scope and Non-Goals

### In scope
- Runtime policy orchestration and quality gates
- Dynamic specialist routing at call start
- Human-like response shaping and conciseness controls
- Advanced denoising profiles
- Per-language phone phrasing packs
- Shared metrics and benchmark hardening

### Out of scope
- Full engine rewrite
- New telephony provider migration
- Broad unrelated refactoring

## 4) Architecture Changes

## 4.1 Shared Quality Contract (cross-engine)

Introduce a shared quality contract consumed by both engines:
- Per-turn telemetry:
  - speech_end_ts
  - first_token_ts
  - first_audio_ts
  - tts_start_ts
  - tool_roundtrip_ms
  - interruption_count
  - unresolved_loop_count
  - language_drift_events
- Strict output constraints:
  - Default 1-2 sentence answers
  - Hard cap for long turns
  - Low-confidence grounding policy (clarify/escalate)

Primary integration points:
- `server/engines/twilio-openai/services/audio-bridge.service.ts`
- `server/engines/twilio-bedrock-polly/services/audio-bridge.service.ts`
- `server/services/qa-analysis.service.ts`

## 4.2 Dynamic Specialist Router (start-of-call)

Add a pre-dialog specialist decision stage.

Inputs:
- Initial utterance intent
- Caller history (ANI context)
- Language/dialect signal
- Business-hours routing policy
- Prior unresolved intents

Outputs:
- Target specialist agent
- Route confidence
- Optional triage question requirement

Policy:
- High confidence: direct route to specialist
- Medium confidence: one triage question then route
- Low confidence: route to triage specialist
- Once routed, lock specialist role for the session unless explicit transfer condition is met

Candidate components:
- New shared service: `server/services/specialist-router.service.ts`
- Hook into Twilio stream/call initialization before first assistant response
- Shadow mode first (log-only decisions), then canary enablement

## 4.3 Human-like Response Shaping Layer

Create a deterministic response shaper before TTS output:
- Pattern: acknowledgement + concise answer + next step
- Prohibit written-text artifacts in speech output
- Normalize overlong responses into short spoken chunks
- Keep interruption-safe chunk boundaries

Rules:
- 1-2 sentence default, 3 only when user explicitly asks for detail
- No URLs in spoken output
- No policy/legal boilerplate phrasing
- If uncertain, clearly state uncertainty + safe next step
- Fast-ack interaction rules:
  - Acknowledgement max 7 words.
  - Follow-up answer must extend information (no repetition of acknowledgement content).
  - Only one acknowledgement per turn.
  - Playback composition: fast-ack and final answer are emitted as one assistant turn stream; if late retrieval revises content, cancel and replace remaining stream without replaying the acknowledgement.

## 4.4 Premium Latency Path

For aggressive latency targets:
- Parallelize stages after speech stop:
  - intent classification
  - retrieval warmup
  - specialist confidence updates
- Fast-ack strategy:
  - immediately deliver short acknowledgement while heavy retrieval/tool path continues
- Tight timeout ladder:
  - soft timeout -> short wait phrase
  - hard timeout -> safe fallback + escalation option
- Move non-critical sync work off critical turn path

Latency guardrails:
- Any new preprocessing stage must publish per-turn added latency telemetry.
- Changes fail canary if p95 latency regresses > 150ms from baseline window.

## 4.5 Advanced Denoising Pipeline (highest quality profile)

Add pre-ASR audio enhancement chain for both engines:
- Neural denoise (high-quality profile)
- Echo suppression
- AGC + adaptive noise floor
- Transient noise suppression
- VAD-aware denoise mode switching (speech-preserving during active speech)

Safety fallback:
- If denoise confidence drops or speech distortion is detected, auto-switch to safer denoise profile for that call.

Performance budget:
- Denoise path median overhead budget: <= 180ms
- Denoise path p95 overhead budget: <= 260ms

## 4.6 Multilingual Conciseness Packs

Add language-specific spoken-style contracts and scoring.

Arabic:
- Preserve caller dialect/register (Gulf/Levantine/Egyptian)
- Avoid forced MSA unless caller uses formal register

Chinese:
- Short clauses, direct phrasing, explicit confirmation style

English:
- Plain spoken phrasing, no policy-script tone

French:
- Formal/informal lock consistent with caller style

Hindi:
- Hindi/Hinglish lock based on caller signal, avoid mixed drift unless caller shifts

Per-language acceptance tests:
- Minimum 20 scripted and 20 sampled real-call turns per language before full rollout.

## 5) Benchmark and Gate Hardening

## 5.1 QA Scoring Changes
- Tighten optimistic scoring floors
- Add penalties for:
  - unresolved intent loops
  - low-confidence definitive statements
  - repeated long turns
  - language/dialect drift
- Keep explicit weighted readiness formula documented in QA service and route output

## 5.2 Gate Criteria (blocking)
Fail gate if any:
- overall readiness < 90
- flow smoothness < 90
- any language cohort with enough data has conciseness < 90
- p95 first-audio latency > 1.8s
- specialist misroute rate > 6%
- barge-in success < 95% or duplicate playback > 1.5%
- mixed-traffic mode active and either engine contributes < 20% of analyzed calls

No-data policy:
- If minimum sample requirements are not met, gate result is `insufficient_data` (not pass).
- p50 latency is a non-blocking SLO used for optimization tracking; p95 is blocking.
- Required failure codes for automation (minimum): `insufficient_overall_calls`, `insufficient_language_calls`, `insufficient_engine_coverage`, `readiness_below_target`, `flow_below_target`, `conciseness_below_target`, `latency_p95_exceeded`, `misroute_exceeded`, `bargein_quality_regression`.

## 6) Rollout Strategy

1. Shadow mode for specialist router and denoise scoring (no user impact)
2. Canary by engine x language x denoise profile cohort
3. Compare pre/post for noisy-call subset
4. Promote only if all gates pass in rolling windows
5. Keep rapid rollback switch for denoise profile and router policy

Blast-radius controls:
- Initial canary max 10% of mixed traffic
- Auto-rollback if two consecutive gate windows fail

## 7) Risks and Mitigations

Risk: Over-conciseness harms completeness  
Mitigation: allow user-requested detail mode and chunk expansion

Risk: Aggressive denoise distorts speech  
Mitigation: confidence-based profile fallback per call + overhead budget limits

Risk: Router misclassification at first utterance  
Mitigation: medium/low confidence triage path + quick correction transfer + shadow validation

Risk: Latency optimization causes conversational artifacts  
Mitigation: deterministic acknowledgement template + interruption-safe boundaries + duplicate suppression metrics

## 8) Testing Strategy

### Unit tests
- Specialist routing policy decisions
- Response shaper constraints
- Low-confidence grounding behavior
- Language/dialect lock transitions

### Integration tests
- End-to-end call flow with route -> speak -> interruption -> tool -> close
- Noisy audio fixtures through denoise+ASR path
- Multi-language conversation scripts (AR/ZH/EN/FR/HI)

### Regression tests
- Benchmark batches over recent calls
- Per-dimension score drift tracking
- Gate execution in CI
- Engine parity report (OpenAI vs Bedrock/Polly) per release window

## 9) Implementation Backlog (high-level)

P0:
1. Shared telemetry + stricter QA scoring
2. Runtime low-confidence grounding hard gate
3. Unresolved-loop escalation checkpoint
4. Denoise latency budget instrumentation spike

P1:
5. Dynamic specialist router at call start (shadow -> canary)
6. Response shaping layer (human-like concise spoken form)
7. Premium latency optimizations

P2:
8. Advanced denoising pipeline + fallbacks
9. Multilingual conciseness packs and language-specific constraints
10. Canary rollout and gate-driven promotion

## 10) Acceptance

This design is accepted as the baseline specification for implementation planning once this spec review is approved.
