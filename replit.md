# AgentLabs AI Calling Platform

## Overview
AgentLabs is a multi-tenant SaaS platform for AI-powered bulk calling, offering comprehensive tools for businesses to automate and optimize outbound and inbound calling operations. It integrates various AI engines, telephony providers, and payment gateways, enabling users to create and manage calling campaigns, utilize AI voice agents with knowledge bases, design conversation flows, and manage contacts. The platform aims to provide a robust solution for advanced AI-driven communication.

## User Preferences
I want to follow an iterative development approach.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations of the code changes and architectural decisions.
Do not make changes to the `shared/schema.ts` file without explicit instruction.
Do not make changes to the `packages/diploy-core/` directory.
Always test every feature or change you implement before marking it complete.

## System Architecture
The application uses a client-server architecture with a React 18, Vite, TypeScript, TailwindCSS, and shadcn/ui frontend, and a Node.js/Express 4.x backend utilizing Drizzle ORM and PostgreSQL.

- **UI/UX**: Modern design inspired by Google Workspace Studio and Microsoft 365, featuring hero sections, template cards, category filtering, stats overviews, and quick action panels. Visual elements include gradients and consistent spacing.
- **Hybrid Navigation System**: Microsoft 365-inspired layout with a slim top bar and a collapsible side rail for main navigation. Sidebar state persists in localStorage.
- **Real-time Communication**: WebSocket connections for real-time voice streaming.
- **Background Processing**: Schedulers manage campaign execution, billing, and cleanup tasks.
- **Modular Design**: Feature modules and engine integrations are organized within `server/modules/` and `server/engines/` respectively.
- **Department Management System**: Manages agents and IVR configurations within departments via a 3-step wizard.
- **Knowledge Base & AI Intelligence**: Integrated knowledge base for AI-powered topic analysis and content generation, with folder-based navigation. Supports "Knowledge Base Only" mode for AI agents.
- **Provider DID Marketplace**: Allows browsing and renting DIDs from various carrier providers.
- **Bedrock + Polly Engine (RockCenter)**: Utilizes AWS Bedrock (Claude 3.5 Sonnet) for AI and multi-provider TTS (AWS Polly or ElevenLabs) with Twilio telephony. Supports both outbound and inbound scenarios, including a unique SSML Humanizer for natural speech. Features distinct "Task-First Framework" for outbound and "Enterprise Framework" for inbound agents.
- **Outbound Agent Prompt Chain**: Rich system prompt generation for outbound agents, including personalized call scripts with `{{variable}}` placeholders, integrated with a 3-phase no-response handling for call lifecycle.
- **Deprock Department System**: Replicates the Department Management system specifically for the Bedrock + Polly engine, using AWS Polly voices and separate configuration via `engineType`.
- **Deprock IVR System (Enterprise-Grade)**: Full Twilio IVR implementation for Bedrock+Polly, supporting dual-input (DTMF + speech), retry logic, fallback departments, and multi-language support. Includes ElevenLabs voice ID to Polly mapping.
- **Inbound/Outbound Call Isolation**: Clean separation of outbound-specific behaviors (e.g., greeting follow-ups, relaxed silence thresholds) from inbound call handling.
- **IVR Call Simulator with Live Voice Conversation**: Browser-based tool for testing IVR flows and interacting with AI agents in real-time, supporting both Deprock and Department IVR configurations.
- **Outbound Canvas**: A 6-step wizard for outbound campaign creation, featuring use case selection, contact management, AI agent & voice configuration, knowledge base integration, AI-generated content, and personalized variables.
- **Contact Import System**: Supports multi-source contact import from CSV/Excel, vCard, Google Contacts, Microsoft Outlook/365, HubSpot CRM, and Salesforce.
- **Live Call Monitoring System**: Real-time supervisor dashboard for monitoring active calls, with WebSocket-based updates, transcript streaming, and role-based access.

