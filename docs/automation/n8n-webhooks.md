# Inbound automation with webhooks and n8n

Platform HTTP webhooks deliver **JSON** POST requests when telephony events occur. Point your webhook URL at **n8n** (Webhook trigger node), **Make**, **Zapier**, or any HTTPS endpoint.

## Verification

Each delivery includes:

- Header `X-Webhook-Signature`: `sha256=<hex HMAC-SHA256>` of the **raw request body** using your webhook **secret**.
- Header `X-Webhook-Event`: the event name.

Compute HMAC on the exact JSON bytes received (before parsing) and compare in constant time.

Use `GET /api/webhooks/event-catalog` (authenticated) for the full event list and payload field notes.

## IVR events

| Event | When |
|--------|------|
| `ivr.started` | Caller reached the IVR menu |
| `ivr.language_selected` | Caller pressed a language digit (multi-language IVR) |
| `ivr.option_selected` | Caller chose a department / menu option |

Typical `ivr.option_selected` data includes `departmentId`, `departmentLabel`, `dtmf`, `ivrId`, `phoneNumberId`, `callSid`, `fromNumber`, `toNumber`.

## Inbound routing policy (optional)

Per DID, you can store **`inboundRoutingPolicy`** on the phone number (see API below). Supported behavior:

- **`vipNumbers`**: E.164 list; combined with **`vipBypassHours`**, VIP callers skip closed-hours rejection.
- **`weeklyHours`**, **`timezone`**, **`rejectOutsideHours`**, **`outsideHoursMessage`**: reject callers outside configured windows with a spoken message.

**API:** `PATCH /api/incoming-connections/phone-numbers/:phoneNumberId/inbound-routing-policy`  
Body: `{ "policy": { ... } | null }`

## Integration Concierge

The concierge chat (`/app/integrations/concierge`) uses AWS Bedrock to suggest **recipes** bound to allowlisted trigger events, then compiles them to n8n workflows. Allowed triggers include `inbound_call.received`, `ivr.option_selected`, `call.completed`, etc.

See example workflow stubs in `docs/automation/examples/`.
