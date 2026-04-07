# AgentLabs AI Calling Platform

## Overview
AgentLabs is a multi-tenant SaaS platform designed for AI-powered bulk calling, providing businesses with tools to automate and optimize outbound and inbound calling operations. It integrates various AI engines, telephony providers, and payment gateways. The platform enables users to create and manage calling campaigns, utilize AI voice agents with knowledge bases, design conversation flows, manage contacts, and leverage advanced AI-driven communication for business growth and efficiency.

## User Preferences
I want to follow an iterative development approach.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations of the code changes and architectural decisions.
Do not make changes to the `shared/schema.ts` file without explicit instruction.
Do not make changes to the `packages/diploy-core/` directory.
Always test every feature or change you implement before marking it complete.

## System Architecture
The application employs a client-server architecture. The frontend uses React 18, Vite, TypeScript, TailwindCSS, and shadcn/ui. The backend is built with Node.js/Express 4.x, utilizing Drizzle ORM and PostgreSQL.

-   **UI/UX**: Features an iOS 26-inspired minimal design with frosted glass effects, clean typography (Inter + SF Pro fallback), soft shadows, and translucent borders. It supports full light/dark mode and includes components like hero sections, template cards, and quick action panels.
-   **Hybrid Navigation System**: Incorporates an iOS 26-style frosted glass sidebar with pill-shaped navigation items and persistent state.
-   **Real-time Communication**: Utilizes WebSocket connections for real-time voice streaming.
-   **Background Processing**: Schedulers manage campaign execution, billing, and cleanup tasks.
-   **Modular Design**: Feature modules and engine integrations are organized for scalability and maintainability.
-   **Department Management System**: Manages AI agents and IVR configurations through a guided wizard.
-   **Knowledge Base & AI Intelligence**: Integrates a knowledge base for AI-powered topic analysis and content generation, supporting both local RAG (OpenAI embeddings + PostgreSQL) and per-user AWS Bedrock Knowledge Bases for multimodal content (images, audio, video, PDFs). Cross-language search enabled (MIN_VECTOR_RELEVANCE=0.45, MIN_FALLBACK_RELEVANCE=0.30) with product query detection in all 6 system languages.
-   **System Languages**: Restricted to 6 supported languages: English, Chinese, Hindi, Spanish, French, Arabic. Language selectors across all canvases (Deprock, Department, Agent Editor) and the app UI are locked to these languages only.
-   **Product & Pricing Inventory**: Full product catalog management (`products` table) with CRUD operations, AI-powered CSV bulk import, bulk update, and bulk delete. Features sortable columns (name, price, category, SKU, status), client-side pagination with configurable page size, summary stat cards (total products, in-stock, categories, AI synced), and row selection with "select all" across pages. Products are stored with name, description, price, currency, category, SKU, availability, features, and e-commerce store URL. Auto-synced to the knowledge base so the AI agent can retrieve product/pricing info during calls. CSV import uses AI (OpenAI gpt-4o-mini via Replit AI Integrations) to analyze any CSV structure, intelligently map columns to product fields (supports synonyms like "item"→name, "cost"→price, "type"→category), detect currency from data, and normalize availability values. Multi-step flow: upload/paste/link → AI column mapping review → data preview → batched import with progress bar. Routes at `/api/products` (including `/api/products/ai-analyze-csv`, `/api/products/ai-transform-csv`, `/api/products/bulk-import`, `/api/products/bulk-delete` POST and `/api/products/bulk-update` PATCH). Frontend in Knowledge Base sidebar under "Products & Pricing". Product KB entries are automatically enriched into agent knowledge base searches at runtime via `server/utils/product-kb-enrichment.ts`, ensuring all call engines (ElevenLabs RAG webhook, Twilio-OpenAI, Plivo, Bedrock-Polly) can access product/pricing data even if not explicitly added to the agent's knowledgeBaseIds.
-   **Per-User SMTP Email Setup**: Each user can configure their own SMTP server in Settings > Email Setup (e.g., sales@yourdomain.com). Stores per-user SMTP credentials in `user_smtp_settings` table with save, test, verify, and delete. Routes at `/api/user-smtp`. Used by the AI agent to send emails from the user's domain.
-   **Provider DID Marketplace**: Allows users to browse and rent Direct Inward Dialing (DID) numbers from various carrier providers.
-   **Bedrock + Polly Engine (RockCenter)**: A multi-LLM engine supporting AWS Bedrock (Claude Sonnet 4.6) and OpenAI (gpt-4o, gpt-4o-mini), with multi-provider TTS (AWS Polly, ElevenLabs, or Cartesia Sonic) and Twilio telephony. It supports natural agent behavior for both outbound and inbound scenarios. Uses the **Provider-Agnostic Agent Orchestration Layer** (`server/services/agent-orchestration/`) which replaces the old `[TOOL_CALL]` text marker approach with native structured tool calling: Bedrock uses the Converse API (`ConverseCommand`/`ConverseStreamCommand`) for native `toolUse` blocks, and OpenAI uses native `tool_calls`. The orchestration layer includes a unified `ToolRegistry`, Bedrock Converse API wrapper (`bedrock-converse.ts`), and structured `LLMStreamEvent` types. Legacy `[TOOL_CALL]` text parsing is retained as a fallback for edge cases.
-   **Outbound Agent Prompt Chain**: Generates rich system prompts for outbound agents, including personalized call scripts with variable placeholders and a 3-phase no-response handling mechanism.
-   **Deprock Department System**: A specialized Department Management system for the Bedrock + Polly engine, with a 4-step wizard (Phone Numbers → Voice Provider → Departments → IVR Router) supporting AWS Polly, ElevenLabs, and Cartesia Sonic voice providers. Deprock-created agents are linked via `department_agents` join table and appear on the `/app/agents` page under an "Inbound Deprock" sidebar filter with department badge labels. API endpoint: `GET /api/agents/deprock-linked` returns agent IDs and department mapping (scoped to `engineType='bedrock-polly'` departments only). **Important**: Deprock agents have database type `inbound` (not `incoming`), which the frontend normalizes to `incoming` for display, filtering, sorting, and editing. Deprock agents store voice IDs in the `openaiVoice` field (not `elevenLabsVoiceId`) when `voiceProvider` is `cartesia` or `aws_polly`.
-   **Deprock IVR System (Enterprise-Grade)**: Full Twilio IVR implementation for Bedrock+Polly, supporting dual-input (DTMF + speech), retry logic, fallback departments, multi-language support, and ElevenLabs voice ID mapping.
-   **Inbound/Outbound Call Isolation**: Ensures clear separation of behaviors between outbound and inbound call handling.
-   **IVR Call Simulator with Live Voice Conversation**: A browser-based tool for real-time testing of IVR flows and AI agent interactions.
-   **Outbound Canvas**: A 6-step wizard for creating outbound campaigns, covering use case selection, contact management, AI agent/voice configuration, knowledge base integration, AI-generated content, and personalized variables.
-   **Contact Import System**: Supports multi-source contact import from various platforms including CSV/Excel, vCard, Google Contacts, Microsoft Outlook/365, HubSpot CRM, and Salesforce.
-   **Live Call Monitoring System**: Provides a real-time supervisor dashboard with WebSocket-based updates, transcript streaming, and role-based access.
-   **AI Reasoning Engine**: Implements quick, deep, and expert reasoning modes with query decomposition, multi-hop retrieval, chain-of-thought, semantic re-ranking, confidence scoring, and context window management.
-   **Enhanced RAG**: Upgraded with LRU caching (embeddings, query expansion, search results), batch embedding generation, hybrid BM25+vector search with Reciprocal Rank Fusion, smart intent classification (FAQ/product/support/general), GPT-4o-mini re-ranking fallback when Bedrock unavailable, response quality guardrails with automatic query reformulation on low-confidence results, pgvector SQL-level search with graceful JS fallback, and chain-of-thought agent system prompts. **pgvector optimization**: Native `embedding_vec vector(1536)` column with HNSW index replaces slow JSONB cosine similarity (from 30s+ timeout to <2s). DB trigger auto-syncs new JSONB embeddings to pgvector format. Robust fallback: if pgvector query fails, automatically falls back to JSONB search with 3s timeout. pgvector setup retries every 60s on failure instead of permanent lockout.
-   **Human-Like Conversation Patterns**: System prompts are designed to incorporate active listening, empathy patterns, clarification, conversational memory references, and personality consistency.
-   **Knowledge Synthesis Pipeline**: Processes raw content via Bedrock to produce business profiles, structured FAQs, decision trees, objection handlers, and competitive intelligence.
-   **Caller Memory**: Extracts facts from call transcripts, stores them per phone number, and retrieves context for repeat callers to inject into system prompts.
-   **Corporate Call Center Enhancements**: Includes voice-optimized KB entries, scenario scripts, sentiment-adaptive response engine, proactive follow-up intelligence, operational scripts, and quality scoring for auto-learning.
-   **Microsoft Call Center AI-Inspired Upgrades**: Features agent presets for industry-specific templates, dual LLM timeouts for engagement, configurable agent behavior flags, structured data extraction, and conversation resumption capabilities.
-   **Production Hardening**: Includes robust Whisper Arabic hallucination filters, refined silence thresholds, hardened tool call parsing, truncated response guards, resilient session end handling, and cleanup for stale pending calls.
-   **Human-Like Reasoning & Comprehension**: Features increased VAD silence thresholds, reduced barge-in sensitivity, comprehension-first prompts, refined KB tool queries, and enhanced conversation compilation.
-   **Dynamic Form Collection During Calls**: AI agents can dynamically discover existing forms (`list_available_forms`), select the best match, or auto-create ad-hoc forms (`submit_dynamic_form`) when no form is pre-assigned via the flow builder. Collected data is stored as proper `form_submissions` records. Integrated across all four call engines: Twilio-OpenAI, Plivo, Bedrock-Polly (handler-based tools via `server/services/dynamic-form-tools.ts`) and ElevenLabs (webhook-based tools via `/api/webhooks/elevenlabs/dynamic-form/`). Ad-hoc forms are cached per call to prevent duplicates.
-   **Human Agent Connections**: Supports direct call transfers to human agents, webhook handling for Twilio integration, and cross-feature exclusivity to prevent conflicts between AI and human agent assignments.
-   **Use-Case-Driven Campaign Wizard**: Auto-generates dynamic forms and system prompts based on campaign use cases, supports reference URL import for knowledge base integration, and dynamically updates the frontend wizard.
-   **KB-Driven Auto-Generated Use Cases**: Automatically generates tailored campaign use cases from user knowledge base entries using OpenAI, stored in a dedicated database table, and dynamically displayed in the campaign creation UI.
-   **Real-Time Sentiment Analysis & Flagged Calls**: Provides real-time, keyword/pattern-based sentiment scoring across multiple languages, detects critical sentiments, broadcasts sentiment alerts via WebSockets, and offers a live monitoring UI for flagged calls.

