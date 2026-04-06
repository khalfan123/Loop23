# UAE Pass Integration — Authentication Questionnaire Responses

> **Document Version:** 1.0  
> **Date:** \_\_\_\_\_\_\_\_\_\_\_\_  
> **Integration Type:** Authentication Only

---

## Q1: What type of UAE Pass integration have you implemented?

**Authentication only.** We use UAE Pass as an identity provider for user sign-in. Digital Signature and eSeal features are not integrated.

---

## Q2: Which OAuth 2.0 / OIDC flow do you use?

**OAuth 2.0 Authorization Code Grant.**

The flow is:
1. Backend generates an authorization URL with `response_type=code`, `client_id`, `scope`, `state`, `redirect_uri`, `acr_values`, and `ui_locales`.
2. User is redirected to UAE Pass to authenticate.
3. UAE Pass redirects back to our callback URL with an authorization `code` and `state`.
4. Backend exchanges the `code` for an `access_token` via a server-to-server POST to the UAE Pass `/token` endpoint.
5. Backend uses the `access_token` to fetch the user profile from the `/userinfo` endpoint.

---

## Q3: Do you support PKCE (Proof Key for Code Exchange)?

**Not currently implemented.** We use the standard `client_id` + `client_secret` method for the token exchange. The `client_secret` is stored securely as a server-side environment variable and is never exposed to the frontend.

---

## Q4: How do you handle the `state` parameter for CSRF protection?

The `state` parameter is a **32-byte cryptographically random hex string** generated using Node.js `crypto.randomBytes(32)`.

- Each state value is stored server-side in an in-memory map with a creation timestamp.
- On callback, the state is validated against the stored map. If the state is missing or does not match, the request is rejected and the user is redirected to the login page with an error.
- After successful validation, the state entry is immediately deleted (single-use).
- A cleanup interval runs every 60 seconds to expire state entries older than 10 minutes.

---

## Q5: What scope do you request from UAE Pass?

**Scope:** `urn:uae:digitalid:profile:general`

**ACR Values:** `urn:safelayer:tws:policies:authentication:level:low`

---

## Q6: What user profile data do you retrieve and store?

We call the UAE Pass `/userinfo` endpoint and retrieve the following fields:

| UAE Pass Field | Stored? | Where Stored | Purpose |
|---|---|---|---|
| `uuid` / `sub` | Not stored | Used to construct fallback email (`{uuid}@uaepass.local`) if `email` is null | Fallback identifier |
| `email` | Yes | `users.email` | Primary account identifier |
| `firstnameEN` | Yes (combined) | `users.name` | Display name |
| `lastnameEN` | Yes (combined) | `users.name` | Display name |
| `firstnameAR` | No | — | Not required |
| `lastnameAR` | No | — | Not required |
| `gender` | No | — | Not required |
| `mobile` | No | — | Not required |
| `nationalityEN` | No | — | Not required |
| `idn` | No | — | Not required |

If the user's email is not available from UAE Pass, a fallback email of `{uuid}@uaepass.local` is generated.

---

## Q7: How do you handle token exchange and storage?

### Access Token (from UAE Pass)
- The UAE Pass `access_token` is used server-side only to fetch the user profile.
- It is **not stored** in the database or sent to the frontend.
- It is used once and then discarded.

### Application JWT (our own token)
- After verifying the UAE Pass identity, we generate our own short-lived JWT access token.
- **Expiry:** 15 minutes.
- **Payload:** `userId` and `role`.
- **Storage:** Stored in the browser's `localStorage` on the frontend.

### Refresh Token (our own token)
- A 64-byte cryptographically random refresh token is generated.
- **Stored in database:** SHA-256 hashed in the `refresh_tokens` table.
- **Delivered to client:** As an HttpOnly, Secure (production), SameSite=Lax cookie, scoped to `/api/auth` path.
- **Expiry:** 30 days.
- The raw token is never stored on the server; only the hash is persisted.

---

## Q8: How do you handle new user account provisioning?

When a user authenticates via UAE Pass for the first time:

1. The backend checks if an account with the user's email already exists (account matching is done exclusively by email).
2. If **no account exists**, a new account is created with:
   - Email and name from the UAE Pass profile
   - A random, bcrypt-hashed password (the user cannot use it to log in manually)
   - Role set to `user`
   - KYC status set to `pending`
3. A free plan subscription is automatically created with a 1-year validity period.
4. The user's credit balance is set to the free plan's included credits.
5. A welcome notification is sent to the user.
6. If the account **already exists**, the existing account is used without modification.

