# UAE Pass Integration — Database Storage Evidence

> **Document Version:** 1.0  
> **Database:** PostgreSQL  
> **ORM:** Drizzle ORM (TypeScript)  
> **Schema Source:** `shared/schema.ts`

---

## 1. Users Table

The `users` table stores all user accounts, including those created via UAE Pass authentication. The columns listed below are the UAE Pass-relevant subset of the full table schema.

### Table: `users` (UAE Pass-relevant columns)

| Column | Type | Constraints | UAE Pass Usage |
|---|---|---|---|
| `id` | `varchar` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated UUID |
| `email` | `text` | NOT NULL, UNIQUE | Populated from `uaeProfile.email` or fallback `{uuid}@uaepass.local` |
| `password` | `text` | NOT NULL | Random 32-byte hex, bcrypt-hashed (user cannot login with password) |
| `name` | `text` | NOT NULL | Populated from `firstnameEN + lastnameEN` or fallback `'UAE Pass User'` |
| `role` | `text` | NOT NULL, default `'user'` | Set to `'user'` for all UAE Pass signups |
| `plan_type` | `text` | NOT NULL, default `'free'` | Default free plan assigned |
| `plan_expires_at` | `timestamp` | nullable | Not set on initial creation |
| `credits` | `integer` | NOT NULL, default `0` | Set to plan's `includedCredits` on creation |
| `is_active` | `boolean` | NOT NULL, default `true` | Active by default |
| `stripe_customer_id` | `text` | nullable | Not set via UAE Pass flow |
| `stripe_subscription_id` | `text` | nullable | Not set via UAE Pass flow |
| `max_webhooks` | `integer` | NOT NULL, default `3` | Default value |
| `is_deleted` | `boolean` | NOT NULL, default `false` | Soft-delete flag |
| `deleted_at` | `timestamp` | nullable | When user requested deletion |
| `deleted_by` | `varchar` | nullable | Who deleted the account |
| `timezone` | `text` | nullable | User preference (IANA timezone) |
| `cookie_consent` | `boolean` | nullable | GDPR consent tracking |
| `analytics_consent` | `boolean` | nullable | GDPR consent tracking |
| `marketing_consent` | `boolean` | nullable | GDPR consent tracking |
| `consent_timestamp` | `timestamp` | nullable | When consent was given/updated |
| `terms_accepted_at` | `timestamp` | nullable | When Terms of Service accepted |
| `privacy_accepted_at` | `timestamp` | nullable | When Privacy Policy accepted |
| `blocked_reason` | `text` | nullable | Content violation reason |
| `blocked_at` | `timestamp` | nullable | When user was blocked |
| `blocked_by` | `varchar` | nullable | Admin who blocked the user |
| `eleven_labs_credential_id` | `varchar` | nullable | ElevenLabs key pool affinity |
| `kyc_status` | `text` | default `'pending'` | Set to `'pending'` on UAE Pass signup |
| `kyc_submitted_at` | `timestamp` | nullable | When KYC was submitted |
| `kyc_approved_at` | `timestamp` | nullable | When KYC was approved |
| `kyc_rejection_reason` | `text` | nullable | If KYC was rejected |
| `billing_name` | `text` | nullable | Billing details |
| `billing_address_line1` | `text` | nullable | Billing details |
| `billing_address_line2` | `text` | nullable | Billing details |
| `billing_city` | `text` | nullable | Billing details |
| `billing_state` | `text` | nullable | Billing details |
| `billing_postal_code` | `text` | nullable | Billing details |
| `billing_country` | `text` | nullable | Billing details |
| `company` | `text` | nullable | Company name |

---

## 2. Refresh Tokens Table

The `refresh_tokens` table stores hashed refresh tokens created during UAE Pass authentication.

### Table: `refresh_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `varchar` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated UUID |
| `user_id` | `varchar` | NOT NULL, FK → `users.id` ON DELETE CASCADE | Links to the authenticated user |
| `token` | `text` | NOT NULL, UNIQUE | SHA-256 hash of the raw refresh token |
| `expires_at` | `timestamp` | NOT NULL | 30 days from creation |
| `is_valid` | `boolean` | NOT NULL, default `true` | Can be invalidated on logout |
| `user_agent` | `text` | nullable | Browser/client user-agent string |
| `ip_address` | `text` | nullable | Client IP address at login |
| `last_used_at` | `timestamp` | nullable | Updated on token refresh |
| `created_at` | `timestamp` | NOT NULL, default `now()` | When the token was created |