-   **Integrations Admin Panel**: Consolidated at `/app/integrations` with three tabs: Marketplace (browse/search/filter all integration apps by category), My Integrations (connected integrations with status, sync info, and quick actions), and API & Webhooks (webhook configuration and management). The detail view remains at `/app/integrations/:slug`. Full i18n support across 8 locales (en, es, ar, pt, hi, de, fr, zh) under the `integrationsPanel` namespace, with RTL Arabic support. Frontend-only restructure — no backend changes. Component: `IntegrationsPanel.tsx`.

-   **Support Ticket System**: Users create/track support tickets at `/app/settings/support` (auto-fills name/email from profile, branded with company name). Data stored in `support_tickets` and `support_messages` tables. User API at `/api/support/tickets` (JWT auth). Public API at `/api/public/support/*` (secured with `SUPPORT_API_KEY` via `X-API-Key` header) for external admin access. Admin API at `/api/internal/admin/support/*` (secured with `INTERNAL_API_SECRET` via `X-Internal-API-Key` header) with full CRUD, search, filtering, stats, assignment, and categories. Supports statuses: open, in_progress, resolved, closed, on_hold. Route files: `server/routes/support-ticket-routes.ts`, `server/routes/admin/admin-support-routes.ts`. Frontend: `client/src/pages/SupportTicketsPage.tsx`.

