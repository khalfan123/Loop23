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

## Deployment Checklist
Before every deployment, ensure the following steps are completed:
1. **Restart the workflow** - Run `npm run dev` or restart the "Start application" workflow to apply all code changes
2. **Clear browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to ensure frontend changes are visible
3. **Verify build** - Check that Vite rebuilds the frontend assets without errors
4. **Test UI changes** - Confirm all UI modifications appear correctly after restart

## Recent Changes
- 2026-01-21: Initial installation from CodeCanyon package
- Downgraded Express from 5.x to 4.21.2 for compatibility with wildcard routes
- All core features installed and database schema pushed
- 2026-01-21: **Dashboard UI Redesign** - Google Workspace Studio-inspired layout:
  - Hero section with gradient background and quick-create AI agent input
  - 6 pre-built agent template cards (Appointment, Lead Qualifier, Survey, Payment, Support, Notification)
  - Category filtering tabs (All, Sales, Support, Reminders, Surveys, Custom)
  - Stats overview section with clickable metrics cards
  - Quick Actions panel and Weekly Call Activity chart
  - Modern card design with gradients and consistent spacing
- 2026-01-25: **Prompt Templates Enhancement**:
  - Added tags field for better template categorization and discoverability
  - 25 system templates ("Staff Picks") across 6 categories: agent_preset, sales, support, appointment, survey, general
  - Each template has 3-5 searchable tags (e.g., 'cold-calling', 'b2b', 'healthcare', 'automation')
  - Enhanced search filters by name, description, AND tags
  - "Staff Pick" badge with amber/gold styling replaces "System" badge for curated templates
  - Created documentation: README.md, docs/AGENT_AI_GUIDE.md
- 2026-01-25: **Agent Template Tracking**:
  - Extended agents schema with sourceTemplateId, isFromTemplate, and tags fields
  - Agent cards now display "Staff Pick" badge and tags when created from templates
  - PromptTemplatesLibrary passes template metadata (id, tags, isSystemTemplate) during selection
  - Server routes updated to persist template tracking information
  - Up to 3 tags displayed per agent card with "+N" overflow indicator
- 2026-01-26: **Optimized AI Agent Templates**:
  - Added `suggestedTemperature`, `suggestedLlmModel`, `suggestedVoice` fields to prompt_templates schema
  - 14 agent templates with optimized AI configurations:
    - **Core Agents (5)**: Sales, Support, Appointment, Survey, General (with multilingual names)
    - **Specialized Agents (9)**: Virtual Receptionist, Appointment Setter, Lead Qualification, Survey & Feedback, Technical Support, Outbound Sales, Debt Collection, Event Registration, Real Estate Lead
  - Temperature optimization by use case:
    - Low (0.2-0.3): Technical Support, Survey agents for consistency
    - Medium (0.4-0.5): Appointment, Receptionist, General for balanced interactions
    - High (0.6-0.7): Sales, Lead Qualification, Real Estate for creative/persuasive conversations
  - Voice mapping:
    - `coral`: Sales, Lead Qualification, Outbound Sales, Real Estate (persuasive)
    - `sage`: Support, Technical Support (calm, reassuring)
    - `alloy`: Appointment, Receptionist, General (professional, neutral)
    - `shimmer`: Survey, Event Registration (friendly, approachable)
    - `ash`: Debt Collection (authoritative, firm but fair)
  - LLM model selection:
    - `gpt-4o`: Complex reasoning tasks (Sales, Technical Support, Lead Qualification, Real Estate)
    - `gpt-4o-mini`: Cost-effective consistent responses (Appointments, Surveys, Receptionist)
  - Enhanced behavioral prompts with frameworks, objection handling, and conversation techniques
