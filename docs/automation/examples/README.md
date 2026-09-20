# Example automation flows

These files are **documentation templates**, not drop-in n8n exports.

- **`slack-from-ivr-option.md`** — Branch on `ivr.option_selected` and route to Slack channels by `departmentId`.
- **`sheet-log-inbound.md`** — Append a row to Google Sheets on `inbound_call.received`.

In n8n:

1. Add a **Webhook** node (POST). Activate the workflow and copy the production URL into the platform **Webhooks** settings.
2. Subscribe to events: e.g. `ivr.option_selected`, `inbound_call.received`.
3. Add a **Switch** or **IF** node on `{{ $json.event }}` or on fields inside `{{ $json.data }}`.

Payload envelope:

```json
{
  "event": "ivr.option_selected",
  "timestamp": "2026-05-06T12:00:00.000Z",
  "data": { ... }
}
```