-   **Call Intelligence API**: External call analysis storage and retrieval at `/api/call-intelligence/*`. Protected by dual-auth middleware (`requireInternalOrUser`) supporting either JWT or internal API key (`x-internal-api-key` header checked against `INTERNAL_API_SECRET` env var). Endpoints: `GET /calls` (paginated, user-scoped), `GET /calls/:id` (single call + analysis), `GET /insights` (aggregated sentiment, topics, objections, agent scores per user), `GET /stats` (admin-wide stats, internal-key only), `POST /store` (store pre-analyzed call + analysis in a DB transaction). Data stored in `ci_calls` and `ci_analyses` tables. Route file: `server/routes/call-intelligence-routes.ts`.

## UAE Pass Integration
Authentication and registration use UAE Pass OAuth 2.0. The flow:
1. Frontend calls `GET /api/auth/uaepass/authorize` to get the authorization URL
2. User is redirected to UAE Pass staging (`stg-id.uaepass.ae`) for authentication
3. UAE Pass redirects back to `GET /api/auth/uaepass/callback` with an authorization code
4. Server exchanges the code for an access token, fetches user profile, creates/finds user account
5. New users get `kycStatus: 'pending'` and are redirected to `/onboarding` for trade license upload
6. Existing approved users are redirected to `/app`

