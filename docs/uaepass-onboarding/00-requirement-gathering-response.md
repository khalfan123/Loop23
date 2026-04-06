# UAE Pass Onboarding — Step 2: Requirement Gathering Response

> **Service Provider:** B24Payments  
> **Date:** March 30, 2026

---

## Requirement Gathering Details

| S.No. | Requirement | Details |
|-------|-------------|---------|
| 1 | **Service Provider Name** | B24Payments |
| 2 | **Service Provider Channel Name** | Loop9 AI Call Center Agent |
| 3 | **Feature Integrating With** | Authentication |
| 4 | **Login / Month Count** | Estimated 500–1,000 logins/month (initial phase, scaling with user adoption) |
| 5 | **Average Count of Users** | Estimated 100–500 active users |
| 6 | **Technology Used** | **Frontend:** React 18 (TypeScript) with Vite build tool, TailwindCSS, shadcn/ui components. **Backend:** Node.js with Express.js (TypeScript). **Database:** PostgreSQL (via Drizzle ORM). **Authentication Protocol:** OAuth 2.0 Authorization Code Grant. **Token Format:** JWT (JSON Web Tokens). **Hosting:** Cloud-hosted (HTTPS enforced). |
| 7 | **Steps 4–7 from Step 1, Point 3** | See attached documents below. |
| 8 | **Questionnaire, Workflow Diagram & DB Storage Evidence** | See attached documents below. |

---

## Attached Documents (Step 1, Point 3 — Steps 4, 5, 6, 7)

The following documents are provided as part of this submission:

### Document 1: Workflow Diagram
**File:** `02-workflow-diagram.html`

A visual HTML workflow diagram showing the complete UAE Pass OAuth 2.0 authentication flow across 12 steps, color-coded by actor (User, Frontend, Backend, UAE Pass IDP, Database). Includes error handling flows.

**Flow Summary:**
1. User clicks "Sign in with UAE PASS" or "Sign up with UAE PASS" on the Loop9 login page
2. Frontend calls `GET /api/auth/uaepass/authorize` to obtain the authorization URL
3. Backend generates a cryptographic `state` parameter (32-byte random hex) and constructs the UAE Pass authorization URL
4. User is redirected to UAE Pass staging (`https://stg-id.uaepass.ae/idshub/authorize`) for authentication
5. User authenticates on UAE Pass
6. UAE Pass redirects back to `GET /api/auth/uaepass/callback` with authorization `code` and `state`
7. Backend validates the `state` parameter against server-side storage (CSRF protection)
8. Backend exchanges the `code` for an `access_token` via server-to-server POST to UAE Pass `/token` endpoint
9. Backend uses the `access_token` to fetch the user profile from UAE Pass `/userinfo` endpoint
10. Backend creates or finds the user account in PostgreSQL
11. Backend issues its own JWT access token and refresh token (HttpOnly cookie)
12. User is redirected to `/onboarding` (new users, KYC pending) or `/app` (approved users)

---

### Document 2: DB Storage Evidence
**File:** `03-db-storage-evidence.md`

Complete PostgreSQL schema documentation for the three relevant tables:

**Table: `users`** — Stores user accounts created via UAE Pass authentication
- `id` (UUID, primary key)
- `email` (text, unique) — from UAE Pass `email` field, or fallback `{uuid}@uaepass.local`
- `name` (text) — from UAE Pass `firstnameEN` + `lastnameEN`
- `password` (text) — random 32-byte hex, bcrypt-hashed (user cannot login with this)
- `role` (text) — defaults to `user`
- `kyc_status` (text) — `pending` → `submitted` → `approved` / `rejected`
- `is_active` (boolean) — account activation status
- Plus consent tracking fields (cookie, analytics, marketing consent with timestamps)

