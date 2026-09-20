'use strict';

export { buildCopilotSystemPrompt } from './automation-copilot-system-prompt';

export type GuidanceStep = {
  id: string;
  order: number;
  type: 'trigger' | 'action';
  appId: string | null;
  actionId: string | null;
  label: string;
  config: Record<string, unknown>;
};

export type GuidanceAutomation = {
  name: string;
  status: 'draft' | 'published';
  steps: GuidanceStep[];
};

export type StepGap = {
  stepNumber: number;
  stepId: string;
  label: string;
  status: 'ready' | 'needs_attention';
  summary: string;
  howToFix: string;
  goodLooksLike: string;
};

export type DryRunStepLike = {
  id: string;
  order: number;
  label: string;
  status: 'ok' | 'warn' | 'error' | 'skipped';
  detail: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  'call.completed': 'When a call ends',
  'inbound_call.received': 'When an inbound call arrives',
  'outbound_call.completed': 'When an outbound call ends',
  'appointment.booked': 'When an appointment is booked',
  'appointment.cancelled': 'When an appointment is cancelled',
  'lead.captured': 'When a new lead is captured',
  'campaign.started': 'When a campaign starts',
  'campaign.paused': 'When a campaign pauses',
  'voicemail.received': 'When a voicemail is received',
};

const FLOW_NODE_LABELS: Record<string, string> = {
  message: 'Message',
  question: 'Question',
  condition: 'Condition',
  webhook: 'Webhook',
  delay: 'Delay',
  transfer: 'Transfer',
  form: 'Form',
  appointment: 'Appointment',
  end: 'End call',
  play_audio: 'Play audio',
};

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function humanTriggerLabel(triggerId: string | null): string {
  if (!triggerId) return 'a call-center event';
  return TRIGGER_LABELS[triggerId] || triggerId.replace(/\./g, ' · ');
}

export function appDisplayName(
  appId: string | null,
  catalog: Map<string, string>,
): string {
  if (!appId || appId === 'loop9') return 'Loop9';
  if (appId === 'webhooks') return 'Webhooks';
  return catalog.get(appId) || appId;
}