Environment variables: `UAEPASS_CLIENT_ID`, `UAEPASS_CLIENT_SECRET`, `UAEPASS_BASE_URL`, `UAEPASS_REDIRECT_URI`
Staging credentials: `sandbox_stage` / `sandbox_stage`
Registration is UAE Pass-only (no email/password sign-up). Login supports both email/password (for existing users) and UAE Pass.
Trade license upload uses existing KYC infrastructure (`/api/kyc/upload` + `/api/kyc/submit`).

## Build Versioning System
Current approved baseline: **Build v1.0.2**. Version tracked in `build-version.json` (single source of truth) with major, minor, patch, and build number fields.

**Version management commands:**
- `node scripts/set-version.js build` — Increment build number (v1.0.2 Build 3 → Build 4)
- `node scripts/set-version.js patch` — Increment patch (v1.0.2 → v1.0.3, resets build to 0)
- `node scripts/set-version.js minor` — Increment minor (v1.0.2 → v1.1.0, resets patch & build)
- `node scripts/set-version.js major` — Increment major (v1.0.2 → v2.0.0, resets all)
- `node scripts/set-version.js show` — Display current version
- `node scripts/set-version.js set X.Y.Z` — Set specific version

**Version display:** The full version string (e.g., "v1.0.2 (Build 3)") is shown in the sidebar and settings page via `BUILD_VERSION_FULL` from `client/src/lib/build-version.ts`.

**Rule:** Run `node scripts/set-version.js build` before every forward change to increment the build number.

## External Dependencies
-   **AI Engines**: ElevenLabs, OpenAI (Realtime API, Chat Completions - gpt-4o, gpt-4o-mini), Anthropic Claude, AWS Bedrock (Claude Sonnet 4.6, Opus 4.5, 3.5 Haiku, 3 Sonnet, 3 Opus, 3.7 Sonnet). AWS Bedrock key (`BedrockAPIKey-8cdw`, expires June 17 2126) has access to the **Marketplace model catalog**, enabling use of marketplace-hosted models beyond default foundation models.
-   **Voice Synthesis**: ElevenLabs, OpenAI TTS, AWS Polly, Cartesia Sonic.
-   **Telephony Providers**: Twilio, Plivo, TCXC.
-   **Payment Gateways**: Stripe, Razorpay, PayPal, Paystack, MercadoPago.
-   **Database**: Neon (PostgreSQL).
-   **Email**: SMTP.

## Admin Panel Separation
The admin panel has been separated into a standalone Replit project for security isolation. All admin frontend components (`client/src/components/admin/`, `AdminDashboard`, `AdminCampaignDetail`, `AdminTeamLogin`, `AdminTeamMemberSidebar`) and admin backend routes (`server/routes/admin/`, `admin-routes.ts`, `admin-team-access.routes.ts`) have been removed. Inline admin API routes (credits, limits, notifications, email templates, batch jobs, campaigns, migration) were also removed from `server/routes.ts`.

A secure internal API was added at `/api/internal/*` (`server/routes/internal-api-routes.ts`) protected by `INTERNAL_API_SECRET` env var via `X-Internal-API-Key` header. Base endpoints: health check, user listing, user details, credits management, limits management, notification broadcast, and KYC management.

### Comprehensive Admin API (`/api/internal/admin/*`)
All admin endpoints are mounted under `/api/internal/admin/` and organized into 16 route files in `server/routes/admin/`:

