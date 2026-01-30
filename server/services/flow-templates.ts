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
            endMessage: "Wonderful! Based on what you've shared, I think we have some great options for you. Our sales team will reach out within 24 hours to schedule a detailed demo. Thank you for your time!",
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
            message: "Wonderful! You're all registered. You'll receive a confirmation email shortly with all the event details including venue information, agenda, and parking instructions.",
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
            endMessage: "Excellent! I've got you booked in. You'll receive a calendar invite shortly. Looking forward to speaking with you then. Have a great day!",
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
            endMessage: "Excellent! Your upgrade has been processed. You'll receive a confirmation email shortly with all the details about your new features. Thank you for being a valued customer!",
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
            endMessage: "Wonderful! Your account is being set up. You'll receive login details via email shortly. Welcome to {company_name}!",
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
            endMessage: "Excellent! Your account has been upgraded. You'll receive a confirmation email with your receipt. Thank you for choosing us!",
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
            message: "Hi {contact_name}! This is {agent_name} from {company_name}. I'm following up on the quote we sent over for {project_name}. Have you had a chance to review it?",
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
            endMessage: "Wonderful! I'm marking the quote as accepted. You'll receive a contract to sign via email. We're excited to work with you!",
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
            endMessage: "Excellent! Your pre-order is confirmed. You'll be among the first to receive {product_name}. We'll send shipping details as soon as it's ready. Thank you for your continued support!",
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
            question: "Wonderful! What would you like to order today? I can process it right now.",
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
            message: "Hi {contact_name}! This is {agent_name} from {company_name}. I'm following up on the contract we sent over for {deal_name}. I wanted to see if you have any questions or if there's anything we need to discuss before moving forward.",
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
            endMessage: "Wonderful! I've applied that to your account. You'll see the changes reflected immediately. Thank you for giving us another chance!",
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
];