---

## 3. User Subscriptions Table

The `user_subscriptions` table tracks plan subscriptions. A free plan subscription is created automatically for new UAE Pass users.

### Table: `user_subscriptions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `varchar` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated UUID |
| `user_id` | `varchar` | NOT NULL, FK → `users.id` ON DELETE CASCADE | Links to the user |
| `plan_id` | `varchar` | NOT NULL, FK → `plans.id` ON DELETE RESTRICT | Links to the assigned plan |
| `status` | `text` | NOT NULL, default `'active'` | `active`, `cancelled`, or `expired` |
| `current_period_start` | `timestamp` | NOT NULL, default `now()` | Subscription start date |
| `current_period_end` | `timestamp` | NOT NULL | Set to 1 year from creation for free plans |
| `stripe_subscription_id` | `text` | UNIQUE, nullable | Not set for free plans |
| `razorpay_subscription_id` | `text` | UNIQUE, nullable | Not set for free plans |
| `paypal_subscription_id` | `text` | UNIQUE, nullable | Not set for free plans |
| `paystack_subscription_code` | `text` | UNIQUE, nullable | Not set for free plans |
| `paystack_customer_code` | `text` | nullable | Not set for free plans |
| `paystack_email_token` | `text` | nullable | Not set for free plans |
| `mercadopago_subscription_id` | `text` | UNIQUE, nullable | Not set for free plans |
| `cancel_at_period_end` | `boolean` | NOT NULL, default `false` | Cancellation scheduling |
| `billing_period` | `text` | NOT NULL, default `'monthly'` | Set to `'monthly'` for UAE Pass signups |
| `override_max_agents` | `integer` | nullable | Admin per-user override |
| `override_max_campaigns` | `integer` | nullable | Admin per-user override |
| `override_max_contacts_per_campaign` | `integer` | nullable | Admin per-user override |
| `override_max_webhooks` | `integer` | nullable | Admin per-user override |
| `override_max_knowledge_bases` | `integer` | nullable | Admin per-user override |
| `override_max_flows` | `integer` | nullable | Admin per-user override |
| `override_max_phone_numbers` | `integer` | nullable | Admin per-user override |
| `override_max_widgets` | `integer` | nullable | Admin per-user override |
| `override_included_credits` | `integer` | nullable | Admin per-user override |
| `created_at` | `timestamp` | NOT NULL, default `now()` | Record creation time |
| `updated_at` | `timestamp` | NOT NULL, default `now()` | Last update time |

---

## 4. UAE Pass Profile → Database Mapping

This diagram shows how data flows from the UAE Pass `/userinfo` response into the database:

```
UAE Pass /userinfo Response          →    Database (users table)
─────────────────────────────────         ──────────────────────
uuid / sub                           →    (not stored; used to construct fallback email if email is null)
firstnameEN + " " + lastnameEN       →    users.name
email                                →    users.email
  (fallback: {uuid}@uaepass.local)

Fields NOT stored:
  - gender
  - mobile
  - nationalityEN
  - idn
  - firstnameAR / lastnameAR
```

### Auto-Generated Records on New UAE Pass User

```
1. users record created:
   - email, name from UAE Pass profile
   - password = bcrypt(random 32-byte hex)
   - role = 'user'
   - kyc_status = 'pending'

2. user_subscriptions record created:
   - plan_id = free plan ID
   - status = 'active'
   - current_period_start = now
   - current_period_end = now + 365 days
   - billing_period = 'monthly'

3. users.credits updated:
   - Set to free plan's includedCredits value

4. refresh_tokens record created:
   - token = SHA-256(raw refresh token)
   - expires_at = now + 30 days
   - user_agent = request user-agent
   - ip_address = request IP
   - last_used_at = now
```

---

## 5. Data Security Measures

| Aspect | Implementation |
|---|---|
| **Password storage** | bcrypt with salt rounds = 10 |
| **Refresh token storage** | SHA-256 hashed in database; raw token in HttpOnly cookie |
| **Cascading deletes** | `refresh_tokens` and `user_subscriptions` cascade on user deletion |
| **Soft delete support** | `is_deleted`, `deleted_at`, `deleted_by` fields on users table |
| **Access token** | JWT with 15-minute expiry, stored in localStorage |
| **Cookie security** | HttpOnly, Secure (production), SameSite=Lax, path restricted to `/api/auth` |
