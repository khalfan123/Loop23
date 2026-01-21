# AgentLabs AI Calling Platform

## Overview
AgentLabs is a comprehensive AI-powered bulk calling platform (CodeCanyon package by Diploy). It's a multi-tenant SaaS application supporting multiple AI engines, telephony providers, payment gateways, with features including campaign management, phone number management, knowledge base (RAG), flow builder, CRM, and multi-language support.

**Status**: Installation complete - Application running on port 5000

## Key Technologies
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express 4.x + Drizzle ORM
- **Database**: PostgreSQL (Neon-backed on Replit)
- **AI Engines**: ElevenLabs, OpenAI Realtime API
- **Telephony**: Twilio, Plivo (SIP trunking support)
- **Payments**: Stripe, Razorpay, PayPal, Paystack, MercadoPago

## Project Structure
```
├── client/src/
│   ├── pages/          # All page components (dashboard, campaigns, settings, etc.)
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   └── App.tsx         # Main app with routing
├── server/
│   ├── index.ts        # Express server entry point
│   ├── routes.ts       # API route definitions
│   ├── modules/        # Feature modules (campaigns, calls, billing, etc.)
│   └── engines/        # AI/telephony engine integrations
├── shared/
│   └── schema.ts       # Drizzle database schema (135KB, comprehensive)
└── packages/
    └── diploy-core/    # Core utility package
```

## Configuration Required

### Essential Secrets (via Replit Secrets)
The following secrets need to be configured for full functionality:

**AI/Voice:**
- `ELEVENLABS_API_KEY` - For AI voice synthesis
- `OPENAI_API_KEY` - For knowledge base embeddings & realtime voice

**Telephony:**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - For Twilio calling
- `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN` - For Plivo calling

**Payments (configure at least one):**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `PAYSTACK_SECRET_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`

**Email:**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Application:**
- `SESSION_SECRET` - Already configured
- `JWT_SECRET` - For authentication tokens

## Key Features
1. **Campaign Management** - Create and manage bulk calling campaigns
2. **AI Voice Agents** - Configure AI agents with custom voices and scripts
3. **Knowledge Base (RAG)** - Upload documents for context-aware conversations
4. **Flow Builder** - Visual conversation flow designer
5. **CRM Integration** - Manage contacts and call outcomes
6. **Multi-tenant** - Support for multiple organizations
7. **Analytics Dashboard** - Call metrics and campaign performance
8. **Phone Number Management** - Purchase and manage phone numbers
9. **Billing & Subscriptions** - Usage-based or subscription billing

## Running the Application
```bash
npm run dev
```
The application serves on port 5000 with both frontend and backend.

## Database
- Schema is defined in `shared/schema.ts`
- Uses Drizzle ORM with PostgreSQL
- Run migrations: `npm run db:push`

## Important Notes
- Express 4.x is required (not 5.x) due to route pattern compatibility
- The platform uses WebSocket connections for real-time voice streaming
- Background schedulers handle campaign execution, billing, and cleanup tasks
- Plugin system available in `server/modules/plugins/`

## Recent Changes
- 2026-01-21: Initial installation from CodeCanyon package
- Downgraded Express from 5.x to 4.21.2 for compatibility with wildcard routes
- All core features installed and database schema pushed

## Troubleshooting
- If integrations show as "not configured", add the required secrets
- Check server logs for specific error messages
- Verify DATABASE_URL is properly set (automatic on Replit)
