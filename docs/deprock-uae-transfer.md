# Deprock IVR → AI → human transfer (UAE and international)

## Scope

This document describes the **Human Agent / inbound IVR → transfer** path only. Twilio compliance notes here are scoped to that **isolated** feature (same inbound session, `<Dial>` bridge to an agent). They are **not** meant to override how **campaigns**, **outbound dialers**, or other Twilio number types are configured elsewhere in the product.

## Twilio UAE toll-free numbers (inbound IVR → human in UAE)

Twilio’s UAE voice guidelines include a **toll-free–specific** rule: traffic **to** your UAE toll-free number is expected to **terminate in the United Arab Emirates** (see Twilio’s UAE table for the exact wording).

For **this** feature—customer calls your UAE toll-free line → your IVR/AI → **transfer to a human on a UAE mobile or landline**—the **destination** of the bridged leg remains **inside the UAE**, which aligns with the requirement that calls to a UAE toll-free number terminate there. That is a **different** constraint than the **UAE geographic** inbound-only / outbound-CLI rules in the next section.

**Allowed flow (conceptual):**

1. Customer calls your **UAE toll-free** Twilio number.
2. Twilio delivers the call to your IVR/AI app (webhook).
3. On agent request, your app bridges the **same call** to a human at a **UAE** E.164 destination (mobile or landline), or another UAE-terminating endpoint Twilio supports.

Other toll-free limitations from Twilio (for example **no standalone resale/transfer** of the toll-free number to third parties) still apply—confirm details in Twilio Console and your agreement.

### Practical SaaS design (UAE toll-free)

A straightforward layout for this feature:

| Role | Choice |
|------|--------|
| Public number | **UAE toll-free** (customer-facing inbound). |
| First answer | **IVR / AI** in your app (webhook). |
| Escalation | Bridge to a **UAE** destination: mobile, landline, **PBX/SIP** endpoint, or **contact-center seats** that terminate in the UAE. |

TwiML shape: after IVR decides to escalate, return `<Dial>` to the UAE agent destination on the **same inbound toll-free call**. That preserves the inbound toll-free flow and keeps the human leg aligned with **UAE termination** expectations.

**Working rule for toll-free:** **UAE toll-free inbound → IVR/AI → UAE human destination only.**  
If you sometimes route humans **outside** the UAE, or **share one UAE toll-free across many SaaS tenants/clients**, Twilio’s summary table may not be enough—**confirm that exact architecture with Twilio support/compliance** before launch.

### Disclaimer and edge cases

Twilio’s country pages are a **compliance-oriented summary**, not legal advice; requirements can change, and you remain responsible for **your** application meeting applicable rules. Validate edge cases (agent geography, multi-tenant numbering, resale of toll-free) against Twilio and your own counsel when needed.

## Twilio UAE geographic numbers (short compliance note)

Twilio’s UAE product terms treat **UAE geographic** numbers as **inbound-only** for your account: you must not use that number type as the **originating** identity for general **outbound** or **dialer** traffic (including workarounds like chaining another leg only to “push” outbound through the UAE geo).

**Normal inbound support is in scope:** a customer calls your UAE DID → IVR/AI → **transfer to a human** on the **same Twilio call** (TwiML `<Dial>` on the inbound leg, or `calls.update` on that CallSid with `<Dial>`) is standard contact-center behavior and is **not** the same as starting separate outbound campaigns from the UAE geographic caller ID.

If you later run **outbound campaigns** to UAE PSTN, configure those with a **non-UAE** Twilio caller ID where policy requires it; that is separate from this inbound IVR → human flow.

## Operator checklist

1. **Incoming agent**
   - Enable **call transfer** and set **transfer phone number** in **Agents** (or **Agent Editor**) using **E.164**: country code plus subscriber digits, e.g. UAE mobile `+971501234567`, UAE landline patterns such as `+9714xxxxxxx` (use the full number from your carrier).
   - The UI accepts any valid E.164 destination (UAE or abroad). Stored values are normalized to `+[digits]` without spaces.
   - For **UAE toll-free** inbound lines where you follow Twilio’s **termination-in-UAE** expectation, configure transfer targets as **UAE-only** human destinations (mobile, PBX/SIP, or CC seats in UAE)—see **Practical SaaS design** above.