export function analyzeStepGaps(
  automation: GuidanceAutomation,
  catalogNames: Map<string, string>,
): StepGap[] {
  return automation.steps.map((step, index) => {
    const stepNumber = index + 1;
    const nodeType =
      typeof step.config?.nodeType === 'string' ? step.config.nodeType : null;
    const base = {
      stepNumber,
      stepId: step.id,
      label: step.label,
    };

    if (step.type === 'trigger') {
      if (!step.actionId) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Trigger not chosen yet',
          howToFix:
            'Click the **Trigger** card on the canvas → in **Node Properties** (right panel), open **Trigger event** or **Browse triggers…** → pick when your automation should start.',
          goodLooksLike:
            'The trigger card shows a green check and an event like **call.completed** or **inbound_call.received**.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: `Starts on **${humanTriggerLabel(step.actionId)}**`,
        howToFix: 'No changes needed unless you want a different start event.',
        goodLooksLike: `Trigger card shows **${step.actionId}** with a check mark.`,
      };
    }

    if (nodeType === 'webhook' || step.appId === 'webhooks') {
      const url = str(step.config, 'webhookUrl');
      if (!url) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Webhook URL is empty',
          howToFix:
            'Click this **Webhook** step → in **Node Properties**, paste your API link into **Webhook URL** → confirm **Method** is POST (usually).',
          goodLooksLike:
            'A full https://… URL is saved. **Test** should show this step as OK (not a warning).',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Webhook URL is set',
        howToFix: 'Optional: add notes in Node Properties if your team needs mapping reminders.',
        goodLooksLike: `**Webhook URL** shows your endpoint; dry-run says it would POST there.`,
      };
    }

    if (nodeType === 'message') {
      const message = str(step.config, 'message');
      if (!message) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Message text is empty',
          howToFix:
            'Click the step → **Node Properties** → fill in **Message** with what agents or callers should hear or see.',
          goodLooksLike: 'A clear sentence like “Thanks for calling — a supervisor will follow up shortly.”',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Message configured',
        howToFix: 'Edit **Message** anytime in Node Properties.',
        goodLooksLike: 'Message field has your script; step shows a check on the canvas.',
      };
    }

    if (nodeType === 'question') {
      const question = str(step.config, 'question');
      const variable = str(step.config, 'variableName');
      if (!question || !variable) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Question or save-as field missing',
          howToFix:
            'Click the step → **Node Properties** → enter **Question** and **Save answer as** (e.g. `caller_name`).',
          goodLooksLike: 'Both fields filled; variable name uses lowercase_with_underscores.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Question configured',
        howToFix: 'Adjust wording in Node Properties if needed.',
        goodLooksLike: 'Question and variable name both filled in.',
      };
    }

    if (nodeType === 'condition') {
      const condition = str(step.config, 'condition');
      if (!condition) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Condition rule is empty',
          howToFix:
            'Click the step → **Node Properties** → write a **Condition** (e.g. `intent == "callback"`).',
          goodLooksLike: 'Condition field has a rule your team understands.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Condition set',
        howToFix: 'Refine the rule in Node Properties if routing should change.',
        goodLooksLike: 'Condition expression is saved.',
      };
    }

    if (nodeType === 'transfer') {
      const transferType = str(step.config, 'transferType') || 'phone';
      const phone = str(step.config, 'phoneNumber');
      const agent = str(step.config, 'transferAgentId');
      if (transferType === 'agent' ? !agent : !phone) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Transfer destination missing',
          howToFix:
            'Click the step → **Node Properties** → set **Transfer type** and fill **Phone number** or **Agent ID**.',
          goodLooksLike: 'A valid phone number (+1…) or agent id is saved.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Transfer destination set',
        howToFix: 'Update the number or agent in Node Properties if routing changes.',
        goodLooksLike: 'Transfer fields are filled; canvas step shows a check.',
      };
    }

    if (nodeType === 'play_audio') {
      if (!str(step.config, 'audioUrl')) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Audio URL missing',
          howToFix:
            'Click the step → **Node Properties** → paste an **Audio URL** (https://…/clip.mp3).',
          goodLooksLike: 'Public audio link saved and playable.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Audio URL set',
        howToFix: 'Swap the URL in Node Properties if you change hold music or prompts.',
        goodLooksLike: 'Audio URL field is filled.',
      };
    }

    if (nodeType === 'form') {
      if (!str(step.config, 'formId')) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Form ID missing',
          howToFix: 'Click the step → **Node Properties** → enter your **Form ID**.',
          goodLooksLike: 'Form ID matches a form in your account.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Form linked',
        howToFix: 'Change Form ID in Node Properties if needed.',
        goodLooksLike: 'Form ID is saved.',
      };
    }

    if (nodeType === 'appointment') {
      if (!str(step.config, 'appointmentType')) {
        return {
          ...base,
          status: 'needs_attention' as const,
          summary: 'Appointment type missing',
          howToFix:
            'Click the step → **Node Properties** → set **Appointment type** (e.g. consult).',
          goodLooksLike: 'Appointment type matches your scheduling setup.',
        };
      }
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Appointment type set',
        howToFix: 'Edit type in Node Properties if you offer multiple booking types.',
        goodLooksLike: 'Appointment type field is filled.',
      };
    }

    if (nodeType === 'delay') {
      return {
        ...base,
        status: 'ready' as const,
        summary: 'Delay configured',
        howToFix: 'Adjust **Delay (seconds)** in Node Properties if timing should change.',
        goodLooksLike: 'A sensible wait time (often 3–30 seconds) is set.',
      };
    }

    if (nodeType === 'end') {
      return {
        ...base,
        status: 'ready' as const,
        summary: 'End call step ready',
        howToFix: 'Optional: add an **End message** in Node Properties.',
        goodLooksLike: 'End step is on the canvas; optional goodbye message is set.',
      };
    }

    if (nodeType) {
      const label = FLOW_NODE_LABELS[nodeType] || nodeType;
      return {
        ...base,
        status: 'ready' as const,
        summary: `${label} step placed`,
        howToFix: `Open **Node Properties** for this **${label}** step and review its fields.`,
        goodLooksLike: 'Required fields in Node Properties are filled.',
      };
    }

    if (!step.appId) {
      return {
        ...base,
        status: 'needs_attention' as const,
        summary: 'No app selected',
        howToFix:
          'Click the step → **Node Properties** → under **App**, pick a destination or **Browse apps…** → choose Slack, Sheets, your CRM, etc.',
        goodLooksLike: 'App name appears under the step; card shows a check mark.',
      };
    }

    const appName = appDisplayName(step.appId, catalogNames);
    return {
      ...base,
      status: 'ready' as const,
      summary: `Sends to **${appName}**`,
      howToFix: `Ensure **${appName}** is connected in **Settings → Integrations**. Then click the step → **Node Properties** → confirm **App** and add **Notes** if your team needs field mapping.`,
      goodLooksLike: `App shows **${appName}**; integration is connected in Settings.`,
    };
  });
}

