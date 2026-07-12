# Log every inbound leg to Google Sheets

**Subscribe to:** `inbound_call.received`

**n8n outline:**

1. **Webhook**
2. **Google Sheets — Append row** with columns: timestamp (`{{ $json.timestamp }}`), from (`{{ $json.data.fromNumber }}`), to (`{{ $json.data.toNumber }}`), callSid (`{{ $json.data.callSid }}`), vip (`{{ $json.data.isVip }}`).

Use the same pattern for BigQuery or PostgreSQL nodes instead of Sheets.