## External Dependencies
- **AI Engines**: ElevenLabs, OpenAI Realtime API, Anthropic Claude Sonnet-4-5, AWS Bedrock Claude 3.5 Sonnet.
- **Voice Synthesis**: ElevenLabs, OpenAI TTS, AWS Polly.
- **Telephony Providers**: Twilio, Plivo, TCXC.
- **Payment Gateways**: Stripe, Razorpay, PayPal, Paystack, MercadoPago.
- **Database**: Neon (PostgreSQL).
- **Email**: SMTP.

## Recent Fixes
- **Widget Language + Flow Agent Fixes (Feb 2026)**: Fixed multiple widget issues:
  - Fixed null crash in ephemeral-token endpoint when agent is null (OpenAI path `agent?.openaiModel`)
  - Widget now passes selected language to ElevenLabs via `conversation_initiation_client_data` with language override
  - Server returns language and detectLanguageEnabled in ElevenLabs ephemeral-token response
  - Widget config loading now properly handles server error responses and sets unavailable state
  - OpenAI model from server is now used in WebRTC connection URL instead of hardcoded model
  - Improved ElevenLabs WebSocket error/close handlers with descriptive error messages
  - **IVR handle-selection fix**: Deprock IVR now stores full agent metadata (systemPrompt, firstMessage, language, knowledgeBaseIds, flow agent data, TTS provider, voice config, transfer/booking settings) in call records, matching the pattern used by direct inbound calls. Fixes Arabic language errors and English flow agent connection failures via IVR.
- **Bedrock Agent Conversation Quality Fix (Mar 2026)**:
  - Fixed corrupted Arabic firstMessage for agent "Nasser Al Rashid" in database (garbled "مeee" text replaced with proper Arabic greeting matching Tejwal eSIM billing context)
  - Added script-based language detection to `localizeFirstMessage` — skips unnecessary translation when the message is already in the target language's script (Arabic, Chinese, Japanese, Korean, Hindi, Hebrew, Thai, Russian)
  - Changed `localizeFirstMessage` model from `claude-3-5-sonnet` (unavailable for on-demand Bedrock invocation) to `claude-3-haiku` (available on-demand, sufficient for greeting translation)
  - Fixed OpenAI Whisper API key resolution: `resolveOpenAIKey()` now validates keys against dummy/placeholder patterns before using them, allowing fallthrough to the valid database credential when env vars contain integration placeholder keys
  - Fixed model tier detection: `stream.ts` now looks up user's `planType` from the `users` table and passes `userTier` to `BedrockAgentFactory.createAgentConfig()`, so pro users get claude-3-5-sonnet instead of defaulting to claude-3-haiku
- **Corporate-Grade IVR Upgrade (Mar 2026)**:
  - **Streaming Bedrock + Sentence-Level TTS (T001)**: Replaced buffered `getBedrockResponse()` with `streamBedrockAndSpeak()` that uses `invokeStream` to stream tokens from Bedrock, splits on sentence boundaries (`.!?؟،\n`), and sends each sentence to Polly TTS immediately while the next sentence generates. Reduces first-response latency from 2-4s to ~1s. Single-pass async generator consumption with `toolCallDetected` flag for tool calls.
  - **Audio Pacing & Mark Events (T002)**: Added 10ms delay every 50 audio chunks sent to Twilio for congestion control. Added Twilio `mark` events after each TTS segment with `pendingMarks` tracking for playback completion.
  - **Filler Audio (T003)**: 800ms timer fires a language-aware filler phrase ("لحظة من فضلك", "One moment please", etc.) if the first Bedrock sentence isn't ready yet. Filler completion is awaited before sending real speech to prevent audio overlap. Supports 12 languages.
  - **Warm Transfer (T004)**: Already implemented — `transfer_call` tool in `handleToolCalls`, `executeTransfer` method, and `bedrock-agent-factory` adds transfer tool with phone number metadata.
  - **Call Recording (T005)**: Added Twilio recording initiation to IVR-routed calls (`/handle-selection` and `/fallback` endpoints) via REST API with dual-channel recording. Recording URLs saved via existing `/voice/recording` callback.
  - **Adaptive VAD (T006)**: Noise floor calibration during first 1.5s of call (greeting playback). Trimmed mean of energy samples (10% outlier removal). Dynamic speech threshold = 2.5x noise floor, barge-in threshold = 3x noise floor, with minimum floors (200/250) for clean lines. Per-call calibration maps with proper session cleanup.
