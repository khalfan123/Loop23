/**
 * AI Call Center Automation — Curated Starter Pack
 *
 * Templates grouped by *outcome* (job-to-be-done) so users find them by
 * what they want to achieve, not by random industry × destination matrix.
 *
 * Each template is a known-good recipe that the Concierge backend can
 * provision in one click without an additional chat round-trip.
 */

export type StarterOutcome =
  | "recover"
  | "convert"
  | "comply"
  | "coach"
  | "notify";

export type StarterTriggerEvent =
  // outbound
  | "call.completed"
  | "call.failed"
  | "call.busy"
  | "call.no_answer"
  | "call.voicemail"
  | "call.transferred"
  // inbound
  | "inbound_call.received"
  | "inbound_call.missed"
  // ivr
  | "ivr.option_selected"
  // appointment
  | "appointment.no_show"
  // lead/form/campaign
  | "lead.captured"
  | "form.submitted"
  | "campaign.completed"
  | "campaign.started";

export type StarterDestination =
  | "twilio"
  | "whatsapp"
  | "sendgrid"
  | "slack"
  | "hubspot"
  | "salesforce"
  | "zendesk"
  | "google_calendar"
  | "google_sheets"
  | "asana"
  | "bamboohr"
  | "internal_queue"
  | "outbound_campaign"
  | "review_queue";

export interface StarterTemplate {
  id: string;
  outcome: StarterOutcome;
  title: string;
  /** One-line plain-English summary that goes on the card body. */
  summary: string;
  /** The natural-language prompt fed to the Concierge for one-click install. */
  prompt: string;
  triggerEvent: StarterTriggerEvent;
  destination: StarterDestination;
  /** Apps you'll need to have credentials for. */
  requiredApps: string[];
  setupMinutes: number;
  verified: true;
  /** Synthetic install signal for v1; replace with real metric later. */
  installCount: number;
}

export const OUTCOME_META: Record<
  StarterOutcome,
  { label: string; description: string; tone: string }