---

## Q9: What security measures are in place?

| Security Measure | Implementation |
|---|---|
| **CSRF Protection** | Cryptographic `state` parameter (32-byte random), single-use, 10-minute expiry |
| **XSS Protection** | Refresh tokens in HttpOnly cookies (JavaScript cannot access them) |
| **Token Expiry** | Access tokens: 15 min; Refresh tokens: 30 days |
| **Secure Cookies** | `Secure` flag in production, `SameSite=Lax`, path restricted to `/api/auth` |
| **Password Security** | bcrypt with 10 salt rounds for all password hashing |
| **Secret Management** | `client_secret`, JWT secret stored as server-side environment variables |
| **Account Suspension** | Middleware checks `is_active` flag before granting access |
| **State Cleanup** | State entries cleaned up every 60 seconds; entries older than 10 minutes are expired |

---

## Q10: How do you handle errors during the UAE Pass flow?

All error scenarios redirect the user to the login page with a descriptive error parameter:

| Scenario | Redirect | User-Facing Message |
|---|---|---|
| User denies consent on UAE Pass | `/login?error=uaepass_denied` | "UAE Pass authentication was cancelled or denied." |
| Missing `code` or `state` in callback | `/login?error=uaepass_missing_params` | "UAE Pass response was incomplete. Please try again." |
| Invalid or expired `state` | `/login?error=uaepass_invalid_state` | "UAE Pass session expired. Please try again." |
| Token exchange failure (non-200 from `/token`) | `/login?error=uaepass_token_failed` | "Failed to verify UAE Pass credentials. Please try again." |
| User profile fetch failure (non-200 from `/userinfo`) | `/login?error=uaepass_userinfo_failed` | "Could not retrieve your UAE Pass profile. Please try again." |
| localStorage write failure in callback page | `/login?error=uaepass_storage_failed` | "Could not save your session. Please try again." |
| Any unhandled server error | `/login?error=uaepass_callback_failed` | "Something went wrong during sign-in. Please try again." |

All errors are logged server-side with the relevant context for debugging.

---

## Q11: What is your redirect URI configuration?

The redirect URI is configured via the `UAEPASS_REDIRECT_URI` environment variable. It points to:

**Callback endpoint:** `GET /api/auth/uaepass/callback`

This endpoint is responsible for receiving the authorization code and state from UAE Pass after user authentication.

**Staging configuration:**
- Base URL: `https://stg-id.uaepass.ae/idshub`
- Client ID: `sandbox_stage`
- Redirect URI: Set via environment variable

**Production configuration (to be set after onboarding approval):**
- Base URL: `[PLACEHOLDER — Will be updated to production UAE Pass URL]`
- Client ID: `[PLACEHOLDER — Will be provided by UAE Pass]`
- Client Secret: `[PLACEHOLDER — Will be provided by UAE Pass]`
- Redirect URI: `[PLACEHOLDER — Production callback URL]`

---

## Q12: How do you handle user data privacy and deletion?

- **Soft delete:** Users can be soft-deleted (`is_deleted=true`, `deleted_at` timestamp recorded).
- **Cascading cleanup:** Deleting a user cascades to `refresh_tokens` and `user_subscriptions` (ON DELETE CASCADE).
- **Consent tracking:** The schema tracks GDPR consent preferences (`cookie_consent`, `analytics_consent`, `marketing_consent`) with timestamps.
- **Terms acceptance:** Timestamps for Terms of Service and Privacy Policy acceptance are recorded.
- **Minimal data storage:** Only name and email are stored from the UAE Pass profile. Sensitive fields like national ID, mobile, and nationality are not persisted.

---

## Q13: What is your technology stack?

| Component | Technology |
|---|---|
| **Frontend** | React 18 (TypeScript), Vite, TailwindCSS |
| **Backend** | Node.js, Express.js (TypeScript) |
| **Database** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **Authentication** | JWT (jsonwebtoken), bcrypt |
| **HTTP Client** | Native `fetch` API |

---

## Q14: Do you have a staging/testing environment?

Yes. The integration is currently operational on the **UAE Pass Staging environment**:
- **Staging IDP URL:** `https://stg-id.uaepass.ae/idshub`
- **Staging Client ID:** Configured via environment variable `UAEPASS_CLIENT_ID`
- **Staging Client Secret:** Configured via environment variable `UAEPASS_CLIENT_SECRET`

The integration has been tested end-to-end on staging, including user authentication, profile retrieval, account creation, and session management.