- **Retell AI Parity Latency Upgrade (Mar 2026)**:
  - **Smart Turn-Taking (T001)**: Replaced fixed 1200ms silence timer with adaptive 400-600ms timers based on utterance length + energy falloff detection. Short utterances (<8KB) get 600ms, medium (8-16KB) get 500ms, long (16KB+) get 400ms. Energy falloff >70% from peak triggers fast 400ms timer. Tracks peak energy per utterance.
  - **Whisper STT Optimization (T002)**: Added `response_format: 'text'` (skips JSON parsing), `temperature: 0` (deterministic), and `AbortController` to cancel stale requests when new speech arrives. Per-turn timing logs.
  - **Bedrock Warmup + Prompt Compression (T003)**: Pre-warms Bedrock HTTP/2 connection during session creation with minimal invoke. Compressed tool call and voice instructions prompts. Default temperature lowered to 0.3.
  - **Async TTS Queue + Cached Fillers (T004)**: 20-char eager synthesis threshold for first fragment. Filler audio buffers pre-synthesized at session start (3 phrases per language cached as mulaw). Filler playback from cache = 0ms Polly delay. Filler timer reduced from 500ms to 400ms.
  - **Audio Delivery Optimization (T005)**: Chunk size increased from 320 to 640 bytes (fewer WebSocket frames). Synchronous chunk sending via `sendMulawToTwilio` helper eliminates per-chunk async overhead.
  - **Per-Turn Latency Logging (T006)**: `[LATENCY]` log lines per turn with stt, llm_first, tts_start, tts_audio, stream_total breakdowns. Enables Retell-style latency dashboard debugging.
- **10x AI Reasoning & Human-Like Conversations Upgrade (Mar 2026)**:
  - **Bedrock 500k Token Context (T001)**: Added `invokeWithLargeContext()` to `aws-bedrock.ts` for processing inputs up to 500k tokens through intelligent chunking with 5% overlap, per-chunk analysis, and synthesis. Added Claude 3.7 Sonnet and 3.5 Sonnet v2 model aliases. Added `selectModelForTask()` for cost-effective model routing (synthesis/reasoning/quick/rerank). Added `estimateTokenCount()` utility.
  - **Deep Web Scraper (T002)**: New `server/services/deep-scraper.ts` — `DeepScrapeService` that crawls up to 50 sub-pages, 3 levels deep, with sitemap.xml parsing, recursive link discovery, content deduplication (85% Jaccard similarity), and progressive token accumulation up to 500k tokens. Concurrent fetching (5 parallel) with polite delays. Extracts structured content (pricing tables, feature comparisons, team bios, testimonials, case studies).
  - **AI Reasoning Engine (T003)**: New `server/services/reasoning-engine.ts` — 3 reasoning modes: `quick` (single-shot), `deep` (query decomposition + multi-hop retrieval + chain-of-thought + semantic re-ranking), `expert` (deep + self-verification). Includes confidence scoring, context window management (~6000 tokens), reasoning traces for debugging.
  - **Enhanced RAG (T004)**: Upgraded `rag-knowledge.ts` with query expansion (3 variants via Claude), semantic re-ranking (Bedrock-powered relevance scoring), and precise answer extraction. New `enhancedSearch()` method combines vector search + FAQ matching + re-ranking. Retrieves 15 chunks, re-ranks to top 5.
  - **Human-Like Conversation Patterns (T005)**: Upgraded `conversation-states-compiler.ts` system prompts with active listening cues, thinking indicators, empathy patterns (frustration/confusion/urgency/hesitation detection), clarification-over-guessing, conversational memory references, personality consistency, and natural phrasing guidelines.
  - **Knowledge Synthesis Pipeline (T006)**: New `server/services/knowledge-synthesis.ts` — processes raw content via Bedrock to produce: business profiles, 50-100 structured FAQs, decision trees, objection handlers, competitive intelligence, and escalation triggers. `formatAsRAGContent()` converts to RAG-storable text.
  - **Reasoning Engine Integration (T007)**: Wired reasoning engine into voice agent pipeline — hydrator's `createKnowledgeBaseHandler` now uses `ReasoningEngine.process()` with configurable mode. ElevenLabs RAG tool upgraded to use `enhancedSearch()` with re-ranking and answer extraction. Function tool builder enhanced with mandatory knowledge base usage prompts. Graceful fallback to basic RAG on reasoning errors.
  - **API Routes (T008)**: New routes in `rag-knowledge-routes.ts`: `POST /api/rag-knowledge/deep-scrape` (async with progress tracking), `GET /api/rag-knowledge/deep-scrape/:jobId/status`, `POST /api/rag-knowledge/synthesize/:knowledgeBaseId`, `POST /api/rag-knowledge/enhanced-search`. Added `reasoningMode` column to agents table (`quick`/`deep`/`expert`, default `deep`).
  - **Caller Memory (T009)**: New `server/services/conversation-memory.ts` — extracts facts from call transcripts via Claude, stores per phone number, retrieves context for repeat callers, injects into system prompts. New `caller_memory` database table. Hydrator made async to support memory retrieval when `callerPhoneNumber` is provided.
