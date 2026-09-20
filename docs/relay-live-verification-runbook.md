# Two-Hop Relay — Live UAE 800 Verification Runbook

This runbook is the manual, real-world verification for the two-hop relay
transfer path. It cannot be automated from the agent environment because it
requires a real PSTN call into a UAE 800 DID and a real UAE handset whose
caller-ID display has to be physically observed.

Source of truth for the implementation:
- `artifacts/loop23/server/routes/webhook-routes.ts`
  - relay branch: ~L1891–2013
  - hop2 status callback / cleanup: ~L2347–2395
- `artifacts/loop23/client/src/pages/HumanAgentCanvas.tsx` (Step 2 relay selector)

## Pre-flight (in production)

1. Workspace has at least one **non-UAE Twilio-owned number** available
   (e.g. a US `+1…`). This will be the relay.
2. Workspace has the **UAE 800 inbound DID** configured and routed to the
   `/api/webhooks/twilio/voice` (or human-agent equivalent) webhook.
3. Pick a **UAE-terminated test handset** you control (mobile is fine) and
   record its E.164 number — this will be the human agent.
4. In **HumanAgentCanvas → Step 2 (Assign Human Agent)**:
   - Agent phone number = the UAE handset from step 3.
   - **Relay number** = the non-UAE Twilio number from step 1.
   - Save and confirm the resulting `human_incoming_connections` row has
     `relay_phone_number_id` populated (spot check via DB if needed).

## Happy path

1. From any phone (ideally a UAE caller, since that is the case the relay
   exists to fix), call the UAE 800 DID.
2. On the UAE handset, **observe and photograph the incoming caller ID**.
   Acceptance: it shows the **+1 relay number**, not the UAE 800 DID and not
   the original caller's number.
3. Answer the call and confirm two-way audio with the original caller.
4. Hang up from either side. Conference must end (no stranded leg).

### Evidence to capture from production logs

Filter production logs for the inbound `CallSid`. You should see, in order:

```
[Transfer] engine=human-agent-relay-hop1 callSid=<CA…> target=conference:human-relay-<CA…> relay=<+1…> finalTarget=<+971…> inboundDid=<+971800…>
[Transfer] engine=human-agent-relay-hop2 callSid=<CA…> relayCallSid=<CA…> target=<+971…> callerId=<+1…> source=relay conference=human-relay-<CA…>
```

Then a `calls` row for that `twilioSid` should have:

- `was_transferred = true`
- `transferred_to = <UAE agent number>`
- `transfer_caller_id = <+1 relay number>`
- `transfer_caller_id_source = 'relay'`
- `transfer_relay_phone_number = <+1 relay number>`

Quick SQL (run via the database skill, **production, read-only**):

```sql
select twilio_sid, was_transferred, transferred_to,
       transfer_caller_id, transfer_caller_id_source, transfer_relay_phone_number,
       transferred_at
from calls
where twilio_sid = '<CA…>';
```

## Failure path (unreachable agent)

1. In Step 2, temporarily change the agent phone number to an
   **unreachable but well-formed** number — e.g. a UAE mobile prefix with a
   guaranteed-invalid subscriber tail, or simply power off the test handset
   and let it ring out.
2. Place a fresh inbound call to the UAE 800 DID.
3. Acceptance: the customer leg is **terminated promptly** (within the 45s
   hop2 timeout, sooner on `failed`/`busy`) — no silent stranded conference.

### Evidence to capture

```
[Transfer] engine=human-agent-relay-hop1 callSid=<CA…> …
[Transfer] engine=human-agent-relay-hop2 callSid=<CA…> relayCallSid=<CA…> …
⚠️ [Human Dial Status] Outbound leg ended without answer: <busy|failed|no-answer>
[Transfer] engine=human-agent-relay-cleanup callSid=<CA…> action=hangup-parent reason=hop2-<busy|failed|no-answer>
```

If hop2 origination itself fails (e.g. invalid relay number), the cleanup log
line will instead read `reason=hop2-create-failed` and is emitted from the
relay-branch catch in `webhook-routes.ts` (~L1998).

## Sign-off checklist

- [ ] Caller ID on UAE handset = +1 relay number (photo attached)
- [ ] `engine=human-agent-relay-hop1` log present
- [ ] `engine=human-agent-relay-hop2` log present with `source=relay`
- [ ] `calls.transfer_caller_id_source = 'relay'` for the test CallSid
- [ ] Failure path: `engine=human-agent-relay-cleanup` log present and
      customer leg terminated within ≤ 45s

If any item fails, capture the full log block for the affected `CallSid` plus
the matching `calls` row and file a follow-up against the relay branch in
`webhook-routes.ts`.
