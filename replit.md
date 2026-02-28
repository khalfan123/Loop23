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