- **Corporate Call Center 10x Upgrade (Mar 2026)**:
  - **Voice-Ready KB Rewrite (T001)**: All 273 KB entries rewritten as spoken-word conversational scripts (not encyclopedia text). Each entry now sounds like a call center agent speaking on the phone — natural contractions, no URLs/bullet points, follow-up suggestions included. All marked with `voiceOptimized: true` metadata.
  - **50 Scenario Scripts (T002)**: New `server/seed-scenario-scripts.ts` with 50 scenario-based conversation scripts across 7 categories: Angry/Frustrated (8), First-Time User (8), Technical Issues (8), Purchase/Billing (8), Escalation Triggers (6), Positive/Upsell (6), Edge Cases (6). Each includes caller profile, emotional state, detection cues, full branching script, and resolution paths.
  - **Sentiment-Adaptive Response Engine (T003)**: Added `detectSentiment()` to reasoning engine — detects frustrated/confused/neutral/happy/urgent from conversation history keywords. `getSentimentToneGuidance()` generates per-sentiment instructions. `adaptAnswerForSentiment()` enforces sentence limits. All 3 reasoning modes (quick/deep/expert) now auto-detect sentiment and inject tone guidance into prompts.
  - **Proactive Follow-Up Intelligence (T004)**: RAG `extractAnswer()` now prompts LLM to suggest one related topic after answering. System prompt includes proactive suggestion rules. Conversation compiler updated with proactive suggestion guidelines.
  - **30 Operational Scripts (T005)**: New `server/seed-operational-scripts.ts` with 30 call center operational scripts: Opening (5), Hold (5), Transfer (5), Verification (5), Closing (5), Compliance (5). Auto-injected into system prompts via `getOperationalScriptsForSystemPrompt()`.
  - **Voice-Optimized Extraction (T006)**: `extractAnswer()` and `formatResultsForAgent()` upgraded with strict voice output rules — no URLs read aloud, lists converted to flowing sentences, jargon replaced with plain language, 4-sentence max, contractions enforced.
  - **Multi-Turn Context Threading (T007)**: New `CallConversationContext` in hydrator tracks topics, questions, answers, and history per call. KB tool handler enriches queries with topic context from earlier in the call. Context cleaned up on `end_call`. Reasoning engine receives full conversation history for coherent multi-turn responses.
  - **Quality Scoring & Auto-Learning (T008)**: New `scoreResponseQuality()` scores responses 0-100 on confidence, search quality, length, voice-readiness, formatting, hedging, and follow-up presence. `learnFromQuery()` only saves responses scoring 60+ as proven scripts. New `/api/rag-knowledge/analytics` endpoint for KB statistics.
  - **Knowledge Base Stats**: 353 total KB entries across 14 folders (including 50 scenarios + 30 operational scripts), 797+ embedded chunks. All voice-optimized.
