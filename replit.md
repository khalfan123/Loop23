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
- **Knowledge Base & AI Intelligence**: Provides an integrated experience for managing knowledge base content, performing AI-powered topic analysis, and generating content, utilizing a folder-based navigation system.
- **Provider DID Marketplace**: Integrates a marketplace for browsing and renting DIDs from various carrier providers, with routing capabilities for outbound calling.

## External Dependencies
- **AI Engines**: ElevenLabs (for AI voice synthesis), OpenAI Realtime API (for knowledge base embeddings and realtime voice), Anthropic Claude Sonnet-4-5 (for complex reasoning in Topic Intelligence).
- **Telephony Providers**: Twilio, Plivo (with SIP trunking support), TCXC (TelecomXchange marketplace for DIDs).
- **Payment Gateways**: Stripe, Razorpay, PayPal, Paystack, MercadoPago.
- **Database**: Neon (for PostgreSQL hosting on Replit).
- **Email**: SMTP for email notifications.