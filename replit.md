# AgentLabs AI Calling Platform

## Overview
AgentLabs is a multi-tenant SaaS platform designed for AI-powered bulk calling. It supports various AI engines, telephony providers, and payment gateways, enabling users to create and manage calling campaigns, utilize AI voice agents with knowledge bases, design conversation flows, and manage contacts. The platform aims to provide a comprehensive solution for businesses seeking to automate and optimize their outbound and inbound calling operations using advanced AI capabilities.

## User Preferences
I want to follow an iterative development approach.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations of the code changes and architectural decisions.
Do not make changes to the `shared/schema.ts` file without explicit instruction.
Do not make changes to the `packages/diploy-core/` directory.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React 18, Vite, TypeScript, TailwindCSS, and shadcn/ui for a modern and responsive user interface.
- **Backend**: Implemented using Node.js and Express 4.x, utilizing Drizzle ORM for database interactions.
- **Database**: PostgreSQL, with schema defined in `shared/schema.ts`.
- **UI/UX**: Features a modern design inspired by Google Workspace Studio and Microsoft 365, including hero sections, template cards, category filtering, stats overviews, and quick action panels. Visual elements like gradients and consistent spacing are used throughout.
- **Hybrid Navigation System**: Microsoft 365-inspired layout with a slim top bar (48px) for logo, notifications, and user menu, plus a collapsible side rail (56px collapsed, 240px expanded) for main navigation. Sidebar state persists in localStorage. Click-to-expand only (no hover behavior). Admin panel includes "Return to App" link.
- **Real-time Communication**: Employs WebSocket connections for real-time voice streaming.
- **Background Processing**: Schedulers handle campaign execution, billing, and cleanup tasks.
- **Modular Design**: Feature modules and engine integrations are organized within the `server/modules/` and `server/engines/` directories, respectively.
- **Department Management System**: Includes robust features for organizing agents and IVR configurations within departments, supported by a 3-step wizard (Phone Numbers > Departments > IVR Router) at `/app/departments/canvas`.
- **Knowledge Base & AI Intelligence**: Provides an integrated experience for managing knowledge base content, performing AI-powered topic analysis, and generating content, utilizing a folder-based navigation system. Supports "Knowledge Base Only" mode (`knowledgeBaseOnly` flag on agents) that restricts AI responses strictly to KB content and system prompt, preventing use of general training knowledge. This applies across both ElevenLabs and OpenAI Realtime engines. The Knowledge Base page (`/app/knowledge-base`) uses a "Professor" persona throughout its UI - branded as "Professor's Knowledge Library" with academic-themed labels (Study Materials, Library Capacity, Ask the Professor, Professor's Expertise Level, etc.). The `knowledgeBaseOnly` flag is auto-enabled when agents are assigned knowledge bases during creation.
- **Provider DID Marketplace**: Integrates a marketplace for browsing and renting DIDs from various carrier providers, with routing capabilities for outbound calling.

- **Bedrock + Polly Engine (RockCenter)**: New engine at `server/engines/twilio-bedrock-polly/` using AWS Bedrock (Claude 3.5 Sonnet) for AI and AWS Polly for TTS, with Twilio telephony. Frontend at `/app/rock-center`. API at `/api/bedrock-polly/`. Turn-based: Twilio audio -> Whisper STT -> Bedrock AI -> Polly TTS -> Twilio.

- **Deprock Department System**: Replicates the Department Management system but specifically for the Bedrock + Polly engine. Uses AWS Polly voices (46 neural voices across 17 languages) instead of OpenAI/ElevenLabs voices. Frontend pages at `/app/deprock` (management) and `/app/deprock/canvas` (3-step wizard). Backend API at `/api/deprock/`. Uses same DB tables as departments (`departments`, `departmentAgents`, `ivrConfigurations`) but separated by `engineType` column ('default' for Departments, 'bedrock-polly' for Deprock). Files: `client/src/pages/DeprockManagement.tsx`, `client/src/pages/DeprockCanvas.tsx`, `server/routes/deprock-routes.ts`.

- **Deprock IVR System (Enterprise-Grade)**: Full Twilio IVR implementation for the Bedrock+Polly engine at `server/engines/twilio-bedrock-polly/routes/ivr-webhooks.ts`. Routes: `/api/deprock/ivr/answer` (greeting + Gather), `/api/deprock/ivr/handle-language` (multi-language selection), `/api/deprock/ivr/handle-selection` (department selection → agent stream), `/api/deprock/ivr/fallback` (timeout handler). Features: dual-input (DTMF + speech recognition with number word parsing in 17 languages), Polly SSML prosody at 88% rate, retry logic (3 attempts max), fallback department, language-aware prompts. Both `/api/bedrock-polly/voice/incoming` and `/api/webhooks/twilio/incoming` detect Deprock IVR configs and redirect accordingly. IVR configs filtered by `engineType` to prevent cross-contamination between Department ('default') and Deprock ('bedrock-polly') IVR systems.

## External Dependencies
- **AI Engines**: ElevenLabs, OpenAI Realtime API, Anthropic Claude Sonnet-4-5, AWS Bedrock Claude 3.5 Sonnet (RockCenter).
- **Voice Synthesis**: ElevenLabs, OpenAI TTS, AWS Polly (neural/generative voices for RockCenter).
- **Telephony Providers**: Twilio, Plivo (with SIP trunking support), TCXC (TelecomXchange marketplace for DIDs).
- **Payment Gateways**: Stripe, Razorpay, PayPal, Paystack, MercadoPago.
- **Database**: Neon (for PostgreSQL hosting on Replit).
- **Email**: SMTP for email notifications.