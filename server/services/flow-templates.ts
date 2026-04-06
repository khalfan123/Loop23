/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
// Predefined flow templates that users can clone
// Each template has proper node structure with data.type, data.label, and data.config

export const flowTemplates = [
  // ============================================
  // Template 1: Lead Qualification
  // ============================================
  {
    id: "template-lead-qualification",
    name: "Lead Qualification",
    description: "Qualify leads by asking about budget, timeline, and decision-making authority. Automatically routes qualified leads for follow-up.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi! I'm calling to learn more about your business needs and see if our solutions might be a good fit. This will only take a few minutes. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-company",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Company Name",
          config: {
            type: "question",
            question: "Great! To get started, could you tell me the name of your company?",
            variableName: "company_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-role",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Role/Position",
          config: {
            type: "question",
            question: "And what's your role at the company?",
            variableName: "contact_role",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-budget",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Budget Range",
          config: {
            type: "question",
            question: "What's your approximate budget for this type of solution? Just a ballpark figure is fine.",
            variableName: "budget_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-timeline",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Timeline",
          config: {
            type: "question",
            question: "When are you looking to implement a solution - in the next month, quarter, or is this for future planning?",
            variableName: "timeline",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-authority",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Decision Authority",
          config: {
            type: "question",
            question: "Are you the primary decision-maker for this purchase, or will others be involved in the decision?",
            variableName: "decision_authority",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-qualified",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Check Qualification",
          config: {
            type: "condition",
            condition: "The lead has a budget above $5000 and timeline within 3 months",
          },
        },
      },
      {
        id: "node-qualified-webhook",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Send to CRM",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "qualified", priority: "high" },
            description: "Send qualified lead to CRM for immediate follow-up",
          },
        },
      },
      {
        id: "node-qualified-end",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Qualified Goodbye",
          config: {
            type: "end",
            endMessage: "Love it! Based on what you've told me, I think we've got some really good options for you. Our sales team will reach out within twenty-four hours to set up a demo. Thanks for your time!",
          },
        },
      },
      {
        id: "node-nurture-webhook",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Add to Nurture",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "nurture", priority: "normal" },
            description: "Add lead to nurture campaign for future follow-up",
          },
        },
      },
      {
        id: "node-nurture-end",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Nurture Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. We'll keep you on our list and reach out when we have updates that might interest you. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-company" },
      { id: "e2", source: "node-ask-company", target: "node-ask-role" },
      { id: "e3", source: "node-ask-role", target: "node-ask-budget" },
      { id: "e4", source: "node-ask-budget", target: "node-ask-timeline" },
      { id: "e5", source: "node-ask-timeline", target: "node-ask-authority" },
      { id: "e6", source: "node-ask-authority", target: "node-check-qualified" },
      { id: "e7", source: "node-check-qualified", sourceHandle: "true", target: "node-qualified-webhook" },
      { id: "e8", source: "node-check-qualified", sourceHandle: "false", target: "node-nurture-webhook" },
      { id: "e9", source: "node-qualified-webhook", target: "node-qualified-end" },
      { id: "e10", source: "node-nurture-webhook", target: "node-nurture-end" },
    ],
  },

  // ============================================
  // Template 2: Appointment Booking
  // ============================================
  {
    id: "template-appointment-booking",
    name: "Appointment Booking",
    description: "Schedule appointments with service selection, date/time collection, and automatic confirmation. Perfect for service businesses.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hi! Thank you for calling. I'd be happy to help you schedule an appointment. Let me collect a few details to find the best time for you.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name please?",
            variableName: "full_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-phone",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Phone Number",
          config: {
            type: "question",
            question: "And what's the best phone number to reach you?",
            variableName: "phone_number",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-service",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Service Type",
          config: {
            type: "question",
            question: "Which service are you interested in? We offer Consultation, Demo, Technical Support, or Training sessions.",
            variableName: "service_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-appointment",
        type: "appointment",
        position: { x: 250, y: 530 },
        data: {
          type: "appointment",
          label: "Book Appointment",
          config: {
            type: "appointment",
            appointmentType: "General Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm",
        type: "message",
        position: { x: 250, y: 650 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Perfect! Your appointment has been confirmed. You'll receive a confirmation email and SMS reminder before your appointment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-webhook-notify",
        type: "webhook",
        position: { x: 250, y: 770 },
        data: {
          type: "webhook",
          label: "Notify Team",
          config: {
            type: "webhook",
            url: "https://your-calendar-api.com/appointments",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { event: "appointment_booked" },
            description: "Notify team about new appointment",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 890 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for scheduling with us! We look forward to seeing you. Is there anything else I can help you with today? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-phone" },
      { id: "e3", source: "node-ask-phone", target: "node-ask-service" },
      { id: "e4", source: "node-ask-service", target: "node-book-appointment" },
      { id: "e5", source: "node-book-appointment", target: "node-confirm" },
      { id: "e6", source: "node-confirm", target: "node-webhook-notify" },
      { id: "e7", source: "node-webhook-notify", target: "node-end" },
    ],
  },

  // ============================================
  // Template 3: Customer Satisfaction Survey (NPS)
  // ============================================
  {
    id: "template-nps-survey",
    name: "Customer Satisfaction Survey (NPS)",
    description: "Collect Net Promoter Score and detailed feedback. Routes promoters to testimonial requests and detractors to resolution paths.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! I'm calling from the customer success team. We'd love to hear about your recent experience with our service. This quick survey takes less than 2 minutes. Do you have a moment?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-nps-score",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "NPS Score",
          config: {
            type: "question",
            question: "On a scale of 0 to 10, how likely are you to recommend our service to a friend or colleague?",
            variableName: "nps_score",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Reason",
          config: {
            type: "question",
            question: "Thank you! Could you briefly share the main reason for your score?",
            variableName: "nps_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-promoter",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Check Score",
          config: {
            type: "condition",
            condition: "The NPS score is 9 or 10 (promoter)",
          },
        },
      },
      {
        id: "node-ask-testimonial",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Request Testimonial",
          config: {
            type: "question",
            question: "We're so glad to hear that! Would you be willing to provide a brief testimonial we could share on our website?",
            variableName: "testimonial_consent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-promoter-webhook",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Log Promoter",
          config: {
            type: "webhook",
            url: "https://your-crm.com/feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "promoter", request_testimonial: true },
            description: "Log promoter feedback and testimonial request",
          },
        },
      },
      {
        id: "node-ask-improvement",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Improvement Ideas",
          config: {
            type: "question",
            question: "We appreciate your honest feedback. What's one thing we could improve to make your experience better?",
            variableName: "improvement_suggestion",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-callback",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Offer Callback",
          config: {
            type: "question",
            question: "Would you like a member of our support team to follow up with you about your concerns?",
            variableName: "callback_requested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-detractor-webhook",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Log Detractor",
          config: {
            type: "webhook",
            url: "https://your-crm.com/feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "detractor", priority: "high" },
            description: "Log detractor feedback for follow-up",
          },
        },
      },
      {
        id: "node-promoter-end",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Thank Promoter",
          config: {
            type: "end",
            endMessage: "Thank you so much for your kind feedback and support! We truly appreciate customers like you. Have a wonderful day!",
          },
        },
      },
      {
        id: "node-detractor-end",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Thank Detractor",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to share your feedback. We're committed to improving and will work on addressing your concerns. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-nps-score" },
      { id: "e2", source: "node-nps-score", target: "node-ask-reason" },
      { id: "e3", source: "node-ask-reason", target: "node-check-promoter" },
      { id: "e4", source: "node-check-promoter", sourceHandle: "true", target: "node-ask-testimonial" },
      { id: "e5", source: "node-check-promoter", sourceHandle: "false", target: "node-ask-improvement" },
      { id: "e6", source: "node-ask-testimonial", target: "node-promoter-webhook" },
      { id: "e7", source: "node-promoter-webhook", target: "node-promoter-end" },
      { id: "e8", source: "node-ask-improvement", target: "node-offer-callback" },
      { id: "e9", source: "node-offer-callback", target: "node-detractor-webhook" },
      { id: "e10", source: "node-detractor-webhook", target: "node-detractor-end" },
    ],
  },

  // ============================================
  // Template 4: Order Placement
  // ============================================
  {
    id: "template-order-placement",
    name: "Order Placement",
    description: "Collect order details including product, quantity, and shipping information. Sends order data to your backend via webhook.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! Welcome to our ordering service. I'm here to help you place an order today. Let me collect a few details to process your order.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-product",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Product Name",
          config: {
            type: "question",
            question: "What product would you like to order?",
            variableName: "product_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-quantity",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Quantity",
          config: {
            type: "question",
            question: "How many units would you like to order?",
            variableName: "quantity",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-address",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Delivery Address",
          config: {
            type: "question",
            question: "What is your delivery address including city and zip code?",
            variableName: "delivery_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "What email address should we send the order confirmation to?",
            variableName: "customer_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-processing",
        type: "message",
        position: { x: 250, y: 650 },
        data: {
          type: "message",
          label: "Processing",
          config: {
            type: "message",
            message: "Thank you! I'm now processing your order. Please hold for just a moment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-order",
        type: "webhook",
        position: { x: 250, y: 770 },
        data: {
          type: "webhook",
          label: "Submit Order",
          config: {
            type: "webhook",
            url: "https://your-order-api.com/orders",
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": "your-api-key" },
            payload: { source: "phone_order" },
            description: "Submit order to backend. Automatically includes caller_phone, product, quantity, address, email, and conversation data.",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 890 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Great news! Your order has been successfully submitted. You will receive a confirmation email shortly with your order details and tracking information.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1010 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your order! Is there anything else I can help you with today? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-product" },
      { id: "e2", source: "node-ask-product", target: "node-ask-quantity" },
      { id: "e3", source: "node-ask-quantity", target: "node-ask-address" },
      { id: "e4", source: "node-ask-address", target: "node-ask-email" },
      { id: "e5", source: "node-ask-email", target: "node-processing" },
      { id: "e6", source: "node-processing", target: "node-submit-order" },
      { id: "e7", source: "node-submit-order", target: "node-confirmation" },
      { id: "e8", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template 5: Call Transfer
  // ============================================
  {
    id: "template-call-transfer",
    name: "Call Transfer / Receptionist",
    description: "Greet callers, identify their needs, and route to the appropriate department or person. Includes fallback to voicemail.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Reception Greeting",
          config: {
            type: "message",
            message: "Good day! Thank you for calling. How may I direct your call today?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-department",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Department",
          config: {
            type: "question",
            question: "Which department would you like to reach? We have Sales, Support, Billing, or you can ask for a specific person.",
            variableName: "requested_department",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-sales",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Is Sales?",
          config: {
            type: "condition",
            condition: "The caller wants to reach Sales or is asking about purchasing, pricing, or products",
          },
        },
      },
      {
        id: "node-transfer-sales",
        type: "transfer",
        position: { x: 50, y: 410 },
        data: {
          type: "transfer",
          label: "Transfer to Sales",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "I'll transfer you to our Sales team right away. Please hold.",
          },
        },
      },
      {
        id: "node-check-support",
        type: "condition",
        position: { x: 450, y: 410 },
        data: {
          type: "condition",
          label: "Is Support?",
          config: {
            type: "condition",
            condition: "The caller wants to reach Support or is asking for help with a technical issue",
          },
        },
      },
      {
        id: "node-transfer-support",
        type: "transfer",
        position: { x: 300, y: 530 },
        data: {
          type: "transfer",
          label: "Transfer to Support",
          config: {
            type: "transfer",
            transferNumber: "+1234567891",
            message: "I'll connect you with our Support team. One moment please.",
          },
        },
      },
      {
        id: "node-check-billing",
        type: "condition",
        position: { x: 600, y: 530 },
        data: {
          type: "condition",
          label: "Is Billing?",
          config: {
            type: "condition",
            condition: "The caller wants to reach Billing or is asking about invoices, payments, or accounts",
          },
        },
      },
      {
        id: "node-transfer-billing",
        type: "transfer",
        position: { x: 500, y: 650 },
        data: {
          type: "transfer",
          label: "Transfer to Billing",
          config: {
            type: "transfer",
            transferNumber: "+1234567892",
            message: "I'll transfer you to our Billing department. Please hold.",
          },
        },
      },
      {
        id: "node-take-message",
        type: "question",
        position: { x: 700, y: 650 },
        data: {
          type: "question",
          label: "Take Message",
          config: {
            type: "question",
            question: "I couldn't identify the right department for your request. Can I take a message and have someone call you back?",
            variableName: "callback_message",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-message",
        type: "webhook",
        position: { x: 700, y: 770 },
        data: {
          type: "webhook",
          label: "Log Message",
          config: {
            type: "webhook",
            url: "https://your-api.com/messages",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "callback_request" },
            description: "Log callback message request",
          },
        },
      },
      {
        id: "node-end-transfer",
        type: "end",
        position: { x: 175, y: 530 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "Thank you for calling. Your call is being transferred now.",
          },
        },
      },
      {
        id: "node-end-message",
        type: "end",
        position: { x: 700, y: 890 },
        data: {
          type: "end",
          label: "Message Taken",
          config: {
            type: "end",
            endMessage: "Thank you! We've recorded your message and someone will get back to you within 24 hours. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-department" },
      { id: "e2", source: "node-ask-department", target: "node-check-sales" },
      { id: "e3", source: "node-check-sales", sourceHandle: "true", target: "node-transfer-sales" },
      { id: "e4", source: "node-check-sales", sourceHandle: "false", target: "node-check-support" },
      { id: "e5", source: "node-transfer-sales", target: "node-end-transfer" },
      { id: "e6", source: "node-check-support", sourceHandle: "true", target: "node-transfer-support" },
      { id: "e7", source: "node-check-support", sourceHandle: "false", target: "node-check-billing" },
      { id: "e8", source: "node-transfer-support", target: "node-end-transfer" },
      { id: "e9", source: "node-check-billing", sourceHandle: "true", target: "node-transfer-billing" },
      { id: "e10", source: "node-check-billing", sourceHandle: "false", target: "node-take-message" },
      { id: "e11", source: "node-transfer-billing", target: "node-end-transfer" },
      { id: "e12", source: "node-take-message", target: "node-log-message" },
      { id: "e13", source: "node-log-message", target: "node-end-message" },
    ],
  },

  // ============================================
  // Template 6: Event Registration
  // ============================================
  {
    id: "template-event-registration",
    name: "Event Registration",
    description: "Register attendees for events, collect dietary preferences and accessibility needs, and send confirmation.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Event Welcome",
          config: {
            type: "message",
            message: "Hi! Thank you for your interest in our upcoming event. I'd be happy to help you register. This will only take a couple of minutes.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name for the registration?",
            variableName: "attendee_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Email",
          config: {
            type: "question",
            question: "What email address should we send your confirmation and event details to?",
            variableName: "attendee_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-company",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Company",
          config: {
            type: "question",
            question: "Which company or organization are you representing?",
            variableName: "company_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-dietary",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Dietary Preferences",
          config: {
            type: "question",
            question: "Do you have any dietary restrictions or preferences we should know about? For example, vegetarian, vegan, gluten-free, or any allergies?",
            variableName: "dietary_restrictions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-accessibility",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Accessibility Needs",
          config: {
            type: "question",
            question: "Do you require any accessibility accommodations?",
            variableName: "accessibility_needs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-register-webhook",
        type: "webhook",
        position: { x: 250, y: 770 },
        data: {
          type: "webhook",
          label: "Register Attendee",
          config: {
            type: "webhook",
            url: "https://your-events-api.com/registrations",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { event_id: "your-event-id", source: "phone" },
            description: "Register attendee in event system",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 890 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "You're all set! You'll get a confirmation email with all the event details — venue, agenda, parking, everything.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1010 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for registering! We look forward to seeing you at the event. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-email" },
      { id: "e3", source: "node-ask-email", target: "node-ask-company" },
      { id: "e4", source: "node-ask-company", target: "node-ask-dietary" },
      { id: "e5", source: "node-ask-dietary", target: "node-ask-accessibility" },
      { id: "e6", source: "node-ask-accessibility", target: "node-register-webhook" },
      { id: "e7", source: "node-register-webhook", target: "node-confirmation" },
      { id: "e8", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template 7: Payment Reminder
  // ============================================
  {
    id: "template-payment-reminder",
    name: "Payment Reminder",
    description: "Remind customers about overdue payments, offer payment options, and route to billing support if needed.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! This is a courtesy call from the billing department regarding your account. We noticed there's an outstanding balance. Is this a good time to discuss your payment options?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For security purposes, may I please verify the last 4 digits of your phone number on file?",
            variableName: "phone_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-balance",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Balance Info",
          config: {
            type: "message",
            message: "Thank you for confirming. According to our records, your current balance is due. Would you like to make a payment today or discuss payment options?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-payment",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Payment Decision",
          config: {
            type: "question",
            question: "Would you like to pay the full balance today, set up a payment plan, or speak with a billing specialist?",
            variableName: "payment_choice",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-fullpay",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Full Payment?",
          config: {
            type: "condition",
            condition: "The customer wants to pay the full balance today",
          },
        },
      },
      {
        id: "node-collect-payment",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Payment Link",
          config: {
            type: "message",
            message: "Perfect! I'll send you a secure payment link via text message right now. You can complete the payment at your convenience within the next 24 hours.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-send-link-webhook",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Send Payment Link",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/send-payment-link",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_payment_link" },
            description: "Send secure payment link to customer",
          },
        },
      },
      {
        id: "node-check-plan",
        type: "condition",
        position: { x: 450, y: 650 },
        data: {
          type: "condition",
          label: "Payment Plan?",
          config: {
            type: "condition",
            condition: "The customer wants to set up a payment plan",
          },
        },
      },
      {
        id: "node-plan-details",
        type: "question",
        position: { x: 300, y: 770 },
        data: {
          type: "question",
          label: "Plan Preference",
          config: {
            type: "question",
            question: "We can split the balance into 2, 3, or 4 monthly payments. Which option works best for you?",
            variableName: "payment_plan_months",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-plan-webhook",
        type: "webhook",
        position: { x: 300, y: 890 },
        data: {
          type: "webhook",
          label: "Create Plan",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/payment-plans",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "create_payment_plan" },
            description: "Create payment plan in billing system",
          },
        },
      },
      {
        id: "node-transfer-billing",
        type: "transfer",
        position: { x: 550, y: 770 },
        data: {
          type: "transfer",
          label: "Transfer to Billing",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "I'll connect you with a billing specialist who can help with your specific situation. Please hold.",
          },
        },
      },
      {
        id: "node-end-payment",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Payment Link Sent",
          config: {
            type: "end",
            endMessage: "The payment link has been sent to your phone. Thank you for taking care of this. Have a great day!",
          },
        },
      },
      {
        id: "node-end-plan",
        type: "end",
        position: { x: 300, y: 1010 },
        data: {
          type: "end",
          label: "Plan Created",
          config: {
            type: "end",
            endMessage: "Your payment plan has been set up. You'll receive confirmation details via email. Thank you for working with us!",
          },
        },
      },
      {
        id: "node-end-transfer",
        type: "end",
        position: { x: 550, y: 890 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "Transferring you now. Thank you for your patience.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-explain-balance" },
      { id: "e3", source: "node-explain-balance", target: "node-ask-payment" },
      { id: "e4", source: "node-ask-payment", target: "node-check-fullpay" },
      { id: "e5", source: "node-check-fullpay", sourceHandle: "true", target: "node-collect-payment" },
      { id: "e6", source: "node-check-fullpay", sourceHandle: "false", target: "node-check-plan" },
      { id: "e7", source: "node-collect-payment", target: "node-send-link-webhook" },
      { id: "e8", source: "node-send-link-webhook", target: "node-end-payment" },
      { id: "e9", source: "node-check-plan", sourceHandle: "true", target: "node-plan-details" },
      { id: "e10", source: "node-check-plan", sourceHandle: "false", target: "node-transfer-billing" },
      { id: "e11", source: "node-plan-details", target: "node-plan-webhook" },
      { id: "e12", source: "node-plan-webhook", target: "node-end-plan" },
      { id: "e13", source: "node-transfer-billing", target: "node-end-transfer" },
    ],
  },

  // ============================================
  // Template 8: Simple Data Collection Form
  // ============================================
  {
    id: "template-data-collection",
    name: "Data Collection Form",
    description: "Collect structured data from callers using a form. Perfect for registrations, applications, or information gathering.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! Thank you for calling. I'll need to collect some information from you. This should only take a few minutes.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-collect-form",
        type: "form",
        position: { x: 250, y: 170 },
        data: {
          type: "form",
          label: "Collect Information",
          config: {
            type: "form",
            formId: null,
            message: "I'll ask you a few questions now. Please answer each one clearly.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-review",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Review Info",
          config: {
            type: "message",
            message: "Thank you for providing that information. Let me review what we collected.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 410 },
        data: {
          type: "webhook",
          label: "Submit Data",
          config: {
            type: "webhook",
            url: "https://your-api.com/submissions",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { source: "phone_form" },
            description: "Submit collected form data to backend",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 530 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "All your information has been recorded successfully. You'll receive a confirmation email shortly.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 650 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. Is there anything else I can help you with? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-collect-form" },
      { id: "e2", source: "node-collect-form", target: "node-review" },
      { id: "e3", source: "node-review", target: "node-submit-webhook" },
      { id: "e4", source: "node-submit-webhook", target: "node-confirmation" },
      { id: "e5", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // OUTBOUND SALES & LEAD GENERATION TEMPLATES
  // ============================================

  // Template 9: Cold Call Introduction
  {
    id: "template-cold-call-intro",
    name: "Cold Call Introduction",
    description: "Professional cold call script that introduces your company, identifies pain points, and qualifies interest before scheduling a follow-up.",
    isTemplate: true,
    nodes: [
      {
        id: "node-intro",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi, this is {agent_name} calling from {company_name}. I'm reaching out to businesses like yours that may be looking to improve their {pain_point_area}. Do you have just 2 minutes to chat?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 170 },
        data: {
          type: "condition",
          label: "Check Interest",
          config: {
            type: "condition",
            condition: "The prospect agreed to continue the conversation",
          },
        },
      },
      {
        id: "node-pain-point",
        type: "question",
        position: { x: 450, y: 290 },
        data: {
          type: "question",
          label: "Identify Pain Point",
          config: {
            type: "question",
            question: "What's your biggest challenge right now when it comes to {pain_point_area}?",
            variableName: "pain_point",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-value-prop",
        type: "message",
        position: { x: 450, y: 410 },
        data: {
          type: "message",
          label: "Value Proposition",
          config: {
            type: "message",
            message: "I understand. Many of our clients faced similar challenges before working with us. We've helped them achieve {key_benefit}. Would you be interested in learning how we could do the same for you?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-schedule-call",
        type: "appointment",
        position: { x: 450, y: 530 },
        data: {
          type: "appointment",
          label: "Schedule Follow-up",
          config: {
            type: "appointment",
            appointmentType: "Discovery Call",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-capture-webhook",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Log Lead",
          config: {
            type: "webhook",
            url: "https://your-crm.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { source: "cold_call", status: "interested" },
            description: "Log interested lead to CRM",
          },
        },
      },
      {
        id: "node-end-interested",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Positive Goodbye",
          config: {
            type: "end",
            endMessage: "You're all set! You'll get a calendar invite shortly. Looking forward to chatting then. Have a great day!",
          },
        },
      },
      {
        id: "node-not-interested",
        type: "question",
        position: { x: 50, y: 290 },
        data: {
          type: "question",
          label: "Understand Objection",
          config: {
            type: "question",
            question: "I completely understand. Just so I know for next time, is it the timing that doesn't work, or is this not a priority for you right now?",
            variableName: "objection_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-declined",
        type: "webhook",
        position: { x: 50, y: 410 },
        data: {
          type: "webhook",
          label: "Log Declined",
          config: {
            type: "webhook",
            url: "https://your-crm.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { source: "cold_call", status: "not_interested" },
            description: "Log declined lead for future nurturing",
          },
        },
      },
      {
        id: "node-end-declined",
        type: "end",
        position: { x: 50, y: 530 },
        data: {
          type: "end",
          label: "Polite Goodbye",
          config: {
            type: "end",
            endMessage: "No problem at all. Thank you for your time today. If things change, feel free to reach out. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-intro", target: "node-check-interest" },
      { id: "e2", source: "node-check-interest", sourceHandle: "true", target: "node-pain-point" },
      { id: "e3", source: "node-check-interest", sourceHandle: "false", target: "node-not-interested" },
      { id: "e4", source: "node-pain-point", target: "node-value-prop" },
      { id: "e5", source: "node-value-prop", target: "node-schedule-call" },
      { id: "e6", source: "node-schedule-call", target: "node-capture-webhook" },
      { id: "e7", source: "node-capture-webhook", target: "node-end-interested" },
      { id: "e8", source: "node-not-interested", target: "node-log-declined" },
      { id: "e9", source: "node-log-declined", target: "node-end-declined" },
    ],
  },

  // Template 10: Product Demo Scheduling
  {
    id: "template-demo-scheduling",
    name: "Product Demo Scheduling",
    description: "Qualify prospects and schedule personalized product demonstrations with the right team members.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi! I'm calling to follow up on your interest in {product_name}. We'd love to show you a personalized demo. Is now a good time to schedule that?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-role",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Role",
          config: {
            type: "question",
            question: "To personalize the demo, could you tell me your role and which features you're most interested in seeing?",
            variableName: "role_and_interests",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-team-size",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Team Size",
          config: {
            type: "question",
            question: "How large is your team that would be using this solution?",
            variableName: "team_size",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-attendees",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Attendees",
          config: {
            type: "question",
            question: "Will any other decision-makers or team members be joining the demo?",
            variableName: "additional_attendees",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-schedule-demo",
        type: "appointment",
        position: { x: 250, y: 530 },
        data: {
          type: "appointment",
          label: "Schedule Demo",
          config: {
            type: "appointment",
            appointmentType: "Product Demo",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook",
        type: "webhook",
        position: { x: 250, y: 650 },
        data: {
          type: "webhook",
          label: "Create Demo Request",
          config: {
            type: "webhook",
            url: "https://your-crm.com/demos",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "demo_scheduled" },
            description: "Create demo request with attendee details",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 770 },
        data: {
          type: "end",
          label: "Confirmation",
          config: {
            type: "end",
            endMessage: "You're all set. You'll receive a calendar invite with the demo link shortly. We'll tailor the demo specifically to your needs. Looking forward to it!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-role" },
      { id: "e2", source: "node-ask-role", target: "node-ask-team-size" },
      { id: "e3", source: "node-ask-team-size", target: "node-ask-attendees" },
      { id: "e4", source: "node-ask-attendees", target: "node-schedule-demo" },
      { id: "e5", source: "node-schedule-demo", target: "node-webhook" },
      { id: "e6", source: "node-webhook", target: "node-end" },
    ],
  },

  // Template 11: Upsell Cross-sell Campaign
  {
    id: "template-upsell-crosssell",
    name: "Upsell Cross-sell Campaign",
    description: "Contact existing customers to offer upgrades, add-ons, or complementary products based on their usage patterns.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. I'm calling because I noticed you've been getting great use out of {current_product}. I wanted to share some options that could help you even more.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-usage-check",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Usage Satisfaction",
          config: {
            type: "question",
            question: "First, how has your experience been with {current_product}? Are there any features you wish you had?",
            variableName: "usage_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-present-offer",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Present Offer",
          config: {
            type: "message",
            message: "Based on what you've shared, I think {upgrade_product} would be perfect for you. It includes {key_features} and our customers typically see {benefit}. Would you like to hear more about it?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer expressed interest in learning more",
          },
        },
      },
      {
        id: "node-pricing",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Pricing Details",
          config: {
            type: "message",
            message: "The upgrade is just {price_difference} more per month, and as an existing customer, we're offering a {discount}% discount for the first 3 months. Would you like me to apply this upgrade to your account?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-upgrade",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Confirm Upgrade",
          config: {
            type: "question",
            question: "Should I go ahead and process this upgrade for you today?",
            variableName: "upgrade_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-webhook",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Process Upgrade",
          config: {
            type: "webhook",
            url: "https://your-billing.com/upgrades",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "process_upgrade" },
            description: "Process the account upgrade",
          },
        },
      },
      {
        id: "node-end-upgraded",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Upgrade Complete",
          config: {
            type: "end",
            endMessage: "Done! Your upgrade's all processed. You'll get a confirmation email with everything about your new features. Thanks so much!",
          },
        },
      },
      {
        id: "node-maybe-later",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Follow-up Later",
          config: {
            type: "message",
            message: "No problem! I'll send you an email with the details so you can review when you have time. Is there anything else I can help you with today?",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-log-followup",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Follow-up",
          config: {
            type: "webhook",
            url: "https://your-crm.com/followups",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "upsell_followup" },
            description: "Schedule follow-up for later",
          },
        },
      },
      {
        id: "node-end-followup",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. Feel free to reach out if you have any questions about the upgrade offer. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-usage-check" },
      { id: "e2", source: "node-usage-check", target: "node-present-offer" },
      { id: "e3", source: "node-present-offer", target: "node-check-interest" },
      { id: "e4", source: "node-check-interest", sourceHandle: "true", target: "node-pricing" },
      { id: "e5", source: "node-check-interest", sourceHandle: "false", target: "node-maybe-later" },
      { id: "e6", source: "node-pricing", target: "node-confirm-upgrade" },
      { id: "e7", source: "node-confirm-upgrade", target: "node-process-webhook" },
      { id: "e8", source: "node-process-webhook", target: "node-end-upgraded" },
      { id: "e9", source: "node-maybe-later", target: "node-log-followup" },
      { id: "e10", source: "node-log-followup", target: "node-end-followup" },
    ],
  },

  // Template 12: Win-back Campaign
  {
    id: "template-win-back",
    name: "Win-back Campaign",
    description: "Re-engage churned customers with special offers and address their previous concerns to bring them back.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}, this is {agent_name} from {company_name}. We noticed you haven't used our service in a while, and we wanted to reach out because we miss having you as a customer. Do you have a moment?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-understand-reason",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Understand Reason",
          config: {
            type: "question",
            question: "We'd love to understand what led you to stop using our service. Was there something specific that didn't meet your expectations?",
            variableName: "churn_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-address-concern",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Address Concern",
          config: {
            type: "message",
            message: "I really appreciate you sharing that. I want you to know we've made significant improvements since then, including {improvements}. We've specifically addressed feedback like yours.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-special-offer",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Special Offer",
          config: {
            type: "message",
            message: "As a thank you for considering us again, we'd like to offer you {win_back_offer}. This is exclusively for valued former customers like yourself. Would you be interested in giving us another try?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer is interested in returning",
          },
        },
      },
      {
        id: "node-reactivate",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Reactivate Account",
          config: {
            type: "webhook",
            url: "https://your-api.com/reactivate",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "reactivate", offer_applied: true },
            description: "Reactivate customer account with special offer",
          },
        },
      },
      {
        id: "node-end-returned",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Welcome Back",
          config: {
            type: "end",
            endMessage: "Welcome back! Your account has been reactivated with the special offer applied. You'll receive a confirmation email shortly. We're thrilled to have you back!",
          },
        },
      },
      {
        id: "node-note-feedback",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Feedback",
          config: {
            type: "webhook",
            url: "https://your-crm.com/feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "winback_declined" },
            description: "Log churn feedback for analysis",
          },
        },
      },
      {
        id: "node-end-declined",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Respectful Goodbye",
          config: {
            type: "end",
            endMessage: "I completely understand. Thank you for taking the time to speak with me today. If anything changes in the future, we'd love to welcome you back. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-understand-reason" },
      { id: "e2", source: "node-understand-reason", target: "node-address-concern" },
      { id: "e3", source: "node-address-concern", target: "node-special-offer" },
      { id: "e4", source: "node-special-offer", target: "node-check-interest" },
      { id: "e5", source: "node-check-interest", sourceHandle: "true", target: "node-reactivate" },
      { id: "e6", source: "node-check-interest", sourceHandle: "false", target: "node-note-feedback" },
      { id: "e7", source: "node-reactivate", target: "node-end-returned" },
      { id: "e8", source: "node-note-feedback", target: "node-end-declined" },
    ],
  },

  // Template 13: Referral Request
  {
    id: "template-referral-request",
    name: "Referral Request",
    description: "Ask satisfied customers for referrals with incentives for both the referrer and the new customer.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. I'm calling because you've been such a valued customer, and I wanted to thank you for your loyalty.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-satisfaction",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Check Satisfaction",
          config: {
            type: "question",
            question: "Quick question - how has your experience been with us so far?",
            variableName: "satisfaction_level",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-referral-ask",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Referral Ask",
          config: {
            type: "message",
            message: "That's wonderful to hear! We're always looking to help more people like you. Do you know anyone who might benefit from our services? For every successful referral, you'll receive {referral_reward} and your friend gets {friend_reward}.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-referral",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Has Referral?",
          config: {
            type: "condition",
            condition: "The customer has someone to refer",
          },
        },
      },
      {
        id: "node-collect-referral",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Referral Details",
          config: {
            type: "question",
            question: "That's great! Could you share their name and the best way to reach them - phone or email?",
            variableName: "referral_contact",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-referral",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Log Referral",
          config: {
            type: "webhook",
            url: "https://your-crm.com/referrals",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "new_referral" },
            description: "Create referral in CRM",
          },
        },
      },
      {
        id: "node-end-referral",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Thank Referrer",
          config: {
            type: "end",
            endMessage: "Thank you so much! We'll reach out to them and make sure to mention you referred them. Your reward will be applied once they sign up. We really appreciate your support!",
          },
        },
      },
      {
        id: "node-no-referral",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "No Problem",
          config: {
            type: "message",
            message: "No problem at all! If anyone comes to mind later, just let us know. We'll send you an email with your unique referral link that you can share anytime.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-send-link",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Send Referral Link",
          config: {
            type: "webhook",
            url: "https://your-api.com/send-referral-link",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_referral_link" },
            description: "Send personalized referral link via email",
          },
        },
      },
      {
        id: "node-end-link-sent",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. Check your email for the referral link. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-check-satisfaction" },
      { id: "e2", source: "node-check-satisfaction", target: "node-referral-ask" },
      { id: "e3", source: "node-referral-ask", target: "node-check-referral" },
      { id: "e4", source: "node-check-referral", sourceHandle: "true", target: "node-collect-referral" },
      { id: "e5", source: "node-check-referral", sourceHandle: "false", target: "node-no-referral" },
      { id: "e6", source: "node-collect-referral", target: "node-log-referral" },
      { id: "e7", source: "node-log-referral", target: "node-end-referral" },
      { id: "e8", source: "node-no-referral", target: "node-send-link" },
      { id: "e9", source: "node-send-link", target: "node-end-link-sent" },
    ],
  },

  // Template 14: Pricing Discussion
  {
    id: "template-pricing-discussion",
    name: "Pricing Discussion",
    description: "Discuss pricing options with prospects, handle objections, and offer appropriate packages based on their needs.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {prospect_name}! This is {agent_name} from {company_name}. I understand you had some questions about our pricing. I'd be happy to walk you through our options.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-understand-needs",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Understand Needs",
          config: {
            type: "question",
            question: "To recommend the best option for you, could you tell me a bit about what you're looking to achieve and your team size?",
            variableName: "business_needs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-present-options",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Present Options",
          config: {
            type: "message",
            message: "Based on what you've shared, I'd recommend our {recommended_plan}. It includes {key_features} and is priced at {price}. We also have options at different price points if you'd like to hear about those.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-budget",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Budget Check",
          config: {
            type: "question",
            question: "Does this align with the budget you had in mind?",
            variableName: "budget_fit",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-budget",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Budget Fits?",
          config: {
            type: "condition",
            condition: "The pricing fits within their budget",
          },
        },
      },
      {
        id: "node-proceed-sale",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Ready to Proceed",
          config: {
            type: "question",
            question: "Would you like to get started today? I can help set up your account right now.",
            variableName: "ready_to_buy",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-create-account",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Create Account",
          config: {
            type: "webhook",
            url: "https://your-api.com/create-account",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { source: "phone_sale" },
            description: "Create new customer account",
          },
        },
      },
      {
        id: "node-end-sale",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Sale Complete",
          config: {
            type: "end",
            endMessage: "Nice, your account's getting set up right now. You'll get login details by email shortly. Welcome to {company_name}!",
          },
        },
      },
      {
        id: "node-alternative-options",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Alternatives",
          config: {
            type: "message",
            message: "I understand. We have a more affordable option at {lower_price} that includes {reduced_features}. We also offer flexible payment plans. Would either of these work better for you?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-followup",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Log Lead",
          config: {
            type: "webhook",
            url: "https://your-crm.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "pricing_discussed" },
            description: "Log pricing discussion for follow-up",
          },
        },
      },
      {
        id: "node-end-followup",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "End Followup",
          config: {
            type: "end",
            endMessage: "I'll send you a summary of our conversation with all the pricing details. Take your time to review and feel free to reach out with any questions. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-understand-needs" },
      { id: "e2", source: "node-understand-needs", target: "node-present-options" },
      { id: "e3", source: "node-present-options", target: "node-ask-budget" },
      { id: "e4", source: "node-ask-budget", target: "node-check-budget" },
      { id: "e5", source: "node-check-budget", sourceHandle: "true", target: "node-proceed-sale" },
      { id: "e6", source: "node-check-budget", sourceHandle: "false", target: "node-alternative-options" },
      { id: "e7", source: "node-proceed-sale", target: "node-create-account" },
      { id: "e8", source: "node-create-account", target: "node-end-sale" },
      { id: "e9", source: "node-alternative-options", target: "node-log-followup" },
      { id: "e10", source: "node-log-followup", target: "node-end-followup" },
    ],
  },

  // Template 15: Free Trial Follow-up
  {
    id: "template-trial-followup",
    name: "Free Trial Follow-up",
    description: "Check in with trial users to ensure they're getting value, answer questions, and guide them toward conversion.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {user_name}! This is {agent_name} from {company_name}. I wanted to check in and see how your free trial is going. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-trial-experience",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Trial Experience",
          config: {
            type: "question",
            question: "Have you had a chance to explore the features? What do you think so far?",
            variableName: "trial_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-positive",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Positive Experience?",
          config: {
            type: "condition",
            condition: "The user is having a positive trial experience",
          },
        },
      },
      {
        id: "node-conversion-ask",
        type: "message",
        position: { x: 450, y: 410 },
        data: {
          type: "message",
          label: "Conversion Ask",
          config: {
            type: "message",
            message: "That's great to hear! Your trial ends in {days_remaining} days. Would you like to upgrade now to ensure you don't lose any of your work? As a trial user, you qualify for {special_offer}.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 50, y: 410 },
        data: {
          type: "question",
          label: "Address Issues",
          config: {
            type: "question",
            question: "I'm sorry to hear that. What specific challenges are you facing? I'd love to help you get more value from the trial.",
            variableName: "trial_issues",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-provide-help",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Provide Help",
          config: {
            type: "message",
            message: "I can help with that. Let me {solution}. I'll also send you our quick start guide that covers exactly what you need.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-check-convert",
        type: "condition",
        position: { x: 450, y: 530 },
        data: {
          type: "condition",
          label: "Ready to Convert?",
          config: {
            type: "condition",
            condition: "The user wants to upgrade to a paid plan",
          },
        },
      },
      {
        id: "node-process-upgrade",
        type: "webhook",
        position: { x: 600, y: 650 },
        data: {
          type: "webhook",
          label: "Process Upgrade",
          config: {
            type: "webhook",
            url: "https://your-api.com/convert-trial",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "convert_trial" },
            description: "Convert trial to paid account",
          },
        },
      },
      {
        id: "node-end-converted",
        type: "end",
        position: { x: 600, y: 770 },
        data: {
          type: "end",
          label: "Conversion Complete",
          config: {
            type: "end",
            endMessage: "All done! Your account's been upgraded. You'll get a confirmation email with your receipt. Thanks for going with us!",
          },
        },
      },
      {
        id: "node-extend-trial",
        type: "webhook",
        position: { x: 300, y: 650 },
        data: {
          type: "webhook",
          label: "Extend Trial",
          config: {
            type: "webhook",
            url: "https://your-api.com/extend-trial",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "extend_trial" },
            description: "Extend trial period",
          },
        },
      },
      {
        id: "node-end-extended",
        type: "end",
        position: { x: 300, y: 770 },
        data: {
          type: "end",
          label: "Trial Extended",
          config: {
            type: "end",
            endMessage: "No problem! I've extended your trial by 7 more days so you have more time to explore. Feel free to reach out if you have any questions. Have a great day!",
          },
        },
      },
      {
        id: "node-log-help",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Help Request",
          config: {
            type: "webhook",
            url: "https://your-crm.com/trial-support",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "trial_support" },
            description: "Log trial support interaction",
          },
        },
      },
      {
        id: "node-end-help",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Help Provided",
          config: {
            type: "end",
            endMessage: "I've sent you the resources to help. Give those a try and I'll check back in a few days. Don't hesitate to reach out if you need anything else!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-trial-experience" },
      { id: "e2", source: "node-trial-experience", target: "node-check-positive" },
      { id: "e3", source: "node-check-positive", sourceHandle: "true", target: "node-conversion-ask" },
      { id: "e4", source: "node-check-positive", sourceHandle: "false", target: "node-ask-questions" },
      { id: "e5", source: "node-conversion-ask", target: "node-check-convert" },
      { id: "e6", source: "node-check-convert", sourceHandle: "true", target: "node-process-upgrade" },
      { id: "e7", source: "node-check-convert", sourceHandle: "false", target: "node-extend-trial" },
      { id: "e8", source: "node-process-upgrade", target: "node-end-converted" },
      { id: "e9", source: "node-extend-trial", target: "node-end-extended" },
      { id: "e10", source: "node-ask-questions", target: "node-provide-help" },
      { id: "e11", source: "node-provide-help", target: "node-log-help" },
      { id: "e12", source: "node-log-help", target: "node-end-help" },
    ],
  },

  // Template 16: Quote Follow-up
  {
    id: "template-quote-followup",
    name: "Quote Follow-up",
    description: "Follow up on sent quotes to answer questions, handle objections, and close the deal.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {firstName}! This is {agent_name} from {company_name}. I'm following up on the quote we sent over for {project_name}. Have you had a chance to review it?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-reviewed",
        type: "condition",
        position: { x: 250, y: 170 },
        data: {
          type: "condition",
          label: "Reviewed Quote?",
          config: {
            type: "condition",
            condition: "The prospect has reviewed the quote",
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 450, y: 290 },
        data: {
          type: "question",
          label: "Any Questions",
          config: {
            type: "question",
            question: "Great! Do you have any questions about the quote or the scope of work?",
            variableName: "quote_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-address-concerns",
        type: "message",
        position: { x: 450, y: 410 },
        data: {
          type: "message",
          label: "Address Concerns",
          config: {
            type: "message",
            message: "I understand your concern. Let me clarify that for you. {clarification} Does that address your question?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-decision",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Decision Timeline",
          config: {
            type: "question",
            question: "When are you looking to make a decision? We'd love to get started on this for you.",
            variableName: "decision_timeline",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-ready",
        type: "condition",
        position: { x: 450, y: 650 },
        data: {
          type: "condition",
          label: "Ready to Proceed?",
          config: {
            type: "condition",
            condition: "The prospect is ready to accept the quote",
          },
        },
      },
      {
        id: "node-accept-quote",
        type: "webhook",
        position: { x: 600, y: 770 },
        data: {
          type: "webhook",
          label: "Accept Quote",
          config: {
            type: "webhook",
            url: "https://your-crm.com/quotes/accept",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "accept_quote" },
            description: "Mark quote as accepted",
          },
        },
      },
      {
        id: "node-end-accepted",
        type: "end",
        position: { x: 600, y: 890 },
        data: {
          type: "end",
          label: "Quote Accepted",
          config: {
            type: "end",
            endMessage: "Awesome, I'm locking that in for you. You'll get the contract by email to sign. We're really looking forward to working together!",
          },
        },
      },
      {
        id: "node-schedule-followup",
        type: "appointment",
        position: { x: 300, y: 770 },
        data: {
          type: "appointment",
          label: "Schedule Follow-up",
          config: {
            type: "appointment",
            appointmentType: "Quote Discussion",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-scheduled",
        type: "end",
        position: { x: 300, y: 890 },
        data: {
          type: "end",
          label: "Follow-up Scheduled",
          config: {
            type: "end",
            endMessage: "I've scheduled our follow-up call. I'll have some additional information prepared. Talk to you then!",
          },
        },
      },
      {
        id: "node-resend-quote",
        type: "webhook",
        position: { x: 50, y: 290 },
        data: {
          type: "webhook",
          label: "Resend Quote",
          config: {
            type: "webhook",
            url: "https://your-api.com/resend-quote",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "resend" },
            description: "Resend quote to prospect",
          },
        },
      },
      {
        id: "node-end-resent",
        type: "end",
        position: { x: 50, y: 410 },
        data: {
          type: "end",
          label: "Quote Resent",
          config: {
            type: "end",
            endMessage: "No problem! I've just resent the quote to your email. Take your time to review it and feel free to reach out with any questions. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-check-reviewed" },
      { id: "e2", source: "node-check-reviewed", sourceHandle: "true", target: "node-ask-questions" },
      { id: "e3", source: "node-check-reviewed", sourceHandle: "false", target: "node-resend-quote" },
      { id: "e4", source: "node-ask-questions", target: "node-address-concerns" },
      { id: "e5", source: "node-address-concerns", target: "node-ask-decision" },
      { id: "e6", source: "node-ask-decision", target: "node-check-ready" },
      { id: "e7", source: "node-check-ready", sourceHandle: "true", target: "node-accept-quote" },
      { id: "e8", source: "node-check-ready", sourceHandle: "false", target: "node-schedule-followup" },
      { id: "e9", source: "node-accept-quote", target: "node-end-accepted" },
      { id: "e10", source: "node-schedule-followup", target: "node-end-scheduled" },
      { id: "e11", source: "node-resend-quote", target: "node-end-resent" },
    ],
  },

  // Template 17: Renewal Reminder
  {
    id: "template-renewal-reminder",
    name: "Renewal Reminder",
    description: "Proactively remind customers about upcoming contract or subscription renewals and facilitate the renewal process.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. I'm calling because your {subscription_type} is coming up for renewal on {renewal_date}. I wanted to make sure everything is in order for you.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-satisfaction-check",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Satisfaction Check",
          config: {
            type: "question",
            question: "Before we proceed, how has your experience been with us over the past year? Anything we could do better?",
            variableName: "satisfaction_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-renewal-options",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Renewal Options",
          config: {
            type: "message",
            message: "Thank you for that feedback. For your renewal, you can continue with your current plan at {current_price}, or I can share some options that might better suit your needs. Would you like to hear about those?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-upgrade",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Interested in Options?",
          config: {
            type: "condition",
            condition: "Customer wants to hear about other options",
          },
        },
      },
      {
        id: "node-present-upgrades",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Present Upgrades",
          config: {
            type: "message",
            message: "Based on your usage, I'd recommend {recommended_plan}. It includes {additional_features} and would be {new_price}. Many customers in your situation have found it really valuable.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-choice",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Confirm Choice",
          config: {
            type: "question",
            question: "Would you like me to process your renewal now? I can also set up auto-renewal so you don't have to worry about it next year.",
            variableName: "renewal_choice",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-renewal",
        type: "webhook",
        position: { x: 250, y: 650 },
        data: {
          type: "webhook",
          label: "Process Renewal",
          config: {
            type: "webhook",
            url: "https://your-billing.com/renewals",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "process_renewal" },
            description: "Process subscription renewal",
          },
        },
      },
      {
        id: "node-end-renewed",
        type: "end",
        position: { x: 250, y: 770 },
        data: {
          type: "end",
          label: "Renewal Complete",
          config: {
            type: "end",
            endMessage: "Your renewal has been processed. You'll receive a confirmation email with all the details. Thank you for continuing with us - we truly appreciate your business!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-satisfaction-check" },
      { id: "e2", source: "node-satisfaction-check", target: "node-renewal-options" },
      { id: "e3", source: "node-renewal-options", target: "node-check-upgrade" },
      { id: "e4", source: "node-check-upgrade", sourceHandle: "true", target: "node-present-upgrades" },
      { id: "e5", source: "node-check-upgrade", sourceHandle: "false", target: "node-confirm-choice" },
      { id: "e6", source: "node-present-upgrades", target: "node-confirm-choice" },
      { id: "e7", source: "node-confirm-choice", target: "node-process-renewal" },
      { id: "e8", source: "node-process-renewal", target: "node-end-renewed" },
    ],
  },

  // Template 18: Competitor Replacement
  {
    id: "template-competitor-replacement",
    name: "Competitor Replacement",
    description: "Target customers using competitor products and demonstrate your superior value proposition for switching.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {prospect_name}! This is {agent_name} from {company_name}. I understand you're currently using {competitor_name}. I wanted to share how we've helped similar businesses achieve better results. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-current-challenges",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Current Challenges",
          config: {
            type: "question",
            question: "What's been your experience with {competitor_name}? Are there any limitations or challenges you've encountered?",
            variableName: "competitor_pain_points",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-differentiation",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Differentiation",
          config: {
            type: "message",
            message: "I hear that a lot from businesses that switch to us. Unlike {competitor_name}, we offer {key_differentiators}. Our customers typically see {specific_benefit} after making the switch.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-case-study",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Case Study",
          config: {
            type: "message",
            message: "In fact, {similar_company} switched from {competitor_name} to us last year and they've reported {measurable_improvement}. Would you like to see a comparison of how we stack up?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The prospect is interested in learning more",
          },
        },
      },
      {
        id: "node-schedule-demo",
        type: "appointment",
        position: { x: 450, y: 650 },
        data: {
          type: "appointment",
          label: "Schedule Comparison Demo",
          config: {
            type: "appointment",
            appointmentType: "Competitor Comparison Demo",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-capture-lead",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Log Competitive Lead",
          config: {
            type: "webhook",
            url: "https://your-crm.com/competitive-leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "competitive_replacement" },
            description: "Log competitive lead for tracking",
          },
        },
      },
      {
        id: "node-end-interested",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Demo Scheduled",
          config: {
            type: "end",
            endMessage: "I've got you booked for a personalized comparison demo. I'll prepare specific comparisons based on what you've shared today. Looking forward to showing you what we can do!",
          },
        },
      },
      {
        id: "node-send-info",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Send Comparison",
          config: {
            type: "webhook",
            url: "https://your-api.com/send-comparison",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "comparison_email" },
            description: "Send competitor comparison materials",
          },
        },
      },
      {
        id: "node-end-info-sent",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Info Sent",
          config: {
            type: "end",
            endMessage: "I'll send you a comparison sheet so you can review at your convenience. Feel free to reach out when you're ready to discuss further. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-current-challenges" },
      { id: "e2", source: "node-current-challenges", target: "node-differentiation" },
      { id: "e3", source: "node-differentiation", target: "node-case-study" },
      { id: "e4", source: "node-case-study", target: "node-check-interest" },
      { id: "e5", source: "node-check-interest", sourceHandle: "true", target: "node-schedule-demo" },
      { id: "e6", source: "node-check-interest", sourceHandle: "false", target: "node-send-info" },
      { id: "e7", source: "node-schedule-demo", target: "node-capture-lead" },
      { id: "e8", source: "node-capture-lead", target: "node-end-interested" },
      { id: "e9", source: "node-send-info", target: "node-end-info-sent" },
    ],
  },

  // Template 19: Flash Sale Notification
  {
    id: "template-flash-sale",
    name: "Flash Sale Notification",
    description: "Notify customers about limited-time offers and create urgency to drive immediate purchases.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. I'm calling with exciting news - we have a flash sale happening right now with {discount_amount} off, but it ends in {time_remaining}!",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-details",
        type: "message",
        position: { x: 250, y: 170 },
        data: {
          type: "message",
          label: "Offer Details",
          config: {
            type: "message",
            message: "This sale includes {sale_items}. Based on your past purchases, I thought you'd be particularly interested in {personalized_recommendation}.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer is interested in the flash sale",
          },
        },
      },
      {
        id: "node-process-order",
        type: "question",
        position: { x: 450, y: 410 },
        data: {
          type: "question",
          label: "What to Order",
          config: {
            type: "question",
            question: "Which items would you like to order? I can process this right now so you don't miss out.",
            variableName: "order_items",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-order",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Confirm Order",
          config: {
            type: "message",
            message: "Perfect! Your order of {order_items} with {discount_amount} off comes to {total_price}. Should I use the payment method on file?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-order",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Submit Order",
          config: {
            type: "webhook",
            url: "https://your-store.com/orders",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { source: "flash_sale_call", promo_applied: true },
            description: "Submit flash sale order",
          },
        },
      },
      {
        id: "node-end-ordered",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Order Complete",
          config: {
            type: "end",
            endMessage: "Your order is confirmed! You'll receive an email with tracking information. Thanks for taking advantage of this deal - you saved {savings_amount}!",
          },
        },
      },
      {
        id: "node-send-link",
        type: "webhook",
        position: { x: 50, y: 410 },
        data: {
          type: "webhook",
          label: "Send Sale Link",
          config: {
            type: "webhook",
            url: "https://your-api.com/send-sale-link",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "flash_sale_link" },
            description: "Send flash sale link via SMS",
          },
        },
      },
      {
        id: "node-end-link-sent",
        type: "end",
        position: { x: 50, y: 530 },
        data: {
          type: "end",
          label: "Link Sent",
          config: {
            type: "end",
            endMessage: "No problem! I've texted you the link so you can shop when you're ready. Remember, the sale ends soon! Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-offer-details" },
      { id: "e2", source: "node-offer-details", target: "node-check-interest" },
      { id: "e3", source: "node-check-interest", sourceHandle: "true", target: "node-process-order" },
      { id: "e4", source: "node-check-interest", sourceHandle: "false", target: "node-send-link" },
      { id: "e5", source: "node-process-order", target: "node-confirm-order" },
      { id: "e6", source: "node-confirm-order", target: "node-submit-order" },
      { id: "e7", source: "node-submit-order", target: "node-end-ordered" },
      { id: "e8", source: "node-send-link", target: "node-end-link-sent" },
    ],
  },

  // Template 20: New Product Launch
  {
    id: "template-product-launch",
    name: "New Product Launch",
    description: "Announce new products to existing customers and early adopters with exclusive access or pre-order opportunities.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. As one of our valued customers, I wanted to give you an exclusive first look at our newest product - {product_name}!",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-product-intro",
        type: "message",
        position: { x: 250, y: 170 },
        data: {
          type: "message",
          label: "Product Introduction",
          config: {
            type: "message",
            message: "{product_name} is designed to {product_benefit}. It features {key_features} and will officially launch on {launch_date}. But as a loyal customer, you get early access starting today.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer expresses interest in the new product",
          },
        },
      },
      {
        id: "node-exclusive-offer",
        type: "message",
        position: { x: 450, y: 410 },
        data: {
          type: "message",
          label: "Exclusive Offer",
          config: {
            type: "message",
            message: "Because you're getting early access, we're offering an exclusive {early_bird_discount} discount. This offer is only available until the public launch. Would you like to pre-order?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-preorder",
        type: "webhook",
        position: { x: 450, y: 530 },
        data: {
          type: "webhook",
          label: "Process Pre-order",
          config: {
            type: "webhook",
            url: "https://your-store.com/preorders",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "preorder", early_access: true },
            description: "Process product pre-order",
          },
        },
      },
      {
        id: "node-end-preordered",
        type: "end",
        position: { x: 450, y: 650 },
        data: {
          type: "end",
          label: "Pre-order Complete",
          config: {
            type: "end",
            endMessage: "Nice, your pre-order's locked in! You'll be one of the first to get {product_name}. We'll send shipping details as soon as it's ready. Thanks!",
          },
        },
      },
      {
        id: "node-send-info",
        type: "webhook",
        position: { x: 50, y: 410 },
        data: {
          type: "webhook",
          label: "Send Product Info",
          config: {
            type: "webhook",
            url: "https://your-api.com/send-product-info",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "product_info_email" },
            description: "Send detailed product information",
          },
        },
      },
      {
        id: "node-end-info-sent",
        type: "end",
        position: { x: 50, y: 530 },
        data: {
          type: "end",
          label: "Info Sent",
          config: {
            type: "end",
            endMessage: "I'll send you all the details about {product_name} so you can learn more. Your early access discount code will be included. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-product-intro" },
      { id: "e2", source: "node-product-intro", target: "node-check-interest" },
      { id: "e3", source: "node-check-interest", sourceHandle: "true", target: "node-exclusive-offer" },
      { id: "e4", source: "node-check-interest", sourceHandle: "false", target: "node-send-info" },
      { id: "e5", source: "node-exclusive-offer", target: "node-process-preorder" },
      { id: "e6", source: "node-process-preorder", target: "node-end-preordered" },
      { id: "e7", source: "node-send-info", target: "node-end-info-sent" },
    ],
  },

  // Template 21: Seasonal Promotion
  {
    id: "template-seasonal-promo",
    name: "Seasonal Promotion",
    description: "Promote seasonal offers, holiday specials, or time-limited campaigns to drive sales during peak periods.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {customer_name}! This is {agent_name} from {company_name}. I'm calling with some exciting {season} specials that I think you'll love!",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-promotion-details",
        type: "message",
        position: { x: 250, y: 170 },
        data: {
          type: "message",
          label: "Promotion Details",
          config: {
            type: "message",
            message: "For a limited time, we're offering {promotion_details}. This is one of our biggest promotions of the year and runs through {end_date}.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-personalized-rec",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Personalized Recommendation",
          config: {
            type: "message",
            message: "Based on your previous purchases, I thought you'd be especially interested in {personalized_items}. These are {discount_percent} off right now!",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer is interested in the seasonal promotion",
          },
        },
      },
      {
        id: "node-place-order",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Order Details",
          config: {
            type: "question",
            question: "Great! So what can I get for you today? I can put the order through right now.",
            variableName: "order_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-order",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Process Order",
          config: {
            type: "webhook",
            url: "https://your-store.com/seasonal-orders",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { campaign: "seasonal_promo" },
            description: "Process seasonal promotion order",
          },
        },
      },
      {
        id: "node-end-ordered",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Order Complete",
          config: {
            type: "end",
            endMessage: "Your order is confirmed with the {season} discount applied! You'll receive confirmation shortly. Happy {season}!",
          },
        },
      },
      {
        id: "node-save-interest",
        type: "webhook",
        position: { x: 50, y: 530 },
        data: {
          type: "webhook",
          label: "Save for Later",
          config: {
            type: "webhook",
            url: "https://your-crm.com/promo-interest",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "promo_reminder" },
            description: "Schedule reminder before promotion ends",
          },
        },
      },
      {
        id: "node-end-reminder",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Reminder Set",
          config: {
            type: "end",
            endMessage: "No problem! I'll send you a reminder before the promotion ends so you don't miss out. Enjoy your day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-promotion-details" },
      { id: "e2", source: "node-promotion-details", target: "node-personalized-rec" },
      { id: "e3", source: "node-personalized-rec", target: "node-check-interest" },
      { id: "e4", source: "node-check-interest", sourceHandle: "true", target: "node-place-order" },
      { id: "e5", source: "node-check-interest", sourceHandle: "false", target: "node-save-interest" },
      { id: "e6", source: "node-place-order", target: "node-process-order" },
      { id: "e7", source: "node-process-order", target: "node-end-ordered" },
      { id: "e8", source: "node-save-interest", target: "node-end-reminder" },
    ],
  },

  // Template 22: VIP Customer Outreach
  {
    id: "template-vip-outreach",
    name: "VIP Customer Outreach",
    description: "Personalized outreach to high-value customers with exclusive offers, early access, and white-glove service.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "VIP Greeting",
          config: {
            type: "message",
            message: "Hello {customer_name}! This is {agent_name}, your dedicated account manager at {company_name}. I wanted to personally check in with you and share some exclusive opportunities available only to our VIP members.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-satisfaction-check",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Experience Check",
          config: {
            type: "question",
            question: "First, how has everything been going? Is there anything at all we can do to make your experience even better?",
            variableName: "vip_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-exclusive-preview",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Exclusive Preview",
          config: {
            type: "message",
            message: "I'm reaching out because we have something special coming up that I wanted you to know about first. {exclusive_offer}. As a VIP member, you get {vip_benefit} before anyone else.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The VIP customer is interested in the exclusive offer",
          },
        },
      },
      {
        id: "node-white-glove",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "White Glove Service",
          config: {
            type: "message",
            message: "I'd be happy to personally handle this for you. I can arrange {white_glove_service} and ensure everything is perfect. Shall I proceed?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-vip",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Process VIP Request",
          config: {
            type: "webhook",
            url: "https://your-crm.com/vip-requests",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { priority: "vip", white_glove: true },
            description: "Process VIP customer request with priority",
          },
        },
      },
      {
        id: "node-end-vip-service",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "VIP Service Complete",
          config: {
            type: "end",
            endMessage: "I've arranged everything for you personally. You'll receive a confirmation within the hour. As always, please reach out to me directly if you need anything at all. It's a pleasure serving you!",
          },
        },
      },
      {
        id: "node-schedule-followup",
        type: "appointment",
        position: { x: 50, y: 530 },
        data: {
          type: "appointment",
          label: "Schedule VIP Call",
          config: {
            type: "appointment",
            appointmentType: "VIP Consultation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-scheduled",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Call Scheduled",
          config: {
            type: "end",
            endMessage: "I've scheduled our call. I'll prepare some personalized options for you to review then. Thank you for your continued loyalty - it truly means the world to us!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-satisfaction-check" },
      { id: "e2", source: "node-satisfaction-check", target: "node-exclusive-preview" },
      { id: "e3", source: "node-exclusive-preview", target: "node-check-interest" },
      { id: "e4", source: "node-check-interest", sourceHandle: "true", target: "node-white-glove" },
      { id: "e5", source: "node-check-interest", sourceHandle: "false", target: "node-schedule-followup" },
      { id: "e6", source: "node-white-glove", target: "node-process-vip" },
      { id: "e7", source: "node-process-vip", target: "node-end-vip-service" },
      { id: "e8", source: "node-schedule-followup", target: "node-end-scheduled" },
    ],
  },

  // Template 23: Contract Negotiation
  {
    id: "template-contract-negotiation",
    name: "Contract Negotiation",
    description: "Handle contract discussions, negotiate terms, and guide prospects through the final stages of enterprise sales.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hi {firstName}! This is {agent_name} from {company_name}. I'm following up on the contract we sent over for {deal_name}. I wanted to see if you have any questions or if there's anything we need to discuss before moving forward.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-contract-review",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Contract Review",
          config: {
            type: "question",
            question: "Have you and your team had a chance to review the contract? Are there any terms or conditions you'd like to discuss?",
            variableName: "contract_concerns",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-concerns",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Has Concerns?",
          config: {
            type: "condition",
            condition: "The prospect has concerns about the contract terms",
          },
        },
      },
      {
        id: "node-address-terms",
        type: "question",
        position: { x: 50, y: 410 },
        data: {
          type: "question",
          label: "Discuss Terms",
          config: {
            type: "question",
            question: "I understand. Which specific terms would you like to discuss? I may have some flexibility there.",
            variableName: "terms_to_negotiate",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-alternative",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Alternative Terms",
          config: {
            type: "message",
            message: "I appreciate you being upfront about that. Here's what I can offer: {alternative_terms}. This is typically reserved for our enterprise clients, but I think we can make it work for you.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ready-sign",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Ready to Sign",
          config: {
            type: "question",
            question: "Shall I send over the updated contract for signature? I can have it ready within the hour.",
            variableName: "ready_to_sign",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-signature",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Ready to Sign?",
          config: {
            type: "condition",
            condition: "The prospect is ready to sign the contract",
          },
        },
      },
      {
        id: "node-send-contract",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Send Contract",
          config: {
            type: "webhook",
            url: "https://your-crm.com/contracts/send",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_for_signature" },
            description: "Send contract for electronic signature",
          },
        },
      },
      {
        id: "node-end-sent",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Contract Sent",
          config: {
            type: "end",
            endMessage: "I'm sending the contract now. You'll receive it via email for electronic signature. Once signed, we can begin onboarding immediately. Thank you for choosing {company_name}!",
          },
        },
      },
      {
        id: "node-escalate",
        type: "transfer",
        position: { x: 50, y: 650 },
        data: {
          type: "transfer",
          label: "Escalate to Senior",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "Let me connect you with our senior account executive who has more authority on contract terms.",
          },
        },
      },
      {
        id: "node-end-escalated",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Escalated",
          config: {
            type: "end",
            endMessage: "Transferring you now to discuss those specific terms further.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-contract-review" },
      { id: "e2", source: "node-contract-review", target: "node-check-concerns" },
      { id: "e3", source: "node-check-concerns", sourceHandle: "true", target: "node-address-terms" },
      { id: "e4", source: "node-check-concerns", sourceHandle: "false", target: "node-ready-sign" },
      { id: "e5", source: "node-address-terms", target: "node-offer-alternative" },
      { id: "e6", source: "node-offer-alternative", target: "node-ready-sign" },
      { id: "e7", source: "node-ready-sign", target: "node-check-signature" },
      { id: "e8", source: "node-check-signature", sourceHandle: "true", target: "node-send-contract" },
      { id: "e9", source: "node-check-signature", sourceHandle: "false", target: "node-escalate" },
      { id: "e10", source: "node-send-contract", target: "node-end-sent" },
      { id: "e11", source: "node-escalate", target: "node-end-escalated" },
    ],
  },

  // ============================================
  // CUSTOMER SUPPORT & SERVICE TEMPLATES
  // ============================================

  // Template 24: General Inquiry Handler
  {
    id: "template-general-inquiry",
    name: "General Inquiry Handler",
    description: "Handle general customer inquiries, provide information, and route to appropriate departments as needed.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Thank you for calling {company_name}! I'm here to help. How can I assist you today?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-understand-query",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Understand Query",
          config: {
            type: "question",
            question: "Could you tell me a bit more about what you're looking for?",
            variableName: "inquiry_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-categorize",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Is Sales Inquiry?",
          config: {
            type: "condition",
            condition: "The inquiry is about products, pricing, or purchasing",
          },
        },
      },
      {
        id: "node-transfer-sales",
        type: "transfer",
        position: { x: 450, y: 410 },
        data: {
          type: "transfer",
          label: "Transfer to Sales",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "I'll connect you with our sales team who can best help you with that.",
          },
        },
      },
      {
        id: "node-check-support",
        type: "condition",
        position: { x: 50, y: 410 },
        data: {
          type: "condition",
          label: "Is Support Issue?",
          config: {
            type: "condition",
            condition: "The inquiry is about a technical issue or support request",
          },
        },
      },
      {
        id: "node-transfer-support",
        type: "transfer",
        position: { x: 150, y: 530 },
        data: {
          type: "transfer",
          label: "Transfer to Support",
          config: {
            type: "transfer",
            transferNumber: "+1234567891",
            message: "I'll connect you with our technical support team right away.",
          },
        },
      },
      {
        id: "node-provide-info",
        type: "message",
        position: { x: -50, y: 530 },
        data: {
          type: "message",
          label: "Provide Information",
          config: {
            type: "message",
            message: "Based on your question, {answer}. Is there anything else you'd like to know?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-inquiry",
        type: "webhook",
        position: { x: -50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Inquiry",
          config: {
            type: "webhook",
            url: "https://your-crm.com/inquiries",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "general_inquiry" },
            description: "Log inquiry for tracking",
          },
        },
      },
      {
        id: "node-end-helped",
        type: "end",
        position: { x: -50, y: 770 },
        data: {
          type: "end",
          label: "Inquiry Resolved",
          config: {
            type: "end",
            endMessage: "I'm glad I could help! If you have any other questions, don't hesitate to call back. Have a wonderful day!",
          },
        },
      },
      {
        id: "node-end-transferred",
        type: "end",
        position: { x: 300, y: 650 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "Transferring you now. Thank you for calling!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-understand-query" },
      { id: "e2", source: "node-understand-query", target: "node-categorize" },
      { id: "e3", source: "node-categorize", sourceHandle: "true", target: "node-transfer-sales" },
      { id: "e4", source: "node-categorize", sourceHandle: "false", target: "node-check-support" },
      { id: "e5", source: "node-check-support", sourceHandle: "true", target: "node-transfer-support" },
      { id: "e6", source: "node-check-support", sourceHandle: "false", target: "node-provide-info" },
      { id: "e7", source: "node-transfer-sales", target: "node-end-transferred" },
      { id: "e8", source: "node-transfer-support", target: "node-end-transferred" },
      { id: "e9", source: "node-provide-info", target: "node-log-inquiry" },
      { id: "e10", source: "node-log-inquiry", target: "node-end-helped" },
    ],
  },

  // Template 25: Complaint Resolution
  {
    id: "template-complaint-resolution",
    name: "Complaint Resolution",
    description: "Handle customer complaints professionally, gather details, offer solutions, and ensure customer satisfaction.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Empathetic Greeting",
          config: {
            type: "message",
            message: "Hello, and thank you for reaching out to us. I understand you have a concern you'd like to address. I'm here to help resolve this for you. Please tell me what happened.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-gather-details",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Gather Details",
          config: {
            type: "question",
            question: "I'm sorry to hear about this experience. To help resolve this quickly, could you share your order number or account number?",
            variableName: "reference_number",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-understand-issue",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Issue Details",
          config: {
            type: "question",
            question: "Thank you. Can you walk me through exactly what happened and how this has affected you?",
            variableName: "issue_description",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-acknowledge",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Acknowledge",
          config: {
            type: "message",
            message: "I completely understand why you're frustrated, and I apologize for this experience. This is not the level of service we want to provide. Let me see what I can do to make this right.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-offer-solution",
        type: "message",
        position: { x: 250, y: 530 },
        data: {
          type: "message",
          label: "Offer Solution",
          config: {
            type: "message",
            message: "Here's what I can offer to resolve this: {resolution_options}. Which of these would work best for you?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-accept-solution",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Solution Accepted?",
          config: {
            type: "question",
            question: "Does this resolution work for you?",
            variableName: "solution_accepted",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-accepted",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Accepted?",
          config: {
            type: "condition",
            condition: "The customer accepts the proposed solution",
          },
        },
      },
      {
        id: "node-process-resolution",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Process Resolution",
          config: {
            type: "webhook",
            url: "https://your-crm.com/complaints/resolve",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "resolve_complaint" },
            description: "Process complaint resolution",
          },
        },
      },
      {
        id: "node-end-resolved",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Complaint Resolved",
          config: {
            type: "end",
            endMessage: "I've processed that for you. You should see the {resolution} reflected in your account within {timeframe}. Is there anything else I can help with today? We truly appreciate your patience and understanding.",
          },
        },
      },
      {
        id: "node-escalate",
        type: "transfer",
        position: { x: 50, y: 890 },
        data: {
          type: "transfer",
          label: "Escalate to Manager",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "I understand this hasn't fully addressed your concerns. Let me connect you with a supervisor who has more authority to help.",
          },
        },
      },
      {
        id: "node-end-escalated",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Escalated",
          config: {
            type: "end",
            endMessage: "Transferring you now. Thank you for your patience.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-gather-details" },
      { id: "e2", source: "node-gather-details", target: "node-understand-issue" },
      { id: "e3", source: "node-understand-issue", target: "node-acknowledge" },
      { id: "e4", source: "node-acknowledge", target: "node-offer-solution" },
      { id: "e5", source: "node-offer-solution", target: "node-accept-solution" },
      { id: "e6", source: "node-accept-solution", target: "node-check-accepted" },
      { id: "e7", source: "node-check-accepted", sourceHandle: "true", target: "node-process-resolution" },
      { id: "e8", source: "node-check-accepted", sourceHandle: "false", target: "node-escalate" },
      { id: "e9", source: "node-process-resolution", target: "node-end-resolved" },
      { id: "e10", source: "node-escalate", target: "node-end-escalated" },
    ],
  },

  // Template 26: Technical Troubleshooting
  {
    id: "template-tech-troubleshoot",
    name: "Technical Troubleshooting",
    description: "Guide customers through technical issues with step-by-step troubleshooting and escalation to tech support if needed.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for contacting technical support. I'm here to help resolve your issue. Can you describe the problem you're experiencing?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-issue-description",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Issue Description",
          config: {
            type: "question",
            question: "When did this issue start, and what were you doing when it occurred?",
            variableName: "issue_context",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-basic-troubleshoot",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Basic Troubleshooting",
          config: {
            type: "message",
            message: "Let's try some basic troubleshooting first. Have you tried {basic_step_1}? Please do that now and let me know the result.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-resolved-1",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Issue Resolved?",
          config: {
            type: "condition",
            condition: "The basic troubleshooting step resolved the issue",
          },
        },
      },
      {
        id: "node-advanced-step",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Advanced Step",
          config: {
            type: "message",
            message: "Okay, let's try something else. Please {advanced_step}. Take your time and let me know when you've done that.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-resolved-2",
        type: "condition",
        position: { x: 50, y: 650 },
        data: {
          type: "condition",
          label: "Resolved Now?",
          config: {
            type: "condition",
            condition: "The advanced troubleshooting step resolved the issue",
          },
        },
      },
      {
        id: "node-create-ticket",
        type: "webhook",
        position: { x: -100, y: 770 },
        data: {
          type: "webhook",
          label: "Create Support Ticket",
          config: {
            type: "webhook",
            url: "https://your-support.com/tickets",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { priority: "medium", type: "technical" },
            description: "Create escalation ticket",
          },
        },
      },
      {
        id: "node-escalate-tech",
        type: "transfer",
        position: { x: -100, y: 890 },
        data: {
          type: "transfer",
          label: "Transfer to Tech",
          config: {
            type: "transfer",
            transferNumber: "+1234567892",
            message: "I've documented everything we've tried. Let me connect you with a senior technician who can take a deeper look.",
          },
        },
      },
      {
        id: "node-end-escalated",
        type: "end",
        position: { x: -100, y: 1010 },
        data: {
          type: "end",
          label: "Escalated",
          config: {
            type: "end",
            endMessage: "Transferring you now. Your ticket number is {ticket_id} for reference.",
          },
        },
      },
      {
        id: "node-log-resolution",
        type: "webhook",
        position: { x: 300, y: 530 },
        data: {
          type: "webhook",
          label: "Log Resolution",
          config: {
            type: "webhook",
            url: "https://your-support.com/resolutions",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { resolution: "self_service" },
            description: "Log successful resolution",
          },
        },
      },
      {
        id: "node-end-resolved",
        type: "end",
        position: { x: 300, y: 650 },
        data: {
          type: "end",
          label: "Issue Resolved",
          config: {
            type: "end",
            endMessage: "I'm glad we could resolve that together. If you experience any other issues, please don't hesitate to call back. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-issue-description" },
      { id: "e2", source: "node-issue-description", target: "node-basic-troubleshoot" },
      { id: "e3", source: "node-basic-troubleshoot", target: "node-check-resolved-1" },
      { id: "e4", source: "node-check-resolved-1", sourceHandle: "true", target: "node-log-resolution" },
      { id: "e5", source: "node-check-resolved-1", sourceHandle: "false", target: "node-advanced-step" },
      { id: "e6", source: "node-advanced-step", target: "node-check-resolved-2" },
      { id: "e7", source: "node-check-resolved-2", sourceHandle: "true", target: "node-log-resolution" },
      { id: "e8", source: "node-check-resolved-2", sourceHandle: "false", target: "node-create-ticket" },
      { id: "e9", source: "node-create-ticket", target: "node-escalate-tech" },
      { id: "e10", source: "node-escalate-tech", target: "node-end-escalated" },
      { id: "e11", source: "node-log-resolution", target: "node-end-resolved" },
    ],
  },

  // Template 27: Billing Inquiry
  {
    id: "template-billing-inquiry",
    name: "Billing Inquiry",
    description: "Handle billing-related questions, explain charges, and resolve billing discrepancies.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for calling billing support. I'll be happy to help with any billing questions. How can I assist you today?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-account",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Account",
          config: {
            type: "question",
            question: "For security, may I have your account number or the email address associated with your account?",
            variableName: "account_identifier",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-billing-question",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Billing Question",
          config: {
            type: "question",
            question: "Thank you for verifying. What specific billing question can I help you with?",
            variableName: "billing_question",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-discrepancy",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Billing Discrepancy?",
          config: {
            type: "condition",
            condition: "The customer is disputing a charge or sees a discrepancy",
          },
        },
      },
      {
        id: "node-explain-charge",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Explain Charge",
          config: {
            type: "message",
            message: "Looking at your account, I can see that charge is for {charge_explanation}. It was processed on {date}. Does that help clarify things?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-investigate",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Investigate",
          config: {
            type: "message",
            message: "I understand your concern about that charge. Let me investigate this further. Can you tell me the exact amount and date of the charge you're questioning?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-resolution-options",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Resolution Options",
          config: {
            type: "message",
            message: "After reviewing, I can {resolution_options}. Which would you prefer?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-adjustment",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Process Adjustment",
          config: {
            type: "webhook",
            url: "https://your-billing.com/adjustments",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "billing_adjustment" },
            description: "Process billing adjustment",
          },
        },
      },
      {
        id: "node-end-adjusted",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Adjustment Complete",
          config: {
            type: "end",
            endMessage: "I've processed that adjustment for you. You'll see the credit on your next statement. Is there anything else I can help with?",
          },
        },
      },
      {
        id: "node-log-inquiry",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Log Inquiry",
          config: {
            type: "webhook",
            url: "https://your-crm.com/billing-inquiries",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "billing_clarification" },
            description: "Log billing inquiry",
          },
        },
      },
      {
        id: "node-end-clarified",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Inquiry Resolved",
          config: {
            type: "end",
            endMessage: "I'm glad I could clarify that for you. If you have any other questions about your billing, please don't hesitate to call back. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-account" },
      { id: "e2", source: "node-verify-account", target: "node-billing-question" },
      { id: "e3", source: "node-billing-question", target: "node-check-discrepancy" },
      { id: "e4", source: "node-check-discrepancy", sourceHandle: "true", target: "node-investigate" },
      { id: "e5", source: "node-check-discrepancy", sourceHandle: "false", target: "node-explain-charge" },
      { id: "e6", source: "node-investigate", target: "node-resolution-options" },
      { id: "e7", source: "node-resolution-options", target: "node-process-adjustment" },
      { id: "e8", source: "node-process-adjustment", target: "node-end-adjusted" },
      { id: "e9", source: "node-explain-charge", target: "node-log-inquiry" },
      { id: "e10", source: "node-log-inquiry", target: "node-end-clarified" },
    ],
  },

  // Template 28: Account Verification
  {
    id: "template-account-verification",
    name: "Account Verification",
    description: "Securely verify customer identity before making account changes or providing sensitive information.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Before I can access your account, I need to verify your identity for security purposes. This will just take a moment.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "Can you please provide the full name on the account?",
            variableName: "account_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-dob",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Date of Birth",
          config: {
            type: "question",
            question: "And can you verify your date of birth?",
            variableName: "date_of_birth",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-security",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Security Question",
          config: {
            type: "question",
            question: "Finally, what is the answer to your security question: {security_question}?",
            variableName: "security_answer",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify",
        type: "webhook",
        position: { x: 250, y: 530 },
        data: {
          type: "webhook",
          label: "Verify Identity",
          config: {
            type: "webhook",
            url: "https://your-api.com/verify-identity",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "verify" },
            description: "Verify customer identity against records",
          },
        },
      },
      {
        id: "node-check-verified",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Verified?",
          config: {
            type: "condition",
            condition: "All verification details match the account records",
          },
        },
      },
      {
        id: "node-verified",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Verified",
          config: {
            type: "message",
            message: "Thank you for verifying. Your identity has been confirmed and I now have access to your account. How can I help you today?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-verified",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Proceed with Request",
          config: {
            type: "end",
            endMessage: "I've completed that request for you. Is there anything else I can assist with?",
          },
        },
      },
      {
        id: "node-failed-verification",
        type: "message",
        position: { x: 50, y: 770 },
        data: {
          type: "message",
          label: "Verification Failed",
          config: {
            type: "message",
            message: "I'm sorry, but the information provided doesn't match our records. For security purposes, I cannot proceed with this request.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-log-failed",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Log Failed Attempt",
          config: {
            type: "webhook",
            url: "https://your-security.com/failed-verification",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { event: "failed_verification" },
            description: "Log failed verification attempt",
          },
        },
      },
      {
        id: "node-end-failed",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Verification Failed",
          config: {
            type: "end",
            endMessage: "Please try again later or visit us in person with valid identification. Thank you for understanding.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-dob" },
      { id: "e3", source: "node-ask-dob", target: "node-ask-security" },
      { id: "e4", source: "node-ask-security", target: "node-verify" },
      { id: "e5", source: "node-verify", target: "node-check-verified" },
      { id: "e6", source: "node-check-verified", sourceHandle: "true", target: "node-verified" },
      { id: "e7", source: "node-check-verified", sourceHandle: "false", target: "node-failed-verification" },
      { id: "e8", source: "node-verified", target: "node-end-verified" },
      { id: "e9", source: "node-failed-verification", target: "node-log-failed" },
      { id: "e10", source: "node-log-failed", target: "node-end-failed" },
    ],
  },

  // Template 29: Password Reset
  {
    id: "template-password-reset",
    name: "Password Reset",
    description: "Guide customers through secure password reset process with identity verification.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I can help you reset your password. For security, I'll need to verify your identity first.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-get-email",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Account Email",
          config: {
            type: "question",
            question: "What is the email address associated with your account?",
            variableName: "account_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For verification, can you confirm the last 4 digits of the phone number on file?",
            variableName: "phone_last_four",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-verified",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Verified?",
          config: {
            type: "condition",
            condition: "The verification information is correct",
          },
        },
      },
      {
        id: "node-send-reset",
        type: "webhook",
        position: { x: 450, y: 530 },
        data: {
          type: "webhook",
          label: "Send Reset Link",
          config: {
            type: "webhook",
            url: "https://your-api.com/password-reset",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_reset_link" },
            description: "Send password reset link",
          },
        },
      },
      {
        id: "node-instructions",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Instructions",
          config: {
            type: "message",
            message: "I've sent a password reset link to your email. It will expire in 24 hours. Click the link and follow the instructions to create a new password. Make sure to check your spam folder if you don't see it.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end-success",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Reset Sent",
          config: {
            type: "end",
            endMessage: "You should receive the email within a few minutes. If you have any trouble, please call back. Have a great day!",
          },
        },
      },
      {
        id: "node-failed",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Verification Failed",
          config: {
            type: "message",
            message: "I'm sorry, but that information doesn't match our records. For your security, I cannot process the password reset.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-alternative",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Alternative Options",
          config: {
            type: "message",
            message: "You can try the self-service password reset on our website, or visit a local branch with valid ID to reset your password in person.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end-failed",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Verification Failed",
          config: {
            type: "end",
            endMessage: "Thank you for understanding. Please try one of the alternative methods I mentioned. Have a good day.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-get-email" },
      { id: "e2", source: "node-get-email", target: "node-verify-identity" },
      { id: "e3", source: "node-verify-identity", target: "node-check-verified" },
      { id: "e4", source: "node-check-verified", sourceHandle: "true", target: "node-send-reset" },
      { id: "e5", source: "node-check-verified", sourceHandle: "false", target: "node-failed" },
      { id: "e6", source: "node-send-reset", target: "node-instructions" },
      { id: "e7", source: "node-instructions", target: "node-end-success" },
      { id: "e8", source: "node-failed", target: "node-alternative" },
      { id: "e9", source: "node-alternative", target: "node-end-failed" },
    ],
  },

  // Template 30: Service Activation
  {
    id: "template-service-activation",
    name: "Service Activation",
    description: "Guide customers through activating new services or products with verification and setup assistance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I can help you activate your new {service_name}. Let's get you set up right away.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-get-activation-code",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Activation Code",
          config: {
            type: "question",
            question: "Do you have your activation code or order number handy?",
            variableName: "activation_code",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-order",
        type: "webhook",
        position: { x: 250, y: 290 },
        data: {
          type: "webhook",
          label: "Verify Order",
          config: {
            type: "webhook",
            url: "https://your-api.com/verify-order",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "verify" },
            description: "Verify order/activation code",
          },
        },
      },
      {
        id: "node-check-valid",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Valid Code?",
          config: {
            type: "condition",
            condition: "The activation code is valid",
          },
        },
      },
      {
        id: "node-collect-details",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Setup Details",
          config: {
            type: "question",
            question: "I found your order. To complete activation, I need to confirm a few details. What email address would you like associated with this service?",
            variableName: "setup_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-activate",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Activate Service",
          config: {
            type: "webhook",
            url: "https://your-api.com/activate-service",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "activate" },
            description: "Activate the service",
          },
        },
      },
      {
        id: "node-setup-instructions",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Setup Instructions",
          config: {
            type: "message",
            message: "Your {service_name} is now active. You'll receive an email with login credentials and getting started instructions. {additional_setup_info}",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end-activated",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Activation Complete",
          config: {
            type: "end",
            endMessage: "Congratulations on activating your new service! If you have any questions during setup, our support team is here to help. Enjoy!",
          },
        },
      },
      {
        id: "node-invalid-code",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Invalid Code",
          config: {
            type: "message",
            message: "I wasn't able to find that activation code in our system. Let me try to help you locate it.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-lookup-order",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Lookup by Email",
          config: {
            type: "question",
            question: "Can you provide the email address you used when placing the order?",
            variableName: "order_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-lookup",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Further Assistance",
          config: {
            type: "end",
            endMessage: "I'll look into this and send the activation details to that email. If you don't receive it within an hour, please call back. Thank you!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-get-activation-code" },
      { id: "e2", source: "node-get-activation-code", target: "node-verify-order" },
      { id: "e3", source: "node-verify-order", target: "node-check-valid" },
      { id: "e4", source: "node-check-valid", sourceHandle: "true", target: "node-collect-details" },
      { id: "e5", source: "node-check-valid", sourceHandle: "false", target: "node-invalid-code" },
      { id: "e6", source: "node-collect-details", target: "node-activate" },
      { id: "e7", source: "node-activate", target: "node-setup-instructions" },
      { id: "e8", source: "node-setup-instructions", target: "node-end-activated" },
      { id: "e9", source: "node-invalid-code", target: "node-lookup-order" },
      { id: "e10", source: "node-lookup-order", target: "node-end-lookup" },
    ],
  },

  // Template 31: Service Cancellation
  {
    id: "template-service-cancellation",
    name: "Service Cancellation",
    description: "Handle cancellation requests with retention attempts and proper offboarding procedures.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello, I understand you're looking to cancel your service. Before we proceed, I'd like to understand your situation and see if there's anything we can do to address your concerns.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-cancellation-reason",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Cancellation Reason",
          config: {
            type: "question",
            question: "May I ask what's prompting this decision?",
            variableName: "cancellation_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-saveable",
        type: "condition",
        position: { x: 250, y: 290 },
        data: {
          type: "condition",
          label: "Retention Opportunity?",
          config: {
            type: "condition",
            condition: "The issue could potentially be resolved with a retention offer",
          },
        },
      },
      {
        id: "node-retention-offer",
        type: "message",
        position: { x: 450, y: 410 },
        data: {
          type: "message",
          label: "Retention Offer",
          config: {
            type: "message",
            message: "I completely understand. What if I could offer you {retention_offer}? This would help with {pain_point_addressed} that you mentioned.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-accepted",
        type: "condition",
        position: { x: 450, y: 530 },
        data: {
          type: "condition",
          label: "Offer Accepted?",
          config: {
            type: "condition",
            condition: "The customer accepts the retention offer",
          },
        },
      },
      {
        id: "node-apply-retention",
        type: "webhook",
        position: { x: 600, y: 650 },
        data: {
          type: "webhook",
          label: "Apply Retention",
          config: {
            type: "webhook",
            url: "https://your-api.com/apply-retention",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "apply_offer" },
            description: "Apply retention offer to account",
          },
        },
      },
      {
        id: "node-end-retained",
        type: "end",
        position: { x: 600, y: 770 },
        data: {
          type: "end",
          label: "Customer Retained",
          config: {
            type: "end",
            endMessage: "Done, that's been applied to your account. You should see it right away. And thanks for sticking with us!",
          },
        },
      },
      {
        id: "node-process-cancel",
        type: "webhook",
        position: { x: 250, y: 650 },
        data: {
          type: "webhook",
          label: "Process Cancellation",
          config: {
            type: "webhook",
            url: "https://your-api.com/cancel-service",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "cancel" },
            description: "Process service cancellation",
          },
        },
      },
      {
        id: "node-confirm-cancel",
        type: "message",
        position: { x: 250, y: 770 },
        data: {
          type: "message",
          label: "Confirm Cancellation",
          config: {
            type: "message",
            message: "Your cancellation has been processed. Your service will remain active until {end_date}. You'll receive a confirmation email with final billing details.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-feedback",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Exit Feedback",
          config: {
            type: "question",
            question: "Before you go, is there any feedback you'd like to share that could help us improve?",
            variableName: "exit_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-cancelled",
        type: "end",
        position: { x: 250, y: 1010 },
        data: {
          type: "end",
          label: "Cancellation Complete",
          config: {
            type: "end",
            endMessage: "Thank you for your feedback and for being a customer. We're sorry to see you go. If you ever want to return, we'd be happy to welcome you back. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-cancellation-reason" },
      { id: "e2", source: "node-cancellation-reason", target: "node-check-saveable" },
      { id: "e3", source: "node-check-saveable", sourceHandle: "true", target: "node-retention-offer" },
      { id: "e4", source: "node-check-saveable", sourceHandle: "false", target: "node-process-cancel" },
      { id: "e5", source: "node-retention-offer", target: "node-check-accepted" },
      { id: "e6", source: "node-check-accepted", sourceHandle: "true", target: "node-apply-retention" },
      { id: "e7", source: "node-check-accepted", sourceHandle: "false", target: "node-process-cancel" },
      { id: "e8", source: "node-apply-retention", target: "node-end-retained" },
      { id: "e9", source: "node-process-cancel", target: "node-confirm-cancel" },
      { id: "e10", source: "node-confirm-cancel", target: "node-feedback" },
      { id: "e11", source: "node-feedback", target: "node-end-cancelled" },
    ],
  },

  // Template 32: Escalation Handler
  {
    id: "template-escalation-handler",
    name: "Escalation Handler",
    description: "Handle escalated calls professionally, document the issue, and connect with appropriate personnel.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Professional Greeting",
          config: {
            type: "message",
            message: "Hello, I understand you've been transferred and may be frustrated. I'm here to listen and help resolve your issue. Please share what's happened so far.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-gather-history",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Case History",
          config: {
            type: "question",
            question: "Can you tell me your case or ticket number if you have one?",
            variableName: "case_number",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-acknowledge",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Acknowledge Issue",
          config: {
            type: "message",
            message: "I can see the notes from your previous interactions. I apologize for the experience you've had. Let me take ownership of this and work on a resolution.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-resolution-authority",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Can Resolve?",
          config: {
            type: "condition",
            condition: "The issue can be resolved at this escalation level",
          },
        },
      },
      {
        id: "node-propose-resolution",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Propose Resolution",
          config: {
            type: "message",
            message: "Here's what I can do to make this right: {resolution_proposal}. I have the authority to implement this immediately. Does this work for you?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-implement",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Implement Resolution",
          config: {
            type: "webhook",
            url: "https://your-crm.com/escalations/resolve",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "resolve_escalation" },
            description: "Implement escalation resolution",
          },
        },
      },
      {
        id: "node-end-resolved",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Escalation Resolved",
          config: {
            type: "end",
            endMessage: "I've implemented the resolution. You should see this reflected in your account. I've also made notes to prevent this from happening again. Thank you for your patience.",
          },
        },
      },
      {
        id: "node-transfer-manager",
        type: "transfer",
        position: { x: 50, y: 530 },
        data: {
          type: "transfer",
          label: "Transfer to Manager",
          config: {
            type: "transfer",
            transferNumber: "+1234567899",
            message: "This requires my manager's authorization. Let me connect you with them directly. I've briefed them on your situation.",
          },
        },
      },
      {
        id: "node-end-transferred",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Transferred to Manager",
          config: {
            type: "end",
            endMessage: "Transferring you now. Thank you for your patience.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-gather-history" },
      { id: "e2", source: "node-gather-history", target: "node-acknowledge" },
      { id: "e3", source: "node-acknowledge", target: "node-resolution-authority" },
      { id: "e4", source: "node-resolution-authority", sourceHandle: "true", target: "node-propose-resolution" },
      { id: "e5", source: "node-resolution-authority", sourceHandle: "false", target: "node-transfer-manager" },
      { id: "e6", source: "node-propose-resolution", target: "node-implement" },
      { id: "e7", source: "node-implement", target: "node-end-resolved" },
      { id: "e8", source: "node-transfer-manager", target: "node-end-transferred" },
    ],
  },

  // Template 33: Warranty Claim
  {
    id: "template-warranty-claim",
    name: "Warranty Claim",
    description: "Process warranty claims by verifying purchase, assessing the issue, and initiating replacement or repair.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I'm here to help you with your warranty claim. Let me gather some information to get this processed for you.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-product-info",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Product Information",
          config: {
            type: "question",
            question: "What product are you filing the warranty claim for, and do you have the serial number or order number?",
            variableName: "product_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-warranty",
        type: "webhook",
        position: { x: 250, y: 290 },
        data: {
          type: "webhook",
          label: "Verify Warranty",
          config: {
            type: "webhook",
            url: "https://your-api.com/warranty/verify",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "verify_warranty" },
            description: "Check warranty status",
          },
        },
      },
      {
        id: "node-check-warranty",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Under Warranty?",
          config: {
            type: "condition",
            condition: "The product is still under warranty",
          },
        },
      },
      {
        id: "node-describe-issue",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Describe Issue",
          config: {
            type: "question",
            question: "Good news - your product is covered under warranty until {warranty_end_date}. Can you describe the issue you're experiencing?",
            variableName: "issue_description",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-resolution-options",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Resolution Options",
          config: {
            type: "message",
            message: "Based on what you've described, we can offer {warranty_options}. Which option would you prefer?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-claim",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Process Claim",
          config: {
            type: "webhook",
            url: "https://your-api.com/warranty/claims",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "create_claim" },
            description: "Create warranty claim",
          },
        },
      },
      {
        id: "node-end-claimed",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Claim Submitted",
          config: {
            type: "end",
            endMessage: "Your warranty claim has been submitted. Your claim number is {claim_number}. You'll receive an email with shipping instructions. Thank you for choosing our products!",
          },
        },
      },
      {
        id: "node-expired",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Warranty Expired",
          config: {
            type: "message",
            message: "I'm sorry, but the warranty on this product expired on {expiry_date}. However, we do offer out-of-warranty repair services. Would you like to hear about those options?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-expired",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Warranty Expired",
          config: {
            type: "end",
            endMessage: "I'll send you information about our repair services and pricing. If you decide to proceed, you can call back or use our website. Thank you for reaching out!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-product-info" },
      { id: "e2", source: "node-product-info", target: "node-verify-warranty" },
      { id: "e3", source: "node-verify-warranty", target: "node-check-warranty" },
      { id: "e4", source: "node-check-warranty", sourceHandle: "true", target: "node-describe-issue" },
      { id: "e5", source: "node-check-warranty", sourceHandle: "false", target: "node-expired" },
      { id: "e6", source: "node-describe-issue", target: "node-resolution-options" },
      { id: "e7", source: "node-resolution-options", target: "node-process-claim" },
      { id: "e8", source: "node-process-claim", target: "node-end-claimed" },
      { id: "e9", source: "node-expired", target: "node-end-expired" },
    ],
  },

  // Template 34: Refund Request
  {
    id: "template-refund-request",
    name: "Refund Request",
    description: "Handle refund requests by verifying eligibility, understanding the reason, and processing or escalating appropriately.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I understand you'd like to request a refund. I'll be happy to help you with that. Let me look up your order.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-order-info",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Order Information",
          config: {
            type: "question",
            question: "Can you provide your order number or the email address used for the purchase?",
            variableName: "order_identifier",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-order",
        type: "webhook",
        position: { x: 250, y: 290 },
        data: {
          type: "webhook",
          label: "Lookup Order",
          config: {
            type: "webhook",
            url: "https://your-api.com/orders/lookup",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "lookup" },
            description: "Look up order details",
          },
        },
      },
      {
        id: "node-refund-reason",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Refund Reason",
          config: {
            type: "question",
            question: "I found your order for {order_items} from {order_date}. May I ask the reason for the refund request?",
            variableName: "refund_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-eligible",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Eligible for Refund?",
          config: {
            type: "condition",
            condition: "The order is within the refund period and meets refund criteria",
          },
        },
      },
      {
        id: "node-process-refund",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Process Refund",
          config: {
            type: "webhook",
            url: "https://your-api.com/refunds",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "process_refund" },
            description: "Process the refund",
          },
        },
      },
      {
        id: "node-end-refunded",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Refund Processed",
          config: {
            type: "end",
            endMessage: "Your refund of {refund_amount} has been processed. It will appear on your original payment method within {processing_time}. You'll receive a confirmation email shortly. Is there anything else I can help with?",
          },
        },
      },
      {
        id: "node-not-eligible",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Not Eligible",
          config: {
            type: "message",
            message: "I'm sorry, but this order doesn't meet our standard refund criteria because {reason}. However, I can offer you {alternative_options} instead. Would either of those work for you?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-alternative",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Alternative Offered",
          config: {
            type: "end",
            endMessage: "I've processed that for you. If you have any other questions, please don't hesitate to reach out. Thank you for your understanding!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-order-info" },
      { id: "e2", source: "node-order-info", target: "node-verify-order" },
      { id: "e3", source: "node-verify-order", target: "node-refund-reason" },
      { id: "e4", source: "node-refund-reason", target: "node-check-eligible" },
      { id: "e5", source: "node-check-eligible", sourceHandle: "true", target: "node-process-refund" },
      { id: "e6", source: "node-check-eligible", sourceHandle: "false", target: "node-not-eligible" },
      { id: "e7", source: "node-process-refund", target: "node-end-refunded" },
      { id: "e8", source: "node-not-eligible", target: "node-end-alternative" },
    ],
  },

  // Template 35: Shipping Status
  {
    id: "template-shipping-status",
    name: "Shipping Status",
    description: "Provide order shipping status, tracking information, and estimated delivery dates to customers.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I can help you check on your order status. Let me look that up for you.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-get-order",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Order Number",
          config: {
            type: "question",
            question: "Can you provide your order number or the email address associated with your order?",
            variableName: "order_identifier",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-lookup-status",
        type: "webhook",
        position: { x: 250, y: 290 },
        data: {
          type: "webhook",
          label: "Check Shipping",
          config: {
            type: "webhook",
            url: "https://your-api.com/shipping/status",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "check_status" },
            description: "Check shipping status",
          },
        },
      },
      {
        id: "node-provide-status",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Provide Status",
          config: {
            type: "message",
            message: "I found your order! Your package is currently {shipping_status}. It was last scanned at {last_location} on {last_update}. The estimated delivery date is {estimated_delivery}.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-issue",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Delivery Issue?",
          config: {
            type: "condition",
            condition: "The customer has a concern about the shipping or delivery",
          },
        },
      },
      {
        id: "node-address-issue",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Address Issue",
          config: {
            type: "question",
            question: "I'm sorry to hear there's a concern. Can you tell me more about the issue you're experiencing?",
            variableName: "shipping_issue",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-create-ticket",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Create Shipping Ticket",
          config: {
            type: "webhook",
            url: "https://your-api.com/shipping/issues",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "shipping_issue" },
            description: "Create shipping issue ticket",
          },
        },
      },
      {
        id: "node-end-issue",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Issue Logged",
          config: {
            type: "end",
            endMessage: "I've opened a case for your shipping issue. Our logistics team will investigate and contact you within 24 hours. Your case number is {case_number}. Is there anything else I can help with?",
          },
        },
      },
      {
        id: "node-send-tracking",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Send Tracking",
          config: {
            type: "webhook",
            url: "https://your-api.com/send-tracking",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_tracking_link" },
            description: "Send tracking link to customer",
          },
        },
      },
      {
        id: "node-end-ok",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Status Provided",
          config: {
            type: "end",
            endMessage: "I've sent you a text with the tracking link so you can follow along. Your package should arrive soon! Is there anything else I can help you with?",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-get-order" },
      { id: "e2", source: "node-get-order", target: "node-lookup-status" },
      { id: "e3", source: "node-lookup-status", target: "node-provide-status" },
      { id: "e4", source: "node-provide-status", target: "node-check-issue" },
      { id: "e5", source: "node-check-issue", sourceHandle: "true", target: "node-address-issue" },
      { id: "e6", source: "node-check-issue", sourceHandle: "false", target: "node-send-tracking" },
      { id: "e7", source: "node-address-issue", target: "node-create-ticket" },
      { id: "e8", source: "node-create-ticket", target: "node-end-issue" },
      { id: "e9", source: "node-send-tracking", target: "node-end-ok" },
    ],
  },

  // Template 36: Product Return
  {
    id: "template-product-return",
    name: "Product Return",
    description: "Process product returns by verifying eligibility, generating return labels, and providing return instructions.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I can help you start a return. Let me gather some information about your order.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-order-info",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Order Information",
          config: {
            type: "question",
            question: "What is your order number or the email used for the purchase?",
            variableName: "order_identifier",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-which-item",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Item to Return",
          config: {
            type: "question",
            question: "Which item from your order would you like to return?",
            variableName: "return_item",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-return-reason",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Return Reason",
          config: {
            type: "question",
            question: "What's the reason for the return?",
            variableName: "return_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-eligible",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Return Eligible?",
          config: {
            type: "condition",
            condition: "The item is within the return window and meets return criteria",
          },
        },
      },
      {
        id: "node-generate-label",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Generate Return Label",
          config: {
            type: "webhook",
            url: "https://your-api.com/returns/create",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "create_return" },
            description: "Generate return authorization and shipping label",
          },
        },
      },
      {
        id: "node-instructions",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Return Instructions",
          config: {
            type: "message",
            message: "I've created your return. Your RMA number is {rma_number}. I'll email you a prepaid return label. Please pack the item securely and drop it off at any {carrier_name} location. Your refund will be processed within {processing_days} days of receiving the item.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end-return",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Return Created",
          config: {
            type: "end",
            endMessage: "You're all set! Check your email for the return label. Is there anything else I can help you with today?",
          },
        },
      },
      {
        id: "node-not-eligible",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Not Eligible",
          config: {
            type: "message",
            message: "I'm sorry, but this item isn't eligible for return because {ineligibility_reason}. However, I can connect you with a supervisor to discuss options, or I can offer store credit. What would you prefer?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-not-eligible",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Alternative Offered",
          config: {
            type: "end",
            endMessage: "Thank you for understanding. I've noted your request and we'll follow up with you shortly. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-order-info" },
      { id: "e2", source: "node-order-info", target: "node-which-item" },
      { id: "e3", source: "node-which-item", target: "node-return-reason" },
      { id: "e4", source: "node-return-reason", target: "node-check-eligible" },
      { id: "e5", source: "node-check-eligible", sourceHandle: "true", target: "node-generate-label" },
      { id: "e6", source: "node-check-eligible", sourceHandle: "false", target: "node-not-eligible" },
      { id: "e7", source: "node-generate-label", target: "node-instructions" },
      { id: "e8", source: "node-instructions", target: "node-end-return" },
      { id: "e9", source: "node-not-eligible", target: "node-end-not-eligible" },
    ],
  },

  // Template 37: FAQ Bot
  {
    id: "template-faq-bot",
    name: "FAQ Bot",
    description: "Answer common questions automatically and escalate complex inquiries to live agents.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I'm an automated assistant and I can help answer common questions about our products, services, and policies. What would you like to know?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-categorize",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Question Category",
          config: {
            type: "question",
            question: "I can help with questions about: Pricing, Shipping, Returns, Account, or Products. Which category is your question about?",
            variableName: "question_category",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-provide-answer",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Provide Answer",
          config: {
            type: "message",
            message: "{faq_answer}",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-satisfied",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Question Answered?",
          config: {
            type: "condition",
            condition: "The customer's question was answered satisfactorily",
          },
        },
      },
      {
        id: "node-another-question",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Another Question",
          config: {
            type: "question",
            question: "Is there anything else I can help you with?",
            variableName: "has_more_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end-satisfied",
        type: "end",
        position: { x: 450, y: 650 },
        data: {
          type: "end",
          label: "FAQ Complete",
          config: {
            type: "end",
            endMessage: "I'm glad I could help! Have a great day! If you need further assistance, you can always call back or chat with us online.",
          },
        },
      },
      {
        id: "node-transfer-live",
        type: "transfer",
        position: { x: 50, y: 530 },
        data: {
          type: "transfer",
          label: "Transfer to Agent",
          config: {
            type: "transfer",
            transferNumber: "+1234567890",
            message: "I'll connect you with a live agent who can better assist with your question. Please hold.",
          },
        },
      },
      {
        id: "node-end-transferred",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Transferred",
          config: {
            type: "end",
            endMessage: "Transferring you now. Thank you for your patience!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-categorize" },
      { id: "e2", source: "node-categorize", target: "node-provide-answer" },
      { id: "e3", source: "node-provide-answer", target: "node-check-satisfied" },
      { id: "e4", source: "node-check-satisfied", sourceHandle: "true", target: "node-another-question" },
      { id: "e5", source: "node-check-satisfied", sourceHandle: "false", target: "node-transfer-live" },
      { id: "e6", source: "node-another-question", target: "node-end-satisfied" },
      { id: "e7", source: "node-transfer-live", target: "node-end-transferred" },
    ],
  },

  // Template 38: Feature Request
  {
    id: "template-feature-request",
    name: "Feature Request",
    description: "Collect product or feature suggestions from customers and log them for the product team.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for taking the time to share your ideas with us. We love hearing from our customers about how we can improve. What feature or improvement would you like to suggest?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-feature-details",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Feature Details",
          config: {
            type: "question",
            question: "Can you describe the feature in more detail? What problem would it solve for you?",
            variableName: "feature_description",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-use-case",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Use Case",
          config: {
            type: "question",
            question: "How would you use this feature in your daily workflow?",
            variableName: "use_case",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-priority",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Priority",
          config: {
            type: "question",
            question: "How important is this feature to you? Would you say it's nice-to-have or essential for your work?",
            variableName: "feature_priority",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-request",
        type: "webhook",
        position: { x: 250, y: 530 },
        data: {
          type: "webhook",
          label: "Submit Request",
          config: {
            type: "webhook",
            url: "https://your-api.com/feature-requests",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "feature_request" },
            description: "Submit feature request to product team",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 650 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Thank you for this valuable feedback! I've submitted your feature request to our product team. They review all suggestions and prioritize based on customer impact. Your request ID is {request_id}.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 770 },
        data: {
          type: "end",
          label: "Request Submitted",
          config: {
            type: "end",
            endMessage: "We really appreciate you helping us improve our product. If this feature moves forward, we may reach out for more input. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-feature-details" },
      { id: "e2", source: "node-feature-details", target: "node-use-case" },
      { id: "e3", source: "node-use-case", target: "node-priority" },
      { id: "e4", source: "node-priority", target: "node-submit-request" },
      { id: "e5", source: "node-submit-request", target: "node-confirmation" },
      { id: "e6", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template 39: Past Due Payment Reminder
  // ============================================
  {
    id: "template-past-due-reminder",
    name: "Past Due Payment Reminder",
    description: "Remind customers about overdue payments, verify account information, offer payment options, and arrange payment or callback.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello, this is a courtesy call from the billing department at {company_name}. I'm reaching out regarding your account with an outstanding balance. Is this a good time to discuss?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For security purposes, may I please verify your account by confirming the last four digits of your phone number or account number on file?",
            variableName: "verification_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-balance",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Explain Balance",
          config: {
            type: "message",
            message: "Thank you for verifying. Our records show you have an outstanding balance of {amount_due} that was due on {due_date}. This is now {days_overdue} days past due.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-payment",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Payment Intent",
          config: {
            type: "question",
            question: "Are you able to make a payment today to bring your account current? We accept credit card, debit card, or bank transfer.",
            variableName: "can_pay_today",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-pay-now",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Can Pay Now?",
          config: {
            type: "condition",
            condition: "The customer confirms they can make a payment today",
          },
        },
      },
      {
        id: "node-payment-transfer",
        type: "transfer",
        position: { x: 450, y: 650 },
        data: {
          type: "transfer",
          label: "Transfer to Payment",
          config: {
            type: "transfer",
            transferNumber: "{payment_line_number}",
            message: "Perfect, I'll get you over to our payment line. Just have your payment method handy. One sec.",
          },
        },
      },
      {
        id: "node-ask-when",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "When Can Pay",
          config: {
            type: "question",
            question: "I understand. When do you expect to be able to make a payment? Can you provide a specific date?",
            variableName: "payment_date",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-promise",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Log Promise",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/payment-promises",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "payment_promise", status: "pending" },
            description: "Log payment promise with expected date",
          },
        },
      },
      {
        id: "node-end-promise",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Promise Recorded",
          config: {
            type: "end",
            endMessage: "Thank you. I've noted that you plan to make a payment on {payment_date}. We'll send you a reminder before that date. Please call us if anything changes. Have a good day!",
          },
        },
      },
      {
        id: "node-end-transfer",
        type: "end",
        position: { x: 450, y: 770 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "Thank you for taking care of this. Your call is being transferred now.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-explain-balance" },
      { id: "e3", source: "node-explain-balance", target: "node-ask-payment" },
      { id: "e4", source: "node-ask-payment", target: "node-check-pay-now" },
      { id: "e5", source: "node-check-pay-now", sourceHandle: "true", target: "node-payment-transfer" },
      { id: "e6", source: "node-check-pay-now", sourceHandle: "false", target: "node-ask-when" },
      { id: "e7", source: "node-payment-transfer", target: "node-end-transfer" },
      { id: "e8", source: "node-ask-when", target: "node-log-promise" },
      { id: "e9", source: "node-log-promise", target: "node-end-promise" },
    ],
  },

  // ============================================
  // Template 40: Collections First Notice
  // ============================================
  {
    id: "template-collections-first-notice",
    name: "Collections First Notice",
    description: "First collections call for accounts significantly past due. Emphasizes resolution options and maintains positive customer relationship.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello, this is {agent_name} calling from {company_name} Collections Department. I'm reaching out about an important matter regarding your account. May I speak with {customer_name}?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For verification purposes, can you please confirm your date of birth or the billing address on file?",
            variableName: "identity_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-state-balance",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "State Balance",
          config: {
            type: "message",
            message: "Thank you. I'm calling because your account shows an outstanding balance of {total_balance} which is now {days_overdue} days past due. We want to help you resolve this before it affects your account standing.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-situation",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Understand Situation",
          config: {
            type: "question",
            question: "I'd like to understand your situation. Is there a specific reason this payment has been delayed?",
            variableName: "delay_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-options",
        type: "message",
        position: { x: 250, y: 530 },
        data: {
          type: "message",
          label: "Offer Options",
          config: {
            type: "message",
            message: "I appreciate you sharing that. We have several options to help you: you can pay the full amount today, set up a payment plan, or speak with a representative about hardship programs.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-preference",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Get Preference",
          config: {
            type: "question",
            question: "Which option would work best for you?",
            variableName: "resolution_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-full-payment",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Full Payment?",
          config: {
            type: "condition",
            condition: "The customer wants to pay the full amount today",
          },
        },
      },
      {
        id: "node-transfer-payment",
        type: "transfer",
        position: { x: 450, y: 890 },
        data: {
          type: "transfer",
          label: "Transfer to Payment",
          config: {
            type: "transfer",
            transferNumber: "{payment_line_number}",
            message: "That's great! I'll transfer you to our payment processing team right now. Thank you for resolving this today.",
          },
        },
      },
      {
        id: "node-log-resolution",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Log Resolution",
          config: {
            type: "webhook",
            url: "https://your-collections-api.com/resolutions",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { notice_type: "first", status: "pending_resolution" },
            description: "Log collection attempt and customer preference",
          },
        },
      },
      {
        id: "node-end-payment",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Payment Transfer",
          config: {
            type: "end",
            endMessage: "Thank you for your cooperation. Your call is being transferred now.",
          },
        },
      },
      {
        id: "node-end-followup",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Follow-up Scheduled",
          config: {
            type: "end",
            endMessage: "I've noted your preference. A specialist will contact you within 24-48 hours to set up the arrangement. Please expect their call. Thank you for working with us on this.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-state-balance" },
      { id: "e3", source: "node-state-balance", target: "node-ask-situation" },
      { id: "e4", source: "node-ask-situation", target: "node-offer-options" },
      { id: "e5", source: "node-offer-options", target: "node-ask-preference" },
      { id: "e6", source: "node-ask-preference", target: "node-check-full-payment" },
      { id: "e7", source: "node-check-full-payment", sourceHandle: "true", target: "node-transfer-payment" },
      { id: "e8", source: "node-check-full-payment", sourceHandle: "false", target: "node-log-resolution" },
      { id: "e9", source: "node-transfer-payment", target: "node-end-payment" },
      { id: "e10", source: "node-log-resolution", target: "node-end-followup" },
    ],
  },

  // ============================================
  // Template 41: Collections Final Notice
  // ============================================
  {
    id: "template-collections-final-notice",
    name: "Collections Final Notice",
    description: "Final collections call before account escalation. Urgent tone with clear consequences and last-chance resolution offers.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Urgent Introduction",
          config: {
            type: "message",
            message: "Hello, this is an urgent call from {company_name} Collections Department. I need to speak with {customer_name} regarding a time-sensitive account matter.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "Before I can discuss your account details, I need to verify your identity. Can you please confirm your full name and the last four digits of your SSN or account number?",
            variableName: "identity_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-final-notice",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Final Notice",
          config: {
            type: "message",
            message: "This is your final notice regarding an outstanding balance of {total_balance}. Your account is now {days_overdue} days past due. Without resolution by {final_deadline}, your account will be referred to an external collection agency, which may impact your credit report.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-resolve",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Resolution Intent",
          config: {
            type: "question",
            question: "To prevent this escalation, can you make a payment today or commit to a payment arrangement?",
            variableName: "resolution_intent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-willing",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Willing to Resolve?",
          config: {
            type: "condition",
            condition: "The customer agrees to make a payment or set up an arrangement",
          },
        },
      },
      {
        id: "node-settlement-offer",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Settlement Offer",
          config: {
            type: "message",
            message: "Thank you for your willingness to resolve this. As this is a final notice, I can offer you a one-time settlement of {settlement_amount}, which is {discount_percent}% off your total balance if paid within 48 hours.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-settlement",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Accept Settlement?",
          config: {
            type: "question",
            question: "Would you like to take advantage of this settlement offer, or would you prefer to discuss a payment plan for the full amount?",
            variableName: "settlement_decision",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-transfer-payment",
        type: "transfer",
        position: { x: 450, y: 890 },
        data: {
          type: "transfer",
          label: "Transfer to Payment",
          config: {
            type: "transfer",
            transferNumber: "{payment_line_number}",
            message: "I'll connect you with our payment team to process this immediately. Please hold.",
          },
        },
      },
      {
        id: "node-log-refusal",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Refusal",
          config: {
            type: "webhook",
            url: "https://your-collections-api.com/escalations",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { notice_type: "final", outcome: "refused", escalate: true },
            description: "Log refusal and trigger escalation process",
          },
        },
      },
      {
        id: "node-end-escalation",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Escalation Warning",
          config: {
            type: "end",
            endMessage: "I'm sorry to hear that. Please be advised that without payment by {final_deadline}, your account will be escalated as discussed. If your situation changes, please call us at {collections_number}. Goodbye.",
          },
        },
      },
      {
        id: "node-end-payment",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Payment Arranged",
          config: {
            type: "end",
            endMessage: "Thank you for resolving this matter. Your call is being transferred to complete the payment.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-final-notice" },
      { id: "e3", source: "node-final-notice", target: "node-ask-resolve" },
      { id: "e4", source: "node-ask-resolve", target: "node-check-willing" },
      { id: "e5", source: "node-check-willing", sourceHandle: "true", target: "node-settlement-offer" },
      { id: "e6", source: "node-check-willing", sourceHandle: "false", target: "node-log-refusal" },
      { id: "e7", source: "node-settlement-offer", target: "node-ask-settlement" },
      { id: "e8", source: "node-ask-settlement", target: "node-transfer-payment" },
      { id: "e9", source: "node-transfer-payment", target: "node-end-payment" },
      { id: "e10", source: "node-log-refusal", target: "node-end-escalation" },
    ],
  },

  // ============================================
  // Template 42: Payment Plan Setup
  // ============================================
  {
    id: "template-payment-plan-setup",
    name: "Payment Plan Setup",
    description: "Help customers establish payment plans for outstanding balances. Collects financial information and sets up automated payments.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! I'm calling from {company_name} to help you set up a payment plan for your account. This is a flexible option that can make managing your balance much easier. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-account",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Account",
          config: {
            type: "question",
            question: "To access your account, can you please verify your account number or the email address on file?",
            variableName: "account_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-balance",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Review Balance",
          config: {
            type: "message",
            message: "Thank you. Your current balance is {total_balance}. We can spread this over several months with affordable installments.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-monthly",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Monthly Amount",
          config: {
            type: "question",
            question: "What monthly payment amount would work best for your budget? We can work with amounts starting from {minimum_payment}.",
            variableName: "monthly_amount",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-calculate-plan",
        type: "message",
        position: { x: 250, y: 530 },
        data: {
          type: "message",
          label: "Calculate Plan",
          config: {
            type: "message",
            message: "Based on that amount, your payment plan would run for approximately {plan_duration} months. Your first payment of {monthly_amount} would be due on {first_payment_date}.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-payment-date",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Payment Date",
          config: {
            type: "question",
            question: "What day of the month works best for your recurring payments? Most customers choose to align with their pay schedule.",
            variableName: "payment_day",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-payment-method",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Payment Method",
          config: {
            type: "question",
            question: "For automatic payments, would you prefer to use a credit card, debit card, or bank account?",
            variableName: "payment_method_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-terms",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Confirm Terms",
          config: {
            type: "question",
            question: "To summarize: you'll pay {monthly_amount} on the {payment_day} of each month for {plan_duration} months, starting {first_payment_date}. Do you agree to these terms?",
            variableName: "terms_agreement",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-setup-webhook",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Create Plan",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/payment-plans",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "active", type: "installment" },
            description: "Create payment plan in billing system",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1130 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Great, your payment plan's all set up. You'll get an email with the details and your payment schedule.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Plan Complete",
          config: {
            type: "end",
            endMessage: "Thank you for setting up your payment plan with us. If you have any questions or need to modify the plan, please call us at {support_number}. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-account" },
      { id: "e2", source: "node-verify-account", target: "node-explain-balance" },
      { id: "e3", source: "node-explain-balance", target: "node-ask-monthly" },
      { id: "e4", source: "node-ask-monthly", target: "node-calculate-plan" },
      { id: "e5", source: "node-calculate-plan", target: "node-ask-payment-date" },
      { id: "e6", source: "node-ask-payment-date", target: "node-ask-payment-method" },
      { id: "e7", source: "node-ask-payment-method", target: "node-confirm-terms" },
      { id: "e8", source: "node-confirm-terms", target: "node-setup-webhook" },
      { id: "e9", source: "node-setup-webhook", target: "node-confirmation" },
      { id: "e10", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template 43: Auto-Pay Enrollment
  // ============================================
  {
    id: "template-auto-pay-enrollment",
    name: "Auto-Pay Enrollment",
    description: "Enroll customers in automatic payment programs. Explains benefits, collects payment details, and sets up recurring billing.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! I'm calling from {company_name} with a quick way to make your billing easier. We offer automatic payments that ensure you never miss a due date and may qualify you for discounts. Do you have a moment to learn more?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-benefits",
        type: "message",
        position: { x: 250, y: 170 },
        data: {
          type: "message",
          label: "Explain Benefits",
          config: {
            type: "message",
            message: "With Auto-Pay, your payments are processed automatically each billing cycle. Benefits include: no late fees, a {autopay_discount}% discount on your bill, paperless convenience, and one less thing to remember each month.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-interest",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Interest Check",
          config: {
            type: "question",
            question: "Would you like to enroll in Auto-Pay today and start saving?",
            variableName: "enrollment_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Interested?",
          config: {
            type: "condition",
            condition: "The customer expresses interest in enrolling",
          },
        },
      },
      {
        id: "node-verify-account",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Verify Account",
          config: {
            type: "question",
            question: "Perfect! To set this up, can you please verify your account number or the email address associated with your account?",
            variableName: "account_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-method",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Payment Method",
          config: {
            type: "question",
            question: "Which payment method would you like to use for Auto-Pay? We accept credit cards, debit cards, and bank accounts.",
            variableName: "payment_method",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-billing-date",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Billing Date",
          config: {
            type: "question",
            question: "Your current billing cycle is on the {current_billing_day} of each month. Would you like to keep this date or change it to better align with your schedule?",
            variableName: "preferred_billing_date",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-enrollment",
        type: "question",
        position: { x: 450, y: 890 },
        data: {
          type: "question",
          label: "Confirm Enrollment",
          config: {
            type: "question",
            question: "To confirm: I'll set up Auto-Pay using your {payment_method}, with payments processed on the {preferred_billing_date} of each month. You authorize us to charge your account automatically. Do you agree?",
            variableName: "enrollment_confirmation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-enroll-webhook",
        type: "webhook",
        position: { x: 450, y: 1010 },
        data: {
          type: "webhook",
          label: "Process Enrollment",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/autopay/enroll",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "enrolled", discount_applied: true },
            description: "Enroll customer in Auto-Pay program",
          },
        },
      },
      {
        id: "node-end-enrolled",
        type: "end",
        position: { x: 450, y: 1130 },
        data: {
          type: "end",
          label: "Enrollment Complete",
          config: {
            type: "end",
            endMessage: "You're all set! Your Auto-Pay enrollment is complete and your {autopay_discount}% discount will be applied starting with your next bill. You'll receive a confirmation email shortly. Thank you and have a great day!",
          },
        },
      },
      {
        id: "node-log-declined",
        type: "webhook",
        position: { x: 50, y: 530 },
        data: {
          type: "webhook",
          label: "Log Decline",
          config: {
            type: "webhook",
            url: "https://your-crm.com/autopay-offers",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { outcome: "declined", follow_up: true },
            description: "Log declined Auto-Pay offer for future follow-up",
          },
        },
      },
      {
        id: "node-end-declined",
        type: "end",
        position: { x: 50, y: 650 },
        data: {
          type: "end",
          label: "Not Enrolled",
          config: {
            type: "end",
            endMessage: "No problem at all! If you change your mind, you can enroll in Auto-Pay anytime through your online account or by calling us. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-explain-benefits" },
      { id: "e2", source: "node-explain-benefits", target: "node-ask-interest" },
      { id: "e3", source: "node-ask-interest", target: "node-check-interest" },
      { id: "e4", source: "node-check-interest", sourceHandle: "true", target: "node-verify-account" },
      { id: "e5", source: "node-check-interest", sourceHandle: "false", target: "node-log-declined" },
      { id: "e6", source: "node-verify-account", target: "node-ask-method" },
      { id: "e7", source: "node-ask-method", target: "node-ask-billing-date" },
      { id: "e8", source: "node-ask-billing-date", target: "node-confirm-enrollment" },
      { id: "e9", source: "node-confirm-enrollment", target: "node-enroll-webhook" },
      { id: "e10", source: "node-enroll-webhook", target: "node-end-enrolled" },
      { id: "e11", source: "node-log-declined", target: "node-end-declined" },
    ],
  },

  // ============================================
  // Template 44: Payment Method Update
  // ============================================
  {
    id: "template-payment-method-update",
    name: "Payment Method Update",
    description: "Help customers update their payment methods on file. Handles expired cards, new payment details, and verification.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! I'm calling from {company_name} regarding the payment method on your account. We need to update your information to ensure uninterrupted service. Is this a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For security purposes, can you please verify your account by providing your full name and the last four digits of your current payment method?",
            variableName: "identity_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-reason",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Explain Reason",
          config: {
            type: "message",
            message: "Thank you for verifying. The reason for this call is that your current payment method ending in {last_four_digits} needs to be updated. This could be due to expiration, a declined transaction, or a card replacement.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-update-type",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Update Type",
          config: {
            type: "question",
            question: "Would you like to update your existing card with new details, or would you prefer to add a completely different payment method?",
            variableName: "update_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-new-method",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "New Method Type",
          config: {
            type: "question",
            question: "What type of payment method would you like to use? We accept Visa, Mastercard, American Express, Discover, and bank accounts.",
            variableName: "new_payment_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-transfer-secure",
        type: "transfer",
        position: { x: 250, y: 650 },
        data: {
          type: "transfer",
          label: "Secure Transfer",
          config: {
            type: "transfer",
            transferNumber: "{secure_payment_line}",
            message: "For your security, I'll transfer you to our secure payment line where you can safely enter your new payment details. The system uses encryption to protect your information.",
          },
        },
      },
      {
        id: "node-log-update",
        type: "webhook",
        position: { x: 250, y: 770 },
        data: {
          type: "webhook",
          label: "Log Update Request",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/payment-updates",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "payment_method_update", status: "in_progress" },
            description: "Log payment method update attempt",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 890 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "Your call is being transferred to our secure payment system. Thank you for updating your payment information with us!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-explain-reason" },
      { id: "e3", source: "node-explain-reason", target: "node-ask-update-type" },
      { id: "e4", source: "node-ask-update-type", target: "node-ask-new-method" },
      { id: "e5", source: "node-ask-new-method", target: "node-transfer-secure" },
      { id: "e6", source: "node-transfer-secure", target: "node-log-update" },
      { id: "e7", source: "node-log-update", target: "node-end" },
    ],
  },

  // ============================================
  // Template 45: Billing Dispute Resolution
  // ============================================
  {
    id: "template-dispute-resolution",
    name: "Billing Dispute Resolution",
    description: "Handle billing disputes and charge inquiries. Collects dispute details, verifies charges, and routes to appropriate resolution paths.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello, I'm calling from {company_name} billing department. I understand you have a question about a charge on your account. I'm here to help resolve this for you. May I have a few minutes of your time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-account",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Account",
          config: {
            type: "question",
            question: "To pull up your account, can you please verify your account number or the phone number associated with your account?",
            variableName: "account_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-dispute-details",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Dispute Details",
          config: {
            type: "question",
            question: "Can you tell me which charge you're disputing? Please share the amount and approximate date if you have it.",
            variableName: "disputed_charge",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Dispute Reason",
          config: {
            type: "question",
            question: "I found that charge. Can you explain why you believe this charge is incorrect? For example, was it unauthorized, a duplicate, or for a service you didn't receive?",
            variableName: "dispute_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-valid",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Valid Dispute?",
          config: {
            type: "condition",
            condition: "The dispute reason appears valid and requires investigation or credit",
          },
        },
      },
      {
        id: "node-explain-charge",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Explain Charge",
          config: {
            type: "message",
            message: "I've reviewed your account and this charge of {charge_amount} is for {charge_description} from {charge_date}. Based on our records, this appears to be a valid charge for services rendered.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-satisfied",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Check Satisfaction",
          config: {
            type: "question",
            question: "Does this explanation resolve your concern, or would you like me to escalate this to a supervisor for further review?",
            variableName: "resolution_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-create-case",
        type: "webhook",
        position: { x: 450, y: 650 },
        data: {
          type: "webhook",
          label: "Create Dispute Case",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/disputes",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "open", priority: "normal" },
            description: "Create billing dispute case for investigation",
          },
        },
      },
      {
        id: "node-confirm-case",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Confirm Case",
          config: {
            type: "message",
            message: "I've opened a dispute case for you. Your case number is {case_number}. Our billing team will investigate and you'll receive a resolution within 5-7 business days via email.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end-resolved",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Resolved",
          config: {
            type: "end",
            endMessage: "I'm glad I could help clarify this for you. Is there anything else I can assist you with today? If not, thank you for being a valued customer. Have a great day!",
          },
        },
      },
      {
        id: "node-end-case-created",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Case Created",
          config: {
            type: "end",
            endMessage: "Thank you for bringing this to our attention. We take billing accuracy seriously. You'll hear from us soon with the resolution. Have a good day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-account" },
      { id: "e2", source: "node-verify-account", target: "node-ask-dispute-details" },
      { id: "e3", source: "node-ask-dispute-details", target: "node-ask-reason" },
      { id: "e4", source: "node-ask-reason", target: "node-check-valid" },
      { id: "e5", source: "node-check-valid", sourceHandle: "true", target: "node-create-case" },
      { id: "e6", source: "node-check-valid", sourceHandle: "false", target: "node-explain-charge" },
      { id: "e7", source: "node-explain-charge", target: "node-ask-satisfied" },
      { id: "e8", source: "node-ask-satisfied", target: "node-end-resolved" },
      { id: "e9", source: "node-create-case", target: "node-confirm-case" },
      { id: "e10", source: "node-confirm-case", target: "node-end-case-created" },
    ],
  },

  // ============================================
  // Template 46: Credit Card Expiration Notice
  // ============================================
  {
    id: "template-credit-card-expired",
    name: "Credit Card Expiration Notice",
    description: "Proactively notify customers about expiring credit cards and collect updated payment information to prevent service interruption.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi, this is {agent_name} from {company_name}. I'm calling with an important notice about your payment method. The credit card ending in {last_four_digits} on your account expires {expiration_date}. May I help you update this now to avoid any interruption to your service?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-available",
        type: "condition",
        position: { x: 250, y: 170 },
        data: {
          type: "condition",
          label: "Available Now?",
          config: {
            type: "condition",
            condition: "The customer confirms they have time to update their card now",
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 450, y: 290 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "Perfect! For security, can you please verify the billing zip code associated with your current card?",
            variableName: "billing_zip",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-same-card",
        type: "question",
        position: { x: 450, y: 410 },
        data: {
          type: "question",
          label: "Same Card?",
          config: {
            type: "question",
            question: "Do you have a replacement card with the same number but a new expiration date, or will you be providing a completely new card?",
            variableName: "card_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-same-card",
        type: "condition",
        position: { x: 450, y: 530 },
        data: {
          type: "condition",
          label: "Same Card Number?",
          config: {
            type: "condition",
            condition: "Customer has replacement card with same number",
          },
        },
      },
      {
        id: "node-ask-new-expiry",
        type: "question",
        position: { x: 300, y: 650 },
        data: {
          type: "question",
          label: "New Expiry",
          config: {
            type: "question",
            question: "Great, I just need the new expiration date. What month and year?",
            variableName: "new_expiration",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-cvv",
        type: "question",
        position: { x: 300, y: 770 },
        data: {
          type: "question",
          label: "Security Code",
          config: {
            type: "question",
            question: "And the 3 or 4 digit security code on the back of your card?",
            variableName: "security_code",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-transfer-new-card",
        type: "transfer",
        position: { x: 600, y: 650 },
        data: {
          type: "transfer",
          label: "Transfer for New Card",
          config: {
            type: "transfer",
            transferNumber: "{secure_payment_line}",
            message: "I'll transfer you to our secure line to safely enter your new card details. One moment please.",
          },
        },
      },
      {
        id: "node-update-webhook",
        type: "webhook",
        position: { x: 300, y: 890 },
        data: {
          type: "webhook",
          label: "Update Card",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/payment-methods/update",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { update_type: "expiration", status: "updated" },
            description: "Update card expiration date in billing system",
          },
        },
      },
      {
        id: "node-schedule-callback",
        type: "question",
        position: { x: 50, y: 290 },
        data: {
          type: "question",
          label: "Schedule Callback",
          config: {
            type: "question",
            question: "No problem! When would be a better time for us to call back? We want to make sure your service isn't interrupted.",
            variableName: "callback_time",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-callback",
        type: "webhook",
        position: { x: 50, y: 410 },
        data: {
          type: "webhook",
          label: "Log Callback",
          config: {
            type: "webhook",
            url: "https://your-crm.com/callbacks",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { reason: "card_expiration", priority: "high" },
            description: "Schedule callback for card update",
          },
        },
      },
      {
        id: "node-end-updated",
        type: "end",
        position: { x: 300, y: 1010 },
        data: {
          type: "end",
          label: "Card Updated",
          config: {
            type: "end",
            endMessage: "Your card has been successfully updated! Your next payment will process as scheduled with no interruption. You'll receive a confirmation email shortly. Thank you and have a great day!",
          },
        },
      },
      {
        id: "node-end-callback",
        type: "end",
        position: { x: 50, y: 530 },
        data: {
          type: "end",
          label: "Callback Scheduled",
          config: {
            type: "end",
            endMessage: "I've scheduled a callback for {callback_time}. Please have your new card ready. You can also update online at any time at {website_url}. Have a good day!",
          },
        },
      },
      {
        id: "node-end-transfer",
        type: "end",
        position: { x: 600, y: 770 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "You're being transferred to our secure payment system now. Thank you!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-check-available" },
      { id: "e2", source: "node-check-available", sourceHandle: "true", target: "node-verify-identity" },
      { id: "e3", source: "node-check-available", sourceHandle: "false", target: "node-schedule-callback" },
      { id: "e4", source: "node-verify-identity", target: "node-ask-same-card" },
      { id: "e5", source: "node-ask-same-card", target: "node-check-same-card" },
      { id: "e6", source: "node-check-same-card", sourceHandle: "true", target: "node-ask-new-expiry" },
      { id: "e7", source: "node-check-same-card", sourceHandle: "false", target: "node-transfer-new-card" },
      { id: "e8", source: "node-ask-new-expiry", target: "node-ask-cvv" },
      { id: "e9", source: "node-ask-cvv", target: "node-update-webhook" },
      { id: "e10", source: "node-update-webhook", target: "node-end-updated" },
      { id: "e11", source: "node-schedule-callback", target: "node-log-callback" },
      { id: "e12", source: "node-log-callback", target: "node-end-callback" },
      { id: "e13", source: "node-transfer-new-card", target: "node-end-transfer" },
    ],
  },

  // ============================================
  // Template 47: Invoice Follow-up
  // ============================================
  {
    id: "template-invoice-followup",
    name: "Invoice Follow-up",
    description: "Follow up on unpaid invoices, confirm receipt, address concerns, and facilitate payment. Professional B2B collection approach.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Good day! This is {agent_name} calling from {company_name} accounts receivable. I'm following up on invoice number {invoice_number} dated {invoice_date}. May I speak with someone in your accounts payable department?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-contact",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Contact",
          config: {
            type: "question",
            question: "May I have your name and position for my records?",
            variableName: "contact_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-receipt",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Confirm Receipt",
          config: {
            type: "question",
            question: "I'm calling about invoice {invoice_number} for {invoice_amount}. Can you confirm you've received this invoice?",
            variableName: "invoice_received",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-received",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Invoice Received?",
          config: {
            type: "condition",
            condition: "The customer confirms they received the invoice",
          },
        },
      },
      {
        id: "node-ask-payment-status",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Payment Status",
          config: {
            type: "question",
            question: "Can you tell me the status of this payment? Has it been scheduled, is it in your payment queue, or are there any issues holding it up?",
            variableName: "payment_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-resend",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Offer Resend",
          config: {
            type: "message",
            message: "I apologize for any inconvenience. Let me resend the invoice right away to ensure you have it.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Confirm Email",
          config: {
            type: "question",
            question: "What's the best email address to send the invoice to?",
            variableName: "ap_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-issue",
        type: "condition",
        position: { x: 450, y: 650 },
        data: {
          type: "condition",
          label: "Any Issues?",
          config: {
            type: "condition",
            condition: "There are issues or disputes with the invoice",
          },
        },
      },
      {
        id: "node-ask-expected-date",
        type: "question",
        position: { x: 600, y: 770 },
        data: {
          type: "question",
          label: "Expected Date",
          config: {
            type: "question",
            question: "When can we expect to receive payment?",
            variableName: "expected_payment_date",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-issue-details",
        type: "question",
        position: { x: 300, y: 770 },
        data: {
          type: "question",
          label: "Issue Details",
          config: {
            type: "question",
            question: "I'd like to help resolve this. Can you explain what the issue is with the invoice?",
            variableName: "issue_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-followup",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Log Follow-up",
          config: {
            type: "webhook",
            url: "https://your-ar-api.com/invoice-followups",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "followup", status: "contacted" },
            description: "Log invoice follow-up and customer response",
          },
        },
      },
      {
        id: "node-resend-webhook",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Resend Invoice",
          config: {
            type: "webhook",
            url: "https://your-ar-api.com/invoices/resend",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "resend" },
            description: "Trigger invoice resend",
          },
        },
      },
      {
        id: "node-end-followup",
        type: "end",
        position: { x: 600, y: 890 },
        data: {
          type: "end",
          label: "Follow-up Complete",
          config: {
            type: "end",
            endMessage: "Thank you for the update. I've noted that payment is expected by {expected_payment_date}. If you have any questions about the invoice, please don't hesitate to reach out. Have a great day!",
          },
        },
      },
      {
        id: "node-end-resent",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Invoice Resent",
          config: {
            type: "end",
            endMessage: "The invoice has been resent to {ap_email}. Please allow a few minutes for delivery. I'll follow up in a few days to confirm receipt. Thank you for your time!",
          },
        },
      },
      {
        id: "node-end-issue",
        type: "end",
        position: { x: 300, y: 890 },
        data: {
          type: "end",
          label: "Issue Logged",
          config: {
            type: "end",
            endMessage: "I've documented the issue and escalated it to our billing team. Someone will contact you within 24-48 hours to resolve this. Thank you for bringing it to our attention.",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-contact" },
      { id: "e2", source: "node-verify-contact", target: "node-confirm-receipt" },
      { id: "e3", source: "node-confirm-receipt", target: "node-check-received" },
      { id: "e4", source: "node-check-received", sourceHandle: "true", target: "node-ask-payment-status" },
      { id: "e5", source: "node-check-received", sourceHandle: "false", target: "node-offer-resend" },
      { id: "e6", source: "node-offer-resend", target: "node-ask-email" },
      { id: "e7", source: "node-ask-email", target: "node-resend-webhook" },
      { id: "e8", source: "node-resend-webhook", target: "node-end-resent" },
      { id: "e9", source: "node-ask-payment-status", target: "node-check-issue" },
      { id: "e10", source: "node-check-issue", sourceHandle: "true", target: "node-ask-issue-details" },
      { id: "e11", source: "node-check-issue", sourceHandle: "false", target: "node-ask-expected-date" },
      { id: "e12", source: "node-ask-expected-date", target: "node-log-followup" },
      { id: "e13", source: "node-log-followup", target: "node-end-followup" },
      { id: "e14", source: "node-ask-issue-details", target: "node-end-issue" },
    ],
  },

  // ============================================
  // Template 48: Payment Confirmation Call
  // ============================================
  {
    id: "template-payment-confirmation",
    name: "Payment Confirmation Call",
    description: "Confirm payment receipt, thank customers, offer receipts, and provide next steps. Builds positive customer relationships.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! This is {agent_name} calling from {company_name}. I'm calling with good news regarding your recent payment. Do you have a moment?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For security purposes, can you please verify the last four digits of the account or payment method used?",
            variableName: "verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-payment",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Confirm Payment",
          config: {
            type: "message",
            message: "Thank you! I'm pleased to confirm that we've received your payment of {payment_amount} on {payment_date}. Your confirmation number is {confirmation_number}.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-account-status",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Account Status",
          config: {
            type: "message",
            message: "Your account is now current with a remaining balance of {remaining_balance}. Your next payment of {next_payment_amount} will be due on {next_due_date}.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-receipt",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Need Receipt?",
          config: {
            type: "question",
            question: "Would you like me to send you a payment receipt via email for your records?",
            variableName: "receipt_requested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-receipt",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Send Receipt?",
          config: {
            type: "condition",
            condition: "Customer wants a receipt sent",
          },
        },
      },
      {
        id: "node-confirm-email",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Confirm Email",
          config: {
            type: "question",
            question: "I'll send that right away. Should I send it to {email_on_file}, or would you prefer a different email address?",
            variableName: "receipt_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-send-receipt",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Send Receipt",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/receipts/send",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "send_receipt" },
            description: "Send payment receipt to customer",
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Any Questions?",
          config: {
            type: "question",
            question: "Before I let you go, do you have any questions about your account or upcoming payments?",
            variableName: "customer_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-questions",
        type: "condition",
        position: { x: 250, y: 1010 },
        data: {
          type: "condition",
          label: "Has Questions?",
          config: {
            type: "condition",
            condition: "Customer has questions that need to be addressed",
          },
        },
      },
      {
        id: "node-transfer-support",
        type: "transfer",
        position: { x: 50, y: 1130 },
        data: {
          type: "transfer",
          label: "Transfer to Support",
          config: {
            type: "transfer",
            transferNumber: "{support_line}",
            message: "I'd be happy to connect you with a specialist who can help with that. One moment please.",
          },
        },
      },
      {
        id: "node-log-confirmation",
        type: "webhook",
        position: { x: 450, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Confirmation",
          config: {
            type: "webhook",
            url: "https://your-crm.com/payment-confirmations",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "confirmed", call_type: "outbound" },
            description: "Log payment confirmation call",
          },
        },
      },
      {
        id: "node-end-thank",
        type: "end",
        position: { x: 450, y: 1130 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for being a valued customer! We appreciate your prompt payment. If you ever have questions, feel free to call us at {support_number}. Have a wonderful day!",
          },
        },
      },
      {
        id: "node-end-transfer",
        type: "end",
        position: { x: 50, y: 1250 },
        data: {
          type: "end",
          label: "Transfer Complete",
          config: {
            type: "end",
            endMessage: "You're being connected now. Thank you for your payment!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-confirm-payment" },
      { id: "e3", source: "node-confirm-payment", target: "node-account-status" },
      { id: "e4", source: "node-account-status", target: "node-ask-receipt" },
      { id: "e5", source: "node-ask-receipt", target: "node-check-receipt" },
      { id: "e6", source: "node-check-receipt", sourceHandle: "true", target: "node-confirm-email" },
      { id: "e7", source: "node-check-receipt", sourceHandle: "false", target: "node-ask-questions" },
      { id: "e8", source: "node-confirm-email", target: "node-send-receipt" },
      { id: "e9", source: "node-send-receipt", target: "node-ask-questions" },
      { id: "e10", source: "node-ask-questions", target: "node-check-questions" },
      { id: "e11", source: "node-check-questions", sourceHandle: "true", target: "node-transfer-support" },
      { id: "e12", source: "node-check-questions", sourceHandle: "false", target: "node-log-confirmation" },
      { id: "e13", source: "node-log-confirmation", target: "node-end-thank" },
      { id: "e14", source: "node-transfer-support", target: "node-end-transfer" },
    ],
  },

  // ============================================
  // APPOINTMENT & SCHEDULING FLOW TEMPLATES
  // ============================================

  // ============================================
  // Template: Appointment Confirmation Call
  // ============================================
  {
    id: "template-appointment-confirmation",
    name: "Appointment Confirmation Call",
    description: "Confirm upcoming appointments with customers, verify details, and update CRM with confirmation status.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! This is a courtesy call to confirm your upcoming appointment. Do you have a moment to verify the details?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For verification purposes, may I confirm your full name please?",
            variableName: "confirmed_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-datetime",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Confirm Date/Time",
          config: {
            type: "question",
            question: "I have your appointment scheduled for {appointment_date} at {appointment_time}. Can you confirm this works for you?",
            variableName: "datetime_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-confirmed",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Check Confirmation",
          config: {
            type: "condition",
            condition: "The customer confirmed the appointment date and time",
          },
        },
      },
      {
        id: "node-confirm-location",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Confirm Location",
          config: {
            type: "message",
            message: "Great! Just a reminder, your appointment will be at {location_address}. Please arrive 10 minutes early to complete any necessary paperwork.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-special-needs",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Special Needs",
          config: {
            type: "question",
            question: "Do you have any special requests or accommodations we should prepare for your visit?",
            variableName: "special_needs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-confirmed",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Update CRM Confirmed",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/confirm",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "confirmed", confirmation_type: "phone" },
            description: "Update appointment status to confirmed in CRM",
          },
        },
      },
      {
        id: "node-end-confirmed",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Confirmed Goodbye",
          config: {
            type: "end",
            endMessage: "You're booked! We'll send you a reminder twenty-four hours before. Looking forward to seeing you. Have a great day!",
          },
        },
      },
      {
        id: "node-ask-reschedule",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Offer Reschedule",
          config: {
            type: "question",
            question: "I understand that time doesn't work for you. Would you like to reschedule to a different date or time?",
            variableName: "wants_reschedule",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-reschedule",
        type: "condition",
        position: { x: 50, y: 650 },
        data: {
          type: "condition",
          label: "Check Reschedule",
          config: {
            type: "condition",
            condition: "The customer wants to reschedule the appointment",
          },
        },
      },
      {
        id: "node-book-new",
        type: "appointment",
        position: { x: -100, y: 770 },
        data: {
          type: "appointment",
          label: "Book New Appointment",
          config: {
            type: "appointment",
            appointmentType: "Rescheduled Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-rescheduled",
        type: "webhook",
        position: { x: -100, y: 890 },
        data: {
          type: "webhook",
          label: "Update CRM Rescheduled",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/reschedule",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "rescheduled", source: "confirmation_call" },
            description: "Update appointment as rescheduled in CRM",
          },
        },
      },
      {
        id: "node-end-rescheduled",
        type: "end",
        position: { x: -100, y: 1010 },
        data: {
          type: "end",
          label: "Rescheduled Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment has been successfully rescheduled. You'll receive a confirmation email shortly. Thank you and have a great day!",
          },
        },
      },
      {
        id: "node-webhook-cancelled",
        type: "webhook",
        position: { x: 200, y: 770 },
        data: {
          type: "webhook",
          label: "Update CRM Cancelled",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/cancel",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "cancelled", reason: "customer_declined" },
            description: "Update appointment as cancelled in CRM",
          },
        },
      },
      {
        id: "node-end-cancelled",
        type: "end",
        position: { x: 200, y: 890 },
        data: {
          type: "end",
          label: "Cancelled Goodbye",
          config: {
            type: "end",
            endMessage: "I've cancelled your appointment as requested. If you'd like to schedule a new appointment in the future, please don't hesitate to call us. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-confirm-datetime" },
      { id: "e3", source: "node-confirm-datetime", target: "node-check-confirmed" },
      { id: "e4", source: "node-check-confirmed", sourceHandle: "true", target: "node-confirm-location" },
      { id: "e5", source: "node-check-confirmed", sourceHandle: "false", target: "node-ask-reschedule" },
      { id: "e6", source: "node-confirm-location", target: "node-ask-special-needs" },
      { id: "e7", source: "node-ask-special-needs", target: "node-webhook-confirmed" },
      { id: "e8", source: "node-webhook-confirmed", target: "node-end-confirmed" },
      { id: "e9", source: "node-ask-reschedule", target: "node-check-reschedule" },
      { id: "e10", source: "node-check-reschedule", sourceHandle: "true", target: "node-book-new" },
      { id: "e11", source: "node-check-reschedule", sourceHandle: "false", target: "node-webhook-cancelled" },
      { id: "e12", source: "node-book-new", target: "node-webhook-rescheduled" },
      { id: "e13", source: "node-webhook-rescheduled", target: "node-end-rescheduled" },
      { id: "e14", source: "node-webhook-cancelled", target: "node-end-cancelled" },
    ],
  },

  // ============================================
  // Template: Appointment Reminder (24hr)
  // ============================================
  {
    id: "template-appointment-reminder",
    name: "Appointment Reminder (24hr)",
    description: "Send 24-hour reminder calls for upcoming appointments, confirm attendance, and handle last-minute cancellations or rescheduling.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Reminder Greeting",
          config: {
            type: "message",
            message: "Hello! This is a friendly reminder about your appointment tomorrow at {appointment_time}. I wanted to confirm you're still planning to attend.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Name",
          config: {
            type: "question",
            question: "Am I speaking with {customer_name}?",
            variableName: "identity_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-attendance",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Confirm Attendance",
          config: {
            type: "question",
            question: "Your appointment is scheduled for tomorrow, {appointment_date}, at {appointment_time} with {provider_name}. Will you be able to make it?",
            variableName: "will_attend",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-attending",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Check Attending",
          config: {
            type: "condition",
            condition: "The customer confirms they will attend the appointment",
          },
        },
      },
      {
        id: "node-provide-instructions",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Provide Instructions",
          config: {
            type: "message",
            message: "Perfect! As a reminder, please arrive 10 minutes early and bring a valid ID and insurance card if applicable. Our address is {location_address}.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Any Questions",
          config: {
            type: "question",
            question: "Do you have any questions about your appointment or need directions?",
            variableName: "has_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-confirmed",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Log Confirmed",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/reminder-response",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { response: "confirmed", reminder_type: "24hr" },
            description: "Log 24hr reminder confirmation",
          },
        },
      },
      {
        id: "node-end-confirmed",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Confirmed Goodbye",
          config: {
            type: "end",
            endMessage: "See you tomorrow! If anything comes up, just call us at {office_phone}. Have a great rest of your day!",
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Ask Reason",
          config: {
            type: "question",
            question: "I'm sorry to hear that. Would you like to reschedule for another time?",
            variableName: "wants_to_reschedule",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-reschedule",
        type: "condition",
        position: { x: 50, y: 650 },
        data: {
          type: "condition",
          label: "Check Reschedule",
          config: {
            type: "condition",
            condition: "The customer wants to reschedule",
          },
        },
      },
      {
        id: "node-book-new",
        type: "appointment",
        position: { x: -100, y: 770 },
        data: {
          type: "appointment",
          label: "Schedule New",
          config: {
            type: "appointment",
            appointmentType: "Rescheduled Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-rescheduled",
        type: "webhook",
        position: { x: -100, y: 890 },
        data: {
          type: "webhook",
          label: "Log Rescheduled",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/reschedule",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "rescheduled", source: "24hr_reminder" },
            description: "Log appointment rescheduled from reminder call",
          },
        },
      },
      {
        id: "node-end-rescheduled",
        type: "end",
        position: { x: -100, y: 1010 },
        data: {
          type: "end",
          label: "Rescheduled Goodbye",
          config: {
            type: "end",
            endMessage: "I've rescheduled your appointment. You'll receive a confirmation shortly. Thank you and have a great day!",
          },
        },
      },
      {
        id: "node-webhook-cancelled",
        type: "webhook",
        position: { x: 200, y: 770 },
        data: {
          type: "webhook",
          label: "Log Cancelled",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/cancel",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "cancelled", source: "24hr_reminder", cancellation_notice: "late" },
            description: "Log late cancellation from reminder call",
          },
        },
      },
      {
        id: "node-end-cancelled",
        type: "end",
        position: { x: 200, y: 890 },
        data: {
          type: "end",
          label: "Cancelled Goodbye",
          config: {
            type: "end",
            endMessage: "I've cancelled your appointment. When you're ready to reschedule, please give us a call. Have a nice day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-name" },
      { id: "e2", source: "node-verify-name", target: "node-confirm-attendance" },
      { id: "e3", source: "node-confirm-attendance", target: "node-check-attending" },
      { id: "e4", source: "node-check-attending", sourceHandle: "true", target: "node-provide-instructions" },
      { id: "e5", source: "node-check-attending", sourceHandle: "false", target: "node-ask-reason" },
      { id: "e6", source: "node-provide-instructions", target: "node-ask-questions" },
      { id: "e7", source: "node-ask-questions", target: "node-webhook-confirmed" },
      { id: "e8", source: "node-webhook-confirmed", target: "node-end-confirmed" },
      { id: "e9", source: "node-ask-reason", target: "node-check-reschedule" },
      { id: "e10", source: "node-check-reschedule", sourceHandle: "true", target: "node-book-new" },
      { id: "e11", source: "node-check-reschedule", sourceHandle: "false", target: "node-webhook-cancelled" },
      { id: "e12", source: "node-book-new", target: "node-webhook-rescheduled" },
      { id: "e13", source: "node-webhook-rescheduled", target: "node-end-rescheduled" },
      { id: "e14", source: "node-webhook-cancelled", target: "node-end-cancelled" },
    ],
  },

  // ============================================
  // Template: Appointment Rescheduling
  // ============================================
  {
    id: "template-appointment-reschedule",
    name: "Appointment Rescheduling",
    description: "Handle appointment rescheduling requests, verify current booking, find new availability, and update schedules accordingly.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for calling. I can help you reschedule your appointment. Let me pull up your information.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "May I have your full name and date of birth for verification?",
            variableName: "identity_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-current",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Confirm Current",
          config: {
            type: "message",
            message: "I found your appointment scheduled for {current_date} at {current_time} with {provider_name}. Is this the appointment you'd like to reschedule?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Ask Reason",
          config: {
            type: "question",
            question: "May I ask the reason for rescheduling? This helps us serve you better.",
            variableName: "reschedule_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preference",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Time Preference",
          config: {
            type: "question",
            question: "Do you prefer morning or afternoon appointments? And are there specific days that work best for you?",
            variableName: "time_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-new",
        type: "appointment",
        position: { x: 250, y: 650 },
        data: {
          type: "appointment",
          label: "Book New Appointment",
          config: {
            type: "appointment",
            appointmentType: "Rescheduled Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-new",
        type: "message",
        position: { x: 250, y: 770 },
        data: {
          type: "message",
          label: "Confirm New",
          config: {
            type: "message",
            message: "I've rescheduled your appointment. Your new appointment is now confirmed.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-webhook-update",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Update CRM",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/reschedule",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "reschedule", update_calendar: true },
            description: "Update appointment in CRM and calendar",
          },
        },
      },
      {
        id: "node-ask-notification",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Notification Preference",
          config: {
            type: "question",
            question: "Would you like to receive a reminder via text message, email, or both?",
            variableName: "notification_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment has been successfully rescheduled and you'll receive a confirmation shortly. Is there anything else I can help you with? If not, thank you for calling and have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-confirm-current" },
      { id: "e3", source: "node-confirm-current", target: "node-ask-reason" },
      { id: "e4", source: "node-ask-reason", target: "node-ask-preference" },
      { id: "e5", source: "node-ask-preference", target: "node-book-new" },
      { id: "e6", source: "node-book-new", target: "node-confirm-new" },
      { id: "e7", source: "node-confirm-new", target: "node-webhook-update" },
      { id: "e8", source: "node-webhook-update", target: "node-ask-notification" },
      { id: "e9", source: "node-ask-notification", target: "node-end" },
    ],
  },

  // ============================================
  // Template: No-Show Follow-up
  // ============================================
  {
    id: "template-no-show-followup",
    name: "No-Show Follow-up",
    description: "Follow up with customers who missed their appointments, understand reasons, offer rebooking, and maintain customer relationships.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! This is a call from {business_name}. We noticed you missed your appointment scheduled for {appointment_date}. We wanted to check in and see if everything is okay.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "Am I speaking with {customer_name}?",
            variableName: "identity_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Ask Reason",
          config: {
            type: "question",
            question: "We understand things come up. Was there a particular reason you weren't able to make it to your appointment?",
            variableName: "no_show_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-express-understanding",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Express Understanding",
          config: {
            type: "message",
            message: "I completely understand. Life can be unpredictable. We value you as a customer and would love to help you reschedule.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-offer-reschedule",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Offer Reschedule",
          config: {
            type: "question",
            question: "Would you like to schedule a new appointment? We have availability this week.",
            variableName: "wants_reschedule",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-reschedule",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Check Reschedule",
          config: {
            type: "condition",
            condition: "The customer wants to reschedule",
          },
        },
      },
      {
        id: "node-book-appointment",
        type: "appointment",
        position: { x: 450, y: 770 },
        data: {
          type: "appointment",
          label: "Book New Appointment",
          config: {
            type: "appointment",
            appointmentType: "Follow-up Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-rescheduled",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Update CRM Rescheduled",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/no-show-recovery",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "recovered", source: "no_show_followup" },
            description: "Log successful no-show recovery",
          },
        },
      },
      {
        id: "node-end-rescheduled",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Rescheduled Goodbye",
          config: {
            type: "end",
            endMessage: "All set, your new appointment's confirmed. We'll send a reminder beforehand. See you then!",
          },
        },
      },
      {
        id: "node-ask-future-contact",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Future Contact",
          config: {
            type: "question",
            question: "I understand. Would you like us to reach out to you in the future when you're ready to schedule?",
            variableName: "future_contact_ok",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-declined",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Update CRM Declined",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/no-show",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "declined_reschedule", followup_needed: true },
            description: "Log declined reschedule and schedule future follow-up",
          },
        },
      },
      {
        id: "node-end-declined",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Declined Goodbye",
          config: {
            type: "end",
            endMessage: "No problem at all. Whenever you're ready, please don't hesitate to call us. Thank you for your time and take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-ask-reason" },
      { id: "e3", source: "node-ask-reason", target: "node-express-understanding" },
      { id: "e4", source: "node-express-understanding", target: "node-offer-reschedule" },
      { id: "e5", source: "node-offer-reschedule", target: "node-check-reschedule" },
      { id: "e6", source: "node-check-reschedule", sourceHandle: "true", target: "node-book-appointment" },
      { id: "e7", source: "node-check-reschedule", sourceHandle: "false", target: "node-ask-future-contact" },
      { id: "e8", source: "node-book-appointment", target: "node-webhook-rescheduled" },
      { id: "e9", source: "node-webhook-rescheduled", target: "node-end-rescheduled" },
      { id: "e10", source: "node-ask-future-contact", target: "node-webhook-declined" },
      { id: "e11", source: "node-webhook-declined", target: "node-end-declined" },
    ],
  },

  // ============================================
  // Template: Waitlist Notification
  // ============================================
  {
    id: "template-waitlist-notification",
    name: "Waitlist Notification",
    description: "Notify customers on the waitlist when appointments become available, confirm interest, and book immediately.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Exciting News",
          config: {
            type: "message",
            message: "Hello! Great news from {business_name}! An appointment slot has just become available that matches your waitlist request. Do you have a moment?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "Am I speaking with {customer_name}?",
            variableName: "identity_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-present-slot",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Present Slot",
          config: {
            type: "message",
            message: "We have an opening on {available_date} at {available_time} with {provider_name}. This slot just became available and we're offering it to you first since you're on our priority waitlist.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-interest",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Ask Interest",
          config: {
            type: "question",
            question: "Would you like to book this appointment? I need to confirm quickly as we have others on the waitlist.",
            variableName: "interested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Check Interest",
          config: {
            type: "condition",
            condition: "The customer is interested in the available slot",
          },
        },
      },
      {
        id: "node-confirm-details",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Confirm Details",
          config: {
            type: "question",
            question: "Okay cool, let me just confirm your details real quick. Is {customer_phone} still the best number, and {customer_email} for emails?",
            variableName: "details_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-slot",
        type: "appointment",
        position: { x: 450, y: 770 },
        data: {
          type: "appointment",
          label: "Book Slot",
          config: {
            type: "appointment",
            appointmentType: "Waitlist Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-booked",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Update Waitlist",
          config: {
            type: "webhook",
            url: "https://your-crm.com/waitlist/convert",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "converted", source: "waitlist_notification" },
            description: "Remove from waitlist and confirm booking",
          },
        },
      },
      {
        id: "node-end-booked",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Booked Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment is confirmed! You'll receive a confirmation email and reminder. Thank you for your patience while on the waitlist. We look forward to seeing you!",
          },
        },
      },
      {
        id: "node-ask-stay-waitlist",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Stay on Waitlist",
          config: {
            type: "question",
            question: "I understand this time doesn't work for you. Would you like to remain on our waitlist for future openings?",
            variableName: "stay_on_waitlist",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-stay",
        type: "condition",
        position: { x: 50, y: 770 },
        data: {
          type: "condition",
          label: "Check Stay",
          config: {
            type: "condition",
            condition: "The customer wants to stay on the waitlist",
          },
        },
      },
      {
        id: "node-webhook-keep-waitlist",
        type: "webhook",
        position: { x: -100, y: 890 },
        data: {
          type: "webhook",
          label: "Keep on Waitlist",
          config: {
            type: "webhook",
            url: "https://your-crm.com/waitlist/update",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "keep", declined_slot: true },
            description: "Update waitlist status - declined this slot",
          },
        },
      },
      {
        id: "node-end-stay",
        type: "end",
        position: { x: -100, y: 1010 },
        data: {
          type: "end",
          label: "Stay Goodbye",
          config: {
            type: "end",
            endMessage: "No problem! You'll remain on our waitlist and we'll call you again when another slot opens up. Have a great day!",
          },
        },
      },
      {
        id: "node-webhook-remove-waitlist",
        type: "webhook",
        position: { x: 200, y: 890 },
        data: {
          type: "webhook",
          label: "Remove from Waitlist",
          config: {
            type: "webhook",
            url: "https://your-crm.com/waitlist/remove",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "remove", reason: "customer_request" },
            description: "Remove customer from waitlist",
          },
        },
      },
      {
        id: "node-end-removed",
        type: "end",
        position: { x: 200, y: 1010 },
        data: {
          type: "end",
          label: "Removed Goodbye",
          config: {
            type: "end",
            endMessage: "I've removed you from the waitlist. If you'd like to schedule in the future, please give us a call. Thank you and take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-present-slot" },
      { id: "e3", source: "node-present-slot", target: "node-ask-interest" },
      { id: "e4", source: "node-ask-interest", target: "node-check-interest" },
      { id: "e5", source: "node-check-interest", sourceHandle: "true", target: "node-confirm-details" },
      { id: "e6", source: "node-check-interest", sourceHandle: "false", target: "node-ask-stay-waitlist" },
      { id: "e7", source: "node-confirm-details", target: "node-book-slot" },
      { id: "e8", source: "node-book-slot", target: "node-webhook-booked" },
      { id: "e9", source: "node-webhook-booked", target: "node-end-booked" },
      { id: "e10", source: "node-ask-stay-waitlist", target: "node-check-stay" },
      { id: "e11", source: "node-check-stay", sourceHandle: "true", target: "node-webhook-keep-waitlist" },
      { id: "e12", source: "node-check-stay", sourceHandle: "false", target: "node-webhook-remove-waitlist" },
      { id: "e13", source: "node-webhook-keep-waitlist", target: "node-end-stay" },
      { id: "e14", source: "node-webhook-remove-waitlist", target: "node-end-removed" },
    ],
  },

  // ============================================
  // Template: Recurring Appointment Setup
  // ============================================
  {
    id: "template-recurring-appointment",
    name: "Recurring Appointment Setup",
    description: "Set up recurring appointments with frequency selection, schedule confirmation, and automated series booking.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I'm calling to help you set up your recurring appointment schedule. This will ensure you have regular appointments booked in advance. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "May I confirm I'm speaking with {customer_name}?",
            variableName: "identity_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-service",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Service Type",
          config: {
            type: "question",
            question: "What type of appointment would you like to schedule on a recurring basis?",
            variableName: "service_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-frequency",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Frequency",
          config: {
            type: "question",
            question: "How often would you like to schedule these appointments? Options include weekly, every two weeks, monthly, or every six weeks.",
            variableName: "frequency",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preferred-day",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Preferred Day",
          config: {
            type: "question",
            question: "Which day of the week works best for you?",
            variableName: "preferred_day",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preferred-time",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Preferred Time",
          config: {
            type: "question",
            question: "And what time of day works best? We have morning slots from 9 AM to 12 PM and afternoon slots from 1 PM to 5 PM.",
            variableName: "preferred_time",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-provider",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Provider Preference",
          config: {
            type: "question",
            question: "Would you like to see the same provider each time, or are you flexible?",
            variableName: "provider_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-duration",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Duration",
          config: {
            type: "question",
            question: "How many appointments would you like to schedule in advance? We can book 3, 6, or 12 appointments at a time.",
            variableName: "series_duration",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-first",
        type: "appointment",
        position: { x: 250, y: 1010 },
        data: {
          type: "appointment",
          label: "Book First Appointment",
          config: {
            type: "appointment",
            appointmentType: "Recurring Series",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-create-series",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Create Series",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/recurring/create",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "recurring_series", auto_book: true },
            description: "Create recurring appointment series in CRM",
          },
        },
      },
      {
        id: "node-confirm-series",
        type: "message",
        position: { x: 250, y: 1250 },
        data: {
          type: "message",
          label: "Confirm Series",
          config: {
            type: "message",
            message: "I've set up your recurring appointments. Your first appointment is confirmed, and the subsequent appointments have been scheduled based on your preferences.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-reminders",
        type: "question",
        position: { x: 250, y: 1370 },
        data: {
          type: "question",
          label: "Reminder Preference",
          config: {
            type: "question",
            question: "How would you like to receive reminders? We can send text messages, emails, or phone calls before each appointment.",
            variableName: "reminder_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Your recurring appointment schedule is all set! You'll receive a confirmation email with all your upcoming appointment dates. If you ever need to modify the schedule, just give us a call. Thank you and have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-ask-service" },
      { id: "e3", source: "node-ask-service", target: "node-ask-frequency" },
      { id: "e4", source: "node-ask-frequency", target: "node-ask-preferred-day" },
      { id: "e5", source: "node-ask-preferred-day", target: "node-ask-preferred-time" },
      { id: "e6", source: "node-ask-preferred-time", target: "node-ask-provider" },
      { id: "e7", source: "node-ask-provider", target: "node-ask-duration" },
      { id: "e8", source: "node-ask-duration", target: "node-book-first" },
      { id: "e9", source: "node-book-first", target: "node-webhook-create-series" },
      { id: "e10", source: "node-webhook-create-series", target: "node-confirm-series" },
      { id: "e11", source: "node-confirm-series", target: "node-ask-reminders" },
      { id: "e12", source: "node-ask-reminders", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Multi-Provider Scheduling
  // ============================================
  {
    id: "template-multi-provider-scheduling",
    name: "Multi-Provider Scheduling",
    description: "Schedule appointments across multiple providers or specialists, coordinate availability, and book the best match.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for calling. I'll help you schedule an appointment with one of our specialists. Let me find the best match for your needs.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name please?",
            variableName: "customer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-service",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Service Needed",
          config: {
            type: "question",
            question: "What type of service or specialist are you looking for today?",
            variableName: "service_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-provider-preference",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Provider Preference",
          config: {
            type: "question",
            question: "Do you have a preferred provider, or would you like me to find whoever is available soonest?",
            variableName: "provider_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-specific",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Check Specific Provider",
          config: {
            type: "condition",
            condition: "The customer requested a specific provider by name",
          },
        },
      },
      {
        id: "node-check-provider-availability",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Check Availability",
          config: {
            type: "message",
            message: "Let me check {preferred_provider}'s availability for you. One moment please.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-datetime-specific",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Preferred Date/Time",
          config: {
            type: "question",
            question: "{preferred_provider} has availability on {available_dates}. Which date and time would work best for you?",
            variableName: "selected_datetime",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-find-available",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Find Available",
          config: {
            type: "message",
            message: "Let me check which of our specialists has the earliest availability for {service_type}. One moment please.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-present-options",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Present Options",
          config: {
            type: "question",
            question: "I found a few options for you. {provider_1} is available on {date_1}, {provider_2} is available on {date_2}. Which would you prefer?",
            variableName: "selected_option",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-appointment",
        type: "appointment",
        position: { x: 250, y: 890 },
        data: {
          type: "appointment",
          label: "Book Appointment",
          config: {
            type: "appointment",
            appointmentType: "Specialist Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-collect-info",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Additional Info",
          config: {
            type: "question",
            question: "Is there anything specific you'd like the provider to know before your appointment?",
            variableName: "additional_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-book",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Book in CRM",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/multi-provider",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "specialist_booking", notify_provider: true },
            description: "Book appointment and notify the selected provider",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment is confirmed. You'll receive a confirmation with all the details. The provider will also receive your notes. Is there anything else I can help you with? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-service" },
      { id: "e3", source: "node-ask-service", target: "node-ask-provider-preference" },
      { id: "e4", source: "node-ask-provider-preference", target: "node-check-specific" },
      { id: "e5", source: "node-check-specific", sourceHandle: "true", target: "node-check-provider-availability" },
      { id: "e6", source: "node-check-specific", sourceHandle: "false", target: "node-find-available" },
      { id: "e7", source: "node-check-provider-availability", target: "node-ask-datetime-specific" },
      { id: "e8", source: "node-find-available", target: "node-present-options" },
      { id: "e9", source: "node-ask-datetime-specific", target: "node-book-appointment" },
      { id: "e10", source: "node-present-options", target: "node-book-appointment" },
      { id: "e11", source: "node-book-appointment", target: "node-collect-info" },
      { id: "e12", source: "node-collect-info", target: "node-webhook-book" },
      { id: "e13", source: "node-webhook-book", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Group Booking Coordinator
  // ============================================
  {
    id: "template-group-booking",
    name: "Group Booking Coordinator",
    description: "Coordinate group appointments, collect attendee information, handle special requirements, and confirm group bookings.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for calling about a group booking. I'll help you coordinate your group appointment. Let me collect some information.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-organizer",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Organizer Name",
          config: {
            type: "question",
            question: "May I have your name as the group organizer?",
            variableName: "organizer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-group-size",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Group Size",
          config: {
            type: "question",
            question: "How many people will be in your group?",
            variableName: "group_size",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-event-type",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Event Type",
          config: {
            type: "question",
            question: "What type of group event or session are you booking? For example, team building, training, workshop, or private event?",
            variableName: "event_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-date-preference",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Date Preference",
          config: {
            type: "question",
            question: "What date or date range are you considering for this group booking?",
            variableName: "preferred_dates",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-availability",
        type: "message",
        position: { x: 250, y: 650 },
        data: {
          type: "message",
          label: "Check Availability",
          config: {
            type: "message",
            message: "Let me check our availability for a group of {group_size} on your preferred dates. One moment please.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-present-options",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Present Options",
          config: {
            type: "question",
            question: "We have availability on {available_date_1} and {available_date_2}. We can accommodate your group in our {room_options}. Which option works best for you?",
            variableName: "selected_option",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-special-requirements",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Special Requirements",
          config: {
            type: "question",
            question: "Does your group have any special requirements? For example, accessibility needs, dietary restrictions, equipment, or specific room setup?",
            variableName: "special_requirements",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-contact",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Contact Details",
          config: {
            type: "question",
            question: "What's the best phone number and email address for the group organizer?",
            variableName: "contact_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-group",
        type: "appointment",
        position: { x: 250, y: 1130 },
        data: {
          type: "appointment",
          label: "Book Group",
          config: {
            type: "appointment",
            appointmentType: "Group Booking",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-create",
        type: "webhook",
        position: { x: 250, y: 1250 },
        data: {
          type: "webhook",
          label: "Create Group Booking",
          config: {
            type: "webhook",
            url: "https://your-crm.com/bookings/group",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "group_booking", send_confirmation: true },
            description: "Create group booking in CRM and send confirmation",
          },
        },
      },
      {
        id: "node-discuss-payment",
        type: "message",
        position: { x: 250, y: 1370 },
        data: {
          type: "message",
          label: "Payment Info",
          config: {
            type: "message",
            message: "For group bookings, we require a {deposit_amount} deposit to secure your reservation. The remaining balance is due {payment_terms}. You'll receive payment instructions in your confirmation email.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Your group booking is confirmed! A detailed confirmation including payment instructions will be sent to your email. We're excited to host your group. Is there anything else I can help you with? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-organizer" },
      { id: "e2", source: "node-ask-organizer", target: "node-ask-group-size" },
      { id: "e3", source: "node-ask-group-size", target: "node-ask-event-type" },
      { id: "e4", source: "node-ask-event-type", target: "node-ask-date-preference" },
      { id: "e5", source: "node-ask-date-preference", target: "node-check-availability" },
      { id: "e6", source: "node-check-availability", target: "node-present-options" },
      { id: "e7", source: "node-present-options", target: "node-ask-special-requirements" },
      { id: "e8", source: "node-ask-special-requirements", target: "node-ask-contact" },
      { id: "e9", source: "node-ask-contact", target: "node-book-group" },
      { id: "e10", source: "node-book-group", target: "node-webhook-create" },
      { id: "e11", source: "node-webhook-create", target: "node-discuss-payment" },
      { id: "e12", source: "node-discuss-payment", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Same-Day Cancellation Handler
  // ============================================
  {
    id: "template-same-day-cancellation",
    name: "Same-Day Cancellation Handler",
    description: "Handle same-day cancellation requests with policy explanation, fee discussion, and rebooking options.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I understand you need to cancel your appointment scheduled for today. I'm here to help you with that.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "To pull up your appointment, may I have your full name and date of birth?",
            variableName: "identity_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-appointment",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Confirm Appointment",
          config: {
            type: "message",
            message: "I found your appointment today at {appointment_time} with {provider_name}. I see you're looking to cancel this appointment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-explain-policy",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Explain Policy",
          config: {
            type: "message",
            message: "I want to let you know about our same-day cancellation policy. Cancellations made less than 24 hours in advance may be subject to a {cancellation_fee} fee. However, I understand that emergencies happen.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Ask Reason",
          config: {
            type: "question",
            question: "May I ask the reason for the cancellation? This helps us determine if a fee waiver applies.",
            variableName: "cancellation_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-emergency",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Check Emergency",
          config: {
            type: "condition",
            condition: "The cancellation is due to an emergency, illness, or other valid waiver reason",
          },
        },
      },
      {
        id: "node-waive-fee",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Waive Fee",
          config: {
            type: "message",
            message: "I completely understand. Given the circumstances, I'm happy to waive the cancellation fee for you today.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-confirm-fee",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Confirm Fee",
          config: {
            type: "question",
            question: "Per our policy, a {cancellation_fee} late cancellation fee will apply to your account. Would you like to proceed with the cancellation?",
            variableName: "accepts_fee",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-proceed",
        type: "condition",
        position: { x: 50, y: 890 },
        data: {
          type: "condition",
          label: "Check Proceed",
          config: {
            type: "condition",
            condition: "The customer agrees to proceed with the cancellation",
          },
        },
      },
      {
        id: "node-offer-reschedule",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Offer Reschedule",
          config: {
            type: "question",
            question: "Would you like to reschedule your appointment to another day? This would help you avoid losing your spot.",
            variableName: "wants_reschedule",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-reschedule",
        type: "condition",
        position: { x: 250, y: 1010 },
        data: {
          type: "condition",
          label: "Check Reschedule",
          config: {
            type: "condition",
            condition: "The customer wants to reschedule",
          },
        },
      },
      {
        id: "node-book-new",
        type: "appointment",
        position: { x: 450, y: 1130 },
        data: {
          type: "appointment",
          label: "Book New",
          config: {
            type: "appointment",
            appointmentType: "Rescheduled Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-webhook-reschedule",
        type: "webhook",
        position: { x: 450, y: 1250 },
        data: {
          type: "webhook",
          label: "Update CRM Reschedule",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/same-day-reschedule",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "reschedule", original_was_same_day: true },
            description: "Log same-day reschedule",
          },
        },
      },
      {
        id: "node-end-rescheduled",
        type: "end",
        position: { x: 450, y: 1370 },
        data: {
          type: "end",
          label: "Rescheduled Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment has been rescheduled. You'll receive a confirmation shortly. Thank you for letting us know in advance. Take care!",
          },
        },
      },
      {
        id: "node-process-cancel",
        type: "webhook",
        position: { x: 50, y: 1130 },
        data: {
          type: "webhook",
          label: "Process Cancellation",
          config: {
            type: "webhook",
            url: "https://your-crm.com/appointments/cancel",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "same_day_cancel", apply_fee: true },
            description: "Process same-day cancellation with fee",
          },
        },
      },
      {
        id: "node-end-cancelled",
        type: "end",
        position: { x: 50, y: 1250 },
        data: {
          type: "end",
          label: "Cancelled Goodbye",
          config: {
            type: "end",
            endMessage: "Your appointment has been cancelled. If a fee applies, it will appear on your next statement. When you're ready to rebook, please give us a call. Take care!",
          },
        },
      },
      {
        id: "node-keep-appointment",
        type: "end",
        position: { x: -100, y: 1010 },
        data: {
          type: "end",
          label: "Keep Appointment",
          config: {
            type: "end",
            endMessage: "I've kept your appointment as scheduled. If anything changes, please let us know as soon as possible. We'll see you at {appointment_time} today!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-confirm-appointment" },
      { id: "e3", source: "node-confirm-appointment", target: "node-explain-policy" },
      { id: "e4", source: "node-explain-policy", target: "node-ask-reason" },
      { id: "e5", source: "node-ask-reason", target: "node-check-emergency" },
      { id: "e6", source: "node-check-emergency", sourceHandle: "true", target: "node-waive-fee" },
      { id: "e7", source: "node-check-emergency", sourceHandle: "false", target: "node-confirm-fee" },
      { id: "e8", source: "node-waive-fee", target: "node-offer-reschedule" },
      { id: "e9", source: "node-confirm-fee", target: "node-check-proceed" },
      { id: "e10", source: "node-check-proceed", sourceHandle: "true", target: "node-offer-reschedule" },
      { id: "e11", source: "node-check-proceed", sourceHandle: "false", target: "node-keep-appointment" },
      { id: "e12", source: "node-offer-reschedule", target: "node-check-reschedule" },
      { id: "e13", source: "node-check-reschedule", sourceHandle: "true", target: "node-book-new" },
      { id: "e14", source: "node-check-reschedule", sourceHandle: "false", target: "node-process-cancel" },
      { id: "e15", source: "node-book-new", target: "node-webhook-reschedule" },
      { id: "e16", source: "node-webhook-reschedule", target: "node-end-rescheduled" },
      { id: "e17", source: "node-process-cancel", target: "node-end-cancelled" },
    ],
  },

  // ============================================
  // Template: Virtual Appointment Setup
  // ============================================
  {
    id: "template-virtual-appointment-setup",
    name: "Virtual Appointment Setup",
    description: "Set up virtual/telehealth appointments with platform instructions, technical requirements, and link distribution.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! Thank you for calling to schedule a virtual appointment. I'll help you set up everything you need for a successful online session.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name please?",
            variableName: "customer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-service",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Service Type",
          config: {
            type: "question",
            question: "What type of virtual appointment would you like to schedule? We offer consultations, follow-ups, and coaching sessions.",
            variableName: "service_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-virtual",
        type: "appointment",
        position: { x: 250, y: 410 },
        data: {
          type: "appointment",
          label: "Book Virtual Appointment",
          config: {
            type: "appointment",
            appointmentType: "Virtual Appointment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "What email address should we send the virtual meeting link to?",
            variableName: "email_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-platform-preference",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Platform Preference",
          config: {
            type: "question",
            question: "Do you have a preferred video platform? We support Zoom, Google Meet, and Microsoft Teams.",
            variableName: "platform_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-technical-requirements",
        type: "message",
        position: { x: 250, y: 770 },
        data: {
          type: "message",
          label: "Technical Requirements",
          config: {
            type: "message",
            message: "For the best virtual appointment experience, please ensure you have a stable internet connection, a working camera and microphone, and a quiet, well-lit space. We recommend testing your setup before the appointment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-tech-comfort",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Tech Comfort",
          config: {
            type: "question",
            question: "Are you comfortable with video calls, or would you like us to send you a simple guide on how to join the meeting?",
            variableName: "needs_tech_guide",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-guide",
        type: "condition",
        position: { x: 250, y: 1010 },
        data: {
          type: "condition",
          label: "Check Guide Needed",
          config: {
            type: "condition",
            condition: "The customer needs a technology guide",
          },
        },
      },
      {
        id: "node-webhook-with-guide",
        type: "webhook",
        position: { x: 450, y: 1130 },
        data: {
          type: "webhook",
          label: "Create with Guide",
          config: {
            type: "webhook",
            url: "https://your-crm.com/virtual-appointments/create",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "virtual", send_tech_guide: true, generate_link: true },
            description: "Create virtual appointment and send technology guide",
          },
        },
      },
      {
        id: "node-webhook-without-guide",
        type: "webhook",
        position: { x: 50, y: 1130 },
        data: {
          type: "webhook",
          label: "Create Standard",
          config: {
            type: "webhook",
            url: "https://your-crm.com/virtual-appointments/create",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "virtual", send_tech_guide: false, generate_link: true },
            description: "Create virtual appointment with standard confirmation",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1250 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Your virtual appointment is confirmed. You'll receive an email shortly with the meeting link and all the details. The link will also be included in your reminder notification.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-reminder",
        type: "question",
        position: { x: 250, y: 1370 },
        data: {
          type: "question",
          label: "Reminder Preference",
          config: {
            type: "question",
            question: "When would you like to receive a reminder - 24 hours before, 1 hour before, or both?",
            variableName: "reminder_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Your virtual appointment is all set! Check your email for the meeting link. If you have any technical difficulties on the day of your appointment, call us and we'll help you connect. Is there anything else I can help you with? If not, have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-service" },
      { id: "e3", source: "node-ask-service", target: "node-book-virtual" },
      { id: "e4", source: "node-book-virtual", target: "node-ask-email" },
      { id: "e5", source: "node-ask-email", target: "node-ask-platform-preference" },
      { id: "e6", source: "node-ask-platform-preference", target: "node-technical-requirements" },
      { id: "e7", source: "node-technical-requirements", target: "node-ask-tech-comfort" },
      { id: "e8", source: "node-ask-tech-comfort", target: "node-check-guide" },
      { id: "e9", source: "node-check-guide", sourceHandle: "true", target: "node-webhook-with-guide" },
      { id: "e10", source: "node-check-guide", sourceHandle: "false", target: "node-webhook-without-guide" },
      { id: "e11", source: "node-webhook-with-guide", target: "node-confirmation" },
      { id: "e12", source: "node-webhook-without-guide", target: "node-confirmation" },
      { id: "e13", source: "node-confirmation", target: "node-ask-reminder" },
      { id: "e14", source: "node-ask-reminder", target: "node-end" },
    ],
  },

  // ============================================
  // Surveys & Feedback Templates
  // ============================================

  // ============================================
  // Template: Post-Purchase Survey
  // ============================================
  {
    id: "template-post-purchase-survey",
    name: "Post-Purchase Survey",
    description: "Collect feedback on the purchase experience including ordering process, delivery, and product satisfaction.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! Thank you for your recent purchase. We'd love to hear about your experience. This quick survey takes just 2 minutes. Do you have a moment to share your feedback?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-order-experience",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Order Experience",
          config: {
            type: "question",
            question: "How would you rate your ordering experience on a scale of 1 to 5, with 5 being excellent?",
            variableName: "order_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-delivery",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Delivery Experience",
          config: {
            type: "question",
            question: "How satisfied were you with the delivery time and packaging?",
            variableName: "delivery_satisfaction",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-product-quality",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Product Quality",
          config: {
            type: "question",
            question: "Does the product meet your expectations in terms of quality?",
            variableName: "product_quality",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-repurchase",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Repurchase Intent",
          config: {
            type: "question",
            question: "Would you purchase from us again in the future?",
            variableName: "repurchase_intent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-positive",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Check Experience",
          config: {
            type: "condition",
            condition: "The customer had a positive experience with rating 4 or above",
          },
        },
      },
      {
        id: "node-ask-testimonial",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Request Review",
          config: {
            type: "question",
            question: "We're thrilled you had a great experience! Would you be willing to leave a review on our website?",
            variableName: "review_consent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-improvement",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Improvement Feedback",
          config: {
            type: "question",
            question: "We appreciate your honest feedback. What could we have done better to improve your experience?",
            variableName: "improvement_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-positive-webhook",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Log Positive",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/post-purchase",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "positive", request_review: true },
            description: "Log positive purchase feedback",
          },
        },
      },
      {
        id: "node-negative-webhook",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Log Improvement",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/post-purchase",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "needs_improvement", priority: "medium" },
            description: "Log improvement feedback for review",
          },
        },
      },
      {
        id: "node-positive-end",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Thank Positive",
          config: {
            type: "end",
            endMessage: "Thank you so much for your wonderful feedback! We truly appreciate your business and look forward to serving you again. Have a fantastic day!",
          },
        },
      },
      {
        id: "node-negative-end",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Thank Improvement",
          config: {
            type: "end",
            endMessage: "Thank you for your valuable feedback. We take all suggestions seriously and will work to improve. Our customer care team may reach out to address your concerns. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-order-experience" },
      { id: "e2", source: "node-ask-order-experience", target: "node-ask-delivery" },
      { id: "e3", source: "node-ask-delivery", target: "node-ask-product-quality" },
      { id: "e4", source: "node-ask-product-quality", target: "node-ask-repurchase" },
      { id: "e5", source: "node-ask-repurchase", target: "node-check-positive" },
      { id: "e6", source: "node-check-positive", sourceHandle: "true", target: "node-ask-testimonial" },
      { id: "e7", source: "node-check-positive", sourceHandle: "false", target: "node-ask-improvement" },
      { id: "e8", source: "node-ask-testimonial", target: "node-positive-webhook" },
      { id: "e9", source: "node-ask-improvement", target: "node-negative-webhook" },
      { id: "e10", source: "node-positive-webhook", target: "node-positive-end" },
      { id: "e11", source: "node-negative-webhook", target: "node-negative-end" },
    ],
  },

  // ============================================
  // Template: Service Quality Survey
  // ============================================
  {
    id: "template-service-quality-survey",
    name: "Service Quality Survey",
    description: "Rate and gather feedback on recent service interactions including support quality, resolution time, and agent performance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! We're calling to follow up on your recent service interaction. Your feedback helps us improve our support quality. Do you have a couple of minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-overall-rating",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Overall Rating",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how would you rate your overall service experience?",
            variableName: "service_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-agent-rating",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Agent Rating",
          config: {
            type: "question",
            question: "How helpful and knowledgeable was the service representative who assisted you?",
            variableName: "agent_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-resolution",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Resolution Status",
          config: {
            type: "question",
            question: "Was your issue fully resolved during the interaction?",
            variableName: "issue_resolved",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-resolved",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Check Resolution",
          config: {
            type: "condition",
            condition: "The customer's issue was resolved successfully",
          },
        },
      },
      {
        id: "node-ask-wait-time",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Wait Time",
          config: {
            type: "question",
            question: "How satisfied were you with the wait time before being connected to an agent?",
            variableName: "wait_time_satisfaction",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-unresolved-details",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Unresolved Details",
          config: {
            type: "question",
            question: "I'm sorry to hear that. Could you briefly describe what still needs to be addressed?",
            variableName: "unresolved_issue",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-callback",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Offer Callback",
          config: {
            type: "question",
            question: "Would you like a supervisor to call you back to help resolve this issue?",
            variableName: "callback_requested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-resolved-webhook",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Log Resolved",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/service-quality",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "resolved", survey_type: "service_quality" },
            description: "Log resolved service feedback",
          },
        },
      },
      {
        id: "node-unresolved-webhook",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Escalate",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/service-quality",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "unresolved", priority: "high", escalate: true },
            description: "Escalate unresolved issue for follow-up",
          },
        },
      },
      {
        id: "node-resolved-end",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Thank Resolved",
          config: {
            type: "end",
            endMessage: "Thank you for your feedback! We're glad we could help resolve your issue. We appreciate your business and are always here if you need us. Have a wonderful day!",
          },
        },
      },
      {
        id: "node-unresolved-end",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Thank Unresolved",
          config: {
            type: "end",
            endMessage: "Thank you for sharing this with us. We take your concerns seriously and someone will be in touch shortly to ensure your issue is fully resolved. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-overall-rating" },
      { id: "e2", source: "node-ask-overall-rating", target: "node-ask-agent-rating" },
      { id: "e3", source: "node-ask-agent-rating", target: "node-ask-resolution" },
      { id: "e4", source: "node-ask-resolution", target: "node-check-resolved" },
      { id: "e5", source: "node-check-resolved", sourceHandle: "true", target: "node-ask-wait-time" },
      { id: "e6", source: "node-check-resolved", sourceHandle: "false", target: "node-ask-unresolved-details" },
      { id: "e7", source: "node-ask-wait-time", target: "node-resolved-webhook" },
      { id: "e8", source: "node-ask-unresolved-details", target: "node-offer-callback" },
      { id: "e9", source: "node-offer-callback", target: "node-unresolved-webhook" },
      { id: "e10", source: "node-resolved-webhook", target: "node-resolved-end" },
      { id: "e11", source: "node-unresolved-webhook", target: "node-unresolved-end" },
    ],
  },

  // ============================================
  // Template: Product Satisfaction Survey
  // ============================================
  {
    id: "template-product-satisfaction",
    name: "Product Satisfaction Survey",
    description: "Gather detailed feedback on product usage, features, and overall satisfaction to improve product development.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! We're reaching out to learn about your experience with our product. Your insights help us make improvements. This survey takes about 3 minutes. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-usage-frequency",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Usage Frequency",
          config: {
            type: "question",
            question: "How often do you use our product? Daily, weekly, monthly, or occasionally?",
            variableName: "usage_frequency",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-favorite-feature",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Favorite Feature",
          config: {
            type: "question",
            question: "What feature or aspect of the product do you find most valuable?",
            variableName: "favorite_feature",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-missing-features",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Missing Features",
          config: {
            type: "question",
            question: "Is there any feature you wish the product had that's currently missing?",
            variableName: "missing_features",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-ease-of-use",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Ease of Use",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how easy is the product to use?",
            variableName: "ease_of_use",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-value",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Value Rating",
          config: {
            type: "question",
            question: "How would you rate the value for money of our product?",
            variableName: "value_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-recommend",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Recommendation",
          config: {
            type: "question",
            question: "Would you recommend our product to colleagues or friends?",
            variableName: "would_recommend",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Submit Survey",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/product-satisfaction",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "product_satisfaction" },
            description: "Submit product satisfaction survey data",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1010 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you so much for your valuable feedback! Your insights help us build a better product. We truly appreciate you taking the time to share your experience. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-usage-frequency" },
      { id: "e2", source: "node-ask-usage-frequency", target: "node-ask-favorite-feature" },
      { id: "e3", source: "node-ask-favorite-feature", target: "node-ask-missing-features" },
      { id: "e4", source: "node-ask-missing-features", target: "node-ask-ease-of-use" },
      { id: "e5", source: "node-ask-ease-of-use", target: "node-ask-value" },
      { id: "e6", source: "node-ask-value", target: "node-ask-recommend" },
      { id: "e7", source: "node-ask-recommend", target: "node-submit-webhook" },
      { id: "e8", source: "node-submit-webhook", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Employee Satisfaction Survey
  // ============================================
  {
    id: "template-employee-satisfaction",
    name: "Employee Satisfaction Survey",
    description: "Collect internal employee feedback on workplace satisfaction, management, growth opportunities, and work environment.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! This is the HR department conducting our quarterly employee satisfaction survey. Your responses are anonymous and will help us improve our workplace. This takes about 5 minutes. Ready to begin?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-job-satisfaction",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Job Satisfaction",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how satisfied are you with your current role and responsibilities?",
            variableName: "job_satisfaction",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-work-life-balance",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Work-Life Balance",
          config: {
            type: "question",
            question: "How would you rate your work-life balance at our company?",
            variableName: "work_life_balance",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-management",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Management",
          config: {
            type: "question",
            question: "Do you feel supported by your direct manager and leadership team?",
            variableName: "management_support",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-growth",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Growth Opportunities",
          config: {
            type: "question",
            question: "Are you satisfied with the professional development and growth opportunities available to you?",
            variableName: "growth_satisfaction",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-culture",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Company Culture",
          config: {
            type: "question",
            question: "How would you describe our company culture? Do you feel it's inclusive and positive?",
            variableName: "culture_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-improvements",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Improvement Suggestions",
          config: {
            type: "question",
            question: "What's one thing you would change or improve about working here?",
            variableName: "improvement_suggestion",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-stay",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Retention Intent",
          config: {
            type: "question",
            question: "Do you see yourself working here for the next 2 years?",
            variableName: "retention_intent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Survey",
          config: {
            type: "webhook",
            url: "https://your-hr-system.com/surveys/employee-satisfaction",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "employee_satisfaction", anonymous: true },
            description: "Submit anonymous employee satisfaction survey",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for completing the survey! Your feedback is invaluable in helping us create a better workplace. All responses are anonymous and will be reviewed by leadership. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-job-satisfaction" },
      { id: "e2", source: "node-ask-job-satisfaction", target: "node-ask-work-life-balance" },
      { id: "e3", source: "node-ask-work-life-balance", target: "node-ask-management" },
      { id: "e4", source: "node-ask-management", target: "node-ask-growth" },
      { id: "e5", source: "node-ask-growth", target: "node-ask-culture" },
      { id: "e6", source: "node-ask-culture", target: "node-ask-improvements" },
      { id: "e7", source: "node-ask-improvements", target: "node-ask-stay" },
      { id: "e8", source: "node-ask-stay", target: "node-submit-webhook" },
      { id: "e9", source: "node-submit-webhook", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Market Research Survey
  // ============================================
  {
    id: "template-market-research",
    name: "Market Research Survey",
    description: "Collect market insights from prospects including buying behavior, competitor awareness, and product preferences.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! We're conducting market research to better understand industry needs. Your insights would be incredibly valuable. This takes about 4 minutes and there's no sales pitch involved. Would you be willing to participate?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-industry",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Industry",
          config: {
            type: "question",
            question: "What industry does your company operate in?",
            variableName: "industry",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-company-size",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Company Size",
          config: {
            type: "question",
            question: "Approximately how many employees work at your organization?",
            variableName: "company_size",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-current-solution",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Current Solution",
          config: {
            type: "question",
            question: "What solutions or tools are you currently using in this space?",
            variableName: "current_solution",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-pain-points",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Pain Points",
          config: {
            type: "question",
            question: "What are the biggest challenges or pain points you face with your current solution?",
            variableName: "pain_points",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-decision-factors",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Decision Factors",
          config: {
            type: "question",
            question: "When evaluating new solutions, what are the top 3 factors that influence your decision?",
            variableName: "decision_factors",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-budget-range",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Budget Range",
          config: {
            type: "question",
            question: "What's your typical annual budget for solutions in this category?",
            variableName: "budget_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-timeline",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Purchase Timeline",
          config: {
            type: "question",
            question: "Are you actively looking to change or upgrade your current solution? If so, what's your timeline?",
            variableName: "purchase_timeline",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interested",
        type: "condition",
        position: { x: 250, y: 1010 },
        data: {
          type: "condition",
          label: "Check Interest",
          config: {
            type: "condition",
            condition: "The prospect is actively looking to change solutions within 6 months",
          },
        },
      },
      {
        id: "node-hot-lead-webhook",
        type: "webhook",
        position: { x: 450, y: 1130 },
        data: {
          type: "webhook",
          label: "Hot Lead",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/market-research",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "hot", priority: "high" },
            description: "Submit as hot lead for sales follow-up",
          },
        },
      },
      {
        id: "node-research-webhook",
        type: "webhook",
        position: { x: 50, y: 1130 },
        data: {
          type: "webhook",
          label: "Research Data",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/market-research",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "research", priority: "normal" },
            description: "Submit market research data",
          },
        },
      },
      {
        id: "node-hot-end",
        type: "end",
        position: { x: 450, y: 1250 },
        data: {
          type: "end",
          label: "Thank Hot Lead",
          config: {
            type: "end",
            endMessage: "Thank you so much for your time and insights! Based on what you've shared, we may have some solutions that could address your needs. Would it be okay if a product specialist reached out to share more information? Either way, we appreciate your participation!",
          },
        },
      },
      {
        id: "node-research-end",
        type: "end",
        position: { x: 50, y: 1250 },
        data: {
          type: "end",
          label: "Thank Research",
          config: {
            type: "end",
            endMessage: "Thank you for participating in our market research! Your insights are incredibly valuable and will help shape better solutions for the industry. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-industry" },
      { id: "e2", source: "node-ask-industry", target: "node-ask-company-size" },
      { id: "e3", source: "node-ask-company-size", target: "node-ask-current-solution" },
      { id: "e4", source: "node-ask-current-solution", target: "node-ask-pain-points" },
      { id: "e5", source: "node-ask-pain-points", target: "node-ask-decision-factors" },
      { id: "e6", source: "node-ask-decision-factors", target: "node-ask-budget-range" },
      { id: "e7", source: "node-ask-budget-range", target: "node-ask-timeline" },
      { id: "e8", source: "node-ask-timeline", target: "node-check-interested" },
      { id: "e9", source: "node-check-interested", sourceHandle: "true", target: "node-hot-lead-webhook" },
      { id: "e10", source: "node-check-interested", sourceHandle: "false", target: "node-research-webhook" },
      { id: "e11", source: "node-hot-lead-webhook", target: "node-hot-end" },
      { id: "e12", source: "node-research-webhook", target: "node-research-end" },
    ],
  },

  // ============================================
  // Template: Exit Interview Survey
  // ============================================
  {
    id: "template-exit-interview",
    name: "Exit Interview Survey",
    description: "Understand why customers cancelled or churned, gather feedback on their experience, and identify opportunities for win-back.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! We noticed you recently cancelled your account with us. We'd really appreciate a few minutes of your time to understand what we could have done better. Your feedback helps us improve for future customers.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-primary-reason",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Primary Reason",
          config: {
            type: "question",
            question: "What was the main reason you decided to cancel your subscription?",
            variableName: "cancellation_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-duration",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Usage Duration",
          config: {
            type: "question",
            question: "How long were you using our service before deciding to cancel?",
            variableName: "usage_duration",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-alternative",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Alternative Solution",
          config: {
            type: "question",
            question: "Are you switching to an alternative solution, or are you discontinuing this type of service entirely?",
            variableName: "switching_to",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-what-worked",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "What Worked",
          config: {
            type: "question",
            question: "What aspects of our service did you find most valuable while you were a customer?",
            variableName: "positive_aspects",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-what-failed",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "What Failed",
          config: {
            type: "question",
            question: "What aspects of our service disappointed you or didn't meet your expectations?",
            variableName: "negative_aspects",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-winback",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Win-Back Offer",
          config: {
            type: "question",
            question: "Is there anything we could do or offer that might bring you back as a customer in the future?",
            variableName: "winback_conditions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-winback",
        type: "condition",
        position: { x: 250, y: 890 },
        data: {
          type: "condition",
          label: "Check Win-Back",
          config: {
            type: "condition",
            condition: "The customer indicated openness to returning under certain conditions",
          },
        },
      },
      {
        id: "node-winback-webhook",
        type: "webhook",
        position: { x: 450, y: 1010 },
        data: {
          type: "webhook",
          label: "Win-Back Lead",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/exit-interview",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "winback_opportunity", priority: "high" },
            description: "Flag as win-back opportunity for retention team",
          },
        },
      },
      {
        id: "node-churn-webhook",
        type: "webhook",
        position: { x: 50, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Churn",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/exit-interview",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { category: "churned", priority: "normal" },
            description: "Log churned customer feedback for analysis",
          },
        },
      },
      {
        id: "node-winback-end",
        type: "end",
        position: { x: 450, y: 1130 },
        data: {
          type: "end",
          label: "Thank Win-Back",
          config: {
            type: "end",
            endMessage: "Thank you so much for your openness! We'll have our team review your feedback and reach out with some options that might address your needs. We value your business and hope to serve you again. Take care!",
          },
        },
      },
      {
        id: "node-churn-end",
        type: "end",
        position: { x: 50, y: 1130 },
        data: {
          type: "end",
          label: "Thank Churn",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to share your feedback. We genuinely appreciate your honesty and will use your insights to improve. We wish you the best, and our door is always open if you ever want to return. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-primary-reason" },
      { id: "e2", source: "node-ask-primary-reason", target: "node-ask-duration" },
      { id: "e3", source: "node-ask-duration", target: "node-ask-alternative" },
      { id: "e4", source: "node-ask-alternative", target: "node-ask-what-worked" },
      { id: "e5", source: "node-ask-what-worked", target: "node-ask-what-failed" },
      { id: "e6", source: "node-ask-what-failed", target: "node-ask-winback" },
      { id: "e7", source: "node-ask-winback", target: "node-check-winback" },
      { id: "e8", source: "node-check-winback", sourceHandle: "true", target: "node-winback-webhook" },
      { id: "e9", source: "node-check-winback", sourceHandle: "false", target: "node-churn-webhook" },
      { id: "e10", source: "node-winback-webhook", target: "node-winback-end" },
      { id: "e11", source: "node-churn-webhook", target: "node-churn-end" },
    ],
  },

  // ============================================
  // Template: Onboarding Feedback Survey
  // ============================================
  {
    id: "template-onboarding-feedback",
    name: "Onboarding Feedback Survey",
    description: "Collect feedback from new customers about their onboarding experience, setup process, and initial impressions.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! Welcome aboard! We're checking in to see how your onboarding experience has been so far. Your feedback helps us ensure new customers get the best start possible. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-setup-ease",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Setup Ease",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how easy was it to set up and get started with our product?",
            variableName: "setup_ease",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-documentation",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Documentation",
          config: {
            type: "question",
            question: "Were the onboarding materials and documentation helpful and clear?",
            variableName: "documentation_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-support-quality",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Support Quality",
          config: {
            type: "question",
            question: "If you contacted support during onboarding, how helpful were they?",
            variableName: "support_quality",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-expectations",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Expectations Met",
          config: {
            type: "question",
            question: "Is the product meeting your initial expectations so far?",
            variableName: "expectations_met",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-struggling",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Check Struggling",
          config: {
            type: "condition",
            condition: "The customer rated setup ease below 3 or indicated they're struggling",
          },
        },
      },
      {
        id: "node-offer-help",
        type: "question",
        position: { x: 50, y: 770 },
        data: {
          type: "question",
          label: "Offer Assistance",
          config: {
            type: "question",
            question: "I'm sorry to hear the setup has been challenging. Would you like me to schedule a personalized onboarding session with one of our specialists?",
            variableName: "wants_assistance",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-improvements",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Suggestions",
          config: {
            type: "question",
            question: "Great! Is there anything about the onboarding process you think we could improve for future customers?",
            variableName: "improvement_suggestions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-struggling-webhook",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Flag Struggling",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/onboarding",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "needs_assistance", priority: "high" },
            description: "Flag customer needing onboarding assistance",
          },
        },
      },
      {
        id: "node-success-webhook",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Log Success",
          config: {
            type: "webhook",
            url: "https://your-crm.com/surveys/onboarding",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "successful_onboarding" },
            description: "Log successful onboarding feedback",
          },
        },
      },
      {
        id: "node-struggling-end",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Help End",
          config: {
            type: "end",
            endMessage: "Thank you for your feedback! Our onboarding specialist will reach out within 24 hours to schedule a session. In the meantime, don't hesitate to contact support if you need immediate help. We're committed to making this work for you!",
          },
        },
      },
      {
        id: "node-success-end",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Success End",
          config: {
            type: "end",
            endMessage: "Thank you for sharing your experience! We're thrilled you're off to a great start. If you ever need anything, our support team is just a call away. Welcome to the family, and have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-setup-ease" },
      { id: "e2", source: "node-ask-setup-ease", target: "node-ask-documentation" },
      { id: "e3", source: "node-ask-documentation", target: "node-ask-support-quality" },
      { id: "e4", source: "node-ask-support-quality", target: "node-ask-expectations" },
      { id: "e5", source: "node-ask-expectations", target: "node-check-struggling" },
      { id: "e6", source: "node-check-struggling", sourceHandle: "true", target: "node-offer-help" },
      { id: "e7", source: "node-check-struggling", sourceHandle: "false", target: "node-ask-improvements" },
      { id: "e8", source: "node-offer-help", target: "node-struggling-webhook" },
      { id: "e9", source: "node-ask-improvements", target: "node-success-webhook" },
      { id: "e10", source: "node-struggling-webhook", target: "node-struggling-end" },
      { id: "e11", source: "node-success-webhook", target: "node-success-end" },
    ],
  },

  // ============================================
  // Template: Beta Tester Feedback
  // ============================================
  {
    id: "template-beta-tester-feedback",
    name: "Beta Tester Feedback",
    description: "Collect detailed feedback from beta testers about new features, bugs encountered, and overall product experience.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! Thank you for participating in our beta program. Your feedback is crucial in shaping the final product. We'd love to hear about your experience so far. Do you have about 5 minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-features-tested",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Features Tested",
          config: {
            type: "question",
            question: "Which new features have you had a chance to test?",
            variableName: "features_tested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-favorite-feature",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Favorite Feature",
          config: {
            type: "question",
            question: "Which feature impressed you the most and why?",
            variableName: "favorite_feature",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-bugs",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Bugs Found",
          config: {
            type: "question",
            question: "Did you encounter any bugs or issues while testing? Please describe them if so.",
            variableName: "bugs_encountered",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-bugs",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Check Bugs",
          config: {
            type: "condition",
            condition: "The tester reported encountering bugs or issues",
          },
        },
      },
      {
        id: "node-ask-bug-severity",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Bug Severity",
          config: {
            type: "question",
            question: "How severe were these bugs? Were they minor inconveniences or did they block your usage?",
            variableName: "bug_severity",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-performance",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Performance",
          config: {
            type: "question",
            question: "How would you rate the overall performance and speed of the beta version?",
            variableName: "performance_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-missing",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Missing Features",
          config: {
            type: "question",
            question: "Is there any feature or functionality you expected to see that was missing?",
            variableName: "missing_features",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-ready",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Launch Ready",
          config: {
            type: "question",
            question: "In your opinion, is this beta version ready for public launch? Why or why not?",
            variableName: "launch_readiness",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Feedback",
          config: {
            type: "webhook",
            url: "https://your-product.com/surveys/beta-feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "beta_tester_feedback" },
            description: "Submit beta tester feedback to product team",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you so much for being part of our beta program! Your detailed feedback is invaluable in making our product the best it can be. We'll keep you updated on the launch and you'll have early access to the final version. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-features-tested" },
      { id: "e2", source: "node-ask-features-tested", target: "node-ask-favorite-feature" },
      { id: "e3", source: "node-ask-favorite-feature", target: "node-ask-bugs" },
      { id: "e4", source: "node-ask-bugs", target: "node-check-bugs" },
      { id: "e5", source: "node-check-bugs", sourceHandle: "true", target: "node-ask-bug-severity" },
      { id: "e6", source: "node-check-bugs", sourceHandle: "false", target: "node-ask-performance" },
      { id: "e7", source: "node-ask-bug-severity", target: "node-ask-missing" },
      { id: "e8", source: "node-ask-performance", target: "node-ask-missing" },
      { id: "e9", source: "node-ask-missing", target: "node-ask-ready" },
      { id: "e10", source: "node-ask-ready", target: "node-submit-webhook" },
      { id: "e11", source: "node-submit-webhook", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Event Feedback Survey
  // ============================================
  {
    id: "template-event-feedback",
    name: "Event Feedback Survey",
    description: "Collect post-event satisfaction feedback including content quality, speaker ratings, venue, and overall experience.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! Thank you for attending our recent event. We'd love to hear your thoughts on how it went. This quick survey takes about 3 minutes. Would you be willing to share your feedback?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-overall",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Overall Rating",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how would you rate the event overall?",
            variableName: "overall_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-content",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Content Quality",
          config: {
            type: "question",
            question: "How relevant and valuable was the event content to you?",
            variableName: "content_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-speakers",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Speakers",
          config: {
            type: "question",
            question: "How would you rate the speakers and presenters?",
            variableName: "speaker_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-venue",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Venue/Platform",
          config: {
            type: "question",
            question: "How satisfied were you with the venue or virtual platform?",
            variableName: "venue_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-networking",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Networking",
          config: {
            type: "question",
            question: "Were you satisfied with the networking opportunities provided?",
            variableName: "networking_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-future",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Future Attendance",
          config: {
            type: "question",
            question: "Would you attend our future events?",
            variableName: "attend_future",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-topics",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Topic Suggestions",
          config: {
            type: "question",
            question: "What topics would you like to see covered in future events?",
            variableName: "topic_suggestions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Feedback",
          config: {
            type: "webhook",
            url: "https://your-events.com/surveys/event-feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "event_feedback" },
            description: "Submit event feedback for analysis",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for your valuable feedback! Your insights help us create even better events in the future. We'll send you updates about upcoming events that match your interests. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-overall" },
      { id: "e2", source: "node-ask-overall", target: "node-ask-content" },
      { id: "e3", source: "node-ask-content", target: "node-ask-speakers" },
      { id: "e4", source: "node-ask-speakers", target: "node-ask-venue" },
      { id: "e5", source: "node-ask-venue", target: "node-ask-networking" },
      { id: "e6", source: "node-ask-networking", target: "node-ask-future" },
      { id: "e7", source: "node-ask-future", target: "node-ask-topics" },
      { id: "e8", source: "node-ask-topics", target: "node-submit-webhook" },
      { id: "e9", source: "node-submit-webhook", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Website Usability Feedback
  // ============================================
  {
    id: "template-website-feedback",
    name: "Website Usability Feedback",
    description: "Collect feedback on digital experience including website navigation, design, content clarity, and conversion experience.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! We're gathering feedback to improve our website experience. Your insights as a recent visitor would be incredibly helpful. This takes just 3 minutes. Would you like to participate?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-purpose",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Visit Purpose",
          config: {
            type: "question",
            question: "What was the main purpose of your recent visit to our website?",
            variableName: "visit_purpose",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-goal-achieved",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Goal Achieved",
          config: {
            type: "question",
            question: "Were you able to accomplish what you came to do?",
            variableName: "goal_achieved",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-success",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Check Success",
          config: {
            type: "condition",
            condition: "The visitor was able to accomplish their goal",
          },
        },
      },
      {
        id: "node-ask-ease",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Ease of Use",
          config: {
            type: "question",
            question: "How easy was it to find what you were looking for? Rate from 1 to 5.",
            variableName: "ease_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-blockers",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Blockers",
          config: {
            type: "question",
            question: "What prevented you from completing your task? Please describe the issue.",
            variableName: "blockers",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-design",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Design Feedback",
          config: {
            type: "question",
            question: "How would you rate the overall look and design of the website?",
            variableName: "design_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-speed",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Speed",
          config: {
            type: "question",
            question: "How satisfied were you with the website loading speed?",
            variableName: "speed_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-improvements",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Improvements",
          config: {
            type: "question",
            question: "What one thing would you change about our website to make it better?",
            variableName: "improvement_suggestion",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-recommend",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Recommend",
          config: {
            type: "question",
            question: "How likely are you to recommend our website to others?",
            variableName: "recommend_likelihood",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-webhook",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Submit Feedback",
          config: {
            type: "webhook",
            url: "https://your-analytics.com/surveys/website-feedback",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "website_usability" },
            description: "Submit website usability feedback",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for helping us improve our website! Your feedback is invaluable and will directly influence our upcoming updates. We appreciate you taking the time to share your experience. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-purpose" },
      { id: "e2", source: "node-ask-purpose", target: "node-ask-goal-achieved" },
      { id: "e3", source: "node-ask-goal-achieved", target: "node-check-success" },
      { id: "e4", source: "node-check-success", sourceHandle: "true", target: "node-ask-ease" },
      { id: "e5", source: "node-check-success", sourceHandle: "false", target: "node-ask-blockers" },
      { id: "e6", source: "node-ask-ease", target: "node-ask-design" },
      { id: "e7", source: "node-ask-blockers", target: "node-ask-design" },
      { id: "e8", source: "node-ask-design", target: "node-ask-speed" },
      { id: "e9", source: "node-ask-speed", target: "node-ask-improvements" },
      { id: "e10", source: "node-ask-improvements", target: "node-ask-recommend" },
      { id: "e11", source: "node-ask-recommend", target: "node-submit-webhook" },
      { id: "e12", source: "node-submit-webhook", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 1: Prescription Refill Request
  // ============================================
  {
    id: "template-prescription-refill",
    name: "Prescription Refill Request",
    description: "HIPAA-compliant prescription refill process with patient identity verification, medication details collection, and pharmacy coordination.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "HIPAA Greeting",
          config: {
            type: "message",
            message: "Hello, thank you for calling our prescription refill line. For your privacy and security, this call may be recorded for quality assurance. I'll need to verify your identity before we proceed. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-dob",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Date of Birth",
          config: {
            type: "question",
            question: "For verification purposes, may I have your date of birth please?",
            variableName: "patient_dob",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-name",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Verify Full Name",
          config: {
            type: "question",
            question: "Thank you. And may I have your full legal name as it appears on your medical records?",
            variableName: "patient_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-address",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Verify Address",
          config: {
            type: "question",
            question: "Can you confirm the street address we have on file for you?",
            variableName: "patient_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-medication-name",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Medication Name",
          config: {
            type: "question",
            question: "Thank you for verifying your identity. Which medication would you like to refill today?",
            variableName: "medication_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-medication-strength",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Medication Strength",
          config: {
            type: "question",
            question: "What is the strength or dosage of this medication?",
            variableName: "medication_strength",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-pharmacy-preference",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Pharmacy Preference",
          config: {
            type: "question",
            question: "Which pharmacy would you like us to send the prescription to? Please provide the pharmacy name and location.",
            variableName: "pharmacy_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-urgency-check",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Urgency Check",
          config: {
            type: "question",
            question: "How soon do you need this refill? Is this urgent, or within standard processing time of 24-48 hours?",
            variableName: "refill_urgency",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-refill",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Refill Request",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/refill-requests",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { request_type: "prescription_refill", hipaa_verified: true },
            description: "Submit refill request to EHR system",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Confirmation",
          config: {
            type: "end",
            endMessage: "Your prescription refill request has been submitted. Our clinical team will review it and contact you if any additional information is needed. The prescription should be ready at your pharmacy within the timeframe discussed. Is there anything else I can help you with today?",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-dob" },
      { id: "e2", source: "node-verify-dob", target: "node-verify-name" },
      { id: "e3", source: "node-verify-name", target: "node-verify-address" },
      { id: "e4", source: "node-verify-address", target: "node-medication-name" },
      { id: "e5", source: "node-medication-name", target: "node-medication-strength" },
      { id: "e6", source: "node-medication-strength", target: "node-pharmacy-preference" },
      { id: "e7", source: "node-pharmacy-preference", target: "node-urgency-check" },
      { id: "e8", source: "node-urgency-check", target: "node-submit-refill" },
      { id: "e9", source: "node-submit-refill", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 2: Lab Results Notification
  // ============================================
  {
    id: "template-lab-results-notification",
    name: "Lab Results Notification",
    description: "HIPAA-compliant notification of available lab results with patient verification and secure access instructions.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Initial Contact",
          config: {
            type: "message",
            message: "Hello, this is a call from your healthcare provider regarding your recent laboratory work. For your privacy and in compliance with healthcare regulations, I need to verify your identity before sharing any information. Is this a good time to speak?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-dob",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Date of Birth",
          config: {
            type: "question",
            question: "May I please have your date of birth for verification?",
            variableName: "patient_dob",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-name",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Verify Name",
          config: {
            type: "question",
            question: "Thank you. Can you confirm your full name as it appears in our records?",
            variableName: "patient_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-last4ssn",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Verify Last 4 SSN",
          config: {
            type: "question",
            question: "For additional security, can you provide the last four digits of your Social Security number?",
            variableName: "last_four_ssn",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-results-ready",
        type: "message",
        position: { x: 250, y: 530 },
        data: {
          type: "message",
          label: "Results Available",
          config: {
            type: "message",
            message: "Thank you for verifying your identity. I'm calling to let you know that your recent lab results are now available. Your healthcare provider has reviewed them.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-access-preference",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Access Preference",
          config: {
            type: "question",
            question: "Would you prefer to view your results through our secure patient portal, or would you like to schedule a call with your provider to discuss them?",
            variableName: "access_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-portal",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Portal Access?",
          config: {
            type: "condition",
            condition: "The patient prefers to use the patient portal to view results",
          },
        },
      },
      {
        id: "node-portal-instructions",
        type: "message",
        position: { x: 450, y: 890 },
        data: {
          type: "message",
          label: "Portal Instructions",
          config: {
            type: "message",
            message: "You can access your results securely by logging into our patient portal at your convenience. If you need assistance with portal access or forgot your login credentials, please call our support line.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-schedule-callback",
        type: "appointment",
        position: { x: 50, y: 890 },
        data: {
          type: "appointment",
          label: "Schedule Provider Call",
          config: {
            type: "appointment",
            appointmentType: "Provider Callback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-log-notification",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Notification",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/notifications/lab-results",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { notification_type: "lab_results", hipaa_verified: true },
            description: "Log lab results notification in patient record",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for your time. Please remember that your health information is kept strictly confidential. If you have any questions about your results, don't hesitate to contact our office. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-dob" },
      { id: "e2", source: "node-verify-dob", target: "node-verify-name" },
      { id: "e3", source: "node-verify-name", target: "node-verify-last4ssn" },
      { id: "e4", source: "node-verify-last4ssn", target: "node-results-ready" },
      { id: "e5", source: "node-results-ready", target: "node-access-preference" },
      { id: "e6", source: "node-access-preference", target: "node-check-portal" },
      { id: "e7", source: "node-check-portal", sourceHandle: "true", target: "node-portal-instructions" },
      { id: "e8", source: "node-check-portal", sourceHandle: "false", target: "node-schedule-callback" },
      { id: "e9", source: "node-portal-instructions", target: "node-log-notification" },
      { id: "e10", source: "node-schedule-callback", target: "node-log-notification" },
      { id: "e11", source: "node-log-notification", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 3: Insurance Verification
  // ============================================
  {
    id: "template-insurance-verification",
    name: "Insurance Verification",
    description: "Pre-visit insurance verification to confirm coverage, collect policy details, and inform patients of potential out-of-pocket costs.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello, this is a call from our billing department regarding your upcoming appointment. We'd like to verify your insurance information to ensure a smooth visit and help you understand your coverage. This call may be recorded for quality purposes. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Patient Identity",
          config: {
            type: "question",
            question: "For verification, may I have your full name and date of birth?",
            variableName: "patient_identity",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-insurance-provider",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Insurance Provider",
          config: {
            type: "question",
            question: "What is the name of your current health insurance provider?",
            variableName: "insurance_provider",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-member-id",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Member ID",
          config: {
            type: "question",
            question: "What is your member ID number? This is usually found on your insurance card.",
            variableName: "member_id",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-group-number",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Group Number",
          config: {
            type: "question",
            question: "Do you have a group number on your card? If so, what is it?",
            variableName: "group_number",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-subscriber-info",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Subscriber Information",
          config: {
            type: "question",
            question: "Are you the primary subscriber, or is the policy under someone else's name? If someone else, what is their name and relationship to you?",
            variableName: "subscriber_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-secondary-insurance",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Secondary Insurance",
          config: {
            type: "question",
            question: "Do you have any secondary insurance coverage we should know about?",
            variableName: "secondary_insurance",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-insurance",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Verify Coverage",
          config: {
            type: "webhook",
            url: "https://your-billing-api.com/insurance/verify",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { verification_type: "pre_visit" },
            description: "Submit insurance details for eligibility verification",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Thank you for providing your insurance information. We will verify your coverage and contact you if there are any issues or if we need additional information before your appointment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Please remember to bring your insurance card and a valid photo ID to your appointment. If you have any questions about your coverage or estimated costs, please call our billing department. Thank you and we look forward to seeing you!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-insurance-provider" },
      { id: "e3", source: "node-insurance-provider", target: "node-member-id" },
      { id: "e4", source: "node-member-id", target: "node-group-number" },
      { id: "e5", source: "node-group-number", target: "node-subscriber-info" },
      { id: "e6", source: "node-subscriber-info", target: "node-secondary-insurance" },
      { id: "e7", source: "node-secondary-insurance", target: "node-verify-insurance" },
      { id: "e8", source: "node-verify-insurance", target: "node-confirmation" },
      { id: "e9", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 4: Pre-Visit Health Screening
  // ============================================
  {
    id: "template-pre-visit-screening",
    name: "Pre-Visit Health Screening",
    description: "COVID-19 and general symptom screening before appointments to ensure patient and staff safety with appropriate routing.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Screening Introduction",
          config: {
            type: "message",
            message: "Hello, this is a pre-visit health screening call for your upcoming appointment. To ensure the safety of all patients and staff, I need to ask you a few health-related questions. This should only take about 2 minutes. Are you ready to proceed?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "May I confirm your name and date of birth for our records?",
            variableName: "patient_identity",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-fever-check",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Fever Check",
          config: {
            type: "question",
            question: "In the past 14 days, have you had a fever of 100.4°F or higher, or felt feverish?",
            variableName: "has_fever",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-respiratory-symptoms",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Respiratory Symptoms",
          config: {
            type: "question",
            question: "Have you experienced any cough, shortness of breath, or difficulty breathing in the past 14 days?",
            variableName: "respiratory_symptoms",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-other-symptoms",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Other Symptoms",
          config: {
            type: "question",
            question: "Have you had any loss of taste or smell, body aches, sore throat, or gastrointestinal symptoms like nausea, vomiting, or diarrhea?",
            variableName: "other_symptoms",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-exposure-check",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Exposure Check",
          config: {
            type: "question",
            question: "In the past 14 days, have you been in close contact with anyone who has tested positive for COVID-19 or any other contagious illness?",
            variableName: "exposure_history",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-travel-check",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Travel Check",
          config: {
            type: "question",
            question: "Have you traveled internationally or to any high-risk areas in the past 14 days?",
            variableName: "travel_history",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-evaluate-symptoms",
        type: "condition",
        position: { x: 250, y: 890 },
        data: {
          type: "condition",
          label: "Evaluate Responses",
          config: {
            type: "condition",
            condition: "The patient answered NO to all symptom and exposure questions",
          },
        },
      },
      {
        id: "node-cleared",
        type: "message",
        position: { x: 450, y: 1010 },
        data: {
          type: "message",
          label: "Cleared Message",
          config: {
            type: "message",
            message: "Thank you for completing the health screening. Based on your responses, you are cleared for your in-person appointment. Please continue to monitor your health and contact us if your condition changes before your visit.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-not-cleared",
        type: "message",
        position: { x: 50, y: 1010 },
        data: {
          type: "message",
          label: "Follow-up Required",
          config: {
            type: "message",
            message: "Based on your responses, we recommend converting your appointment to a telehealth visit or rescheduling. A member of our clinical team will contact you shortly to discuss the best options for your care while ensuring everyone's safety.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-screening",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Submit Screening",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/screenings",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { screening_type: "pre_visit_health" },
            description: "Submit screening results to patient record",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for helping us maintain a safe environment for all patients and staff. If you have any questions before your appointment, please don't hesitate to call our office. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-fever-check" },
      { id: "e3", source: "node-fever-check", target: "node-respiratory-symptoms" },
      { id: "e4", source: "node-respiratory-symptoms", target: "node-other-symptoms" },
      { id: "e5", source: "node-other-symptoms", target: "node-exposure-check" },
      { id: "e6", source: "node-exposure-check", target: "node-travel-check" },
      { id: "e7", source: "node-travel-check", target: "node-evaluate-symptoms" },
      { id: "e8", source: "node-evaluate-symptoms", sourceHandle: "true", target: "node-cleared" },
      { id: "e9", source: "node-evaluate-symptoms", sourceHandle: "false", target: "node-not-cleared" },
      { id: "e10", source: "node-cleared", target: "node-submit-screening" },
      { id: "e11", source: "node-not-cleared", target: "node-submit-screening" },
      { id: "e12", source: "node-submit-screening", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 5: Post-Discharge Follow-up
  // ============================================
  {
    id: "template-post-discharge-followup",
    name: "Post-Discharge Follow-up",
    description: "Follow-up call after hospital discharge to check patient recovery, medication compliance, and identify any complications early.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Follow-up Introduction",
          config: {
            type: "message",
            message: "Hello, this is a follow-up call from the care coordination team regarding your recent hospital discharge. We want to make sure your recovery is going well. This call is confidential and may be recorded for quality purposes. Do you have a few minutes to speak with me?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For your privacy, may I verify your date of birth and the last four digits of your Social Security number?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-overall-feeling",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Overall Condition",
          config: {
            type: "question",
            question: "How are you feeling overall since you left the hospital? Would you say you're feeling better, about the same, or worse?",
            variableName: "overall_condition",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-pain-level",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Pain Assessment",
          config: {
            type: "question",
            question: "On a scale of 0 to 10, with 0 being no pain and 10 being the worst pain, how would you rate any pain you're experiencing?",
            variableName: "pain_level",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-medication-check",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Medication Check",
          config: {
            type: "question",
            question: "Have you been able to obtain and take all your prescribed medications as directed?",
            variableName: "medication_compliance",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-side-effects",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Side Effects",
          config: {
            type: "question",
            question: "Are you experiencing any side effects from your medications, such as nausea, dizziness, or allergic reactions?",
            variableName: "medication_side_effects",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-warning-signs",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Warning Signs",
          config: {
            type: "question",
            question: "Have you experienced any warning signs we discussed at discharge, such as fever, increased swelling, difficulty breathing, or worsening symptoms?",
            variableName: "warning_signs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-concerns",
        type: "condition",
        position: { x: 250, y: 890 },
        data: {
          type: "condition",
          label: "Evaluate Concerns",
          config: {
            type: "condition",
            condition: "The patient reports concerning symptoms, high pain levels, or warning signs",
          },
        },
      },
      {
        id: "node-escalate",
        type: "message",
        position: { x: 50, y: 1010 },
        data: {
          type: "message",
          label: "Clinical Escalation",
          config: {
            type: "message",
            message: "Based on what you've shared, I want to make sure you receive prompt attention. I'm going to notify our clinical team right away, and a nurse will call you back within the next hour to discuss your symptoms further. If your condition worsens or you feel it's an emergency, please call 911 or go to the nearest emergency room.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-routine-followup",
        type: "question",
        position: { x: 450, y: 1010 },
        data: {
          type: "question",
          label: "Follow-up Appointment",
          config: {
            type: "question",
            question: "I'm glad to hear your recovery is progressing well. Do you have your follow-up appointment scheduled, and do you have any questions about your care plan?",
            variableName: "followup_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-followup",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Follow-up",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/discharge-followups",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { followup_type: "post_discharge" },
            description: "Log follow-up call details in patient record",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to speak with us. Your health and recovery are our top priorities. Please don't hesitate to call if you have any concerns. Take care and we wish you a speedy recovery!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-overall-feeling" },
      { id: "e3", source: "node-overall-feeling", target: "node-pain-level" },
      { id: "e4", source: "node-pain-level", target: "node-medication-check" },
      { id: "e5", source: "node-medication-check", target: "node-side-effects" },
      { id: "e6", source: "node-side-effects", target: "node-warning-signs" },
      { id: "e7", source: "node-warning-signs", target: "node-check-concerns" },
      { id: "e8", source: "node-check-concerns", sourceHandle: "true", target: "node-escalate" },
      { id: "e9", source: "node-check-concerns", sourceHandle: "false", target: "node-routine-followup" },
      { id: "e10", source: "node-escalate", target: "node-submit-followup" },
      { id: "e11", source: "node-routine-followup", target: "node-submit-followup" },
      { id: "e12", source: "node-submit-followup", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 6: Medication Adherence Check
  // ============================================
  {
    id: "template-medication-adherence",
    name: "Medication Adherence Check",
    description: "Check patient medication compliance, identify barriers to adherence, and provide support for chronic condition management.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello, this is a wellness check call from your healthcare provider's pharmacy care team. We're calling to help ensure you're getting the most from your medications. This is a confidential call. Do you have a few minutes to speak with me?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For your privacy and security, may I verify your full name and date of birth?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-medication-list",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Confirm Medications",
          config: {
            type: "question",
            question: "I'd like to confirm the medications you're currently taking. Can you tell me which prescription medications you take regularly?",
            variableName: "current_medications",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-adherence-check",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Adherence Check",
          config: {
            type: "question",
            question: "In the past week, how often have you taken your medications as prescribed? Would you say always, most of the time, sometimes, or rarely?",
            variableName: "adherence_level",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-missed-doses",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Missed Doses",
          config: {
            type: "question",
            question: "Have you missed any doses in the past week? If so, approximately how many?",
            variableName: "missed_doses",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-barriers",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Identify Barriers",
          config: {
            type: "question",
            question: "Are there any challenges that make it difficult for you to take your medications? For example, cost, side effects, remembering to take them, or difficulty understanding the instructions?",
            variableName: "adherence_barriers",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-barriers",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Has Barriers?",
          config: {
            type: "condition",
            condition: "The patient identified barriers to medication adherence such as cost, side effects, or other difficulties",
          },
        },
      },
      {
        id: "node-offer-support",
        type: "message",
        position: { x: 50, y: 890 },
        data: {
          type: "message",
          label: "Offer Support",
          config: {
            type: "message",
            message: "Thank you for sharing that with me. There are resources available that may help. I'll make a note in your record, and our care team will reach out to discuss options such as patient assistance programs, alternative medications, or tools to help you remember to take your medications.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-positive-reinforcement",
        type: "message",
        position: { x: 450, y: 890 },
        data: {
          type: "message",
          label: "Positive Reinforcement",
          config: {
            type: "message",
            message: "That's great to hear! Taking your medications as prescribed is one of the most important things you can do for your health. Keep up the excellent work!",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-side-effects",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Side Effects",
          config: {
            type: "question",
            question: "Are you experiencing any side effects from your medications that you'd like to discuss with your provider?",
            variableName: "side_effects",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-adherence",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Adherence Check",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/medication-adherence",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { check_type: "medication_adherence" },
            description: "Log medication adherence check in patient record",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to speak with us today. Remember, if you ever have questions about your medications, please don't hesitate to call our pharmacy care team. We're here to help you stay healthy. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-medication-list" },
      { id: "e3", source: "node-medication-list", target: "node-adherence-check" },
      { id: "e4", source: "node-adherence-check", target: "node-missed-doses" },
      { id: "e5", source: "node-missed-doses", target: "node-barriers" },
      { id: "e6", source: "node-barriers", target: "node-check-barriers" },
      { id: "e7", source: "node-check-barriers", sourceHandle: "true", target: "node-offer-support" },
      { id: "e8", source: "node-check-barriers", sourceHandle: "false", target: "node-positive-reinforcement" },
      { id: "e9", source: "node-offer-support", target: "node-side-effects" },
      { id: "e10", source: "node-positive-reinforcement", target: "node-side-effects" },
      { id: "e11", source: "node-side-effects", target: "node-submit-adherence" },
      { id: "e12", source: "node-submit-adherence", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 7: Preventive Care Reminder
  // ============================================
  {
    id: "template-preventive-care-reminder",
    name: "Preventive Care Reminder",
    description: "Remind patients about annual checkups, vaccinations, and recommended screenings based on age and health history.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Care Reminder Intro",
          config: {
            type: "message",
            message: "Hello, this is a wellness call from your healthcare provider's preventive care team. We're reaching out because you may be due for some important health screenings or vaccinations. Do you have a few minutes to discuss your preventive care needs?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For your privacy, may I verify your name and date of birth?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-annual-checkup",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Annual Checkup",
          config: {
            type: "question",
            question: "Our records show it's been about a year since your last annual wellness exam. Would you like to schedule your annual checkup?",
            variableName: "wants_annual_checkup",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-flu-vaccine",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Flu Vaccine",
          config: {
            type: "question",
            question: "Have you received your annual flu vaccination this season?",
            variableName: "flu_vaccine_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-other-vaccines",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Other Vaccines",
          config: {
            type: "question",
            question: "Based on your age and health history, you may also be due for other vaccinations such as pneumonia, shingles, or COVID-19 boosters. Would you like information about these?",
            variableName: "other_vaccines_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-screenings",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Health Screenings",
          config: {
            type: "question",
            question: "Are there any health screenings you'd like to schedule, such as cholesterol, blood pressure, diabetes, or cancer screenings?",
            variableName: "screening_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-schedule-appointment",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Schedule Now?",
          config: {
            type: "condition",
            condition: "The patient wants to schedule an appointment for any preventive care service",
          },
        },
      },
      {
        id: "node-book-appointment",
        type: "appointment",
        position: { x: 50, y: 890 },
        data: {
          type: "appointment",
          label: "Book Appointment",
          config: {
            type: "appointment",
            appointmentType: "Preventive Care Visit",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-send-info",
        type: "message",
        position: { x: 450, y: 890 },
        data: {
          type: "message",
          label: "Send Information",
          config: {
            type: "message",
            message: "I understand. We'll send you information about recommended preventive care services to your patient portal and email. You can schedule an appointment whenever you're ready through our online portal or by calling our office.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-reminder",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Reminder",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/preventive-care/reminders",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { reminder_type: "preventive_care" },
            description: "Log preventive care reminder in patient record",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to discuss your preventive care needs. Remember, staying up to date with screenings and vaccinations is one of the best ways to protect your health. If you have any questions, please don't hesitate to call us. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-annual-checkup" },
      { id: "e3", source: "node-annual-checkup", target: "node-flu-vaccine" },
      { id: "e4", source: "node-flu-vaccine", target: "node-other-vaccines" },
      { id: "e5", source: "node-other-vaccines", target: "node-screenings" },
      { id: "e6", source: "node-screenings", target: "node-schedule-appointment" },
      { id: "e7", source: "node-schedule-appointment", sourceHandle: "true", target: "node-book-appointment" },
      { id: "e8", source: "node-schedule-appointment", sourceHandle: "false", target: "node-send-info" },
      { id: "e9", source: "node-book-appointment", target: "node-submit-reminder" },
      { id: "e10", source: "node-send-info", target: "node-submit-reminder" },
      { id: "e11", source: "node-submit-reminder", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 8: Specialist Referral Coordination
  // ============================================
  {
    id: "template-specialist-referral",
    name: "Specialist Referral Coordination",
    description: "Coordinate specialist referrals by collecting necessary information, explaining the referral process, and scheduling specialist appointments.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Referral Introduction",
          config: {
            type: "message",
            message: "Hello, this is a call from the referral coordination team at your healthcare provider's office. Your doctor has recommended you see a specialist, and I'm calling to help coordinate that appointment. This call is confidential. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For your security, may I verify your full name and date of birth?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-referral",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Explain Referral",
          config: {
            type: "message",
            message: "Your primary care provider has submitted a referral for you to see a specialist. I'm here to help you understand the process and schedule your appointment.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-specialist-preference",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Specialist Preference",
          config: {
            type: "question",
            question: "Do you have a preferred specialist you'd like to see, or would you like us to recommend one who accepts your insurance and is conveniently located?",
            variableName: "specialist_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-location-preference",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Location Preference",
          config: {
            type: "question",
            question: "What location would be most convenient for you? Please share your city or zip code.",
            variableName: "location_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-schedule-preference",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Schedule Preference",
          config: {
            type: "question",
            question: "What days and times generally work best for your schedule? Are mornings, afternoons, or specific days of the week better for you?",
            variableName: "schedule_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-insurance-confirm",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Insurance Confirmation",
          config: {
            type: "question",
            question: "Let me confirm your insurance information. Is your current coverage still with the same provider we have on file?",
            variableName: "insurance_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-referral",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Process Referral",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/referrals",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { referral_type: "specialist" },
            description: "Submit referral request for specialist appointment",
          },
        },
      },
      {
        id: "node-next-steps",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Next Steps",
          config: {
            type: "message",
            message: "I've documented your preferences. Our team will work on scheduling your specialist appointment and will call you back within 2-3 business days with appointment options. We'll also ensure all necessary medical records are sent to the specialist before your visit.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. If you have any questions before we call back, please contact our referral coordination department. We're here to make this process as smooth as possible for you. Take care!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-explain-referral" },
      { id: "e3", source: "node-explain-referral", target: "node-specialist-preference" },
      { id: "e4", source: "node-specialist-preference", target: "node-location-preference" },
      { id: "e5", source: "node-location-preference", target: "node-schedule-preference" },
      { id: "e6", source: "node-schedule-preference", target: "node-insurance-confirm" },
      { id: "e7", source: "node-insurance-confirm", target: "node-submit-referral" },
      { id: "e8", source: "node-submit-referral", target: "node-next-steps" },
      { id: "e9", source: "node-next-steps", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 9: Telehealth Appointment Prep
  // ============================================
  {
    id: "template-telehealth-prep",
    name: "Telehealth Appointment Prep",
    description: "Prepare patients for upcoming telehealth visits by verifying technology setup, explaining the process, and collecting pre-visit information.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Prep Call Introduction",
          config: {
            type: "message",
            message: "Hello, this is a preparation call for your upcoming telehealth appointment. I want to make sure you're all set for a successful virtual visit with your provider. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For verification, may I confirm your name and date of birth?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-appointment",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Confirm Appointment",
          config: {
            type: "message",
            message: "I see you have a telehealth appointment scheduled. I'd like to walk you through a few things to ensure your visit goes smoothly.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-device-check",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Device Check",
          config: {
            type: "question",
            question: "What device will you be using for your telehealth visit? For example, a smartphone, tablet, or computer?",
            variableName: "device_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-internet-check",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Internet Check",
          config: {
            type: "question",
            question: "Do you have reliable internet access at the location where you'll be during the appointment?",
            variableName: "internet_access",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-app-check",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "App/Portal Check",
          config: {
            type: "question",
            question: "Have you downloaded our telehealth app or tested logging into our patient portal? If not, would you like me to walk you through the process?",
            variableName: "app_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-camera-audio",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Camera & Audio",
          config: {
            type: "question",
            question: "Please make sure your device's camera and microphone are working. Have you tested them recently?",
            variableName: "camera_audio_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-quiet-space",
        type: "message",
        position: { x: 250, y: 890 },
        data: {
          type: "message",
          label: "Privacy Reminder",
          config: {
            type: "message",
            message: "For your privacy during the visit, please find a quiet, well-lit space where you can speak privately with your provider. Have your insurance card, medication list, and any questions you'd like to ask ready.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-pre-visit-questions",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Pre-Visit Questions",
          config: {
            type: "question",
            question: "Is there anything specific you'd like to discuss with your provider during this visit? I can add notes to your record.",
            variableName: "visit_concerns",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-prep",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Prep Call",
          config: {
            type: "webhook",
            url: "https://your-ehr-api.com/telehealth/prep",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { prep_type: "telehealth_appointment" },
            description: "Log telehealth preparation call",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Closing",
          config: {
            type: "end",
            endMessage: "You're all set for your telehealth appointment! Remember to log in about 5 minutes early to test your connection. If you experience any technical difficulties, our support team is available to help. Is there anything else I can assist you with today?",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-confirm-appointment" },
      { id: "e3", source: "node-confirm-appointment", target: "node-device-check" },
      { id: "e4", source: "node-device-check", target: "node-internet-check" },
      { id: "e5", source: "node-internet-check", target: "node-app-check" },
      { id: "e6", source: "node-app-check", target: "node-camera-audio" },
      { id: "e7", source: "node-camera-audio", target: "node-quiet-space" },
      { id: "e8", source: "node-quiet-space", target: "node-pre-visit-questions" },
      { id: "e9", source: "node-pre-visit-questions", target: "node-submit-prep" },
      { id: "e10", source: "node-submit-prep", target: "node-end" },
    ],
  },

  // ============================================
  // Healthcare Template 10: Patient Satisfaction Survey (HCAHPS)
  // ============================================
  {
    id: "template-patient-satisfaction",
    name: "Patient Satisfaction Survey",
    description: "HCAHPS-style patient satisfaction survey to collect feedback on care quality, communication, and overall hospital/clinic experience.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Survey Introduction",
          config: {
            type: "message",
            message: "Hello, this is a patient satisfaction survey call regarding your recent healthcare experience. Your feedback helps us improve the quality of care for all patients. This survey takes about 5 minutes and your responses are confidential. Do you have time to participate?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-patient",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Patient",
          config: {
            type: "question",
            question: "For our records, may I confirm your name and the date of your recent visit?",
            variableName: "patient_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-overall-rating",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Overall Rating",
          config: {
            type: "question",
            question: "Using a scale of 0 to 10, where 0 is the worst care possible and 10 is the best care possible, what number would you use to rate your overall care during this visit?",
            variableName: "overall_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-nurse-communication",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Nurse Communication",
          config: {
            type: "question",
            question: "How often did nurses treat you with courtesy and respect, listen carefully to you, and explain things clearly? Would you say never, sometimes, usually, or always?",
            variableName: "nurse_communication",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-doctor-communication",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Doctor Communication",
          config: {
            type: "question",
            question: "How often did doctors treat you with courtesy and respect, listen carefully to you, and explain things in a way you could understand? Would you say never, sometimes, usually, or always?",
            variableName: "doctor_communication",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-responsiveness",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Staff Responsiveness",
          config: {
            type: "question",
            question: "How often did you get help as soon as you wanted it when you pressed the call button or requested assistance?",
            variableName: "staff_responsiveness",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-pain-management",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Pain Management",
          config: {
            type: "question",
            question: "If you experienced pain, how often was your pain well controlled? Would you say never, sometimes, usually, or always?",
            variableName: "pain_management",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-cleanliness",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Cleanliness",
          config: {
            type: "question",
            question: "How often were your room and bathroom kept clean? Would you say never, sometimes, usually, or always?",
            variableName: "cleanliness_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-discharge-info",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Discharge Information",
          config: {
            type: "question",
            question: "When you left, did staff give you information about what symptoms or health problems to look out for, and did they explain your medications clearly?",
            variableName: "discharge_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-recommend",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Recommend",
          config: {
            type: "question",
            question: "Would you recommend this healthcare facility to your friends and family? Would you say definitely no, probably no, probably yes, or definitely yes?",
            variableName: "recommend_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-additional-comments",
        type: "question",
        position: { x: 250, y: 1250 },
        data: {
          type: "question",
          label: "Additional Comments",
          config: {
            type: "question",
            question: "Is there anything else you'd like to share about your experience, whether positive or areas where we could improve?",
            variableName: "additional_comments",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-survey",
        type: "webhook",
        position: { x: 250, y: 1370 },
        data: {
          type: "webhook",
          label: "Submit Survey",
          config: {
            type: "webhook",
            url: "https://your-quality-api.com/surveys/hcahps",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { survey_type: "patient_satisfaction_hcahps" },
            description: "Submit patient satisfaction survey results",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you so much for taking the time to share your feedback. Your input is invaluable in helping us provide better care to all our patients. We truly appreciate you choosing us for your healthcare needs. Take care and be well!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-patient" },
      { id: "e2", source: "node-verify-patient", target: "node-overall-rating" },
      { id: "e3", source: "node-overall-rating", target: "node-nurse-communication" },
      { id: "e4", source: "node-nurse-communication", target: "node-doctor-communication" },
      { id: "e5", source: "node-doctor-communication", target: "node-responsiveness" },
      { id: "e6", source: "node-responsiveness", target: "node-pain-management" },
      { id: "e7", source: "node-pain-management", target: "node-cleanliness" },
      { id: "e8", source: "node-cleanliness", target: "node-discharge-info" },
      { id: "e9", source: "node-discharge-info", target: "node-recommend" },
      { id: "e10", source: "node-recommend", target: "node-additional-comments" },
      { id: "e11", source: "node-additional-comments", target: "node-submit-survey" },
      { id: "e12", source: "node-submit-survey", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 1: Property Inquiry
  // ============================================
  {
    id: "template-property-inquiry",
    name: "Property Inquiry",
    description: "Respond to property listing inquiries by collecting buyer information, property preferences, and scheduling follow-up actions.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hi! Thank you for your interest in our property listing. I'd love to help you learn more about this property. Do you have a few minutes to answer some quick questions?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "Great! May I have your full name please?",
            variableName: "buyer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "What's the best email address to send you property details and updates?",
            variableName: "buyer_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-property-interest",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Property Interest",
          config: {
            type: "question",
            question: "Which property are you inquiring about? Please share the address or listing number if you have it.",
            variableName: "property_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-bedrooms",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Bedroom Preference",
          config: {
            type: "question",
            question: "How many bedrooms are you looking for?",
            variableName: "bedroom_count",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-budget",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Budget Range",
          config: {
            type: "question",
            question: "What's your approximate budget range for this purchase?",
            variableName: "budget_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-timeline",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Timeline",
          config: {
            type: "question",
            question: "What's your timeline for making a purchase? Are you looking to buy within the next 30 days, 1-3 months, or longer?",
            variableName: "purchase_timeline",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-viewing",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Schedule Viewing",
          config: {
            type: "question",
            question: "Would you like to schedule a property viewing? We have availability this week.",
            variableName: "viewing_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-viewing",
        type: "condition",
        position: { x: 250, y: 1010 },
        data: {
          type: "condition",
          label: "Wants Viewing?",
          config: {
            type: "condition",
            condition: "The buyer wants to schedule a property viewing",
          },
        },
      },
      {
        id: "node-book-viewing",
        type: "appointment",
        position: { x: 450, y: 1130 },
        data: {
          type: "appointment",
          label: "Book Viewing",
          config: {
            type: "appointment",
            appointmentType: "Property Viewing",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-viewing-webhook",
        type: "webhook",
        position: { x: 450, y: 1250 },
        data: {
          type: "webhook",
          label: "Log Viewing",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "property_inquiry", viewing_scheduled: true },
            description: "Log property inquiry with scheduled viewing",
          },
        },
      },
      {
        id: "node-no-viewing-webhook",
        type: "webhook",
        position: { x: 50, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Lead",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "property_inquiry", viewing_scheduled: false },
            description: "Log property inquiry for follow-up",
          },
        },
      },
      {
        id: "node-viewing-end",
        type: "end",
        position: { x: 450, y: 1370 },
        data: {
          type: "end",
          label: "Viewing Confirmed",
          config: {
            type: "end",
            endMessage: "Perfect, your viewing's all scheduled. You'll get a confirmation email, and our agent will meet you right at the property. Anything else you need?",
          },
        },
      },
      {
        id: "node-no-viewing-end",
        type: "end",
        position: { x: 50, y: 1250 },
        data: {
          type: "end",
          label: "Follow-up End",
          config: {
            type: "end",
            endMessage: "No problem! I've noted your interest and one of our agents will follow up with you shortly with more property options that match your criteria. Thank you for reaching out!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-email" },
      { id: "e3", source: "node-ask-email", target: "node-ask-property-interest" },
      { id: "e4", source: "node-ask-property-interest", target: "node-ask-bedrooms" },
      { id: "e5", source: "node-ask-bedrooms", target: "node-ask-budget" },
      { id: "e6", source: "node-ask-budget", target: "node-ask-timeline" },
      { id: "e7", source: "node-ask-timeline", target: "node-ask-viewing" },
      { id: "e8", source: "node-ask-viewing", target: "node-check-viewing" },
      { id: "e9", source: "node-check-viewing", sourceHandle: "true", target: "node-book-viewing" },
      { id: "e10", source: "node-check-viewing", sourceHandle: "false", target: "node-no-viewing-webhook" },
      { id: "e11", source: "node-book-viewing", target: "node-viewing-webhook" },
      { id: "e12", source: "node-viewing-webhook", target: "node-viewing-end" },
      { id: "e13", source: "node-no-viewing-webhook", target: "node-no-viewing-end" },
    ],
  },

  // ============================================
  // Real Estate Template 2: Property Viewing Scheduler
  // ============================================
  {
    id: "template-viewing-scheduler",
    name: "Property Viewing Scheduler",
    description: "Schedule property showings with flexible time slots, collect viewer preferences, and send confirmation to agents.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! I'm here to help you schedule a property viewing. Let me gather a few details to find the perfect time for your showing.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name please?",
            variableName: "viewer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-phone",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Phone Number",
          config: {
            type: "question",
            question: "What's the best phone number to reach you on the day of the viewing?",
            variableName: "viewer_phone",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-property",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Property Address",
          config: {
            type: "question",
            question: "Which property would you like to view? Please provide the address or listing reference.",
            variableName: "property_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-attendees",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Number of Attendees",
          config: {
            type: "question",
            question: "How many people will be attending the viewing with you?",
            variableName: "attendee_count",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preferred-day",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Preferred Day",
          config: {
            type: "question",
            question: "Do you prefer a weekday or weekend viewing?",
            variableName: "preferred_day_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preferred-time",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Preferred Time",
          config: {
            type: "question",
            question: "What time of day works best for you - morning, afternoon, or evening?",
            variableName: "preferred_time",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-book-viewing",
        type: "appointment",
        position: { x: 250, y: 890 },
        data: {
          type: "appointment",
          label: "Schedule Viewing",
          config: {
            type: "appointment",
            appointmentType: "Property Showing",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-special-requests",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Special Requests",
          config: {
            type: "question",
            question: "Do you have any special requests or specific areas of the property you'd like to focus on during the viewing?",
            variableName: "special_requests",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-notify-agent",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Notify Agent",
          config: {
            type: "webhook",
            url: "https://your-realestate-api.com/viewings",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { event_type: "viewing_scheduled", priority: "normal" },
            description: "Notify listing agent about scheduled viewing",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1250 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Your viewing has been scheduled. You'll receive a confirmation with the exact address, parking instructions, and your agent's contact details.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1370 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for scheduling your property viewing! Our agent looks forward to showing you the property. If you need to reschedule, just give us a call. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-phone" },
      { id: "e3", source: "node-ask-phone", target: "node-ask-property" },
      { id: "e4", source: "node-ask-property", target: "node-ask-attendees" },
      { id: "e5", source: "node-ask-attendees", target: "node-ask-preferred-day" },
      { id: "e6", source: "node-ask-preferred-day", target: "node-ask-preferred-time" },
      { id: "e7", source: "node-ask-preferred-time", target: "node-book-viewing" },
      { id: "e8", source: "node-book-viewing", target: "node-ask-special-requests" },
      { id: "e9", source: "node-ask-special-requests", target: "node-notify-agent" },
      { id: "e10", source: "node-notify-agent", target: "node-confirmation" },
      { id: "e11", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 3: Buyer Pre-Qualification
  // ============================================
  {
    id: "template-buyer-qualification",
    name: "Buyer Pre-Qualification",
    description: "Assess buyer readiness by collecting financial information, purchase criteria, and pre-approval status to qualify leads.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hi! I'm calling to help assess your home buying readiness. This quick conversation will help us match you with the right properties and ensure a smooth buying process. Do you have about 5 minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "Perfect! Let's start with your full name.",
            variableName: "buyer_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-first-time",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "First Time Buyer",
          config: {
            type: "question",
            question: "Is this your first time purchasing a home, or have you bought property before?",
            variableName: "first_time_buyer",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preapproval",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Pre-Approval Status",
          config: {
            type: "question",
            question: "Have you been pre-approved for a mortgage, or are you currently working with a lender?",
            variableName: "preapproval_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-preapproval",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Has Pre-Approval?",
          config: {
            type: "condition",
            condition: "The buyer has mortgage pre-approval or is working with a lender",
          },
        },
      },
      {
        id: "node-ask-approval-amount",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Pre-Approval Amount",
          config: {
            type: "question",
            question: "That's great! What's your pre-approved amount?",
            variableName: "preapproval_amount",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-budget",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Budget Range",
          config: {
            type: "question",
            question: "No problem! What's your target budget range for your home purchase?",
            variableName: "budget_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-down-payment",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Down Payment",
          config: {
            type: "question",
            question: "Approximately how much do you have saved for a down payment?",
            variableName: "down_payment",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-employment",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Employment Status",
          config: {
            type: "question",
            question: "What is your current employment status? Are you employed full-time, self-employed, or other?",
            variableName: "employment_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-timeline",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Purchase Timeline",
          config: {
            type: "question",
            question: "What's your ideal timeline for purchasing a home?",
            variableName: "purchase_timeline",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-property-type",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Property Type",
          config: {
            type: "question",
            question: "What type of property are you looking for - single family home, condo, townhouse, or multi-family?",
            variableName: "property_type_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-location",
        type: "question",
        position: { x: 250, y: 1250 },
        data: {
          type: "question",
          label: "Preferred Location",
          config: {
            type: "question",
            question: "Which neighborhoods or areas are you interested in?",
            variableName: "preferred_location",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-qualify-lead",
        type: "webhook",
        position: { x: 250, y: 1370 },
        data: {
          type: "webhook",
          label: "Submit Qualification",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/buyer-qualification",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "buyer_qualification" },
            description: "Submit buyer qualification data to CRM",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for sharing all that information! Based on your profile, our team will curate a list of properties that match your criteria. One of our agents will reach out within 24 hours to discuss next steps. Happy house hunting!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-first-time" },
      { id: "e3", source: "node-ask-first-time", target: "node-ask-preapproval" },
      { id: "e4", source: "node-ask-preapproval", target: "node-check-preapproval" },
      { id: "e5", source: "node-check-preapproval", sourceHandle: "true", target: "node-ask-approval-amount" },
      { id: "e6", source: "node-check-preapproval", sourceHandle: "false", target: "node-ask-budget" },
      { id: "e7", source: "node-ask-approval-amount", target: "node-ask-down-payment" },
      { id: "e8", source: "node-ask-budget", target: "node-ask-down-payment" },
      { id: "e9", source: "node-ask-down-payment", target: "node-ask-employment" },
      { id: "e10", source: "node-ask-employment", target: "node-ask-timeline" },
      { id: "e11", source: "node-ask-timeline", target: "node-ask-property-type" },
      { id: "e12", source: "node-ask-property-type", target: "node-ask-location" },
      { id: "e13", source: "node-ask-location", target: "node-qualify-lead" },
      { id: "e14", source: "node-qualify-lead", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 4: Mortgage Pre-Approval Outreach
  // ============================================
  {
    id: "template-mortgage-preapproval",
    name: "Mortgage Pre-Approval Outreach",
    description: "Connect potential buyers with mortgage lenders by collecting financial information and scheduling lender consultations.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! I'm reaching out to help you get started with mortgage pre-approval. Getting pre-approved will strengthen your offer when you find your dream home. Do you have a few minutes to discuss your options?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "Great! Let's start with your full name.",
            variableName: "borrower_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "What email address should we use to send you pre-approval documents?",
            variableName: "borrower_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-purchase-price",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Target Purchase Price",
          config: {
            type: "question",
            question: "What's the approximate purchase price of the home you're looking to buy?",
            variableName: "target_purchase_price",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-down-payment",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Down Payment",
          config: {
            type: "question",
            question: "How much are you planning to put down as a down payment?",
            variableName: "down_payment_amount",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-income",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Annual Income",
          config: {
            type: "question",
            question: "What is your approximate annual household income?",
            variableName: "annual_income",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-credit-score",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Credit Score Range",
          config: {
            type: "question",
            question: "Do you know your approximate credit score? It can be a range like excellent, good, fair, or you can say you're not sure.",
            variableName: "credit_score_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-debt",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Monthly Debt",
          config: {
            type: "question",
            question: "What are your approximate monthly debt payments including car loans, student loans, and credit cards?",
            variableName: "monthly_debt",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-loan-type",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Loan Type Interest",
          config: {
            type: "question",
            question: "Are you interested in a conventional loan, FHA, VA, or would you like guidance on which might be best for you?",
            variableName: "loan_type_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-consultation",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Schedule Consultation",
          config: {
            type: "question",
            question: "Would you like to schedule a consultation with one of our preferred mortgage lenders to discuss your options in detail?",
            variableName: "consultation_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-consultation",
        type: "condition",
        position: { x: 250, y: 1250 },
        data: {
          type: "condition",
          label: "Wants Consultation?",
          config: {
            type: "condition",
            condition: "The borrower wants to schedule a lender consultation",
          },
        },
      },
      {
        id: "node-book-consultation",
        type: "appointment",
        position: { x: 450, y: 1370 },
        data: {
          type: "appointment",
          label: "Book Consultation",
          config: {
            type: "appointment",
            appointmentType: "Mortgage Consultation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-consultation-webhook",
        type: "webhook",
        position: { x: 450, y: 1490 },
        data: {
          type: "webhook",
          label: "Notify Lender",
          config: {
            type: "webhook",
            url: "https://your-lender-api.com/consultations",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "mortgage_preapproval", consultation_scheduled: true },
            description: "Notify partner lender about scheduled consultation",
          },
        },
      },
      {
        id: "node-no-consultation-webhook",
        type: "webhook",
        position: { x: 50, y: 1370 },
        data: {
          type: "webhook",
          label: "Log Lead",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/mortgage-leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { lead_type: "mortgage_preapproval", consultation_scheduled: false },
            description: "Log mortgage lead for follow-up",
          },
        },
      },
      {
        id: "node-consultation-end",
        type: "end",
        position: { x: 450, y: 1610 },
        data: {
          type: "end",
          label: "Consultation Scheduled",
          config: {
            type: "end",
            endMessage: "You're booked in! You'll get an email with the lender's info and what docs to bring. This is a big step toward your new home — exciting stuff!",
          },
        },
      },
      {
        id: "node-no-consultation-end",
        type: "end",
        position: { x: 50, y: 1490 },
        data: {
          type: "end",
          label: "Info Sent",
          config: {
            type: "end",
            endMessage: "No problem! I'll send you an email with information about our preferred lenders and the pre-approval process. Feel free to reach out when you're ready to take the next step. Thank you for your time!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-email" },
      { id: "e3", source: "node-ask-email", target: "node-ask-purchase-price" },
      { id: "e4", source: "node-ask-purchase-price", target: "node-ask-down-payment" },
      { id: "e5", source: "node-ask-down-payment", target: "node-ask-income" },
      { id: "e6", source: "node-ask-income", target: "node-ask-credit-score" },
      { id: "e7", source: "node-ask-credit-score", target: "node-ask-debt" },
      { id: "e8", source: "node-ask-debt", target: "node-ask-loan-type" },
      { id: "e9", source: "node-ask-loan-type", target: "node-ask-consultation" },
      { id: "e10", source: "node-ask-consultation", target: "node-check-consultation" },
      { id: "e11", source: "node-check-consultation", sourceHandle: "true", target: "node-book-consultation" },
      { id: "e12", source: "node-check-consultation", sourceHandle: "false", target: "node-no-consultation-webhook" },
      { id: "e13", source: "node-book-consultation", target: "node-consultation-webhook" },
      { id: "e14", source: "node-consultation-webhook", target: "node-consultation-end" },
      { id: "e15", source: "node-no-consultation-webhook", target: "node-no-consultation-end" },
    ],
  },

  // ============================================
  // Real Estate Template 5: Open House Registration
  // ============================================
  {
    id: "template-open-house-registration",
    name: "Open House Registration",
    description: "Register visitors for open house events, collect contact information, and send event details with property information.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! Thank you for your interest in our upcoming open house. I'd love to register you for the event and share all the details.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Name",
          config: {
            type: "question",
            question: "May I have your full name for the registration?",
            variableName: "visitor_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-phone",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Phone Number",
          config: {
            type: "question",
            question: "What's the best phone number to reach you?",
            variableName: "visitor_phone",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-email",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "What email should we send the open house details and property information to?",
            variableName: "visitor_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-property",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Property Interest",
          config: {
            type: "question",
            question: "Which property's open house are you interested in attending?",
            variableName: "property_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-attendees",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Number Attending",
          config: {
            type: "question",
            question: "How many people will be attending with you?",
            variableName: "party_size",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-buying-status",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Buying Status",
          config: {
            type: "question",
            question: "Are you currently working with a real estate agent?",
            variableName: "has_agent",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-preapproval",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Pre-Approval Status",
          config: {
            type: "question",
            question: "Have you been pre-approved for a mortgage?",
            variableName: "preapproval_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Questions",
          config: {
            type: "question",
            question: "Do you have any specific questions about the property that you'd like answered at the open house?",
            variableName: "visitor_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-register-webhook",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Register Visitor",
          config: {
            type: "webhook",
            url: "https://your-realestate-api.com/open-house-registrations",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { event_type: "open_house_registration" },
            description: "Register visitor for open house event",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1250 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "You're all set! I've registered you for the open house. You'll receive an email with the property address, event time, parking information, and a detailed property brochure.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1370 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for registering! We look forward to seeing you at the open house. If you have any questions before then, feel free to call us back. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-name" },
      { id: "e2", source: "node-ask-name", target: "node-ask-phone" },
      { id: "e3", source: "node-ask-phone", target: "node-ask-email" },
      { id: "e4", source: "node-ask-email", target: "node-ask-property" },
      { id: "e5", source: "node-ask-property", target: "node-ask-attendees" },
      { id: "e6", source: "node-ask-attendees", target: "node-ask-buying-status" },
      { id: "e7", source: "node-ask-buying-status", target: "node-ask-preapproval" },
      { id: "e8", source: "node-ask-preapproval", target: "node-ask-questions" },
      { id: "e9", source: "node-ask-questions", target: "node-register-webhook" },
      { id: "e10", source: "node-register-webhook", target: "node-confirmation" },
      { id: "e11", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 6: Seller Listing Follow-up
  // ============================================
  {
    id: "template-seller-listing-followup",
    name: "Seller Listing Follow-up",
    description: "Check in with property sellers to provide listing updates, gather feedback on showings, and discuss pricing strategies.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! This is a follow-up call regarding your property listing. I wanted to provide you with an update and gather your feedback. Is now a good time to chat?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-confirm-property",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Confirm Property",
          config: {
            type: "question",
            question: "I'm calling about your property listing. Can you confirm the property address for me?",
            variableName: "property_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-update-activity",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Activity Update",
          config: {
            type: "message",
            message: "Great! I wanted to update you on the recent activity. We've had several inquiries and showings this week. Let me ask you a few questions about your experience so far.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-showing-feedback",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Showing Feedback",
          config: {
            type: "question",
            question: "Have you received any feedback from recent showings that you'd like to share?",
            variableName: "showing_feedback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-satisfaction",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Satisfaction Level",
          config: {
            type: "question",
            question: "On a scale of 1 to 5, how satisfied are you with the listing activity and marketing efforts so far?",
            variableName: "satisfaction_rating",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-pricing",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Pricing Discussion",
          config: {
            type: "question",
            question: "Based on the current market conditions and feedback, would you be open to discussing pricing adjustments?",
            variableName: "pricing_discussion",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-pricing",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Open to Price Change?",
          config: {
            type: "condition",
            condition: "The seller is open to discussing pricing adjustments",
          },
        },
      },
      {
        id: "node-ask-price-expectation",
        type: "question",
        position: { x: 450, y: 890 },
        data: {
          type: "question",
          label: "Price Expectation",
          config: {
            type: "question",
            question: "What price range would you be comfortable considering? Our agent will prepare a comparative market analysis for you.",
            variableName: "price_expectation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-timeline-update",
        type: "question",
        position: { x: 50, y: 890 },
        data: {
          type: "question",
          label: "Timeline Update",
          config: {
            type: "question",
            question: "Has your timeline for selling changed at all since we last spoke?",
            variableName: "timeline_update",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-concerns",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Any Concerns",
          config: {
            type: "question",
            question: "Do you have any concerns or questions about the selling process that I can address?",
            variableName: "seller_concerns",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-schedule-callback",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Schedule Agent Call",
          config: {
            type: "question",
            question: "Would you like to schedule a call with your listing agent to discuss these points in more detail?",
            variableName: "wants_agent_callback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-followup",
        type: "webhook",
        position: { x: 250, y: 1250 },
        data: {
          type: "webhook",
          label: "Log Follow-up",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/seller-followups",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { followup_type: "seller_listing" },
            description: "Log seller follow-up in CRM",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1370 },
        data: {
          type: "end",
          label: "Thank You",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to chat today. Your feedback is invaluable, and we're committed to getting your property sold. You'll receive a summary of our conversation via email, and your agent will follow up with you soon. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-confirm-property" },
      { id: "e2", source: "node-ask-confirm-property", target: "node-update-activity" },
      { id: "e3", source: "node-update-activity", target: "node-ask-showing-feedback" },
      { id: "e4", source: "node-ask-showing-feedback", target: "node-ask-satisfaction" },
      { id: "e5", source: "node-ask-satisfaction", target: "node-ask-pricing" },
      { id: "e6", source: "node-ask-pricing", target: "node-check-pricing" },
      { id: "e7", source: "node-check-pricing", sourceHandle: "true", target: "node-ask-price-expectation" },
      { id: "e8", source: "node-check-pricing", sourceHandle: "false", target: "node-ask-timeline-update" },
      { id: "e9", source: "node-ask-price-expectation", target: "node-ask-concerns" },
      { id: "e10", source: "node-ask-timeline-update", target: "node-ask-concerns" },
      { id: "e11", source: "node-ask-concerns", target: "node-schedule-callback" },
      { id: "e12", source: "node-schedule-callback", target: "node-submit-followup" },
      { id: "e13", source: "node-submit-followup", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 7: Offer Status Update
  // ============================================
  {
    id: "template-offer-update",
    name: "Offer Status Update",
    description: "Update buyers on the status of their offer, collect their response to counteroffers, and guide next steps in the negotiation process.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! I'm calling with an update regarding the offer you submitted on the property. Do you have a moment to discuss?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-property",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Confirm Property",
          config: {
            type: "question",
            question: "I want to make sure we're discussing the right property. Can you confirm the address of the property you made an offer on?",
            variableName: "property_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-offer-status-type",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Status Type",
          config: {
            type: "question",
            question: "I have an update on your offer. The seller has responded. Would you like me to share the details now?",
            variableName: "ready_for_update",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-counteroffer",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Is Counteroffer?",
          config: {
            type: "condition",
            condition: "The seller has made a counteroffer (not accepted or rejected outright)",
          },
        },
      },
      {
        id: "node-explain-counteroffer",
        type: "message",
        position: { x: 450, y: 530 },
        data: {
          type: "message",
          label: "Counteroffer Details",
          config: {
            type: "message",
            message: "The seller has responded with a counteroffer. Let me walk you through the key differences from your original offer.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-counter-response",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Counter Response",
          config: {
            type: "question",
            question: "After hearing these terms, what are your initial thoughts? Would you like to accept the counteroffer, submit a revised offer, or decline?",
            variableName: "counter_response",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-accept",
        type: "condition",
        position: { x: 450, y: 770 },
        data: {
          type: "condition",
          label: "Accepts Counter?",
          config: {
            type: "condition",
            condition: "The buyer wants to accept the counteroffer",
          },
        },
      },
      {
        id: "node-accept-process",
        type: "message",
        position: { x: 650, y: 890 },
        data: {
          type: "message",
          label: "Acceptance Next Steps",
          config: {
            type: "message",
            message: "Congratulations on accepting the counteroffer! I'll send you the acceptance documents to sign. Once signed, we'll move forward with the home inspection and other contingencies.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-revise-offer",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Revised Terms",
          config: {
            type: "question",
            question: "What terms would you like to propose in your revised offer?",
            variableName: "revised_terms",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-offer-accepted",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Offer Accepted",
          config: {
            type: "message",
            message: "Great news! The seller has accepted your offer! Congratulations, you're one step closer to owning your new home. Let me explain the next steps.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-next-steps",
        type: "message",
        position: { x: 50, y: 650 },
        data: {
          type: "message",
          label: "Next Steps",
          config: {
            type: "message",
            message: "The next steps include scheduling a home inspection, finalizing your mortgage, and beginning the title and escrow process. Your agent will coordinate everything.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-update",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Update",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/offer-updates",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { update_type: "offer_status" },
            description: "Log offer status update and buyer response",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. You'll receive a summary of this conversation via email. Your agent will be in touch shortly to discuss next steps. If you have any questions in the meantime, don't hesitate to call us. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-confirm-property" },
      { id: "e2", source: "node-confirm-property", target: "node-ask-offer-status-type" },
      { id: "e3", source: "node-ask-offer-status-type", target: "node-check-counteroffer" },
      { id: "e4", source: "node-check-counteroffer", sourceHandle: "true", target: "node-explain-counteroffer" },
      { id: "e5", source: "node-check-counteroffer", sourceHandle: "false", target: "node-offer-accepted" },
      { id: "e6", source: "node-explain-counteroffer", target: "node-ask-counter-response" },
      { id: "e7", source: "node-ask-counter-response", target: "node-check-accept" },
      { id: "e8", source: "node-check-accept", sourceHandle: "true", target: "node-accept-process" },
      { id: "e9", source: "node-check-accept", sourceHandle: "false", target: "node-revise-offer" },
      { id: "e10", source: "node-accept-process", target: "node-submit-update" },
      { id: "e11", source: "node-revise-offer", target: "node-submit-update" },
      { id: "e12", source: "node-offer-accepted", target: "node-next-steps" },
      { id: "e13", source: "node-next-steps", target: "node-submit-update" },
      { id: "e14", source: "node-submit-update", target: "node-end" },
    ],
  },

  // ============================================
  // Real Estate Template 8: Closing Process Coordinator
  // ============================================
  {
    id: "template-closing-coordinator",
    name: "Closing Process Coordinator",
    description: "Guide buyers through the closing process with step-by-step instructions, document collection reminders, and scheduling of closing appointments.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! Congratulations on reaching the closing stage of your home purchase! I'm calling to help guide you through the final steps. Do you have a few minutes to go over the closing process?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-property",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Confirm Property",
          config: {
            type: "question",
            question: "Let me confirm we have the right file. What's the address of the property you're purchasing?",
            variableName: "property_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-timeline",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Timeline Overview",
          config: {
            type: "message",
            message: "Your closing is coming up. Let me walk you through what needs to happen before then and what to expect on closing day.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-inspection-complete",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Inspection Status",
          config: {
            type: "question",
            question: "Has the home inspection been completed and any negotiated repairs addressed?",
            variableName: "inspection_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-appraisal-complete",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Appraisal Status",
          config: {
            type: "question",
            question: "Has the appraisal been completed by your lender?",
            variableName: "appraisal_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-loan-approval",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Final Loan Approval",
          config: {
            type: "question",
            question: "Have you received final loan approval, also known as 'clear to close', from your lender?",
            variableName: "loan_approval_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-insurance",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Homeowners Insurance",
          config: {
            type: "question",
            question: "Have you secured homeowners insurance for the property and provided proof to your lender?",
            variableName: "insurance_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-funds-ready",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Closing Funds",
          config: {
            type: "question",
            question: "Have you received the final closing disclosure showing the exact amount needed at closing, and are your funds ready for wire transfer?",
            variableName: "funds_ready",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-walkthrough",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Final Walkthrough",
          config: {
            type: "message",
            message: "Before closing, you'll do a final walkthrough of the property to ensure it's in the agreed condition and any repairs have been completed. This is typically done 24 to 48 hours before closing.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-schedule-walkthrough",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Schedule Walkthrough",
          config: {
            type: "question",
            question: "Would you like me to help schedule your final walkthrough?",
            variableName: "schedule_walkthrough",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-walkthrough",
        type: "condition",
        position: { x: 250, y: 1250 },
        data: {
          type: "condition",
          label: "Schedule Walkthrough?",
          config: {
            type: "condition",
            condition: "The buyer wants to schedule the final walkthrough",
          },
        },
      },
      {
        id: "node-book-walkthrough",
        type: "appointment",
        position: { x: 450, y: 1370 },
        data: {
          type: "appointment",
          label: "Book Walkthrough",
          config: {
            type: "appointment",
            appointmentType: "Final Walkthrough",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-closing-day",
        type: "message",
        position: { x: 250, y: 1490 },
        data: {
          type: "message",
          label: "Closing Day Info",
          config: {
            type: "message",
            message: "On closing day, you'll review and sign all documents, wire your closing funds, and receive the keys to your new home. Bring a valid government-issued ID and any required documents.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-closing-questions",
        type: "question",
        position: { x: 250, y: 1610 },
        data: {
          type: "question",
          label: "Any Questions",
          config: {
            type: "question",
            question: "Do you have any questions about the closing process or anything you'd like me to clarify?",
            variableName: "closing_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-status",
        type: "webhook",
        position: { x: 250, y: 1730 },
        data: {
          type: "webhook",
          label: "Log Status",
          config: {
            type: "webhook",
            url: "https://your-crm-api.com/closing-status",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { update_type: "closing_coordinator" },
            description: "Log closing process status and checklist items",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1850 },
        data: {
          type: "end",
          label: "Congratulations",
          config: {
            type: "end",
            endMessage: "You're almost there! You'll receive an email summary of this conversation with a closing checklist. Your agent and closing coordinator will ensure everything goes smoothly. Congratulations again on your new home, and we'll see you at the closing table!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-confirm-property" },
      { id: "e2", source: "node-confirm-property", target: "node-explain-timeline" },
      { id: "e3", source: "node-explain-timeline", target: "node-ask-inspection-complete" },
      { id: "e4", source: "node-ask-inspection-complete", target: "node-ask-appraisal-complete" },
      { id: "e5", source: "node-ask-appraisal-complete", target: "node-ask-loan-approval" },
      { id: "e6", source: "node-ask-loan-approval", target: "node-ask-insurance" },
      { id: "e7", source: "node-ask-insurance", target: "node-ask-funds-ready" },
      { id: "e8", source: "node-ask-funds-ready", target: "node-explain-walkthrough" },
      { id: "e9", source: "node-explain-walkthrough", target: "node-schedule-walkthrough" },
      { id: "e10", source: "node-schedule-walkthrough", target: "node-check-walkthrough" },
      { id: "e11", source: "node-check-walkthrough", sourceHandle: "true", target: "node-book-walkthrough" },
      { id: "e12", source: "node-check-walkthrough", sourceHandle: "false", target: "node-explain-closing-day" },
      { id: "e13", source: "node-book-walkthrough", target: "node-explain-closing-day" },
      { id: "e14", source: "node-explain-closing-day", target: "node-ask-closing-questions" },
      { id: "e15", source: "node-ask-closing-questions", target: "node-submit-status" },
      { id: "e16", source: "node-submit-status", target: "node-end" },
    ],
  },

  // ============================================
  // Financial Services: Loan Application Follow-up
  // ============================================
  {
    id: "template-loan-application-followup",
    name: "Loan Application Follow-up",
    description: "Follow up with loan applicants to check on application status, gather missing documents, and provide updates on approval timeline.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! This is a courtesy call from the loan processing department regarding your recent loan application. I'm calling to provide an update on your application status. Is this a good time to speak?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For security purposes, may I please verify the last four digits of your Social Security number?",
            variableName: "ssn_last_four",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-confirm-application",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Confirm Application",
          config: {
            type: "question",
            question: "I see you submitted an application for a loan. Can you confirm the approximate loan amount you applied for?",
            variableName: "loan_amount_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-provide-status",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Application Status",
          config: {
            type: "message",
            message: "Thank you for confirming. Your application is currently under review by our underwriting team. We're working diligently to process it as quickly as possible.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-check-documents",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Missing Documents",
          config: {
            type: "question",
            question: "We may need some additional documentation to complete your application. Do you have your most recent pay stubs and bank statements available?",
            variableName: "documents_available",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-docs-ready",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Documents Ready?",
          config: {
            type: "condition",
            condition: "The customer confirms they have the required documents available",
          },
        },
      },
      {
        id: "node-docs-instructions",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Upload Instructions",
          config: {
            type: "message",
            message: "You can securely upload these documents through our online portal, or email them directly to our processing team. You'll receive an email with detailed instructions shortly.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-docs-reminder",
        type: "message",
        position: { x: 50, y: 770 },
        data: {
          type: "message",
          label: "Gather Documents",
          config: {
            type: "message",
            message: "No problem. Please gather these documents at your earliest convenience. The sooner we receive them, the faster we can complete your application review.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Any Questions",
          config: {
            type: "question",
            question: "Do you have any questions about your loan application or the process?",
            variableName: "customer_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-followup",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Follow-up",
          config: {
            type: "webhook",
            url: "https://your-loan-api.com/applications/followup",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "loan_followup", status: "contacted" },
            description: "Log loan application follow-up call details",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. We'll continue processing your application and keep you updated on any progress. If you have any questions, please don't hesitate to call us. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-confirm-application" },
      { id: "e3", source: "node-confirm-application", target: "node-provide-status" },
      { id: "e4", source: "node-provide-status", target: "node-check-documents" },
      { id: "e5", source: "node-check-documents", target: "node-check-docs-ready" },
      { id: "e6", source: "node-check-docs-ready", sourceHandle: "true", target: "node-docs-instructions" },
      { id: "e7", source: "node-check-docs-ready", sourceHandle: "false", target: "node-docs-reminder" },
      { id: "e8", source: "node-docs-instructions", target: "node-ask-questions" },
      { id: "e9", source: "node-docs-reminder", target: "node-ask-questions" },
      { id: "e10", source: "node-ask-questions", target: "node-submit-followup" },
      { id: "e11", source: "node-submit-followup", target: "node-end" },
    ],
  },

  // ============================================
  // Financial Services: Fraud Alert Verification
  // ============================================
  {
    id: "template-fraud-alert",
    name: "Fraud Alert Verification",
    description: "Verify suspicious account activity with customers, confirm or deny transactions, and take immediate action to protect accounts.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Urgent Alert",
          config: {
            type: "message",
            message: "Hello, this is an important call from your bank's fraud prevention department. We've detected some unusual activity on your account and need to verify a few transactions with you. This is for your account security.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For your protection, I need to verify your identity. Can you please confirm your date of birth?",
            variableName: "date_of_birth",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-address",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Verify Address",
          config: {
            type: "question",
            question: "Thank you. Can you also confirm the billing address on your account?",
            variableName: "billing_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-describe-transaction",
        type: "message",
        position: { x: 250, y: 410 },
        data: {
          type: "message",
          label: "Describe Transaction",
          config: {
            type: "message",
            message: "We detected a transaction that appears unusual based on your account history. This transaction was flagged by our security system for verification.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-recognize",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Recognize Transaction",
          config: {
            type: "question",
            question: "Do you recognize this transaction, or did you authorize this purchase?",
            variableName: "transaction_recognized",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-fraud",
        type: "condition",
        position: { x: 250, y: 650 },
        data: {
          type: "condition",
          label: "Is Fraud?",
          config: {
            type: "condition",
            condition: "The customer does NOT recognize the transaction or did NOT authorize it",
          },
        },
      },
      {
        id: "node-block-card",
        type: "message",
        position: { x: 50, y: 770 },
        data: {
          type: "message",
          label: "Block Card",
          config: {
            type: "message",
            message: "I understand. For your protection, I'm immediately blocking this card to prevent any further unauthorized transactions. We will issue you a new card which will arrive within 5-7 business days.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-fraud-webhook",
        type: "webhook",
        position: { x: 50, y: 890 },
        data: {
          type: "webhook",
          label: "Report Fraud",
          config: {
            type: "webhook",
            url: "https://your-banking-api.com/fraud/report",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "fraud_confirmed", action: "block_card" },
            description: "Report confirmed fraud and trigger card blocking",
          },
        },
      },
      {
        id: "node-confirm-legitimate",
        type: "message",
        position: { x: 450, y: 770 },
        data: {
          type: "message",
          label: "Confirm Legitimate",
          config: {
            type: "message",
            message: "Thank you for confirming. I'll mark this transaction as verified in our system. Your account will continue to be monitored for your protection.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-legitimate-webhook",
        type: "webhook",
        position: { x: 450, y: 890 },
        data: {
          type: "webhook",
          label: "Clear Alert",
          config: {
            type: "webhook",
            url: "https://your-banking-api.com/fraud/clear",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "transaction_verified", status: "cleared" },
            description: "Clear fraud alert for verified transaction",
          },
        },
      },
      {
        id: "node-fraud-end",
        type: "end",
        position: { x: 50, y: 1010 },
        data: {
          type: "end",
          label: "Fraud Goodbye",
          config: {
            type: "end",
            endMessage: "Your card has been blocked and a fraud investigation has been initiated. You'll receive a new card shortly. If you notice any other suspicious activity, please contact us immediately. Thank you for your cooperation, and we apologize for any inconvenience.",
          },
        },
      },
      {
        id: "node-clear-end",
        type: "end",
        position: { x: 450, y: 1010 },
        data: {
          type: "end",
          label: "Clear Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to verify this transaction. Your account security is our top priority. If you have any concerns in the future, please don't hesitate to contact us. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-verify-address" },
      { id: "e3", source: "node-verify-address", target: "node-describe-transaction" },
      { id: "e4", source: "node-describe-transaction", target: "node-ask-recognize" },
      { id: "e5", source: "node-ask-recognize", target: "node-check-fraud" },
      { id: "e6", source: "node-check-fraud", sourceHandle: "true", target: "node-block-card" },
      { id: "e7", source: "node-check-fraud", sourceHandle: "false", target: "node-confirm-legitimate" },
      { id: "e8", source: "node-block-card", target: "node-fraud-webhook" },
      { id: "e9", source: "node-fraud-webhook", target: "node-fraud-end" },
      { id: "e10", source: "node-confirm-legitimate", target: "node-legitimate-webhook" },
      { id: "e11", source: "node-legitimate-webhook", target: "node-clear-end" },
    ],
  },

  // ============================================
  // Financial Services: KYC Identity Verification
  // ============================================
  {
    id: "template-kyc-verification",
    name: "KYC Identity Verification",
    description: "Complete Know Your Customer verification by collecting identity information, verifying documents, and ensuring regulatory compliance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! I'm calling to complete the identity verification process for your new account. This is a regulatory requirement to ensure the security of your account. The process will only take a few minutes.",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-full-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Full Legal Name",
          config: {
            type: "question",
            question: "May I please have your full legal name as it appears on your government-issued ID?",
            variableName: "legal_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-dob",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Date of Birth",
          config: {
            type: "question",
            question: "What is your date of birth?",
            variableName: "date_of_birth",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-ssn",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "SSN/Tax ID",
          config: {
            type: "question",
            question: "For verification purposes, may I have your Social Security Number or Tax Identification Number?",
            variableName: "tax_id",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-address",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Current Address",
          config: {
            type: "question",
            question: "What is your current residential address, including city, state, and zip code?",
            variableName: "residential_address",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-id-type",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "ID Type",
          config: {
            type: "question",
            question: "What type of government-issued ID will you be using for verification? We accept driver's license, passport, or state ID.",
            variableName: "id_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-id-number",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "ID Number",
          config: {
            type: "question",
            question: "What is the ID number on your document?",
            variableName: "id_number",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-employment",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Employment Status",
          config: {
            type: "question",
            question: "What is your current employment status? Are you employed, self-employed, retired, or a student?",
            variableName: "employment_status",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-income",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Annual Income",
          config: {
            type: "question",
            question: "What is your approximate annual income range?",
            variableName: "income_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-kyc",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Submit KYC",
          config: {
            type: "webhook",
            url: "https://your-compliance-api.com/kyc/verify",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { verification_type: "phone_kyc", status: "pending_review" },
            description: "Submit KYC information for compliance verification",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1250 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Thank you for providing this information. Your identity verification is now being processed. You'll receive a confirmation email within 24-48 hours once the verification is complete.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1370 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for completing the verification process. We take your privacy seriously, and all information provided is securely stored in compliance with regulations. If you have any questions, please contact our customer service team. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-ask-full-name" },
      { id: "e2", source: "node-ask-full-name", target: "node-ask-dob" },
      { id: "e3", source: "node-ask-dob", target: "node-ask-ssn" },
      { id: "e4", source: "node-ask-ssn", target: "node-ask-address" },
      { id: "e5", source: "node-ask-address", target: "node-ask-id-type" },
      { id: "e6", source: "node-ask-id-type", target: "node-ask-id-number" },
      { id: "e7", source: "node-ask-id-number", target: "node-ask-employment" },
      { id: "e8", source: "node-ask-employment", target: "node-ask-income" },
      { id: "e9", source: "node-ask-income", target: "node-submit-kyc" },
      { id: "e10", source: "node-submit-kyc", target: "node-confirmation" },
      { id: "e11", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Financial Services: Investment Portfolio Review
  // ============================================
  {
    id: "template-investment-review",
    name: "Investment Portfolio Review",
    description: "Schedule investment portfolio review sessions with clients, discuss performance, and update investment preferences and risk tolerance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! This is your financial advisor's office calling. It's time for your quarterly investment portfolio review. Is this a convenient time to discuss your investments?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-client",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Client",
          config: {
            type: "question",
            question: "For security purposes, may I please verify your account by confirming the last four digits of your Social Security number?",
            variableName: "ssn_last_four",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-portfolio-summary",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Portfolio Summary",
          config: {
            type: "message",
            message: "Thank you. Let me provide a brief overview of your portfolio performance this quarter. Your investments have been tracking according to your investment strategy, and I'd like to discuss some opportunities for optimization.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-satisfaction",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Satisfaction Level",
          config: {
            type: "question",
            question: "How satisfied are you with your current investment performance? Are there any concerns you'd like to address?",
            variableName: "satisfaction_level",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-risk-tolerance",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Risk Tolerance",
          config: {
            type: "question",
            question: "Has your risk tolerance changed recently? Would you prefer a more conservative, balanced, or aggressive investment approach going forward?",
            variableName: "risk_tolerance",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-goals",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Investment Goals",
          config: {
            type: "question",
            question: "Have any of your financial goals changed? For example, are you planning for retirement, saving for a major purchase, or have any new objectives?",
            variableName: "investment_goals",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-review-meeting",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Schedule Review",
          config: {
            type: "question",
            question: "Would you like to schedule a detailed in-person or video consultation with your financial advisor to discuss your portfolio in depth?",
            variableName: "wants_meeting",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-meeting",
        type: "condition",
        position: { x: 250, y: 890 },
        data: {
          type: "condition",
          label: "Schedule Meeting?",
          config: {
            type: "condition",
            condition: "The client wants to schedule a meeting with their advisor",
          },
        },
      },
      {
        id: "node-book-appointment",
        type: "appointment",
        position: { x: 450, y: 1010 },
        data: {
          type: "appointment",
          label: "Book Review",
          config: {
            type: "appointment",
            appointmentType: "Portfolio Review Consultation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-review",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Review",
          config: {
            type: "webhook",
            url: "https://your-wealth-api.com/portfolio/review",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "quarterly_review", status: "completed" },
            description: "Log portfolio review call and client preferences",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for taking the time to review your portfolio with us. We'll send you a summary of our discussion and any recommended adjustments. Your financial success is our priority. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-client" },
      { id: "e2", source: "node-verify-client", target: "node-portfolio-summary" },
      { id: "e3", source: "node-portfolio-summary", target: "node-ask-satisfaction" },
      { id: "e4", source: "node-ask-satisfaction", target: "node-ask-risk-tolerance" },
      { id: "e5", source: "node-ask-risk-tolerance", target: "node-ask-goals" },
      { id: "e6", source: "node-ask-goals", target: "node-ask-review-meeting" },
      { id: "e7", source: "node-ask-review-meeting", target: "node-check-meeting" },
      { id: "e8", source: "node-check-meeting", sourceHandle: "true", target: "node-book-appointment" },
      { id: "e9", source: "node-check-meeting", sourceHandle: "false", target: "node-submit-review" },
      { id: "e10", source: "node-book-appointment", target: "node-submit-review" },
      { id: "e11", source: "node-submit-review", target: "node-end" },
    ],
  },

  // ============================================
  // Financial Services: Credit Limit Increase Offer
  // ============================================
  {
    id: "template-credit-limit-increase",
    name: "Credit Limit Increase Offer",
    description: "Proactively offer credit limit increases to qualified customers, explain benefits, and process acceptance or collect feedback on decline.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Good News",
          config: {
            type: "message",
            message: "Hello! I'm calling with some good news from your credit card company. Based on your excellent payment history and account standing, you've been pre-approved for a credit limit increase. Is this a good time to discuss this offer?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-identity",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Identity",
          config: {
            type: "question",
            question: "For your security, may I please verify the last four digits of your card number?",
            variableName: "card_last_four",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-offer",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Explain Offer",
          config: {
            type: "message",
            message: "You've been pre-approved for a credit limit increase. This higher limit can improve your credit utilization ratio, potentially boost your credit score, and give you more purchasing flexibility when you need it.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-interest",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Interest Level",
          config: {
            type: "question",
            question: "Would you be interested in accepting this credit limit increase? There's no hard credit inquiry required for this pre-approved offer.",
            variableName: "interested",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-accept",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Accept Offer?",
          config: {
            type: "condition",
            condition: "The customer expresses interest in accepting the credit limit increase",
          },
        },
      },
      {
        id: "node-confirm-increase",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Process Increase",
          config: {
            type: "message",
            message: "Got it, I'm processing your limit increase right now. It'll show up on your account within twenty-four to forty-eight hours, and you'll get a confirmation email too.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-accept-webhook",
        type: "webhook",
        position: { x: 450, y: 770 },
        data: {
          type: "webhook",
          label: "Process Increase",
          config: {
            type: "webhook",
            url: "https://your-card-api.com/credit-limit/increase",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "accept_increase", status: "approved" },
            description: "Process credit limit increase acceptance",
          },
        },
      },
      {
        id: "node-ask-decline-reason",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Decline Reason",
          config: {
            type: "question",
            question: "I understand. May I ask what concerns you have about increasing your credit limit? Your feedback helps us serve you better.",
            variableName: "decline_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-decline-webhook",
        type: "webhook",
        position: { x: 50, y: 770 },
        data: {
          type: "webhook",
          label: "Log Decline",
          config: {
            type: "webhook",
            url: "https://your-card-api.com/credit-limit/decline",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "decline_increase" },
            description: "Log declined credit limit increase offer",
          },
        },
      },
      {
        id: "node-accept-end",
        type: "end",
        position: { x: 450, y: 890 },
        data: {
          type: "end",
          label: "Accept Goodbye",
          config: {
            type: "end",
            endMessage: "Congratulations on your credit limit increase! Remember, responsible use of your credit helps build a strong financial future. Thank you for being a valued customer. Have a great day!",
          },
        },
      },
      {
        id: "node-decline-end",
        type: "end",
        position: { x: 50, y: 890 },
        data: {
          type: "end",
          label: "Decline Goodbye",
          config: {
            type: "end",
            endMessage: "No problem at all. This offer will remain available should you change your mind in the future. Thank you for your time, and please don't hesitate to contact us if you have any questions. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-identity" },
      { id: "e2", source: "node-verify-identity", target: "node-explain-offer" },
      { id: "e3", source: "node-explain-offer", target: "node-ask-interest" },
      { id: "e4", source: "node-ask-interest", target: "node-check-accept" },
      { id: "e5", source: "node-check-accept", sourceHandle: "true", target: "node-confirm-increase" },
      { id: "e6", source: "node-check-accept", sourceHandle: "false", target: "node-ask-decline-reason" },
      { id: "e7", source: "node-confirm-increase", target: "node-accept-webhook" },
      { id: "e8", source: "node-accept-webhook", target: "node-accept-end" },
      { id: "e9", source: "node-ask-decline-reason", target: "node-decline-webhook" },
      { id: "e10", source: "node-decline-webhook", target: "node-decline-end" },
    ],
  },

  // ============================================
  // Financial Services: Insurance Policy Renewal
  // ============================================
  {
    id: "template-policy-renewal",
    name: "Insurance Policy Renewal",
    description: "Contact customers about upcoming policy renewals, review coverage options, process renewals, and update policy preferences.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I'm calling from your insurance company regarding your policy that is coming up for renewal. I'd like to review your coverage and help ensure you have the protection you need. Is now a good time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-policyholder",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Policyholder",
          config: {
            type: "question",
            question: "For security purposes, may I please verify your policy number or the last four digits of your Social Security number?",
            variableName: "verification_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-policy-summary",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Policy Summary",
          config: {
            type: "message",
            message: "Thank you. I can see your current policy details. Your renewal date is approaching, and I'd like to review your coverage options with you to ensure you're adequately protected.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-changes",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Life Changes",
          config: {
            type: "question",
            question: "Have there been any significant changes in your life since your last renewal? For example, a new home, new vehicle, marriage, or other changes that might affect your coverage needs?",
            variableName: "life_changes",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-coverage-satisfaction",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Coverage Satisfaction",
          config: {
            type: "question",
            question: "Are you satisfied with your current coverage levels, or would you like to explore options for increased protection or potential savings?",
            variableName: "coverage_satisfaction",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-renewal",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Confirm Renewal",
          config: {
            type: "question",
            question: "Would you like to proceed with renewing your policy today? I can process the renewal right now and send you updated policy documents.",
            variableName: "proceed_renewal",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-renewal",
        type: "condition",
        position: { x: 250, y: 770 },
        data: {
          type: "condition",
          label: "Renew Now?",
          config: {
            type: "condition",
            condition: "The customer wants to proceed with policy renewal",
          },
        },
      },
      {
        id: "node-process-renewal",
        type: "message",
        position: { x: 450, y: 890 },
        data: {
          type: "message",
          label: "Process Renewal",
          config: {
            type: "message",
            message: "Got it, I'm processing your renewal right now. Your coverage stays active, and you'll get the updated documents by email within twenty-four hours.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-renewal-webhook",
        type: "webhook",
        position: { x: 450, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Renewal",
          config: {
            type: "webhook",
            url: "https://your-insurance-api.com/policies/renew",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "renew_policy", status: "processed" },
            description: "Process insurance policy renewal",
          },
        },
      },
      {
        id: "node-schedule-callback",
        type: "question",
        position: { x: 50, y: 890 },
        data: {
          type: "question",
          label: "Schedule Callback",
          config: {
            type: "question",
            question: "I understand you may need more time to decide. Would you like me to schedule a callback before your renewal date to discuss your options further?",
            variableName: "schedule_callback",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-pending-webhook",
        type: "webhook",
        position: { x: 50, y: 1010 },
        data: {
          type: "webhook",
          label: "Log Pending",
          config: {
            type: "webhook",
            url: "https://your-insurance-api.com/policies/pending",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "renewal_pending", followup_required: true },
            description: "Log pending renewal for follow-up",
          },
        },
      },
      {
        id: "node-renewed-end",
        type: "end",
        position: { x: 450, y: 1130 },
        data: {
          type: "end",
          label: "Renewed Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for renewing your policy with us! Your continued trust means a lot. If you have any questions about your coverage, please don't hesitate to contact us. Have a wonderful day and stay safe!",
          },
        },
      },
      {
        id: "node-pending-end",
        type: "end",
        position: { x: 50, y: 1130 },
        data: {
          type: "end",
          label: "Pending Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. Remember, your current policy remains active until the renewal date. We'll be in touch before then to ensure your coverage continues without interruption. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-policyholder" },
      { id: "e2", source: "node-verify-policyholder", target: "node-policy-summary" },
      { id: "e3", source: "node-policy-summary", target: "node-ask-changes" },
      { id: "e4", source: "node-ask-changes", target: "node-ask-coverage-satisfaction" },
      { id: "e5", source: "node-ask-coverage-satisfaction", target: "node-ask-renewal" },
      { id: "e6", source: "node-ask-renewal", target: "node-check-renewal" },
      { id: "e7", source: "node-check-renewal", sourceHandle: "true", target: "node-process-renewal" },
      { id: "e8", source: "node-check-renewal", sourceHandle: "false", target: "node-schedule-callback" },
      { id: "e9", source: "node-process-renewal", target: "node-renewal-webhook" },
      { id: "e10", source: "node-renewal-webhook", target: "node-renewed-end" },
      { id: "e11", source: "node-schedule-callback", target: "node-pending-webhook" },
      { id: "e12", source: "node-pending-webhook", target: "node-pending-end" },
    ],
  },

  // ============================================
  // Financial Services: Insurance Claims Status Update
  // ============================================
  {
    id: "template-claims-status",
    name: "Insurance Claims Status Update",
    description: "Proactively update customers on their insurance claim progress, collect additional information if needed, and set expectations for next steps.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Greeting",
          config: {
            type: "message",
            message: "Hello! I'm calling from the claims department with an update on your insurance claim. I want to keep you informed about the progress and next steps. Is this a good time to talk?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-claimant",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Claimant",
          config: {
            type: "question",
            question: "For security purposes, may I please verify your claim number or the last four digits of your policy number?",
            variableName: "claim_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-claim-status",
        type: "message",
        position: { x: 250, y: 290 },
        data: {
          type: "message",
          label: "Claim Status",
          config: {
            type: "message",
            message: "Thank you for confirming. I'm pleased to update you on your claim. Your claim is currently being processed by our adjusters, and we're working to resolve it as quickly as possible.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-additional-info",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Additional Information",
          config: {
            type: "question",
            question: "Do you have any additional documentation or information related to your claim that you haven't submitted yet? This could help expedite the process.",
            variableName: "additional_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-docs-needed",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          type: "condition",
          label: "Has Additional Docs?",
          config: {
            type: "condition",
            condition: "The customer has additional documentation to submit",
          },
        },
      },
      {
        id: "node-explain-submission",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Document Submission",
          config: {
            type: "message",
            message: "You can upload additional documents through our online claims portal or email them directly to our claims department. I'll send you an email with the submission details.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-timeline",
        type: "message",
        position: { x: 250, y: 770 },
        data: {
          type: "message",
          label: "Timeline",
          config: {
            type: "message",
            message: "Based on the current status of your claim, we expect to have a resolution within the next 5-7 business days. You'll receive notifications via email and phone as your claim progresses.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-questions",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Any Questions",
          config: {
            type: "question",
            question: "Do you have any questions about your claim or the process?",
            variableName: "claim_questions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-contact-preference",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Contact Preference",
          config: {
            type: "question",
            question: "How would you prefer we contact you with future updates - by phone, email, or text message?",
            variableName: "contact_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-update",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Update",
          config: {
            type: "webhook",
            url: "https://your-insurance-api.com/claims/update",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "status_call", status: "customer_contacted" },
            description: "Log claims status update call",
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. We're committed to resolving your claim as quickly as possible. You'll receive regular updates, and please don't hesitate to contact us if you have any questions. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-claimant" },
      { id: "e2", source: "node-verify-claimant", target: "node-claim-status" },
      { id: "e3", source: "node-claim-status", target: "node-ask-additional-info" },
      { id: "e4", source: "node-ask-additional-info", target: "node-check-docs-needed" },
      { id: "e5", source: "node-check-docs-needed", sourceHandle: "true", target: "node-explain-submission" },
      { id: "e6", source: "node-check-docs-needed", sourceHandle: "false", target: "node-timeline" },
      { id: "e7", source: "node-explain-submission", target: "node-timeline" },
      { id: "e8", source: "node-timeline", target: "node-ask-questions" },
      { id: "e9", source: "node-ask-questions", target: "node-ask-contact-preference" },
      { id: "e10", source: "node-ask-contact-preference", target: "node-submit-update" },
      { id: "e11", source: "node-submit-update", target: "node-end" },
    ],
  },

  // ============================================
  // Financial Services: Retirement Planning Consultation
  // ============================================
  {
    id: "template-retirement-planning",
    name: "Retirement Planning Consultation",
    description: "Schedule retirement planning advisory sessions, assess current retirement readiness, and book consultations with financial advisors.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Introduction",
          config: {
            type: "message",
            message: "Hello! I'm calling from your financial institution's retirement planning services. We noticed it's been a while since your last retirement review, and we'd like to help ensure you're on track to meet your retirement goals. Is this a good time to talk?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-client",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Client",
          config: {
            type: "question",
            question: "For your security, may I please verify your date of birth?",
            variableName: "date_of_birth",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-retirement-age",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Retirement Age",
          config: {
            type: "question",
            question: "What age are you planning to retire, or have your retirement plans changed recently?",
            variableName: "target_retirement_age",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-current-savings",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Current Savings",
          config: {
            type: "question",
            question: "Are you currently contributing to retirement accounts such as a 401(k), IRA, or other retirement savings plans?",
            variableName: "current_contributions",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-concerns",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Concerns",
          config: {
            type: "question",
            question: "What are your biggest concerns about retirement planning? Is it having enough savings, healthcare costs, or maintaining your lifestyle?",
            variableName: "retirement_concerns",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-services",
        type: "message",
        position: { x: 250, y: 650 },
        data: {
          type: "message",
          label: "Services Overview",
          config: {
            type: "message",
            message: "Our retirement planning advisors can help you create a personalized retirement strategy, optimize your investment mix, maximize Social Security benefits, and plan for healthcare costs. A consultation could give you clarity and confidence about your financial future.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-consultation",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Schedule Consultation",
          config: {
            type: "question",
            question: "Would you like to schedule a complimentary one-on-one consultation with one of our certified retirement planning advisors?",
            variableName: "wants_consultation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-consultation",
        type: "condition",
        position: { x: 250, y: 890 },
        data: {
          type: "condition",
          label: "Schedule?",
          config: {
            type: "condition",
            condition: "The client wants to schedule a retirement planning consultation",
          },
        },
      },
      {
        id: "node-book-consultation",
        type: "appointment",
        position: { x: 450, y: 1010 },
        data: {
          type: "appointment",
          label: "Book Consultation",
          config: {
            type: "appointment",
            appointmentType: "Retirement Planning Consultation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-send-resources",
        type: "message",
        position: { x: 50, y: 1010 },
        data: {
          type: "message",
          label: "Send Resources",
          config: {
            type: "message",
            message: "I understand. Let me send you some helpful retirement planning resources and tools via email. You can review them at your convenience, and feel free to reach out whenever you're ready to discuss your retirement strategy.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-lead",
        type: "webhook",
        position: { x: 250, y: 1130 },
        data: {
          type: "webhook",
          label: "Log Lead",
          config: {
            type: "webhook",
            url: "https://your-wealth-api.com/retirement/leads",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { type: "retirement_planning", source: "outbound_call" },
            description: "Log retirement planning lead and preferences",
          },
        },
      },
      {
        id: "node-scheduled-end",
        type: "end",
        position: { x: 450, y: 1250 },
        data: {
          type: "end",
          label: "Scheduled Goodbye",
          config: {
            type: "end",
            endMessage: "Your consultation is scheduled! You'll receive a confirmation email with details and preparation materials. Our advisor will help you create a clear path to a secure retirement. Thank you, and have a wonderful day!",
          },
        },
      },
      {
        id: "node-resources-end",
        type: "end",
        position: { x: 50, y: 1250 },
        data: {
          type: "end",
          label: "Resources Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. You'll receive an email with retirement planning resources shortly. Remember, it's never too early or too late to start planning for retirement. We're here to help whenever you're ready. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-client" },
      { id: "e2", source: "node-verify-client", target: "node-ask-retirement-age" },
      { id: "e3", source: "node-ask-retirement-age", target: "node-ask-current-savings" },
      { id: "e4", source: "node-ask-current-savings", target: "node-ask-concerns" },
      { id: "e5", source: "node-ask-concerns", target: "node-explain-services" },
      { id: "e6", source: "node-explain-services", target: "node-ask-consultation" },
      { id: "e7", source: "node-ask-consultation", target: "node-check-consultation" },
      { id: "e8", source: "node-check-consultation", sourceHandle: "true", target: "node-book-consultation" },
      { id: "e9", source: "node-check-consultation", sourceHandle: "false", target: "node-send-resources" },
      { id: "e10", source: "node-book-consultation", target: "node-submit-lead" },
      { id: "e11", source: "node-send-resources", target: "node-submit-lead" },
      { id: "e12", source: "node-submit-lead", target: "node-scheduled-end" },
      { id: "e13", source: "node-send-resources", target: "node-resources-end" },
    ],
  },

  // ============================================
  // HOSPITALITY & TRAVEL TEMPLATES
  // ============================================

  // ============================================
  // Template: Hotel Booking Confirmation
  // ============================================
  {
    id: "template-hotel-booking-confirmation",
    name: "Hotel Booking Confirmation",
    description: "Confirm hotel reservations with guests, verify booking details, and collect special requests. Perfect for hotels and resorts.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Good day! This is the reservations team calling to confirm your upcoming stay with us. I'd like to verify a few details to ensure everything is perfect for your arrival. Is this a convenient time?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-name",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Guest Name",
          config: {
            type: "question",
            question: "May I please confirm the name on the reservation?",
            variableName: "guest_name",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-dates",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Verify Dates",
          config: {
            type: "question",
            question: "I have your check-in date and check-out date on file. Can you please confirm these dates are still correct?",
            variableName: "dates_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-room",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Verify Room Type",
          config: {
            type: "question",
            question: "You have reserved a room with us. Is this room type still suitable for your needs, or would you like to explore upgrade options?",
            variableName: "room_confirmed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-arrival",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Arrival Time",
          config: {
            type: "question",
            question: "What time do you expect to arrive at the property? This helps us prepare for your check-in.",
            variableName: "expected_arrival_time",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-special-requests",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Special Requests",
          config: {
            type: "question",
            question: "Do you have any special requests for your stay? For example, room location preferences, extra pillows, or celebration arrangements?",
            variableName: "special_requests",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-transportation",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Transportation",
          config: {
            type: "question",
            question: "Will you need airport or train station transportation? We would be delighted to arrange a pickup for you.",
            variableName: "transportation_needed",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-update-reservation",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Update Reservation",
          config: {
            type: "webhook",
            url: "https://your-hotel-pms.com/reservations/update",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "confirmed", source: "phone_confirmation" },
            description: "Update reservation with confirmed details and special requests",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Confirmation Summary",
          config: {
            type: "message",
            message: "Your reservation's all confirmed! You'll get an email with everything you need. Our team will be ready for you when you arrive.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for choosing to stay with us. We look forward to providing you with an exceptional experience. If you have any questions before your arrival, please don't hesitate to contact us. Have a wonderful day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-name" },
      { id: "e2", source: "node-verify-name", target: "node-verify-dates" },
      { id: "e3", source: "node-verify-dates", target: "node-verify-room" },
      { id: "e4", source: "node-verify-room", target: "node-ask-arrival" },
      { id: "e5", source: "node-ask-arrival", target: "node-ask-special-requests" },
      { id: "e6", source: "node-ask-special-requests", target: "node-ask-transportation" },
      { id: "e7", source: "node-ask-transportation", target: "node-update-reservation" },
      { id: "e8", source: "node-update-reservation", target: "node-confirmation" },
      { id: "e9", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Pre-Arrival Check-in
  // ============================================
  {
    id: "template-hotel-checkin",
    name: "Pre-Arrival Check-in",
    description: "Streamline guest arrivals by collecting check-in preferences, ID verification, and room customization requests in advance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Good day! I'm calling from the front desk to help you complete your pre-arrival check-in. This will make your arrival experience seamless and quick. Do you have a few minutes?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-guest",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Guest",
          config: {
            type: "question",
            question: "For security purposes, may I please confirm your full name and reservation confirmation number?",
            variableName: "guest_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-guests-count",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Number of Guests",
          config: {
            type: "question",
            question: "How many guests will be staying in the room, including yourself?",
            variableName: "number_of_guests",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-bed-preference",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "Bed Preference",
          config: {
            type: "question",
            question: "Do you have a bed configuration preference? For example, king bed, two queen beds, or no preference?",
            variableName: "bed_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-floor-preference",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Floor Preference",
          config: {
            type: "question",
            question: "Do you have a floor preference? Higher floors for views, lower floors for convenience, or no preference?",
            variableName: "floor_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-accessibility",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Accessibility Needs",
          config: {
            type: "question",
            question: "Do you require any accessibility accommodations during your stay?",
            variableName: "accessibility_needs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-payment-method",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Payment Method",
          config: {
            type: "question",
            question: "For the incidentals deposit, will you be using the same credit card on file, or would you prefer to use a different payment method upon arrival?",
            variableName: "payment_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-minibar",
        type: "question",
        position: { x: 250, y: 890 },
        data: {
          type: "question",
          label: "Room Amenities",
          config: {
            type: "question",
            question: "Would you like the minibar stocked, or would you prefer it emptied? We can also pre-stock specific beverages or snacks upon request.",
            variableName: "minibar_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-checkin",
        type: "webhook",
        position: { x: 250, y: 1010 },
        data: {
          type: "webhook",
          label: "Submit Pre-Check-in",
          config: {
            type: "webhook",
            url: "https://your-hotel-pms.com/precheckin",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "pre_checked_in", source: "phone" },
            description: "Submit pre-check-in preferences to hotel PMS",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1130 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "You're all checked in! When you get here, just head to the express counter and your room key will be waiting. No line, no hassle.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1250 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for completing your pre-arrival check-in. We're excited to welcome you and hope you have a wonderful stay. Safe travels!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-guest" },
      { id: "e2", source: "node-verify-guest", target: "node-guests-count" },
      { id: "e3", source: "node-guests-count", target: "node-bed-preference" },
      { id: "e4", source: "node-bed-preference", target: "node-floor-preference" },
      { id: "e5", source: "node-floor-preference", target: "node-accessibility" },
      { id: "e6", source: "node-accessibility", target: "node-payment-method" },
      { id: "e7", source: "node-payment-method", target: "node-minibar" },
      { id: "e8", source: "node-minibar", target: "node-submit-checkin" },
      { id: "e9", source: "node-submit-checkin", target: "node-confirmation" },
      { id: "e10", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Concierge Service Request
  // ============================================
  {
    id: "template-concierge-service",
    name: "Concierge Service Request",
    description: "Handle guest requests for dining reservations, activity bookings, transportation, and personalized recommendations.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Good day! Thank you for contacting our concierge service. I'm here to assist with any requests to make your stay exceptional. How may I help you today?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-guest",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Guest",
          config: {
            type: "question",
            question: "May I have your name and room number, please?",
            variableName: "guest_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-request-type",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Request Type",
          config: {
            type: "question",
            question: "What type of service are you looking for today? For example, dining reservations, activity or tour bookings, transportation, spa appointments, or something else?",
            variableName: "service_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-dining",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Is Dining Request?",
          config: {
            type: "condition",
            condition: "The guest is requesting dining or restaurant reservations",
          },
        },
      },
      {
        id: "node-dining-details",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Dining Details",
          config: {
            type: "question",
            question: "For your dining reservation, what cuisine type are you interested in, how many guests will be dining, and what date and time would you prefer?",
            variableName: "dining_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-dining-preferences",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Dining Preferences",
          config: {
            type: "question",
            question: "Do you have any dietary restrictions or seating preferences? For example, outdoor seating, private dining, or a table with a view?",
            variableName: "dining_preferences",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-other-details",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Other Request Details",
          config: {
            type: "question",
            question: "Please tell me more about what you're looking for. Include any preferences for date, time, number of people, and any special requirements.",
            variableName: "request_details",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-budget",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Budget Range",
          config: {
            type: "question",
            question: "Do you have a budget range in mind, or would you like me to present various options?",
            variableName: "budget_range",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-submit-request",
        type: "webhook",
        position: { x: 250, y: 770 },
        data: {
          type: "webhook",
          label: "Submit Request",
          config: {
            type: "webhook",
            url: "https://your-hotel-pms.com/concierge/requests",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "pending", source: "phone" },
            description: "Submit concierge request for processing",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 890 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "I've noted all your preferences and our concierge team is working on this right away. We will contact you within the hour with confirmation details and options.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-additional",
        type: "question",
        position: { x: 250, y: 1010 },
        data: {
          type: "question",
          label: "Additional Requests",
          config: {
            type: "question",
            question: "Is there anything else I can assist you with during your stay?",
            variableName: "additional_requests",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1130 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "It's my pleasure to assist. Our concierge team will follow up shortly. Please don't hesitate to call us anytime for any other requests. Enjoy your stay!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-guest" },
      { id: "e2", source: "node-verify-guest", target: "node-request-type" },
      { id: "e3", source: "node-request-type", target: "node-check-dining" },
      { id: "e4", source: "node-check-dining", sourceHandle: "true", target: "node-dining-details" },
      { id: "e5", source: "node-check-dining", sourceHandle: "false", target: "node-other-details" },
      { id: "e6", source: "node-dining-details", target: "node-dining-preferences" },
      { id: "e7", source: "node-dining-preferences", target: "node-submit-request" },
      { id: "e8", source: "node-other-details", target: "node-budget" },
      { id: "e9", source: "node-budget", target: "node-submit-request" },
      { id: "e10", source: "node-submit-request", target: "node-confirmation" },
      { id: "e11", source: "node-confirmation", target: "node-ask-additional" },
      { id: "e12", source: "node-ask-additional", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Loyalty Program Enrollment
  // ============================================
  {
    id: "template-loyalty-program",
    name: "Loyalty Program Enrollment",
    description: "Enroll guests in your hotel or travel rewards program, explain benefits, and collect member preferences.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Hello! Thank you for your recent stay with us. I'm calling to share an exclusive opportunity to join our rewards program where you can earn points on every stay and enjoy special member benefits. Do you have a moment to learn more?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-explain-benefits",
        type: "message",
        position: { x: 250, y: 170 },
        data: {
          type: "message",
          label: "Explain Benefits",
          config: {
            type: "message",
            message: "As a member, you'll enjoy complimentary room upgrades when available, late checkout privileges, exclusive member rates, points that never expire, and access to special experiences. Plus, enrollment is completely free!",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-ask-interest",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Interest Check",
          config: {
            type: "question",
            question: "Would you like to enroll in our rewards program today and start earning points immediately?",
            variableName: "enrollment_interest",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-interest",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Wants to Enroll?",
          config: {
            type: "condition",
            condition: "The guest wants to enroll or expressed positive interest",
          },
        },
      },
      {
        id: "node-collect-email",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Email Address",
          config: {
            type: "question",
            question: "Nice, let's get you signed up. What email do you want to use for your account?",
            variableName: "member_email",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-collect-phone",
        type: "question",
        position: { x: 450, y: 650 },
        data: {
          type: "question",
          label: "Phone Number",
          config: {
            type: "question",
            question: "And what's the best phone number to reach you for exclusive offers?",
            variableName: "member_phone",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-travel-preferences",
        type: "question",
        position: { x: 450, y: 770 },
        data: {
          type: "question",
          label: "Travel Preferences",
          config: {
            type: "question",
            question: "To personalize your experience, do you typically travel for business, leisure, or both?",
            variableName: "travel_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-room-preferences",
        type: "question",
        position: { x: 450, y: 890 },
        data: {
          type: "question",
          label: "Room Preferences",
          config: {
            type: "question",
            question: "Do you have any standing room preferences? For example, high floor, quiet location, pillow type, or newspaper delivery?",
            variableName: "room_preferences",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-enroll-webhook",
        type: "webhook",
        position: { x: 450, y: 1010 },
        data: {
          type: "webhook",
          label: "Create Membership",
          config: {
            type: "webhook",
            url: "https://your-loyalty-api.com/members/enroll",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "active", source: "phone_enrollment", tier: "member" },
            description: "Create new loyalty program membership",
          },
        },
      },
      {
        id: "node-enrollment-complete",
        type: "message",
        position: { x: 450, y: 1130 },
        data: {
          type: "message",
          label: "Enrollment Complete",
          config: {
            type: "message",
            message: "Congratulations! You're now a valued member of our rewards program. Your welcome email with your member number and digital card is on its way. You'll also receive 500 bonus points as a welcome gift!",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-enrolled-end",
        type: "end",
        position: { x: 450, y: 1250 },
        data: {
          type: "end",
          label: "Enrolled Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for joining our rewards family! We're excited to have you as a member and look forward to rewarding your loyalty. Have a wonderful day!",
          },
        },
      },
      {
        id: "node-not-interested",
        type: "message",
        position: { x: 50, y: 530 },
        data: {
          type: "message",
          label: "Understand Decision",
          config: {
            type: "message",
            message: "I completely understand. Just so you know, you can join anytime through our website or during your next stay. We'd love to welcome you when you're ready.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-log-declined",
        type: "webhook",
        position: { x: 50, y: 650 },
        data: {
          type: "webhook",
          label: "Log Declined",
          config: {
            type: "webhook",
            url: "https://your-loyalty-api.com/prospects",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "declined", follow_up: true },
            description: "Log declined enrollment for future follow-up",
          },
        },
      },
      {
        id: "node-declined-end",
        type: "end",
        position: { x: 50, y: 770 },
        data: {
          type: "end",
          label: "Declined Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your time today. We appreciate your past stays with us and hope to welcome you back soon. Have a great day!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-explain-benefits" },
      { id: "e2", source: "node-explain-benefits", target: "node-ask-interest" },
      { id: "e3", source: "node-ask-interest", target: "node-check-interest" },
      { id: "e4", source: "node-check-interest", sourceHandle: "true", target: "node-collect-email" },
      { id: "e5", source: "node-check-interest", sourceHandle: "false", target: "node-not-interested" },
      { id: "e6", source: "node-collect-email", target: "node-collect-phone" },
      { id: "e7", source: "node-collect-phone", target: "node-travel-preferences" },
      { id: "e8", source: "node-travel-preferences", target: "node-room-preferences" },
      { id: "e9", source: "node-room-preferences", target: "node-enroll-webhook" },
      { id: "e10", source: "node-enroll-webhook", target: "node-enrollment-complete" },
      { id: "e11", source: "node-enrollment-complete", target: "node-enrolled-end" },
      { id: "e12", source: "node-not-interested", target: "node-log-declined" },
      { id: "e13", source: "node-log-declined", target: "node-declined-end" },
    ],
  },

  // ============================================
  // Template: Flight Rebooking Assistance
  // ============================================
  {
    id: "template-flight-rebooking",
    name: "Flight Rebooking Assistance",
    description: "Help travelers rebook missed or changed flights, collect preferences, and find alternative travel options.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Welcome",
          config: {
            type: "message",
            message: "Thank you for calling our flight rebooking assistance line. I understand travel changes can be stressful, and I'm here to help find the best solution for you. May I have your booking reference or confirmation number?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-booking",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Booking",
          config: {
            type: "question",
            question: "Thank you. For verification, can you please confirm the passenger name and original flight date?",
            variableName: "booking_verification",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-ask-reason",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Reason for Change",
          config: {
            type: "question",
            question: "I'd like to understand your situation better. Are you looking to rebook due to a missed flight, schedule conflict, or would you like to change your travel dates?",
            variableName: "rebooking_reason",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-new-dates",
        type: "question",
        position: { x: 250, y: 410 },
        data: {
          type: "question",
          label: "New Travel Dates",
          config: {
            type: "question",
            question: "What are your preferred new travel dates? Please share your ideal departure date and any flexibility you might have.",
            variableName: "new_travel_dates",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-time-preference",
        type: "question",
        position: { x: 250, y: 530 },
        data: {
          type: "question",
          label: "Time Preference",
          config: {
            type: "question",
            question: "Do you prefer morning, afternoon, or evening flights?",
            variableName: "time_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-class-preference",
        type: "question",
        position: { x: 250, y: 650 },
        data: {
          type: "question",
          label: "Class Preference",
          config: {
            type: "question",
            question: "Would you like to maintain the same cabin class, or are you interested in an upgrade if available?",
            variableName: "class_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-direct-preference",
        type: "question",
        position: { x: 250, y: 770 },
        data: {
          type: "question",
          label: "Direct Flight Preference",
          config: {
            type: "question",
            question: "Do you prefer direct flights only, or are you open to connections if it means earlier departure or lower fare difference?",
            variableName: "connection_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-search-flights",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Search Options",
          config: {
            type: "webhook",
            url: "https://your-airline-api.com/rebooking/search",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { action: "search_alternatives", source: "phone" },
            description: "Search for available rebooking options",
          },
        },
      },
      {
        id: "node-present-options",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Present Options",
          config: {
            type: "message",
            message: "I've found several options that match your preferences. Let me share the best available flights with you. Our team will review and confirm the most suitable option based on availability.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-confirm-selection",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Confirm Selection",
          config: {
            type: "question",
            question: "Shall I proceed with rebooking based on your preferences, or would you like to speak with a specialist about specific flight options?",
            variableName: "proceed_confirmation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-process-rebooking",
        type: "webhook",
        position: { x: 250, y: 1250 },
        data: {
          type: "webhook",
          label: "Process Rebooking",
          config: {
            type: "webhook",
            url: "https://your-airline-api.com/rebooking/process",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { status: "pending_confirmation", source: "phone" },
            description: "Submit rebooking request for processing",
          },
        },
      },
      {
        id: "node-confirmation",
        type: "message",
        position: { x: 250, y: 1370 },
        data: {
          type: "message",
          label: "Confirmation",
          config: {
            type: "message",
            message: "Your rebooking request has been submitted. You will receive an email confirmation shortly with your new itinerary and any fare difference details. Please check your email within the next 15 minutes.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1490 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "Thank you for your patience. We've done our best to accommodate your travel needs. If you have any questions about your new booking, please don't hesitate to call us back. Have a safe journey!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-booking" },
      { id: "e2", source: "node-verify-booking", target: "node-ask-reason" },
      { id: "e3", source: "node-ask-reason", target: "node-new-dates" },
      { id: "e4", source: "node-new-dates", target: "node-time-preference" },
      { id: "e5", source: "node-time-preference", target: "node-class-preference" },
      { id: "e6", source: "node-class-preference", target: "node-direct-preference" },
      { id: "e7", source: "node-direct-preference", target: "node-search-flights" },
      { id: "e8", source: "node-search-flights", target: "node-present-options" },
      { id: "e9", source: "node-present-options", target: "node-confirm-selection" },
      { id: "e10", source: "node-confirm-selection", target: "node-process-rebooking" },
      { id: "e11", source: "node-process-rebooking", target: "node-confirmation" },
      { id: "e12", source: "node-confirmation", target: "node-end" },
    ],
  },

  // ============================================
  // Template: Travel Disruption Handler
  // ============================================
  {
    id: "template-travel-disruption",
    name: "Travel Disruption Handler",
    description: "Manage flight delays, cancellations, and travel disruptions with empathy. Provide rebooking, compensation info, and accommodation assistance.",
    isTemplate: true,
    nodes: [
      {
        id: "node-greeting",
        type: "message",
        position: { x: 250, y: 50 },
        data: {
          type: "message",
          label: "Empathetic Welcome",
          config: {
            type: "message",
            message: "I understand your travel has been disrupted, and I sincerely apologize for any inconvenience. I'm here to help resolve this situation and get you on your way as quickly as possible. May I have your booking reference?",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-verify-booking",
        type: "question",
        position: { x: 250, y: 170 },
        data: {
          type: "question",
          label: "Verify Details",
          config: {
            type: "question",
            question: "Thank you. Can you please confirm your name and the flight that has been affected?",
            variableName: "affected_flight_info",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-disruption-type",
        type: "question",
        position: { x: 250, y: 290 },
        data: {
          type: "question",
          label: "Disruption Type",
          config: {
            type: "question",
            question: "I want to make sure I understand your situation correctly. Has your flight been delayed, cancelled, or are you experiencing a different issue?",
            variableName: "disruption_type",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-check-cancellation",
        type: "condition",
        position: { x: 250, y: 410 },
        data: {
          type: "condition",
          label: "Is Cancellation?",
          config: {
            type: "condition",
            condition: "The flight has been cancelled or the traveler needs immediate rebooking",
          },
        },
      },
      {
        id: "node-urgent-rebooking",
        type: "question",
        position: { x: 50, y: 530 },
        data: {
          type: "question",
          label: "Urgent Rebooking",
          config: {
            type: "question",
            question: "I'm prioritizing finding you an alternative flight immediately. What is your destination, and how urgent is your arrival? Do you have any flexibility on dates?",
            variableName: "urgent_preferences",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-accommodation-needed",
        type: "question",
        position: { x: 50, y: 650 },
        data: {
          type: "question",
          label: "Accommodation Need",
          config: {
            type: "question",
            question: "Given the disruption, will you need overnight accommodation? We can arrange a complimentary hotel stay if your next available flight is tomorrow.",
            variableName: "needs_accommodation",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-meal-voucher",
        type: "message",
        position: { x: 50, y: 770 },
        data: {
          type: "message",
          label: "Meal Voucher",
          config: {
            type: "message",
            message: "I'm also issuing meal vouchers for you. These can be used at any airport restaurant or food outlet. The vouchers will be sent to your email immediately.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-delay-update",
        type: "question",
        position: { x: 450, y: 530 },
        data: {
          type: "question",
          label: "Delay Information",
          config: {
            type: "question",
            question: "I have information about your delayed flight. Would you prefer to wait for this flight, or would you like me to explore alternative flights that might get you there sooner?",
            variableName: "delay_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-delay-amenities",
        type: "message",
        position: { x: 450, y: 650 },
        data: {
          type: "message",
          label: "Delay Amenities",
          config: {
            type: "message",
            message: "While you wait, please visit our customer service desk for refreshment vouchers. If the delay extends beyond 4 hours, we will provide additional meal vouchers and lounge access.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-submit-case",
        type: "webhook",
        position: { x: 250, y: 890 },
        data: {
          type: "webhook",
          label: "Log Disruption Case",
          config: {
            type: "webhook",
            url: "https://your-airline-api.com/disruptions/cases",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            payload: { priority: "high", source: "phone" },
            description: "Log disruption case for tracking and compensation processing",
          },
        },
      },
      {
        id: "node-compensation-info",
        type: "message",
        position: { x: 250, y: 1010 },
        data: {
          type: "message",
          label: "Compensation Info",
          config: {
            type: "message",
            message: "Regarding compensation, based on the nature of this disruption, you may be eligible for compensation under passenger rights regulations. A detailed email will be sent to you with information on how to submit a claim.",
            waitForResponse: false,
          },
        },
      },
      {
        id: "node-contact-preferences",
        type: "question",
        position: { x: 250, y: 1130 },
        data: {
          type: "question",
          label: "Contact Preferences",
          config: {
            type: "question",
            question: "How would you like to receive updates about your new travel arrangements - via SMS, email, or both?",
            variableName: "contact_preference",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-additional-assistance",
        type: "question",
        position: { x: 250, y: 1250 },
        data: {
          type: "question",
          label: "Additional Assistance",
          config: {
            type: "question",
            question: "Is there anything else I can help you with? Do you need assistance with connecting flights, ground transportation, or notifying anyone about your delayed arrival?",
            variableName: "additional_needs",
            waitForResponse: true,
          },
        },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 250, y: 1370 },
        data: {
          type: "end",
          label: "Goodbye",
          config: {
            type: "end",
            endMessage: "I've done everything I can to minimize this disruption for you. You'll receive all confirmations and updates via your preferred contact method. Again, I apologize for this inconvenience and thank you for your patience. Safe travels!",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-greeting", target: "node-verify-booking" },
      { id: "e2", source: "node-verify-booking", target: "node-disruption-type" },
      { id: "e3", source: "node-disruption-type", target: "node-check-cancellation" },
      { id: "e4", source: "node-check-cancellation", sourceHandle: "true", target: "node-urgent-rebooking" },
      { id: "e5", source: "node-check-cancellation", sourceHandle: "false", target: "node-delay-update" },
      { id: "e6", source: "node-urgent-rebooking", target: "node-accommodation-needed" },
      { id: "e7", source: "node-accommodation-needed", target: "node-meal-voucher" },
      { id: "e8", source: "node-meal-voucher", target: "node-submit-case" },
      { id: "e9", source: "node-delay-update", target: "node-delay-amenities" },
      { id: "e10", source: "node-delay-amenities", target: "node-submit-case" },
      { id: "e11", source: "node-submit-case", target: "node-compensation-info" },
      { id: "e12", source: "node-compensation-info", target: "node-contact-preferences" },
      { id: "e13", source: "node-contact-preferences", target: "node-additional-assistance" },
      { id: "e14", source: "node-additional-assistance", target: "node-end" },
    ],
  },
];