> = {
  recover: {
    label: "Recover",
    description: "Win back missed conversations and lost revenue",
    tone: "text-amber-600 dark:text-amber-400",
  },
  convert: {
    label: "Convert",
    description: "Turn calls and forms into pipeline faster",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  comply: {
    label: "Comply",
    description: "Catch consent and policy issues before they ship",
    tone: "text-rose-600 dark:text-rose-400",
  },
  coach: {
    label: "Coach",
    description: "Find moments to train and guide your agents",
    tone: "text-violet-600 dark:text-violet-400",
  },
  notify: {
    label: "Notify & Operate",
    description: "Keep humans in the loop on what matters",
    tone: "text-sky-600 dark:text-sky-400",
  },
};

export const CALL_CENTER_STARTER_PACK: StarterTemplate[] = [
  // ─── Recover ───────────────────────────────────────────────
  {
    id: "recover-missed-callback",
    outcome: "recover",
    title: "Missed inbound call → SMS callback",
    summary:
      "When a caller hangs up before being answered, send an SMS within 60s offering a callback link.",
    prompt:
      "When inbound_call.missed happens, send an SMS via Twilio to the caller offering to schedule a callback. Include a Cal.com booking link.",
    triggerEvent: "inbound_call.missed",
    destination: "twilio",
    requiredApps: ["Twilio"],
    setupMinutes: 5,
    verified: true,
    installCount: 1842,
  },
  {
    id: "recover-voicemail-summary",
    outcome: "recover",
    title: "Voicemail → AI summary email",
    summary:
      "Transcribe voicemails, summarise the intent, and email the assigned agent with next-step actions.",
    prompt:
      "When call.voicemail happens, transcribe the audio, generate a short summary with intent + next steps, and send an email via SendGrid to the assigned agent.",
    triggerEvent: "call.voicemail",
    destination: "sendgrid",
    requiredApps: ["SendGrid"],
    setupMinutes: 6,
    verified: true,
    installCount: 1305,
  },
  {
    id: "recover-failed-retry",
    outcome: "recover",
    title: "Failed outbound → smart retry queue",
    summary:
      "Retry busy / no-answer calls in 2h, 24h, 72h with backoff and stop after 3 attempts.",
    prompt:
      "When call.failed, call.busy, or call.no_answer happens, schedule a retry in 2h, then 24h, then 72h. Cap at 3 attempts. Mark as 'unreachable' after.",
    triggerEvent: "call.no_answer",
    destination: "internal_queue",
    requiredApps: [],
    setupMinutes: 4,
    verified: true,
    installCount: 2218,
  },
  {
    id: "recover-noshow-reschedule",
    outcome: "recover",
    title: "No-show → SMS reschedule",
    summary:
      "If a customer misses an appointment, send a friendly SMS with a one-click reschedule link.",
    prompt:
      "When appointment.no_show happens, send an SMS via Twilio with a Google Calendar booking link to reschedule. Tag the contact as 'no_show_recovered' on success.",
    triggerEvent: "appointment.no_show",
    destination: "twilio",
    requiredApps: ["Twilio", "Google Calendar"],
    setupMinutes: 7,
    verified: true,
    installCount: 967,
  },

  // ─── Convert ───────────────────────────────────────────────
  {
    id: "convert-hot-lead-slack",
    outcome: "convert",
    title: "Hot lead detected → Slack ping",
    summary:
      "When the AI scores a lead as high-intent, ping the on-duty sales rep in Slack with the call summary.",
    prompt:
      "When lead.captured happens with intent=high, post to #sales-hot in Slack with the contact name, phone, and AI call summary. Mention the on-duty rep.",
    triggerEvent: "lead.captured",
    destination: "slack",
    requiredApps: ["Slack"],
    setupMinutes: 4,
    verified: true,
    installCount: 3104,
  },
  {
    id: "convert-call-to-deal",
    outcome: "convert",
    title: "Demo intent → HubSpot deal",
    summary:
      "When a call ends with demo intent, create a HubSpot deal pre-filled with the call summary and next-step.",
    prompt:
      "When call.completed has intent=demo, upsert the contact in HubSpot, create a deal in 'Discovery' stage, and log the call summary as a note.",
    triggerEvent: "call.completed",
    destination: "hubspot",
    requiredApps: ["HubSpot"],
    setupMinutes: 8,
    verified: true,
    installCount: 1791,
  },
  {
    id: "convert-form-instant-call",
    outcome: "convert",
    title: "Form submit → outbound call in 5 min",
    summary:
      "Trigger an AI outbound call within 5 minutes of any website form submission to maximise conversion.",
    prompt:
      "When form.submitted happens, queue an outbound campaign call within 5 minutes using the lead's phone number and the 'Lead Qualifier' agent.",
    triggerEvent: "form.submitted",
    destination: "outbound_campaign",
    requiredApps: [],
    setupMinutes: 3,
    verified: true,
    installCount: 2456,
  },

  // ─── Comply ────────────────────────────────────────────────
  {
    id: "comply-keyword-flag",
    outcome: "comply",
    title: "Compliance keyword → review queue",
    summary:
      "Detect risky phrases in transcripts (e.g. 'guarantee', 'no risk') and freeze auto-actions for review.",
    prompt:
      "When call.completed transcript contains compliance keywords (guarantee, no risk, refund anytime), flag the call for human review and skip downstream CRM actions.",
    triggerEvent: "call.completed",
    destination: "review_queue",
    requiredApps: [],
    setupMinutes: 6,
    verified: true,
    installCount: 612,
  },
  {
    id: "comply-no-consent",
    outcome: "comply",
    title: "Consent missing → block CRM write",
    summary:
      "If TCPA/GDPR consent wasn't captured, block downstream CRM sync and alert the manager.",
    prompt:
      "When call.completed has consent_captured=false, block the HubSpot sync, alert #compliance in Slack, and create a Zendesk ticket for review.",
    triggerEvent: "call.completed",
    destination: "slack",
    requiredApps: ["Slack", "Zendesk"],
    setupMinutes: 7,
    verified: true,
    installCount: 489,
  },

  // ─── Coach ─────────────────────────────────────────────────
  {
    id: "coach-low-qa",
    outcome: "coach",
    title: "Low QA score → coaching task",
    summary:
      "When a call's QA score is below threshold, create a coaching task with timestamps for the agent's manager.",
    prompt:
      "When call.completed has qa_score<70, create an Asana task in the agent's manager's project with the call link and the lowest-scored timestamps.",
    triggerEvent: "call.completed",
    destination: "asana",
    requiredApps: ["Asana"],
    setupMinutes: 8,
    verified: true,
    installCount: 433,
  },
  {
    id: "coach-sentiment-shift",
    outcome: "coach",
    title: "Negative sentiment → supervisor whisper",
    summary:
      "Mid-call sentiment turning negative? Notify the supervisor in Slack so they can listen in or coach.",
    prompt:
      "When call.transferred happens with sentiment=negative, notify #supervisors in Slack with a live-listen link and the last 30s of transcript.",
    triggerEvent: "call.transferred",
    destination: "slack",
    requiredApps: ["Slack"],
    setupMinutes: 5,
    verified: true,
    installCount: 728,
  },

  // ─── Notify / Operate ──────────────────────────────────────
  {
    id: "notify-after-hours",
    outcome: "notify",
    title: "After-hours inbound → morning digest",
    summary:
      "Collect after-hours calls and send a single morning digest email at 8am instead of pinging overnight.",
    prompt:
      "When inbound_call.received happens outside business hours, queue it. At 8am every weekday, send a SendGrid digest email to the on-duty manager.",
    triggerEvent: "inbound_call.received",
    destination: "sendgrid",
    requiredApps: ["SendGrid"],
    setupMinutes: 6,
    verified: true,
    installCount: 1149,
  },
  {
    id: "notify-daily-kpis",
    outcome: "notify",
    title: "Daily KPI digest → Sheets + Slack",
    summary:
      "Append a row of KPIs (calls, answer rate, avg duration) to Google Sheets and post a summary in Slack each day.",
    prompt:
      "When campaign.completed happens, append a Google Sheets row with KPIs (total calls, answer_rate, avg_duration, conversions) and post a summary to #ops in Slack.",
    triggerEvent: "campaign.completed",
    destination: "google_sheets",
    requiredApps: ["Google Sheets", "Slack"],
    setupMinutes: 5,
    verified: true,
    installCount: 1672,
  },
  {
    id: "notify-cost-spike",
    outcome: "notify",
    title: "Cost spike → auto-pause + alert",
    summary:
      "If a campaign burns more than X credits/hour, auto-pause it and email the admin. Catches stuck loops early.",
    prompt:
      "When campaign.started credit-burn rate exceeds the threshold, auto-pause the campaign and email the admin via SendGrid with the last 10 call IDs.",
    triggerEvent: "campaign.started",
    destination: "sendgrid",
    requiredApps: ["SendGrid"],
    setupMinutes: 6,
    verified: true,
    installCount: 308,
  },
  {
    id: "notify-ivr-route",
    outcome: "notify",
    title: "IVR 'Sales' option → CRM lead + route",
    summary:
      "When a caller picks the Sales option in your IVR, create a Salesforce lead and route the call to a sales agent.",
    prompt:
      "When ivr.option_selected has option=sales, create a Salesforce lead with caller info and route the call to the sales queue.",
    triggerEvent: "ivr.option_selected",
    destination: "salesforce",
    requiredApps: ["Salesforce"],
    setupMinutes: 7,
    verified: true,
    installCount: 845,
  },
];

export const STARTER_PACK_BY_OUTCOME: Record<StarterOutcome, StarterTemplate[]> =
  CALL_CENTER_STARTER_PACK.reduce(
    (acc, t) => {
      (acc[t.outcome] ||= []).push(t);
      return acc;
    },
    {} as Record<StarterOutcome, StarterTemplate[]>,
  );