export function buildFinishChecklist(
  automation: GuidanceAutomation,
  catalog: Array<{ id: string; name: string }>,
): string {
  const catalogNames = new Map(catalog.map((a) => [a.id, a.name]));
  const gaps = analyzeStepGaps(automation, catalogNames);
  const pending = gaps.filter((g) => g.status === 'needs_attention');
  const ready = gaps.filter((g) => g.status === 'ready');

  const lines: string[] = ['### Finish checklist', ''];

  for (const gap of gaps) {
    const icon = gap.status === 'ready' ? '✅' : '⚠️';
    lines.push(`${icon} **Step ${gap.stepNumber} — ${gap.label}**`);
    lines.push(`- **Status:** ${gap.summary}`);
    if (gap.status === 'needs_attention') {
      lines.push(`- **How to fix:** ${gap.howToFix}`);
    }
    lines.push(`- **Good looks like:** ${gap.goodLooksLike}`);
    lines.push('');
  }

  lines.push('### How to verify');
  lines.push('');
  lines.push(
    '- Click **Test** (top right). A dry-run walks each step with sample call data — **no live webhooks fire**.',
  );
  if (pending.length > 0) {
    lines.push(
      `- You have **${pending.length}** step(s) to finish first. Fix those, then run **Test** again until all show OK.`,
    );
  } else {
    lines.push('- All steps look configured — **Test** should pass with green checks on every step.');
  }
  lines.push(
    '- If a step fails: click it in the test results (or on the canvas) → fix fields in **Node Properties** → **Test** again.',
  );
  lines.push('');

  const firstPending = pending[0];
  const nextAction = firstPending
    ? `Finish **Step ${firstPending.stepNumber}** (${firstPending.label}) — ${firstPending.summary.toLowerCase()}.`
    : ready.length > 0
      ? 'Run **Test** to confirm everything passes, then save this chat if you want to pick up later.'
      : 'Select a trigger on the canvas, then ask me to add actions.';

  lines.push('> **Next best action:** ' + nextAction);

  return lines.join('\n');
}

export function buildWelcomeMessage(companyName: string): string {
  const company =
    companyName && companyName !== 'your company' ? companyName : 'your call center';
  return [
    `Hi — I'm **Copilot**, your personal automation engineer for **${company}**.`,
    '',
    `Describe what should happen after a call — I'll scaffold the flow on the canvas and tell you exactly how to finish each step.`,
    '',
    '### Try an example',
    '',
    `- *“When a ${company} inbound call ends, send the summary to Slack for supervisors.”*`,
    `- *“If a caller asks for a callback, create a follow-up task in our CRM.”*`,
    `- *“When our AI agent books an appointment, notify the front desk on WhatsApp.”*`,
    '',
    '### How we work together',
    '',
    '- **Build** mode — I update the canvas and give you a finish checklist.',
    '- **Ask** mode — Q&A only; I explain your flow without changing it.',
    '- **Test** — dry-run with sample call data before you publish.',
    '',
    '> **Next best action:** Stay in **Build**, paste one of the examples above (or your own), and send it.',
  ].join('\n');
}

