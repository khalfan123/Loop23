#!/usr/bin/env node
/**
 * Generates SEO pages for features, industries, and use cases.
 * Run from repo: node mainsite/scripts/generate-pages.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SITE = 'https://mainsite-production-2385.up.railway.app';

const FEATURES = [
  {
    slug: 'build',
    title: 'Build',
    h1: 'Build AI voice agents without code',
    description: 'Design Loop9 AI voice agents and visual call flows — scripts, conditions, tools, and templates — without engineering.',
    lead: 'Create production-ready phone agents your operations team can own. Visual builders for agents and flows mean you ship coverage in hours, not sprints.',
    body: [
      'Loop9 Build gives growing businesses a no-code workspace to design how every call should feel: greeting, discovery, booking, escalation, and wrap-up.',
      'Attach knowledge, tools, and transfer rules in the same canvas so agents stay on-brand and on-policy from day one.',
    ],
    bullets: [
      'Visual agent and flow builders with templates',
      'Attach knowledge bases, calendars, and tools',
      'Configure transfer rules and escalation paths',
      'Preview behavior before you go live',
    ],
  },
  {
    slug: 'call-transfer',
    title: 'Call Transfer',
    h1: 'Warm call transfer with full context',
    description: 'Transfer live Loop9 calls to a human or another agent with handoff context and configurable caller ID.',
    lead: 'When a conversation needs judgment or empathy, Loop9 hands off cleanly — so your team never starts from zero.',
    body: [
      'Call Transfer is built for hybrid operations: AI handles volume; people handle exceptions.',
      'Transfers carry context so customers do not repeat themselves, and caller ID stays under your control.',
    ],
    bullets: [
      'Warm handoff to phone or teammate',
      'Context preserved for the receiving agent',
      'Configurable caller ID on transfer',
      'Rules for when to escalate automatically',
    ],
  },
  {
    slug: 'book-appointments',
    title: 'Book Appointments',
    h1: 'Book appointments during the call',
    description: 'Loop9 AI agents schedule, reschedule, and confirm appointments on the phone — managed in Operations afterward.',
    lead: 'Turn inbound demand into booked time without phone tag. Agents check availability and confirm while the caller is still on the line.',
    body: [
      'Appointment booking is one of the highest-ROI phone workflows for SMEs — clinics, home services, sales demos, and site visits.',
      'Loop9 books during the conversation and keeps your ops team in control of the calendar afterward.',
    ],
    bullets: [
      'Schedule and reschedule in natural conversation',
      'Confirm details before hanging up',
      'Manage bookings in Operations',
      'Reduce no-shows with consistent follow-through',
    ],
  },
  {
    slug: 'knowledge-base',
    title: 'Knowledge Base',
    h1: 'Answers grounded in your knowledge base',
    description: 'Ground Loop9 voice agents in your docs and policies with RAG so answers stay accurate without constant prompt rewrites.',
    lead: 'Upload policies, FAQs, and product docs. Agents retrieve what they need mid-call instead of guessing.',
    body: [
      'A knowledge base keeps voice agents honest: accurate hours, pricing rules, and procedures — with a clear path to transfer when confidence is low.',
      'As your docs change, agents improve without rebuilding the entire script.',
    ],
    bullets: [
      'RAG retrieval from your documents',
      'Fewer hallucinations on policy questions',
      'Faster updates when business rules change',
      'Pairs with post-call gap analysis',
    ],
  },
  {
    slug: 'navigate-ivr',
    title: 'Navigate IVR',
    h1: 'Build inbound IVR menus that route right',
    description: 'Build multilingual inbound IVR menus that route callers by language and DTMF into the right Loop9 agent or department.',
    lead: 'Design your own phone menus — language selection, departments, and agent handoffs — so callers reach the right path quickly.',
    body: [
      'Navigate IVR in Loop9 means you own the inbound tree: menus, languages, and routing into AI or human teams.',
      'It is built for your line — not for dialing through someone else’s phone system.',
    ],
    bullets: [
      'Multilingual inbound menus',
      'DTMF routing to agents or departments',
      'Clear paths for after-hours and emergencies',
      'Works alongside conversational AI answering',
    ],
  },
  {
    slug: 'deploy',
    title: 'Deploy',
    h1: 'Deploy agents on your business numbers',
    description: 'Connect a phone number, publish workflows, and put Loop9 AI agents live for inbound or outbound calling.',
    lead: 'Go from configured agent to answering production calls in an afternoon — without ripping out your number.',
    body: [
      'Deploy binds agents to verified numbers and publishes the workflows that should run in production.',
      'Whether you are covering inbound or launching outbound, go-live is an operations step — not a multi-week IT project.',
    ],
    bullets: [
      'Attach numbers to agents',
      'Publish automations and flows',
      'Inbound and outbound go-live',
      'Keep the number customers already know',
    ],
  },
  {
    slug: 'batch-call',
    title: 'Batch Call',
    h1: 'Batch calling campaigns at scale',
    description: 'Run Loop9 bulk outbound campaigns — upload contacts, schedule dials, and track outcomes at scale.',
    lead: 'Reach lists with consistent scripts and measurable outcomes — reminders, lead follow-up, and outreach that would overwhelm a small team.',
    body: [
      'Batch Call is for operators who need reliable outbound volume without hiring a temporary floor.',
      'Upload contacts, schedule windows, and review conversion after each campaign.',
    ],
    bullets: [
      'Upload contact lists and schedule dials',
      'Consistent agent behavior across the campaign',
      'Outcome tracking after each run',
      'Scale without adding headcount',
    ],
  },
  {
    slug: 'branded-call-id',
    title: 'Branded Call ID',
    h1: 'Call as your business number',
    description: 'Place and transfer Loop9 calls from your business numbers with controlled caller ID customers already trust.',
    lead: 'Outbound and transfers should look like your company — not a random unknown number.',
    body: [
      'Branded Call ID in Loop9 means controlled caller ID from the business numbers you own and verify.',
      'That trust matters for answer rates on outbound and for professional handoffs on transfer.',
    ],
    bullets: [
      'Outbound from your business DIDs',
      'Controlled caller ID on transfers',
      'Align numbers with brand presence',
      'Pair with verified phone numbers',
    ],
  },
  {
    slug: 'verified-phone-numbers',
    title: 'Verified Phone Numbers',
    h1: 'Verified phone numbers for your agents',
    description: 'Buy, port, or bring SIP trunks — local and toll-free DIDs attached directly to Loop9 AI voice agents.',
    lead: 'Provision numbers your customers recognize, then bind them to the agents that should answer.',
    body: [
      'Verified Phone Numbers cover search, purchase, porting, and SIP — so SMEs can keep continuity while modernizing the front desk.',
      'Local and toll-free options help you show up professionally in every market you serve.',
    ],
    bullets: [
      'Buy local or toll-free numbers',
      'Port existing business lines',
      'SIP trunk options',
      'Attach numbers directly to agents',
    ],
  },
  {
    slug: 'monitor',
    title: 'Monitor',
    h1: 'Monitor live calls and floor health',
    description: 'Monitor Loop9 live calls with real-time floors, analytics, and per-call detail for operations teams.',
    lead: 'See active conversations, queue health, and performance — then jump into any call that needs attention.',
    body: [
      'Monitor is the operator console: live floor visibility plus analytics so managers run the phone line like a department.',
      'Pair with post-call analysis and QA for a full Build → Deploy → Monitor loop.',
    ],
    bullets: [
      'Live floor and active call views',
      'Analytics for volume and outcomes',
      'Per-call detail when you need it',
      'Built for ops supervisors, not just engineers',
    ],
  },
  {
    slug: 'post-call-analysis',
    title: 'Post Call Analysis',
    h1: 'Post-call analysis on every conversation',
    description: 'Analyze Loop9 call transcripts, outcomes, and knowledge gaps after every conversation to improve the next one.',
    lead: 'Stop sampling a handful of recordings. Understand what callers ask for across the full book of calls.',
    body: [
      'Post Call Analysis turns every conversation into operational signal: outcomes, friction points, and knowledge gaps.',
      'Use it to improve agents, docs, and transfer rules continuously.',
    ],
    bullets: [
      'Transcripts and outcomes after each call',
      'Knowledge gap detection',
      'Actionable insight for ops and product',
      'Feeds continuous agent improvement',
    ],
  },
  {
    slug: 'ai-quality-assurance',
    title: 'AI Quality Assurance',
    h1: 'AI quality assurance on 100% of calls',
    description: 'Score Loop9 calls for quality, compliance, and resolution across every conversation — not a manual sample.',
    lead: 'Supervisors catch coaching moments and compliance risks without listening to the entire day.',
    body: [
      'AI Quality Assurance scores quality, compliance, and resolution so growing teams get enterprise-grade oversight without an enterprise QA staff.',
      'Combined with post-call analysis, it closes the loop from live ops to continuous improvement.',
    ],
    bullets: [
      'Score every call, not a sample',
      'Quality, compliance, and resolution signals',
      'Trends for supervisors and leadership',
      'Faster coaching cycles',
    ],
  },
];

const INDUSTRIES = [
  {
    slug: 'healthcare',
    title: 'Healthcare',
    h1: 'AI voice agents for healthcare practices',
    description: 'Loop9 helps clinics and healthcare teams answer calls, book appointments, route urgent cases, and cover after hours.',
    lead: 'Patients expect a live answer. Loop9 covers scheduling, FAQs, and triage handoffs so clinical staff stay focused on care.',
    body: [
      'Healthcare phone lines mix routine booking with time-sensitive requests. Loop9 handles volume and transfers what needs a person.',
      'Use knowledge bases for hours and prep instructions, appointments for scheduling, and QA to keep conversations compliant.',
    ],
    bullets: ['Appointment booking and rescheduling', 'After-hours coverage', 'Warm transfer for urgent cases', 'Knowledge-grounded patient FAQs'],
    features: ['book-appointments', 'call-transfer', 'knowledge-base', 'navigate-ivr', 'ai-quality-assurance'],
  },
  {
    slug: 'financial-services',
    title: 'Financial Services',
    h1: 'AI voice agents for financial services',
    description: 'Loop9 helps financial services teams qualify callers, answer policy questions, transfer securely, and monitor call quality.',
    lead: 'High-trust industries need accurate answers and clean escalations. Loop9 keeps routine volume off your advisors’ desks.',
    body: [
      'From intake to transfer, Loop9 supports professional inbound and outbound with controlled caller ID and full QA coverage.',
      'Ground agents in approved knowledge so product and policy answers stay consistent.',
    ],
    bullets: ['Qualified intake and routing', 'Knowledge-grounded policy answers', 'Controlled business caller ID', 'QA across every call'],
    features: ['knowledge-base', 'call-transfer', 'branded-call-id', 'monitor', 'ai-quality-assurance'],
  },
  {
    slug: 'insurance',
    title: 'Insurance',
    h1: 'AI voice agents for insurance teams',
    description: 'Loop9 supports insurance inbound for FNOL intake, policy FAQs, appointment setting, and warm transfer to adjusters.',
    lead: 'Reduce hold times on high-volume insurance lines while keeping complex claims in human hands.',
    body: [
      'Insurance callers need speed and clarity. Loop9 answers routine questions, captures intake, and transfers with context.',
      'Post-call analysis surfaces recurring questions so you strengthen scripts and knowledge continuously.',
    ],
    bullets: ['FNOL-style intake handoffs', 'Policy and coverage FAQs', 'Appointment and callback booking', 'Full-call QA and analysis'],
    features: ['call-transfer', 'book-appointments', 'knowledge-base', 'post-call-analysis', 'batch-call'],
  },
  {
    slug: 'logistics',
    title: 'Logistics',
    h1: 'AI voice agents for logistics and delivery',
    description: 'Loop9 helps logistics teams handle tracking FAQs, dispatch follow-ups, after-hours calls, and outbound status campaigns.',
    lead: 'Keep drivers and customers informed without drowning dispatch in routine phone traffic.',
    body: [
      'Logistics phone volume spikes with delays and status checks. Loop9 deflects routine asks and escalates exceptions.',
      'Batch calling supports proactive outreach when routes change.',
    ],
    bullets: ['Status and hours FAQs', 'Dispatch escalation transfers', 'After-hours coverage', 'Outbound batch updates'],
    features: ['knowledge-base', 'call-transfer', 'batch-call', 'monitor', 'deploy'],
  },
  {
    slug: 'home-services',
    title: 'Home Services',
    h1: 'AI voice agents for home services',
    description: 'Loop9 books jobs, captures addresses, answers service FAQs, and covers after hours for home services businesses.',
    lead: 'When crews are in the field, Loop9 keeps the phone line booking and qualifying — not going to voicemail.',
    body: [
      'Home services win on speed-to-lead. Loop9 answers instantly, books appointments, and transfers complex estimates when needed.',
      'Verified numbers and business caller ID keep outreach recognizable to homeowners.',
    ],
    bullets: ['Job booking from the first call', 'After-hours lead capture', 'Field-friendly warm transfers', 'Outbound reminders and follow-ups'],
    features: ['book-appointments', 'batch-call', 'verified-phone-numbers', 'branded-call-id', 'call-transfer'],
  },
  {
    slug: 'retail-consumer',
    title: 'Retail & Consumer',
    h1: 'AI voice agents for retail and consumer brands',
    description: 'Loop9 handles retail order FAQs, store hours, appointment booking, and peak-season call volume for consumer brands.',
    lead: 'Scale customer phone support through peaks without scaling headcount at the same rate.',
    body: [
      'Retail lines spike around launches and seasons. Loop9 covers FAQs and routes VIP or complex cases to humans.',
      'Monitor live volume and use QA to keep brand tone consistent.',
    ],
    bullets: ['Hours and order FAQs', 'Peak volume coverage', 'Appointment and pickup booking', 'Live monitoring and QA'],
    features: ['knowledge-base', 'book-appointments', 'monitor', 'navigate-ivr', 'ai-quality-assurance'],
  },
  {
    slug: 'travel-hospitality',
    title: 'Travel & Hospitality',
    h1: 'AI voice agents for travel and hospitality',
    description: 'Loop9 helps hotels and travel teams take reservations, answer stay FAQs, route VIP callers, and cover nights and weekends.',
    lead: 'Guests call at all hours. Loop9 keeps reservation and FAQ volume covered while staff focus on in-person service.',
    body: [
      'Hospitality phone lines mix booking, modifications, and guest requests. Loop9 books and answers, then transfers when hospitality judgment matters.',
      'Multilingual inbound menus help route guests to the right path quickly.',
    ],
    bullets: ['Reservation booking and changes', 'Stay and amenity FAQs', 'VIP and manager transfers', 'Night and weekend coverage'],
    features: ['book-appointments', 'navigate-ivr', 'call-transfer', 'knowledge-base', 'monitor'],
  },
  {
    slug: 'debt-collection',
    title: 'Debt Collection',
    h1: 'AI voice agents for debt collection outreach',
    description: 'Loop9 supports compliant, consistent outbound collection conversations with batch calling, controlled caller ID, and full QA.',
    lead: 'Run high-volume outreach with consistent scripts, business caller ID, and quality scoring on every contact attempt.',
    body: [
      'Collection operations need scale and control. Loop9 batch calling reaches lists while QA and analysis keep conversations within policy.',
      'Transfer paths let agents escalate sensitive cases to specialists.',
    ],
    bullets: ['Batch outbound campaigns', 'Business caller ID presence', 'Consistent scripted conversations', 'QA and post-call review'],
    features: ['batch-call', 'branded-call-id', 'ai-quality-assurance', 'post-call-analysis', 'call-transfer'],
  },
];

const USE_CASES = [
  {
    slug: 'inbound-sales',
    title: 'Inbound Sales',
    h1: 'Never miss an inbound sales call',
    description: 'Loop9 qualifies inbound sales leads, books demos, and routes hot buyers to your team instantly.',
    lead: 'Speed-to-lead wins deals. Loop9 answers in one ring, qualifies, and books — or transfers when a rep should take over.',
    body: ['Inbound sales lines lose revenue to voicemail and slow callbacks. Loop9 covers the front door 24/7.'],
    bullets: ['Instant answer and qualification', 'Demo and meeting booking', 'Warm transfer to closers', 'Post-call insight on objections'],
    features: ['book-appointments', 'call-transfer', 'build', 'post-call-analysis'],
  },
  {
    slug: 'customer-support',
    title: 'Customer Support',
    h1: 'Deflect routine support calls',
    description: 'Loop9 resolves routine support questions with knowledge base answers and escalates complex issues with context.',
    lead: 'Keep specialists free for hard cases. Loop9 handles hours, status, and how-to questions automatically.',
    body: ['Support volume is mostly repetitive. Loop9 deflects it with grounded answers and clean escalations.'],
    bullets: ['Knowledge-grounded FAQs', 'Smart escalation', 'Live monitoring for spikes', 'QA on resolution quality'],
    features: ['knowledge-base', 'call-transfer', 'monitor', 'ai-quality-assurance'],
  },
  {
    slug: 'appointment-booking',
    title: 'Appointment Booking',
    h1: 'Book more appointments by phone',
    description: 'Loop9 books, reschedules, and confirms appointments during live calls for clinics, services, and sales teams.',
    lead: 'Convert callers into calendar holds before they hang up.',
    body: ['Phone booking still converts for high-intent callers. Loop9 makes it consistent every hour of the day.'],
    bullets: ['Natural-language scheduling', 'Confirmations before hang-up', 'Ops visibility afterward', 'Reminder-friendly outbound'],
    features: ['book-appointments', 'batch-call', 'deploy', 'monitor'],
  },
  {
    slug: 'after-hours',
    title: 'After Hours',
    h1: 'Own nights, weekends, and holidays',
    description: 'Loop9 covers after-hours phone lines — triage urgent calls, capture leads, and book what can wait until morning.',
    lead: 'Your competitors sleep. Your phone line does not have to.',
    body: ['After-hours is where SMEs lose the most unpaid opportunity. Loop9 keeps the line professional overnight.'],
    bullets: ['24/7 answering', 'Urgent vs routine triage', 'Lead and booking capture', 'Morning-ready summaries'],
    features: ['deploy', 'call-transfer', 'book-appointments', 'post-call-analysis'],
  },
  {
    slug: 'lead-qualification',
    title: 'Lead Qualification',
    h1: 'Qualify leads before they hit your team',
    description: 'Loop9 qualifies inbound and outbound leads with consistent discovery questions and routes only sales-ready callers.',
    lead: 'Protect rep time. Let AI gather fit, intent, and urgency first.',
    body: ['Qualification scripts drift when humans are rushed. Loop9 keeps discovery consistent and measurable.'],
    bullets: ['Consistent discovery questions', 'Route hot leads instantly', 'Batch outbound follow-up', 'Score conversation quality'],
    features: ['build', 'batch-call', 'call-transfer', 'ai-quality-assurance'],
  },
  {
    slug: 'outbound-campaigns',
    title: 'Outbound Campaigns',
    h1: 'Run outbound voice campaigns at scale',
    description: 'Loop9 batch calling powers reminders, renewals, and outreach with business caller ID and outcome tracking.',
    lead: 'Reach more contacts with the same playbook — and see what converted.',
    body: ['Outbound succeeds with consistency and presence. Loop9 combines batch dialing with branded business numbers.'],
    bullets: ['List upload and scheduling', 'Business caller ID', 'Outcome tracking', 'QA on every attempt'],
    features: ['batch-call', 'branded-call-id', 'verified-phone-numbers', 'ai-quality-assurance'],
  },
  {
    slug: 'department-routing',
    title: 'Department Routing',
    h1: 'Route callers to the right department',
    description: 'Loop9 inbound IVR and AI routing send callers to the correct department, language, or specialist without phone-tree frustration.',
    lead: 'Replace endless menus with clear paths — language, department, then AI or human.',
    body: ['Growing companies outgrow a single inbox. Loop9 routes by intent and menu so teams stay focused.'],
    bullets: ['Multilingual menus', 'Department and agent routing', 'AI answering on each path', 'Transfer with context'],
    features: ['navigate-ivr', 'call-transfer', 'build', 'monitor'],
  },
  {
    slug: 'quality-coaching',
    title: 'Quality Coaching',
    h1: 'Coach from 100% of call volume',
    description: 'Loop9 AI QA and post-call analysis help supervisors coach from full-call coverage instead of random samples.',
    lead: 'Find coaching moments and compliance risks across every conversation.',
    body: ['Manual QA does not scale for SMEs. Loop9 scores and analyzes the full book so coaching is continuous.'],
    bullets: ['Score every call', 'Surface compliance issues', 'Trend quality over time', 'Tie gaps back to knowledge'],
    features: ['ai-quality-assurance', 'post-call-analysis', 'monitor', 'knowledge-base'],
  },
];

function featureBySlug(slug) {
  return FEATURES.find((f) => f.slug === slug);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function navHtml() {
  return `<nav class="lg-nav" aria-label="Primary">
    <a href="/" class="lg-brand">Loop9</a>
    <div class="lg-navlinks">
      <a href="/features/" class="lg-navlink">Features</a>
      <a href="/industries/" class="lg-navlink">Industries</a>
      <a href="/use-cases/" class="lg-navlink">Use cases</a>
    </div>
    <div class="lg-nav-actions">
      <a href="https://app.loop9.ai/login" class="lg-btn-ghost">Sign in</a>
      <a href="https://app.loop9.ai/register" class="lg-btn-primary" style="padding:10px 16px;border-radius:12px;gap:8px;font-size:14px;">Get started</a>
    </div>
  </nav>`;
}

function footerHtml() {
  const featLinks = FEATURES.slice(0, 6)
    .map((f) => `<a href="/features/${f.slug}/">${esc(f.title)}</a>`)
    .join('\n        ');
  const indLinks = INDUSTRIES.slice(0, 6)
    .map((i) => `<a href="/industries/${i.slug}/">${esc(i.title)}</a>`)
    .join('\n        ');
  return `<footer class="lg-footer">
    <div class="lg-footer-col">
      <strong style="font-size:18px;">Loop9</strong>
      <span>AI voice agents for growing businesses</span>
      <a href="https://app.loop9.ai/login">Sign in</a>
      <a href="https://app.loop9.ai/register">Get started</a>
    </div>
    <div class="lg-footer-col">
      <strong>Features</strong>
      ${featLinks}
      <a href="/features/">All features</a>
    </div>
    <div class="lg-footer-col">
      <strong>Industries</strong>
      ${indLinks}
      <a href="/industries/">All industries</a>
    </div>
    <div class="lg-footer-col">
      <strong>Company</strong>
      <a href="/use-cases/">Use cases</a>
      <a href="https://app.loop9.ai/privacy">Privacy</a>
      <a href="https://app.loop9.ai/terms">Terms</a>
    </div>
  </footer>`;
}

function pageShell({ title, description, canonical, crumbs, main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fustat:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<div class="lg-wrap">
  <div class="lg-glow-a" aria-hidden="true"></div>
  <div class="lg-glow-b" aria-hidden="true"></div>
  ${navHtml()}
  <main class="lg-section">
    ${crumbs}
    ${main}
  </main>
  <section class="lg-section" style="padding-top:0;">
    <div class="lg-final">
      <span class="lg-eyebrow">Get started</span>
      <h2 class="lg-h2">Put an AI front desk on your business number</h2>
      <p class="lg-lead">Answer, book, transfer, and improve — built for growing teams.</p>
      <div class="lg-final-actions">
        <a href="https://app.loop9.ai/register" class="lg-btn-primary">
          Start free trial
          <span class="lg-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0084FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
        </a>
        <a href="https://app.loop9.ai/login" class="lg-btn-ghost">Sign in</a>
      </div>
    </div>
  </section>
  ${footerHtml()}
</div>
</body>
</html>
`;
}

function crumbsHtml(items) {
  return `<p class="lg-crumbs">${items
    .map((it, i) =>
      i === items.length - 1
        ? `<span>${esc(it.label)}</span>`
        : `<a href="${esc(it.href)}">${esc(it.label)}</a> <span aria-hidden="true">/</span> `
    )
    .join('')}</p>`;
}

function detailMain({ eyebrow, h1, lead, body, bullets, relatedTitle, relatedLinks }) {
  const paras = body.map((p) => `<p class="lg-body">${esc(p)}</p>`).join('\n    ');
  const lis = bullets.map((b) => `<li>${esc(b)}</li>`).join('\n      ');
  const chips = relatedLinks
    .map((l) => `<a class="lg-chip" href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  return `<span class="lg-eyebrow">${esc(eyebrow)}</span>
    <h1 class="lg-h1">${esc(h1)}</h1>
    <p class="lg-lead">${esc(lead)}</p>
    <div class="lg-btn-row">
      <a href="https://app.loop9.ai/register" class="lg-btn-primary">
        Start free trial
        <span class="lg-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0084FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
      </a>
      <a href="/features/" class="lg-btn-ghost">Browse features</a>
    </div>
    <div style="margin-top:36px;">
    ${paras}
    </div>
    <ul class="lg-bullets">
      ${lis}
    </ul>
    <div class="lg-related">
      <h2 class="lg-h2" style="font-size:28px;max-width:none;">${esc(relatedTitle)}</h2>
      <div class="lg-related-links">
      ${chips}
      </div>
    </div>`;
}

function writePage(relDir, html) {
  const dir = path.join(root, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('wrote', path.join(relDir, 'index.html'));
}

function hubCards(items, base) {
  return `<div class="lg-card-grid">
    ${items
      .map(
        (it) => `<a class="lg-card" href="${base}${it.slug}/">
      <span class="lg-tag">${esc(base.includes('industr') ? 'Industry' : base.includes('use') ? 'Use case' : 'Feature')}</span>
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.lead.slice(0, 140))}${it.lead.length > 140 ? '…' : ''}</p>
    </a>`
      )
      .join('\n    ')}
  </div>`;
}

// Feature pages
for (const f of FEATURES) {
  const related = FEATURES.filter((x) => x.slug !== f.slug)
    .slice(0, 6)
    .map((x) => ({ href: `/features/${x.slug}/`, label: x.title }));
  const html = pageShell({
    title: `${f.title} | Loop9 AI Voice Agents`,
    description: f.description,
    canonical: `${SITE}/features/${f.slug}/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/features/', label: 'Features' },
      { href: `/features/${f.slug}/`, label: f.title },
    ]),
    main: detailMain({
      eyebrow: 'Feature',
      h1: f.h1,
      lead: f.lead,
      body: f.body,
      bullets: f.bullets,
      relatedTitle: 'Related capabilities',
      relatedLinks: related,
    }),
  });
  writePage(`features/${f.slug}`, html);
}

writePage(
  'features',
  pageShell({
    title: 'Features | Loop9 AI Voice Agents',
    description:
      'Explore Loop9 features: Build, Call Transfer, Book Appointments, Knowledge Base, Navigate IVR, Deploy, Batch Call, Branded Call ID, Verified Phone Numbers, Monitor, Post Call Analysis, and AI Quality Assurance.',
    canonical: `${SITE}/features/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/features/', label: 'Features' },
    ]),
    main: `<span class="lg-eyebrow">Features</span>
    <h1 class="lg-h1">Everything your phone operation needs</h1>
    <p class="lg-lead">From Build to AI Quality Assurance — dedicated pages for every capability growing businesses run daily.</p>
    ${hubCards(FEATURES, '/features/')}`,
  })
);

// Industry pages
for (const ind of INDUSTRIES) {
  const relatedFeats = (ind.features || [])
    .map((slug) => featureBySlug(slug))
    .filter(Boolean)
    .map((f) => ({ href: `/features/${f.slug}/`, label: f.title }));
  const relatedInd = INDUSTRIES.filter((x) => x.slug !== ind.slug)
    .slice(0, 4)
    .map((x) => ({ href: `/industries/${x.slug}/`, label: x.title }));
  const html = pageShell({
    title: `${ind.title} AI Voice Agents | Loop9`,
    description: ind.description,
    canonical: `${SITE}/industries/${ind.slug}/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/industries/', label: 'Industries' },
      { href: `/industries/${ind.slug}/`, label: ind.title },
    ]),
    main: detailMain({
      eyebrow: 'Industry',
      h1: ind.h1,
      lead: ind.lead,
      body: ind.body,
      bullets: ind.bullets,
      relatedTitle: 'Capabilities for this industry',
      relatedLinks: [...relatedFeats, ...relatedInd],
    }),
  });
  writePage(`industries/${ind.slug}`, html);
}

writePage(
  'industries',
  pageShell({
    title: 'Industries | Loop9 AI Voice Agents',
    description:
      'Loop9 AI voice agents for Healthcare, Financial Services, Insurance, Logistics, Home Services, Retail & Consumer, Travel & Hospitality, and Debt Collection.',
    canonical: `${SITE}/industries/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/industries/', label: 'Industries' },
    ]),
    main: `<span class="lg-eyebrow">Industries</span>
    <h1 class="lg-h1">Built for the lines that run your business</h1>
    <p class="lg-lead">Corporate-ready voice AI for SME and mid-market teams across high-call industries.</p>
    ${hubCards(INDUSTRIES, '/industries/')}`,
  })
);

// Use case pages
for (const uc of USE_CASES) {
  const relatedFeats = (uc.features || [])
    .map((slug) => featureBySlug(slug))
    .filter(Boolean)
    .map((f) => ({ href: `/features/${f.slug}/`, label: f.title }));
  const relatedUc = USE_CASES.filter((x) => x.slug !== uc.slug)
    .slice(0, 4)
    .map((x) => ({ href: `/use-cases/${x.slug}/`, label: x.title }));
  const html = pageShell({
    title: `${uc.title} | Loop9 Use Cases`,
    description: uc.description,
    canonical: `${SITE}/use-cases/${uc.slug}/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/use-cases/', label: 'Use cases' },
      { href: `/use-cases/${uc.slug}/`, label: uc.title },
    ]),
    main: detailMain({
      eyebrow: 'Use case',
      h1: uc.h1,
      lead: uc.lead,
      body: uc.body,
      bullets: uc.bullets,
      relatedTitle: 'Related features & use cases',
      relatedLinks: [...relatedFeats, ...relatedUc],
    }),
  });
  writePage(`use-cases/${uc.slug}`, html);
}

writePage(
  'use-cases',
  pageShell({
    title: 'Use Cases | Loop9 AI Voice Agents',
    description:
      'Loop9 use cases: inbound sales, customer support, appointment booking, after hours, lead qualification, outbound campaigns, department routing, and quality coaching.',
    canonical: `${SITE}/use-cases/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/use-cases/', label: 'Use cases' },
    ]),
    main: `<span class="lg-eyebrow">Use cases</span>
    <h1 class="lg-h1">Practical phone workflows for growing teams</h1>
    <p class="lg-lead">See how Loop9 runs the phone line for sales, support, booking, after hours, and more.</p>
    ${hubCards(USE_CASES, '/use-cases/')}`,
  })
);

// sitemap + robots
const urls = ['/', '/features/', '/industries/', '/use-cases/'];
for (const f of FEATURES) urls.push(`/features/${f.slug}/`);
for (const i of INDUSTRIES) urls.push(`/industries/${i.slug}/`);
for (const u of USE_CASES) urls.push(`/use-cases/${u.slug}/`);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u}</loc>
    <changefreq>weekly</changefreq>
  </url>`
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
fs.writeFileSync(
  path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
);
console.log('wrote sitemap.xml and robots.txt');
console.log(`Generated ${urls.length} URLs`);