- **Microsoft Call Center AI-Inspired Upgrade (Mar 2026)**:
  - **Agent Presets (T001+T002)**: New `agent_presets` table with 6 industry-specific templates (Insurance Claims, IT Support, Healthcare Appointments, Sales Follow-up, Customer Service, Real Estate). Each preset bundles system prompt, task description, structured data schema, behavior rules, waiting messages, and voice/model suggestions. Preset selector UI added as first step in Agent Creation Wizard.
  - **Dual LLM Timeout (T003)**: Soft timeout (default 4s) sends a random "please wait" message to keep the caller engaged. Hard timeout (default 15s) gracefully aborts with an apology. Configurable per-agent via `behaviorConfig`. Implemented in Twilio-OpenAI audio bridge.
  - **Agent Behavior Feature Flags (T004)**: New `behaviorConfig` JSONB column on agents with runtime-configurable flags: silence timeout, max questions per turn, discourse markers, recognition retries, VAD settings, callback timeout. New `AgentBehaviorSettings` component in Agent Editor with sliders and toggles. Also includes editable waiting messages.
  - **Structured Data Extraction (T005)**: New `dataSchema` JSONB column on agents for defining fields to extract during calls (like Microsoft's claim schemas). Auto-generates "Required Data to Collect" in system prompt. Adds `update_collected_data` tool for real-time data capture. Post-call summary includes structured data report. RAG queries enhanced with data collection status context.
  - **Conversation Resumption (T006)**: New call fields: `resumable`, `lastDisconnectedAt`, `conversationContext`, `resumedFromCallId`. `ConversationResumptionService` checks for resumable calls when same phone number calls back within timeout window (default 3h). Generates resumption prompt with previous discussion summary. Auto-marks calls as resumable on disconnection.
- **Human-Like Reasoning & Comprehension Upgrade (Mar 2026)**:
  - **VAD Silence Thresholds Increased**: OpenAI engines (Twilio/Plivo) silence_duration_ms 700ms→1000ms, threshold 0.6→0.7, prefix_padding 400→500ms, eagerness medium→low. Bedrock+Polly short/medium/long silence 800/600/500→1200/1000/800ms, opening silence 1800→2200ms.
  - **Barge-in Sensitivity Reduced**: Bedrock+Polly speech energy threshold 500→600, barge-in threshold 600→800, min barge-in bytes 8000→12000. Prevents agent from cutting off mid-sentence too easily.
  - **Comprehension-First Prompts**: All 3 engines (Twilio OpenAI, Plivo OpenAI, Bedrock+Polly) now inject "CRITICAL CONVERSATION BEHAVIOR" instructions — agent must acknowledge/restate what caller asked before answering, ask clarifying questions when unsure, break answers into 2-3 sentences then pause.
  - **Reasoning Engine Upgraded**: Both `singleShotAnswer` (quick mode) and `chainOfThoughtAnswer` (deep/expert mode) prompts now enforce comprehension phase — "What is the caller REALLY asking?" with structured thinking steps. Temperature raised 0.4→0.5 for more natural variation.
  - **KB Tool Query Refinement**: `lookup_knowledge_base` tool description now requires the agent to rephrase caller's question clearly before searching, not just pass raw/ambiguous text.
  - **Conversation Compiler Enhanced**: Added "Understand Before Responding" as #1 priority behavior, strengthened "Clarification Over Guessing" section (ask if 30%+ unsure), added pacing rules (never dump 5+ sentences, break into shorter exchanges), natural thinking words.