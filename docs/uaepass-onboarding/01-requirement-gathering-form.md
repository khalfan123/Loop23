# UAE Pass Integration — Requirement Gathering Form

> **Document Version:** 1.0  
> **Date:** \_\_\_\_\_\_\_\_\_\_\_\_  
> **Prepared by:** \_\_\_\_\_\_\_\_\_\_\_\_

---

## Section 1: Service Provider Information

| Field | Value |
|---|---|
| **Service Provider Name** | `[PLACEHOLDER — Enter your registered company/entity name]` |
| **Trade License Number** | `[PLACEHOLDER — Enter your UAE trade license number]` |
| **Channel Name** | `[PLACEHOLDER — Enter the application/channel name as registered]` |
| **Channel URL (Production)** | `[PLACEHOLDER — Enter production URL, e.g., https://app.yourdomain.ae]` |
| **Channel URL (Staging)** | Currently using UAE Pass Staging: `https://stg-id.uaepass.ae/idshub` |
| **Primary Contact Name** | `[PLACEHOLDER — Enter name]` |
| **Primary Contact Email** | `[PLACEHOLDER — Enter email]` |
| **Primary Contact Phone** | `[PLACEHOLDER — Enter phone number]` |
| **Technical Contact Name** | `[PLACEHOLDER — Enter name]` |
| **Technical Contact Email** | `[PLACEHOLDER — Enter email]` |

---

## Section 2: Feature Type

| Field | Value |
|---|---|
| **Feature Requested** | **Authentication** |
| **Digital Signature** | Not applicable |
| **eSeal** | Not applicable |

---

## Section 3: Technical Stack

| Field | Value |
|---|---|
| **Frontend Framework** | React 18 (TypeScript) with Vite build tool |
| **Backend Framework** | Node.js with Express.js (TypeScript) |
| **Database** | PostgreSQL (via Drizzle ORM) |
| **Hosting Environment** | `[PLACEHOLDER — Enter hosting provider, e.g., AWS / Azure / Replit Deployments]` |
| **Authentication Protocol** | OAuth 2.0 Authorization Code Flow |
| **Token Format** | JWT (JSON Web Tokens) |
| **SSL/TLS** | Enforced (HTTPS only in production) |

---

## Section 4: OAuth 2.0 Integration Details

| Field | Value |
|---|---|
| **OAuth2 Flow** | Authorization Code Grant |
| **PKCE Support** | Not currently implemented (standard client_secret used) |
| **Client ID (Staging)** | `sandbox_stage` (provided by UAE Pass staging) |
| **Redirect URI** | Configured via `UAEPASS_REDIRECT_URI` environment variable |
| **Requested Scope** | `urn:uae:digitalid:profile:general` |
| **ACR Values** | `urn:safelayer:tws:policies:authentication:level:low` |
| **UI Locales** | `en` (English) |
| **State Parameter** | Yes — 32-byte cryptographic random hex string, validated on callback |

---

## Section 5: UAE Pass Profile Data Usage

| UAE Pass Field | Stored In | Purpose |
|---|---|---|
| `uuid` / `sub` | Not stored directly | Used to construct fallback email (`{uuid}@uaepass.local`) when `email` is unavailable |
| `firstnameEN` + `lastnameEN` | `users.name` | Display name |
| `email` | `users.email` | Account email (fallback: `{uuid}@uaepass.local`) |
| `gender` | Not stored | Not required for service |
| `mobile` | Not stored | Not required for service |
| `nationalityEN` | Not stored | Not required for service |
| `idn` | Not stored | Not required for service |

---

## Section 6: Estimated Usage

| Field | Value |
|---|---|
| **Estimated Logins / Month** | `[PLACEHOLDER — Enter estimated monthly login count]` |
| **Estimated Average Concurrent Users** | `[PLACEHOLDER — Enter estimate]` |
| **Expected Go-Live Date** | `[PLACEHOLDER — Enter target date]` |

---

## Section 7: Security Measures

| Measure | Status |
|---|---|
| **State parameter validation** | Implemented — cryptographic random, validated on callback, deleted after use |
| **CSRF protection** | State parameter serves as CSRF token; refresh token cookie uses `SameSite=Lax` |
| **Token expiry** | Access tokens expire in 15 minutes; refresh tokens expire in 30 days |
| **Refresh token storage** | Server-side in PostgreSQL (hashed with SHA-256); delivered to client via HttpOnly, Secure cookie |
| **Password for UAE Pass users** | Random 32-byte hex, bcrypt-hashed — user cannot login with password (UAE Pass only) |
| **HTTPS enforcement** | Cookie `Secure` flag enabled in production |
| **XSS protection** | Refresh tokens stored in HttpOnly cookies, inaccessible to JavaScript |

---

## Section 8: Data Retention & Privacy

| Field | Value |
|---|---|
| **Data Retention Policy** | `[PLACEHOLDER — Describe your data retention period and policy]` |
| **GDPR/Data Protection Compliance** | User consent tracking fields present in schema (cookie consent, analytics consent, marketing consent with timestamps) |
| **User Deletion Support** | Soft-delete supported (`is_deleted` flag, `deleted_at` timestamp); cascading delete on refresh tokens and subscriptions |
| **Privacy Policy URL** | `[PLACEHOLDER — Enter your privacy policy URL]` |
| **Terms of Service URL** | `[PLACEHOLDER — Enter your terms of service URL]` |

---

## Section 9: Additional Notes

- The integration is currently working on the **UAE Pass Staging environment** (`stg-id.uaepass.ae`).
- Only the **Authentication** feature is integrated. Digital Signature and eSeal are not in scope.
- New UAE Pass users are automatically provisioned with a free plan and assigned initial credits.
- The application supports KYC verification flows post-registration (KYC status: pending → submitted → approved).

---

*Fields marked with `[PLACEHOLDER]` must be filled in by the business/operations team before submission to UAE Pass.*