- 2026-01-26: **Knowledge Base Dashboard Enhancement**:
  - Added `knowledgeFolders` table for organizing knowledge base items by category
  - Extended `knowledgeBase` table with `folderId` field for folder assignment
  - Backend API routes for folder CRUD operations, stats aggregation, and item-to-folder assignment
  - Redesigned Knowledge Base page with two-panel layout:
    - Left sidebar with Dashboard button and folder list
    - Header with resource/chunk counts and action buttons (URL, Files, Text, AI Articles)
    - Dashboard view with 3 stat cards: Usage donut chart, Top Categories, Recent Items
    - Folder view for filtering items by specific folders
  - Custom donut chart component for visualizing content type distribution
  - Folder creation/editing/deletion dialogs with color customization
  - Items can be assigned to folders via dropdown or during creation
  - Folder deletion properly reassigns items to uncategorized before removal
- 2026-01-26: **Department Management System**:
  - New tables: `departments`, `department_agents`, `ivr_configurations`, `department_knowledge_bases`
  - Full CRUD API routes for departments with proper multi-tenant security
  - Agent assignment to departments with language-specific configuration
  - IVR Auto Distribution configuration for incoming call routing
  - Department Management page at `/app/departments` with:
    - Two-tab layout: Org Map (visual call flow) and Departments (list view)
    - Visual call flow diagram: Inbound Number → IVR → Departments
    - Department cards with badges, agent counts, and language indicators
    - Create/Edit department dialogs with icon and color customization
    - Add agent to department with language selection
    - Action buttons: Flow, Edit, Delete for each department
  - Multi-tenant security enforced on all department-related routes
- 2026-01-26: **Department Canvas (Visual Call Flow Builder)**:
  - New page at `/app/departments/canvas` using React Flow for drag-and-drop visual design
  - Canvas elements: Phone nodes, IVR Router node, Department nodes (Sales, Support, Scheduling, Custom)
  - Left sidebar with available phone numbers and department templates
  - Click-to-add: phone numbers and departments auto-connect to IVR
  - Configuration panels: IVR (greeting, language), Department (name, agent, prompt, settings)
  - Canvas stats showing phone count, department count, connections
  - Zoom controls, minimap, and Save & Deploy functionality
  - Save creates departments, assigns agents, and configures IVR with correct routing
- 2026-01-27: **TCXC DID Marketplace & Outbound Calling**:
  - Added TCXC DIDs tab to Phone Numbers page for browsing and purchasing DIDs from TelecomXchange marketplace
  - DID search with country and type filtering (GCC countries supported + US, UK, CA, AU, DE, FR)
  - Purchase workflow with confirmation dialog
  - "My TCXC DIDs" section showing purchased DIDs
  - Added Outbound tab for configuring outbound calling with all available numbers (Twilio, Plivo, TCXC)
  - New `/api/tcxc/status` endpoint with sessionAuth for user-facing TCXC configuration check
  - Fixed nested Card components - replaced with bordered divs per design guidelines
- 2026-01-27: **Provider DID Marketplace & Rental**:
  - TCXC Marketplace search integration for browsing DIDs from carrier providers (AirTel, Mobily, Tonerro)
  - New API endpoints:
    - `POST /api/tcxc/marketplace/search` - Search DIDs by seller, prefix, voice/SMS capabilities
    - `POST /api/tcxc/marketplace/rent` - Rent/purchase DID from marketplace
    - `GET /api/tcxc/marketplace/sellers` - Get list of sellers on marketplace
  - Provider Numbers Lookup dialog in Outbound tab with:
    - Provider selection dropdown
    - Marketplace search with country code prefix filter
    - Search results showing DID, country, type, voice/SMS badges, pricing
    - "Rent" button for each available number with confirmation dialog
    - Rented numbers section showing user's numbers from each provider
  - Rent confirmation dialog with pricing breakdown (monthly fee, setup fee, per-minute rate)
  - `provider_caller_ids` table for storing rented caller IDs
  - Provider caller IDs integrated into Default Caller ID dropdown
  - Tech prefix routing: calls routed via carrier's tech prefix (e.g., 73297#, 76091#, 74778#)

## Troubleshooting
- If integrations show as "not configured", add the required secrets
- Check server logs for specific error messages
- Verify DATABASE_URL is properly set (automatic on Replit)
