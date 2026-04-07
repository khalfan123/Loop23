export interface CallScenario {
  id: string;
  category: 'customer_support' | 'appointment_booking' | 'lead_qualification';
  name: string;
  description: string;
  systemPrompt: string;
  conversationTurns: ConversationTurn[];
  expectedTools?: string[];
  expectedOutcome: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ConversationTurn {
  role: 'user';
  content: string;
  expectedIntent?: string;
}

const CUSTOMER_SUPPORT_SCENARIOS: CallScenario[] = [
  {
    id: 'cs-001',
    category: 'customer_support',
    name: 'Simple Order Status Inquiry',
    description: 'Customer asks about their order status',
    systemPrompt: `You are a customer support agent for an e-commerce company.
WORKFLOW: When a customer asks about an order, immediately call lookup_order with their order number to retrieve status and tracking details. Share the specific delivery date (April 9, 2026), tracking number, and current location of the package.
TONE: Friendly and reassuring. If the order is on track, let them know with confidence. If delayed, acknowledge the inconvenience and provide a concrete ETA.`,
    conversationTurns: [
      { role: 'user', content: 'Hi, I placed an order last week and I want to know where it is.', expectedIntent: 'order_status' },
      { role: 'user', content: 'My order number is 12345.', expectedIntent: 'provide_order_id' },
      { role: 'user', content: 'When will it arrive?', expectedIntent: 'delivery_eta' },
    ],
    expectedTools: ['lookup_order'],
    expectedOutcome: 'Agent retrieves order status and provides delivery estimate',
    difficulty: 'easy',
  },
  {
    id: 'cs-002',
    category: 'customer_support',
    name: 'Product Return Request',
    description: 'Customer wants to return a defective product',
    systemPrompt: `You are a customer support agent handling returns.
WORKFLOW: Step 1 - When the customer mentions a return, call check_return_policy with the order number and item details to verify eligibility. Step 2 - Once confirmed eligible, call initiate_return to generate a return label and process the refund.
DETAILS TO SHARE: Return window (30 days), refund timeline (3-5 business days after receipt), and confirm return label will be emailed.
TONE: Apologetic about the defective product. Reassure them the return process is simple.`,
    conversationTurns: [
      { role: 'user', content: 'I received a broken laptop charger and I want to return it.', expectedIntent: 'return_request' },
      { role: 'user', content: 'I bought it 5 days ago. Order number 67890.', expectedIntent: 'provide_details' },
      { role: 'user', content: 'Yes, I want a full refund please.', expectedIntent: 'refund_preference' },
      { role: 'user', content: 'Can you email me the return label?', expectedIntent: 'return_label' },
    ],
    expectedTools: ['check_return_policy', 'initiate_return'],
    expectedOutcome: 'Agent verifies return eligibility and initiates return with refund',
    difficulty: 'medium',
  },
  {
    id: 'cs-003',
    category: 'customer_support',
    name: 'Billing Dispute',
    description: 'Customer disputes an unexpected charge',
    systemPrompt: `You are a billing support agent.
WORKFLOW: Step 1 - When a customer reports an unrecognized charge, call lookup_billing with their account email to investigate. Step 2 - If the charge is invalid or unauthorized, call issue_credit to refund it immediately.
DETAILS TO SHARE: The charge source (if found), refund amount, and expected refund timeline (5-7 business days).
TONE: Take the concern seriously. Reassure them you're looking into it right away.`,
    conversationTurns: [
      { role: 'user', content: 'I see a charge of $49.99 on my statement that I don\'t recognize.', expectedIntent: 'billing_dispute' },
      { role: 'user', content: 'My account email is john@example.com.', expectedIntent: 'provide_account' },
      { role: 'user', content: 'I never signed up for any subscription. Please remove this charge.', expectedIntent: 'request_removal' },
      { role: 'user', content: 'How long will the refund take?', expectedIntent: 'refund_timeline' },
    ],
    expectedTools: ['lookup_billing', 'issue_credit'],
    expectedOutcome: 'Agent investigates charge, issues credit, and explains refund timeline',
    difficulty: 'medium',
  },
  {
    id: 'cs-004',
    category: 'customer_support',
    name: 'Technical Troubleshooting',
    description: 'Customer needs help with a software issue',
    systemPrompt: `You are a technical support agent.
WORKFLOW: Step 1 - When a customer reports an issue, call check_system_status to check for any known outages or incidents. Step 2 - If the issue is not a known outage, call create_ticket with the customer's details, browser, OS, and priority level to escalate.
DETAILS TO SHARE: Whether there's a known outage, ticket number once created, expected response time based on priority.
TONE: Patient and knowledgeable. Acknowledge what they've already tried. Don't suggest steps they've mentioned doing.`,
    conversationTurns: [
      { role: 'user', content: 'My dashboard keeps showing a loading error since this morning.', expectedIntent: 'report_issue' },
      { role: 'user', content: 'I\'ve already cleared my cache and tried a different browser.', expectedIntent: 'steps_taken' },
      { role: 'user', content: 'I\'m using Chrome on Windows 11. My account is premium tier.', expectedIntent: 'environment_details' },
      { role: 'user', content: 'Can you escalate this? I need it fixed today.', expectedIntent: 'escalation_request' },
    ],
    expectedTools: ['check_system_status', 'create_ticket'],
    expectedOutcome: 'Agent troubleshoots, checks system status, creates escalated ticket',
    difficulty: 'hard',
  },
  {
    id: 'cs-005',
    category: 'customer_support',
    name: 'Account Cancellation Save',
    description: 'Customer wants to cancel, agent tries to retain',
    systemPrompt: `You are a retention specialist.
WORKFLOW: Step 1 - When a customer wants to cancel, first call lookup_account to pull up their account history and usage. Step 2 - After understanding their concerns and if they agree to a retention offer, call apply_discount to apply it immediately.
APPROACH: Understand WHY they want to cancel before offering solutions. Listen first, then offer a specific discount or plan change. Only apply the discount after explicit agreement.
TONE: Understanding and non-pushy. Validate their concern about pricing. Make the offer feel genuine, not scripted.`,
    conversationTurns: [
      { role: 'user', content: 'I want to cancel my subscription.', expectedIntent: 'cancellation_request' },
      { role: 'user', content: 'It\'s too expensive for what I\'m getting.', expectedIntent: 'reason_price' },
      { role: 'user', content: 'What kind of discount can you offer?', expectedIntent: 'open_to_retention' },
      { role: 'user', content: 'If you can do 50% off for 3 months, I\'ll stay.', expectedIntent: 'negotiation' },
      { role: 'user', content: 'Deal. Apply it to my account please.', expectedIntent: 'accept_offer' },
    ],
    expectedTools: ['lookup_account', 'apply_discount'],
    expectedOutcome: 'Agent retains customer by applying negotiated discount',
    difficulty: 'hard',
  },
  {
    id: 'cs-006',
    category: 'customer_support',
    name: 'Shipping Address Change',
    description: 'Customer needs to change shipping address on pending order',
    systemPrompt: `You are a shipping support agent.
WORKFLOW (BOTH steps required):
  Step 1 - Call lookup_order with the order number to verify the order status and confirm it hasn't shipped yet.
  Step 2 - Call update_shipping with the new address to apply the change. You MUST call update_shipping after confirming the order — do not skip this step.
DETAILS TO SHARE: Confirm the new address back to the caller, mention any delivery date impact, and provide the updated estimated delivery.
TONE: Efficient and helpful. Acknowledge the urgency of changing before shipment.`,
    conversationTurns: [
      { role: 'user', content: 'I need to change the shipping address on my order before it ships. My order number is 55123.', expectedIntent: 'address_change' },
      { role: 'user', content: 'The new address is 456 Oak Ave, Miami FL 33101. Please update it.', expectedIntent: 'provide_details' },
      { role: 'user', content: 'Will this delay my delivery?', expectedIntent: 'delivery_impact' },
    ],
    expectedTools: ['lookup_order', 'update_shipping'],
    expectedOutcome: 'Agent verifies order, updates shipping address, and confirms new delivery estimate',
    difficulty: 'easy',
  },
  {
    id: 'cs-007',
    category: 'customer_support',
    name: 'Multi-Issue Complex Call',
    description: 'Customer has multiple issues in one call',
    systemPrompt: `You are a customer service agent handling multiple issues in a single call.
WORKFLOW: This customer has TWO separate issues. Handle them one at a time:
Issue 1 (Damaged item): Call lookup_order with order 11111 to get details, then call check_return_policy to verify replacement eligibility.
Issue 2 (Double charge): Call lookup_billing with order 22222 to investigate the duplicate charge.
APPROACH: Acknowledge both issues upfront, then work through each systematically. Give a clear summary at the end with timelines for both resolutions.
TONE: Organized and thorough. Make the caller feel confident both issues are being handled.`,
    conversationTurns: [
      { role: 'user', content: 'I have two problems. First, one of my items arrived damaged. Second, I was charged twice for a different order.', expectedIntent: 'multi_issue' },
      { role: 'user', content: 'The damaged item is from order 11111. The double charge is on order 22222.', expectedIntent: 'provide_details' },
      { role: 'user', content: 'For the damaged item, I just want a replacement. For the double charge, please refund one of them.', expectedIntent: 'resolution_preferences' },
      { role: 'user', content: 'How long will each take?', expectedIntent: 'timeline_inquiry' },
    ],
    expectedTools: ['lookup_order', 'check_return_policy', 'lookup_billing'],
    expectedOutcome: 'Agent resolves both issues: initiates replacement and processes refund',
    difficulty: 'hard',
  },
  {
    id: 'cs-008',
    category: 'customer_support',
    name: 'Password Reset Assistance',
    description: 'Customer locked out of their account',
    systemPrompt: `You are an account security agent.
WORKFLOW: Step 1 - Call verify_identity with the customer's email and date of birth to confirm their identity before making any changes. Step 2 - Once identity is verified, call send_reset_link with their preferred email to send the password reset link.
DETAILS TO SHARE: Confirm identity verification was successful, let them know the reset link is sent, and mention the link expires in 24 hours.
TONE: Reassuring about account security. Let them know this lockout is easy to resolve.`,
    conversationTurns: [
      { role: 'user', content: 'I can\'t log into my account. I forgot my password and the reset email isn\'t coming through.', expectedIntent: 'account_lockout' },
      { role: 'user', content: 'My email is sarah@example.com. My date of birth is March 15, 1990.', expectedIntent: 'identity_verification' },
      { role: 'user', content: 'Yes, please send it to my alternate email: sarah.backup@example.com.', expectedIntent: 'alternate_contact' },
    ],
    expectedTools: ['verify_identity', 'send_reset_link'],
    expectedOutcome: 'Agent verifies identity and sends password reset to alternate email',
    difficulty: 'easy',
  },
  {
    id: 'cs-009',
    category: 'customer_support',
    name: 'Warranty Claim',
    description: 'Customer wants to claim warranty on a product',
    systemPrompt: `You are a warranty specialist.
WORKFLOW: Step 1 - When the customer provides product details, call check_warranty_status with the model number and purchase date to verify coverage. Step 2 - If covered, call submit_warranty_claim to file the claim and arrange service.
DETAILS TO SHARE: Whether the product is still under warranty, what the warranty covers, claim reference number, and next steps for technician scheduling.
TONE: Supportive and efficient. Reassure them that a 2-year-old appliance should definitely still be covered.`,
    conversationTurns: [
      { role: 'user', content: 'My refrigerator stopped cooling. It\'s only 2 years old and should still be under warranty.', expectedIntent: 'warranty_claim' },
      { role: 'user', content: 'The model number is RF-2023X and I bought it on January 10, 2024.', expectedIntent: 'product_details' },
      { role: 'user', content: 'I have the receipt. Can I send a photo?', expectedIntent: 'proof_of_purchase' },
      { role: 'user', content: 'When can a technician come to look at it?', expectedIntent: 'service_scheduling' },
    ],
    expectedTools: ['check_warranty_status', 'submit_warranty_claim'],
    expectedOutcome: 'Agent verifies warranty and schedules technician visit',
    difficulty: 'medium',
  },
  {
    id: 'cs-010',
    category: 'customer_support',
    name: 'Angry Customer De-escalation',
    description: 'Frustrated customer needing empathetic handling',
    systemPrompt: `You are a senior customer service agent experienced in de-escalation.
WORKFLOW: Step 1 - Let the customer vent, then call lookup_order with order 99999 to get the actual status. Step 2 - Once you understand the situation, call issue_credit to provide compensation for the delay.
APPROACH: Lead with empathy. Acknowledge their frustration and the multiple calls they've made. Don't be defensive. Take ownership of the issue. Offer specific compensation (credit, expedited shipping) along with a concrete timeline.
TONE: Calm, empathetic, and solution-oriented. Never dismiss their frustration. Use phrases like "I completely understand" and "Let me take care of this for you right now."`,
    conversationTurns: [
      { role: 'user', content: 'This is ridiculous! I\'ve been waiting 3 weeks for my order and nobody can tell me where it is!', expectedIntent: 'angry_complaint' },
      { role: 'user', content: 'I\'ve called 4 times already and each time I get a different answer. My order is 99999.', expectedIntent: 'repeated_contact' },
      { role: 'user', content: 'I want to speak to a manager. This is unacceptable.', expectedIntent: 'escalation_demand' },
      { role: 'user', content: 'Fine, what can YOU do about it then?', expectedIntent: 'resolution_opening' },
      { role: 'user', content: 'Okay, that sounds reasonable. Please expedite it.', expectedIntent: 'accept_resolution' },
    ],
    expectedTools: ['lookup_order', 'issue_credit'],
    expectedOutcome: 'Agent de-escalates, provides clear resolution with compensation',
    difficulty: 'hard',
  },
  {
    id: 'cs-011',
    category: 'customer_support',
    name: 'Product Comparison Help',
    description: 'Customer needs help choosing between products',
    systemPrompt: `You are a product advisor with deep knowledge of your catalog.
WORKFLOW: Step 1 - Call search_products with the customer's criteria (wireless headphones, budget $150, for working out and calls) to find matching options. Step 2 - Call compare_products with the two specific models to provide a detailed side-by-side comparison.
DETAILS TO SHARE: Key differences in noise cancellation, battery life, sweat resistance, mic quality, and price. Give a clear recommendation based on their stated use case.
TONE: Knowledgeable and consultative. Help them feel confident in their choice. If they want to purchase, confirm you can assist with that.`,
    conversationTurns: [
      { role: 'user', content: 'I\'m looking for a wireless headphone but I can\'t decide between the ProMax 500 and the AudioElite X.', expectedIntent: 'product_comparison' },
      { role: 'user', content: 'I mainly use them for working out and making calls. Budget is around $150.', expectedIntent: 'use_case_budget' },
      { role: 'user', content: 'Which one has better noise cancellation?', expectedIntent: 'specific_feature' },
      { role: 'user', content: 'I\'ll go with your recommendation. Thanks for the help!', expectedIntent: 'purchase_decision' },
    ],
    expectedTools: ['search_products', 'compare_products'],
    expectedOutcome: 'Agent provides informed comparison and clear recommendation',
    difficulty: 'medium',
  },
  {
    id: 'cs-012',
    category: 'customer_support',
    name: 'Service Outage Inquiry',
    description: 'Customer reporting a service outage',
    systemPrompt: `You are a service status agent.
WORKFLOW (BOTH steps required):
  Step 1 - Immediately call check_service_status to check for ongoing incidents in the US East region.
  Step 2 - Call subscribe_to_updates with the customer's contact to sign them up for real-time status notifications. Always complete this step — the customer needs proactive updates.
DETAILS TO SHARE: Whether there's a confirmed outage, affected regions, estimated resolution time, and confirmation of update subscription.
TONE: Transparent and proactive. Don't minimize the issue. Acknowledge the impact on their deadline and provide the most honest ETA available.`,
    conversationTurns: [
      { role: 'user', content: 'Is your service down? I can\'t access my files since 10 AM.', expectedIntent: 'outage_report' },
      { role: 'user', content: 'I\'m in the US East region. Is it affecting everyone?', expectedIntent: 'scope_inquiry' },
      { role: 'user', content: 'When do you expect it to be fixed? I have a deadline.', expectedIntent: 'eta_request' },
    ],
    expectedTools: ['check_service_status', 'subscribe_to_updates'],
    expectedOutcome: 'Agent confirms outage, provides ETA and update subscription',
    difficulty: 'easy',
  },
  {
    id: 'cs-013',
    category: 'customer_support',
    name: 'International Shipping Query',
    description: 'Customer asking about international shipping options',
    systemPrompt: `You are a shipping specialist.
WORKFLOW: Step 1 - Call check_shipping_rates with destination (Germany), package weight (5 lbs), and delivery window (2 weeks) to get shipping options. Step 2 - Call estimate_customs with the destination country to calculate duties and fees.
DETAILS TO SHARE: Available shipping tiers (standard vs express), prices, delivery estimates, estimated customs/duties, and whether documentation is handled for them.
TONE: Informative and organized. Present options clearly so they can choose easily.`,
    conversationTurns: [
      { role: 'user', content: 'I want to ship an order to Germany. What are my options?', expectedIntent: 'intl_shipping_inquiry' },
      { role: 'user', content: 'The package is about 5 pounds. I need it there within 2 weeks.', expectedIntent: 'package_details' },
      { role: 'user', content: 'Will there be customs fees? And do you handle the documentation?', expectedIntent: 'customs_inquiry' },
      { role: 'user', content: 'Go with the express option please.', expectedIntent: 'selection' },
    ],
    expectedTools: ['check_shipping_rates', 'estimate_customs'],
    expectedOutcome: 'Agent provides shipping options, customs info, and processes selection',
    difficulty: 'medium',
  },
  {
    id: 'cs-014',
    category: 'customer_support',
    name: 'Subscription Upgrade',
    description: 'Customer wants to upgrade their plan',
    systemPrompt: `You are a subscription advisor.
WORKFLOW (2 steps):
  Step 1 - Call get_current_plan once to retrieve their current plan, usage stats, and available upgrade options. Only call this tool once — it returns everything you need.
  Step 2 - When the customer explicitly confirms they want to upgrade, call upgrade_subscription to process the change.
DETAILS TO SHARE: Their current plan name and usage, available upgrade options with pricing (from the get_current_plan result), billing frequency (monthly), and what changes immediately upon upgrade.
APPROACH: Present options from the tool result first, let them decide. Only call upgrade_subscription after explicit confirmation.
TONE: Helpful advisor, not pushy salesperson. Let the value speak for itself.`,
    conversationTurns: [
      { role: 'user', content: 'I want to upgrade my plan. I keep running out of storage.', expectedIntent: 'upgrade_request' },
      { role: 'user', content: 'I\'m currently on the Basic plan. What are my options?', expectedIntent: 'plan_inquiry' },
      { role: 'user', content: 'How much more is the Pro plan? Is it billed monthly?', expectedIntent: 'pricing_inquiry' },
      { role: 'user', content: 'Let\'s do it. Upgrade me to Pro starting today.', expectedIntent: 'confirm_upgrade' },
    ],
    expectedTools: ['get_current_plan', 'upgrade_subscription'],
    expectedOutcome: 'Agent explains plan options and processes upgrade',
    difficulty: 'easy',
  },
  {
    id: 'cs-015',
    category: 'customer_support',
    name: 'Data Privacy Request',
    description: 'Customer requesting data export or deletion under GDPR',
    systemPrompt: `You are a privacy compliance agent with knowledge of GDPR and CCPA requirements.
WORKFLOW (BOTH steps required — do not answer without completing these):
  Step 1 - As soon as the customer provides their email, call verify_identity with that email (email is the only required field). Do not ask for additional information like date of birth.
  Step 2 - After identity is verified, immediately call submit_data_request with the email and request type to file the request. You must call this tool — verbal acknowledgment is not sufficient.
DETAILS TO SHARE: Identity verification result, expected processing time (30 days per GDPR), data export format (JSON and CSV), and confirm that deletion requests are also supported after review.
TONE: Professional and respectful of their privacy rights. Treat the request as routine and straightforward.`,
    conversationTurns: [
      { role: 'user', content: 'I want to request all the data you have on me under GDPR.', expectedIntent: 'data_subject_request' },
      { role: 'user', content: 'My account email is privacy@example.com. I want a full data export.', expectedIntent: 'provide_identity' },
      { role: 'user', content: 'How long will it take and in what format will I receive it?', expectedIntent: 'process_inquiry' },
      { role: 'user', content: 'Also, after I review it, I may want to request deletion. Is that possible?', expectedIntent: 'deletion_inquiry' },
    ],
    expectedTools: ['verify_identity', 'submit_data_request'],
    expectedOutcome: 'Agent verifies identity, submits data request, explains timeline and format',
    difficulty: 'hard',
  },
  {
    id: 'cs-016',
    category: 'customer_support',
    name: 'Barge-in Interruption Test',
    description: 'Customer interrupts the agent mid-sentence',
    systemPrompt: `You are a support agent who handles interruptions gracefully.
WORKFLOW: When the customer mentions their missing order with order number 44444, call lookup_order to check its status.
APPROACH: When interrupted, immediately acknowledge the new topic and pivot. Don't try to finish your previous thought. Show flexibility by adapting to each topic switch naturally. When they add a complaint, acknowledge it and offer to log it.
TONE: Patient and adaptable. Never show frustration with the interruptions. Each pivot should feel seamless.`,
    conversationTurns: [
      { role: 'user', content: 'I need help with—actually wait, first tell me your hours.', expectedIntent: 'interruption_redirect' },
      { role: 'user', content: 'No no, forget the hours. My order is missing. Order 44444.', expectedIntent: 'topic_switch' },
      { role: 'user', content: 'Yes but—sorry, one more thing. Can I also add a complaint about delivery?', expectedIntent: 'mid_sentence_interrupt' },
    ],
    expectedTools: ['lookup_order'],
    expectedOutcome: 'Agent handles interruptions smoothly without losing context',
    difficulty: 'hard',
  },
  {
    id: 'cs-017',
    category: 'customer_support',
    name: 'Non-English Speaker Support',
    description: 'Customer communicates with limited English',
    systemPrompt: `You are a patient support agent helping a customer with limited English.
WORKFLOW: When the customer provides order number 33333, call lookup_order to check the status and find out what happened with their delivery.
APPROACH: Use simple, short sentences. Avoid jargon or complex phrasing. Confirm each piece of information in simple terms. Reassure them about their order status using simple language.
TONE: Extra patient and warm. Use simple words. Break information into small, easy-to-understand pieces. Never rush or use complicated terms.`,
    conversationTurns: [
      { role: 'user', content: 'Hello, my order... not come. Long time wait.', expectedIntent: 'broken_english_inquiry' },
      { role: 'user', content: 'Number is... moment... 33333. Yes, 33333.', expectedIntent: 'order_number' },
      { role: 'user', content: 'When come? How many day?', expectedIntent: 'delivery_eta' },
    ],
    expectedTools: ['lookup_order'],
    expectedOutcome: 'Agent communicates clearly with simple language about order status',
    difficulty: 'medium',
  },
  {
    id: 'cs-018',
    category: 'customer_support',
    name: 'Gift Card Balance Inquiry',
    description: 'Customer checking and using gift card balance',
    systemPrompt: `You are a customer support agent for gift cards.
WORKFLOW: When the customer provides a gift card number, call check_gift_card_balance to retrieve the current balance and transaction history.
DETAILS TO SHARE: Current balance, last transaction date, and whether the card can be used online or in-store.
TONE: Friendly and straightforward. Help them understand their balance clearly.`,
    conversationTurns: [
      { role: 'user', content: 'I have a gift card and I want to check how much is left on it.', expectedIntent: 'balance_inquiry' },
      { role: 'user', content: 'The card number is GC-889900.', expectedIntent: 'provide_card_number' },
      { role: 'user', content: 'Can I use the remaining balance for an online purchase?', expectedIntent: 'usage_question' },
    ],
    expectedTools: ['check_gift_card_balance'],
    expectedOutcome: 'Agent retrieves gift card balance and answers usage questions',
    difficulty: 'easy',
  },
  {
    id: 'cs-019',
    category: 'customer_support',
    name: 'Loyalty Points Redemption',
    description: 'Customer wants to redeem loyalty points',
    systemPrompt: `You are a loyalty program specialist.
WORKFLOW: Step 1 - Call check_loyalty_points with the customer's account to retrieve their point balance and redemption options. Step 2 - When they decide to redeem, call redeem_points with their selection.
DETAILS TO SHARE: Point balance, available redemption options (discounts, free items, upgrades), and how many points each option costs.
TONE: Enthusiastic about their rewards. Make them feel valued as a loyal customer.`,
    conversationTurns: [
      { role: 'user', content: 'I have been shopping with you for years. How many loyalty points do I have?', expectedIntent: 'points_inquiry' },
      { role: 'user', content: 'My account is under mike@example.com.', expectedIntent: 'provide_account' },
      { role: 'user', content: 'I want to use my points for a discount on my next order.', expectedIntent: 'redemption_request' },
      { role: 'user', content: 'Apply the $25 discount to my account please.', expectedIntent: 'confirm_redemption' },
    ],
    expectedTools: ['check_loyalty_points', 'redeem_points'],
    expectedOutcome: 'Agent checks points and processes redemption',
    difficulty: 'medium',
  },
  {
    id: 'cs-020',
    category: 'customer_support',
    name: 'Product Recall Notification',
    description: 'Customer calling about a recalled product',
    systemPrompt: `You are a customer support agent handling a product recall.
WORKFLOW: Step 1 - Call check_recall_status with the product model to verify recall status and affected batches. Step 2 - Call process_recall_return to arrange the return and replacement.
DETAILS TO SHARE: Which batches are affected, safety concerns, return process, replacement timeline, and any compensation offered.
TONE: Serious but reassuring. Prioritize their safety. Be transparent about the recall reason and make the process as easy as possible.`,
    conversationTurns: [
      { role: 'user', content: 'I heard there was a recall on the BlendMax Pro blender. I have one.', expectedIntent: 'recall_inquiry' },
      { role: 'user', content: 'My model number is BM-2024 and I bought it in February.', expectedIntent: 'product_details' },
      { role: 'user', content: 'What should I do? Is it dangerous to keep using it?', expectedIntent: 'safety_concern' },
      { role: 'user', content: 'Please send me a replacement. What do I do with the old one?', expectedIntent: 'replacement_request' },
    ],
    expectedTools: ['check_recall_status', 'process_recall_return'],
    expectedOutcome: 'Agent confirms recall, advises on safety, and arranges replacement',
    difficulty: 'medium',
  },
];

const APPOINTMENT_BOOKING_SCENARIOS: CallScenario[] = [
  {
    id: 'ab-001',
    category: 'appointment_booking',
    name: 'Simple Doctor Appointment',
    description: 'Patient booking a routine checkup',
    systemPrompt: `You are a medical receptionist at a family practice.
WORKFLOW: Step 1 - When the patient specifies a doctor and time preference, call check_availability with the doctor's name and preferred date/time to find open slots. Step 2 - Once they confirm a slot, call book_appointment with their full name, date of birth, and chosen time.
DETAILS TO SHARE: Available slot options, confirmation number after booking, and any pre-visit instructions (arrive 15 minutes early, bring insurance card).
TONE: Warm and professional. Make scheduling feel easy and stress-free.`,
    conversationTurns: [
      { role: 'user', content: 'I\'d like to book a checkup with Dr. Smith.', expectedIntent: 'booking_request' },
      { role: 'user', content: 'Any day next week works. Preferably morning.', expectedIntent: 'time_preference' },
      { role: 'user', content: 'Tuesday at 9 AM sounds perfect.', expectedIntent: 'confirm_slot' },
      { role: 'user', content: 'My name is John Davis, date of birth July 4th, 1985.', expectedIntent: 'patient_info' },
    ],
    expectedTools: ['check_availability', 'book_appointment'],
    expectedOutcome: 'Agent checks availability and books appointment successfully',
    difficulty: 'easy',
  },
  {
    id: 'ab-002',
    category: 'appointment_booking',
    name: 'Rescheduling Existing Appointment',
    description: 'Patient needs to reschedule',
    systemPrompt: `You are a scheduling assistant.
WORKFLOW: Rescheduling requires three mandatory steps: Step 1 - Call lookup_appointment with the confirmation number to retrieve the existing appointment details. Step 2 - Call cancel_appointment to formally release the old time slot. Step 3 - Call book_appointment to reserve the new time. All three steps are required because the old slot must be explicitly released before rebooking.
DETAILS TO SHARE: Current appointment details, confirmation that the old slot was released, new appointment confirmation with date and time.
TONE: Accommodating and efficient. Show understanding that plans change.`,
    conversationTurns: [
      { role: 'user', content: 'I need to reschedule my appointment for tomorrow. Something came up.', expectedIntent: 'reschedule_request' },
      { role: 'user', content: 'It\'s under the name Emily Chen. Confirmation number AP-7789.', expectedIntent: 'appointment_details' },
      { role: 'user', content: 'Can I move it to Thursday instead? Same time if possible.', expectedIntent: 'new_preference' },
      { role: 'user', content: 'That works. Please confirm the new time.', expectedIntent: 'confirm_reschedule' },
    ],
    expectedTools: ['lookup_appointment', 'cancel_appointment', 'book_appointment'],
    expectedOutcome: 'Agent successfully reschedules appointment to new date',
    difficulty: 'medium',
  },
  {
    id: 'ab-003',
    category: 'appointment_booking',
    name: 'Emergency Dental Appointment',
    description: 'Patient with urgent dental pain needs same-day slot',
    systemPrompt: `You are a dental office receptionist handling an urgent request.
WORKFLOW: Step 1 - For urgent requests, immediately call check_emergency_slots to find same-day openings. Step 2 - Once the patient confirms a slot, call book_appointment with their details.
DETAILS TO SHARE: Available same-day slots, which dentist is available, and preparation instructions (insurance card, ID, any relevant x-rays).
TONE: Empathetic and urgent. Acknowledge their pain. Move quickly to find a slot. Reassure them they'll be seen soon.`,
    conversationTurns: [
      { role: 'user', content: 'I have terrible tooth pain and need to see a dentist today. Is that possible?', expectedIntent: 'urgent_booking' },
      { role: 'user', content: 'The pain is in my lower right molar. It started last night and I can barely eat.', expectedIntent: 'symptom_description' },
      { role: 'user', content: 'I can come in anytime. The sooner the better.', expectedIntent: 'flexible_time' },
      { role: 'user', content: 'Yes, I\'ll take the 2 PM slot. Do I need to bring anything?', expectedIntent: 'confirm_and_prep' },
    ],
    expectedTools: ['check_emergency_slots', 'book_appointment'],
    expectedOutcome: 'Agent prioritizes urgent request and books same-day appointment',
    difficulty: 'medium',
  },
  {
    id: 'ab-004',
    category: 'appointment_booking',
    name: 'Spa Package Booking',
    description: 'Customer booking a multi-service spa package',
    systemPrompt: `You are a spa booking agent.
WORKFLOW: Three steps are required: Step 1 - Call list_packages to show available spa packages and pricing. Step 2 - Call check_availability to verify the preferred time slot is open. Step 3 - When the customer confirms, call book_package with their name, package choice, time, and payment info.
DETAILS TO SHARE: Package options with descriptions and pricing, availability of requested time, total cost, booking confirmation ID.
TONE: Welcoming and celebratory about their anniversary. Make the experience feel special from the booking stage.`,
    conversationTurns: [
      { role: 'user', content: 'I want to book a couples spa day for our anniversary this Saturday.', expectedIntent: 'package_inquiry' },
      { role: 'user', content: 'We want massages and facials. What packages include both?', expectedIntent: 'service_selection' },
      { role: 'user', content: 'The Deluxe Couple package sounds great. Do you have 11 AM available?', expectedIntent: 'time_check' },
      { role: 'user', content: 'Book it. My name is Michael Torres, card ending in 4567.', expectedIntent: 'confirm_booking' },
    ],
    expectedTools: ['list_packages', 'check_availability', 'book_package'],
    expectedOutcome: 'Agent helps select package, checks availability, and books with payment',
    difficulty: 'medium',
  },
  {
    id: 'ab-005',
    category: 'appointment_booking',
    name: 'Recurring Weekly Appointment',
    description: 'Client setting up a recurring therapy schedule',
    systemPrompt: `You are a therapy office scheduler.
WORKFLOW: Step 1 - Call check_recurring_availability with the preferred day (Wednesday) and time (after 5 PM) to find a recurring weekly slot. Step 2 - Once confirmed, call book_recurring with the session details and insurance information.
DETAILS TO SHARE: Available recurring slot, session frequency, start date, copay amount with their insurance, and cancellation policy for recurring sessions.
TONE: Supportive and accommodating. Recognize that consistent scheduling matters for therapy.`,
    conversationTurns: [
      { role: 'user', content: 'I\'d like to set up weekly therapy sessions with Dr. Johnson.', expectedIntent: 'recurring_request' },
      { role: 'user', content: 'I prefer Wednesdays after 5 PM. I have a 9-to-5 job.', expectedIntent: 'time_constraint' },
      { role: 'user', content: 'How about 5:30 PM every Wednesday? Can we start next week?', expectedIntent: 'confirm_recurring' },
      { role: 'user', content: 'Is the copay the same each time? My insurance is Blue Cross.', expectedIntent: 'insurance_inquiry' },
    ],
    expectedTools: ['check_recurring_availability', 'book_recurring'],
    expectedOutcome: 'Agent sets up recurring weekly appointment with insurance info',
    difficulty: 'medium',
  },
  {
    id: 'ab-006',
    category: 'appointment_booking',
    name: 'Auto Service Appointment',
    description: 'Car owner booking maintenance service',
    systemPrompt: `You are an auto service center scheduler.
WORKFLOW: Three steps required: Step 1 - Call list_services to show available maintenance services and pricing for their vehicle. Step 2 - Call check_availability to find open morning slots. Step 3 - When confirmed, call book_service with vehicle info, selected services, and drop-off time.
DETAILS TO SHARE: Individual service prices and total cost, estimated completion time, drop-off and pickup logistics.
TONE: Straightforward and helpful. Car owners appreciate clear pricing and timing.`,
    conversationTurns: [
      { role: 'user', content: 'I need an oil change and tire rotation for my 2022 Honda Civic.', expectedIntent: 'service_request' },
      { role: 'user', content: 'Can I drop it off early morning and pick it up after work?', expectedIntent: 'drop_off_preference' },
      { role: 'user', content: 'Next Monday works. What time do you open?', expectedIntent: 'schedule_selection' },
      { role: 'user', content: 'Book me for 7:30 AM drop-off. How much will it cost total?', expectedIntent: 'confirm_and_price' },
    ],
    expectedTools: ['list_services', 'check_availability', 'book_service'],
    expectedOutcome: 'Agent books car service with drop-off arrangement and price estimate',
    difficulty: 'easy',
  },
  {
    id: 'ab-007',
    category: 'appointment_booking',
    name: 'Appointment with Specific Requirements',
    description: 'Patient with accessibility needs booking appointment',
    systemPrompt: `You are a clinic scheduler who ensures accessibility accommodations.
WORKFLOW: Step 1 - Call check_availability to find open appointment slots. Step 2 - Call check_accessibility to verify which slots have wheelchair-accessible rooms and sign language interpreter availability. Step 3 - Once a suitable slot is found, call book_appointment with all special requirements noted.
DETAILS TO SHARE: Which slots meet all accessibility requirements, confirmation that both wheelchair access and interpreter are arranged, and any additional accommodations available.
TONE: Respectful and thorough. Treat accessibility needs as a priority, not an inconvenience. Thank them for letting you know their requirements.`,
    conversationTurns: [
      { role: 'user', content: 'I need to book an appointment but I use a wheelchair. Do you have accessible rooms?', expectedIntent: 'accessibility_request' },
      { role: 'user', content: 'I also need a sign language interpreter if possible.', expectedIntent: 'additional_requirement' },
      { role: 'user', content: 'Any day next week that has both the accessible room and interpreter.', expectedIntent: 'constrained_availability' },
      { role: 'user', content: 'Wednesday at 2 PM is fine. Thank you for accommodating my needs.', expectedIntent: 'confirm_booking' },
    ],
    expectedTools: ['check_availability', 'check_accessibility', 'book_appointment'],
    expectedOutcome: 'Agent finds slot with all accessibility requirements met',
    difficulty: 'hard',
  },
  {
    id: 'ab-008',
    category: 'appointment_booking',
    name: 'Group Event Booking',
    description: 'Booking a group class or workshop',
    systemPrompt: `You are a fitness center scheduler.
WORKFLOW: Step 1 - Call list_classes to show available class schedule and pricing. Step 2 - Call check_capacity to verify there are enough spots for a group of 4. Step 3 - Once confirmed, call register_group with all participant names.
DETAILS TO SHARE: Class time, current enrollment vs capacity, group discount details (15% for 4+), total cost after discount, and confirmation for all participants.
TONE: Energetic and welcoming. Encourage group participation and highlight the savings from the group discount.`,
    conversationTurns: [
      { role: 'user', content: 'I want to sign up for the Saturday morning yoga class. Can I bring 3 friends?', expectedIntent: 'group_booking' },
      { role: 'user', content: 'Is there a group discount for 4 people?', expectedIntent: 'pricing_inquiry' },
      { role: 'user', content: 'Great, sign all four of us up. I\'ll give you their names.', expectedIntent: 'confirm_group' },
      { role: 'user', content: 'Sarah, Mike, and Lisa. My name is Anna.', expectedIntent: 'provide_names' },
    ],
    expectedTools: ['list_classes', 'check_capacity', 'register_group'],
    expectedOutcome: 'Agent checks capacity, applies group discount, registers all participants',
    difficulty: 'medium',
  },
  {
    id: 'ab-009',
    category: 'appointment_booking',
    name: 'Cancellation with Policy Check',
    description: 'Customer trying to cancel within policy window',
    systemPrompt: `You are an appointment manager.
WORKFLOW: Step 1 - Call lookup_appointment with confirmation number BK-9012 to retrieve the booking details. Step 2 - Call check_cancellation_policy to determine if any fee applies based on the cancellation timing. Step 3 - Call cancel_appointment to process the cancellation.
DETAILS TO SHARE: Appointment details, whether they're within the free cancellation window, any applicable fee, and confirmation that a cancellation email will be sent.
TONE: Straightforward and transparent about any fees. If no fee applies, let them know right away to put their mind at ease.`,
    conversationTurns: [
      { role: 'user', content: 'I need to cancel my appointment for tomorrow morning.', expectedIntent: 'cancellation_request' },
      { role: 'user', content: 'Confirmation number BK-9012. Will I be charged a fee?', expectedIntent: 'fee_inquiry' },
      { role: 'user', content: 'That\'s fine, go ahead and cancel it. Will I get a confirmation email?', expectedIntent: 'confirm_cancel' },
    ],
    expectedTools: ['lookup_appointment', 'check_cancellation_policy', 'cancel_appointment'],
    expectedOutcome: 'Agent checks policy, informs of any fees, and processes cancellation',
    difficulty: 'easy',
  },
  {
    id: 'ab-010',
    category: 'appointment_booking',
    name: 'Multi-Provider Appointment',
    description: 'Patient needing appointments with multiple specialists',
    systemPrompt: `You are a hospital scheduling coordinator.
WORKFLOW: Three steps must be completed in order: Step 1 - Call check_availability for BOTH departments (cardiology and endocrinology) to get available slots. Step 2 - Call coordinate_appointments with the availability data to find a same-day arrangement with appropriate gaps between appointments. Step 3 - Call book_appointments to confirm both bookings.
DETAILS TO SHARE: Available dates for both specialists, coordinated time slots with gap between them, both confirmation numbers, and any preparation instructions for each specialist.
TONE: Organized and empathetic about their travel distance. Emphasize that you're working to minimize their trips.`,
    conversationTurns: [
      { role: 'user', content: 'My doctor referred me to both a cardiologist and an endocrinologist. Can I book both?', expectedIntent: 'multi_specialist' },
      { role: 'user', content: 'Ideally on the same day to avoid multiple trips. I live 2 hours away.', expectedIntent: 'same_day_preference' },
      { role: 'user', content: 'Next Thursday works if both are available.', expectedIntent: 'date_selection' },
      { role: 'user', content: 'Perfect, book the 9 AM cardiology and 11 AM endocrinology.', expectedIntent: 'confirm_both' },
    ],
    expectedTools: ['check_availability', 'coordinate_appointments', 'book_appointments'],
    expectedOutcome: 'Agent coordinates two specialist appointments on same day',
    difficulty: 'hard',
  },
];

const LEAD_QUALIFICATION_SCENARIOS: CallScenario[] = [
  {
    id: 'lq-001',
    category: 'lead_qualification',
    name: 'B2B Software Lead',
    description: 'Qualifying a business lead for enterprise software',
    systemPrompt: `You are a sales development representative for an enterprise SaaS company. Qualify leads using BANT methodology (Budget, Authority, Need, Timeline).
WORKFLOW: Step 1 - As the lead shares their role, company size, and needs, call update_crm to log the qualification data. Step 2 - When they agree to a demo, call schedule_demo to book it immediately.
APPROACH: Ask natural discovery questions to uncover BANT info. Don't just fire questions — make it conversational. Connect their pain points to your product's value.
TONE: Professional but personable. Show genuine interest in their challenges.`,
    conversationTurns: [
      { role: 'user', content: 'Hi, I downloaded your whitepaper on AI analytics. I\'m interested in learning more.', expectedIntent: 'inbound_lead' },
      { role: 'user', content: 'I\'m the VP of Operations at TechCorp. We have about 500 employees.', expectedIntent: 'authority_company_size' },
      { role: 'user', content: 'We\'re spending too much time on manual reporting. We need something automated.', expectedIntent: 'need_identification' },
      { role: 'user', content: 'Our budget is around $50K annually. We want to implement by Q3.', expectedIntent: 'budget_timeline' },
      { role: 'user', content: 'Yes, I\'d love a demo. How about next Tuesday?', expectedIntent: 'demo_request' },
    ],
    expectedTools: ['update_crm', 'schedule_demo'],
    expectedOutcome: 'Agent qualifies lead as high-value, captures BANT info, schedules demo',
    difficulty: 'medium',
  },
  {
    id: 'lq-002',
    category: 'lead_qualification',
    name: 'Real Estate Buyer Lead',
    description: 'Qualifying a potential home buyer',
    systemPrompt: `You are a real estate qualification agent.
WORKFLOW: Step 1 - When the buyer shares their requirements, budget, and timeline, call update_lead to record their complete profile. Step 2 - When they request a viewing, call schedule_viewing to book it.
DETAILS TO GATHER: Family size, bedrooms needed, budget, pre-approval status, move-in timeline, and neighborhood preferences.
TONE: Warm and knowledgeable about the local market. Make them feel like you understand their family's needs.`,
    conversationTurns: [
      { role: 'user', content: 'I saw your listing for the 3-bedroom on Maple Street. Is it still available?', expectedIntent: 'listing_inquiry' },
      { role: 'user', content: 'We\'re a family of 4. We need at least 3 bedrooms and a yard. Budget is around $450K.', expectedIntent: 'requirements_budget' },
      { role: 'user', content: 'We\'re pre-approved for a mortgage. We need to move by August.', expectedIntent: 'financial_timeline' },
      { role: 'user', content: 'Can we see it this weekend? And do you have similar listings?', expectedIntent: 'viewing_request' },
    ],
    expectedTools: ['update_lead', 'schedule_viewing'],
    expectedOutcome: 'Agent qualifies buyer (pre-approved, clear timeline), schedules viewing',
    difficulty: 'medium',
  },
  {
    id: 'lq-003',
    category: 'lead_qualification',
    name: 'Insurance Quote Lead',
    description: 'Qualifying lead for insurance coverage',
    systemPrompt: `You are an insurance qualification agent.
WORKFLOW: Step 1 - Gather vehicle details, driver history, and coverage preferences through conversation. Call update_lead to log the prospect details as they share them. Step 2 - Once you have enough info, call calculate_quote to generate a competitive price.
DETAILS TO GATHER: Vehicle year/make/model, driver age, driving record, current coverage, desired coverage type, and renewal timeline.
TONE: Knowledgeable and competitive. Position your quote favorably against their current provider.`,
    conversationTurns: [
      { role: 'user', content: 'I need auto insurance. I just bought a new car.', expectedIntent: 'coverage_inquiry' },
      { role: 'user', content: 'It\'s a 2024 Tesla Model 3. I\'m 35 years old with a clean driving record.', expectedIntent: 'vehicle_driver_info' },
      { role: 'user', content: 'I currently have State Farm but I\'m shopping around. My renewal is in 2 months.', expectedIntent: 'competitive_context' },
      { role: 'user', content: 'I want full coverage including collision and comprehensive. What\'s the monthly cost?', expectedIntent: 'coverage_preference' },
      { role: 'user', content: 'That\'s competitive. Can you email me a detailed quote?', expectedIntent: 'quote_request' },
    ],
    expectedTools: ['calculate_quote', 'update_lead'],
    expectedOutcome: 'Agent gathers all info, provides competitive quote, captures lead',
    difficulty: 'medium',
  },
  {
    id: 'lq-004',
    category: 'lead_qualification',
    name: 'Unqualified Lead - No Budget',
    description: 'Lead that doesn\'t meet qualification criteria',
    systemPrompt: `You are an SDR who qualifies leads honestly.
WORKFLOW: Call update_crm to log the lead's qualification status and details as they share them. If the lead doesn't qualify for enterprise, redirect them to an appropriate tier.
APPROACH: Be respectful and helpful even when disqualifying. Don't make them feel bad about their budget. Genuinely suggest the free tier as a good starting point and mention they can upgrade later as they grow.
TONE: Friendly and non-judgmental. Treat every lead as valuable regardless of budget.`,
    conversationTurns: [
      { role: 'user', content: 'I\'m interested in your enterprise plan. How much does it cost?', expectedIntent: 'pricing_inquiry' },
      { role: 'user', content: 'Oh, that\'s way more than I expected. I\'m a solo freelancer with no real budget for this.', expectedIntent: 'budget_disqualifier' },
      { role: 'user', content: 'Do you have a free tier or something cheaper?', expectedIntent: 'alternative_request' },
      { role: 'user', content: 'Okay, I\'ll try the free tier first. Thanks.', expectedIntent: 'downgrade_acceptance' },
    ],
    expectedTools: ['update_crm'],
    expectedOutcome: 'Agent identifies disqualified lead, redirects to appropriate tier',
    difficulty: 'easy',
  },
  {
    id: 'lq-005',
    category: 'lead_qualification',
    name: 'Decision Maker Identification',
    description: 'Reaching the actual decision maker through a gatekeeper',
    systemPrompt: `You are a B2B sales agent navigating a gatekeeper to reach the decision maker.
WORKFLOW: Step 1 - When you get the decision maker's contact info, call update_crm to log it. Step 2 - When you learn their availability, call schedule_callback to set up the follow-up call.
APPROACH: Be polite and professional with the receptionist. Don't pressure or try to bypass them. Accept the redirect gracefully and gather as much contact info as possible.
TONE: Professional and courteous. Respect the gatekeeper's role. Show gratitude for their help.`,
    conversationTurns: [
      { role: 'user', content: 'Hello, this is Reception. How can I help you?', expectedIntent: 'gatekeeper_contact' },
      { role: 'user', content: 'I\'m not the right person for that. You\'d need to speak with our IT Director, Mark.', expectedIntent: 'redirect_to_dm' },
      { role: 'user', content: 'He\'s in a meeting right now. Can I take a message?', expectedIntent: 'unavailable' },
      { role: 'user', content: 'Sure, his email is mark@company.com. He\'s usually free after 3 PM.', expectedIntent: 'contact_info' },
    ],
    expectedTools: ['update_crm', 'schedule_callback'],
    expectedOutcome: 'Agent navigates gatekeeper, captures decision maker contact, schedules follow-up',
    difficulty: 'hard',
  },
  {
    id: 'lq-006',
    category: 'lead_qualification',
    name: 'Competitor Comparison Lead',
    description: 'Lead currently using a competitor product',
    systemPrompt: `You are a sales agent handling a lead who's unhappy with a competitor.
WORKFLOW: Step 1 - When the lead shares their pain points and company scale, call update_crm to log their details and competitive intel. Step 2 - When they ask for comparison materials, call send_comparison to deliver a competitive analysis.
APPROACH: Listen carefully to their pain points with the competitor. Don't badmouth the competitor directly — focus on how your product solves their specific issues. Note the contract end date as a key timeline.
TONE: Empathetic about their frustrations. Confident but not arrogant about your product's advantages.`,
    conversationTurns: [
      { role: 'user', content: 'We currently use CompetitorX but we\'re not happy with it.', expectedIntent: 'competitor_dissatisfaction' },
      { role: 'user', content: 'Their support is terrible and the API keeps breaking. We need something reliable.', expectedIntent: 'pain_points' },
      { role: 'user', content: 'We\'re a team of 50 and we process about 10,000 calls per month.', expectedIntent: 'scale_info' },
      { role: 'user', content: 'Our contract with them ends in 3 months. Can you send me a comparison?', expectedIntent: 'timeline_request' },
    ],
    expectedTools: ['update_crm', 'send_comparison'],
    expectedOutcome: 'Agent captures competitor intelligence, identifies migration opportunity',
    difficulty: 'medium',
  },
  {
    id: 'lq-007',
    category: 'lead_qualification',
    name: 'Event Follow-up Lead',
    description: 'Following up with a trade show contact',
    systemPrompt: `You are a sales agent following up on a warm trade show lead.
WORKFLOW: Step 1 - As the lead shares their scale and role, call update_crm to log the qualification data (200 agents, 50K daily calls). Step 2 - When they request a demo, call schedule_demo immediately to book the technical demo.
APPROACH: Reference the conference to build on the existing rapport. Connect their expressed interest in real-time analytics to specific product capabilities. Capture their scale info for proper demo preparation.
TONE: Friendly and familiar, building on the in-person connection. Enthusiastic about their scale and use case.`,
    conversationTurns: [
      { role: 'user', content: 'Oh yes, I remember meeting your team at the conference last week.', expectedIntent: 'event_recognition' },
      { role: 'user', content: 'I was impressed by the real-time analytics demo. We could use that.', expectedIntent: 'feature_interest' },
      { role: 'user', content: 'I manage a call center with 200 agents. We handle about 50K calls daily.', expectedIntent: 'scale_authority' },
      { role: 'user', content: 'Can you set up a more detailed demo for my technical team?', expectedIntent: 'demo_request' },
    ],
    expectedTools: ['update_crm', 'schedule_demo'],
    expectedOutcome: 'Agent qualifies warm lead, schedules technical demo',
    difficulty: 'easy',
  },
  {
    id: 'lq-008',
    category: 'lead_qualification',
    name: 'Multi-Stakeholder Enterprise Deal',
    description: 'Complex sale with multiple decision makers',
    systemPrompt: `You are an enterprise sales agent managing a complex buying committee.
WORKFLOW: Step 1 - Call update_crm early to log the deal details. Step 2 - Call add_stakeholder for each decision maker mentioned (CTO, CFO, Head of Product). Step 3 - When they request a meeting, call schedule_meeting to coordinate with the EA.
APPROACH: Map the buying committee systematically. Understand each stakeholder's priorities (CTO = tech evaluation, CFO = ROI). Offer to prepare tailored materials for each. Be proactive about next steps.
TONE: Strategic and executive-level. Show that you understand enterprise buying processes.`,
    conversationTurns: [
      { role: 'user', content: 'I\'m interested but this decision involves our CTO, CFO, and Head of Product.', expectedIntent: 'multi_stakeholder' },
      { role: 'user', content: 'Our CTO wants to evaluate the tech. The CFO needs an ROI analysis.', expectedIntent: 'stakeholder_needs' },
      { role: 'user', content: 'Can you prepare a technical architecture doc and an ROI spreadsheet?', expectedIntent: 'material_request' },
      { role: 'user', content: 'We\'d need a meeting with all three. Our EA can coordinate schedules.', expectedIntent: 'meeting_coordination' },
      { role: 'user', content: 'Great, loop in our EA at ea@enterprise.com to find a time.', expectedIntent: 'next_steps' },
    ],
    expectedTools: ['update_crm', 'add_stakeholder', 'schedule_meeting'],
    expectedOutcome: 'Agent maps buying committee, identifies deliverables, coordinates meeting',
    difficulty: 'hard',
  },
  {
    id: 'lq-009',
    category: 'lead_qualification',
    name: 'Pricing Objection Handling',
    description: 'Lead interested but pushing back on pricing',
    systemPrompt: `You are a sales agent skilled at handling pricing objections.
WORKFLOW: Step 1 - Call update_crm to log the lead's budget constraints and objections as they share them. Step 2 - When they agree to a deal, call generate_proposal to create a custom pricing proposal with the negotiated terms.
APPROACH: Focus on value and ROI, not just price. Offer creative solutions (startup discounts, annual commitment pricing, phased rollout). Address the objection by showing the cost of NOT solving their problem.
TONE: Empathetic about budget constraints. Collaborative rather than adversarial in negotiation. Make them feel like you're working together to find a solution.`,
    conversationTurns: [
      { role: 'user', content: 'Your product looks great but honestly your pricing page scared me off.', expectedIntent: 'price_objection' },
      { role: 'user', content: 'We\'re a startup with limited runway. Can you work with us on pricing?', expectedIntent: 'budget_constraint' },
      { role: 'user', content: 'We expect to scale to 100 users within 6 months. What if we commit annually?', expectedIntent: 'growth_commitment' },
      { role: 'user', content: 'If you can do the startup discount plus annual billing, we have a deal.', expectedIntent: 'negotiation_close' },
    ],
    expectedTools: ['update_crm', 'generate_proposal'],
    expectedOutcome: 'Agent handles objection with value focus, offers startup pricing, closes',
    difficulty: 'hard',
  },
  {
    id: 'lq-010',
    category: 'lead_qualification',
    name: 'Inbound Demo Request',
    description: 'Warm lead requesting a product demonstration',
    systemPrompt: `You are a demo coordinator qualifying an inbound lead.
WORKFLOW: Step 1 - When the lead shares their role and company, call update_crm to log their info and qualification data. Step 2 - When they provide scheduling availability, call schedule_demo to book the demo session.
DETAILS TO GATHER: Role, company size, specific feature interests, current tools they use, and timeline for decision.
TONE: Welcoming and appreciative of their interest. Tailor the demo pitch to their specific feature needs (campaign automation and analytics).`,
    conversationTurns: [
      { role: 'user', content: 'I\'d like to schedule a demo. I\'ve been reading your blog and I\'m impressed.', expectedIntent: 'demo_request' },
      { role: 'user', content: 'I\'m the Marketing Director at GrowthCo. About 75 people in the company.', expectedIntent: 'role_company' },
      { role: 'user', content: 'We mainly need the campaign automation and analytics features.', expectedIntent: 'feature_focus' },
      { role: 'user', content: 'Next Wednesday afternoon works best. How long is the demo?', expectedIntent: 'scheduling' },
    ],
    expectedTools: ['update_crm', 'schedule_demo'],
    expectedOutcome: 'Agent qualifies lead, identifies key features, schedules targeted demo',
    difficulty: 'easy',
  },
  {
    id: 'lq-011',
    category: 'lead_qualification',
    name: 'Referral Lead',
    description: 'Lead coming through a referral from existing customer',
    systemPrompt: `You are a sales agent handling a referral lead from an existing happy customer.
WORKFLOW: Step 1 - When they mention the referrer (David Martinez from ABC Corp), call lookup_referrer to pull up the referral details and any referral benefits. Step 2 - Call update_crm to log the new lead's qualification data. Step 3 - When they request a demo, call schedule_demo to book it (with the referrer if requested).
APPROACH: Leverage the referral relationship. Acknowledge and appreciate the referrer. Use the referrer's success story as social proof. Note the team size and budget for proper qualification.
TONE: Grateful for the referral. Build on the trust already established through the referrer.`,
    conversationTurns: [
      { role: 'user', content: 'Hi, David Martinez from ABC Corp told me to call you. He loves your product.', expectedIntent: 'referral_intro' },
      { role: 'user', content: 'We have similar needs to ABC Corp. We\'re in the same industry.', expectedIntent: 'similarity_context' },
      { role: 'user', content: 'Our team is smaller though, about 30 people. Budget is around $25K per year.', expectedIntent: 'qualification_data' },
      { role: 'user', content: 'Can David join our demo call? He said he\'d help explain how they use it.', expectedIntent: 'referral_involvement' },
    ],
    expectedTools: ['lookup_referrer', 'update_crm', 'schedule_demo'],
    expectedOutcome: 'Agent leverages referral, qualifies lead, schedules joint demo',
    difficulty: 'medium',
  },
  {
    id: 'lq-012',
    category: 'lead_qualification',
    name: 'Skeptical Technical Buyer',
    description: 'Technical lead who needs proof before proceeding',
    systemPrompt: `You are a technical sales agent addressing a skeptical technical buyer.
WORKFLOW: Step 1 - Call update_crm to log their technical requirements and concerns. Step 2 - When they ask for documentation, call share_documentation to send technical specs, architecture docs, and benchmark data. Step 3 - When they request a proof of concept, call schedule_poc to set up a 2-week trial.
APPROACH: Respond with specific, verifiable data — not marketing language. Share real P95 latency numbers, uptime stats, and architecture details. Be honest about limitations. Technical buyers respect transparency.
TONE: Technical peer, not salesperson. Speak their language. Admit what you don't know and offer to connect them with your engineering team.`,
    conversationTurns: [
      { role: 'user', content: 'I\'ve seen a lot of voice AI tools and most don\'t deliver on their promises. What makes you different?', expectedIntent: 'skepticism' },
      { role: 'user', content: 'What\'s your actual P95 latency? Not marketing numbers, real production data.', expectedIntent: 'technical_challenge' },
      { role: 'user', content: 'Do you support custom model fine-tuning? We have specific domain terminology.', expectedIntent: 'feature_requirement' },
      { role: 'user', content: 'I\'d need to run a proof of concept before recommending this. Can we do a 2-week trial?', expectedIntent: 'poc_request' },
    ],
    expectedTools: ['update_crm', 'share_documentation', 'schedule_poc'],
    expectedOutcome: 'Agent addresses technical skepticism with data, arranges POC trial',
    difficulty: 'hard',
  },
  {
    id: 'lq-013',
    category: 'lead_qualification',
    name: 'Cold Call - Generating Interest',
    description: 'Outbound cold call to a prospect',
    systemPrompt: `You are making an outbound cold call to a prospect.
WORKFLOW: Call update_crm to log the prospect's contact info (email) and interest level as soon as they share any details.
APPROACH: Open with a brief, compelling hook. When they ask how you compare to competitors, focus on specific differentiators (latency, reliability, customization). When they offer their email, that's a win — log it immediately and confirm next steps.
TONE: Respectful of their time. Concise and direct. Not pushy — if they're busy, offer to follow up at a better time.`,
    conversationTurns: [
      { role: 'user', content: 'Who is this? I\'m busy.', expectedIntent: 'cold_resistance' },
      { role: 'user', content: 'We actually just had a conversation about AI tools yesterday. What do you offer?', expectedIntent: 'opening_interest' },
      { role: 'user', content: 'How is this different from what Retell offers?', expectedIntent: 'competitor_comparison' },
      { role: 'user', content: 'Interesting. Send me some info and I\'ll take a look. My email is prospect@company.com.', expectedIntent: 'soft_commitment' },
    ],
    expectedTools: ['update_crm'],
    expectedOutcome: 'Agent generates interest from cold contact, secures email follow-up',
    difficulty: 'hard',
  },
];

export const ALL_SCENARIOS: CallScenario[] = [
  ...CUSTOMER_SUPPORT_SCENARIOS,
  ...APPOINTMENT_BOOKING_SCENARIOS,
  ...LEAD_QUALIFICATION_SCENARIOS,
];

export function getScenariosByCategory(category: CallScenario['category']): CallScenario[] {
  return ALL_SCENARIOS.filter(s => s.category === category);
}

export function getScenarioById(id: string): CallScenario | undefined {
  return ALL_SCENARIOS.find(s => s.id === id);
}

export function getScenarioStats() {
  return {
    total: ALL_SCENARIOS.length,
    byCategory: {
      customer_support: CUSTOMER_SUPPORT_SCENARIOS.length,
      appointment_booking: APPOINTMENT_BOOKING_SCENARIOS.length,
      lead_qualification: LEAD_QUALIFICATION_SCENARIOS.length,
    },
    byDifficulty: {
      easy: ALL_SCENARIOS.filter(s => s.difficulty === 'easy').length,
      medium: ALL_SCENARIOS.filter(s => s.difficulty === 'medium').length,
      hard: ALL_SCENARIOS.filter(s => s.difficulty === 'hard').length,
    },
  };
}
