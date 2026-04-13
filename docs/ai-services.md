# AgentLabs AI Services & Provider Documentation

> Technical reference for all AI services integrated into the AgentLabs platform, their relationships with internal components, data flows, and external provider details.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [External AI Providers](#2-external-ai-providers)
   - [OpenAI](#21-openai)
   - [ElevenLabs](#22-elevenlabs)
   - [AWS Bedrock (Anthropic Claude & Others)](#23-aws-bedrock)
   - [AWS Polly](#24-aws-polly)
   - [Cartesia](#25-cartesia)
   - [Anthropic (Direct SDK)](#26-anthropic-direct-sdk)
3. [Multi-Key Pool Management Systems](#3-multi-key-pool-management-systems)
   - [OpenAI Pool](#31-openai-pool)
   - [ElevenLabs Pool](#32-elevenlabs-pool)
4. [RAG Knowledge System](#4-rag-knowledge-system)
5. [Call Engine AI Integration](#5-call-engine-ai-integration)
   - [Engine 1: ElevenLabs ConvAI](#51-engine-1-elevenlabs-convai)
   - [Engine 2: Twilio + OpenAI Realtime](#52-engine-2-twilio--openai-realtime)
   - [Engine 3: Bedrock-Polly (RockCenter)](#53-engine-3-bedrock-polly-rockcenter)
6. [Voice Synthesis Pipeline](#6-voice-synthesis-pipeline)
7. [Agent Orchestration & Tool Calling](#7-agent-orchestration--tool-calling)
8. [AI Compliance & Violation Detection](#8-ai-compliance--violation-detection)
9. [MCP (Model Context Protocol) Status](#9-mcp-model-context-protocol-status)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Provider–Component Relationship Matrix](#11-providercomponent-relationship-matrix)
12. [Configuration Reference](#12-configuration-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AgentLabs Platform                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        CALL ENGINES                                  │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐   │   │
│  │  │  ElevenLabs     │ │  Twilio-OpenAI   │ │  Bedrock-Polly       │   │   │
│  │  │  ConvAI Engine  │ │  Realtime Engine │ │  (RockCenter) Engine │   │   │
│  │  └────────┬────────┘ └────────┬────────┘ └──────────┬───────────┘   │   │
│  └───────────┼───────────────────┼─────────────────────┼───────────────┘   │
│              │                   │                     │                    │
│  ┌───────────┼───────────────────┼─────────────────────┼───────────────┐   │
│  │           │        AI SERVICE LAYER                 │               │   │
│  │           ▼                   ▼                     ▼               │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌───────────────────────┐   │   │
│  │  │ ElevenLabs     │ │ OpenAI Pool    │ │ AWS Bedrock           │   │   │
│  │  │ Pool Service   │ │ Service        │ │ Service               │   │   │
│  │  │ (Multi-Key LB) │ │ (Multi-Key LB) │ │ (Multi-Model)        │   │   │
│  │  └────────┬───────┘ └────────┬───────┘ └───────────┬───────────┘   │   │
│  │           │                  │                      │               │   │
│  │  ┌────────┴───────┐ ┌───────┴────────┐ ┌──────────┴──────────┐   │   │
│  │  │ ElevenLabs     │ │ OpenAI         │ │ Agent Orchestration │   │   │
│  │  │ Service        │ │ Agent Factory  │ │ Layer               │   │   │
│  │  │ (ConvAI/TTS)   │ │ (Realtime)     │ │ (Tool Registry +   │   │   │
│  │  │                │ │                │ │  Bedrock Converse)  │   │   │
│  │  └────────────────┘ └────────────────┘ └─────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │              SHARED AI SERVICES                              │  │   │
│  │  │                                                              │  │   │
│  │  │  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │  │   │
│  │  │  │ RAG Knowledge│  │ Voice Provider  │  │ AI Violation  │  │  │   │
│  │  │  │ Service      │  │ Service         │  │ Detection     │  │  │   │
│  │  │  │ (Embeddings  │  │ (Multi-Provider │  │ (GPT-4o-mini  │  │  │   │
│  │  │  │  + Vector    │  │  TTS Router)    │  │  + Keywords)  │  │  │   │
│  │  │  │  Search)     │  │                 │  │               │  │  │   │
│  │  │  └──────────────┘  └─────────────────┘  └───────────────┘  │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                   TELEPHONY LAYER                                 │   │
│  │   Twilio  ◄──►  Plivo  ◄──►  TCXC                               │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

                    ▼  EXTERNAL AI PROVIDERS  ▼

  ┌────────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐
  │  OpenAI    │  │ ElevenLabs│  │ AWS       │  │ AWS      │  │ Cartesia │
  │            │  │           │  │ Bedrock   │  │ Polly    │  │          │
  │ • Realtime │  │ • ConvAI  │  │           │  │          │  │ • Sonic 3│
  │ • GPT-4o   │  │ • TTS v1  │  │ • Claude  │  │ • Neural │  │ • TTS    │
  │ • Whisper  │  │ • Voices  │  │ • Llama   │  │ • SSML   │  │          │
  │ • Embed    │  │   v2      │  │ • Titan   │  │          │  │          │
  │ • TTS      │  │ • KB Mgmt │  │ • Mistral │  │          │  │          │
  └────────────┘  └───────────┘  └───────────┘  └──────────┘  └──────────┘
```

### How They Connect

- **Call Engines** are the top-level orchestrators that bind telephony events to AI processing. Each engine uses a specific combination of AI providers.
- **Pool Services** manage multiple API keys per provider, distributing load and ensuring high availability.
- **Shared AI Services** (RAG, Voice Provider, Violation Detection) are consumed by all engines as needed.
- **The Voice Provider Service** acts as a unified router that dispatches TTS requests to any of the four supported voice synthesis providers.

---

## 2. External AI Providers

### 2.1 OpenAI

| Attribute | Details |
|-----------|---------|
| **SDK** | `openai` v6.16.0 |
| **Primary Role** | Real-time voice agents, embeddings, content moderation, TTS |
| **API Base** | `https://api.openai.com/v1` (configurable via `AI_INTEGRATIONS_OPENAI_BASE_URL`) |

#### Models Used

| Model | Purpose | Context |
|-------|---------|---------|
| `gpt-4o-realtime-preview` | Real-time voice conversations (Pro tier) | Twilio-OpenAI engine |
| `gpt-4o-mini-realtime-preview` | Real-time voice conversations (Free & Pro tier) | Twilio-OpenAI engine |
| `gpt-4o-mini` | Query expansion, CSV analysis, AI violation detection, semantic reranking | RAG system, product import, compliance |
| `text-embedding-3-small` | Text embeddings (1536 dimensions) | RAG knowledge system |
| `tts-1` / `tts-1-hd` | Text-to-speech synthesis | Voice Provider Service |
| `whisper` | Speech-to-text transcription | Bedrock-Polly audio bridge |

#### Key Integration Points

- **OpenAI Modelfarm** (`server/services/openai-modelfarm.ts`): Resolves API keys with a priority chain: DB (`globalSettings.openai_api_key`) → `OPENAI_API_KEY` env → `AI_INTEGRATIONS_OPENAI_API_KEY` env. Caches resolved key for 30 seconds.
- **OpenAI Agent Factory** (`server/services/openai-agent-factory.ts`): Builds agent configurations for the Realtime API with tools (KB lookup, appointments, forms, webhooks), language-aware system prompts, and flow-compiled configurations.
- **OpenAI Pool** (`server/services/openai-pool.service.ts`): Multi-key management with atomic slot reservation, tier-based model access, and capacity monitoring.

#### Available TTS Voices (OpenAI)

`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`, `ash`, `ballad`, `coral`, `sage`, `verse`

---

### 2.2 ElevenLabs

| Attribute | Details |
|-----------|---------|
| **SDK** | `@elevenlabs/elevenlabs-js` v2.32.0 |
| **Primary Role** | Premium conversational AI agents, high-quality voice synthesis |
| **API Versions** | v1 (`/v1/convai/*` for agents) and v2 (`/v2/voices` for voices) |

#### Capabilities

| Feature | Description |
|---------|-------------|
| **ConvAI Agents** | Full conversational AI lifecycle — create, update, delete agents with node-based workflows |
| **System Tools** | `transfer_to_number`, `language_detection`, `end_call`, `voicemail_detection` |
| **Knowledge Base** | Upload files/URLs/text to ElevenLabs KB, linked via `ask_knowledge` tool |
| **Webhook Tools** | External webhook integrations (e.g., RAG KB lookup) attached at agent root level |
| **Voice Synthesis** | Text-to-speech via `/v1/text-to-speech/{voice_id}` with stability, similarity, and speed controls |
| **Shared Voices** | Browse and add community voices from the ElevenLabs library |
| **Phone Number Sync** | Registers Twilio credentials with ElevenLabs for native call handling |
| **Signed WebSocket URLs** | Temporary authenticated URLs for real-time ConvAI sessions |

#### Key Integration Points

- **ElevenLabs Service** (`server/services/elevenlabs.ts`): ~3,000 lines covering agent CRUD, workflow building, voice management, prompt enhancement, and KB integration.
- **ElevenLabs Pool** (`server/services/elevenlabs-pool.ts`): Multi-key management with atomic slot reservation.

#### Voice Quality Controls

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `voiceStability` | 0–1 | 0.55 | Balance between natural variation and consistency |
| `voiceSimilarityBoost` | 0–1 | 0.85 | How closely output matches the reference voice |
| `voiceSpeed` | 0.5–2.0 | 1.0 | Speech rate multiplier |

---

### 2.3 AWS Bedrock

| Attribute | Details |
|-----------|---------|
| **SDK** | `@aws-sdk/client-bedrock-runtime` v3.982.0 |
| **Primary Role** | Multi-LLM reasoning, knowledge synthesis, semantic reranking |
| **Default Region** | `us-east-1` (configurable via `AWS_REGION`) |

#### Supported Models

| Alias | Model ID | Provider | Tier | Context Window |
|-------|----------|----------|------|----------------|
| `claude-sonnet-4-6` | `us.anthropic.claude-sonnet-4-6` | Anthropic | Premium | 200K |
| `claude-opus-4-5` | `us.anthropic.claude-opus-4-5-20251101-v1:0` | Anthropic | Premium | 200K |
| `claude-opus-4` | `us.anthropic.claude-opus-4-20250514-v1:0` | Anthropic | Premium | 200K |
| `claude-sonnet-4` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Anthropic | Premium | 200K |
| `claude-3-7-sonnet` | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` | Anthropic | Premium | 200K |
| `claude-3-5-sonnet-v2` | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | Anthropic | Premium | 200K |
| `claude-3-5-haiku` | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | Anthropic | Standard | 200K |
| `claude-3-haiku` | `anthropic.claude-3-haiku-20240307-v1:0` | Anthropic | Standard | 200K |
| `claude-3-opus` | `us.anthropic.claude-3-opus-20240229-v1:0` | Anthropic | Premium | 200K |
| `titan-text-express` | `amazon.titan-text-express-v1` | Amazon | Budget | 8K |
| `titan-text-lite` | `amazon.titan-text-lite-v1` | Amazon | Budget | 4K |
| `llama-3-8b` | `meta.llama3-8b-instruct-v1:0` | Meta | Budget | 8K |
| `llama-3-70b` | `meta.llama3-70b-instruct-v1:0` | Meta | Standard | 8K |
| `mistral-7b` | `mistral.mistral-7b-instruct-v0:2` | Mistral AI | Budget | 8K |
| `mixtral-8x7b` | `mistral.mixtral-8x7b-instruct-v0:1` | Mistral AI | Standard | 32K |

#### Task-Based Model Selection

| Task | Default Model | Description |
|------|---------------|-------------|
| `synthesis` | `claude-opus-4-5` | Document synthesis, knowledge processing |
| `reasoning` | `claude-sonnet-4-6` | Complex reasoning, primary voice agent LLM |
| `rerank` | `claude-sonnet-4-6` | Semantic reranking of search results |
| `quick` | `claude-3-5-haiku` | Fast tasks, classification, short responses |

#### Large Context Handling

The `invokeWithLargeContext` method handles documents exceeding a model's single-pass limit:

1. Estimates token count (4 chars ≈ 1 token)
2. If within 85% of context limit → single-pass mode
3. If exceeding → splits into chunks (~150K tokens each, 5% overlap)
4. Processes each chunk with extraction prompts
5. Synthesizes all chunk results into a unified response
6. If synthesis exceeds limits → recursive condensation

#### Key Integration Points

- **AWSBedrockService** (`server/services/aws-bedrock.ts`): Core wrapper supporting Anthropic, Titan, Llama, and Mistral model families via `InvokeModelCommand`.
- **Bedrock Converse** (`server/services/agent-orchestration/bedrock-converse.ts`): Streaming conversations via `ConverseStreamCommand` with native tool calling.
- **Bedrock Knowledge Base** (`server/services/bedrock-knowledge-base.service.ts`): Per-user S3-backed vector stores via OpenSearch Serverless.

---

### 2.4 AWS Polly

| Attribute | Details |
|-----------|---------|
| **SDK** | `@aws-sdk/client-polly` |
| **Primary Role** | Cost-effective text-to-speech for voice calls |
| **Default Engine** | Neural |
| **Supported Formats** | MP3, OGG Vorbis, PCM |

#### Features

- **100+ voices** across 35+ languages
- **Engine types**: Standard, Neural, Long-Form, Generative
- **SSML support** with humanization pipeline (`ssml-humanizer.ts`)
- **Streaming synthesis** for real-time call audio
- **Regional client support** for low-latency synthesis

#### Key Integration Points

- **AWSPollyService** (`server/services/aws-polly.ts`): Core wrapper for voice listing, speech synthesis, and streaming.
- **Audio Bridge** (`server/engines/twilio-bedrock-polly/services/audio-bridge.service.ts`): Converts Polly output to mu-law encoding for Twilio WebSocket streaming.

---

### 2.5 Cartesia

| Attribute | Details |
|-----------|---------|
| **SDK** | `@cartesia/cartesia-js` v3.0.0 |
| **Primary Role** | Ultra-low latency TTS for real-time conversations |
| **Default Model** | `sonic-3` |

#### Features

- **Ultra-low latency** (~200ms) — optimal for natural conversational flow
- **16 languages** supported (en, es, fr, de, pt, zh, ja, ko, hi, it, pl, tr, ru, nl, sv, ar)
- **Emotional controls**: anger, positivity, surprise, sadness, curiosity
- **Speed adjustment**: configurable speech rate
- **Output**: Raw PCM (pcm_s16le) — converted to WAV for previews, mu-law for Twilio

#### Fallback Behavior

In the Bedrock-Polly engine, if Cartesia synthesis fails during a call, the system automatically falls back to AWS Polly to maintain conversation continuity.

#### Key Integration Points

- **CartesiaTTSService** (`server/services/cartesia-tts.ts`): Core wrapper for voice listing and speech synthesis.
- **Deprock Routes** (`server/routes/deprock-routes.ts`): REST API endpoints for voice listing and previews.

---

### 2.6 Anthropic (Direct SDK)

| Attribute | Details |
|-----------|---------|
| **SDK** | `@anthropic-ai/sdk` v0.72.1 |
| **Primary Role** | Available for direct Claude API access (currently Bedrock is the primary channel) |

The direct Anthropic SDK is installed but the platform primarily accesses Claude models through AWS Bedrock, which provides unified billing, IAM-based access control, and marketplace model access. The direct SDK serves as a fallback or for scenarios where Bedrock is unavailable.

---

## 3. Multi-Key Pool Management Systems

Both OpenAI and ElevenLabs use identical pool architectures for managing multiple API keys with high availability.

### 3.1 OpenAI Pool

**Service**: `OpenAIPoolService` (`server/services/openai-pool.service.ts`)
**Infrastructure**: `OpenAIPoolManager` (`server/infrastructure/openai/pool-manager.ts`)
**Database Table**: `openai_credentials`

#### Pool Architecture

```
┌──────────────────────────────────────────────────┐
│              OpenAI Pool Service                  │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │          Credential Selection             │   │
│  │  1. Check agent-assigned credential       │   │
│  │  2. Fall back to least-loaded (auto)      │   │
│  │  3. Filter by model tier (free/pro)       │   │
│  └───────────────────┬───────────────────────┘   │
│                      │                            │
│  ┌───────────────────▼───────────────────────┐   │
│  │        Atomic Slot Reservation            │   │
│  │  SQL: UPDATE ... WHERE id = (             │   │
│  │    SELECT id ... WHERE is_active = true   │   │
│  │    AND current_load < max_concurrency     │   │
│  │    ORDER BY utilization ASC               │   │
│  │    FOR UPDATE SKIP LOCKED                 │   │
│  │  ) RETURNING *                            │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │         Capacity Monitoring               │   │
│  │  80% → Notice notification                │   │
│  │  90% → Warning notification               │   │
│  │  95% → Critical notification              │   │
│  │  Throttled: 1 notification per 4 hours    │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │         Health Checks                     │   │
│  │  Periodic validation via /v1/models       │   │
│  │  Marks keys healthy/unhealthy             │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

#### Model Tier Restrictions

| Tier | Allowed Models |
|------|----------------|
| **Pro** | `gpt-4o-realtime-preview`, `gpt-4o-mini-realtime-preview` |
| **Free** | `gpt-4o-mini-realtime-preview` only |

#### Load Balancing Strategy

1. **Primary**: Sort by utilization ratio (`current_load / max_concurrency`) ascending
2. **Tie-breaker**: Sort by `total_assigned_agents` ascending (agent density)
3. **Threshold**: >10% utilization difference is considered significant

#### WebSocket Connection Pool Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `max_openai_connections_per_credential` | 50 | Max concurrent WebSocket connections per key |
| `openai_connection_timeout_ms` | 3,600,000 (1 hr) | Max connection lifetime |
| `openai_idle_timeout_ms` | 300,000 (5 min) | Idle connection timeout |

---

### 3.2 ElevenLabs Pool

**Service**: `ElevenLabsPoolService` (`server/services/elevenlabs-pool.ts`)
**Database Table**: `eleven_labs_credentials`

The ElevenLabs pool follows the same architecture as the OpenAI pool:

- **Atomic Slot Reservation**: Same `FOR UPDATE SKIP LOCKED` pattern
- **Load Balancing**: Identical utilization + agent density strategy
- **Capacity Monitoring**: Same 80/90/95% threshold notifications, 4-hour throttle
- **Health Checks**: Validates both v2 voices and v1 agents endpoints
- **Auto-Sync**: Reassigns orphaned agents (no key or inactive key) to active credentials

#### Per-Credential Fields

| Field | Description |
|-------|-------------|
| `apiKey` | ElevenLabs API token |
| `webhookSecret` | For verifying ElevenLabs webhook signatures |
| `maxConcurrency` | Maximum simultaneous calls |
| `currentLoad` | Active call count |
| `totalAssignedAgents` | Number of agents using this key |
| `totalAssignedUsers` | Number of users on this key |
| `maxAgentsThreshold` | Soft limit for agent assignments |
| `healthStatus` | `healthy` or `unhealthy` |

---

## 4. RAG Knowledge System

**Service**: `RAGKnowledgeService` (`server/services/rag-knowledge.ts`)
**Toggle**: `USE_RAG_KNOWLEDGE=true`

The RAG system is independent of ElevenLabs' built-in knowledge base. It provides scalable, provider-agnostic knowledge retrieval for all call engines.

### Pipeline Architecture

```
  User Query
      │
      ▼
  ┌────────────────────┐
  │ Intent Classification│  ──►  faq | product | support | general
  │ (Regex + Keywords)   │
  └────────┬─────────────┘
           │
           ▼
  ┌────────────────────┐
  │ Query Expansion    │  ──►  GPT-4o-mini generates 3–4 alternative queries
  │ (if ≤10 words or   │       + English translation for non-Latin scripts
  │  conversational)    │       Cached in LRU (200 entries, 5 min TTL)
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Embedding Generation│  ──►  OpenAI text-embedding-3-small (1536 dims)
  │ (Batch, max 100)    │       Cached in LRU (1000 entries, 10 min TTL)
  └────────┬────────────┘       Keyed by SHA-256 hash of text
           │
           ▼
  ┌────────────────────────────────────────┐
  │         HYBRID SEARCH                   │
  │                                         │
  │  ┌──────────────┐  ┌──────────────┐    │
  │  │ Vector Search │  │ BM25 Keyword │    │
  │  │ (Cosine Sim.) │  │ Search       │    │
  │  │ pgvector HNSW │  │              │    │
  │  │ or JS fallback│  │              │    │
  │  └──────┬───────┘  └──────┬───────┘    │
  │         │                  │            │
  │         └────────┬─────────┘            │
  │                  ▼                      │
  │  ┌──────────────────────────┐           │
  │  │ Reciprocal Rank Fusion   │           │
  │  │ (k=60)                   │           │
  │  └──────────┬───────────────┘           │
  └─────────────┼───────────────────────────┘
                │
                ▼
  ┌────────────────────┐
  │ Semantic Reranking │  ──►  Bedrock (Claude) or GPT-4o-mini fallback
  │ (LLM-based)        │       Re-evaluates top candidates for relevance
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │ Answer Extraction  │  ──►  LLM generates natural, voice-optimized response
  │ (Voice-optimized)  │       (avoids URLs, uses contractions, natural phrasing)
  └────────────────────┘
```

### Search Tiers

| Tier | Condition | Source | Min Relevance |
|------|-----------|--------|---------------|
| 1 | Intent is `faq`, `product`, or `support` | `knowledgeFaqs` table | 0.50 |
| 2 | Always (primary search) | `knowledgeChunks` table (hybrid vector + BM25) | 0.45 |
| 3 | No chunks found | `knowledgeBase` table (raw keyword search) | 0.30 |

### Document Processing

- **Chunking**: Max 2,000 characters per chunk (`MAX_CHUNK_CHARS`), 50-character overlap (`CHUNK_OVERLAP`), base chunk size 500 chars (`CHUNK_SIZE`)
- **Structure-aware splitting**: Respects headings, Q&A pairs, tables, and lists (see `splitIntoSections()`, `splitQAPairs()`)
- **Storage limit**: 20 MB per user (configurable via `userKnowledgeStorageLimits`)

### pgvector Optimization

- **Column**: `embedding_vec vector(1536)` with HNSW index
- **Performance**: <2s queries (vs 30s+ with JSONB cosine similarity)
- **Fallback**: If pgvector query fails, automatically falls back to JSONB search with 3s timeout
- **Sync**: DB trigger auto-syncs new JSONB embeddings to pgvector format
- **Retry**: pgvector setup retries every 60s on failure

### Caches

| Cache | Max Size | TTL | Purpose |
|-------|----------|-----|---------|
| `embeddingCache` | 1,000 | 10 min | OpenAI embedding vectors |
| `queryExpansionCache` | 200 | 5 min | Expanded query alternatives |
| `searchResultCache` | 100 | 1 min | Search results for repeated queries |

---

## 5. Call Engine AI Integration

### 5.1 Engine 1: ElevenLabs ConvAI

**The primary engine for high-quality voice conversations.**

```
  Inbound/Outbound Call (Twilio/Plivo)
      │
      ▼
  ┌──────────────────────────────┐
  │  ElevenLabs ConvAI Platform  │  ◄── Handles STT + LLM + TTS internally
  │                              │
  │  Agent Config:               │
  │  • System prompt             │
  │  • Voice ID + quality params │
  │  • Node-based workflow       │
  │  • Tools (system + webhook)  │
  │  • Knowledge base (EL-native │
  │    or RAG webhook)           │
  └──────────────────────────────┘
      │
      ▼
  Audio Stream ◄──► Twilio/Plivo WebSocket
```

**AI Services Used**: ElevenLabs (ConvAI LLM, TTS, STT) — a fully managed pipeline. Optionally enhanced with AgentLabs RAG via webhook tools.

---

### 5.2 Engine 2: Twilio + OpenAI Realtime

**Low-latency voice agent using OpenAI's Realtime API.**

```
  Call (Twilio)
      │
      ▼
  ┌──────────────────────────────┐
  │  Twilio WebSocket            │
  │  (Media Stream)              │
  └──────────┬───────────────────┘
             │ Audio
             ▼
  ┌──────────────────────────────┐
  │  OpenAI Realtime API         │  ◄── gpt-4o-realtime-preview
  │  (WebSocket Session)         │      or gpt-4o-mini-realtime-preview
  │                              │
  │  Built-in:                   │
  │  • STT (Whisper)             │
  │  • LLM (GPT-4o)             │
  │  • TTS (integrated)         │
  │                              │
  │  Tools:                      │
  │  • lookup_knowledge_base     │──► RAG Knowledge Service
  │  • book_appointment          │──► Appointments DB
  │  • submit_form_data          │──► Form Submissions
  │  • dynamic_form_tools        │──► Dynamic Form Service
  │  • webhook_tool              │──► External APIs
  └──────────────────────────────┘
```

**AI Services Used**: OpenAI (Realtime API with integrated STT/LLM/TTS), RAG via OpenAI embeddings.

---

### 5.3 Engine 3: Bedrock-Polly (RockCenter)

**Multi-LLM, multi-TTS engine with maximum flexibility.**

```
  Call (Twilio)
      │
      ▼
  ┌──────────────────────────────┐
  │  Twilio WebSocket            │
  │  (mu-law audio stream)       │
  └──────────┬───────────────────┘
             │
             ▼
  ┌──────────────────────────────┐
  │  Audio Bridge Service        │
  │                              │
  │  1. INGESTION                │
  │     mu-law audio from Twilio │
  │                              │
  │  2. VAD + STT                │
  │     Silence detection        │
  │     OpenAI Whisper ──────────│──► OpenAI API
  │                              │
  │  3. INFERENCE                │
  │     Bedrock Converse API ────│──► AWS Bedrock (Claude)
  │     Native tool calling      │
  │     Tool Registry execution  │
  │                              │
  │  4. TTS (Multi-Provider)     │
  │     ┌── AWS Polly ───────────│──► AWS Polly API
  │     ├── ElevenLabs ──────────│──► ElevenLabs TTS API
  │     └── Cartesia ────────────│──► Cartesia Sonic API
  │     (with automatic fallback)│
  │                              │
  │  5. BARGE-IN                 │
  │     Energy-based detection   │
  │     Stops AI speech if user  │
  │     starts talking           │
  └──────────────────────────────┘
```

**AI Services Used**: OpenAI (Whisper STT), AWS Bedrock (Claude LLM), AWS Polly / ElevenLabs / Cartesia (TTS), RAG Knowledge Service.

---

## 6. Voice Synthesis Pipeline

**Service**: `VoiceProviderService` (`server/services/voice-provider.ts`)

The platform supports four TTS providers through a unified interface:

| Provider | Tier | Latency | Languages | Key Strength |
|----------|------|---------|-----------|--------------|
| **AWS Polly** | Budget | Low | 35+ | Cost-effective, SSML support |
| **OpenAI TTS** | Standard | Low | Multi | Simple, HD quality option |
| **Cartesia Sonic** | Standard | Ultra-low (~200ms) | 16 | Real-time conversations |
| **ElevenLabs** | Premium | Medium | 29+ | Voice cloning, ultra-realistic |

### Fallback Chain (Bedrock-Polly Engine)

```
  TTS Request
      │
      ├── Try Primary Provider (user-configured)
      │   │
      │   ├── Success → Return audio
      │   │
      │   └── Failure ──┐
      │                 │
      │   ┌─────────────▼──────────────┐
      │   │  Fallback to AWS Polly     │
      │   │  (Always available as      │
      │   │   guaranteed fallback)      │
      │   └────────────────────────────┘
```

---

## 7. Agent Orchestration & Tool Calling

### Tool Registry

**Service**: `ToolRegistry` (`server/services/agent-orchestration/tool-registry.ts`)

The Tool Registry provides a unified interface for defining and managing tools that AI models can call during conversations.

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
  handler?: (params: Record<string, unknown>) => Promise<unknown>;
}
```

#### Standard Tools Available

| Tool | Description | Engines |
|------|-------------|---------|
| `lookup_knowledge_base` | RAG search across knowledge bases | All |
| `book_appointment` | Schedule appointments with validation | All |
| `submit_form_data` | Submit form data collected during call | All |
| `list_available_forms` | Discover existing forms | All |
| `submit_dynamic_form` | Create ad-hoc forms | All |
| `transfer_to_number` | Transfer call to human agent | ElevenLabs, Bedrock-Polly |
| `end_call` | Gracefully terminate call | ElevenLabs |
| `language_detection` | Detect and switch languages | ElevenLabs |
| `webhook_tool` | Call external APIs | All |

### Bedrock Converse API (Native Tool Calling)

**Service**: `bedrock-converse.ts` (`server/services/agent-orchestration/bedrock-converse.ts`)

Uses AWS Bedrock's native `ConverseStreamCommand` for structured tool calling:

1. **Stream Events**: Yields `LLMStreamEvent` objects:
   - `{ type: 'text', text: string }` — Text response delta
   - `{ type: 'tool_call', toolCall: StructuredToolCall }` — Tool invocation request
   - `{ type: 'done', stopReason, inputTokens, outputTokens }` — Stream complete

2. **Tool Execution Loop**:
   - Model emits `tool_call` event with tool name + parameters
   - System executes the handler from the Tool Registry
   - Results fed back via `converseWithToolResults` using `ConverseCommand`
   - Model generates final response incorporating tool results

3. **Format Conversion**: `toBedrockToolSpecs()` converts internal `ToolDefinition` objects into Bedrock-compatible `toolSpec` format.

### Legacy Text-Marker Fallback

The older `[TOOL_CALL]` text-parsing approach is retained as a fallback for edge cases where structured tool calling is unavailable. The system parses `[TOOL_CALL]tool_name:{"param":"value"}[/TOOL_CALL]` markers from LLM text output.

---

## 8. AI Compliance & Violation Detection

The platform uses a dual-tier detection system that runs in parallel when a call transcript becomes available.

### Tier 1: Rule-Based Detection

**Service**: `server/services/violation-detection.ts`

- **Method**: Exact and case-insensitive string matching against the `bannedWords` database table
- **Configuration**: Admin-defined words/phrases with category and severity
- **Auto-blocking**: If a matched word has `autoBlock` enabled, the user account is immediately deactivated (unless admin)
- **Speed**: Near-instant, runs first

### Tier 2: AI-Powered Semantic Analysis

**Service**: `server/services/ai-violation-detection.ts`

- **Model**: `gpt-4o-mini` (temperature: 0.1 for consistency)
- **Response format**: Structured JSON
- **Categories monitored**:

| Category | Description |
|----------|-------------|
| `harassment` | Personal attacks, bullying, intimidation |
| `hate_speech` | Discriminatory language |
| `threats` | Direct or implied threats of harm |
| `profanity` | Excessive profane language or slurs |
| `scam` | Fraudulent attempts, phishing |
| `inappropriate` | Sexual or explicit material |

- **Severity levels**: `low`, `medium`, `high`, `critical`
- **Auto-action**: `critical` severity → automatic user account block
- **Intelligence**: Instructed to ignore normal business frustration, declined offers, etc.
- **Storage**: All violations stored in `content_violations` table with `pending` status for admin review

### Execution Flow

```
  Call Ends → Transcript Available
      │
      ├──► Rule-Based Detection (parallel)
      │    └── Keyword matching → bannedWords DB
      │
      └──► AI Analysis (parallel)
           └── GPT-4o-mini semantic analysis
           │
           └── Severity = critical?
               ├── Yes → Auto-block user
               └── No  → Store for admin review
```

---

## 9. MCP (Model Context Protocol) Status

| Aspect | Status |
|--------|--------|
| **SDK Installed** | `@modelcontextprotocol/sdk` v1.26.0 |
| **Implementation** | Not yet active — no imports or server/client usage in production code |
| **Current Alternative** | Custom Tool Registry + AWS Bedrock Knowledge Bases + Universal Webhook Tool |
| **Future Integration Point** | `server/services/agent-orchestration/tool-registry.ts` — the most likely candidate for MCP Client support |

The MCP SDK is installed and ready for future integration. Currently, external data sources and tools are connected via:
- **Tool Registry**: Internal tool definitions with handlers
- **AWS Bedrock Knowledge Bases**: S3-backed vector stores for document retrieval
- **Universal Webhook Tool**: Dynamic external API connections

---

## 10. Data Flow Diagrams

### Outbound Call Flow (Bedrock-Polly Engine)

```
  Campaign Queue
      │
      ▼
  Twilio API (make call)
      │
      ▼
  Twilio WebSocket (media stream)
      │
      ▼
  Audio Bridge Service
      │
      ├──1. Receive mu-law audio
      │
      ├──2. VAD silence detection
      │     └── User stopped speaking?
      │
      ├──3. STT via OpenAI Whisper
      │     └── Audio → Text transcript
      │
      ├──4. Bedrock Claude (Converse API)
      │     ├── System prompt + conversation history
      │     ├── Tool calls? ──► Tool Registry ──► Execute handler
      │     │   └── KB lookup? ──► RAG Service ──► OpenAI Embeddings ──► pgvector search
      │     └── Generate text response
      │
      ├──5. TTS (AWS Polly / ElevenLabs / Cartesia)
      │     └── Text → mu-law audio
      │
      └──6. Stream audio back to Twilio WebSocket
             └── Barge-in detection (stop if user speaks)
```

### Knowledge Base Query Flow

```
  Agent asks KB tool
      │
      ▼
  RAGKnowledgeService.enhancedSearch()
      │
      ├── classifyQueryIntent() → faq | product | support | general
      │
      ├── needsQueryExpansion()? → expandQuery() via GPT-4o-mini
      │
      ├── generateEmbeddingBatch() → OpenAI text-embedding-3-small
      │
      ├── Tier 1: FAQ search (if faq/product/support intent)
      │   └── Vector similarity on knowledgeFaqs table
      │
      ├── Tier 2: Hybrid chunk search
      │   ├── pgvector SQL cosine search (HNSW index)
      │   ├── BM25 keyword scoring
      │   └── Reciprocal Rank Fusion (k=60)
      │
      ├── Tier 3: Direct content fallback (if no chunks)
      │   └── Keyword search on raw knowledgeBase table
      │
      ├── semanticRerank() → Bedrock Claude or GPT-4o-mini
      │
      └── extractAnswer() → Voice-optimized natural language response
```

---

## 11. Provider–Component Relationship Matrix

| Internal Component | OpenAI | ElevenLabs | AWS Bedrock | AWS Polly | Cartesia |
|---|:---:|:---:|:---:|:---:|:---:|
| **Twilio-OpenAI Engine** | ● LLM, STT, TTS | | | | |
| **ElevenLabs ConvAI Engine** | | ● LLM, STT, TTS | | | |
| **Bedrock-Polly Engine** | ● STT (Whisper) | ○ TTS (optional) | ● LLM (Claude) | ● TTS (primary) | ○ TTS (optional) |
| **RAG Knowledge Service** | ● Embeddings, Query Expansion | | ○ Reranking | | |
| **AI Violation Detection** | ● GPT-4o-mini | | | | |
| **Voice Provider Service** | ○ TTS | ○ TTS | | ○ TTS | ○ TTS |
| **OpenAI Pool Service** | ● Key management | | | | |
| **ElevenLabs Pool Service** | | ● Key management | | | |
| **Agent Orchestration** | | | ● Converse API | | |
| **Product CSV Import** | ● GPT-4o-mini | | | | |
| **KB Use Case Generation** | ● GPT-4o-mini | | | | |
| **Knowledge Synthesis** | | | ● Claude (synthesis) | | |

**Legend**: ● = Primary dependency | ○ = Optional/fallback dependency

---

## 12. Configuration Reference

### Environment Variables

| Variable | Provider | Required | Description |
|----------|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | Yes* | Primary OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI | No | Replit AI Integrations fallback key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI | No | Custom base URL for OpenAI-compatible endpoints |
| `ELEVENLABS_API_KEY` | ElevenLabs | Yes* | Default ElevenLabs API key (pool overrides per-call) |
| `AWS_ACCESS_KEY_ID` | AWS | Yes | AWS IAM access key for Bedrock + Polly (env var only, no DB fallback) |
| `AWS_SECRET_ACCESS_KEY` | AWS | Yes | AWS IAM secret key (env var only, no DB fallback) |
| `AWS_REGION` | AWS | No | AWS region (default: `us-east-1`) |
| `CARTESIA_API_KEY` | Cartesia | No | Cartesia Sonic API key |
| `USE_RAG_KNOWLEDGE` | Internal | No | Enable RAG knowledge system (`true`/`false`) |

\* Can be configured via Admin Panel (database) instead of environment variables. See "Credential Resolution by Service" below for exact fallback chains per service.

### Database Settings (`globalSettings` Table)

| Key | Provider | Description |
|-----|----------|-------------|
| `openai_api_key` | OpenAI | Database-stored OpenAI key (overrides env var) |

### Database Tables (Credential Pools)

| Table | Provider | Description |
|-------|----------|-------------|
| `openai_credentials` | OpenAI | Pool of OpenAI API keys with tier, concurrency, and health tracking |
| `eleven_labs_credentials` | ElevenLabs | Pool of ElevenLabs API keys with concurrency, webhook secrets, and health tracking |

### Credential Resolution by Service

Different internal services resolve API keys through different paths. This section documents the exact resolution chain for each.

**OpenAI — General API** (`server/services/openai-modelfarm.ts` → `resolveOpenAIApiKey()`):
1. `globalSettings` table → key `openai_api_key`
2. Environment variable → `OPENAI_API_KEY`
3. Environment variable → `AI_INTEGRATIONS_OPENAI_API_KEY`
4. Cached for 30 seconds (`KEY_CACHE_TTL_MS`)

**OpenAI — Realtime Voice Calls** (`server/services/openai-pool.service.ts`):
1. Agent-assigned credential from `openai_credentials` pool
2. Least-loaded credential from pool (filtered by model tier)
3. Atomic slot reservation via `FOR UPDATE SKIP LOCKED`

**OpenAI — AI Violation Detection** (`server/services/ai-violation-detection.ts`):
1. First active key from `openai_credentials` table (database pool)
2. Environment variable → `OPENAI_API_KEY`
3. Does **not** use `globalSettings` or `AI_INTEGRATIONS_OPENAI_API_KEY`

**OpenAI — RAG Knowledge System** (`server/services/rag-knowledge.ts`):
1. `globalSettings` table → key `openai_api_key`
2. Environment variable → `OPENAI_API_KEY`
3. Does **not** use `AI_INTEGRATIONS_OPENAI_API_KEY`

**ElevenLabs — Voice Calls** (`server/services/elevenlabs-pool.ts`):
1. Agent-assigned credential from `eleven_labs_credentials` pool
2. Least-loaded credential from pool (atomic slot reservation)
3. Fallback to `ELEVENLABS_API_KEY` environment variable (used by `ElevenLabsService` constructor)

**AWS — Bedrock & Polly** (`server/services/aws-bedrock.ts`, `server/services/aws-polly.ts`, `server/services/agent-orchestration/bedrock-converse.ts`):
1. Environment variables only → `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION`
2. No database-stored credential loading in runtime services
3. Admin AWS credentials endpoint (`/api/internal/admin/aws`) stores credentials for admin UI display/testing, but the runtime services read directly from environment variables

**Cartesia** (`server/services/cartesia-tts.ts`):
1. Environment variable only → `CARTESIA_API_KEY`

---

*Document generated for AgentLabs platform. Last updated: April 2026.*