- **Users** (`admin-users-routes.ts`): POST create, DELETE soft-delete, PATCH update, POST block/unblock/recover, GET contacts, GET/DELETE webhooks
- **Phone Numbers** (`admin-phone-routes.ts`): GET list, POST search-available/buy/import, POST assign/reassign/release/configure-webhook, POST migrate/migrate-all/migrate-by-agent, POST sync-elevenlabs/cleanup-orphaned
- **Calls** (`admin-calls-routes.ts`): GET list (paginated, filterable), GET detail/transcript/recording, POST scan-violations, POST sync-elevenlabs/sync-recordings, GET errors/errors-summary (static routes ordered before parameterized to prevent 401s)
- **Campaigns** (`admin-campaigns-routes.ts`): GET list/detail/contacts/calls/batches, GET/POST batch-jobs with retry
- **ElevenLabs Pool** (`admin-elevenlabs-routes.ts`): GET pool/stats, POST add/test/activate/deactivate, DELETE, POST health-check/sync-agents/sync-voices, GET users/voice-status/retry-queue, POST set-threshold/migrate-users
- **OpenAI Pool** (`admin-openai-routes.ts`): GET pool/stats, POST add/test/activate/deactivate, DELETE, POST migrate-users
- **LLM Models** (`admin-llm-routes.ts`): GET list, PATCH update, POST toggle
- **Content Moderation** (`admin-moderation-routes.ts`): CRUD banned-words, POST scan-all-calls, GET violations, PATCH review violations
- **Prompt Templates** (`admin-templates-routes.ts`): CRUD for system prompt templates
- **Billing** (`admin-billing-routes.ts`): GET billing/overview, CRUD plans with toggle/duplicate, CRUD credit-packages with toggle, GET/PATCH subscriptions with stats, POST user credits adjust/subscription assign, GET transactions/summary/payment-transactions with revenue reporting, GET/PUT pricing/config
- **Credentials** (`admin-credentials-routes.ts`): GET credentials/status (all services overview), GET/PUT/DELETE credentials/:service (Twilio, Stripe, Razorpay, PayPal, Paystack, MercadoPago, OpenAI, ElevenLabs, N8N, SMTP), POST test connectivity, GET system/status (platform health), CRUD Plivo/Fonoster/TCXC credentials
- **Settings** (`admin-settings-routes.ts`): GET/PUT/batch settings, GET/PUT/test SMTP, CRUD email-templates
- **Branding** (`admin-branding-routes.ts`): GET/PUT branding config, POST reset
- **SEO** (`admin-seo-routes.ts`): GET/PUT SEO per page, CRUD analytics-scripts
- **AWS** (`admin-aws-routes.ts`): CRUD AWS credentials (secrets masked), POST test with STS validation
- **Languages** (`admin-languages-routes.ts`): CRUD platform languages
- **Integrations & Auth** (`admin-integrations-routes.ts`): CRUD integration apps, GET user-integrations/sync-logs, GET/revoke API keys, GET audit logs

All credential responses are sanitized — API keys, passwords, and secrets are masked in responses.

The `checkAdmin` middleware in `server/middleware/admin-auth.ts` is retained — it's still used by the KYC engine and plugin auto-loader.

## Enhanced BI-Grade Reporting & Analytics
The analytics module (`/app/calls` → Analytics view) has been upgraded with enterprise-grade BI capabilities:

- **Advanced Aggregation API**: `GET /api/analytics/advanced` endpoint provides hourly call heatmap (24h × 7 days matrix), call pipeline funnel (initiated → connected → completed → qualified), period-over-period comparison data with delta percentages, and campaign-vs-campaign comparison datasets with daily breakdown.
- **Chart Components**: Located in `client/src/components/analytics/` — HeatmapChart (GitHub-style activity grid), FunnelChart (call pipeline), GaugeChart (radial KPI with color thresholds), TreemapChart (campaign proportional view), PeriodComparisonCard (side-by-side period metrics), CampaignComparisonChart (multi-campaign line overlay).
- **Interactive Data Table**: Redash-inspired sortable/filterable table with column visibility toggles, status filters, search, client-side pagination, CSV export, and Excel (.xlsx) export via the `xlsx` package.
- **Drill-Down**: Clicking pie chart segments (lead distribution, sentiment) filters the data table. Clicking treemap items filters by campaign.
- **Real Trends**: MetricCard now shows actual period-over-period percentage changes from the advanced analytics API (replaces hardcoded 0%).
- **Grafana-Inspired Layout**: Analytics page uses tabbed navigation (Overview, Campaigns, Calls) with collapsible Grafana-style panel sections.
- **Backend**: `server/storage/advanced-analytics.ts` contains `calculateAdvancedAnalytics()` with heatmap, funnel, period comparison, campaign comparison, and trend calculations.