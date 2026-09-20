# Slack notification when an IVR department is selected

**Subscribe to:** `ivr.option_selected`

**n8n outline:**

1. **Webhook** — Method POST, path e.g. `/ivr-dept`.
2. **Switch** on `{{ $json.data.departmentId }}` or label.
3. **Slack** — Map `{{ $json.data.departmentLabel }}`, caller `{{ $json.data.fromNumber }}`, `{{ $json.data.callSid }}`.

Optional: filter only when `{{ $json.event }}` equals `ivr.option_selected`.