2. **Deprock**
   - Assign that incoming agent to the correct department (**Assign AI agent**).
   - In the department **Configure** sheet, **Transfer number** (under Agent Features) applies to **all agents assigned to that department** when you click **Save Changes** — it syncs transfer settings to those agent records.

3. **Twilio**
   - Use Twilio credentials for the **same account** that owns your inbound number (`TWILIO_ACCOUNT_SID_UAE` + `AUTH_TWILIO_UAE` when using the UAE pair — see `server/services/twilio-connector.ts`).
   - **Transfer `<Dial>` caller ID:** For **UAE toll-free** inbound lines (`+971800…`), carriers often reject that toll-free as the **outbound CLI** on the leg to a UAE mobile. **Human Agent connections:** In **Assign Human Agent → Step 2 (Transfer Settings)**, choose a **non-UAE Twilio-owned number** from your account; that selection is used first on the `<Dial>` leg so the human agent sees that Twilio CLI (not your UAE toll-free and not the customer’s number). **`TWILIO_TRANSFER_CALLER_ID`** in Secrets remains an account-wide fallback when no outbound selection is stored or when resolving legacy connections—use a non-UAE Twilio number (e.g. UK/US). Example: `TWILIO_TRANSFER_CALLER_ID=+442071838562`.
   - In the Twilio Console, enable **Voice** geographic permissions for **United Arab Emirates** (and any other destination countries you dial).
   - If your inbound line is a **UAE toll-free** Twilio number and you rely on **termination in the UAE**, set the transfer destination to a **UAE** number when routing to a human (see **Twilio UAE toll-free** above). Geographic and toll-free rules differ—pick the paragraph that matches your number type.
   - **Human Agent connection (no AI, or AI without ElevenLabs):** the webhook builds `<Dial>` `callerId` from **the outbound number chosen in the Human Agent wizard** (non-UAE Twilio number), then **`TWILIO_TRANSFER_CALLER_ID`**, then the existing rules (omit UAE toll-free inbound DID / use inbound DID where applicable).
   - **AI with ElevenLabs** (or streamed AI with `transfer_call`): when the agent invokes `transfer_call`, the platform runs `calls.update` on the **same parent CallSid** with TwiML `<Dial>`; `callerId` on that bridge is the **original PSTN caller** (so the agent sees who called). Both patterns keep the session as **inbound handling + transfer**, not a new originated outbound from the UAE geo to customers.

4. **Runtime behavior**
   - After IVR, the caller reaches the AI (e.g. redirect to **ElevenLabs**, or `<Connect><Stream>` for OpenAI Realtime). When the caller asks for a human, the model invokes `transfer_call` (or the Human Agent path dials the transfer number directly); the platform bridges with `<Dial>` to the configured E.164 number.

## Troubleshooting

### Twilio Request Inspector shows “no HTTP requests” for a transfer leg

That usually means **Twilio never called your app for that event**—often normal when TwiML was only `<Dial><Number>…</Number></Dial>` with **no** `action` or **`<Number statusCallback>`**. The `<Dial>` runs inside Twilio/carriers until it connects or fails; failures on the **UAE mobile leg** (CLI, geo permissions, routing) show up in **Monitor → Logs → Voice** on the **child call**, not necessarily in Inspector.

Human Agent / IVR `<Dial>` transfers now register **`action`** (`/api/webhooks/twilio/human-dial-action`) and **`statusCallback`** on the dialed number (`/api/webhooks/twilio/human-dial-status`) so you get HTTP logs for dial lifecycle. Still use Voice Logs + **error codes on the child leg** when debugging UAE PSTN rejects.

- **Call disconnects immediately after the IVR department menu (ElevenLabs agent)**: The server **proxies** the Twilio POST body to ElevenLabs (`/twilio/inbound_call`) and returns ElevenLabs’ TwiML—same as a **direct** inbound-to-agent call. A bare `<Redirect>` after `<Gather>` is unreliable; if issues persist, check server logs for `IVR Selection` / ElevenLabs HTTP status and TwiML prefix.
- **Transfer fails / busy / declined**: Confirm geo permissions, number format (`+971…`), and that the destination allows calls from your Twilio caller ID.
- **Wrong Twilio account**: Inbound call and `calls.update` must use the account that owns the DID.