export function buildAskReply(
  companyName: string,
  automation: GuidanceAutomation,
  catalog: Array<{ id: string; name: string }>,
): string {
  const company = companyName?.trim() || 'your company';
  const catalogNames = new Map(catalog.map((a) => [a.id, a.name]));
  const gaps = analyzeStepGaps(automation, catalogNames);
  const pending = gaps.filter((g) => g.status === 'needs_attention');
  const trigger = automation.steps.find((s) => s.type === 'trigger');

  const lines: string[] = [`### ${company} — your automation`, ''];

  if (automation.name && automation.name !== 'Untitled automation') {
    lines.push(`**Name:** ${automation.name}`);
    lines.push('');
  }

  if (trigger?.actionId) {
    lines.push(`**Starts when:** ${humanTriggerLabel(trigger.actionId)}`);
  } else {
    lines.push('**Starts when:** not configured yet — pick a trigger on the canvas.');
  }

  lines.push('');
  lines.push('**Steps on canvas:**');
  for (const gap of gaps) {
    const mark = gap.status === 'ready' ? '✅' : '⚠️';
    lines.push(`${mark} ${gap.stepNumber}. ${gap.label} — ${gap.summary}`);
  }

  if (pending.length > 0) {
    lines.push('');
    lines.push('### What still needs attention');
    for (const gap of pending) {
      lines.push(`- **Step ${gap.stepNumber}:** ${gap.howToFix}`);
    }
  }

  lines.push('');
  lines.push(
    'Switch to **Build** if you want me to change the canvas. In **Ask**, I can explain triggers, apps, or what **Test** will check.',
  );
  lines.push('');
  lines.push(
    '> **Next best action:** ' +
      (pending[0]
        ? `Fix **Step ${pending[0].stepNumber}** — ${pending[0].summary.toLowerCase()}.`
        : 'Run **Test** to verify, or switch to **Build** and tell me what to add.'),
  );

  return lines.join('\n');
}

export function buildScaffoldIntro(
  companyName: string,
  automation: GuidanceAutomation,
): string {
  const company = companyName?.trim() || 'your company';
  const trigger = automation.steps.find((s) => s.type === 'trigger');
  const actions = automation.steps.filter((s) => s.type === 'action');

  const lines: string[] = [
    `### What I built for ${company}`,
    '',
    `I placed **${automation.steps.length} step(s)** on your canvas${automation.name !== 'Untitled automation' ? ` — **${automation.name}**` : ''}.`,
  ];

  if (trigger?.actionId) {
    lines.push('');
    lines.push(`**Trigger:** ${humanTriggerLabel(trigger.actionId)}`);
  }

  if (actions.length > 0) {
    lines.push('');
    lines.push('**Then:**');
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.label}`);
    });
  }

  lines.push('');
  lines.push(
    'Click any step on the canvas to open **Node Properties** on the right. I added a checklist below for anything still missing.',
  );

  return lines.join('\n');
}

export function mergeBuildReply(
  intro: string,
  automation: GuidanceAutomation,
  catalog: Array<{ id: string; name: string }>,
): string {
  const checklist = buildFinishChecklist(automation, catalog);
  const introTrim = intro.trim();
  if (
    introTrim.includes('### Finish checklist') ||
    introTrim.includes('Finish checklist')
  ) {
    return introTrim;
  }
  return `${introTrim}\n\n${checklist}`;
}

export function formatDryRunChatMessage(
  ok: boolean,
  automationName: string,
  steps: DryRunStepLike[],
): string {
  const errors = steps.filter((s) => s.status === 'error');
  const warns = steps.filter((s) => s.status === 'warn');
  const lines: string[] = [];

  if (ok) {
    lines.push(`### Test passed — **${automationName}**`);
    lines.push('');
    lines.push(
      'Dry-run completed with sample call data. No live webhooks or apps were contacted.',
    );
  } else {
    lines.push(`### Test found issues — **${automationName}**`);
    lines.push('');
    lines.push(
      `**${errors.length}** step(s) need fixes before this automation is ready.${warns.length > 0 ? ` **${warns.length}** warning(s) are worth reviewing.` : ''}`,
    );
  }

  lines.push('');
  lines.push('### Step results');
  for (const step of steps) {
    const icon =
      step.status === 'ok'
        ? '✅'
        : step.status === 'warn'
          ? '⚠️'
          : step.status === 'error'
            ? '❌'
            : '⏭️';
    lines.push(`${icon} **Step ${step.order + 1} — ${step.label}**`);
    lines.push(`- ${step.detail}`);
    if (step.status === 'error') {
      lines.push('- **Fix:** Click this step on the canvas → **Node Properties** → complete the missing field → **Test** again.');
    } else if (step.status === 'warn') {
      lines.push('- **Review:** Open **Node Properties** for this step and fill optional fields if needed.');
    }
    lines.push('');
  }

  lines.push('### How to verify');
  lines.push('');
  if (ok) {
    lines.push('- All steps passed — save this chat (optional) and publish when your team is ready.');
    lines.push('- Re-run **Test** after any edit to confirm nothing broke.');
  } else {
    lines.push('- Fix the ❌ steps first (click them in the test dialog to jump there).');
    lines.push('- Warnings (⚠️) may still pass but often mean empty URLs or conditions.');
    lines.push('- Run **Test** again until every step is ✅.');
  }

  const firstProblem = errors[0] || warns[0];
  lines.push('');
  lines.push(
    '> **Next best action:** ' +
      (firstProblem
        ? `Open **Step ${firstProblem.order + 1}** (${firstProblem.label}) and fix: ${firstProblem.detail}`
        : 'Run **Test** again after your changes.'),
  );

  return lines.join('\n');
}

