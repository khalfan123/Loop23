#!/usr/bin/env node
/**
 * Generates corporate SEO pages for features, industries, use cases, FAQ, security.
 * Run: node mainsite/scripts/generate-pages.mjs
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
    problem: 'Most phone AI projects stall in engineering queues. Operations knows how calls should sound; builders need a canvas that matches that reality without waiting on custom code.',
    how: 'Loop9 Build gives growing businesses a no-code workspace to design greeting, discovery, booking, escalation, and wrap-up. Attach knowledge, tools, and transfer rules in the same place so agents stay on-brand and on-policy from day one. Templates accelerate common SME workflows while still allowing full control.',
    outcomes: 'Go from blank line to a tested agent faster. Reduce dependency on scarce engineering time. Keep conversation design in the hands of the people who own the customer experience.',
    bullets: ['Visual agent and flow builders with templates', 'Attach knowledge bases, calendars, and tools', 'Configure transfer rules and escalation paths', 'Preview behavior before you go live'],
    faq: [
      { q: 'Do I need developers to build an agent?', a: 'No. Ops and CX teams can configure agents and flows visually. Developers can still extend with APIs and automations when needed.' },
      { q: 'Can we reuse templates?', a: 'Yes. Start from templates for common workflows, then tailor scripts, tools, and transfer rules to your business.' },
    ],
  },
  {
    slug: 'call-transfer',
    title: 'Call Transfer',
    h1: 'Warm call transfer with full context',
    description: 'Transfer live Loop9 calls to a human or another agent with handoff context and configurable caller ID.',
    lead: 'When a conversation needs judgment or empathy, Loop9 hands off cleanly — so your team never starts from zero.',
    problem: 'Dead-end bots frustrate callers. Blind transfers waste agent time. Growing teams need hybrid AI that escalates with dignity.',
    how: 'Configure when to transfer — by intent, confidence, or explicit request. Loop9 warm-hands off to a phone number or teammate with context attached, and keeps caller ID under your control so the handoff still looks like your business.',
    outcomes: 'Higher first-contact satisfaction on complex cases. Lower average handle time for humans who receive only the calls that need them. Clear audit of when and why escalations happen.',
    bullets: ['Warm handoff to phone or teammate', 'Context preserved for the receiving agent', 'Configurable caller ID on transfer', 'Rules for when to escalate automatically'],
    faq: [
      { q: 'Can callers ask for a person?', a: 'Yes. You define the language and rules for human escalation so the agent transfers instead of looping.' },
      { q: 'Does the human see what was said?', a: 'Transfers are designed to carry conversation context so customers do not have to start over.' },
    ],
  },
  {
    slug: 'book-appointments',
    title: 'Book Appointments',
    h1: 'Book appointments during the call',
    description: 'Loop9 AI agents schedule, reschedule, and confirm appointments on the phone — managed in Operations afterward.',
    lead: 'Turn inbound demand into booked time without phone tag. Agents check availability and confirm while the caller is still on the line.',
    problem: 'Missed calls and voicemail kill booking conversion. Small teams cannot staff every ring, especially after hours.',
    how: 'Appointment tools run mid-call: propose slots, confirm details, and log the booking for Operations. Pair with knowledge base answers for prep instructions and transfer rules for clinical or sales exceptions.',
    outcomes: 'More booked appointments per inbound call. Fewer no-shows when confirmations are consistent. Staff focus on delivering the appointment, not chasing the calendar.',
    bullets: ['Schedule and reschedule in natural conversation', 'Confirm details before hanging up', 'Manage bookings in Operations', 'Reduce no-shows with consistent follow-through'],
    faq: [
      { q: 'Can agents reschedule as well as book?', a: 'Yes. Reschedule and confirm flows are part of the appointment toolkit for live calls.' },
      { q: 'Where do bookings show up for staff?', a: 'Your team manages appointments in Operations after the agent completes the live booking.' },
    ],
  },
  {
    slug: 'knowledge-base',
    title: 'Knowledge Base',
    h1: 'Answers grounded in your knowledge base',
    description: 'Ground Loop9 voice agents in your docs and policies with RAG so answers stay accurate without constant prompt rewrites.',
    lead: 'Upload policies, FAQs, and product docs. Agents retrieve what they need mid-call instead of guessing.',
    problem: 'Prompt-only agents drift. Policy changes require rewrites. Callers notice when answers are wrong.',
    how: 'Loop9 Knowledge Base uses retrieval so agents ground responses in your documents. When confidence is low, transfer rules send callers to humans. Post-call analysis surfaces gaps so you improve the corpus continuously.',
    outcomes: 'Fewer hallucinations on hours, pricing, and policy. Faster updates when business rules change. A tighter loop between docs, calls, and QA.',
    bullets: ['RAG retrieval from your documents', 'Fewer hallucinations on policy questions', 'Faster updates when business rules change', 'Pairs with post-call gap analysis'],
    faq: [
      { q: 'What content can we add?', a: 'Policies, FAQs, product docs, and operational guides — the material your front desk already relies on.' },
      { q: 'What if the answer is not in the knowledge base?', a: 'Agents should transfer or clarify rather than invent. Pair knowledge with transfer rules for safety.' },
    ],
  },
  {
    slug: 'navigate-ivr',
    title: 'Navigate IVR',
    h1: 'Build inbound IVR menus that route right',
    description: 'Build multilingual inbound IVR menus that route callers by language and DTMF into the right Loop9 agent or department.',
    lead: 'Design your own phone menus — language selection, departments, and agent handoffs — so callers reach the right path quickly.',
    problem: 'Single inboxes break as companies grow. Callers need language and department paths without endless trees.',
    how: 'Navigate IVR means you own the inbound tree: menus, languages, and routing into AI or human teams. Use structured paths where they help, then conversational AI where resolution happens.',
    outcomes: 'Clearer routing for multi-team SMEs. Better language coverage. Less misdirected volume hitting the wrong queue.',
    bullets: ['Multilingual inbound menus', 'DTMF routing to agents or departments', 'Clear paths for after-hours and emergencies', 'Works alongside conversational AI answering'],
    faq: [
      { q: 'Is this for dialing into other companies’ phone trees?', a: 'No. Loop9 Navigate IVR is for building and running your own inbound menus and department routing.' },
      { q: 'Can IVR hand off to a conversational agent?', a: 'Yes. Menus route into the right agent or department, including AI answering paths.' },
    ],
  },
  {
    slug: 'deploy',
    title: 'Deploy',
    h1: 'Deploy agents on your business numbers',
    description: 'Connect a phone number, publish workflows, and put Loop9 AI agents live for inbound or outbound calling.',
    lead: 'Go from configured agent to answering production calls in an afternoon — without ripping out your number.',
    problem: 'Pilot agents that never reach production waste budget. Ops needs a clear go-live path.',
    how: 'Deploy binds agents to verified numbers and publishes the workflows that should run in production. Whether covering inbound or launching outbound, go-live is an operations step — not a multi-week IT project.',
    outcomes: 'Faster time-to-value. Continuity for customers who keep dialing the same number. Controlled rollout from test to live.',
    bullets: ['Attach numbers to agents', 'Publish automations and flows', 'Inbound and outbound go-live', 'Keep the number customers already know'],
    faq: [
      { q: 'Can we test before going live?', a: 'Yes. Build and preview first, then attach numbers and publish when ready.' },
      { q: 'Does deploy support outbound too?', a: 'Yes. Deploy covers inbound answering and outbound campaign go-live.' },
    ],
  },
  {
    slug: 'batch-call',
    title: 'Batch Call',
    h1: 'Batch calling campaigns at scale',
    description: 'Run Loop9 bulk outbound campaigns — upload contacts, schedule dials, and track outcomes at scale.',
    lead: 'Reach lists with consistent scripts and measurable outcomes — reminders, lead follow-up, and outreach that would overwhelm a small team.',
    problem: 'Manual outbound does not scale for SMEs. Inconsistent scripts and unknown caller ID kill answer rates.',
    how: 'Upload contacts, schedule windows, and run agents across the list with business caller ID. Track outcomes after each campaign and feed insights into QA.',
    outcomes: 'Reliable outreach volume without temporary headcount. Consistent messaging. Measurable conversion after each run.',
    bullets: ['Upload contact lists and schedule dials', 'Consistent agent behavior across the campaign', 'Outcome tracking after each run', 'Scale without adding headcount'],
    faq: [
      { q: 'What campaigns work well?', a: 'Reminders, renewals, lead follow-up, and status outreach where a consistent script matters.' },
      { q: 'Can we use our business number?', a: 'Yes. Pair batch calling with verified numbers and business caller ID.' },
    ],
  },
  {
    slug: 'branded-call-id',
    title: 'Branded Call ID',
    h1: 'Call as your business number',
    description: 'Place and transfer Loop9 calls from your business numbers with controlled caller ID customers already trust.',
    lead: 'Outbound and transfers should look like your company — not a random unknown number.',
    problem: 'Unknown caller ID destroys answer rates and trust on outbound and transfer.',
    how: 'Branded Call ID in Loop9 means controlled caller ID from the business numbers you own and verify. Use those DIDs for outbound campaigns and for transfers that should still look professional.',
    outcomes: 'Higher answer rates. Stronger brand presence. Cleaner handoffs that still read as your company.',
    bullets: ['Outbound from your business DIDs', 'Controlled caller ID on transfers', 'Align numbers with brand presence', 'Pair with verified phone numbers'],
    faq: [
      { q: 'Is this carrier CNAM branded calling?', a: 'Loop9 focuses on calling and transferring from your verified business numbers with controlled caller ID — not a separate carrier name-display product.' },
      { q: 'Does this help transfers?', a: 'Yes. Configurable caller ID on transfer keeps the handoff professional.' },
    ],
  },
  {
    slug: 'verified-phone-numbers',
    title: 'Verified Phone Numbers',
    h1: 'Verified phone numbers for your agents',
    description: 'Buy, port, or bring SIP trunks — local and toll-free DIDs attached directly to Loop9 AI voice agents.',
    lead: 'Provision numbers your customers recognize, then bind them to the agents that should answer.',
    problem: 'Telephony setup often blocks AI projects. Teams need numbers without ripping out existing lines.',
    how: 'Search and buy local or toll-free numbers, port existing lines, or connect SIP. Attach DIDs directly to agents so Deploy is a binding step, not a separate telephony project.',
    outcomes: 'Faster provisioning. Continuity for known customer numbers. Flexible telephony for multi-location SMEs.',
    bullets: ['Buy local or toll-free numbers', 'Port existing business lines', 'SIP trunk options', 'Attach numbers directly to agents'],
    faq: [
      { q: 'Can we keep our current number?', a: 'Yes — port or forward, then attach it to your Loop9 agent.' },
      { q: 'Do you support SIP?', a: 'Yes. Bring trunks and connect familiar VoIP setups.' },
    ],
  },
  {
    slug: 'monitor',
    title: 'Monitor',
    h1: 'Monitor live calls and floor health',
    description: 'Monitor Loop9 live calls with real-time floors, analytics, and per-call detail for operations teams.',
    lead: 'See active conversations, queue health, and performance — then jump into any call that needs attention.',
    problem: 'Blind AI deployments scare operators. Managers need a live floor, not a black box.',
    how: 'Monitor is the operator console: live floor visibility plus analytics. Pair with post-call analysis and QA for a full Build → Deploy → Monitor loop.',
    outcomes: 'Real-time control during spikes. Faster intervention on bad calls. Leadership visibility into phone operations.',
    bullets: ['Live floor and active call views', 'Analytics for volume and outcomes', 'Per-call detail when you need it', 'Built for ops supervisors, not just engineers'],
    faq: [
      { q: 'Who is Monitor for?', a: 'Operations supervisors and team leads who run the phone line day to day.' },
      { q: 'Does Monitor replace QA?', a: 'No. Monitor is live visibility; post-call analysis and AI QA cover after-the-fact improvement.' },
    ],
  },
  {
    slug: 'post-call-analysis',
    title: 'Post Call Analysis',
    h1: 'Post-call analysis on every conversation',
    description: 'Analyze Loop9 call transcripts, outcomes, and knowledge gaps after every conversation to improve the next one.',
    lead: 'Stop sampling a handful of recordings. Understand what callers ask for across the full book of calls.',
    problem: 'Without analysis, agents never improve. Spot checks miss systemic issues.',
    how: 'After each call, Loop9 captures transcripts, outcomes, and knowledge-gap signals. Ops and product use that signal to update docs, flows, and transfer rules.',
    outcomes: 'Continuous improvement instead of static scripts. Clearer product insights from real caller language. Better coaching inputs for supervisors.',
    bullets: ['Transcripts and outcomes after each call', 'Knowledge gap detection', 'Actionable insight for ops and product', 'Feeds continuous agent improvement'],
    faq: [
      { q: 'Is every call analyzed?', a: 'Post-call analysis is designed to cover conversations at scale so you are not limited to manual samples.' },
      { q: 'How does this relate to AI QA?', a: 'Analysis surfaces what happened; AI QA scores quality and compliance for coaching and risk.' },
    ],
  },
  {
    slug: 'ai-quality-assurance',
    title: 'AI Quality Assurance',
    h1: 'AI quality assurance on 100% of calls',
    description: 'Score Loop9 calls for quality, compliance, and resolution across every conversation — not a manual sample.',
    lead: 'Supervisors catch coaching moments and compliance risks without listening to the entire day.',
    problem: 'Manual QA does not scale for SMEs. Random samples miss patterns.',
    how: 'AI Quality Assurance scores quality, compliance, and resolution across volume. Trends help leadership see whether agents are improving after knowledge and flow updates.',
    outcomes: 'Enterprise-grade oversight without an enterprise QA staff. Faster coaching cycles. Earlier detection of risky conversations.',
    bullets: ['Score every call, not a sample', 'Quality, compliance, and resolution signals', 'Trends for supervisors and leadership', 'Faster coaching cycles'],
    faq: [
      { q: 'Does AI QA replace human supervisors?', a: 'No. It prioritizes what supervisors should review and coach.' },
      { q: 'What gets scored?', a: 'Quality, compliance, and resolution signals tailored to how your agents are expected to perform.' },
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
    tagline: 'Your always-on clinic front desk',
    popular: ['Appointment Booking', 'After Hours', 'Support', 'Department Routing'],
    metrics: [
      { value: '24/7', label: 'Coverage on nights and weekends' },
      { value: 'Warm transfer', label: 'Urgent cases reach clinicians with context' },
      { value: 'Full QA', label: 'Score every patient conversation' },
    ],
    problem: 'Clinic phones mix routine booking with time-sensitive requests. Missed calls become no-shows and frustrated patients.',
    how: 'Use appointment booking for scheduling, knowledge base for hours and prep, IVR for language and department paths, and warm transfer for urgent cases. After-hours coverage keeps the line professional overnight.',
    outcomes: 'Fewer abandoned calls. More booked visits. Clinical staff protected from routine phone load.',
    bullets: ['Appointment booking and rescheduling', 'After-hours coverage', 'Warm transfer for urgent cases', 'Knowledge-grounded patient FAQs'],
    features: ['book-appointments', 'call-transfer', 'knowledge-base', 'navigate-ivr', 'ai-quality-assurance'],
    useCases: ['appointment-booking', 'after-hours', 'department-routing'],
  },
  {
    slug: 'financial-services',
    title: 'Financial Services',
    h1: 'AI voice agents for financial services',
    description: 'Loop9 helps financial services teams qualify callers, answer policy questions, transfer securely, and monitor call quality.',
    lead: 'High-trust industries need accurate answers and clean escalations. Loop9 keeps routine volume off your advisors’ desks.',
    tagline: 'Your always-on client intake desk',
    popular: ['Lead Qualification', 'Support', 'Quality Coaching'],
    metrics: [
      { value: 'Qualified intake', label: 'Route ready clients to advisors' },
      { value: 'Grounded answers', label: 'Policy FAQs from your knowledge base' },
      { value: 'Full QA', label: 'Oversight across every conversation' },
    ],
    problem: 'Advisors lose hours to intake and FAQs. Inaccurate answers create risk.',
    how: 'Ground agents in approved knowledge, qualify and route callers, transfer with context, and score conversations with AI QA. Business caller ID keeps outbound professional.',
    outcomes: 'Better use of advisor time. Consistent policy answers. Full-volume QA visibility.',
    bullets: ['Qualified intake and routing', 'Knowledge-grounded policy answers', 'Controlled business caller ID', 'QA across every call'],
    features: ['knowledge-base', 'call-transfer', 'branded-call-id', 'monitor', 'ai-quality-assurance'],
    useCases: ['lead-qualification', 'customer-support', 'quality-coaching'],
  },
  {
    slug: 'insurance',
    title: 'Insurance',
    h1: 'AI voice agents for insurance teams',
    description: 'Loop9 supports insurance inbound for FNOL intake, policy FAQs, appointment setting, and warm transfer to adjusters.',
    lead: 'Reduce hold times on high-volume insurance lines while keeping complex claims in human hands.',
    tagline: 'Your always-on claims intake partner',
    popular: ['Support', 'Appointment Booking', 'Outbound Campaigns'],
    metrics: [
      { value: 'Faster intake', label: 'Capture FNOL-style details before transfer' },
      { value: 'Fewer holds', label: 'Routine coverage questions answered live' },
      { value: 'Callback ready', label: 'Book adjuster follow-ups on the call' },
    ],
    problem: 'Insurance volume spikes with claims and renewals. Hold times damage trust.',
    how: 'Capture intake, answer coverage FAQs from knowledge, book callbacks, and transfer adjusters with context. Post-call analysis reveals recurring friction.',
    outcomes: 'Shorter waits on routine calls. Cleaner intake for humans. Continuous script improvement.',
    bullets: ['FNOL-style intake handoffs', 'Policy and coverage FAQs', 'Appointment and callback booking', 'Full-call QA and analysis'],
    features: ['call-transfer', 'book-appointments', 'knowledge-base', 'post-call-analysis', 'batch-call'],
    useCases: ['customer-support', 'appointment-booking', 'outbound-campaigns'],
  },
  {
    slug: 'logistics',
    title: 'Logistics',
    h1: 'AI voice agents for logistics and delivery',
    description: 'Loop9 helps logistics teams handle tracking FAQs, dispatch follow-ups, after-hours calls, and outbound status campaigns.',
    lead: 'Keep drivers and customers informed without drowning dispatch in routine phone traffic.',
    tagline: 'Your always-on dispatch line',
    popular: ['Support', 'After Hours', 'Outbound Campaigns'],
    metrics: [
      { value: 'Status deflection', label: 'Routine tracking answered without dispatch' },
      { value: 'Exception routing', label: 'Warm transfer when something breaks' },
      { value: 'Proactive outbound', label: 'Batch updates before inbound spikes' },
    ],
    problem: 'Status calls swamp dispatch during delays. After-hours gaps create escalations the next morning.',
    how: 'Deflect status FAQs with knowledge, escalate exceptions via transfer, cover nights, and use batch calling for proactive updates.',
    outcomes: 'Dispatch focuses on exceptions. Customers get faster status answers. Proactive outbound reduces inbound spikes.',
    bullets: ['Status and hours FAQs', 'Dispatch escalation transfers', 'After-hours coverage', 'Outbound batch updates'],
    features: ['knowledge-base', 'call-transfer', 'batch-call', 'monitor', 'deploy'],
    useCases: ['customer-support', 'after-hours', 'outbound-campaigns'],
  },
  {
    slug: 'home-services',
    title: 'Home Services',
    h1: 'AI voice agents for home services',
    description: 'Loop9 books jobs, captures addresses, answers service FAQs, and covers after hours for home services businesses.',
    lead: 'When crews are in the field, Loop9 keeps the phone line booking and qualifying — not going to voicemail.',
    tagline: 'Your always-on booking desk',
    popular: ['Inbound Sales', 'Appointment Booking', 'After Hours'],
    metrics: [
      { value: 'Speed-to-lead', label: 'Answer every job inquiry on first ring' },
      { value: 'More bookings', label: 'Schedule while the caller is still on the line' },
      { value: 'After-hours capture', label: 'Nights and weekends still convert' },
    ],
    problem: 'Speed-to-lead decides who wins the job. Missed calls go to competitors.',
    how: 'Answer instantly, book jobs, capture details, transfer complex estimates, and follow up with outbound reminders on business numbers.',
    outcomes: 'More booked jobs from the same inbound volume. After-hours capture. Field teams uninterrupted.',
    bullets: ['Job booking from the first call', 'After-hours lead capture', 'Field-friendly warm transfers', 'Outbound reminders and follow-ups'],
    features: ['book-appointments', 'batch-call', 'verified-phone-numbers', 'branded-call-id', 'call-transfer'],
    useCases: ['inbound-sales', 'appointment-booking', 'after-hours'],
  },
  {
    slug: 'retail-consumer',
    title: 'Retail & Consumer',
    h1: 'AI voice agents for retail and consumer brands',
    description: 'Loop9 handles retail order FAQs, store hours, appointment booking, and peak-season call volume for consumer brands.',
    lead: 'Scale customer phone support through peaks without scaling headcount at the same rate.',
    tagline: 'Your always-on brand support line',
    popular: ['Support', 'Department Routing', 'Quality Coaching'],
    metrics: [
      { value: 'Peak ready', label: 'Absorb seasonal volume without panic hiring' },
      { value: 'Brand tone', label: 'QA keeps conversations on-brand' },
      { value: 'Smart routing', label: 'VIP and complex cases reach people' },
    ],
    problem: 'Seasonal spikes overwhelm small support teams. Brand tone drifts under pressure.',
    how: 'Cover FAQs with knowledge, route VIP cases, book pickups or appointments, monitor live volume, and keep QA on brand.',
    outcomes: 'Stable CX through peaks. Lower cost per routine call. Consistent brand voice.',
    bullets: ['Hours and order FAQs', 'Peak volume coverage', 'Appointment and pickup booking', 'Live monitoring and QA'],
    features: ['knowledge-base', 'book-appointments', 'monitor', 'navigate-ivr', 'ai-quality-assurance'],
    useCases: ['customer-support', 'department-routing', 'quality-coaching'],
  },
  {
    slug: 'travel-hospitality',
    title: 'Travel & Hospitality',
    h1: 'AI voice agents for travel and hospitality',
    description: 'Loop9 helps hotels and travel teams take reservations, answer stay FAQs, route VIP callers, and cover nights and weekends.',
    lead: 'Guests call at all hours. Loop9 keeps reservation and FAQ volume covered while staff focus on in-person service.',
    tagline: 'Your always-on guest concierge',
    popular: ['Appointment Booking', 'After Hours', 'Department Routing'],
    metrics: [
      { value: 'More reservations', label: 'Capture booking intent around the clock' },
      { value: 'Night coverage', label: 'Same quality after the front desk closes' },
      { value: 'VIP path', label: 'Managers get high-stakes callers with context' },
    ],
    problem: 'Night desks are expensive; missed reservation calls are worse.',
    how: 'Book and modify reservations, answer amenity FAQs, route VIP callers, and cover nights with the same agent quality.',
    outcomes: 'More captured reservations. Better guest experience after hours. Staff freed for on-property service.',
    bullets: ['Reservation booking and changes', 'Stay and amenity FAQs', 'VIP and manager transfers', 'Night and weekend coverage'],
    features: ['book-appointments', 'navigate-ivr', 'call-transfer', 'knowledge-base', 'monitor'],
    useCases: ['appointment-booking', 'after-hours', 'department-routing'],
  },
  {
    slug: 'debt-collection',
    title: 'Debt Collection',
    h1: 'AI voice agents for debt collection outreach',
    description: 'Loop9 supports compliant, consistent outbound collection conversations with batch calling, controlled caller ID, and full QA.',
    lead: 'Run high-volume outreach with consistent scripts, business caller ID, and quality scoring on every contact attempt.',
    tagline: 'Your always-on outreach engine',
    popular: ['Outbound Campaigns', 'Quality Coaching', 'Lead Qualification'],
    metrics: [
      { value: 'Batch scale', label: 'Reach lists without temporary headcount' },
      { value: 'Business CID', label: 'Call from numbers customers recognize' },
      { value: '100% QA', label: 'Score every attempt for consistency' },
    ],
    problem: 'Collection outreach needs scale and control. Inconsistent scripts create risk.',
    how: 'Batch dial lists with business caller ID, keep conversations consistent, escalate sensitive cases, and score every attempt with AI QA.',
    outcomes: 'Higher contact capacity. Consistent messaging. Supervisors see risk patterns early.',
    bullets: ['Batch outbound campaigns', 'Business caller ID presence', 'Consistent scripted conversations', 'QA and post-call review'],
    features: ['batch-call', 'branded-call-id', 'ai-quality-assurance', 'post-call-analysis', 'call-transfer'],
    useCases: ['outbound-campaigns', 'quality-coaching', 'lead-qualification'],
  },
];

const USE_CASES = [
  {
    slug: 'inbound-sales',
    title: 'Inbound Sales',
    h1: 'Never miss an inbound sales call',
    description: 'Loop9 qualifies inbound sales leads, books demos, and routes hot buyers to your team instantly.',
    lead: 'Speed-to-lead wins deals. Loop9 answers in one ring, qualifies, and books — or transfers when a rep should take over.',
    problem: 'Inbound sales lines lose revenue to voicemail and slow callbacks.',
    how: 'Build a qualification flow, enable appointment booking for demos, and warm-transfer closers when intent is high. Monitor live and review objections in post-call analysis.',
    outcomes: 'More conversations captured. More demos booked. Reps spend time closing, not chasing.',
    bullets: ['Instant answer and qualification', 'Demo and meeting booking', 'Warm transfer to closers', 'Post-call insight on objections'],
    features: ['book-appointments', 'call-transfer', 'build', 'post-call-analysis'],
  },
  {
    slug: 'customer-support',
    title: 'Customer Support',
    h1: 'Deflect routine support calls',
    description: 'Loop9 resolves routine support questions with knowledge base answers and escalates complex issues with context.',
    lead: 'Keep specialists free for hard cases. Loop9 handles hours, status, and how-to questions automatically.',
    problem: 'Support volume is mostly repetitive, but escalations still need humans.',
    how: 'Ground agents in knowledge, escalate with transfer rules, watch spikes in Monitor, and score resolution with AI QA.',
    outcomes: 'Lower cost per routine contact. Faster answers. Cleaner escalations.',
    bullets: ['Knowledge-grounded FAQs', 'Smart escalation', 'Live monitoring for spikes', 'QA on resolution quality'],
    features: ['knowledge-base', 'call-transfer', 'monitor', 'ai-quality-assurance'],
  },
  {
    slug: 'appointment-booking',
    title: 'Appointment Booking',
    h1: 'Book more appointments by phone',
    description: 'Loop9 books, reschedules, and confirms appointments during live calls for clinics, services, and sales teams.',
    lead: 'Convert callers into calendar holds before they hang up.',
    problem: 'Phone booking still converts — but only if someone answers.',
    how: 'Deploy booking agents on your number, confirm details live, manage in Operations, and optionally remind with batch outbound.',
    outcomes: 'Higher booking conversion. Fewer missed opportunities after hours. Cleaner calendars.',
    bullets: ['Natural-language scheduling', 'Confirmations before hang-up', 'Ops visibility afterward', 'Reminder-friendly outbound'],
    features: ['book-appointments', 'batch-call', 'deploy', 'monitor'],
  },
  {
    slug: 'after-hours',
    title: 'After Hours',
    h1: 'Own nights, weekends, and holidays',
    description: 'Loop9 covers after-hours phone lines — triage urgent calls, capture leads, and book what can wait until morning.',
    lead: 'Your competitors sleep. Your phone line does not have to.',
    problem: 'After-hours is where SMEs lose unpaid opportunity.',
    how: 'Deploy 24/7 answering with triage rules, booking where possible, and transfers for true emergencies. Morning teams get summaries via post-call analysis.',
    outcomes: 'Leads captured overnight. Urgent calls triaged. Day staff starts with a full picture.',
    bullets: ['24/7 answering', 'Urgent vs routine triage', 'Lead and booking capture', 'Morning-ready summaries'],
    features: ['deploy', 'call-transfer', 'book-appointments', 'post-call-analysis'],
  },
  {
    slug: 'lead-qualification',
    title: 'Lead Qualification',
    h1: 'Qualify leads before they hit your team',
    description: 'Loop9 qualifies inbound and outbound leads with consistent discovery questions and routes only sales-ready callers.',
    lead: 'Protect rep time. Let AI gather fit, intent, and urgency first.',
    problem: 'Qualification scripts drift when humans are rushed.',
    how: 'Build consistent discovery, batch-follow outbound lists, transfer hot leads, and score conversation quality.',
    outcomes: 'Higher-quality pipeline. Less wasted rep time. Measurable discovery compliance.',
    bullets: ['Consistent discovery questions', 'Route hot leads instantly', 'Batch outbound follow-up', 'Score conversation quality'],
    features: ['build', 'batch-call', 'call-transfer', 'ai-quality-assurance'],
  },
  {
    slug: 'outbound-campaigns',
    title: 'Outbound Campaigns',
    h1: 'Run outbound voice campaigns at scale',
    description: 'Loop9 batch calling powers reminders, renewals, and outreach with business caller ID and outcome tracking.',
    lead: 'Reach more contacts with the same playbook — and see what converted.',
    problem: 'Outbound succeeds only with consistency and recognizable presence.',
    how: 'Upload lists, schedule dials, call from verified business numbers, track outcomes, and QA every attempt.',
    outcomes: 'Predictable outreach capacity. Better answer rates. Clear campaign ROI.',
    bullets: ['List upload and scheduling', 'Business caller ID', 'Outcome tracking', 'QA on every attempt'],
    features: ['batch-call', 'branded-call-id', 'verified-phone-numbers', 'ai-quality-assurance'],
  },
  {
    slug: 'department-routing',
    title: 'Department Routing',
    h1: 'Route callers to the right department',
    description: 'Loop9 inbound IVR and AI routing send callers to the correct department, language, or specialist without phone-tree frustration.',
    lead: 'Replace endless menus with clear paths — language, department, then AI or human.',
    problem: 'Growing companies outgrow a single inbox.',
    how: 'Design multilingual menus, route into AI or human teams, transfer with context, and monitor path performance.',
    outcomes: 'Less misdirected volume. Faster time-to-right-person. Clearer org phone design.',
    bullets: ['Multilingual menus', 'Department and agent routing', 'AI answering on each path', 'Transfer with context'],
    features: ['navigate-ivr', 'call-transfer', 'build', 'monitor'],
  },
  {
    slug: 'quality-coaching',
    title: 'Quality Coaching',
    h1: 'Coach from 100% of call volume',
    description: 'Loop9 AI QA and post-call analysis help supervisors coach from full-call coverage instead of random samples.',
    lead: 'Find coaching moments and compliance risks across every conversation.',
    problem: 'Manual QA does not scale for SMEs.',
    how: 'Score every call, surface compliance issues, trend quality, and feed knowledge gaps back into the knowledge base.',
    outcomes: 'Faster coaching cycles. Fewer missed risks. Continuous agent improvement.',
    bullets: ['Score every call', 'Surface compliance issues', 'Trend quality over time', 'Tie gaps back to knowledge'],
    features: ['ai-quality-assurance', 'post-call-analysis', 'monitor', 'knowledge-base'],
  },
];

function featureBySlug(slug) {
  return FEATURES.find((f) => f.slug === slug);
}
function useCaseBySlug(slug) {
  return USE_CASES.find((u) => u.slug === slug);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function navHtml() {
  return `<header class="lg-topbar">
  <div class="lg-topbar-inner">
    <a href="/" class="lg-brand">Loop9</a>
    <nav class="lg-navlinks" aria-label="Primary">
      <a href="/features/" class="lg-navlink">Features</a>
      <a href="/industries/" class="lg-navlink">Industries</a>
      <a href="/use-cases/" class="lg-navlink">Use cases</a>
      <a href="/security/" class="lg-navlink">Security</a>
      <a href="/faq/" class="lg-navlink">FAQ</a>
    </nav>
    <div class="lg-nav-actions">
      <a href="https://app.loop9.ai/login" class="lg-btn-ghost">Sign in</a>
      <a href="mailto:sales@loop9.ai" class="lg-btn-ghost">Contact sales</a>
      <a href="https://app.loop9.ai/register" class="lg-btn-primary">Start free trial</a>
    </div>
  </div>
</header>`;
}

function footerHtml() {
  return `<footer class="lg-footer">
  <div class="lg-footer-inner">
    <div class="lg-footer-col">
      <strong style="font-size:18px;">Loop9</strong>
      <span>AI voice agents for growing businesses</span>
      <a href="https://app.loop9.ai/login">Sign in</a>
      <a href="https://app.loop9.ai/register">Start free trial</a>
      <a href="mailto:sales@loop9.ai">Contact sales</a>
    </div>
    <div class="lg-footer-col">
      <strong>Product</strong>
      <a href="/features/">Features</a>
      <a href="/industries/">Industries</a>
      <a href="/use-cases/">Use cases</a>
      <a href="/security/">Security</a>
    </div>
    <div class="lg-footer-col">
      <strong>Resources</strong>
      <a href="/faq/">FAQ</a>
      <a href="/features/build/">Build</a>
      <a href="/features/monitor/">Monitor</a>
      <a href="/features/ai-quality-assurance/">AI QA</a>
    </div>
    <div class="lg-footer-col">
      <strong>Legal</strong>
      <a href="https://app.loop9.ai/privacy">Privacy</a>
      <a href="https://app.loop9.ai/terms">Terms</a>
    </div>
  </div>
  <div class="lg-footer-bottom">&copy; ${new Date().getFullYear()} Loop9. All rights reserved.</div>
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
<link href="https://fonts.googleapis.com/css2?family=Fustat:wght@400;600;700;800&family=Inter:wght@400;500;600;650&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<div class="lg-wrap">
  ${navHtml()}
  <main class="lg-section lg-prose">
    ${crumbs}
    ${main}
  </main>
  <section class="lg-section" style="padding-top:0;">
    <div class="lg-final">
      <span class="lg-eyebrow">Get started</span>
      <h2 class="lg-h2">Put an AI front desk on your business number</h2>
      <p class="lg-lead">Answer, book, transfer, and improve — built for growing operations teams.</p>
      <div class="lg-final-actions">
        <a href="https://app.loop9.ai/register" class="lg-btn-primary">Start free trial</a>
        <a href="mailto:sales@loop9.ai" class="lg-btn-ghost">Contact sales</a>
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

function detailMain({
  eyebrow,
  h1,
  lead,
  problem,
  how,
  outcomes,
  bullets,
  faq,
  relatedTitle,
  relatedLinks,
}) {
  const lis = bullets.map((b) => `<li>${esc(b)}</li>`).join('\n      ');
  const chips = relatedLinks
    .map((l) => `<a class="lg-chip" href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  const faqBlock =
    faq && faq.length
      ? `<div class="lg-mini-faq">
      <h2 class="lg-h2">Questions</h2>
      <div class="lg-faq">
        ${faq
          .map(
            (item) => `<details>
          <summary>${esc(item.q)}</summary>
          <p>${esc(item.a)}</p>
        </details>`
          )
          .join('\n        ')}
      </div>
    </div>`
      : '';

  return `<span class="lg-eyebrow">${esc(eyebrow)}</span>
    <h1 class="lg-h1">${esc(h1)}</h1>
    <p class="lg-lead">${esc(lead)}</p>
    <div class="lg-btn-row">
      <a href="https://app.loop9.ai/register" class="lg-btn-primary">Start free trial</a>
      <a href="mailto:sales@loop9.ai" class="lg-btn-ghost">Contact sales</a>
    </div>
    <h2 class="lg-h2">The problem</h2>
    <p class="lg-body">${esc(problem)}</p>
    <h2 class="lg-h2">How Loop9 works</h2>
    <p class="lg-body">${esc(how)}</p>
    <h2 class="lg-h2">Outcomes for your team</h2>
    <p class="lg-body">${esc(outcomes)}</p>
    <ul class="lg-bullets">
      ${lis}
    </ul>
    ${faqBlock}
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

function hubCards(items, base, tag) {
  return `<div class="lg-card-grid">
    ${items
      .map(
        (it) => `<a class="lg-card" href="${base}${it.slug}/">
      <span class="lg-tag">${esc(tag)}</span>
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.lead.slice(0, 150))}${it.lead.length > 150 ? '…' : ''}</p>
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
  writePage(
    `features/${f.slug}`,
    pageShell({
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
        problem: f.problem,
        how: f.how,
        outcomes: f.outcomes,
        bullets: f.bullets,
        faq: f.faq,
        relatedTitle: 'Related capabilities',
        relatedLinks: related,
      }),
    })
  );
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
    ${hubCards(FEATURES, '/features/', 'Feature')}`,
  })
);

function industryMain(ind, relatedLinks) {
  const popular = (ind.popular || [])
    .map((p) => `<span>${esc(p)}</span>`)
    .join('\n        ');
  const metrics = (ind.metrics || [])
    .map(
      (m) => `<div class="lg-metric"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></div>`
    )
    .join('\n      ');
  const lis = ind.bullets.map((b) => `<li>${esc(b)}</li>`).join('\n      ');
  const chips = relatedLinks
    .map((l) => `<a class="lg-chip" href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n      ');
  const photo = `/images/industries/${ind.slug}.jpg`;

  return `<div class="lg-industry-hero">
      <img src="${esc(photo)}" alt="${esc(ind.title)} operations" width="1600" height="900" loading="eager">
      <div class="lg-industry-shade" aria-hidden="true"></div>
      <div class="lg-industry-hero-inner">
        <span class="lg-eyebrow">Industry · ${esc(ind.title)}</span>
        <h1 class="lg-h1">${esc(ind.h1)}</h1>
        <p class="lg-lead">${esc(ind.lead)}</p>
        <p style="margin:14px 0 0;font-size:14px;font-weight:650;color:#9ec9ff;">${esc(ind.tagline || '')}</p>
        <div class="lg-popular" aria-label="Popular use cases">
        ${popular}
        </div>
        <div class="lg-btn-row">
          <a href="https://app.loop9.ai/register" class="lg-btn-primary">Start free trial</a>
          <a href="mailto:sales@loop9.ai" class="lg-btn-ghost">Contact sales</a>
        </div>
      </div>
    </div>
    <div class="lg-metrics">${metrics}</div>
    <h2 class="lg-h2">The problem</h2>
    <p class="lg-body">${esc(ind.problem)}</p>
    <h2 class="lg-h2">How Loop9 works</h2>
    <p class="lg-body">${esc(ind.how)}</p>
    <h2 class="lg-h2">Outcomes for your team</h2>
    <p class="lg-body">${esc(ind.outcomes)}</p>
    <ul class="lg-bullets">
      ${lis}
    </ul>
    <div class="lg-related">
      <h2 class="lg-h2" style="font-size:28px;max-width:none;">Capabilities &amp; use cases</h2>
      <div class="lg-related-links">
      ${chips}
      </div>
    </div>`;
}

function industryHubCards() {
  return `<div class="lg-industry-grid">
    ${INDUSTRIES.map(
      (ind) => `<a class="lg-industry-card" href="/industries/${ind.slug}/">
      <img src="/images/industries/${ind.slug}.jpg" alt="" width="800" height="600" loading="lazy">
      <div class="lg-industry-shade" aria-hidden="true"></div>
      <div class="lg-industry-body">
        <h3>${esc(ind.title)}</h3>
        <p>${esc(ind.tagline || ind.lead.slice(0, 90))}</p>
        <span class="lg-industry-link">Explore industry →</span>
      </div>
    </a>`
    ).join('\n    ')}
  </div>`;
}

// Industry pages
for (const ind of INDUSTRIES) {
  const relatedFeats = (ind.features || [])
    .map((slug) => featureBySlug(slug))
    .filter(Boolean)
    .map((f) => ({ href: `/features/${f.slug}/`, label: f.title }));
  const relatedUc = (ind.useCases || [])
    .map((slug) => useCaseBySlug(slug))
    .filter(Boolean)
    .map((u) => ({ href: `/use-cases/${u.slug}/`, label: u.title }));
  writePage(
    `industries/${ind.slug}`,
    pageShell({
      title: `${ind.title} AI Voice Agents | Loop9`,
      description: ind.description,
      canonical: `${SITE}/industries/${ind.slug}/`,
      crumbs: crumbsHtml([
        { href: '/', label: 'Home' },
        { href: '/industries/', label: 'Industries' },
        { href: `/industries/${ind.slug}/`, label: ind.title },
      ]),
      main: industryMain(ind, [...relatedFeats, ...relatedUc]),
    })
  );
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
    <h1 class="lg-h1">ROI on every customer moment</h1>
    <p class="lg-lead">Corporate-ready voice AI for the industries that live on the phone — with dedicated pages, outcomes, and workflows for each vertical.</p>
    ${industryHubCards()}`,
  })
);




// Use cases
for (const uc of USE_CASES) {
  const relatedFeats = (uc.features || [])
    .map((slug) => featureBySlug(slug))
    .filter(Boolean)
    .map((f) => ({ href: `/features/${f.slug}/`, label: f.title }));
  const relatedUc = USE_CASES.filter((x) => x.slug !== uc.slug)
    .slice(0, 4)
    .map((x) => ({ href: `/use-cases/${x.slug}/`, label: x.title }));
  writePage(
    `use-cases/${uc.slug}`,
    pageShell({
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
        problem: uc.problem,
        how: uc.how,
        outcomes: uc.outcomes,
        bullets: uc.bullets,
        faq: [],
        relatedTitle: 'Related features & use cases',
        relatedLinks: [...relatedFeats, ...relatedUc],
      }),
    })
  );
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
    ${hubCards(USE_CASES, '/use-cases/', 'Use case')}`,
  })
);

// FAQ page
const FAQ_ITEMS = [
  {
    q: 'What is an AI voice agent?',
    a: 'An AI voice agent listens and speaks on phone calls like a trained receptionist. It understands intent, keeps context across turns, and can take actions such as booking appointments or transferring to a human.',
  },
  {
    q: 'How does Loop9 work?',
    a: 'You build an agent, attach knowledge and tools, deploy it on a verified number, monitor live calls, then improve with post-call analysis and AI quality assurance.',
  },
  {
    q: 'Can we keep our existing phone number?',
    a: 'Yes. Buy, port, or forward numbers — or connect via SIP — then attach them to Loop9 agents so customers still dial the line they know.',
  },
  {
    q: 'What happens when a caller needs a person?',
    a: 'Configure warm call transfer rules. Loop9 hands off to your team with context so customers do not repeat themselves.',
  },
  {
    q: 'How is Loop9 different from a traditional IVR?',
    a: 'IVR forces touch-tone menus. Loop9 holds natural conversations, resolves routine requests, and routes the rest — with optional inbound menus when you still want structured paths.',
  },
  {
    q: 'Can Loop9 book appointments on the call?',
    a: 'Yes. Agents can schedule and confirm during the conversation; your team manages bookings afterward in Operations.',
  },
  {
    q: 'Do you support outbound / batch calling?',
    a: 'Yes. Run batch campaigns for reminders, follow-ups, and outreach with business caller ID and outcome tracking.',
  },
  {
    q: 'How do you measure quality?',
    a: 'Post-call analysis and AI quality assurance cover transcripts, outcomes, and scores across volume — so supervisors are not limited to random samples.',
  },
  {
    q: 'Is Loop9 multilingual?',
    a: 'Yes. Support callers in their preferred language with multilingual agents and inbound IVR routing where needed.',
  },
  {
    q: 'What integrations are available?',
    a: 'Loop9 connects with telephony and business tools such as Twilio, HubSpot, Salesforce, n8n, Zapier, Cal.com, Slack, and more via native connectors and automations.',
  },
  {
    q: 'Who is Loop9 for?',
    a: 'Growing businesses and mid-market operations teams — clinics, home services, sales floors, support desks, hospitality, logistics, and other high-call industries.',
  },
  {
    q: 'How do we get started?',
    a: 'Start a free trial at app.loop9.ai, or contact sales@loop9.ai for a corporate rollout conversation.',
  },
];

writePage(
  'faq',
  pageShell({
    title: 'FAQ | Loop9 AI Voice Agents',
    description:
      'Frequently asked questions about Loop9 AI voice agents — numbers, transfers, appointments, QA, multilingual support, and more.',
    canonical: `${SITE}/faq/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/faq/', label: 'FAQ' },
    ]),
    main: `<span class="lg-eyebrow">FAQ</span>
    <h1 class="lg-h1">Questions from operations teams</h1>
    <p class="lg-lead">Straight answers for teams evaluating voice AI for the business phone line.</p>
    <div class="lg-faq" style="margin-top:32px;">
      ${FAQ_ITEMS.map(
        (item) => `<details>
        <summary>${esc(item.q)}</summary>
        <p>${esc(item.a)}</p>
      </details>`
      ).join('\n      ')}
    </div>`,
  })
);

// Security page — accurate, no fake certs
writePage(
  'security',
  pageShell({
    title: 'Security & Controls | Loop9',
    description:
      'How Loop9 helps operations teams control access, review transcripts, escalate safely, and monitor quality across voice AI calls.',
    canonical: `${SITE}/security/`,
    crumbs: crumbsHtml([
      { href: '/', label: 'Home' },
      { href: '/security/', label: 'Security' },
    ]),
    main: `<span class="lg-eyebrow">Security &amp; controls</span>
    <h1 class="lg-h1">Controls for teams handling real customer conversations</h1>
    <p class="lg-lead">Loop9 is built for operators who need visibility and safe escalation — without black-box AI on the phone line.</p>
    <h2 class="lg-h2">Access control</h2>
    <p class="lg-body">Use role-based access so the right people can build agents, deploy numbers, monitor live calls, and review quality. Keep production changes intentional.</p>
    <h2 class="lg-h2">Conversation visibility</h2>
    <p class="lg-body">Transcripts and call detail support coaching, dispute resolution, and continuous improvement. Supervisors can see what happened — not guess from summaries alone.</p>
    <h2 class="lg-h2">Hybrid human handoff</h2>
    <p class="lg-body">When judgment or empathy is required, warm transfer rules escalate to your team with context. AI handles volume; people handle exceptions.</p>
    <h2 class="lg-h2">Quality oversight</h2>
    <p class="lg-body">AI quality assurance and post-call analysis help you score and review conversations across volume, so risk patterns surface earlier than random sampling allows.</p>
    <h2 class="lg-h2">Practical privacy posture</h2>
    <p class="lg-body">Treat call recordings and transcripts as sensitive operational data. Limit access with roles, review retention practices with your team, and use transfer/escalation paths for sensitive topics your agents should not handle alone.</p>
    <p class="lg-body">We do not publish unverified certification claims on this page. For enterprise security questionnaires, contact <a href="mailto:sales@loop9.ai" style="color:var(--lg-accent);font-weight:600;">sales@loop9.ai</a>.</p>
    <ul class="lg-bullets">
      <li>Role-based workspace access</li>
      <li>Transcripts for review and coaching</li>
      <li>Warm transfer with context</li>
      <li>Full-volume QA signals</li>
    </ul>`,
  })
);

// sitemap + robots
const urls = ['/', '/features/', '/industries/', '/use-cases/', '/faq/', '/security/'];
for (const f of FEATURES) urls.push(`/features/${f.slug}/`);
for (const i of INDUSTRIES) urls.push(`/industries/${i.slug}/`);
for (const u of USE_CASES) urls.push(`/use-cases/${u.slug}/`);

fs.writeFileSync(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
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
`
);
fs.writeFileSync(
  path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
);
console.log('wrote sitemap.xml and robots.txt');
console.log(`Generated ${urls.length} URLs`);
