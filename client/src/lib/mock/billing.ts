import type { InvoiceStatus } from "@/components/billing/InvoiceStatusBadge";

export interface BillingCycleSummary {
  workspaceName: string;
  entityLabel: string;
  cycleStart: string; // ISO
  cycleEnd: string; // ISO
  renewsOn: string; // ISO
  currency: "USD" | "AED" | "SAR";
}

export interface UsageMetric {
  key:
    | "inboundVoiceMinutes"
    | "outboundVoiceMinutes"
    | "aiAgentSessions"
    | "voiceSynthesisMinutes"
    | "transcriptionMinutes"
    | "activePhoneNumbers"
    | "messaging";
  label: string;
  used: number;
  unit: "minutes" | "sessions" | "numbers" | "messages";
  included?: number;
  deltaPct?: number;
}

export interface ChargeLineItem {
  group:
    | "Platform subscription"
    | "AI usage"
    | "Telephony usage"
    | "Number rental"
    | "Add-ons"
    | "Taxes"
    | "Credits applied";
  label: string;
  amount: number; // positive = charge, negative = credit
  hint?: string;
}

export interface InvoiceRow {
  invoice: string;
  date: string; // ISO
  billingPeriod: string;
  amount: number;
  status: InvoiceStatus;
  downloadUrl?: string;
}

export interface PaymentMethodSummary {
  brand: "Visa" | "Mastercard" | "Amex";
  last4: string;
  billingEmail: string;
  lastPaymentStatus: "Succeeded" | "Failed" | "Pending";
  nextChargeDate: string; // ISO
  cardExpMonth: number;
  cardExpYear: number;
}

export interface BillingProfileSummary {
  companyName: string;
  billingEmail: string;
  vatTrn: string;
  address: string;
  currency: "USD" | "AED" | "SAR";
}

export interface WalletSummary {
  balance: number;
  autoTopUpEnabled: boolean;
  threshold: number;
  topUpAmount: number;
  lastTopUpDate: string; // ISO
}

export interface ByanAIBillingMock {
  cycle: BillingCycleSummary;
  currentPlanName: string;
  usage: UsageMetric[];
  charges: ChargeLineItem[];
  paymentMethod: PaymentMethodSummary;
  billingProfile: BillingProfileSummary;
  wallet: WalletSummary;
  invoices: InvoiceRow[];
}

export const byanAiBillingMock: ByanAIBillingMock = {
  cycle: {
    workspaceName: "Byan AI Workspace",
    entityLabel: "Al Noor Trading LLC (Dubai, UAE)",
    cycleStart: "2026-04-01T00:00:00.000Z",
    cycleEnd: "2026-04-30T23:59:59.000Z",
    renewsOn: "2026-05-01T00:00:00.000Z",
    currency: "USD",
  },
  currentPlanName: "Growth",
  usage: [
    { key: "inboundVoiceMinutes", label: "Inbound voice minutes", used: 10420, included: 8000, unit: "minutes", deltaPct: 6 },
    { key: "outboundVoiceMinutes", label: "Outbound voice minutes", used: 8000, included: 4000, unit: "minutes", deltaPct: 12 },
    { key: "aiAgentSessions", label: "AI agent sessions", used: 3120, included: 2500, unit: "sessions", deltaPct: 9 },
    { key: "voiceSynthesisMinutes", label: "Voice synthesis minutes", used: 920, included: 600, unit: "minutes", deltaPct: -4 },
    { key: "transcriptionMinutes", label: "Transcription minutes", used: 7420, included: 6000, unit: "minutes", deltaPct: 3 },
    { key: "activePhoneNumbers", label: "Active phone numbers", used: 18, included: 10, unit: "numbers", deltaPct: 0 },
    { key: "messaging", label: "SMS / WhatsApp messages", used: 12840, included: 10000, unit: "messages", deltaPct: 5 },
  ],
  charges: [
    { group: "Platform subscription", label: "Growth plan (monthly)", amount: 499, hint: "Seats and core platform access" },
    { group: "AI usage", label: "AI agent sessions overage", amount: 132.4, hint: "620 sessions over included" },
    { group: "AI usage", label: "Voice synthesis overage", amount: 86.2, hint: "320 minutes over included" },
    { group: "Telephony usage", label: "Inbound minutes overage", amount: 241.0, hint: "2,420 minutes over included" },
    { group: "Telephony usage", label: "Outbound minutes overage", amount: 301.5, hint: "4,000 minutes over included" },
    { group: "Number rental", label: "Phone number rental", amount: 144, hint: "18 active numbers" },
    { group: "Add-ons", label: "Advanced analytics add-on", amount: 79, hint: "Quality and compliance views" },
    { group: "Taxes", label: "VAT (0%)", amount: 0, hint: "Reverse-charge / exempt for this entity" },
    { group: "Credits applied", label: "Wallet credits applied", amount: -199.5, hint: "Applied to usage overages" },
  ],
  paymentMethod: {
    brand: "Visa",
    last4: "1234",
    billingEmail: "billing@alnoortrading.ae",
    lastPaymentStatus: "Succeeded",
    nextChargeDate: "2026-05-01T00:00:00.000Z",
    cardExpMonth: 5,
    cardExpYear: 2027,
  },
  billingProfile: {
    companyName: "Al Noor Trading LLC",
    billingEmail: "billing@alnoortrading.ae",
    vatTrn: "TRN-100239481200003",
    address: "180 Greenwich High Rd, Greenwich, Dubai, UAE",
    currency: "USD",
  },
  wallet: {
    balance: 420,
    autoTopUpEnabled: true,
    threshold: 150,
    topUpAmount: 300,
    lastTopUpDate: "2026-04-18T10:20:00.000Z",
  },
  invoices: [
    {
      invoice: "INV-2026-04",
      date: "2026-04-23T09:10:00.000Z",
      billingPeriod: "Apr 1 – Apr 30, 2026",
      amount: 1284.6,
      status: "Paid",
      downloadUrl: "/api/invoices/INV-2026-04/download",
    },
    {
      invoice: "INV-2026-03",
      date: "2026-03-23T09:10:00.000Z",
      billingPeriod: "Mar 1 – Mar 31, 2026",
      amount: 1176.2,
      status: "Paid",
      downloadUrl: "/api/invoices/INV-2026-03/download",
    },
    {
      invoice: "INV-2026-02",
      date: "2026-02-23T09:10:00.000Z",
      billingPeriod: "Feb 1 – Feb 28, 2026",
      amount: 1044.9,
      status: "Pending",
      downloadUrl: "/api/invoices/INV-2026-02/download",
    },
    {
      invoice: "INV-2026-01",
      date: "2026-01-23T09:10:00.000Z",
      billingPeriod: "Jan 1 – Jan 31, 2026",
      amount: 990.0,
      status: "Refunded",
      downloadUrl: "/api/invoices/INV-2026-01/download",
    },
  ],
};