export function enhanceAskReply(
  bedrockReply: string | undefined,
  companyName: string,
  automation: GuidanceAutomation,
  catalog: Array<{ id: string; name: string }>,
): string {
  const structured = buildAskReply(companyName, automation, catalog);
  const reply = bedrockReply?.trim() || '';
  if (reply.length < 80 || !reply.includes('###')) {
    return structured;
  }
  if (reply.includes('Next best action')) {
    return reply.slice(0, 4000);
  }
  const nextLine = structured.split('\n').find((l) => l.startsWith('> **Next best action:**'));
  return nextLine ? `${reply}\n\n${nextLine}` : reply.slice(0, 4000);
}

function buildLegacyCopilotSystemPrompt(input: {
  companyName: string;
  mode: 'ask' | 'build';
  catalog: Array<{ id: string; name: string; category: string }>;
  triggers: readonly string[];
}): string {
  const company =
    input.companyName && input.companyName.trim()
      ? input.companyName.trim()
      : 'your company';
  const catalogLines = input.catalog
    .slice(0, 80)
    .map((a) => `- ${a.id} (${a.name}) [${a.category}]`)
    .join('\n');
  const triggers = input.triggers.join(', ');
  const isAsk = input.mode === 'ask';

  const replyStructure = [
    'Every reply MUST use this markdown structure (omit empty sections):',
    '1. ### heading — what you did or what the answer means (plain language for ' +
      company +
      ' call-center staff)',
    '2. Short summary paragraph (1–3 sentences)',
    '3. ### Finish checklist — ONLY in BUILD mode when you propose_automation is non-null. For EACH step: ✅/⚠️, status, how to fix in UI (click step → Node Properties → field name), what good looks like',
    '4. ### How to verify — when to click Test, what success looks like, what to fix if dry-run fails',
    '5. > **Next best action:** one bold primary step',
    'Use **Node Properties** (right panel), **Browse triggers/apps**, **Test** (top right), **Save chat** (optional). Never dump raw JSON or internal IDs unless the user asks.',
    'Tone: friendly, non-jargon, action-oriented. ~180–280 words max in reply field.',
  ].join('\n');

  const modeBlock = isAsk
    ? [
        'MODE: ASK — explain the current draft, triggers, apps, and gaps.',
        'NEVER propose canvas changes. propose_automation must ALWAYS be null.',
        'Include: what the flow does, what is configured vs missing, how to fix gaps in the UI, and next best action.',
      ].join(' ')
    : [
        'MODE: BUILD — update the canvas immediately.',
        'Return non-null propose_automation on the first usable description.',
        'Do NOT stall with long questionnaires. Scaffold a best-guess flow; at most ONE short follow-up AFTER proposing.',
        'Prefer building over advising. Never say you cannot connect via webhook/API — use Webhooks step.',
        'Caller-identity pattern: inbound_call.received → webhook lookup by {{from}} → optional Slack/message.',
        'Built-in apps: webhooks, schedule, email, code, api.',
        'Flow nodeTypes in config.nodeType: message, question, condition, webhook, delay, transfer, form, appointment, end, play_audio.',
      ].join(' ');

  return [
    `You are Loop9 Copilot for **${company}** — a personal AI automation builder for non-technical call-center managers.`,
    modeBlock,
    replyStructure,
    'Return ONLY valid JSON:',
    '{"reply":"markdown string","propose_automation":null|{name,steps:[{type,appId,actionId,label,config}]}}',
    'Triggers: appId "loop9", actionId one of: ' + triggers,
    'Catalog actions: appId = slug, actionId usually "send".',
    'Webhook actions: appId "webhooks", actionId "send", config {nodeType:"webhook", method:"POST", webhookUrl:"", notes:"...", bodyTemplate:"..."}.',
    isAsk
      ? 'ASK: propose_automation always null.'
      : 'BUILD: propose_automation almost always set. reply must include finish checklist for every proposed step.',
    'Catalog apps:\n' + catalogLines,
  ].join('\n');
}