**Table: `refresh_tokens`** — Stores hashed refresh tokens
- `token` (text) — SHA-256 hash of the refresh token
- `user_id` (UUID, FK to users, ON DELETE CASCADE)
- `expires_at` (timestamp) — 30-day expiry
- `user_agent`, `ip_address` — session metadata

**Table: `user_subscriptions`** — Auto-created free plan for new UAE Pass users
- `user_id` (UUID, FK to users)
- `plan_id` (UUID, FK to plans)
- `status` (text) — `active`

**UAE Pass Profile → Database Field Mapping:**

| UAE Pass Field | Stored? | Database Column | Purpose |
|---|---|---|---|
| `uuid` / `sub` | No (used transiently) | — | Fallback email construction only |
| `email` | Yes | `users.email` | Primary account identifier |
| `firstnameEN` + `lastnameEN` | Yes (combined) | `users.name` | Display name |
| `gender`, `mobile`, `nationalityEN`, `idn` | No | — | Not required for service |

---

### Document 3: Authentication Questionnaire Responses
**File:** `04-questionnaire-responses.md`

14 detailed Q&A responses covering:

1. **Integration type:** Authentication only (no Digital Signature or eSeal)
2. **OAuth flow:** Authorization Code Grant
3. **PKCE:** Not implemented (using standard client_secret, stored server-side)
4. **CSRF protection:** 32-byte cryptographic random `state` parameter, single-use, 10-minute expiry, cleaned up every 60 seconds
5. **Scope:** `urn:uae:digitalid:profile:general`
6. **Profile data usage:** Only email and name stored; sensitive fields (national ID, mobile, nationality) are not persisted
7. **Token handling:**
   - UAE Pass access_token: used server-side only, not stored, discarded after profile fetch
   - Application JWT: 15-minute expiry, stored in browser localStorage
   - Refresh token: 64-byte random, SHA-256 hashed in DB, delivered as HttpOnly/Secure cookie
8. **New user provisioning:** Auto-create account with free plan, KYC status pending
9. **Security measures:** State validation, HttpOnly cookies, token expiry, bcrypt, secure environment variables
10. **Error handling:** 7 distinct error scenarios, all redirect to login page with descriptive messages, all logged server-side
11. **Redirect URI:** Configured via `UAEPASS_REDIRECT_URI` environment variable → `GET /api/auth/uaepass/callback`
12. **Data privacy:** Soft-delete support, cascading cleanup, GDPR consent tracking, minimal data storage
13. **Technology stack:** React 18 + Vite + TailwindCSS / Node.js + Express / PostgreSQL + Drizzle ORM / JWT + bcrypt
14. **Staging environment:** Fully operational on UAE Pass Staging (`stg-id.uaepass.ae`)

---

## Security Summary

| Security Measure | Implementation |
|---|---|
| CSRF Protection | Cryptographic `state` parameter (32-byte random), single-use, 10-min expiry |
| XSS Protection | Refresh tokens in HttpOnly cookies (JavaScript cannot access) |
| Token Expiry | Access tokens: 15 min; Refresh tokens: 30 days |
| Secure Cookies | `Secure` flag in production, `SameSite=Lax`, path restricted to `/api/auth` |
| Password Security | bcrypt with 10 salt rounds |
| Secret Management | client_secret and JWT secret stored as server-side environment variables only |
| Account Suspension | Middleware checks `is_active` flag before granting access |
| Data Minimization | Only name and email stored from UAE Pass profile |

---

## Post-Authentication Flow

After successful UAE Pass authentication, new users follow a **KYC onboarding flow:**

1. **UAE Pass Authentication** → User identity verified
2. **Trade License Upload** → User uploads their trade license document (PDF/image) at `/onboarding`
3. **Admin Review** → KYC status changes to `submitted`, admin reviews and approves/rejects
4. **Account Activation** → Upon approval, user gains full access to the Loop9 AI Call Center Agent platform

---

*All documents referenced above are available in the `docs/uaepass-onboarding/` directory.*
