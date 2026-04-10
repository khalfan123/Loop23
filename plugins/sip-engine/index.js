import { createRequire as __cr } from "module";
const require = __cr(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// plugins/sip-engine/routes/sip-trunk.routes.ts
import { z as z2 } from "zod";

// server/db.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  AI_CATEGORY_COLORS: () => AI_CATEGORY_COLORS,
  AI_CATEGORY_LABELS: () => AI_CATEGORY_LABELS,
  AI_CATEGORY_PRIORITY: () => AI_CATEGORY_PRIORITY,
  AI_LEAD_CATEGORIES: () => AI_LEAD_CATEGORIES,
  API_SCOPES: () => API_SCOPES,
  agentNames: () => agentNames,
  agentPresets: () => agentPresets,
  agentVersions: () => agentVersions,
  agents: () => agents,
  analyticsScripts: () => analyticsScripts,
  apiAuditLogs: () => apiAuditLogs,
  apiKeys: () => apiKeys,
  apiRateLimits: () => apiRateLimits,
  appointmentSettings: () => appointmentSettings,
  appointments: () => appointments,
  auditLogs: () => auditLogs,
  awsCredentials: () => awsCredentials,
  bannedWords: () => bannedWords,
  bedrockKbFiles: () => bedrockKbFiles,
  callErrorLogs: () => callErrorLogs,
  callQaAnalyses: () => callQaAnalyses,
  callResponses: () => callResponses,
  callerMemory: () => callerMemory,
  calls: () => calls,
  campaignJobs: () => campaignJobs,
  campaigns: () => campaigns,
  ciAnalyses: () => ciAnalyses,
  ciCalls: () => ciCalls,
  contacts: () => contacts,
  contentAuditLog: () => contentAuditLog,
  contentViolations: () => contentViolations,
  crawlJobs: () => crawlJobs,
  crawlPages: () => crawlPages,
  createAppointmentSchema: () => createAppointmentSchema,
  createAppointmentSettingsSchema: () => createAppointmentSettingsSchema,
  createFlowSchema: () => createFlowSchema,
  createFormSchema: () => createFormSchema,
  createWebhookSchema: () => createWebhookSchema,
  creditPackages: () => creditPackages,
  creditTransactions: () => creditTransactions,
  crmCategoryPreferences: () => crmCategoryPreferences,
  demoSessions: () => demoSessions,
  departmentAgents: () => departmentAgents,
  departmentKnowledgeBases: () => departmentKnowledgeBases,
  departments: () => departments,
  determineAICategory: () => determineAICategory,
  elevenLabsCredentials: () => elevenLabsCredentials,
  emailNotificationSettings: () => emailNotificationSettings,
  emailTemplates: () => emailTemplates,
  flowExecutions: () => flowExecutions,
  flows: () => flows,
  fonosterCredentials: () => fonosterCredentials,
  formFields: () => formFields,
  formSubmissions: () => formSubmissions,
  forms: () => forms,
  generatedArticles: () => generatedArticles,
  generatedUseCases: () => generatedUseCases,
  globalSettings: () => globalSettings,
  humanIncomingConnections: () => humanIncomingConnections,
  incomingAgents: () => incomingAgents,
  incomingConnections: () => incomingConnections,
  insertAgentNameSchema: () => insertAgentNameSchema,
  insertAgentPresetSchema: () => insertAgentPresetSchema,
  insertAgentSchema: () => insertAgentSchema,
  insertAgentVersionSchema: () => insertAgentVersionSchema,
  insertAnalyticsScriptSchema: () => insertAnalyticsScriptSchema,
  insertApiAuditLogSchema: () => insertApiAuditLogSchema,
  insertApiKeySchema: () => insertApiKeySchema,
  insertAppointmentSchema: () => insertAppointmentSchema,
  insertAppointmentSettingsSchema: () => insertAppointmentSettingsSchema,
  insertAwsCredentialSchema: () => insertAwsCredentialSchema,
  insertBannedWordSchema: () => insertBannedWordSchema,
  insertBedrockKbFileSchema: () => insertBedrockKbFileSchema,
  insertCallErrorLogSchema: () => insertCallErrorLogSchema,
  insertCallQaAnalysisSchema: () => insertCallQaAnalysisSchema,
  insertCallResponseSchema: () => insertCallResponseSchema,
  insertCallSchema: () => insertCallSchema,
  insertCallerMemorySchema: () => insertCallerMemorySchema,
  insertCampaignJobSchema: () => insertCampaignJobSchema,
  insertCampaignSchema: () => insertCampaignSchema,
  insertCiAnalysisSchema: () => insertCiAnalysisSchema,
  insertCiCallSchema: () => insertCiCallSchema,
  insertContactSchema: () => insertContactSchema,
  insertContentAuditLogSchema: () => insertContentAuditLogSchema,
  insertContentViolationSchema: () => insertContentViolationSchema,
  insertCrawlJobSchema: () => insertCrawlJobSchema,
  insertCrawlPageSchema: () => insertCrawlPageSchema,
  insertCreditPackageSchema: () => insertCreditPackageSchema,
  insertCreditTransactionSchema: () => insertCreditTransactionSchema,
  insertCrmCategoryPreferencesSchema: () => insertCrmCategoryPreferencesSchema,
  insertDemoSessionSchema: () => insertDemoSessionSchema,
  insertDepartmentAgentSchema: () => insertDepartmentAgentSchema,
  insertDepartmentSchema: () => insertDepartmentSchema,
  insertElevenLabsCredentialSchema: () => insertElevenLabsCredentialSchema,
  insertEmailNotificationSettingsSchema: () => insertEmailNotificationSettingsSchema,
  insertEmailTemplateSchema: () => insertEmailTemplateSchema,
  insertFlowExecutionSchema: () => insertFlowExecutionSchema,
  insertFlowSchema: () => insertFlowSchema,
  insertFonosterCredentialSchema: () => insertFonosterCredentialSchema,
  insertFormFieldSchema: () => insertFormFieldSchema,
  insertFormSchema: () => insertFormSchema,
  insertFormSubmissionSchema: () => insertFormSubmissionSchema,
  insertGeneratedArticleSchema: () => insertGeneratedArticleSchema,
  insertGeneratedUseCaseSchema: () => insertGeneratedUseCaseSchema,
  insertGlobalSettingsSchema: () => insertGlobalSettingsSchema,
  insertHumanIncomingConnectionSchema: () => insertHumanIncomingConnectionSchema,
  insertIncomingAgentSchema: () => insertIncomingAgentSchema,
  insertIncomingConnectionSchema: () => insertIncomingConnectionSchema,
  insertIntegrationAppSchema: () => insertIntegrationAppSchema,
  insertIntegrationSyncLogSchema: () => insertIntegrationSyncLogSchema,
  insertInvoiceSchema: () => insertInvoiceSchema,
  insertIvrConfigurationSchema: () => insertIvrConfigurationSchema,
  insertKnowledgeBaseSchema: () => insertKnowledgeBaseSchema,
  insertKnowledgeChunkSchema: () => insertKnowledgeChunkSchema,
  insertKnowledgeEntitySchema: () => insertKnowledgeEntitySchema,
  insertKnowledgeFaqSchema: () => insertKnowledgeFaqSchema,
  insertKnowledgeFolderSchema: () => insertKnowledgeFolderSchema,
  insertKnowledgeGraphEdgeSchema: () => insertKnowledgeGraphEdgeSchema,
  insertKnowledgeGraphNodeSchema: () => insertKnowledgeGraphNodeSchema,
  insertKnowledgePipelineJobSchema: () => insertKnowledgePipelineJobSchema,
  insertKnowledgeProcessingQueueSchema: () => insertKnowledgeProcessingQueueSchema,
  insertKnowledgeTopicSchema: () => insertKnowledgeTopicSchema,
  insertLeadActivitySchema: () => insertLeadActivitySchema,
  insertLeadNoteSchema: () => insertLeadNoteSchema,
  insertLeadSchema: () => insertLeadSchema,
  insertLeadStageSchema: () => insertLeadStageSchema,
  insertLegacyWebhookDeliverySchema: () => insertLegacyWebhookDeliverySchema,
  insertLegacyWebhookSchema: () => insertLegacyWebhookSchema,
  insertLlmModelSchema: () => insertLlmModelSchema,
  insertMlAnalysisJobSchema: () => insertMlAnalysisJobSchema,
  insertMlCommonIssueSchema: () => insertMlCommonIssueSchema,
  insertMlConversationAnalysisSchema: () => insertMlConversationAnalysisSchema,
  insertMlTrainingSampleSchema: () => insertMlTrainingSampleSchema,
  insertMlTrainingStatsSchema: () => insertMlTrainingStatsSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertOpenaiCredentialSchema: () => insertOpenaiCredentialSchema,
  insertOpsAnalysisRunSchema: () => insertOpsAnalysisRunSchema,
  insertOpsTaskSchema: () => insertOpsTaskSchema,
  insertPaymentTransactionSchema: () => insertPaymentTransactionSchema,
  insertPaymentWebhookQueueSchema: () => insertPaymentWebhookQueueSchema,
  insertPhoneNumberRentalSchema: () => insertPhoneNumberRentalSchema,
  insertPhoneNumberSchema: () => insertPhoneNumberSchema,
  insertPlanSchema: () => insertPlanSchema,
  insertPlatformLanguageSchema: () => insertPlatformLanguageSchema,
  insertPlivoCallSchema: () => insertPlivoCallSchema,
  insertPlivoCredentialSchema: () => insertPlivoCredentialSchema,
  insertPlivoPhoneNumberSchema: () => insertPlivoPhoneNumberSchema,
  insertPlivoPhonePricingSchema: () => insertPlivoPhonePricingSchema,
  insertPortRequestSchema: () => insertPortRequestSchema,
  insertProductSchema: () => insertProductSchema,
  insertPromptTemplateSchema: () => insertPromptTemplateSchema,
  insertProviderCallerIdSchema: () => insertProviderCallerIdSchema,
  insertRefundSchema: () => insertRefundSchema,
  insertSeoSettingsSchema: () => insertSeoSettingsSchema,
  insertSipCallSchema: () => insertSipCallSchema,
  insertSipPhoneNumberSchema: () => insertSipPhoneNumberSchema,
  insertSipTrunkSchema: () => insertSipTrunkSchema,
  insertSupportMessageSchema: () => insertSupportMessageSchema,
  insertSupportTicketSchema: () => insertSupportTicketSchema,
  insertSupportedLanguageSchema: () => insertSupportedLanguageSchema,
  insertSyncedVoiceSchema: () => insertSyncedVoiceSchema,
  insertTcxcCredentialSchema: () => insertTcxcCredentialSchema,
  insertToolSchema: () => insertToolSchema,
  insertTwilioCountrySchema: () => insertTwilioCountrySchema,
  insertTwilioOpenaiCallSchema: () => insertTwilioOpenaiCallSchema,
  insertUsageRecordSchema: () => insertUsageRecordSchema,
  insertUserAddressSchema: () => insertUserAddressSchema,
  insertUserIntegrationSchema: () => insertUserIntegrationSchema,
  insertUserKnowledgeStorageLimitSchema: () => insertUserKnowledgeStorageLimitSchema,
  insertUserKycDocumentSchema: () => insertUserKycDocumentSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserSmtpSettingsSchema: () => insertUserSmtpSettingsSchema,
  insertUserSubscriptionSchema: () => insertUserSubscriptionSchema,
  insertVoiceSchema: () => insertVoiceSchema,
  insertWebhookLogSchema: () => insertWebhookLogSchema,
  insertWebhookSchema: () => insertWebhookSchema,
  insertWebsiteWidgetSchema: () => insertWebsiteWidgetSchema,
  insertWidgetCallSessionSchema: () => insertWidgetCallSessionSchema,
  integrationApps: () => integrationApps,
  integrationSyncLogs: () => integrationSyncLogs,
  invoices: () => invoices,
  ivrConfigurations: () => ivrConfigurations,
  knowledgeBase: () => knowledgeBase,
  knowledgeChunks: () => knowledgeChunks,
  knowledgeEntities: () => knowledgeEntities,
  knowledgeFaqs: () => knowledgeFaqs,
  knowledgeFolders: () => knowledgeFolders,
  knowledgeGraphEdges: () => knowledgeGraphEdges,
  knowledgeGraphNodes: () => knowledgeGraphNodes,
  knowledgePipelineJobs: () => knowledgePipelineJobs,
  knowledgeProcessingQueue: () => knowledgeProcessingQueue,
  knowledgeTopicAssignments: () => knowledgeTopicAssignments,
  knowledgeTopics: () => knowledgeTopics,
  leadActivities: () => leadActivities,
  leadNotes: () => leadNotes,
  leadStages: () => leadStages,
  leads: () => leads,
  legacyWebhookDeliveries: () => legacyWebhookDeliveries,
  legacyWebhooks: () => legacyWebhooks,
  llmModels: () => llmModels,
  mlAnalysisJobs: () => mlAnalysisJobs,
  mlCommonIssues: () => mlCommonIssues,
  mlConversationAnalyses: () => mlConversationAnalyses,
  mlTrainingSamples: () => mlTrainingSamples,
  mlTrainingStats: () => mlTrainingStats,
  notifications: () => notifications,
  openaiCredentials: () => openaiCredentials,
  opsAnalysisRuns: () => opsAnalysisRuns,
  opsPriorityEnum: () => opsPriorityEnum,
  opsStatusEnum: () => opsStatusEnum,
  opsTaskTypeEnum: () => opsTaskTypeEnum,
  opsTasks: () => opsTasks,
  otpVerifications: () => otpVerifications,
  paymentTransactions: () => paymentTransactions,
  paymentWebhookQueue: () => paymentWebhookQueue,
  phoneNumberRentals: () => phoneNumberRentals,
  phoneNumbers: () => phoneNumbers,
  plans: () => plans,
  platformLanguages: () => platformLanguages,
  plivoCalls: () => plivoCalls,
  plivoCredentials: () => plivoCredentials,
  plivoPhoneNumbers: () => plivoPhoneNumbers,
  plivoPhonePricing: () => plivoPhonePricing,
  portRequests: () => portRequests,
  products: () => products,
  promptTemplates: () => promptTemplates,
  providerCallerIds: () => providerCallerIds,
  refreshTokens: () => refreshTokens,
  refunds: () => refunds,
  seoSettings: () => seoSettings,
  sipCalls: () => sipCalls,
  sipPhoneNumbers: () => sipPhoneNumbers,
  sipTrunks: () => sipTrunks,
  supportMessages: () => supportMessages,
  supportTickets: () => supportTickets,
  supportedLanguages: () => supportedLanguages,
  syncedVoices: () => syncedVoices,
  tcxcCredentials: () => tcxcCredentials,
  tools: () => tools,
  twilioCountries: () => twilioCountries,
  twilioOpenaiCalls: () => twilioOpenaiCalls,
  usageRecords: () => usageRecords,
  userAddresses: () => userAddresses,
  userIntegrations: () => userIntegrations,
  userKnowledgeStorageLimits: () => userKnowledgeStorageLimits,
  userKycDocuments: () => userKycDocuments,
  userSmtpSettings: () => userSmtpSettings,
  userSubscriptions: () => userSubscriptions,
  users: () => users,
  voices: () => voices,
  webhookDeliveryLogs: () => webhookDeliveryLogs,
  webhookLogs: () => webhookLogs,
  webhookSubscriptions: () => webhookSubscriptions,
  webhooks: () => webhooks,
  websiteWidgets: () => websiteWidgets,
  widgetCallSessions: () => widgetCallSessions
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, decimal, doublePrecision, serial, date, time, unique, real, pgEnum, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var vector = customType({
  dataType() {
    return "vector(1536)";
  },
  fromDriver(value) {
    if (!value) return null;
    return JSON.parse(value.replace("[", "[").replace("]", "]"));
  },
  toDriver(value) {
    if (!value) return null;
    return `[${value.join(",")}]`;
  }
});
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  planType: text("plan_type").notNull().default("free"),
  // 'free' or 'pro'
  planExpiresAt: timestamp("plan_expires_at"),
  credits: integer("credits").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  maxWebhooks: integer("max_webhooks").notNull().default(3),
  // Webhook subscription limit (admin can adjust)
  isDeleted: boolean("is_deleted").notNull().default(false),
  // Soft delete flag - user requested account deletion
  deletedAt: timestamp("deleted_at"),
  // When the user requested deletion
  deletedBy: varchar("deleted_by"),
  // Who deleted: 'user' for self-deletion, admin user ID for admin deletion
  // Timezone preference - IANA timezone string (e.g., "America/New_York", "Europe/London")
  timezone: text("timezone"),
  // GDPR Consent preferences
  cookieConsent: boolean("cookie_consent"),
  // Essential cookies always enabled, this tracks analytics/marketing consent
  analyticsConsent: boolean("analytics_consent"),
  marketingConsent: boolean("marketing_consent"),
  consentTimestamp: timestamp("consent_timestamp"),
  // When user gave/updated consent
  termsAcceptedAt: timestamp("terms_accepted_at"),
  // When user accepted Terms of Service
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  // When user accepted Privacy Policy
  // User blocking for content violations
  blockedReason: text("blocked_reason"),
  // Reason for blocking (e.g., "Content violation: banned words detected")
  blockedAt: timestamp("blocked_at"),
  // When the user was blocked
  blockedBy: varchar("blocked_by"),
  // Admin who blocked the user
  // ElevenLabs Multi-Key Pool Affinity - Once assigned, user's agents and phone numbers stay on this key
  elevenLabsCredentialId: varchar("eleven_labs_credential_id"),
  // References elevenLabsCredentials.id (can't use .references() due to declaration order)
  // User-level KYC for phone number purchases
  kycStatus: text("kyc_status").default("pending"),
  // pending, submitted, approved, rejected
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycApprovedAt: timestamp("kyc_approved_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  // Billing Details - Stored for payment processing and pre-filling
  billingName: text("billing_name"),
  billingAddressLine1: text("billing_address_line1"),
  billingAddressLine2: text("billing_address_line2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country"),
  company: text("company"),
  // Company name for profile and team naming
  bedrockKbId: text("bedrock_kb_id"),
  bedrockKbStatus: text("bedrock_kb_status").default("none"),
  bedrockS3Prefix: text("bedrock_s3_prefix"),
  bedrockDataSourceId: text("bedrock_data_source_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  otpCode: text("otp_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isValid: boolean("is_valid").notNull().default(true),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var elevenLabsCredentials = pgTable("eleven_labs_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // Friendly name for the key (e.g., "Primary Account", "Backup Key 1")
  apiKey: text("api_key").notNull(),
  webhookSecret: text("webhook_secret"),
  // HMAC secret for verifying webhooks from this ElevenLabs workspace (nullable for migration)
  isActive: boolean("is_active").notNull().default(true),
  maxConcurrency: integer("max_concurrency").notNull().default(30),
  // ElevenLabs default limit
  currentLoad: integer("current_load").notNull().default(0),
  // Current active calls using this key
  totalAssignedAgents: integer("total_assigned_agents").notNull().default(0),
  // How many agents use this key
  totalAssignedUsers: integer("total_assigned_users").notNull().default(0),
  // How many users are assigned to this key
  maxAgentsThreshold: integer("max_agents_threshold").notNull().default(100),
  // Soft limit before moving to next key
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").notNull().default("healthy"),
  // healthy, degraded, unhealthy
  metadata: jsonb("metadata"),
  // For storing additional info like account tier, limits, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var syncedVoices = pgTable("synced_voices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  credentialId: varchar("credential_id").notNull().references(() => elevenLabsCredentials.id, { onDelete: "cascade" }),
  voiceId: text("voice_id").notNull(),
  // ElevenLabs voice_id
  publicOwnerId: text("public_owner_id").notNull(),
  // Voice owner's public ID for API call
  voiceName: text("voice_name"),
  // Cached voice name for display
  status: text("status").notNull().default("synced"),
  // synced, failed, pending
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at").notNull().defaultNow()
}, (table) => ({
  credentialVoiceUnique: unique().on(table.credentialId, table.voiceId)
}));
var agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  elevenLabsCredentialId: varchar("eleven_labs_credential_id").references(() => elevenLabsCredentials.id, { onDelete: "set null" }),
  // Which API key this agent uses
  // Telephony Provider Configuration - Determines which engine handles calls
  // 'twilio' = ElevenLabs Conversational AI via Twilio (default)
  // 'plivo' = Plivo telephony + OpenAI Realtime API
  // 'twilio_openai' = Twilio telephony + OpenAI Realtime API
  // 'elevenlabs-sip' = ElevenLabs native SIP (user's own SIP trunk)
  // 'fonoster-openai' = Fonoster SIP + OpenAI Realtime API (user's own SIP trunk)
  telephonyProvider: text("telephony_provider").default("twilio"),
  // 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'fonoster-openai'
  // SIP Trunk Configuration (used when telephonyProvider='elevenlabs-sip' or 'fonoster-openai')
  sipTrunkId: varchar("sip_trunk_id"),
  // References sip_trunks.id for SIP-based engines
  sipPhoneNumberId: varchar("sip_phone_number_id"),
  // References sip_phone_numbers.id for SIP-based calls
  // OpenAI Realtime Configuration (used when telephonyProvider='plivo', 'twilio_openai', or 'fonoster-openai')
  openaiVoice: text("openai_voice"),
  // 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse' | 'cedar' | 'marin'
  openaiCredentialId: varchar("openai_credential_id"),
  // References openaiCredentials.id (can't use .references() due to declaration order)
  // Agent Type: Determines execution pipeline and usage
  // NO DEFAULT - must be explicitly set to prevent misconfiguration
  type: text("type").notNull(),
  // 'incoming' (ElevenLabs Conversational AI for receiving calls) or 'flow' (STT+TTS+FlowExecutionBridge for campaigns)
  // Incoming Agent Fields (used when type='incoming')
  // Incoming agents are used for receiving calls on purchased phone numbers with call transfer capability
  name: text("name").notNull(),
  voiceTone: text("voice_tone"),
  personality: text("personality"),
  systemPrompt: text("system_prompt"),
  language: text("language").default("en"),
  firstMessage: text("first_message").default("Hello! How can I help you today?"),
  llmModel: text("llm_model").default("gpt-4o-mini"),
  temperature: doublePrecision("temperature").default(0.5),
  elevenLabsAgentId: text("eleven_labs_agent_id"),
  // Call Transfer Configuration (for incoming agents)
  transferPhoneNumber: text("transfer_phone_number"),
  transferEnabled: boolean("transfer_enabled").default(false),
  transferAgentId: varchar("transfer_agent_id"),
  // ElevenLabs System Tools Configuration (for incoming agents)
  detectLanguageEnabled: boolean("detect_language_enabled").default(false),
  endConversationEnabled: boolean("end_conversation_enabled").default(false),
  appointmentBookingEnabled: boolean("appointment_booking_enabled").default(false),
  knowledgeBaseOnly: boolean("knowledge_base_only").default(false),
  // Knowledge Base (for incoming agents)
  knowledgeBaseIds: text("knowledge_base_ids").array(),
  // Shared Voice Configuration (used by both Incoming and Flow agents)
  // Voice Provider: 'elevenlabs' (default), 'aws_polly', or 'openai'
  voiceProvider: text("voice_provider").default("elevenlabs"),
  elevenLabsVoiceId: text("eleven_labs_voice_id"),
  awsPollyVoiceId: text("aws_polly_voice_id"),
  // AWS Polly voice ID (e.g., 'Joanna', 'Matthew')
  awsPollyEngine: text("aws_polly_engine").default("neural"),
  // 'standard', 'neural', 'long-form', 'generative'
  awsCredentialId: varchar("aws_credential_id"),
  // References awsCredentials.id
  voiceStability: doublePrecision("voice_stability").default(0.55),
  voiceSimilarityBoost: doublePrecision("voice_similarity_boost").default(0.85),
  voiceSpeed: doublePrecision("voice_speed").default(1),
  // Flow Agent Fields (used when type='flow')
  flowId: varchar("flow_id"),
  // Reference to flows table for Flow Agents
  maxDurationSeconds: integer("max_duration_seconds").default(600),
  // Max conversation duration in seconds (default 10 min, range 60-1800)
  // Legacy/Common Fields
  agentLink: text("agent_link"),
  config: jsonb("config"),
  isActive: boolean("is_active").notNull().default(true),
  // Template tracking - which template was this agent created from
  sourceTemplateId: varchar("source_template_id"),
  // References prompt_templates.id
  isFromTemplate: boolean("is_from_template").default(false),
  tags: text("tags").array(),
  // Searchable tags for categorization
  specialist: text("specialist"),
  // Agent specialty e.g. "Debt Collection Agent", "Insurance Quote Agent"
  avatarUrl: text("avatar_url"),
  // URL/path to agent avatar image
  reasoningMode: text("reasoning_mode").default("deep"),
  // 'quick' | 'deep' | 'expert' — controls AI reasoning depth for knowledge queries
  // Behavior Configuration — runtime-configurable flags inspired by Microsoft Call Center AI
  behaviorConfig: jsonb("behavior_config").$type(),
  // Waiting messages — sent when LLM is taking too long (soft timeout)
  waitingMessages: text("waiting_messages").array(),
  // Structured Data Schema — dynamic fields to extract during calls (like Microsoft's claim schema)
  dataSchema: jsonb("data_schema").$type(),
  // Preset tracking
  sourcePresetId: varchar("source_preset_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeFolders = pgTable("knowledge_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").default("folder"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => knowledgeFolders.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  url: text("url"),
  fileUrl: text("file_url"),
  elevenLabsDocId: text("eleven_labs_doc_id"),
  metadata: jsonb("metadata"),
  storageSize: integer("storage_size").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("building-2"),
  // Lucide icon name
  color: text("color").default("#3b82f6"),
  // Hex color for visual identification
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  flowId: varchar("flow_id"),
  // Reference to auto-generated flow for this department
  engineType: text("engine_type").notNull().default("default"),
  // 'default' for Department, 'bedrock-polly' for Deprock
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var departmentAgents = pgTable("department_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  language: text("language").notNull().default("en"),
  // ISO language code
  isPrimary: boolean("is_primary").notNull().default(false),
  // Primary agent for the department
  systemPrompt: text("system_prompt"),
  // Override system prompt for this department
  voiceTone: text("voice_tone"),
  // Override voice tone for this department
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var ivrConfigurations = pgTable("ivr_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumberId: varchar("phone_number_id").references(() => phoneNumbers.id, { onDelete: "set null" }),
  name: text("name").notNull().default("Auto Distribution"),
  isActive: boolean("is_active").notNull().default(true),
  greetingMessage: text("greeting_message"),
  // Initial IVR greeting
  voiceId: text("voice_id"),
  // Voice for IVR prompts
  voiceName: text("voice_name"),
  // Display name of the voice
  engineType: text("engine_type").notNull().default("default"),
  // 'default' for Department, 'bedrock-polly' for Deprock
  menuOptions: jsonb("menu_options").$type(),
  // IVR menu options mapping to departments
  languageOptions: jsonb("language_options").$type(),
  // Multi-language IVR options
  fallbackDepartmentId: varchar("fallback_department_id").references(() => departments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var departmentKnowledgeBases = pgTable("department_knowledge_bases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true });
var insertDepartmentAgentSchema = createInsertSchema(departmentAgents).omit({ id: true, createdAt: true });
var insertIvrConfigurationSchema = createInsertSchema(ivrConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
var incomingAgents = pgTable("incoming_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  elevenLabsCredentialId: varchar("eleven_labs_credential_id").references(() => elevenLabsCredentials.id, { onDelete: "set null" }),
  // Basic Configuration
  name: text("name").notNull(),
  elevenLabsAgentId: text("eleven_labs_agent_id").notNull(),
  // Always uses ElevenLabs Conversational AI
  elevenLabsVoiceId: text("eleven_labs_voice_id").notNull(),
  language: text("language").notNull().default("en"),
  // AI Configuration
  systemPrompt: text("system_prompt").notNull(),
  personality: text("personality").default("helpful"),
  voiceTone: text("voice_tone").default("professional"),
  firstMessage: text("first_message").notNull().default("Hello! How can I help you today?"),
  llmModel: text("llm_model").default("gpt-4o-mini"),
  temperature: doublePrecision("temperature").default(0.5),
  // Call Transfer Configuration
  transferPhoneNumber: text("transfer_phone_number"),
  // Phone number to transfer calls to
  transferEnabled: boolean("transfer_enabled").notNull().default(false),
  transferAgentId: varchar("transfer_agent_id"),
  // Business Hours Configuration
  businessHoursEnabled: boolean("business_hours_enabled").notNull().default(false),
  businessHoursStart: text("business_hours_start"),
  // Format: "09:00"
  businessHoursEnd: text("business_hours_end"),
  // Format: "17:00"
  businessDays: text("business_days").array(),
  // ["monday", "tuesday", etc.]
  businessHoursTimezone: text("business_hours_timezone").default("America/New_York"),
  afterHoursMessage: text("after_hours_message").default("Thank you for calling. We're currently closed. Please call back during business hours."),
  // Knowledge Base
  knowledgeBaseIds: text("knowledge_base_ids").array(),
  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Nullable for system pool numbers
  phoneNumber: text("phone_number").notNull().unique(),
  twilioSid: text("twilio_sid").notNull().unique(),
  elevenLabsPhoneNumberId: text("eleven_labs_phone_number_id"),
  // ElevenLabs phone_number_id for synced numbers
  elevenLabsCredentialId: varchar("eleven_labs_credential_id").references(() => elevenLabsCredentials.id, { onDelete: "set null" }),
  // Which API key this phone number uses (for multi-API key pool isolation)
  friendlyName: text("friendly_name"),
  country: text("country").notNull().default("US"),
  capabilities: jsonb("capabilities"),
  numberType: text("number_type").default("local"),
  status: text("status").notNull().default("active"),
  isSystemPool: boolean("is_system_pool").notNull().default(false),
  // For free plan numbers
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  monthlyCredits: integer("monthly_credits"),
  // Credits charged per month for user-purchased numbers
  nextBillingDate: timestamp("next_billing_date"),
  // Next date when credits will be charged
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // DEPRECATED: Use incoming_connections table instead
  assignedIncomingAgentId: varchar("assigned_incoming_agent_id").references(() => incomingAgents.id, { onDelete: "set null" })
});
var incomingConnections = pgTable("incoming_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  // Must be type='incoming'
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id, { onDelete: "cascade" }).unique(),
  // One connection per phone number
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var humanIncomingConnections = pgTable("human_incoming_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id, { onDelete: "cascade" }).unique(),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  transferNumber: text("transfer_number").notNull(),
  transferTargetType: text("transfer_target_type").notNull().default("phone"),
  ivrEnabled: boolean("ivr_enabled").notNull().default(true),
  ivrGreeting: text("ivr_greeting"),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  voiceId: text("voice_id"),
  phoneNumberId: varchar("phone_number_id").references(() => phoneNumbers.id, { onDelete: "set null" }),
  sipPhoneNumberId: varchar("sip_phone_number_id"),
  // References sip_phone_numbers.id for SIP-based campaigns (plugin)
  flowId: varchar("flow_id"),
  // Reference to visual conversation flow (mutually exclusive with script)
  name: text("name").notNull(),
  type: text("type").notNull(),
  goal: text("goal"),
  script: text("script"),
  status: text("status").notNull().default("pending"),
  totalContacts: integer("total_contacts").notNull().default(0),
  completedCalls: integer("completed_calls").notNull().default(0),
  successfulCalls: integer("successful_calls").notNull().default(0),
  failedCalls: integer("failed_calls").notNull().default(0),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
  // Campaign Time Scheduling
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  // Whether to respect time windows
  scheduleTimeStart: text("schedule_time_start"),
  // Start time in HH:MM format (e.g., "09:00")
  scheduleTimeEnd: text("schedule_time_end"),
  // End time in HH:MM format (e.g., "17:00")
  scheduleDays: text("schedule_days").array(),
  // Array of days: ["monday", "tuesday", "wednesday", etc.]
  scheduleTimezone: text("schedule_timezone").default("America/New_York"),
  // Timezone for the schedule
  // ElevenLabs Batch Calling Integration
  batchJobId: text("batch_job_id"),
  // ElevenLabs batch job ID when campaign is running
  batchJobStatus: text("batch_job_status"),
  // pending, in_progress, completed, failed, cancelled
  retryEnabled: boolean("retry_enabled").notNull().default(false),
  // Whether to auto-retry failed/no-response calls
  // Error tracking for failed campaigns
  errorMessage: text("error_message"),
  // Detailed error message when campaign fails
  errorCode: text("error_code"),
  // Error code for categorization (e.g., AGENT_NOT_SYNCED, NO_CONTACTS)
  config: jsonb("config"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  phone: text("phone").notNull(),
  email: text("email"),
  customFields: jsonb("custom_fields"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Direct user ownership for guaranteed isolation
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  // Nullable for test/manual/incoming calls
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  // Nullable for test/incoming calls
  // Agent references - either from campaign (agentId via campaigns table) or incoming call (via connection)
  incomingConnectionId: varchar("incoming_connection_id").references(() => incomingConnections.id, { onDelete: "set null" }),
  // For incoming calls
  // Website Widget reference - for calls initiated through embeddable widgets
  widgetId: varchar("widget_id"),
  // References websiteWidgets.id (added later in schema)
  // DEPRECATED: Use incomingConnectionId instead
  incomingAgentId: varchar("incoming_agent_id").references(() => incomingAgents.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number"),
  // Phone number dialed/caller (for test calls without contacts, or incoming caller)
  fromNumber: text("from_number"),
  // The phone number that initiated the call (caller ID)
  toNumber: text("to_number"),
  // The phone number that received the call (destination)
  twilioSid: text("twilio_sid"),
  elevenLabsConversationId: text("elevenlabs_conversation_id"),
  // ElevenLabs conversation ID for fetching details/recordings
  status: text("status").notNull().default("pending"),
  callDirection: text("call_direction").notNull().default("outgoing"),
  // 'incoming' or 'outgoing'
  duration: integer("duration"),
  recordingUrl: text("recording_url"),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  classification: text("classification"),
  sentiment: text("sentiment"),
  metadata: jsonb("metadata"),
  wasTransferred: boolean("was_transferred").default(false),
  // Whether call was transferred
  transferredTo: text("transferred_to"),
  // Number call was transferred to
  transferredAt: timestamp("transferred_at"),
  // When call was transferred
  channelType: text("channel_type").default("VOICE"),
  // VOICE, CHAT, SMS
  cost: decimal("cost", { precision: 10, scale: 4 }),
  endReason: text("end_reason"),
  sessionOutcome: text("session_outcome"),
  endToEndLatencyMs: integer("end_to_end_latency_ms"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  // Conversation Resumption — inspired by Microsoft Call Center AI
  resumable: boolean("resumable").default(false),
  lastDisconnectedAt: timestamp("last_disconnected_at"),
  conversationContext: jsonb("conversation_context").$type(),
  resumedFromCallId: varchar("resumed_from_call_id"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var callResponses = pgTable("call_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  // Stable key, e.g. "steady_housing"
  questionText: text("question_text").notNull(),
  answerType: text("answer_type").notNull().default("BOOLEAN"),
  // BOOLEAN, MULTISELECT, TEXT, NUMBER
  answerValue: text("answer_value").notNull(),
  // Normalized value: "yes"/"no", JSON for multiselect
  isConcern: boolean("is_concern").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var callQaAnalyses = pgTable("call_qa_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Overall Quality Scores (0-100)
  overallScore: integer("overall_score"),
  // Weighted average of all scores
  audioQualityScore: integer("audio_quality_score"),
  // Audio clarity, noise, volume
  languageScore: integer("language_score"),
  // Grammar, vocabulary, professionalism
  complianceScore: integer("compliance_score"),
  // Script adherence, required disclosures
  performanceScore: integer("performance_score"),
  // Goal achievement, efficiency
  // Resolution Tracking
  resolutionStatus: text("resolution_status"),
  // 'resolved', 'unresolved', 'partial', 'transferred'
  resolutionNotes: text("resolution_notes"),
  // Latency Metrics
  avgResponseLatency: integer("avg_response_latency"),
  // Average AI response time in ms
  maxResponseLatency: integer("max_response_latency"),
  // Maximum response time in ms
  // Issue Flags
  hasHallucinations: boolean("has_hallucinations").default(false),
  hasInterruptions: boolean("has_interruptions").default(false),
  hasNegativeSentiment: boolean("has_negative_sentiment").default(false),
  hasComplianceIssues: boolean("has_compliance_issues").default(false),
  hasKbInaccuracies: boolean("has_kb_inaccuracies").default(false),
  // Knowledge base accuracy issues
  // Detailed Diagnostics (JSON for flexibility)
  diagnostics: jsonb("diagnostics"),
  // { hallucinations: [], interruptions: [], sentimentBreakdown: {}, etc. }
  // Key Moments (timestamps of important events in the call)
  keyMoments: jsonb("key_moments"),
  // [{ timestamp: number, type: string, description: string }]
  // Transcript-level Evidence
  evidence: jsonb("evidence"),
  // [{ transcriptIndex: number, issue: string, severity: string }]
  // Analysis metadata
  analysisModel: text("analysis_model"),
  // e.g., 'gpt-4o', 'gpt-4o-mini'
  analysisVersion: text("analysis_version").default("1.0"),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertCallQaAnalysisSchema = createInsertSchema(callQaAnalyses).omit({
  id: true,
  createdAt: true
});
var creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  stripePaymentId: text("stripe_payment_id").unique(),
  // Unique constraint for idempotency
  widgetId: varchar("widget_id"),
  // For widget-originated credit deductions
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var tools = pgTable("tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var voices = pgTable("voices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  elevenLabsVoiceId: text("eleven_labs_voice_id"),
  gender: text("gender"),
  accent: text("accent"),
  tone: text("tone"),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  // 'free' or 'pro'
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  // USD price
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  // USD price
  razorpayMonthlyPrice: decimal("razorpay_monthly_price", { precision: 10, scale: 2 }),
  // INR price
  razorpayYearlyPrice: decimal("razorpay_yearly_price", { precision: 10, scale: 2 }),
  // INR price
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  // Stripe Price ID for monthly plan
  stripeYearlyPriceId: text("stripe_yearly_price_id"),
  // Stripe Price ID for yearly plan
  stripeProductId: text("stripe_product_id"),
  // Stripe Product ID
  razorpayPlanId: text("razorpay_plan_id"),
  // Razorpay Plan ID (monthly)
  razorpayYearlyPlanId: text("razorpay_yearly_plan_id"),
  // Razorpay Plan ID (yearly)
  // PayPal pricing and plan IDs
  paypalMonthlyPrice: decimal("paypal_monthly_price", { precision: 10, scale: 2 }),
  // PayPal price (supports multiple currencies)
  paypalYearlyPrice: decimal("paypal_yearly_price", { precision: 10, scale: 2 }),
  paypalProductId: text("paypal_product_id"),
  // PayPal Product ID
  paypalMonthlyPlanId: text("paypal_monthly_plan_id"),
  // PayPal Plan ID for monthly
  paypalYearlyPlanId: text("paypal_yearly_plan_id"),
  // PayPal Plan ID for yearly
  // Paystack pricing and plan codes (Africa: NGN, GHS, ZAR, KES)
  paystackMonthlyPrice: decimal("paystack_monthly_price", { precision: 10, scale: 2 }),
  paystackYearlyPrice: decimal("paystack_yearly_price", { precision: 10, scale: 2 }),
  paystackMonthlyPlanCode: text("paystack_monthly_plan_code"),
  // Paystack Plan Code for monthly
  paystackYearlyPlanCode: text("paystack_yearly_plan_code"),
  // Paystack Plan Code for yearly
  // MercadoPago pricing and plan IDs (LATAM: BRL, MXN, ARS, CLP, COP)
  mercadopagoMonthlyPrice: decimal("mercadopago_monthly_price", { precision: 10, scale: 2 }),
  mercadopagoYearlyPrice: decimal("mercadopago_yearly_price", { precision: 10, scale: 2 }),
  mercadopagoMonthlyPlanId: text("mercadopago_monthly_plan_id"),
  // MercadoPago preapproval_plan_id
  mercadopagoYearlyPlanId: text("mercadopago_yearly_plan_id"),
  maxAgents: integer("max_agents").notNull().default(1),
  maxCampaigns: integer("max_campaigns").notNull().default(1),
  maxContactsPerCampaign: integer("max_contacts_per_campaign").notNull().default(5),
  maxWebhooks: integer("max_webhooks").notNull().default(3),
  // Max webhook subscriptions
  maxKnowledgeBases: integer("max_knowledge_bases").notNull().default(5),
  // Max knowledge base items
  maxFlows: integer("max_flows").notNull().default(3),
  // Max flow automations
  maxPhoneNumbers: integer("max_phone_numbers").notNull().default(1),
  // Max rented phone numbers
  maxWidgets: integer("max_widgets").notNull().default(1),
  // Max website widgets
  includedCredits: integer("included_credits").notNull().default(0),
  defaultLlmModel: text("default_llm_model"),
  // For free plan restrictions
  canChooseLlm: boolean("can_choose_llm").notNull().default(false),
  canPurchaseNumbers: boolean("can_purchase_numbers").notNull().default(false),
  useSystemPool: boolean("use_system_pool").notNull().default(true),
  // Free plan uses system pool
  features: jsonb("features"),
  // Additional feature flags
  // SIP Engine Plugin - Plan-level access control
  sipEnabled: boolean("sip_enabled").notNull().default(false),
  maxConcurrentSipCalls: integer("max_concurrent_sip_calls").notNull().default(1),
  sipEnginesAllowed: text("sip_engines_allowed").array().default(sql`ARRAY['elevenlabs-sip']::text[]`),
  // ['elevenlabs-sip', 'fonoster-openai']
  // REST API Plugin - Plan-level access control
  restApiEnabled: boolean("rest_api_enabled").notNull().default(false),
  // Team Management Plugin - Plan-level access control
  teamManagementEnabled: boolean("team_management_enabled").notNull().default(false),
  maxTeamMembers: integer("max_team_members").notNull().default(0),
  // 0 = disabled
  maxCustomRoles: integer("max_custom_roles").notNull().default(0),
  // 0 = disabled
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var globalSettings = pgTable("global_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var llmModels = pgTable("llm_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: text("model_id").notNull().unique(),
  // e.g., 'gpt-4o-mini', 'claude-3-5-sonnet'
  name: text("name").notNull(),
  // Display name e.g., 'GPT-4o Mini (OpenAI)'
  provider: text("provider").notNull(),
  // 'openai', 'anthropic', 'google', 'elevenlabs'
  tier: text("tier").notNull(),
  // 'free' or 'pro'
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // For custom ordering in UI
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var supportedLanguages = pgTable("supported_languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  // ISO 639-1 code e.g., 'en', 'es', 'fr'
  label: text("label").notNull(),
  // Display name e.g., 'English', 'Spanish'
  providers: text("providers").notNull(),
  // 'elevenlabs', 'openai', or 'both'
  sortOrder: integer("sort_order").notNull().default(0),
  // For custom ordering in UI
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var creditPackages = pgTable("credit_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  credits: integer("credits").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // USD price
  razorpayPrice: decimal("razorpay_price", { precision: 10, scale: 2 }),
  // INR price
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  razorpayItemId: text("razorpay_item_id"),
  // Razorpay Item ID for credit package
  // PayPal credit package pricing
  paypalPrice: decimal("paypal_price", { precision: 10, scale: 2 }),
  // PayPal price
  // Paystack credit package pricing (Africa)
  paystackPrice: decimal("paystack_price", { precision: 10, scale: 2 }),
  // Paystack price
  // MercadoPago credit package pricing (LATAM)
  mercadopagoPrice: decimal("mercadopago_price", { precision: 10, scale: 2 }),
  // MercadoPago price
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("active"),
  // 'active', 'cancelled', 'expired'
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  // Unique constraint for idempotency
  razorpaySubscriptionId: text("razorpay_subscription_id").unique(),
  // Razorpay Subscription ID
  // PayPal subscription tracking
  paypalSubscriptionId: text("paypal_subscription_id").unique(),
  // PayPal Subscription ID
  // Paystack subscription tracking (Africa)
  paystackSubscriptionCode: text("paystack_subscription_code").unique(),
  // Paystack Subscription Code
  paystackCustomerCode: text("paystack_customer_code"),
  // Paystack Customer Code
  paystackEmailToken: text("paystack_email_token"),
  // Token for customer management
  // MercadoPago subscription tracking (LATAM)
  mercadopagoSubscriptionId: text("mercadopago_subscription_id").unique(),
  // MercadoPago preapproval ID
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  billingPeriod: text("billing_period").notNull().default("monthly"),
  // 'monthly' or 'yearly'
  // Admin-set per-user limit overrides (null = use plan defaults)
  overrideMaxAgents: integer("override_max_agents"),
  // Override plan's maxAgents
  overrideMaxCampaigns: integer("override_max_campaigns"),
  // Override plan's maxCampaigns
  overrideMaxContactsPerCampaign: integer("override_max_contacts_per_campaign"),
  // Override plan's maxContactsPerCampaign
  overrideMaxWebhooks: integer("override_max_webhooks"),
  // Override plan's maxWebhooks
  overrideMaxKnowledgeBases: integer("override_max_knowledge_bases"),
  // Override plan's maxKnowledgeBases
  overrideMaxFlows: integer("override_max_flows"),
  // Override plan's maxFlows
  overrideMaxPhoneNumbers: integer("override_max_phone_numbers"),
  // Override plan's maxPhoneNumbers
  overrideMaxWidgets: integer("override_max_widgets"),
  // Override plan's maxWidgets
  overrideIncludedCredits: integer("override_included_credits"),
  // Override plan's includedCredits
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var phoneNumberRentals = pgTable("phone_number_rentals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  creditsCharged: integer("credits_charged").notNull(),
  billingDate: timestamp("billing_date").notNull().defaultNow(),
  status: text("status").notNull().default("success"),
  // 'success', 'failed', 'insufficient_credits'
  transactionId: varchar("transaction_id").references(() => creditTransactions.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var usageRecords = pgTable("usage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => userSubscriptions.id, { onDelete: "cascade" }),
  callId: varchar("call_id").references(() => calls.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  minutesUsed: integer("minutes_used").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  billingStatus: text("billing_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var legacyWebhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var legacyWebhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").notNull().references(() => legacyWebhooks.id, { onDelete: "cascade" }),
  callId: varchar("call_id").references(() => calls.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  responseCode: integer("response_code"),
  responseBody: text("response_body"),
  payload: jsonb("payload").notNull(),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(1),
  lastAttemptAt: timestamp("last_attempt_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Nullable for broadcast notifications
  type: text("type").notNull(),
  // low_credits, membership_upgraded, membership_expiry, campaign_completed, campaign_failed, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  // Optional link to navigate when clicked
  icon: text("icon"),
  // Custom icon name (lucide icon name)
  displayType: text("display_type").notNull().default("bell"),
  // 'bell', 'banner', or 'both'
  priority: integer("priority").notNull().default(0),
  // For ordering banner notifications (higher = more important)
  dismissible: boolean("dismissible").notNull().default(true),
  // Whether the notification can be dismissed
  expiresAt: timestamp("expires_at"),
  // When the notification should expire (null = never)
  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  // For banner dismissals
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateType: text("template_type").notNull().unique(),
  // 'otp', 'welcome', 'low_credits', 'campaign_complete', 'membership_upgrade', etc.
  name: text("name").notNull(),
  // Display name for admin
  subject: text("subject").notNull(),
  // Email subject line with variable support
  htmlBody: text("html_body").notNull(),
  // HTML email body with variable support
  textBody: text("text_body").notNull(),
  // Plain text fallback with variable support
  variables: text("variables").array(),
  // Available variables: ['userName', 'companyName', 'code', etc.]
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var promptTemplates = pgTable("prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  // null = system template
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  // 'sales', 'support', 'appointment', 'survey', 'general', 'agent_preset'
  tags: text("tags").array(),
  // Searchable tags: ['cold-calling', 'b2b', 'healthcare', 'automation', etc.]
  systemPrompt: text("system_prompt").notNull(),
  firstMessage: text("first_message"),
  variables: text("variables").array(),
  // Available variables: ['company', 'product', 'customerName', etc.]
  suggestedVoiceTone: text("suggested_voice_tone"),
  // Recommended voice settings
  suggestedPersonality: text("suggested_personality"),
  suggestedTemperature: real("suggested_temperature"),
  // AI model temperature (0.0-1.0)
  suggestedLlmModel: text("suggested_llm_model"),
  // Recommended LLM model (gpt-4o, gpt-4o-mini, etc.)
  suggestedVoice: text("suggested_voice"),
  // Recommended voice (alloy, coral, sage, shimmer, ash, echo)
  isSystemTemplate: boolean("is_system_template").notNull().default(false),
  // System-provided templates (Staff Picks)
  isPublic: boolean("is_public").notNull().default(false),
  // Can be used by other users
  usageCount: integer("usage_count").notNull().default(0),
  // Track popularity
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var agentVersions = pgTable("agent_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  snapshot: jsonb("snapshot").notNull().$type(),
  changesSummary: text("changes_summary"),
  // Human-readable summary of what changed
  changedFields: text("changed_fields").array(),
  // Array of field names that changed
  editedBy: varchar("edited_by").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  // Optional note about why changes were made
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  // e.g., 'user.login', 'admin.user_update', 'payment.subscription_created'
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  // User who performed the action
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "set null" }),
  // User affected by the action
  resourceType: text("resource_type"),
  // e.g., 'agent', 'campaign', 'payment'
  resourceId: varchar("resource_id"),
  // ID of the affected resource
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type(),
  // Additional context
  severity: text("severity").notNull().default("info"),
  // 'info', 'warning', 'error', 'critical'
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var platformLanguages = pgTable("platform_languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  // ISO 639-1 code e.g., 'en', 'es', 'ar'
  name: text("name").notNull(),
  // Display name e.g., 'English', 'Spanish'
  nativeName: text("native_name").notNull(),
  // Native name e.g., 'English', 'Español'
  flag: text("flag"),
  // Flag emoji e.g., '🇺🇸', '🇪🇸'
  direction: text("direction").notNull().default("ltr"),
  // 'ltr' or 'rtl'
  isEnabled: boolean("is_enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  // Only one can be default
  sortOrder: integer("sort_order").notNull().default(0),
  translations: jsonb("translations").notNull().$type(),
  // Full translation keys
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true
});
var insertElevenLabsCredentialSchema = createInsertSchema(elevenLabsCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentLoad: true,
  totalAssignedAgents: true
});
var insertSyncedVoiceSchema = createInsertSchema(syncedVoices).omit({
  id: true,
  syncedAt: true
});
var insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true
});
var insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true
});
var insertIncomingAgentSchema = createInsertSchema(incomingAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true
});
var insertAgentVersionSchema = createInsertSchema(agentVersions).omit({
  id: true,
  createdAt: true
});
var insertIncomingConnectionSchema = createInsertSchema(incomingConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertHumanIncomingConnectionSchema = createInsertSchema(humanIncomingConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  completedCalls: true,
  successfulCalls: true,
  failedCalls: true
});
var insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true
});
var insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  createdAt: true
});
var insertCallResponseSchema = createInsertSchema(callResponses).omit({
  id: true,
  createdAt: true
});
var insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true
});
var insertToolSchema = createInsertSchema(tools).omit({
  id: true,
  createdAt: true
});
var insertVoiceSchema = createInsertSchema(voices).omit({
  id: true,
  createdAt: true
});
var insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertGlobalSettingsSchema = createInsertSchema(globalSettings).omit({
  id: true,
  updatedAt: true
});
var insertLlmModelSchema = createInsertSchema(llmModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertSupportedLanguageSchema = createInsertSchema(supportedLanguages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPlatformLanguageSchema = createInsertSchema(platformLanguages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCreditPackageSchema = createInsertSchema(creditPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  // Coerce number inputs to strings for decimal fields (frontend sends numbers)
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  razorpayPrice: z.union([z.string(), z.number()]).transform((v) => v != null ? String(v) : null).nullable().optional(),
  paypalPrice: z.union([z.string(), z.number()]).transform((v) => v != null ? String(v) : null).nullable().optional(),
  paystackPrice: z.union([z.string(), z.number()]).transform((v) => v != null ? String(v) : null).nullable().optional(),
  mercadopagoPrice: z.union([z.string(), z.number()]).transform((v) => v != null ? String(v) : null).nullable().optional()
});
var insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true
});
var insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true
});
var insertLegacyWebhookSchema = createInsertSchema(legacyWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertLegacyWebhookDeliverySchema = createInsertSchema(legacyWebhookDeliveries).omit({
  id: true,
  createdAt: true
});
var insertPhoneNumberRentalSchema = createInsertSchema(phoneNumberRentals).omit({
  id: true,
  createdAt: true
});
var insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
  isDismissed: true
});
var insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var twilioCountries = pgTable("twilio_countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 2 }).notNull().unique(),
  // ISO 3166-1 alpha-2 code (e.g., "US", "GB")
  name: text("name").notNull(),
  dialCode: text("dial_code").notNull(),
  // International dialing code (e.g., "+1", "+44")
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100)
  // For display ordering (popular countries first)
});
var insertTwilioCountrySchema = createInsertSchema(twilioCountries).omit({
  id: true
});
var userKnowledgeStorageLimits = pgTable("user_knowledge_storage_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  maxStorageBytes: integer("max_storage_bytes").notNull().default(20971520),
  // 20MB default per user
  usedStorageBytes: integer("used_storage_bytes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  knowledgeBaseId: varchar("knowledge_base_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  // Order within the document
  chunkText: text("chunk_text").notNull(),
  // The actual text content
  embedding: jsonb("embedding"),
  // Vector embedding as JSON array of floats
  embeddingVec: vector("embedding_vec"),
  // pgvector native column for fast cosine search
  tokenCount: integer("token_count").notNull().default(0),
  metadata: jsonb("metadata"),
  // Page number, section, source info
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var knowledgeProcessingQueue = pgTable("knowledge_processing_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  knowledgeBaseId: varchar("knowledge_base_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  // pending, processing, completed, failed
  errorMessage: text("error_message"),
  totalChunks: integer("total_chunks").default(0),
  processedChunks: integer("processed_chunks").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserKnowledgeStorageLimitSchema = createInsertSchema(userKnowledgeStorageLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).omit({
  id: true,
  embeddingVec: true,
  createdAt: true
});
var insertKnowledgeProcessingQueueSchema = createInsertSchema(knowledgeProcessingQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeFolderSchema = createInsertSchema(knowledgeFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var flows = pgTable("flows", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  nodes: jsonb("nodes").notNull().$type(),
  edges: jsonb("edges").notNull().$type(),
  agentId: varchar("agent_id"),
  voiceSettings: jsonb("voice_settings").$type(),
  executionConfig: jsonb("execution_config").$type(),
  isActive: boolean("is_active").default(true).notNull(),
  isTemplate: boolean("is_template").default(false).notNull(),
  compiledSystemPrompt: text("compiled_system_prompt"),
  compiledFirstMessage: text("compiled_first_message"),
  compiledStates: jsonb("compiled_states").$type(),
  compiledTools: jsonb("compiled_tools").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertFlowSchema = createInsertSchema(flows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  compiledSystemPrompt: true,
  compiledFirstMessage: true,
  compiledStates: true,
  compiledTools: true
});
var createFlowSchema = insertFlowSchema.omit({ userId: true });
var flowExecutions = pgTable("flow_executions", {
  id: varchar("id").primaryKey(),
  callId: varchar("call_id").notNull(),
  flowId: varchar("flow_id").notNull().references(() => flows.id),
  currentNodeId: varchar("current_node_id"),
  status: varchar("status", { length: 50 }).notNull(),
  variables: jsonb("variables").default({}).$type(),
  pathTaken: jsonb("path_taken").default([]).$type(),
  metadata: jsonb("metadata").$type(),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});
var insertFlowExecutionSchema = createInsertSchema(flowExecutions).omit({
  id: true,
  startedAt: true
});
var webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url").notNull(),
  method: varchar("method", { length: 10 }).default("POST").notNull(),
  headers: jsonb("headers").$type(),
  secret: varchar("secret", { length: 64 }).notNull(),
  authType: varchar("auth_type", { length: 50 }),
  authCredentials: jsonb("auth_credentials").$type(),
  events: jsonb("events").notNull().$type(),
  campaignIds: jsonb("campaign_ids").$type(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var webhooks = webhookSubscriptions;
var insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var createWebhookSchema = insertWebhookSchema.omit({ userId: true });
var webhookDeliveryLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  webhookId: varchar("webhook_id").references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  event: varchar("event", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  success: boolean("success").notNull(),
  httpStatus: integer("status_code"),
  responseBody: text("response_body"),
  responseTime: integer("response_time"),
  error: text("error"),
  attemptNumber: integer("attempt").default(1).notNull(),
  maxAttempts: integer("max_attempts").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var webhookLogs = webhookDeliveryLogs;
var insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true
});
var appointments = pgTable("appointments", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  callId: varchar("call_id"),
  flowId: varchar("flow_id").references(() => flows.id),
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  appointmentDate: date("appointment_date").notNull(),
  appointmentTime: time("appointment_time").notNull(),
  duration: integer("duration").notNull(),
  serviceName: varchar("service_name", { length: 255 }),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(),
  metadata: jsonb("metadata").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var createAppointmentSchema = insertAppointmentSchema.omit({ userId: true });
var appointmentSettings = pgTable("appointment_settings", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  allowOverlapping: boolean("allow_overlapping").default(false).notNull(),
  bufferMinutes: integer("buffer_minutes").default(0).notNull(),
  workingHours: jsonb("working_hours").notNull().$type(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertAppointmentSettingsSchema = createInsertSchema(appointmentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var createAppointmentSettingsSchema = insertAppointmentSettingsSchema.omit({ userId: true });
var forms = pgTable("forms", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertFormSchema = createInsertSchema(forms).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var createFormSchema = insertFormSchema.omit({ userId: true });
var formFields = pgTable("form_fields", {
  id: varchar("id").primaryKey(),
  formId: varchar("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(),
  options: jsonb("options").$type(),
  isRequired: boolean("is_required").default(true).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertFormFieldSchema = createInsertSchema(formFields).omit({
  id: true,
  createdAt: true
});
var formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey(),
  formId: varchar("form_id").notNull().references(() => forms.id),
  callId: varchar("call_id"),
  flowExecutionId: varchar("flow_execution_id").references(() => flowExecutions.id),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  responses: jsonb("responses").notNull().$type(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull()
});
var insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  submittedAt: true
});
var seoSettings = pgTable("seo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Meta Tags - Default values for pages without specific SEO
  defaultTitle: text("default_title").default("AI Calling Platform"),
  defaultDescription: text("default_description").default("Enterprise AI-powered bulk calling platform with voice agents, Twilio integration, and intelligent lead classification."),
  defaultKeywords: text("default_keywords").array().default(sql`ARRAY[]::text[]`),
  defaultOgImage: text("default_og_image").default("/og-image.png"),
  // Sitemap Configuration
  sitemapEnabled: boolean("sitemap_enabled").default(true),
  sitemapUrls: jsonb("sitemap_urls").$type().default([]),
  sitemapAutoGenerate: boolean("sitemap_auto_generate").default(true),
  // Robots.txt Configuration
  robotsEnabled: boolean("robots_enabled").default(true),
  robotsRules: jsonb("robots_rules").$type().default([
    {
      userAgent: "*",
      allow: ["/", "/pricing", "/features", "/blog", "/contact"],
      disallow: ["/app/", "/admin/", "/api/"]
    }
  ]),
  robotsCrawlDelay: integer("robots_crawl_delay").default(0),
  // Structured Data / Schema.org
  structuredDataEnabled: boolean("structured_data_enabled").default(true),
  structuredData: jsonb("structured_data").$type().default({
    organizationName: "",
    organizationUrl: "",
    organizationLogo: "/logo.png",
    organizationDescription: "AI-powered voice agents for automated calling",
    socialProfiles: [],
    contactEmail: "",
    contactPhone: ""
  }),
  // FAQ Structured Data for rich snippets
  structuredDataFaq: jsonb("structured_data_faq").$type().default([]),
  structuredDataFaqEnabled: boolean("structured_data_faq_enabled").default(false),
  // Product Structured Data for rich snippets
  structuredDataProduct: jsonb("structured_data_product").$type().default(null),
  structuredDataProductEnabled: boolean("structured_data_product_enabled").default(false),
  // Social Media Meta Tags
  twitterHandle: text("twitter_handle"),
  facebookAppId: text("facebook_app_id"),
  // Advanced Settings
  canonicalBaseUrl: text("canonical_base_url"),
  googleVerification: text("google_verification"),
  bingVerification: text("bing_verification"),
  // Audit
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertSeoSettingsSchema = createInsertSchema(seoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var analyticsScripts = pgTable("analytics_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Script Identity
  name: text("name").notNull(),
  // Display name (e.g., "Google Tag Manager", "Facebook Pixel")
  type: text("type").notNull().default("custom"),
  // 'gtm', 'ga4', 'facebook_pixel', 'linkedin', 'twitter', 'tiktok', 'hotjar', 'clarity', 'custom'
  // Script Content
  code: text("code").notNull(),
  // Legacy single code field (for backward compatibility)
  headCode: text("head_code"),
  // Code to inject in <head> section
  bodyCode: text("body_code"),
  // Code to inject after <body> tag (e.g., GTM noscript)
  // Placement Configuration - Array supports multiple placements (e.g., both head and body for some scripts like GTM)
  placement: text("placement").array().notNull().default(sql`ARRAY['head']::text[]`),
  // Array of 'head' and/or 'body' - where to inject the script
  loadPriority: integer("load_priority").notNull().default(0),
  // Higher priority = loads first (within placement group)
  // Script Attributes (for <script> tag configuration)
  async: boolean("async").default(false),
  // Add async attribute
  defer: boolean("defer").default(false),
  // Add defer attribute
  // Status
  enabled: boolean("enabled").notNull().default(true),
  // Page Scope - Control where scripts are injected
  hideOnInternalPages: boolean("hide_on_internal_pages").notNull().default(false),
  // Hide on admin/user dashboard pages
  // Notes for admin reference
  description: text("description"),
  // Audit
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertAnalyticsScriptSchema = createInsertSchema(analyticsScripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Transaction Type
  type: text("type").notNull(),
  // 'subscription' or 'credits'
  // Gateway Information
  gateway: text("gateway").notNull(),
  // 'stripe', 'razorpay', 'paypal', 'paystack', 'mercadopago'
  gatewayTransactionId: text("gateway_transaction_id"),
  // Payment intent ID, order ID, etc.
  gatewaySubscriptionId: text("gateway_subscription_id"),
  // For subscription payments
  // Amount & Currency
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  // Related Records
  planId: varchar("plan_id").references(() => plans.id, { onDelete: "set null" }),
  creditPackageId: varchar("credit_package_id").references(() => creditPackages.id, { onDelete: "set null" }),
  subscriptionId: varchar("subscription_id").references(() => userSubscriptions.id, { onDelete: "set null" }),
  // Transaction Details
  description: text("description").notNull(),
  billingPeriod: text("billing_period"),
  // 'monthly', 'yearly' for subscriptions
  creditsAwarded: integer("credits_awarded"),
  // For credit purchases
  // Status
  status: text("status").notNull().default("pending"),
  // 'pending', 'completed', 'failed', 'refunded', 'partially_refunded'
  // Invoice Reference
  invoiceId: varchar("invoice_id"),
  // Will be linked after invoice generation
  // Metadata
  metadata: jsonb("metadata"),
  // Additional gateway-specific data
  // Timestamps
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var refunds = pgTable("refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull().references(() => paymentTransactions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Refund Details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  // Gateway Information
  gateway: text("gateway").notNull(),
  // Same as original transaction
  gatewayRefundId: text("gateway_refund_id"),
  // Refund ID from gateway
  // Refund Type
  reason: text("reason").notNull(),
  // 'admin_request', 'chargeback', 'customer_request', 'duplicate', 'fraudulent'
  initiatedBy: text("initiated_by").notNull(),
  // 'admin', 'customer', 'gateway' (for chargebacks)
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "set null" }),
  // Admin who processed refund
  // Status
  status: text("status").notNull().default("pending"),
  // 'pending', 'processing', 'completed', 'failed'
  // Credits Reversal
  creditsReversed: integer("credits_reversed"),
  // Credits taken back
  // User Suspension (for chargebacks)
  userSuspended: boolean("user_suspended").notNull().default(false),
  // Notes
  adminNote: text("admin_note"),
  // Internal note from admin
  customerNote: text("customer_note"),
  // Note visible to customer
  // Metadata
  metadata: jsonb("metadata"),
  // Gateway-specific refund data
  // Refund Note PDF
  refundNoteNumber: text("refund_note_number"),
  // e.g., RN-2024-0001
  pdfUrl: text("pdf_url"),
  // URL to stored refund note PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  // Timestamps
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull().references(() => paymentTransactions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Invoice Number (human-readable)
  invoiceNumber: text("invoice_number").notNull().unique(),
  // e.g., INV-2024-00001
  // Customer Details (snapshot at time of invoice)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerAddress: text("customer_address"),
  // Invoice Details
  description: text("description").notNull(),
  lineItems: jsonb("line_items").notNull().$type(),
  // Amounts
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  // Gateway & Payment Info
  gateway: text("gateway").notNull(),
  paymentMethod: text("payment_method"),
  // 'card', 'bank_transfer', etc.
  // PDF Storage
  pdfUrl: text("pdf_url"),
  // URL to stored PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  // Status
  status: text("status").notNull().default("draft"),
  // 'draft', 'sent', 'paid', 'void'
  // Email Delivery
  emailSentAt: timestamp("email_sent_at"),
  emailSentTo: text("email_sent_to"),
  // Timestamps
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  dueAt: timestamp("due_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var paymentWebhookQueue = pgTable("payment_webhook_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Webhook Source
  gateway: text("gateway").notNull(),
  // 'stripe', 'razorpay', 'paypal', 'paystack', 'mercadopago'
  eventType: text("event_type").notNull(),
  // e.g., 'payment_intent.succeeded', 'subscription.created'
  eventId: text("event_id").notNull(),
  // Gateway's event ID for idempotency
  // Payload
  payload: jsonb("payload").notNull(),
  // Full webhook payload
  // Processing Status
  status: text("status").notNull().default("pending"),
  // 'pending', 'processing', 'completed', 'failed', 'expired'
  // Retry Information
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  // Error Tracking
  lastError: text("last_error"),
  errorHistory: jsonb("error_history").$type(),
  // Related Records (if known)
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  transactionId: varchar("transaction_id").references(() => paymentTransactions.id, { onDelete: "set null" }),
  // Timestamps
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  // 24 hours from receivedAt
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertPaymentWebhookQueueSchema = createInsertSchema(paymentWebhookQueue).omit({
  id: true,
  createdAt: true
});
var emailNotificationSettings = pgTable("email_notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Email Type
  eventType: text("event_type").notNull().unique(),
  // 'welcome', 'purchase_confirmation', 'low_credits', 'campaign_completed', etc.
  displayName: text("display_name").notNull(),
  // Human-readable name
  description: text("description"),
  // Description of when this email is sent
  // Settings
  isEnabled: boolean("is_enabled").notNull().default(true),
  // Template Reference (optional - for custom templates)
  templateId: varchar("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
  // Thresholds (for certain event types)
  thresholdValue: integer("threshold_value"),
  // e.g., credit count for low_credits alert
  // Metadata
  category: text("category").notNull().default("general"),
  // 'authentication', 'billing', 'campaigns', 'account', 'general'
  // Audit
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertEmailNotificationSettingsSchema = createInsertSchema(emailNotificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var bannedWords = pgTable("banned_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: text("word").notNull(),
  // The banned word or phrase
  category: text("category").notNull().default("general"),
  // 'profanity', 'harassment', 'hate_speech', 'threats', 'general'
  severity: text("severity").notNull().default("medium"),
  // 'low', 'medium', 'high', 'critical'
  isActive: boolean("is_active").notNull().default(true),
  autoBlock: boolean("auto_block").notNull().default(false),
  // Auto-block user when detected
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertBannedWordSchema = createInsertSchema(bannedWords).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var contentViolations = pgTable("content_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bannedWordId: varchar("banned_word_id").references(() => bannedWords.id, { onDelete: "set null" }),
  detectedWord: text("detected_word").notNull(),
  // The actual word detected
  context: text("context"),
  // Surrounding text for context
  severity: text("severity").notNull().default("medium"),
  // 'low', 'medium', 'high', 'critical'
  status: text("status").notNull().default("pending"),
  // 'pending', 'reviewed', 'dismissed', 'actioned'
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  actionTaken: text("action_taken"),
  // 'warning', 'blocked', 'dismissed', etc.
  notes: text("notes"),
  // Admin notes
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertContentViolationSchema = createInsertSchema(contentViolations).omit({
  id: true,
  createdAt: true
});
var openaiCredentials = pgTable("openai_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull(),
  modelTier: text("model_tier").notNull().default("free"),
  // 'free' (gpt-4o-mini-realtime) or 'pro' (gpt-4o-realtime)
  isActive: boolean("is_active").notNull().default(true),
  maxConcurrency: integer("max_concurrency").notNull().default(50),
  currentLoad: integer("current_load").notNull().default(0),
  totalAssignedAgents: integer("total_assigned_agents").notNull().default(0),
  totalAssignedUsers: integer("total_assigned_users").notNull().default(0),
  maxAgentsThreshold: integer("max_agents_threshold").notNull().default(100),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").notNull().default("healthy"),
  // healthy, degraded, unhealthy
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertOpenaiCredentialSchema = createInsertSchema(openaiCredentials).omit({
  id: true,
  currentLoad: true,
  totalAssignedAgents: true,
  totalAssignedUsers: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true
});
var awsCredentials = pgTable("aws_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accessKeyId: text("access_key_id").notNull(),
  secretAccessKey: text("secret_access_key").notNull(),
  region: text("region").notNull().default("us-east-1"),
  isActive: boolean("is_active").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  enabledServices: jsonb("enabled_services").$type().default({ polly: true, bedrock: true }),
  pollyVoiceEngine: text("polly_voice_engine").notNull().default("neural"),
  // standard, neural, long-form, generative
  bedrockDefaultModel: text("bedrock_default_model").default("claude-sonnet-4-6"),
  maxConcurrency: integer("max_concurrency").notNull().default(100),
  currentLoad: integer("current_load").notNull().default(0),
  totalAssignedAgents: integer("total_assigned_agents").notNull().default(0),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").notNull().default("healthy"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertAwsCredentialSchema = createInsertSchema(awsCredentials).omit({
  id: true,
  currentLoad: true,
  totalAssignedAgents: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true
});
var plivoCredentials = pgTable("plivo_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  authId: text("auth_id").notNull(),
  authToken: text("auth_token").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertPlivoCredentialSchema = createInsertSchema(plivoCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var plivoPhoneNumbers = pgTable("plivo_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  plivoCredentialId: varchar("plivo_credential_id").references(() => plivoCredentials.id, { onDelete: "set null" }),
  openaiCredentialId: varchar("openai_credential_id").references(() => openaiCredentials.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull().unique(),
  plivoNumberId: text("plivo_number_id").notNull().unique(),
  friendlyName: text("friendly_name"),
  country: text("country").notNull(),
  region: text("region"),
  numberType: text("number_type").default("local"),
  // local, toll_free, national
  capabilities: jsonb("capabilities"),
  // { voice: true, sms: true }
  status: text("status").notNull().default("active"),
  // active, pending, released, suspended
  // Pricing (admin-configured credits)
  purchaseCredits: integer("purchase_credits").notNull().default(0),
  monthlyCredits: integer("monthly_credits").notNull().default(0),
  nextBillingDate: timestamp("next_billing_date"),
  // Incoming agent connection
  assignedAgentId: varchar("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertPlivoPhoneNumberSchema = createInsertSchema(plivoPhoneNumbers).omit({
  id: true,
  purchasedAt: true,
  createdAt: true,
  updatedAt: true
});
var plivoCalls = pgTable("plivo_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  plivoPhoneNumberId: varchar("plivo_phone_number_id").references(() => plivoPhoneNumbers.id, { onDelete: "set null" }),
  openaiCredentialId: varchar("openai_credential_id").references(() => openaiCredentials.id, { onDelete: "set null" }),
  // Plivo identifiers
  plivoCallUuid: text("plivo_call_uuid").unique(),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  // OpenAI session
  openaiSessionId: text("openai_session_id"),
  openaiVoice: text("openai_voice").default("alloy"),
  openaiModel: text("openai_model").default("gpt-realtime-mini"),
  // Call status
  status: text("status").notNull().default("pending"),
  // pending, initiated, ringing, in-progress, completed, busy, failed, no-answer, canceled
  callDirection: text("call_direction").notNull().default("outbound"),
  // inbound, outbound
  duration: integer("duration"),
  // seconds
  // Recording
  recordingId: text("recording_id"),
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration"),
  // AI analysis
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  leadQualityScore: integer("lead_quality_score"),
  // 1-100
  sentiment: text("sentiment"),
  // positive, neutral, negative
  classification: text("classification"),
  // hot, warm, cold, lost
  keyPoints: jsonb("key_points"),
  // string[]
  nextActions: jsonb("next_actions"),
  // string[]
  // Call transfer
  wasTransferred: boolean("was_transferred").default(false),
  transferredTo: text("transferred_to"),
  transferredAt: timestamp("transferred_at"),
  // Timestamps
  startedAt: timestamp("started_at"),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertPlivoCallSchema = createInsertSchema(plivoCalls).omit({
  id: true,
  createdAt: true
});
var campaignJobs = pgTable("campaign_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  contactId: varchar("contact_id").notNull(),
  engine: text("engine").notNull().default("plivo"),
  // 'plivo' or 'twilio'
  status: text("status").notNull().default("pending"),
  // pending, processing, completed, failed
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  workerId: text("worker_id"),
  // For distributed processing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at")
});
var insertCampaignJobSchema = createInsertSchema(campaignJobs).omit({
  id: true,
  createdAt: true
});
var plivoPhonePricing = pgTable("plivo_phone_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull().unique(),
  // ISO 2-letter country code
  countryName: text("country_name").notNull(),
  purchaseCredits: integer("purchase_credits").notNull().default(100),
  monthlyCredits: integer("monthly_credits").notNull().default(50),
  kycRequired: boolean("kyc_required").notNull().default(false),
  // Whether KYC verification is required for this country
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertPlivoPhonePricingSchema = createInsertSchema(plivoPhonePricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var userKycDocuments = pgTable("user_kyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  // photo, company_registration, gst_certificate, authorization_letter
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow()
});
var insertUserKycDocumentSchema = createInsertSchema(userKycDocuments).omit({
  id: true,
  uploadedAt: true
});
var twilioOpenaiCalls = pgTable("twilio_openai_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  twilioPhoneNumberId: varchar("twilio_phone_number_id").references(() => phoneNumbers.id, { onDelete: "set null" }),
  openaiCredentialId: varchar("openai_credential_id").references(() => openaiCredentials.id, { onDelete: "set null" }),
  twilioCallSid: text("twilio_call_sid").unique(),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  openaiSessionId: text("openai_session_id"),
  openaiVoice: text("openai_voice").default("alloy"),
  openaiModel: text("openai_model").default("gpt-realtime"),
  status: text("status").notNull().default("pending"),
  callDirection: text("call_direction").notNull().default("outbound"),
  duration: integer("duration"),
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration"),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  leadQualityScore: integer("lead_quality_score"),
  sentiment: text("sentiment"),
  classification: text("classification"),
  keyPoints: jsonb("key_points"),
  nextActions: jsonb("next_actions"),
  wasTransferred: boolean("was_transferred").default(false),
  transferredTo: text("transferred_to"),
  transferredAt: timestamp("transferred_at"),
  startedAt: timestamp("started_at"),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertTwilioOpenaiCallSchema = createInsertSchema(twilioOpenaiCalls).omit({
  id: true,
  createdAt: true
});
var demoSessions = pgTable("demo_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: text("session_token").notNull().unique(),
  visitorIp: text("visitor_ip"),
  visitorFingerprint: text("visitor_fingerprint"),
  language: text("language").notNull().default("en"),
  voice: text("voice").notNull().default("alloy"),
  status: text("status").notNull().default("pending"),
  duration: integer("duration"),
  maxDuration: integer("max_duration").notNull().default(60),
  transcript: text("transcript"),
  openaiSessionId: text("openai_session_id"),
  openaiCredentialId: varchar("openai_credential_id").references(() => openaiCredentials.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertDemoSessionSchema = createInsertSchema(demoSessions).omit({
  id: true,
  createdAt: true
});
var leadStages = pgTable("lead_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6B7280"),
  // Hex color for stage header
  order: integer("order").notNull().default(0),
  // Display order in Kanban
  isDefault: boolean("is_default").notNull().default(false),
  // System default stages can't be deleted
  isCustom: boolean("is_custom").notNull().default(true),
  // User-created stages
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertLeadStageSchema = createInsertSchema(leadStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Source - Either from a campaign or incoming connection
  sourceType: text("source_type").notNull(),
  // 'campaign' | 'incoming'
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  incomingConnectionId: varchar("incoming_connection_id").references(() => incomingConnections.id, { onDelete: "cascade" }),
  // Contact Information
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").notNull(),
  email: text("email"),
  company: text("company"),
  customFields: jsonb("custom_fields").$type(),
  // Pipeline Status
  stageId: varchar("stage_id").references(() => leadStages.id, { onDelete: "set null" }),
  stage: text("stage").notNull().default("new"),
  // Fallback stage name: new, hot, appointment, form_submitted, follow_up, not_interested, no_answer
  // AI-Generated Insights
  leadScore: integer("lead_score"),
  // 1-100 AI-generated score
  aiSummary: text("ai_summary"),
  // AI-generated call summary
  aiNextAction: text("ai_next_action"),
  // Suggested next action
  sentiment: text("sentiment"),
  // positive, neutral, negative
  aiCategory: text("ai_category"),
  // AI-assigned category: 'warm' | 'hot' | 'appointment_booked' | 'form_submitted' | 'call_transfer' | 'need_follow_up' | null (uncategorized)
  // Tool Execution Flags - Show badges on lead card
  hasAppointment: boolean("has_appointment").notNull().default(false),
  hasFormSubmission: boolean("has_form_submission").notNull().default(false),
  hasTransfer: boolean("has_transfer").notNull().default(false),
  hasCallback: boolean("has_callback").notNull().default(false),
  // Appointment Details (if hasAppointment)
  appointmentDate: timestamp("appointment_date"),
  appointmentDetails: jsonb("appointment_details").$type(),
  // Form Submission Details (if hasFormSubmission)
  formData: jsonb("form_data").$type(),
  // Transfer Details (if hasTransfer)
  transferredTo: text("transferred_to"),
  transferredAt: timestamp("transferred_at"),
  // Callback/Follow-up Scheduling
  callbackScheduled: timestamp("callback_scheduled"),
  callbackCompleted: boolean("callback_completed").notNull().default(false),
  // Call Reference - Link to the call record
  callId: varchar("call_id").references(() => calls.id, { onDelete: "set null" }),
  plivoCallId: varchar("plivo_call_id").references(() => plivoCalls.id, { onDelete: "set null" }),
  twilioOpenaiCallId: varchar("twilio_openai_call_id").references(() => twilioOpenaiCalls.id, { onDelete: "set null" }),
  // Total calls made to this lead (for follow-ups)
  totalCalls: integer("total_calls").notNull().default(1),
  lastCallAt: timestamp("last_call_at"),
  // Tags for organization
  tags: text("tags").array(),
  // Assignment for team accounts
  assignedUserId: varchar("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var AI_LEAD_CATEGORIES = {
  WARM: "warm",
  HOT: "hot",
  APPOINTMENT_BOOKED: "appointment_booked",
  FORM_SUBMITTED: "form_submitted",
  CALL_TRANSFER: "call_transfer",
  NEED_FOLLOW_UP: "need_follow_up"
};
var AI_CATEGORY_LABELS = {
  [AI_LEAD_CATEGORIES.WARM]: "Warm Lead",
  [AI_LEAD_CATEGORIES.HOT]: "Hot Lead",
  [AI_LEAD_CATEGORIES.APPOINTMENT_BOOKED]: "Appointment Booked",
  [AI_LEAD_CATEGORIES.FORM_SUBMITTED]: "Form Submitted",
  [AI_LEAD_CATEGORIES.CALL_TRANSFER]: "Call Transfer",
  [AI_LEAD_CATEGORIES.NEED_FOLLOW_UP]: "Need Follow Up"
};
var AI_CATEGORY_COLORS = {
  [AI_LEAD_CATEGORIES.WARM]: "#F59E0B",
  [AI_LEAD_CATEGORIES.HOT]: "#EF4444",
  [AI_LEAD_CATEGORIES.APPOINTMENT_BOOKED]: "#10B981",
  [AI_LEAD_CATEGORIES.FORM_SUBMITTED]: "#3B82F6",
  [AI_LEAD_CATEGORIES.CALL_TRANSFER]: "#8B5CF6",
  [AI_LEAD_CATEGORIES.NEED_FOLLOW_UP]: "#F97316"
};
var AI_CATEGORY_PRIORITY = [
  AI_LEAD_CATEGORIES.APPOINTMENT_BOOKED,
  AI_LEAD_CATEGORIES.FORM_SUBMITTED,
  AI_LEAD_CATEGORIES.CALL_TRANSFER,
  AI_LEAD_CATEGORIES.NEED_FOLLOW_UP,
  AI_LEAD_CATEGORIES.HOT,
  AI_LEAD_CATEGORIES.WARM
];
function determineAICategory(lead) {
  if (lead.hasAppointment) return AI_LEAD_CATEGORIES.APPOINTMENT_BOOKED;
  if (lead.hasFormSubmission) return AI_LEAD_CATEGORIES.FORM_SUBMITTED;
  if (lead.hasTransfer) return AI_LEAD_CATEGORIES.CALL_TRANSFER;
  if (lead.hasCallback || lead.callbackScheduled) return AI_LEAD_CATEGORIES.NEED_FOLLOW_UP;
  if (lead.leadScore !== null && lead.leadScore !== void 0) {
    if (lead.leadScore >= 70) return AI_LEAD_CATEGORIES.HOT;
    if (lead.leadScore >= 40) return AI_LEAD_CATEGORIES.WARM;
  }
  if (lead.sentiment === "positive") return AI_LEAD_CATEGORIES.WARM;
  return null;
}
var leadNotes = pgTable("lead_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertLeadNoteSchema = createInsertSchema(leadNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Activity type: 'call' | 'note' | 'stage_change' | 'tag_added' | 'tag_removed' | 'created' | 'updated' | 'transfer' | 'appointment' | 'form_submission'
  activityType: text("activity_type").notNull(),
  // Activity details
  title: text("title").notNull(),
  // Short description: "Stage changed to Hot Lead"
  description: text("description"),
  // Longer description if needed
  // Metadata for different activity types
  metadata: jsonb("metadata").$type(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true
});
var crmCategoryPreferences = pgTable("crm_category_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Column order - array of category IDs in display order
  columnOrder: text("column_order").array().notNull().default(sql`ARRAY['warm', 'hot', 'appointment_booked', 'form_submitted', 'call_transfer', 'need_follow_up']::text[]`),
  // Color overrides - JSON object mapping category ID to hex color
  colorOverrides: jsonb("color_overrides").$type().default({}),
  // Per-column sort preferences - JSON object mapping category ID to sort preference
  columnSortPreferences: jsonb("column_sort_preferences").$type().default({}),
  // Filtering Settings
  hideLeadsWithoutPhone: boolean("hide_leads_without_phone").notNull().default(false),
  // Pipeline stage mappings - which AI categories go to which pipeline stage
  // Maps aiCategory (hot/warm/cold) to pipeline stage id or name
  categoryPipelineMappings: jsonb("category_pipeline_mappings").$type().default({}),
  // Score thresholds for lead classification
  // hot: score >= hotThreshold, warm: score >= warmThreshold, cold: score < warmThreshold
  hotScoreThreshold: integer("hot_score_threshold").default(80),
  warmScoreThreshold: integer("warm_score_threshold").default(50),
  // Hide specific classifications from view
  hiddenCategories: text("hidden_categories").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertCrmCategoryPreferencesSchema = createInsertSchema(crmCategoryPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var websiteWidgets = pgTable("website_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Basic Info
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  // active, paused, disabled
  // Agent Configuration - which AI agent powers this widget
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  agentType: text("agent_type").notNull().default("natural"),
  // natural, flow
  // Branding
  iconUrl: text("icon_url"),
  // Custom icon for the chat bubble
  iconPath: text("icon_path"),
  // File path for uploaded icon
  brandName: text("brand_name"),
  // Display name shown in widget
  buttonLabel: text("button_label").notNull().default("VOICE CHAT"),
  // Customizable button text
  primaryColor: text("primary_color").notNull().default("#3B82F6"),
  // Main color
  accentColor: text("accent_color").notNull().default("#1E40AF"),
  // Secondary color
  backgroundColor: text("background_color").notNull().default("#FFFFFF"),
  // Widget background
  textColor: text("text_color").notNull().default("#1F2937"),
  // Text color
  // Terms & Conditions
  requireTermsAcceptance: boolean("require_terms_acceptance").notNull().default(false),
  // Show terms checkbox before call
  // Widget Text Content
  welcomeMessage: text("welcome_message").notNull().default("Hi! Click to start a voice conversation."),
  launcherText: text("launcher_text").notNull().default("Talk to us"),
  offlineMessage: text("offline_message").notNull().default("We're currently unavailable. Please try again later."),
  lowCreditsMessage: text("low_credits_message").notNull().default("Service temporarily unavailable."),
  // Domain Whitelisting
  allowedDomains: text("allowed_domains").array().notNull().default(sql`ARRAY[]::text[]`),
  // Empty = allow all
  // Business Hours
  businessHoursEnabled: boolean("business_hours_enabled").notNull().default(false),
  businessHoursStart: text("business_hours_start").default("09:00"),
  // HH:MM format
  businessHoursEnd: text("business_hours_end").default("17:00"),
  // HH:MM format
  businessDays: text("business_days").array().default(sql`ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::text[]`),
  businessTimezone: text("business_timezone").default("America/New_York"),
  // Call Limits & Abuse Prevention
  maxConcurrentCalls: integer("max_concurrent_calls").notNull().default(5),
  maxCallDuration: integer("max_call_duration").notNull().default(300),
  // seconds (5 minutes default)
  cooldownMinutes: integer("cooldown_minutes").notNull().default(0),
  // minutes between calls per IP (0 = no cooldown)
  // Appointment Booking
  appointmentBookingEnabled: boolean("appointment_booking_enabled").notNull().default(false),
  // Embed Token - used to identify widget in public API
  embedToken: text("embed_token").notNull().unique(),
  // Analytics
  totalCalls: integer("total_calls").notNull().default(0),
  totalMinutes: integer("total_minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertWebsiteWidgetSchema = createInsertSchema(websiteWidgets).omit({
  id: true,
  totalCalls: true,
  totalMinutes: true,
  createdAt: true,
  updatedAt: true
});
var widgetCallSessions = pgTable("widget_call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  widgetId: varchar("widget_id").notNull().references(() => websiteWidgets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Session Info
  sessionToken: text("session_token").notNull().unique(),
  visitorIp: text("visitor_ip"),
  visitorDomain: text("visitor_domain"),
  // Domain where widget is embedded
  // Call State
  status: text("status").notNull().default("pending"),
  // pending, connecting, active, completed, failed
  duration: integer("duration"),
  // seconds
  creditsUsed: integer("credits_used").default(0),
  // Recording & Transcript
  recordingUrl: text("recording_url"),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  sentiment: text("sentiment"),
  // OpenAI Realtime connection
  openaiSessionId: text("openai_session_id"),
  openaiCredentialId: varchar("openai_credential_id"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertWidgetCallSessionSchema = createInsertSchema(widgetCallSessions).omit({
  id: true,
  createdAt: true
});
var API_SCOPES = {
  // Read scopes
  "calls:read": "View call history and details",
  "campaigns:read": "View campaigns",
  "agents:read": "View agents",
  "contacts:read": "View contacts",
  "knowledge:read": "View knowledge bases",
  "phone-numbers:read": "View phone numbers",
  "webhooks:read": "View webhook subscriptions",
  "credits:read": "View credit balance and usage",
  "analytics:read": "View analytics data",
  // Write scopes
  "calls:write": "Trigger and manage calls",
  "campaigns:write": "Create and manage campaigns",
  "agents:write": "Create and manage agents",
  "contacts:write": "Create and manage contacts",
  "knowledge:write": "Upload knowledge base documents",
  "phone-numbers:write": "Purchase and assign phone numbers",
  "webhooks:write": "Manage webhook subscriptions",
  // Admin scopes
  "admin": "Full administrative access"
};
var apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Key identification
  name: text("name").notNull(),
  // User-friendly name: "Production Key", "CRM Integration"
  keyPrefix: text("key_prefix").notNull(),
  // First 8 chars of key for identification: "agl_1234..."
  hashedSecret: text("hashed_secret").notNull(),
  // bcrypt hash of the secret key
  // Permissions
  scopes: text("scopes").array().notNull().default(sql`ARRAY['calls:read', 'calls:write', 'campaigns:read', 'contacts:read']::text[]`),
  // Rate limiting
  rateLimit: integer("rate_limit").notNull().default(100),
  // Requests per minute
  rateLimitWindow: integer("rate_limit_window").notNull().default(60),
  // Window in seconds
  // Security
  ipWhitelist: text("ip_whitelist").array().default(sql`ARRAY[]::text[]`),
  // Empty = allow all
  expiresAt: timestamp("expires_at"),
  // Optional expiration
  // Status
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: text("last_used_ip"),
  totalRequests: integer("total_requests").notNull().default(0),
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  lastUsedAt: true,
  lastUsedIp: true,
  totalRequests: true,
  createdAt: true,
  updatedAt: true
});
var apiAuditLogs = pgTable("api_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  // Request details
  method: text("method").notNull(),
  // GET, POST, PUT, DELETE
  endpoint: text("endpoint").notNull(),
  // /v1/calls, /v1/campaigns/:id
  path: text("path").notNull(),
  // Full path with params: /v1/campaigns/abc-123
  // Request info
  requestBody: jsonb("request_body"),
  // Sanitized request body (no secrets)
  queryParams: jsonb("query_params"),
  // Response info
  statusCode: integer("status_code").notNull(),
  responseTime: integer("response_time"),
  // Milliseconds
  errorMessage: text("error_message"),
  // Client info
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Correlation
  requestId: text("request_id").notNull(),
  // Unique ID for request tracing
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertApiAuditLogSchema = createInsertSchema(apiAuditLogs).omit({
  id: true,
  createdAt: true
});
var apiRateLimits = pgTable("api_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var fonosterCredentials = pgTable("fonoster_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accessKeyId: text("access_key_id").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  apiSecretEncrypted: text("api_secret_encrypted").notNull(),
  endpoint: text("endpoint"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertFonosterCredentialSchema = createInsertSchema(fonosterCredentials).omit({
  id: true,
  healthStatus: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true
});
var tcxcCredentials = pgTable("tcxc_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  apiLogin: text("api_login").notNull(),
  apiKey: text("api_key").notNull(),
  apiEndpoint: text("api_endpoint").default("https://api.telecomxchange.com"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  // Tech prefixes for interconnection routing (e.g., "73297#")
  techPrefixes: text("tech_prefixes").array().default(sql`ARRAY[]::text[]`),
  // Connection type: 'tcxc' for TCXC API, 'softswitch' for direct softswitch
  connectionType: text("connection_type").default("tcxc"),
  // SIP server details for direct softswitch connections
  sipServer: text("sip_server"),
  sipPort: integer("sip_port").default(5060),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertTcxcCredentialSchema = createInsertSchema(tcxcCredentials).omit({
  id: true,
  healthStatus: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true
});
var providerCallerIds = pgTable("provider_caller_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: varchar("credential_id").notNull().references(() => tcxcCredentials.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  providerName: text("provider_name").notNull(),
  // e.g., "AirTel", "Mobily", "Tonerro"
  techPrefix: text("tech_prefix").notNull(),
  // e.g., "73297#"
  country: text("country").notNull().default("Unknown"),
  countryCode: text("country_code"),
  // e.g., "SA", "AE", "US"
  numberType: text("number_type").default("voice"),
  // 'voice' | 'sms' | 'both'
  status: text("status").notNull().default("active"),
  // 'active' | 'inactive'
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertProviderCallerIdSchema = createInsertSchema(providerCallerIds).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var sipTrunks = pgTable("sip_trunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  engine: text("engine").notNull(),
  // 'elevenlabs-sip' | 'openai-sip'
  provider: text("provider").notNull().default("generic"),
  // SIP provider: twilio, plivo, telnyx, vonage, exotel, bandwidth, didww, zadarma, cloudonix, ringcentral, sinch, infobip, generic
  sipHost: text("sip_host").notNull(),
  sipPort: integer("sip_port").notNull().default(5060),
  transport: text("transport").notNull().default("tls"),
  // 'udp' | 'tcp' | 'tls' - used for OUTBOUND
  mediaEncryption: text("media_encryption").notNull().default("require"),
  // 'require' | 'prefer' | 'none'
  // Inbound-specific settings (for receiving calls from provider to ElevenLabs)
  // These can differ from outbound settings - e.g., Twilio uses TCP:5060 for inbound but TLS:5061 for outbound
  inboundTransport: text("inbound_transport").default("tcp"),
  // 'udp' | 'tcp' | 'tls' - used for INBOUND
  inboundPort: integer("inbound_port").default(5060),
  // Port for inbound SIP (ElevenLabs listens on this)
  codecsAllowed: text("codecs_allowed").array().default(sql`ARRAY['PCMU', 'PCMA']::text[]`),
  username: text("username"),
  password: text("password"),
  // Stored encrypted at application layer
  realm: text("realm"),
  registrarHost: text("registrar_host"),
  externalElevenLabsId: text("external_elevenlabs_id"),
  externalFonosterTrunkId: text("external_fonoster_trunk_id"),
  fonosterCredentialId: varchar("fonoster_credential_id").references(() => fonosterCredentials.id),
  isActive: boolean("is_active").notNull().default(true),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertSipTrunkSchema = createInsertSchema(sipTrunks).omit({
  id: true,
  healthStatus: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true
});
var sipPhoneNumbers = pgTable("sip_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sipTrunkId: varchar("sip_trunk_id").notNull().references(() => sipTrunks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  label: text("label"),
  engine: text("engine").notNull(),
  // Inherited from trunk: 'elevenlabs-sip' | 'fonoster-openai'
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  inboundEnabled: boolean("inbound_enabled").notNull().default(true),
  outboundEnabled: boolean("outbound_enabled").notNull().default(true),
  externalElevenLabsPhoneId: text("external_elevenlabs_phone_id"),
  externalFonosterPhoneId: text("external_fonoster_phone_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertSipPhoneNumberSchema = createInsertSchema(sipPhoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var sipCalls = pgTable("sip_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sipPhoneNumberId: varchar("sip_phone_number_id").notNull().references(() => sipPhoneNumbers.id),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  direction: text("direction").notNull(),
  // 'inbound' | 'outbound'
  engine: text("engine").notNull(),
  // 'elevenlabs-sip' | 'fonoster-openai'
  toNumber: text("to_number"),
  fromNumber: text("from_number"),
  externalCallId: text("external_call_id"),
  status: text("status").notNull().default("initiated"),
  durationSeconds: integer("duration_seconds"),
  transcriptJson: jsonb("transcript_json"),
  conversationData: jsonb("conversation_data"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertSipCallSchema = createInsertSchema(sipCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var portRequests = pgTable("port_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  countryCode: text("country_code").notNull(),
  currentCarrier: text("current_carrier").notNull(),
  accountNumber: text("account_number"),
  accountPin: text("account_pin"),
  authorizedName: text("authorized_name").notNull(),
  companyName: text("company_name"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  loaText: text("loa_text"),
  supportingDocUrl: text("supporting_doc_url"),
  status: text("status").notNull().default("draft"),
  adminNotes: text("admin_notes"),
  requestedPortDate: timestamp("requested_port_date"),
  completedAt: timestamp("completed_at"),
  twilioPortSid: text("twilio_port_sid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertPortRequestSchema = createInsertSchema(portRequests).omit({
  id: true,
  loaText: true,
  status: true,
  adminNotes: true,
  completedAt: true,
  twilioPortSid: true,
  createdAt: true,
  updatedAt: true
});
var userAddresses = pgTable("user_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Address details
  customerName: text("customer_name").notNull(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  // State/Province
  postalCode: text("postal_code").notNull(),
  isoCountry: text("iso_country").notNull(),
  // ISO 3166-1 alpha-2 country code (e.g., AU, GB, DE)
  // Twilio integration
  twilioAddressSid: text("twilio_address_sid"),
  // Twilio Address SID after creation
  // Status tracking
  status: text("status").notNull().default("pending"),
  // pending, submitted, verified, rejected
  verificationStatus: text("verification_status"),
  // Twilio's verification status
  validationStatus: text("validation_status"),
  // Twilio's validation status
  rejectionReason: text("rejection_reason"),
  // Reason if rejected
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserAddressSchema = createInsertSchema(userAddresses).omit({
  id: true,
  twilioAddressSid: true,
  status: true,
  verificationStatus: true,
  validationStatus: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true
});
var crawlJobs = pgTable("crawl_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => knowledgeFolders.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  startUrl: text("start_url").notNull(),
  crawlType: text("crawl_type").notNull().default("single"),
  // single, sitemap, recursive
  maxPages: integer("max_pages").notNull().default(50),
  maxDepth: integer("max_depth").notNull().default(3),
  respectRobotsTxt: boolean("respect_robots_txt").notNull().default(true),
  includePaths: text("include_paths").array(),
  // URL patterns to include
  excludePaths: text("exclude_paths").array(),
  // URL patterns to exclude
  status: text("status").notNull().default("pending"),
  // pending, running, completed, failed, paused
  pagesDiscovered: integer("pages_discovered").notNull().default(0),
  pagesCrawled: integer("pages_crawled").notNull().default(0),
  pagesProcessed: integer("pages_processed").notNull().default(0),
  errorMessage: text("error_message"),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  scheduleInterval: text("schedule_interval"),
  // daily, weekly, monthly
  lastCrawledAt: timestamp("last_crawled_at"),
  nextCrawlAt: timestamp("next_crawl_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var crawlPages = pgTable("crawl_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crawlJobId: varchar("crawl_job_id").notNull().references(() => crawlJobs.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").references(() => knowledgeBase.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url"),
  title: text("title"),
  depth: integer("depth").notNull().default(0),
  status: text("status").notNull().default("pending"),
  // pending, fetched, processed, failed, skipped
  httpStatus: integer("http_status"),
  contentType: text("content_type"),
  contentHash: text("content_hash"),
  // MD5 hash for change detection
  etag: text("etag"),
  // HTTP ETag for change detection
  lastModified: text("last_modified"),
  // HTTP Last-Modified header
  rawHtml: text("raw_html"),
  // Original HTML content
  cleanText: text("clean_text"),
  // Cleaned text after boilerplate removal
  structureData: jsonb("structure_data").$type(),
  language: text("language"),
  wordCount: integer("word_count").default(0),
  errorMessage: text("error_message"),
  fetchedAt: timestamp("fetched_at"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var knowledgeEntities = pgTable("knowledge_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").references(() => knowledgeBase.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  // person, organization, product, feature, concept, location, date
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  // Lowercase, trimmed for deduplication
  description: text("description"),
  aliases: text("aliases").array(),
  attributes: jsonb("attributes"),
  // Key-value pairs for entity attributes
  confidence: doublePrecision("confidence").default(1),
  sourceChunkIds: text("source_chunk_ids").array(),
  // References to chunks where entity was found
  mentionCount: integer("mention_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeTopics = pgTable("knowledge_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  parentTopicId: varchar("parent_topic_id").references(() => knowledgeTopics.id, { onDelete: "set null" }),
  level: integer("level").notNull().default(0),
  // Hierarchy level (0 = root)
  keywords: text("keywords").array(),
  embedding: jsonb("embedding"),
  // Topic centroid embedding
  documentCount: integer("document_count").notNull().default(0),
  isAutoGenerated: boolean("is_auto_generated").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeTopicAssignments = pgTable("knowledge_topic_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => knowledgeTopics.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  relevanceScore: doublePrecision("relevance_score").default(1),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var knowledgeFaqs = pgTable("knowledge_faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").references(() => knowledgeBase.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sourceUrl: text("source_url"),
  sourceChunkId: varchar("source_chunk_id").references(() => knowledgeChunks.id, { onDelete: "set null" }),
  confidence: doublePrecision("confidence").default(1),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: varchar("verified_by").references(() => users.id, { onDelete: "set null" }),
  usageCount: integer("usage_count").notNull().default(0),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeGraphNodes = pgTable("knowledge_graph_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityId: varchar("entity_id").references(() => knowledgeEntities.id, { onDelete: "cascade" }),
  nodeType: text("node_type").notNull(),
  // entity, concept, document, claim
  label: text("label").notNull(),
  properties: jsonb("properties"),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var knowledgeGraphEdges = pgTable("knowledge_graph_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceNodeId: varchar("source_node_id").notNull().references(() => knowledgeGraphNodes.id, { onDelete: "cascade" }),
  targetNodeId: varchar("target_node_id").notNull().references(() => knowledgeGraphNodes.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  // is_a, has_part, related_to, mentions, supports, contradicts
  label: text("label"),
  weight: doublePrecision("weight").default(1),
  properties: jsonb("properties"),
  sourceChunkId: varchar("source_chunk_id").references(() => knowledgeChunks.id, { onDelete: "set null" }),
  confidence: doublePrecision("confidence").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var generatedArticles = pgTable("generated_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => knowledgeFolders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content").notNull(),
  contentHtml: text("content_html"),
  summary: text("summary"),
  articleType: text("article_type").notNull().default("article"),
  // article, faq, battlecard, one_pager, compliance_doc
  topicId: varchar("topic_id").references(() => knowledgeTopics.id, { onDelete: "set null" }),
  sourceKnowledgeBaseIds: text("source_knowledge_base_ids").array(),
  sourceChunkIds: text("source_chunk_ids").array(),
  citations: jsonb("citations").$type(),
  status: text("status").notNull().default("draft"),
  // draft, review, published, archived
  seoScore: integer("seo_score"),
  readabilityScore: integer("readability_score"),
  llmModel: text("llm_model"),
  generationPrompt: text("generation_prompt"),
  editorialNotes: text("editorial_notes"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var contentAuditLog = pgTable("content_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  // crawl, parse, extract, generate, edit, publish, delete
  resourceType: text("resource_type").notNull(),
  // crawl_job, crawl_page, knowledge_base, entity, article
  resourceId: varchar("resource_id").notNull(),
  details: jsonb("details"),
  sourceResourceType: text("source_resource_type"),
  sourceResourceId: varchar("source_resource_id"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var knowledgePipelineJobs = pgTable("knowledge_pipeline_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  crawlJobId: varchar("crawl_job_id").references(() => crawlJobs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  // pending, crawling, analyzing, generating, completed, failed
  currentStage: text("current_stage").notNull().default("crawling"),
  // crawling, analyzing, generating
  overallProgress: integer("overall_progress").notNull().default(0),
  // 0-100
  stageProgress: integer("stage_progress").notNull().default(0),
  // 0-100 for current stage
  estimatedTimeRemaining: integer("estimated_time_remaining"),
  // seconds
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  stageDetails: jsonb("stage_details").$type(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertCrawlJobSchema = createInsertSchema(crawlJobs).omit({
  id: true,
  pagesDiscovered: true,
  pagesCrawled: true,
  pagesProcessed: true,
  status: true,
  errorMessage: true,
  lastCrawledAt: true,
  nextCrawlAt: true,
  createdAt: true,
  updatedAt: true
});
var insertCrawlPageSchema = createInsertSchema(crawlPages).omit({
  id: true,
  status: true,
  httpStatus: true,
  contentHash: true,
  etag: true,
  lastModified: true,
  rawHtml: true,
  cleanText: true,
  structureData: true,
  language: true,
  wordCount: true,
  errorMessage: true,
  fetchedAt: true,
  processedAt: true,
  createdAt: true
});
var insertKnowledgeEntitySchema = createInsertSchema(knowledgeEntities).omit({
  id: true,
  mentionCount: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeTopicSchema = createInsertSchema(knowledgeTopics).omit({
  id: true,
  documentCount: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeFaqSchema = createInsertSchema(knowledgeFaqs).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeGraphNodeSchema = createInsertSchema(knowledgeGraphNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertKnowledgeGraphEdgeSchema = createInsertSchema(knowledgeGraphEdges).omit({
  id: true,
  createdAt: true
});
var insertGeneratedArticleSchema = createInsertSchema(generatedArticles).omit({
  id: true,
  status: true,
  seoScore: true,
  readabilityScore: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true
});
var insertContentAuditLogSchema = createInsertSchema(contentAuditLog).omit({
  id: true,
  createdAt: true
});
var insertKnowledgePipelineJobSchema = createInsertSchema(knowledgePipelineJobs).omit({
  id: true,
  status: true,
  currentStage: true,
  overallProgress: true,
  stageProgress: true,
  estimatedTimeRemaining: true,
  startedAt: true,
  completedAt: true,
  errorMessage: true,
  stageDetails: true,
  createdAt: true,
  updatedAt: true
});
var mlAnalysisJobs = pgTable("ml_analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  // pending, processing, completed, failed
  totalCalls: integer("total_calls").notNull().default(0),
  processedCalls: integer("processed_calls").notNull().default(0),
  issuesFound: integer("issues_found").notNull().default(0),
  trainingSamplesCreated: integer("training_samples_created").notNull().default(0),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var mlConversationAnalyses = pgTable("ml_conversation_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  callId: varchar("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  analysisJobId: varchar("analysis_job_id").references(() => mlAnalysisJobs.id, { onDelete: "set null" }),
  // Analysis Results
  sentiment: text("sentiment"),
  // positive, negative, neutral, mixed
  sentimentScore: real("sentiment_score"),
  // -1 to 1 score
  issuesDetected: jsonb("issues_detected"),
  // Array of { issue: string, severity: string, context: string }
  keyTopics: jsonb("key_topics"),
  // Array of extracted topics/themes
  customerIntent: text("customer_intent"),
  // What the customer was trying to achieve
  resolutionStatus: text("resolution_status"),
  // resolved, unresolved, escalated, transferred
  agentPerformance: jsonb("agent_performance"),
  // { helpfulness: number, clarity: number, empathy: number }
  // Extracted data for training
  questionAnswerPairs: jsonb("question_answer_pairs"),
  // Array of { question: string, answer: string, quality: number }
  suggestedImprovements: jsonb("suggested_improvements"),
  // Array of improvement suggestions
  // Metadata
  transcriptLength: integer("transcript_length"),
  callDuration: integer("call_duration"),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var mlCommonIssues = pgTable("ml_common_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Issue Details
  issueName: text("issue_name").notNull(),
  description: text("description"),
  category: text("category"),
  // billing, technical, product, service, general
  severity: text("severity").notNull().default("medium"),
  // low, medium, high, critical
  // Statistics
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  // Resolution
  suggestedResponse: text("suggested_response"),
  knowledgeBaseLink: varchar("knowledge_base_link"),
  resolutionRate: real("resolution_rate"),
  // 0-100 percentage of times this issue was resolved
  // AI Training
  isTrainingApproved: boolean("is_training_approved").default(false),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var mlTrainingSamples = pgTable("ml_training_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceCallId: varchar("source_call_id").references(() => calls.id, { onDelete: "set null" }),
  commonIssueId: varchar("common_issue_id").references(() => mlCommonIssues.id, { onDelete: "set null" }),
  // Training Content
  sampleType: text("sample_type").notNull(),
  // qa_pair, issue_resolution, greeting, objection_handling, closing
  inputText: text("input_text").notNull(),
  // Customer query/question
  outputText: text("output_text").notNull(),
  // Ideal AI response
  context: text("context"),
  // Additional context for the interaction
  // Quality & Approval
  qualityScore: real("quality_score"),
  // 0-100 AI-assessed quality
  status: text("status").notNull().default("pending"),
  // pending, approved, rejected, used
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  // Usage Tracking
  usedInTrainingAt: timestamp("used_in_training_at"),
  trainingBatchId: varchar("training_batch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var mlTrainingStats = pgTable("ml_training_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Overall Stats
  totalCallsAnalyzed: integer("total_calls_analyzed").notNull().default(0),
  totalIssuesDiscovered: integer("total_issues_discovered").notNull().default(0),
  totalTrainingSamples: integer("total_training_samples").notNull().default(0),
  approvedSamples: integer("approved_samples").notNull().default(0),
  // Performance Metrics
  averageSentimentScore: real("average_sentiment_score"),
  resolutionRate: real("resolution_rate"),
  topIssueCategories: jsonb("top_issue_categories"),
  // Array of { category: string, count: number }
  // AI Improvement Tracking
  baselineAccuracy: real("baseline_accuracy"),
  // Initial AI performance
  currentAccuracy: real("current_accuracy"),
  // Current AI performance after training
  improvementPercentage: real("improvement_percentage"),
  lastTrainingDate: timestamp("last_training_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertMlAnalysisJobSchema = createInsertSchema(mlAnalysisJobs).omit({
  id: true,
  status: true,
  processedCalls: true,
  issuesFound: true,
  trainingSamplesCreated: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true
});
var insertMlConversationAnalysisSchema = createInsertSchema(mlConversationAnalyses).omit({
  id: true,
  analyzedAt: true,
  createdAt: true
});
var insertMlCommonIssueSchema = createInsertSchema(mlCommonIssues).omit({
  id: true,
  occurrenceCount: true,
  firstSeenAt: true,
  lastSeenAt: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true
});
var insertMlTrainingSampleSchema = createInsertSchema(mlTrainingSamples).omit({
  id: true,
  reviewedAt: true,
  usedInTrainingAt: true,
  createdAt: true,
  updatedAt: true
});
var insertMlTrainingStatsSchema = createInsertSchema(mlTrainingStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var integrationApps = pgTable("integration_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category"),
  logoUrl: text("logo_url"),
  n8nNodeType: text("n8n_node_type").notNull(),
  isPopular: boolean("is_popular").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var userIntegrations = pgTable("user_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("app_id").notNull().references(() => integrationApps.id, { onDelete: "cascade" }),
  n8nWorkflowId: text("n8n_workflow_id").notNull(),
  n8nCredentialId: text("n8n_credential_id").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  status: text("status").notNull().default("inactive"),
  config: jsonb("config"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var integrationSyncLogs = pgTable("integration_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull().references(() => userIntegrations.id, { onDelete: "cascade" }),
  n8nExecutionId: text("n8n_execution_id"),
  eventType: text("event_type"),
  status: text("status"),
  recordsSynced: integer("records_synced").notNull().default(0),
  errorMessage: text("error_message"),
  executionDurationMs: integer("execution_duration_ms"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertIntegrationAppSchema = createInsertSchema(integrationApps).omit({
  id: true,
  createdAt: true
});
var insertUserIntegrationSchema = createInsertSchema(userIntegrations).omit({
  id: true,
  status: true,
  lastSyncAt: true,
  createdAt: true
});
var insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogs).omit({
  id: true,
  createdAt: true
});
var callerMemory = pgTable("caller_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  factKey: text("fact_key").notNull(),
  factValue: text("fact_value").notNull(),
  category: text("category").notNull().default("general"),
  confidence: doublePrecision("confidence").notNull().default(0.8),
  source: text("source").notNull().default("call_transcript"),
  callId: varchar("call_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertCallerMemorySchema = createInsertSchema(callerMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var agentPresets = pgTable("agent_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  // 'insurance', 'it_support', 'healthcare', 'sales', 'customer_service', 'real_estate'
  description: text("description").notNull(),
  iconName: text("icon_name").notNull().default("bot"),
  // Lucide icon name
  systemPrompt: text("system_prompt").notNull(),
  task: text("task").notNull(),
  firstMessage: text("first_message"),
  claimSchema: jsonb("claim_schema").$type(),
  languageConfig: jsonb("language_config").$type(),
  behaviorRules: jsonb("behavior_rules").$type(),
  waitingMessages: text("waiting_messages").array(),
  suggestedVoice: text("suggested_voice"),
  suggestedModel: text("suggested_model"),
  suggestedTemperature: doublePrecision("suggested_temperature").default(0.7),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertAgentPresetSchema = createInsertSchema(agentPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var generatedUseCases = pgTable("generated_use_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertGeneratedUseCaseSchema = createInsertSchema(generatedUseCases).omit({
  id: true,
  createdAt: true
});
var bedrockKbFiles = pgTable("bedrock_kb_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  knowledgeBaseId: varchar("knowledge_base_id").references(() => knowledgeBase.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  mimeType: text("mime_type").notNull(),
  s3Key: text("s3_key").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  status: text("status").notNull().default("uploading"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertBedrockKbFileSchema = createInsertSchema(bedrockKbFiles).omit({
  id: true,
  createdAt: true
});
var callErrorLogs = pgTable("call_error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  engineType: text("engine_type").notNull(),
  errorCategory: text("error_category").notNull(),
  severity: text("severity").notNull().default("error"),
  message: text("message").notNull(),
  latencyMs: integer("latency_ms"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertCallErrorLogSchema = createInsertSchema(callErrorLogs).omit({
  id: true,
  createdAt: true
});
var opsTaskTypeEnum = pgEnum("ops_task_type", ["refund", "callback", "followup", "escalation", "other"]);
var opsPriorityEnum = pgEnum("ops_priority", ["high", "medium", "low"]);
var opsStatusEnum = pgEnum("ops_status", ["pending", "in_progress", "completed", "cancelled"]);
var opsTasks = pgTable("ops_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  callId: varchar("call_id"),
  trackingSerial: text("tracking_serial"),
  title: text("title").notNull(),
  description: text("description"),
  taskType: opsTaskTypeEnum("task_type").notNull().default("other"),
  priority: opsPriorityEnum("priority").notNull().default("medium"),
  status: opsStatusEnum("status").notNull().default("pending"),
  assignedTo: text("assigned_to"),
  dueDate: timestamp("due_date"),
  intent: text("intent"),
  entities: jsonb("entities").$type(),
  sourceExcerpt: text("source_excerpt"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertOpsTaskSchema = createInsertSchema(opsTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var opsAnalysisRuns = pgTable("ops_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  callId: varchar("call_id").notNull(),
  tasksCreated: integer("tasks_created").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  uniqueUserCall: unique().on(table.userId, table.callId)
}));
var insertOpsAnalysisRunSchema = createInsertSchema(opsAnalysisRuns).omit({
  id: true,
  createdAt: true
});
var products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  category: text("category"),
  sku: text("sku"),
  availability: text("availability").notNull().default("in_stock"),
  // in_stock, out_of_stock, pre_order
  productUrl: text("product_url"),
  // Link to e-commerce store product page
  features: jsonb("features").$type(),
  metadata: jsonb("metadata").$type(),
  ragKnowledgeBaseId: varchar("rag_knowledge_base_id"),
  // Links to knowledge_base entry for RAG sync
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ragKnowledgeBaseId: true
});
var userSmtpSettings = pgTable("user_smtp_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpUsername: text("smtp_username").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserSmtpSettingsSchema = createInsertSchema(userSmtpSettings).omit({
  id: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true
});
var agentNames = pgTable("agent_names", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  language: text("language").notNull(),
  gender: text("gender").notNull().default("unisex"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertAgentNameSchema = createInsertSchema(agentNames).omit({ id: true, createdAt: true });
var ciCalls = pgTable("ci_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().unique(),
  userId: varchar("user_id").notNull(),
  agentId: varchar("agent_id"),
  duration: integer("duration"),
  outcome: text("outcome"),
  callTimestamp: timestamp("call_timestamp"),
  rawTranscript: text("raw_transcript"),
  sentiment: text("sentiment"),
  customerIntent: text("customer_intent"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertCiCallSchema = createInsertSchema(ciCalls).omit({ id: true, createdAt: true });
var ciAnalyses = pgTable("ci_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().unique(),
  callId: varchar("call_id").notNull().references(() => ciCalls.callId, { onDelete: "cascade" }),
  topics: jsonb("topics").$type(),
  objections: jsonb("objections").$type(),
  keywords: jsonb("keywords").$type(),
  agentScore: jsonb("agent_score").$type(),
  failedResponses: jsonb("failed_responses").$type(),
  missedOpportunities: jsonb("missed_opportunities").$type(),
  recommendations: jsonb("recommendations").$type(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertCiAnalysisSchema = createInsertSchema(ciAnalyses).omit({ id: true, createdAt: true });
var supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("open"),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  category: varchar("category", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
var supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderType: varchar("sender_type", { length: 50 }).notNull().default("user"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// plugins/sip-engine/services/elevenlabs-sip.service.ts
import { eq, and, desc } from "drizzle-orm";

// plugins/sip-engine/config/sip-config.ts
var SIP_PROVIDERS = {
  tcxc: {
    name: "tcxc",
    displayName: "TelecomXchange (TCXC)",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    inboundTransport: "tcp",
    inboundPort: 5060,
    description: "TelecomXchange SIP trunking with global interconnection (Airtel, Mobily, Tonerro routes)"
  },
  twilio: {
    name: "twilio",
    displayName: "Twilio SIP",
    requiresRegistration: false,
    defaultPort: 5061,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    inboundTransport: "tcp",
    inboundPort: 5060,
    description: "Twilio Elastic SIP Trunking"
  },
  telnyx: {
    name: "telnyx",
    displayName: "Telnyx",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "Telnyx SIP Trunking with global coverage"
  },
  vonage: {
    name: "vonage",
    displayName: "Vonage (Nexmo)",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "prefer",
    description: "Vonage SIP Trunking"
  },
  exotel: {
    name: "exotel",
    displayName: "Exotel",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tcp",
    defaultMediaEncryption: "prefer",
    description: "Exotel SIP for India and Southeast Asia"
  },
  bandwidth: {
    name: "bandwidth",
    displayName: "Bandwidth",
    requiresRegistration: false,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "Bandwidth SIP Trunking"
  },
  didww: {
    name: "didww",
    displayName: "DIDWW",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "DIDWW global DID numbers"
  },
  generic: {
    name: "generic",
    displayName: "Generic SIP",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "udp",
    defaultMediaEncryption: "none",
    description: "Generic SIP provider - configure all settings manually"
  }
};
var ELEVENLABS_SIP_CONFIG = {
  apiBaseUrl: "https://api.elevenlabs.io/v1",
  sipEndpoint: "sip.rtc.elevenlabs.io",
  defaultCodecs: ["PCMU", "PCMA"],
  supportedEngines: ["elevenlabs-sip"]
};
function getProviderDefaults(provider) {
  return SIP_PROVIDERS[provider] || SIP_PROVIDERS.generic;
}

// plugins/sip-engine/services/elevenlabs-sip.service.ts
var ElevenLabsSipService = class {
  static async getElevenLabsApiKey(userId) {
    if (userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.elevenLabsCredentialId) {
        const [credential] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, user.elevenLabsCredentialId)).limit(1);
        if (credential?.apiKey) {
          return credential.apiKey;
        }
      }
    }
    const [primaryCred] = await db.select().from(elevenLabsCredentials).where(and(eq(elevenLabsCredentials.isPrimary, true), eq(elevenLabsCredentials.isActive, true))).limit(1);
    if (primaryCred?.apiKey) {
      return primaryCred.apiKey;
    }
    if (process.env.ELEVENLABS_API_KEY) {
      return process.env.ELEVENLABS_API_KEY;
    }
    throw new Error("No ElevenLabs API key configured");
  }
  static async createSipTrunk(params) {
    const providerDefaults = getProviderDefaults(params.provider);
    const [trunk] = await db.insert(sipTrunks).values({
      userId: params.userId,
      name: params.name,
      engine: "elevenlabs-sip",
      provider: params.provider,
      sipHost: params.sipHost,
      sipPort: params.sipPort || providerDefaults.defaultPort,
      transport: params.transport || providerDefaults.defaultTransport,
      mediaEncryption: params.mediaEncryption || providerDefaults.defaultMediaEncryption,
      inboundTransport: params.inboundTransport || providerDefaults.inboundTransport || "tcp",
      inboundPort: params.inboundPort || providerDefaults.inboundPort || 5060,
      codecsAllowed: params.codecsAllowed || ELEVENLABS_SIP_CONFIG.defaultCodecs,
      username: params.username,
      password: params.password,
      realm: params.realm,
      externalElevenLabsId: null,
      isActive: true,
      healthStatus: "unknown"
    }).returning();
    console.log(`[SIP Engine] Created SIP trunk: ${trunk.id} for provider ${params.provider}`);
    return trunk;
  }
  static async updateSipTrunk(trunkId, updates) {
    const [existing] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!existing) {
      return null;
    }
    const [updated] = await db.update(sipTrunks).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(sipTrunks.id, trunkId)).returning();
    return updated;
  }
  static async deleteSipTrunk(trunkId) {
    const [existing] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!existing) {
      return false;
    }
    const phoneNumbers2 = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.sipTrunkId, trunkId));
    for (const phone of phoneNumbers2) {
      if (phone.externalElevenLabsPhoneId) {
        try {
          const apiKey = await this.getElevenLabsApiKey(existing.userId);
          await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${phone.externalElevenLabsPhoneId}`, {
            method: "DELETE",
            headers: { "xi-api-key": apiKey }
          });
          console.log(`[SIP Engine] Deleted ElevenLabs phone: ${phone.externalElevenLabsPhoneId}`);
        } catch (error) {
          console.warn(`[SIP Engine] Failed to delete ElevenLabs phone ${phone.phoneNumber}: ${error.message}`);
        }
      }
    }
    await db.delete(sipPhoneNumbers).where(eq(sipPhoneNumbers.sipTrunkId, trunkId));
    await db.delete(sipTrunks).where(eq(sipTrunks.id, trunkId));
    return true;
  }
  static async getUserTrunks(userId) {
    return db.select().from(sipTrunks).where(and(eq(sipTrunks.userId, userId), eq(sipTrunks.isActive, true))).orderBy(desc(sipTrunks.createdAt));
  }
  static async getTrunkById(trunkId) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    return trunk || null;
  }
  static async addPhoneNumber(params) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, params.sipTrunkId)).limit(1);
    if (!trunk) {
      throw new Error("SIP trunk not found");
    }
    let externalElevenLabsPhoneId = null;
    try {
      const apiKey = await this.getElevenLabsApiKey(params.userId);
      let agentElevenLabsId;
      if (params.agentId) {
        const [agent] = await db.select().from(agents).where(eq(agents.id, params.agentId)).limit(1);
        agentElevenLabsId = agent?.elevenLabsAgentId || void 0;
      }
      const mediaEncryptionMap = {
        "require": "required",
        "prefer": "allowed",
        "none": "disabled"
      };
      const mediaEnc = mediaEncryptionMap[trunk.mediaEncryption || "require"] || "allowed";
      const transportProto = trunk.transport === "tls" ? "tls" : "tcp";
      const sipTrunkPayload = {
        phone_number: params.phoneNumber,
        label: params.label || params.phoneNumber,
        sip_trunk: {
          inbound_trunk: {
            transport: transportProto,
            media_encryption: mediaEnc
          },
          outbound_trunk: {
            address: trunk.sipHost,
            transport: transportProto,
            port: trunk.sipPort || 5061,
            media_encryption: mediaEnc
          }
        }
      };
      if (trunk.username && trunk.password) {
        sipTrunkPayload.sip_trunk.outbound_trunk.username = trunk.username;
        sipTrunkPayload.sip_trunk.outbound_trunk.password = trunk.password;
      }
      if (agentElevenLabsId) {
        sipTrunkPayload.agent_id = agentElevenLabsId;
      }
      console.log(`[SIP Engine] Registering phone ${params.phoneNumber} with ElevenLabs SIP trunk...`);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify(sipTrunkPayload)
      });
      if (response.ok) {
        const data = await response.json();
        externalElevenLabsPhoneId = data.phone_number_id || data.id;
        console.log(`[SIP Engine] Registered phone ${params.phoneNumber} with ElevenLabs: ${externalElevenLabsPhoneId}`);
        if (!trunk.externalElevenLabsId && externalElevenLabsPhoneId) {
          await db.update(sipTrunks).set({
            externalElevenLabsId: `sip-${trunk.id}`,
            healthStatus: "healthy",
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(sipTrunks.id, trunk.id));
        }
      } else {
        const errorText = await response.text();
        console.warn(`[SIP Engine] ElevenLabs phone registration failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.warn(`[SIP Engine] Failed to register phone with ElevenLabs: ${error.message}`);
    }
    const [phoneNumber] = await db.insert(sipPhoneNumbers).values({
      sipTrunkId: params.sipTrunkId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      label: params.label,
      engine: trunk.engine,
      agentId: params.agentId || null,
      inboundEnabled: params.inboundEnabled ?? true,
      outboundEnabled: params.outboundEnabled ?? true,
      externalElevenLabsPhoneId,
      isActive: true
    }).returning();
    console.log(`[SIP Engine] Added phone number: ${phoneNumber.id}`);
    return phoneNumber;
  }
  static async updatePhoneNumber(phoneNumberId, updates) {
    const [existing] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId)).limit(1);
    if (!existing) {
      return null;
    }
    if (existing.externalElevenLabsPhoneId && updates.agentId) {
      try {
        const [agent] = await db.select().from(agents).where(eq(agents.id, updates.agentId)).limit(1);
        if (agent?.elevenLabsAgentId) {
          const apiKey = await this.getElevenLabsApiKey(existing.userId);
          await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${existing.externalElevenLabsPhoneId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey
            },
            body: JSON.stringify({ agent_id: agent.elevenLabsAgentId })
          });
        }
      } catch (error) {
        console.warn(`[SIP Engine] Failed to update ElevenLabs phone: ${error.message}`);
      }
    }
    const [updated] = await db.update(sipPhoneNumbers).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(sipPhoneNumbers.id, phoneNumberId)).returning();
    return updated;
  }
  static async deletePhoneNumber(phoneNumberId) {
    const [existing] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId)).limit(1);
    if (!existing) {
      return false;
    }
    if (existing.externalElevenLabsPhoneId) {
      try {
        const apiKey = await this.getElevenLabsApiKey(existing.userId);
        await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${existing.externalElevenLabsPhoneId}`, {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey
          }
        });
      } catch (error) {
        console.warn(`[SIP Engine] Failed to delete ElevenLabs phone: ${error.message}`);
      }
    }
    await db.delete(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId));
    return true;
  }
  static async getTrunkPhoneNumbers(sipTrunkId) {
    return db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.sipTrunkId, sipTrunkId), eq(sipPhoneNumbers.isActive, true))).orderBy(desc(sipPhoneNumbers.createdAt));
  }
  static async getUserPhoneNumbers(userId) {
    return db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.userId, userId), eq(sipPhoneNumbers.isActive, true))).orderBy(desc(sipPhoneNumbers.createdAt));
  }
  static async initiateOutboundCall(params) {
    const [phoneNumber] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, params.sipPhoneNumberId)).limit(1);
    if (!phoneNumber) {
      throw new Error("SIP phone number not found");
    }
    if (!phoneNumber.outboundEnabled) {
      throw new Error("Outbound calls not enabled for this number");
    }
    const [agent] = await db.select().from(agents).where(eq(agents.id, params.agentId)).limit(1);
    if (!agent) {
      throw new Error("Agent not found");
    }
    if (!agent.elevenLabsAgentId) {
      throw new Error("Agent not configured with ElevenLabs");
    }
    const [callRecord] = await db.insert(sipCalls).values({
      sipPhoneNumberId: params.sipPhoneNumberId,
      userId: params.userId,
      agentId: params.agentId,
      campaignId: params.campaignId || null,
      contactId: params.contactId || null,
      direction: "outbound",
      engine: phoneNumber.engine,
      toNumber: params.toNumber,
      fromNumber: phoneNumber.phoneNumber,
      status: "initiated",
      startedAt: /* @__PURE__ */ new Date()
    }).returning();
    let externalCallId = null;
    try {
      const apiKey = await this.getElevenLabsApiKey(params.userId);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/conversations/outbound-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          agent_id: agent.elevenLabsAgentId,
          agent_phone_number_id: phoneNumber.externalElevenLabsPhoneId,
          customer_phone_number: params.toNumber
        })
      });
      if (response.ok) {
        const data = await response.json();
        externalCallId = data.conversation_id || data.call_id;
        await db.update(sipCalls).set({
          externalCallId,
          status: "ringing"
        }).where(eq(sipCalls.id, callRecord.id));
        console.log(`[SIP Engine] Initiated outbound call: ${externalCallId}`);
      } else {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      await db.update(sipCalls).set({
        status: "failed",
        endedAt: /* @__PURE__ */ new Date()
      }).where(eq(sipCalls.id, callRecord.id));
      throw error;
    }
    const [updatedCall] = await db.select().from(sipCalls).where(eq(sipCalls.id, callRecord.id)).limit(1);
    return updatedCall;
  }
  static async handleCallWebhook(params) {
    const [call] = await db.select().from(sipCalls).where(eq(sipCalls.externalCallId, params.conversationId)).limit(1);
    if (!call) {
      console.warn(`[SIP Engine] Call not found for conversation: ${params.conversationId}`);
      return;
    }
    const statusMap = {
      "initiated": "initiated",
      "ringing": "ringing",
      "in_progress": "in-progress",
      "in-progress": "in-progress",
      "completed": "completed",
      "failed": "failed",
      "busy": "busy",
      "no_answer": "no-answer",
      "no-answer": "no-answer"
    };
    const mappedStatus = statusMap[params.status] || params.status;
    const updateData = {
      status: mappedStatus
    };
    if (["completed", "failed", "busy", "no-answer"].includes(mappedStatus)) {
      updateData.endedAt = /* @__PURE__ */ new Date();
    }
    if (params.duration) {
      updateData.durationSeconds = params.duration;
    }
    if (params.transcript) {
      updateData.transcriptJson = params.transcript;
    }
    await db.update(sipCalls).set(updateData).where(eq(sipCalls.id, call.id));
    console.log(`[SIP Engine] Updated call ${call.id} status to ${mappedStatus}`);
  }
  static async getCallById(callId) {
    const [call] = await db.select().from(sipCalls).where(eq(sipCalls.id, callId)).limit(1);
    return call || null;
  }
  static async getUserCalls(userId, limit = 50) {
    return db.select().from(sipCalls).where(eq(sipCalls.userId, userId)).orderBy(desc(sipCalls.createdAt)).limit(limit);
  }
  static async checkTrunkHealth(trunkId) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!trunk) {
      return { status: "error", message: "Trunk not found" };
    }
    const phoneNumbers2 = await db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.sipTrunkId, trunkId), eq(sipPhoneNumbers.isActive, true)));
    const registeredCount = phoneNumbers2.filter((p) => p.externalElevenLabsPhoneId).length;
    if (registeredCount === 0) {
      await db.update(sipTrunks).set({ healthStatus: "unknown", lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return { status: "unknown", message: "No phone numbers registered with ElevenLabs yet" };
    }
    try {
      const apiKey = await this.getElevenLabsApiKey(trunk.userId);
      const testPhone = phoneNumbers2.find((p) => p.externalElevenLabsPhoneId);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${testPhone.externalElevenLabsPhoneId}`, {
        method: "GET",
        headers: { "xi-api-key": apiKey }
      });
      const healthStatus = response.ok ? "healthy" : "unhealthy";
      await db.update(sipTrunks).set({ healthStatus, lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return response.ok ? { status: "healthy", message: `SIP trunk operational (${registeredCount} numbers registered)` } : { status: "unhealthy", message: `ElevenLabs API returned ${response.status}` };
    } catch (error) {
      await db.update(sipTrunks).set({ healthStatus: "degraded", lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return { status: "degraded", message: error.message };
    }
  }
};

// plugins/sip-engine/routes/sip-trunk.routes.ts
var createTrunkSchema = z2.object({
  name: z2.string().min(1).max(100),
  provider: z2.string().default("generic"),
  sipHost: z2.string().min(1),
  sipPort: z2.number().int().min(1).max(65535).optional(),
  transport: z2.enum(["udp", "tcp", "tls"]).optional(),
  mediaEncryption: z2.enum(["require", "prefer", "none"]).optional(),
  username: z2.string().optional(),
  password: z2.string().optional(),
  realm: z2.string().optional(),
  codecsAllowed: z2.array(z2.string()).optional(),
  inboundTransport: z2.enum(["udp", "tcp", "tls"]).optional(),
  inboundPort: z2.number().int().min(1).max(65535).optional()
});
var updateTrunkSchema = createTrunkSchema.partial();
function setupSipTrunkRoutes(app, sessionAuth) {
  app.get("/api/sip/providers", sessionAuth, async (req, res) => {
    try {
      const providers = Object.entries(SIP_PROVIDERS).map(([key, config]) => ({
        id: key,
        name: config.displayName,
        description: config.description,
        defaults: {
          port: config.defaultPort,
          transport: config.defaultTransport,
          mediaEncryption: config.defaultMediaEncryption,
          requiresRegistration: config.requiresRegistration
        }
      }));
      res.json(providers);
    } catch (error) {
      console.error("[SIP Routes] Get providers error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/sip/trunks", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const trunks = await ElevenLabsSipService.getUserTrunks(userId);
      res.json(trunks);
    } catch (error) {
      console.error("[SIP Routes] Get trunks error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/sip/trunks/:trunkId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const trunk = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      if (!trunk) {
        return res.status(404).json({ error: "Trunk not found" });
      }
      if (trunk.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(trunk);
    } catch (error) {
      console.error("[SIP Routes] Get trunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/trunks", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = createTrunkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.createSipTrunk({
        userId,
        ...validation.data
      });
      res.status(201).json(trunk);
    } catch (error) {
      console.error("[SIP Routes] Create trunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/sip/trunks/:trunkId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      if (!existing) {
        return res.status(404).json({ error: "Trunk not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const validation = updateTrunkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.updateSipTrunk(req.params.trunkId, validation.data);
      res.json(trunk);
    } catch (error) {
      console.error("[SIP Routes] Update trunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/sip/trunks/:trunkId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      if (!existing) {
        return res.status(404).json({ error: "Trunk not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await ElevenLabsSipService.deleteSipTrunk(req.params.trunkId);
      res.json({ success: true });
    } catch (error) {
      console.error("[SIP Routes] Delete trunk error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/trunks/:trunkId/health-check", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      if (!existing) {
        return res.status(404).json({ error: "Trunk not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await ElevenLabsSipService.checkTrunkHealth(req.params.trunkId);
      res.json(result);
    } catch (error) {
      console.error("[SIP Routes] Health check error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] SIP trunk routes registered");
}

// plugins/sip-engine/routes/sip-phone.routes.ts
import { z as z3 } from "zod";
var addPhoneSchema = z3.object({
  sipTrunkId: z3.string().uuid(),
  phoneNumber: z3.string().min(1),
  label: z3.string().optional(),
  agentId: z3.string().uuid().optional(),
  inboundEnabled: z3.boolean().optional(),
  outboundEnabled: z3.boolean().optional()
});
var updatePhoneSchema = z3.object({
  label: z3.string().optional(),
  agentId: z3.string().uuid().nullable().optional(),
  inboundEnabled: z3.boolean().optional(),
  outboundEnabled: z3.boolean().optional()
});
var bulkImportSchema = z3.object({
  sipTrunkId: z3.string().uuid(),
  phoneNumbers: z3.array(z3.object({
    phoneNumber: z3.string().min(1),
    label: z3.string().optional()
  })).min(1).max(100)
});
function setupSipPhoneRoutes(app, sessionAuth) {
  app.get("/api/sip/phone-numbers", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { sipTrunkId } = req.query;
      let phoneNumbers2;
      if (sipTrunkId && typeof sipTrunkId === "string") {
        const trunk = await ElevenLabsSipService.getTrunkById(sipTrunkId);
        if (!trunk || trunk.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
        phoneNumbers2 = await ElevenLabsSipService.getTrunkPhoneNumbers(sipTrunkId);
      } else {
        phoneNumbers2 = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      }
      res.json(phoneNumbers2);
    } catch (error) {
      console.error("[SIP Routes] Get phone numbers error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = addPhoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.getTrunkById(validation.data.sipTrunkId);
      if (!trunk || trunk.userId !== userId) {
        return res.status(403).json({ error: "Access denied to this trunk" });
      }
      const phoneNumber = await ElevenLabsSipService.addPhoneNumber({
        userId,
        ...validation.data
      });
      res.status(201).json(phoneNumber);
    } catch (error) {
      console.error("[SIP Routes] Add phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers/bulk-import", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = bulkImportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.getTrunkById(validation.data.sipTrunkId);
      if (!trunk || trunk.userId !== userId) {
        return res.status(403).json({ error: "Access denied to this trunk" });
      }
      const results = [];
      for (const phone of validation.data.phoneNumbers) {
        try {
          const created = await ElevenLabsSipService.addPhoneNumber({
            userId,
            sipTrunkId: validation.data.sipTrunkId,
            phoneNumber: phone.phoneNumber,
            label: phone.label
          });
          results.push({ phoneNumber: phone.phoneNumber, success: true, id: created.id });
        } catch (error) {
          results.push({ phoneNumber: phone.phoneNumber, success: false, error: error.message });
        }
      }
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      res.json({
        imported: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("[SIP Routes] Bulk import error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/sip/phone-numbers/:phoneNumberId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const phoneNumbers2 = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers2.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      const validation = updatePhoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const updated = await ElevenLabsSipService.updatePhoneNumber(req.params.phoneNumberId, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("[SIP Routes] Update phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/sip/phone-numbers/:phoneNumberId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const phoneNumbers2 = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers2.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      await ElevenLabsSipService.deletePhoneNumber(req.params.phoneNumberId);
      res.json({ success: true });
    } catch (error) {
      console.error("[SIP Routes] Delete phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers/:phoneNumberId/assign-agent", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { agentId } = req.body;
      const phoneNumbers2 = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers2.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      const updated = await ElevenLabsSipService.updatePhoneNumber(req.params.phoneNumberId, { agentId });
      res.json(updated);
    } catch (error) {
      console.error("[SIP Routes] Assign agent error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] SIP phone number routes registered");
}

// plugins/sip-engine/routes/sip-call.routes.ts
import { z as z4 } from "zod";
var initiateCallSchema = z4.object({
  sipPhoneNumberId: z4.string().uuid(),
  toNumber: z4.string().min(1),
  agentId: z4.string().uuid(),
  campaignId: z4.string().uuid().optional(),
  contactId: z4.string().uuid().optional()
});
function setupSipCallRoutes(app, sessionAuth) {
  app.get("/api/sip/calls", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = parseInt(req.query.limit) || 50;
      const calls2 = await ElevenLabsSipService.getUserCalls(userId, limit);
      res.json(calls2);
    } catch (error) {
      console.error("[SIP Routes] Get calls error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/sip/calls/:callId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const call = await ElevenLabsSipService.getCallById(req.params.callId);
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      if (call.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(call);
    } catch (error) {
      console.error("[SIP Routes] Get call error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/calls/initiate", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = initiateCallSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const call = await ElevenLabsSipService.initiateOutboundCall({
        userId,
        ...validation.data
      });
      res.status(201).json(call);
    } catch (error) {
      console.error("[SIP Routes] Initiate call error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] SIP call routes registered");
}

// plugins/sip-engine/routes/sip-webhook.routes.ts
import crypto from "crypto";
import { eq as eq2, and as and2 } from "drizzle-orm";
function verifyElevenLabsSignature(payload, signature, webhookSecret) {
  if (!signature || !webhookSecret || !payload) {
    return false;
  }
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
async function verifyWebhookSignature(req) {
  const signature = req.headers["x-elevenlabs-signature"];
  const rawBody = req.rawBody;
  const strictVerification = process.env.SIP_WEBHOOK_STRICT_VERIFICATION === "true";
  if (!rawBody || rawBody.length === 0) {
    if (strictVerification) {
      return { isVerified: false, error: "Missing request body" };
    }
    console.warn("[SIP Webhook] Empty raw body, using JSON.stringify fallback");
    return { isVerified: false };
  }
  const rawPayload = rawBody.toString("utf8");
  if (!signature) {
    if (strictVerification) {
      return { isVerified: false, error: "Missing signature" };
    }
    console.warn("[SIP Webhook] No signature provided, processing anyway (strict mode disabled)");
    return { isVerified: false };
  }
  const [credential] = await db.select().from(elevenLabsCredentials).where(and2(eq2(elevenLabsCredentials.isActive, true), eq2(elevenLabsCredentials.isPrimary, true))).limit(1);
  if (!credential?.webhookSecret) {
    if (strictVerification) {
      return { isVerified: false, error: "Webhook secret not configured" };
    }
    console.warn("[SIP Webhook] No webhook secret configured, processing anyway (strict mode disabled)");
    return { isVerified: false };
  }
  const isVerified = verifyElevenLabsSignature(rawPayload, signature, credential.webhookSecret);
  if (!isVerified) {
    if (strictVerification) {
      return { isVerified: false, error: "Signature verification failed" };
    }
    console.warn("[SIP Webhook] Signature verification failed, processing anyway (strict mode disabled)");
  }
  return { isVerified };
}
function setupSipWebhookRoutes(app) {
  app.post("/api/sip/webhooks/elevenlabs/conversation-status", async (req, res) => {
    try {
      const verification = await verifyWebhookSignature(req);
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      const {
        conversation_id,
        event_type,
        status,
        duration,
        transcript
      } = req.body;
      if (!conversation_id) {
        console.warn("[SIP Webhook] Missing conversation_id");
        return res.status(400).json({ error: "Missing conversation_id" });
      }
      console.log(`[SIP Webhook] Received ${event_type} for conversation ${conversation_id}`);
      if (event_type === "conversation.status_update" || event_type === "conversation.ended") {
        await ElevenLabsSipService.handleCallWebhook({
          conversationId: conversation_id,
          status: status || (event_type === "conversation.ended" ? "completed" : "in-progress"),
          duration,
          transcript
        });
      }
      res.json({ received: true });
    } catch (error) {
      console.error("[SIP Webhook] Error processing webhook:", error);
      res.status(200).json({ received: true, error: error.message });
    }
  });
  app.post("/api/sip/webhooks/elevenlabs/inbound-call", async (req, res) => {
    try {
      const verification = await verifyWebhookSignature(req);
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      const {
        conversation_id,
        agent_id,
        phone_number_id,
        caller_phone_number,
        called_phone_number
      } = req.body;
      console.log(`[SIP Webhook] Inbound call received: ${caller_phone_number} -> ${called_phone_number}`);
      res.json({
        received: true,
        conversation_id
      });
    } catch (error) {
      console.error("[SIP Webhook] Inbound call error:", error);
      res.status(200).json({ received: true, error: error.message });
    }
  });
  app.post("/api/sip/webhooks/elevenlabs/call-ended", async (req, res) => {
    try {
      const verification = await verifyWebhookSignature(req);
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      const {
        conversation_id,
        duration,
        transcript,
        summary,
        sentiment,
        call_outcome
      } = req.body;
      console.log(`[SIP Webhook] Call ended: ${conversation_id}, duration: ${duration}s`);
      await ElevenLabsSipService.handleCallWebhook({
        conversationId: conversation_id,
        status: "completed",
        duration,
        transcript: {
          messages: transcript,
          summary,
          sentiment,
          call_outcome
        }
      });
      res.json({ received: true });
    } catch (error) {
      console.error("[SIP Webhook] Call ended error:", error);
      res.status(200).json({ received: true, error: error.message });
    }
  });
  app.get("/api/sip/webhooks/health", (req, res) => {
    res.json({
      status: "healthy",
      endpoints: [
        "/api/sip/webhooks/elevenlabs/conversation-status",
        "/api/sip/webhooks/elevenlabs/inbound-call",
        "/api/sip/webhooks/elevenlabs/call-ended"
      ]
    });
  });
  console.log("[SIP Engine] SIP webhook routes registered");
}

// plugins/sip-engine/routes/tcxc.routes.ts
import { z as z5 } from "zod";

// plugins/sip-engine/services/tcxc-api.service.ts
import { eq as eq3, and as and3 } from "drizzle-orm";
import crypto2 from "crypto";
var GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", prefix: "966" },
  { code: "AE", name: "United Arab Emirates", prefix: "971" },
  { code: "KW", name: "Kuwait", prefix: "965" },
  { code: "QA", name: "Qatar", prefix: "974" },
  { code: "BH", name: "Bahrain", prefix: "973" },
  { code: "OM", name: "Oman", prefix: "968" },
  { code: "GB", name: "United Kingdom", prefix: "44" },
  { code: "SE", name: "Sweden", prefix: "46" },
  { code: "PL", name: "Poland", prefix: "48" },
  { code: "NZ", name: "New Zealand", prefix: "64" }
];
var COUNTRY_CODE_TO_PREFIX = {
  "SA": "966",
  "AE": "971",
  "KW": "965",
  "QA": "974",
  "BH": "973",
  "OM": "968",
  "US": "1",
  "GB": "44",
  "DE": "49",
  "FR": "33",
  "AU": "61",
  "CA": "1",
  "SE": "46",
  "PL": "48",
  "NZ": "64"
};
var TcxcApiService = class {
  static async getActiveCredential() {
    const [credential] = await db.select().from(tcxcCredentials).where(and3(eq3(tcxcCredentials.isActive, true), eq3(tcxcCredentials.isPrimary, true))).limit(1);
    if (credential) return credential;
    const [anyActive] = await db.select().from(tcxcCredentials).where(eq3(tcxcCredentials.isActive, true)).limit(1);
    return anyActive || null;
  }
  static generateDigestAuth(username, password, method, uri, realm, nonce, nc, cnonce, qop) {
    const ha1 = crypto2.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
    const ha2 = crypto2.createHash("md5").update(`${method}:${uri}`).digest("hex");
    const response = crypto2.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  }
  static async makeRequest(endpoint, method = "GET", body) {
    const credential = await this.getActiveCredential();
    if (!credential) {
      throw new Error("No TCXC credentials configured");
    }
    const baseUrl = credential.apiEndpoint || "https://apiv2.telecomsxchange.com";
    const url = `${baseUrl}${endpoint}`;
    const uri = endpoint;
    const initialResponse = await fetch(url, { method });
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get("www-authenticate");
      if (!authHeader || !authHeader.toLowerCase().startsWith("digest")) {
        throw new Error("TCXC API requires Digest Authentication but did not return proper challenge");
      }
      const realmMatch = authHeader.match(/realm="([^"]+)"/);
      const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
      const qopMatch = authHeader.match(/qop="([^"]+)"/);
      const realm = realmMatch ? realmMatch[1] : "";
      const nonce = nonceMatch ? nonceMatch[1] : "";
      const qop = qopMatch ? qopMatch[1].split(",")[0].trim() : "auth";
      const nc = "00000001";
      const cnonce = crypto2.randomBytes(8).toString("hex");
      const authValue = this.generateDigestAuth(
        credential.apiLogin,
        credential.apiKey,
        method,
        uri,
        realm,
        nonce,
        nc,
        cnonce,
        qop
      );
      const headers = {
        "Authorization": authValue,
        "Content-Type": body ? "application/x-www-form-urlencoded" : "application/json"
      };
      const response = await fetch(url, {
        method,
        headers,
        body: body ? new URLSearchParams(body).toString() : void 0
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TCXC API error: ${response.status} - ${errorText}`);
      }
      return response.json();
    }
    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      throw new Error(`TCXC API error: ${initialResponse.status} - ${errorText}`);
    }
    return initialResponse.json();
  }
  static async getAllCredentials() {
    return db.select().from(tcxcCredentials);
  }
  static async getCredentialById(id) {
    const [credential] = await db.select().from(tcxcCredentials).where(eq3(tcxcCredentials.id, id)).limit(1);
    return credential || null;
  }
  static async createCredential(params) {
    if (params.isPrimary) {
      await db.update(tcxcCredentials).set({ isPrimary: false }).where(eq3(tcxcCredentials.isPrimary, true));
    }
    const [credential] = await db.insert(tcxcCredentials).values({
      name: params.name,
      apiLogin: params.apiLogin,
      apiKey: params.apiKey,
      apiEndpoint: params.apiEndpoint || "https://apiv2.telecomsxchange.com",
      isPrimary: params.isPrimary ?? false,
      isActive: true,
      techPrefixes: params.techPrefixes || [],
      connectionType: params.connectionType || "tcxc",
      sipServer: params.sipServer,
      sipPort: params.sipPort
    }).returning();
    return credential;
  }
  static async updateCredential(id, updates) {
    if (updates.isPrimary) {
      await db.update(tcxcCredentials).set({ isPrimary: false }).where(eq3(tcxcCredentials.isPrimary, true));
    }
    const [updated] = await db.update(tcxcCredentials).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(tcxcCredentials.id, id)).returning();
    return updated || null;
  }
  static async deleteCredential(id) {
    const result = await db.delete(tcxcCredentials).where(eq3(tcxcCredentials.id, id));
    return true;
  }
  static async testConnection() {
    try {
      const credential = await this.getActiveCredential();
      if (!credential) {
        return { success: false, message: "No TCXC credentials configured" };
      }
      await this.makeRequest("/sellers/toproutes?type=CLI&number=1&period=today", "GET");
      await db.update(tcxcCredentials).set({
        healthStatus: "healthy",
        lastHealthCheck: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(tcxcCredentials.id, credential.id));
      return { success: true, message: "Connection successful - TCXC API verified" };
    } catch (error) {
      const credential = await this.getActiveCredential();
      if (credential) {
        await db.update(tcxcCredentials).set({
          healthStatus: "unhealthy",
          lastHealthCheck: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(tcxcCredentials.id, credential.id));
      }
      return { success: false, message: error.message };
    }
  }
  static async getAvailableDids(options) {
    try {
      const params = new URLSearchParams();
      if (options?.countryCode) params.append("country", options.countryCode);
      if (options?.type) params.append("type", options.type);
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.offset) params.append("offset", options.offset.toString());
      const queryString = params.toString();
      const endpoint = `/v1/dids/available${queryString ? `?${queryString}` : ""}`;
      const response = await this.makeRequest(endpoint);
      return response.dids || [];
    } catch (error) {
      console.error("[TCXC] Get available DIDs error:", error.message);
      return [];
    }
  }
  static async getGccDids() {
    const allDids = [];
    for (const country of GCC_COUNTRIES) {
      try {
        const dids = await this.getAvailableDids({ countryCode: country.code, limit: 50 });
        allDids.push(...dids);
      } catch (error) {
        console.warn(`[TCXC] Failed to fetch DIDs for ${country.name}:`, error);
      }
    }
    return allDids;
  }
  static async getMyDids() {
    try {
      const response = await this.makeRequest("/v1/dids/my");
      return response.dids || [];
    } catch (error) {
      console.error("[TCXC] Get my DIDs error:", error.message);
      return [];
    }
  }
  static async getInterconnections() {
    try {
      const response = await this.makeRequest("/v1/interconnections");
      return response.interconnections || [];
    } catch (error) {
      console.error("[TCXC] Get interconnections error:", error.message);
      return [];
    }
  }
  /**
   * Get purchased outbound routes from TCXC
   * Calls GET /buyer/purchased_routes to fetch all purchased routes with tech prefixes
   */
  static async getPurchasedRoutes() {
    try {
      let response = null;
      const endpointsToTry = [
        { endpoint: "/interconnections/list", method: "POST", body: { list: "1" } },
        { endpoint: "/buyers/interconnect", method: "POST", body: { list: "1" } },
        { endpoint: "/buyers/interconnections", method: "GET", body: null },
        { endpoint: "/buyers/routes", method: "GET", body: null },
        { endpoint: "/interconnect/list", method: "POST", body: {} }
      ];
      for (const { endpoint, method, body } of endpointsToTry) {
        try {
          console.log(`[TCXC] Trying ${method} ${endpoint}...`);
          response = await this.makeRequest(endpoint, method, body);
          console.log(`[TCXC] ${endpoint} response:`, JSON.stringify(response).substring(0, 500));
          if (response && typeof response === "object" && !response.toString().includes("<!DOCTYPE")) {
            break;
          }
        } catch (e) {
          console.log(`[TCXC] ${endpoint} failed:`, e.message?.substring(0, 100));
          continue;
        }
      }
      if (!response) {
        console.log("[TCXC] All endpoints failed to return purchased routes");
        return [];
      }
      const routes = [];
      const purchasedRoutes = response?.interconnections || response?.purchased_routes || response?.routes || response?.connections || response?.data || (Array.isArray(response) ? response : []);
      if (Array.isArray(purchasedRoutes)) {
        for (const route of purchasedRoutes) {
          routes.push({
            connectionName: route.connection_name || route.carrier_name || route.name || route.account_name || "",
            techPrefix: route.tech_prefix || route.techprefix || route.prefix || "",
            accountName: route.account_name || route.carrier_name || route.vendor_name || route.seller_name || "",
            tariffId: route.i_tariff || route.tariff_id || route.i_rate || 0,
            connectionId: route.i_connection || route.connection_id || route.i_purchased_route || 0,
            vendorId: route.i_vendor || route.vendor_id || 0,
            vendorName: route.vendor_name || route.carrier_name || route.seller_name || route.account_name || "",
            blocked: route.blocked === 1 || route.blocked === true || route.status === "blocked",
            status: route.blocked ? "blocked" : "active",
            routeType: route.route_type || route.type || "CLI",
            destination: route.destination || route.country_name || route.billing_prefix || "",
            ratePerMinute: parseFloat(route.price || route.rate || route.price_1 || "0")
          });
        }
      }
      console.log("[TCXC] Parsed purchased routes:", routes.length);
      return routes;
    } catch (error) {
      console.error("[TCXC] Get purchased routes error:", error.message);
      return [];
    }
  }
  static async purchaseDid(didId) {
    try {
      const response = await this.makeRequest("/v1/dids/purchase", "POST", { did_id: didId });
      return { success: true, phoneNumber: response.phone_number };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  static getGccCountries() {
    return GCC_COUNTRIES;
  }
  static async searchMarketplaceDids(options) {
    try {
      const formData = {};
      let phonePrefix = options.prefix;
      if (options.prefix && options.prefix.length <= 3 && /^[A-Z]{2}$/.test(options.prefix.toUpperCase())) {
        phonePrefix = COUNTRY_CODE_TO_PREFIX[options.prefix.toUpperCase()] || options.prefix;
      }
      if (phonePrefix) formData.prefix = phonePrefix;
      if (options.seller) formData.seller = options.seller;
      formData.voice = options.voice !== false ? "1" : "0";
      formData.sms = options.sms ? "1" : "0";
      formData.fax = "0";
      formData.video = "0";
      formData.did_type = options.didType || "any";
      formData.pager = String(options.limit || 50);
      formData.off = String(options.offset || 1);
      console.log("[TCXC] Marketplace search params:", formData);
      const response = await this.makeRequest("/number/market", "POST", formData);
      console.log("[TCXC] Marketplace search response:", JSON.stringify(response).substring(0, 500));
      const normalizeDid = (raw) => ({
        i_did: raw.i_did || 0,
        did: raw.number || raw.msisdn || raw.did || "",
        description: raw.description || raw.type || "",
        country: raw.country || "",
        country_code: raw.country_code || raw.country || "",
        seller: raw.vendor_name || raw.seller || "Unknown",
        seller_id: raw.i_vendor || raw.seller_id || 0,
        price_per_minute: parseFloat(raw.price_1) || parseFloat(raw.price_per_minute) || 0,
        monthly_fee: parseFloat(raw.monthly_fee) || 0,
        setup_fee: parseFloat(raw.setup_fee) || 0,
        currency: raw.currency || "USD",
        voice: raw.voice === 1 || raw.voice === true,
        sms: raw.sms === 1 || raw.sms === true,
        fax: raw.fax === 1 || raw.fax === true,
        video: raw.video === 1 || raw.video === true,
        did_type: raw.did_type || raw.type || "national",
        capacity: raw.capacity || 0
      });
      if (response && Array.isArray(response.dids)) {
        return response.dids.map(normalizeDid);
      }
      if (response && Array.isArray(response)) {
        return response.map(normalizeDid);
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Search marketplace DIDs error:", error.message);
      return [];
    }
  }
  static async rentMarketplaceDid(iDid, billingAccountId, sipContact) {
    try {
      const formData = {
        i_did: String(iDid),
        billing_i_account: String(billingAccountId),
        contact: sipContact
      };
      const response = await this.makeRequest("/number/purchase", "POST", formData);
      if (response && response.did) {
        return { success: true, did: response.did };
      }
      if (response && response.success) {
        return { success: true };
      }
      return { success: false, error: "Unknown response from TCXC API" };
    } catch (error) {
      console.error("[TCXC] Rent marketplace DID error:", error.message);
      return { success: false, error: error.message };
    }
  }
  static async getSellerList() {
    try {
      const response = await this.makeRequest("/sellers/list", "GET");
      if (response && Array.isArray(response.sellers)) {
        return response.sellers;
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Get seller list error:", error.message);
      return [];
    }
  }
  /**
   * Search Market View for voice termination rates
   * This searches available rates from all sellers for a specific destination prefix
   */
  static async searchMarketRates(params) {
    try {
      const formBody = {
        prefix: params.prefix,
        searchform: "1",
        type: params.routeType || "any",
        pager: String(params.limit || 50),
        off: "0"
      };
      if (params.seller) {
        formBody.seller = params.seller;
      }
      console.log("[TCXC] Market View search params:", {
        prefix: params.prefix,
        type: params.routeType || "any",
        seller: params.seller,
        limit: params.limit || 50
      });
      const response = await this.makeRequest("/marketview/search", "POST", formBody);
      console.log("[TCXC] Market View response status:", response?.status);
      if (response?.status === "success" && Array.isArray(response.rates)) {
        console.log("[TCXC] Market View found", response.rates.length, "rates");
        return response.rates.map((rate) => ({
          prefix: rate.prefix || "",
          vendorName: rate.vendor_name || "",
          connectionName: rate.connection_name || "",
          tariffId: parseInt(rate.i_tariff) || 0,
          connectionId: parseInt(rate.i_connection) || 0,
          vendorId: parseInt(rate.i_vendor) || 0,
          price: parseFloat(rate.price_1) || 0,
          priceN: parseFloat(rate.price_n) || 0,
          interval1: parseInt(rate.interval_1) || 1,
          intervalN: parseInt(rate.interval_n) || 1,
          dailyAsr: parseFloat(rate.daily_asr) || 0,
          weeklyAsr: parseFloat(rate.weekly_asr) || 0,
          dailyAcd: parseFloat(rate.daily_acd) || 0,
          weeklyAcd: parseFloat(rate.weekly_acd) || 0,
          dailyMinutes: parseFloat(rate.daily_minutes) || 0,
          weeklyMinutes: parseFloat(rate.weekly_minutes) || 0,
          routeType: rate.route_type || "CLI",
          countryCode: rate.country_code || "",
          countryName: rate.country_name || "",
          description: rate.description || "",
          capacity: parseInt(rate.capacity_limit) || 0,
          sellerRating: parseFloat(rate.seller_avg_rating) || 0,
          sellerReviews: parseInt(rate.seller_reviews) || 0
        }));
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Market View search error:", error.message);
      return [];
    }
  }
  static async getRoutes() {
    try {
      const response = await this.makeRequest("/sellers/toproutes?type=CLI&number=100&period=today", "GET");
      if (response && Array.isArray(response.routes)) {
        return response.routes.map((route) => ({
          destination: route.destination || route.country_name || "",
          prefix: route.prefix || route.destination_code || "",
          country: route.country_code || route.country || "",
          seller: route.seller_name || route.vendor_name || "",
          sellerId: route.i_vendor || route.seller_id || 0,
          ratePerMinute: parseFloat(route.rate || route.price_1 || "0"),
          currency: route.currency || "USD",
          quality: route.quality || route.asr || "unknown",
          routeType: route.route_type || "CLI"
        }));
      }
      const credentials = await this.getAllCredentials();
      const routes = [];
      for (const cred of credentials.filter((c) => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix,
              country: "",
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: "USD",
              quality: cred.healthStatus || "unknown",
              routeType: cred.connectionType || "tcxc"
            });
          }
        }
      }
      return routes;
    } catch (error) {
      console.error("[TCXC] Get routes error:", error.message);
      const credentials = await this.getAllCredentials();
      const routes = [];
      for (const cred of credentials.filter((c) => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix,
              country: "",
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: "USD",
              quality: cred.healthStatus || "unknown",
              routeType: cred.connectionType || "tcxc"
            });
          }
        }
      }
      return routes;
    }
  }
  /**
   * HLR Lookup - Validate and get information about a phone number
   * Used to verify destination numbers before making outbound calls
   */
  static async hlrLookup(phoneNumber) {
    try {
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
      console.log("[TCXC] HLR Lookup for:", cleanNumber);
      const response = await this.makeRequest(`/sellers/hlr/lookup/${cleanNumber}`, "POST");
      if (response?.status === "success" && response.response) {
        const r = response.response;
        return {
          success: true,
          data: {
            internationalFormat: r.international_format_number || cleanNumber,
            nationalFormat: r.national_format_number || "",
            countryCode: r.country_code || "",
            countryName: r.country_name || "",
            countryPrefix: r.country_prefix || "",
            currentCarrier: {
              networkCode: r.current_carrier?.network_code || "",
              name: r.current_carrier?.name || "Unknown",
              country: r.current_carrier?.country || "",
              networkType: r.current_carrier?.network_type || ""
            },
            originalCarrier: {
              networkCode: r.original_carrier?.network_code || "",
              name: r.original_carrier?.name || "Unknown",
              country: r.original_carrier?.country || "",
              networkType: r.original_carrier?.network_type || ""
            },
            ported: r.ported || "unknown",
            roaming: {
              status: r.roaming?.status || "unknown"
            }
          }
        };
      }
      return { success: false, error: response?.message || "HLR lookup failed" };
    } catch (error) {
      console.error("[TCXC] HLR Lookup error:", error.message);
      return { success: false, error: error.message };
    }
  }
};

// plugins/sip-engine/routes/tcxc.routes.ts
import { eq as eq4, sql as sql2 } from "drizzle-orm";
var createCredentialSchema = z5.object({
  name: z5.string().min(1),
  apiLogin: z5.string().min(1),
  apiKey: z5.string().min(1),
  apiEndpoint: z5.string().url().optional(),
  isPrimary: z5.boolean().optional(),
  techPrefixes: z5.array(z5.string()).optional(),
  connectionType: z5.enum(["tcxc", "softswitch"]).optional(),
  sipServer: z5.string().optional(),
  sipPort: z5.number().optional()
});
var updateCredentialSchema = z5.object({
  name: z5.string().min(1).optional(),
  apiLogin: z5.string().min(1).optional(),
  apiKey: z5.string().min(1).optional(),
  apiEndpoint: z5.string().url().optional(),
  isPrimary: z5.boolean().optional(),
  isActive: z5.boolean().optional(),
  techPrefixes: z5.array(z5.string()).optional(),
  connectionType: z5.enum(["tcxc", "softswitch"]).optional(),
  sipServer: z5.string().optional(),
  sipPort: z5.number().optional()
});
function setupTcxcRoutes(app, sessionAuth, adminAuth) {
  app.get("/api/tcxc/credentials", adminAuth, async (req, res) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const sanitized = credentials.map((c) => ({
        ...c,
        apiKey: c.apiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + c.apiKey.slice(-4) : null
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("[TCXC Routes] Get credentials error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/status", sessionAuth, async (req, res) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const hasHealthyCredential = credentials.some((c) => c.isActive && c.healthStatus === "healthy");
      const hasAnyCredential = credentials.some((c) => c.isActive);
      res.json({
        configured: hasAnyCredential,
        healthy: hasHealthyCredential,
        credentialCount: credentials.filter((c) => c.isActive).length
      });
    } catch (error) {
      console.error("[TCXC Routes] Get status error:", error);
      res.status(500).json({ configured: false, healthy: false, credentialCount: 0 });
    }
  });
  app.get("/api/tcxc/interconnections", sessionAuth, async (req, res) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const interconnections = credentials.filter((c) => c.isActive).map((c) => ({
        id: c.id,
        name: c.name,
        connectionType: c.connectionType || "tcxc",
        techPrefixes: c.techPrefixes || [],
        sipServer: c.sipServer,
        sipPort: c.sipPort,
        healthStatus: c.healthStatus,
        isActive: c.isActive
      }));
      res.json(interconnections);
    } catch (error) {
      console.error("[TCXC Routes] Get interconnections error:", error);
      res.status(500).json([]);
    }
  });
  app.get("/api/tcxc/purchased-routes", sessionAuth, async (req, res) => {
    try {
      const routes = await TcxcApiService.getPurchasedRoutes();
      console.log("[TCXC Routes] Fetched", routes.length, "purchased routes from TCXC");
      res.json(routes);
    } catch (error) {
      console.error("[TCXC Routes] Get purchased routes error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/credentials", adminAuth, async (req, res) => {
    try {
      const validation = createCredentialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const credential = await TcxcApiService.createCredential(validation.data);
      res.status(201).json({
        ...credential,
        apiKey: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + credential.apiKey.slice(-4)
      });
    } catch (error) {
      console.error("[TCXC Routes] Create credential error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/tcxc/credentials/:id", adminAuth, async (req, res) => {
    try {
      const validation = updateCredentialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const updated = await TcxcApiService.updateCredential(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: "Credential not found" });
      }
      res.json({
        ...updated,
        apiKey: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + updated.apiKey.slice(-4)
      });
    } catch (error) {
      console.error("[TCXC Routes] Update credential error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/tcxc/credentials/:id", adminAuth, async (req, res) => {
    try {
      await TcxcApiService.deleteCredential(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[TCXC Routes] Delete credential error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/test-connection", adminAuth, async (req, res) => {
    try {
      const result = await TcxcApiService.testConnection();
      res.json(result);
    } catch (error) {
      console.error("[TCXC Routes] Test connection error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  app.get("/api/tcxc/dids/available", sessionAuth, async (req, res) => {
    try {
      const { countryCode, type, limit, offset } = req.query;
      const dids = await TcxcApiService.getAvailableDids({
        countryCode,
        type,
        limit: limit ? parseInt(limit) : void 0,
        offset: offset ? parseInt(offset) : void 0
      });
      res.json(dids);
    } catch (error) {
      console.error("[TCXC Routes] Get available DIDs error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/dids/gcc", sessionAuth, async (req, res) => {
    try {
      const dids = await TcxcApiService.getGccDids();
      res.json(dids);
    } catch (error) {
      console.error("[TCXC Routes] Get GCC DIDs error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/dids/my", sessionAuth, async (req, res) => {
    try {
      const dids = await TcxcApiService.getMyDids();
      res.json(dids);
    } catch (error) {
      console.error("[TCXC Routes] Get my DIDs error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/dids/purchase", sessionAuth, async (req, res) => {
    try {
      const { didId } = req.body;
      if (!didId) {
        return res.status(400).json({ error: "didId is required" });
      }
      const result = await TcxcApiService.purchaseDid(didId);
      res.json(result);
    } catch (error) {
      console.error("[TCXC Routes] Purchase DID error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/countries/gcc", (req, res) => {
    res.json(TcxcApiService.getGccCountries());
  });
  app.post("/api/tcxc/marketplace/search", sessionAuth, async (req, res) => {
    try {
      const schema = z5.object({
        prefix: z5.string().optional(),
        country: z5.string().optional(),
        seller: z5.string().optional(),
        voice: z5.boolean().optional(),
        sms: z5.boolean().optional(),
        didType: z5.enum(["any", "mobile", "landline"]).optional(),
        limit: z5.number().optional(),
        offset: z5.number().optional()
      });
      const data = schema.parse(req.body);
      const dids = await TcxcApiService.searchMarketplaceDids(data);
      res.json(dids);
    } catch (error) {
      console.error("[TCXC Routes] Search marketplace DIDs error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/marketplace/rent", sessionAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schema = z5.object({
        iDid: z5.number(),
        did: z5.string().min(1),
        seller: z5.string().min(1),
        country: z5.string().optional(),
        monthlyFee: z5.number().optional(),
        credentialId: z5.string().min(1),
        techPrefix: z5.string().min(1)
      });
      const data = schema.parse(req.body);
      const credential = await TcxcApiService.getCredentialById(data.credentialId);
      if (!credential) {
        return res.status(400).json({ error: "Invalid credential" });
      }
      const sipServer = credential.sipServer || "sip01.telecomsxchange.com";
      const sipPort = credential.sipPort || 5060;
      const sipContact = `sip:${data.did}@${sipServer}:${sipPort}`;
      const result = await TcxcApiService.rentMarketplaceDid(
        data.iDid,
        1,
        // Default billing account - should be configured per credential
        sipContact
      );
      if (result.success) {
        const [callerId] = await db.insert(providerCallerIds).values({
          userId: user.id,
          credentialId: data.credentialId,
          phoneNumber: data.did,
          providerName: data.seller,
          techPrefix: data.techPrefix,
          country: data.country || "Unknown",
          numberType: "voice",
          status: "active"
        }).returning();
        res.json({ ...result, callerId });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("[TCXC Routes] Rent marketplace DID error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/marketplace/sellers", sessionAuth, async (req, res) => {
    try {
      const sellers = await TcxcApiService.getSellerList();
      res.json(sellers);
    } catch (error) {
      console.error("[TCXC Routes] Get seller list error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/hlr/lookup", sessionAuth, async (req, res) => {
    try {
      const schema = z5.object({
        phoneNumber: z5.string().min(5, "Phone number is required")
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const hlrResult = await TcxcApiService.hlrLookup(result.data.phoneNumber);
      if (hlrResult.success) {
        res.json(hlrResult.data);
      } else {
        res.status(400).json({ error: hlrResult.error });
      }
    } catch (error) {
      console.error("[TCXC Routes] HLR Lookup error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/routes", sessionAuth, async (req, res) => {
    try {
      const [topRoutes, purchasedRoutes] = await Promise.all([
        TcxcApiService.getRoutes().catch(() => []),
        TcxcApiService.getPurchasedRoutes().catch(() => [])
      ]);
      const formattedPurchasedRoutes = purchasedRoutes.map((route) => ({
        destination: route.destination || route.connectionName,
        prefix: route.techPrefix,
        country: route.destination,
        seller: route.vendorName || route.accountName,
        sellerId: route.vendorId,
        ratePerMinute: route.ratePerMinute,
        currency: "USD",
        quality: route.status,
        routeType: route.routeType,
        connectionName: route.connectionName,
        techPrefix: route.techPrefix,
        tariffId: route.tariffId,
        connectionId: route.connectionId
      }));
      const allRoutes = [...topRoutes, ...formattedPurchasedRoutes];
      console.log("[TCXC Routes] Combined routes: top=", topRoutes.length, ", purchased=", purchasedRoutes.length);
      res.json(allRoutes);
    } catch (error) {
      console.error("[TCXC Routes] Get routes error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/marketview/search", sessionAuth, async (req, res) => {
    try {
      const schema = z5.object({
        prefix: z5.string().min(1, "Prefix is required"),
        routeType: z5.enum(["CLI", "NCLI", "TDM", "any"]).optional(),
        seller: z5.string().optional(),
        limit: z5.number().optional()
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const rates = await TcxcApiService.searchMarketRates(result.data);
      console.log("[TCXC Routes] Market View search for prefix", result.data.prefix, "- found", rates.length, "rates");
      res.json(rates);
    } catch (error) {
      console.error("[TCXC Routes] Market View search error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/tcxc/provider-caller-ids", sessionAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const callerIds = await db.select().from(providerCallerIds).where(eq4(providerCallerIds.userId, user.id));
      res.json(callerIds);
    } catch (error) {
      console.error("[TCXC Routes] Get provider caller IDs error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/tcxc/provider-caller-ids", sessionAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schema = z5.object({
        credentialId: z5.string().min(1),
        phoneNumber: z5.string().min(1),
        providerName: z5.string().min(1),
        techPrefix: z5.string().min(1),
        country: z5.string().optional(),
        countryCode: z5.string().optional(),
        numberType: z5.enum(["voice", "sms", "both"]).optional(),
        isDefault: z5.boolean().optional()
      });
      const data = schema.parse(req.body);
      if (data.isDefault) {
        await db.update(providerCallerIds).set({ isDefault: false }).where(eq4(providerCallerIds.userId, user.id));
      }
      const [callerId] = await db.insert(providerCallerIds).values({
        userId: user.id,
        credentialId: data.credentialId,
        phoneNumber: data.phoneNumber,
        providerName: data.providerName,
        techPrefix: data.techPrefix,
        country: data.country || "Unknown",
        countryCode: data.countryCode,
        numberType: data.numberType || "voice",
        isDefault: data.isDefault || false
      }).returning();
      res.json(callerId);
    } catch (error) {
      console.error("[TCXC Routes] Add provider caller ID error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/tcxc/provider-caller-ids/:id", sessionAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const callerIdId = req.params.id;
      const existingRecords = await db.select().from(providerCallerIds).where(eq4(providerCallerIds.userId, user.id));
      const existing = existingRecords.find((r) => r.id === callerIdId);
      if (!existing) {
        return res.status(404).json({ error: "Caller ID not found" });
      }
      await db.execute(sql2`DELETE FROM provider_caller_ids WHERE id = ${callerIdId} AND user_id = ${user.id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[TCXC Routes] Delete provider caller ID error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] TCXC routes registered");
}

// plugins/sip-engine/routes/sip-twilio-onboard.routes.ts
import { z as z6 } from "zod";

// server/services/twilio-connector.ts
import twilio from "twilio";

// server/storage.ts
import { nanoid } from "nanoid";
import { eq as eq6, sql as sql4, and as and6, gte as gte2, lte as lte2, desc as desc3, asc, isNull as isNull2, isNotNull as isNotNull2, or as or2, inArray as inArray2, notInArray } from "drizzle-orm";

// server/storage/analytics-helpers.ts
import { eq as eq5, sql as sql3, and as and5, gte, lt, desc as desc2, isNull, or, inArray } from "drizzle-orm";
async function calculateGlobalAnalytics(timeRange) {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  let previousStartDate;
  let previousEndDate;
  let groupByWeek = false;
  let isAllTime = false;
  switch (timeRange) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      previousEndDate = new Date(startDate.getTime());
      previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1e3);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      previousEndDate = new Date(startDate.getTime());
      previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1e3);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1e3);
      previousEndDate = new Date(startDate.getTime());
      previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1e3);
      groupByWeek = true;
      break;
    case "all":
      startDate = /* @__PURE__ */ new Date(0);
      previousStartDate = /* @__PURE__ */ new Date(0);
      previousEndDate = /* @__PURE__ */ new Date(0);
      groupByWeek = true;
      isAllTime = true;
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      previousEndDate = new Date(startDate.getTime());
      previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1e3);
  }
  const allUsers = await db.select().from(users);
  const allPhoneNumbers = await db.select().from(phoneNumbers);
  const allContacts = await db.select().from(contacts);
  const allKnowledgeBases = await db.select().from(knowledgeBase);
  const filteredCalls = await db.select().from(calls).where(gte(calls.createdAt, startDate));
  const filteredCampaigns = await db.select().from(campaigns).where(gte(campaigns.createdAt, startDate));
  const filteredUsers = await db.select().from(users).where(gte(users.createdAt, startDate));
  let previousUsers = [];
  let previousCalls = [];
  let previousCampaigns = [];
  if (!isAllTime) {
    previousUsers = await db.select().from(users).where(
      and5(gte(users.createdAt, previousStartDate), lt(users.createdAt, previousEndDate))
    );
    previousCalls = await db.select().from(calls).where(
      and5(gte(calls.createdAt, previousStartDate), lt(calls.createdAt, previousEndDate))
    );
    previousCampaigns = await db.select().from(campaigns).where(
      and5(gte(campaigns.createdAt, previousStartDate), lt(campaigns.createdAt, previousEndDate))
    );
  }
  const calculateGrowthPercent = (current, previous) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return (current - previous) / previous * 100;
  };
  const userGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredUsers.length, previousUsers.length);
  const callGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredCalls.length, previousCalls.length);
  const campaignGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredCampaigns.length, previousCampaigns.length);
  const totalCalls = filteredCalls.length;
  const completedCalls = filteredCalls.filter((c) => c.status === "completed").length;
  const successRate = totalCalls > 0 ? completedCalls / totalCalls * 100 : 0;
  const qualifiedLeads = filteredCalls.filter((c) => c.classification === "hot" || c.classification === "warm").length;
  const growthData = calculateGrowthData(
    filteredUsers,
    filteredCalls,
    filteredCampaigns,
    startDate,
    now,
    groupByWeek,
    isAllTime
  );
  const activeSubscriptions = await db.select({
    userId: userSubscriptions.userId,
    planName: plans.name,
    status: userSubscriptions.status,
    currentPeriodEnd: userSubscriptions.currentPeriodEnd
  }).from(userSubscriptions).innerJoin(plans, eq5(userSubscriptions.planId, plans.id)).where(
    and5(
      eq5(userSubscriptions.status, "active"),
      or(
        isNull(userSubscriptions.currentPeriodEnd),
        gte(userSubscriptions.currentPeriodEnd, now)
      )
    )
  );
  const proUserIds = /* @__PURE__ */ new Set();
  for (const sub of activeSubscriptions) {
    if (sub.planName !== "free") {
      proUserIds.add(sub.userId);
    }
  }
  const proPlanUsers = proUserIds.size;
  const freePlanUsers = allUsers.length - proPlanUsers;
  return {
    totalUsers: filteredUsers.length,
    totalCampaigns: filteredCampaigns.length,
    totalCalls,
    successRate,
    qualifiedLeads,
    activeUsers: filteredUsers.filter((u) => u.isActive).length,
    proPlanUsers,
    freePlanUsers,
    totalPhoneNumbers: allPhoneNumbers.length,
    totalContacts: allContacts.length,
    totalKnowledgeBases: allKnowledgeBases.length,
    growthData,
    userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
    callGrowthPercent: Math.round(callGrowthPercent * 10) / 10,
    campaignGrowthPercent: Math.round(campaignGrowthPercent * 10) / 10
  };
}
function calculateGrowthData(filteredUsers, filteredCalls, filteredCampaigns, startDate, now, groupByWeek, isAllTime) {
  const growthMap = /* @__PURE__ */ new Map();
  const getIsoDateKey = (date2) => {
    const d = new Date(date2);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  };
  const getMonthKey = (date2) => {
    const d = new Date(date2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const formatDateLabel = (isoDate, isMonthly = false) => {
    if (isMonthly) {
      const [year, month] = isoDate.split("-");
      const d2 = new Date(parseInt(year), parseInt(month) - 1, 1);
      return d2.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    const d = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  let chartStartDate = startDate;
  let useMonthlyBuckets = false;
  if (isAllTime) {
    const allDates = [];
    for (const user of filteredUsers) {
      if (user.createdAt) allDates.push(new Date(user.createdAt));
    }
    for (const call of filteredCalls) {
      if (call.createdAt) allDates.push(new Date(call.createdAt));
    }
    for (const campaign of filteredCampaigns) {
      if (campaign.createdAt) allDates.push(new Date(campaign.createdAt));
    }
    if (allDates.length > 0) {
      chartStartDate = allDates.reduce((min, d) => d < min ? d : min, allDates[0]);
      chartStartDate = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), 1);
    } else {
      chartStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }
    useMonthlyBuckets = true;
  }
  const startDateIso = useMonthlyBuckets ? getMonthKey(chartStartDate) : getIsoDateKey(chartStartDate);
  const nowDateIso = useMonthlyBuckets ? getMonthKey(now) : getIsoDateKey(now);
  const bucketKeys = [];
  const currentDate = new Date(chartStartDate);
  currentDate.setHours(0, 0, 0, 0);
  if (useMonthlyBuckets) {
    while (getMonthKey(currentDate) <= nowDateIso) {
      bucketKeys.push(getMonthKey(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else {
    const interval = groupByWeek ? 7 : 1;
    while (getIsoDateKey(currentDate) <= nowDateIso) {
      bucketKeys.push(getIsoDateKey(currentDate));
      currentDate.setDate(currentDate.getDate() + interval);
    }
  }
  if (bucketKeys.length === 0) {
    bucketKeys.push(startDateIso);
  }
  for (const key of bucketKeys) {
    growthMap.set(key, { users: 0, calls: 0, campaigns: 0 });
  }
  const getBucketKey = (date2) => {
    if (useMonthlyBuckets) {
      const monthKey = getMonthKey(date2);
      if (monthKey < startDateIso || monthKey > nowDateIso) {
        return null;
      }
      return growthMap.has(monthKey) ? monthKey : null;
    }
    const dateKey = getIsoDateKey(date2);
    if (dateKey < startDateIso || dateKey > nowDateIso) {
      return null;
    }
    if (groupByWeek) {
      for (let i = bucketKeys.length - 1; i >= 0; i--) {
        if (dateKey >= bucketKeys[i]) {
          return bucketKeys[i];
        }
      }
      return bucketKeys[0];
    } else {
      return growthMap.has(dateKey) ? dateKey : null;
    }
  };
  for (const user of filteredUsers) {
    if (user.createdAt) {
      const bucketKey = getBucketKey(new Date(user.createdAt));
      if (bucketKey) {
        const entry = growthMap.get(bucketKey);
        if (entry) entry.users++;
      }
    }
  }
  for (const call of filteredCalls) {
    if (call.createdAt) {
      const bucketKey = getBucketKey(new Date(call.createdAt));
      if (bucketKey) {
        const entry = growthMap.get(bucketKey);
        if (entry) entry.calls++;
      }
    }
  }
  for (const campaign of filteredCampaigns) {
    if (campaign.createdAt) {
      const bucketKey = getBucketKey(new Date(campaign.createdAt));
      if (bucketKey) {
        const entry = growthMap.get(bucketKey);
        if (entry) entry.campaigns++;
      }
    }
  }
  return Array.from(growthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([isoDate, data]) => ({
    date: formatDateLabel(isoDate, useMonthlyBuckets),
    ...data
  }));
}
async function calculateUserAnalytics(userId, timeRange = "7days", callType = "all") {
  const now = /* @__PURE__ */ new Date();
  let startDate = /* @__PURE__ */ new Date();
  switch (timeRange) {
    case "7days":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30days":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90days":
      startDate.setDate(now.getDate() - 90);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
      startDate = /* @__PURE__ */ new Date(0);
      break;
    default:
      startDate.setDate(now.getDate() - 7);
  }
  const userCampaigns = await db.select().from(campaigns).where(eq5(campaigns.userId, userId));
  const campaignIds = userCampaigns.map((c) => c.id);
  const userIncomingConnections = await db.select().from(incomingConnections).where(eq5(incomingConnections.userId, userId));
  const incomingConnectionIds = userIncomingConnections.map((c) => c.id);
  let allUserCalls = [];
  const directOwnershipCalls = await db.select().from(calls).where(and5(eq5(calls.userId, userId), gte(calls.createdAt, startDate)));
  allUserCalls.push(...directOwnershipCalls);
  if (campaignIds.length > 0) {
    const campaignCalls = await db.select().from(calls).where(and5(inArray(calls.campaignId, campaignIds), gte(calls.createdAt, startDate)));
    for (const call of campaignCalls) {
      if (!allUserCalls.find((c) => c.id === call.id)) {
        allUserCalls.push(call);
      }
    }
  }
  if (incomingConnectionIds.length > 0) {
    const incomingCalls = await db.select().from(calls).where(and5(inArray(calls.incomingConnectionId, incomingConnectionIds), gte(calls.createdAt, startDate)));
    for (const call of incomingCalls) {
      if (!allUserCalls.find((c) => c.id === call.id)) {
        allUserCalls.push(call);
      }
    }
  }
  const twilioOpenAICallsData = await db.select().from(twilioOpenaiCalls).where(and5(eq5(twilioOpenaiCalls.userId, userId), gte(twilioOpenaiCalls.createdAt, startDate)));
  for (const toc of twilioOpenAICallsData) {
    const engineCall = {
      id: toc.id,
      userId: toc.userId,
      campaignId: toc.campaignId,
      contactId: toc.contactId,
      phoneNumber: toc.fromNumber,
      status: toc.status,
      callDirection: toc.callDirection,
      duration: toc.duration,
      classification: toc.classification,
      sentiment: toc.sentiment,
      createdAt: toc.createdAt,
      metadata: toc.metadata,
      incomingConnectionId: null
    };
    if (toc.campaignId && toc.contactId) {
      const dupIdx = allUserCalls.findIndex((c) => c.campaignId === toc.campaignId && c.contactId === toc.contactId);
      if (dupIdx !== -1) {
        allUserCalls[dupIdx] = engineCall;
        continue;
      }
    }
    allUserCalls.push(engineCall);
  }
  const isBatchCall = (c) => {
    const meta = c.metadata;
    return !!(meta?.batch_call || meta?.batchCall || meta?.batchId || meta?.batchJobId || meta?.batch_calling);
  };
  const incomingDirections = ["incoming", "inbound", "bridged", "simulcall"];
  const outgoingDirections = ["outgoing", "outbound"];
  const isIncomingCall = (c) => {
    if (isBatchCall(c)) return false;
    return incomingDirections.includes(c.callDirection || "") || !!c.incomingConnectionId;
  };
  const isOutgoingCall = (c) => {
    if (isBatchCall(c)) return false;
    if (outgoingDirections.includes(c.callDirection || "")) return true;
    if (c.campaignId && !c.incomingConnectionId && !incomingDirections.includes(c.callDirection || "")) return true;
    if (!isIncomingCall(c)) return true;
    return false;
  };
  let filteredCalls = allUserCalls;
  if (callType === "incoming") filteredCalls = allUserCalls.filter(isIncomingCall);
  else if (callType === "outgoing") filteredCalls = allUserCalls.filter(isOutgoingCall);
  else if (callType === "batch") filteredCalls = allUserCalls.filter(isBatchCall);
  const allCalls = filteredCalls;
  const typeBreakdown = {
    incoming: allUserCalls.filter(isIncomingCall).length,
    outgoing: allUserCalls.filter(isOutgoingCall).length,
    batch: allUserCalls.filter(isBatchCall).length,
    total: allUserCalls.length
  };
  const totalCalls = allCalls.length;
  const completedCalls = allCalls.filter((c) => c.status === "completed").length;
  const successRate = totalCalls > 0 ? completedCalls / totalCalls * 100 : 0;
  const qualifiedLeads = allCalls.filter(
    (c) => c.classification === "hot" || c.classification === "warm"
  ).length;
  const callsWithDuration = allCalls.filter((c) => c.duration && c.duration > 0);
  const totalDuration = callsWithDuration.reduce((sum, call) => sum + (call.duration || 0), 0);
  const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;
  const leadCounts = {
    hot: allCalls.filter((c) => c.classification === "hot" || c.classification === "qualified").length,
    warm: allCalls.filter((c) => c.classification === "warm" || c.classification === "interested").length,
    cold: allCalls.filter((c) => c.classification === "cold" || c.classification === "not_interested").length,
    lost: allCalls.filter((c) => c.classification === "lost" || c.classification === "do_not_call").length
  };
  const leadDistribution = [
    { name: "Hot", value: leadCounts.hot },
    { name: "Warm", value: leadCounts.warm },
    { name: "Cold", value: leadCounts.cold },
    { name: "Lost", value: leadCounts.lost }
  ].filter((item) => item.value > 0);
  const sentimentCounts = {
    positive: allCalls.filter((c) => c.sentiment === "positive").length,
    neutral: allCalls.filter((c) => c.sentiment === "neutral").length,
    negative: allCalls.filter((c) => c.sentiment === "negative").length
  };
  const sentimentDistribution = [
    { name: "Positive", value: sentimentCounts.positive },
    { name: "Neutral", value: sentimentCounts.neutral },
    { name: "Negative", value: sentimentCounts.negative }
  ].filter((item) => item.value > 0);
  const campaignPerformance = userCampaigns.map((campaign) => {
    const campaignCalls = allCalls.filter((c) => c.campaignId === campaign.id);
    const completed = campaignCalls.filter((c) => c.status === "completed").length;
    const total = campaignCalls.length;
    const rate = total > 0 ? completed / total * 100 : 0;
    return {
      name: campaign.name,
      value: parseFloat(rate.toFixed(1)),
      totalCalls: total,
      completedCalls: completed
    };
  });
  const dailyCalls = calculateDailyCalls(allCalls, timeRange);
  return {
    totalCalls,
    successRate: parseFloat(successRate.toFixed(1)),
    qualifiedLeads,
    avgDuration: Math.round(avgDuration),
    leadDistribution,
    sentimentDistribution,
    campaignPerformance,
    dailyCalls,
    typeBreakdown
  };
}
function calculateDailyCalls(allCalls, timeRange) {
  const dailyCalls = [];
  let daysToShow = 7;
  if (timeRange === "30days") daysToShow = 30;
  else if (timeRange === "90days") daysToShow = 90;
  else if (timeRange === "year") daysToShow = 365;
  if (daysToShow <= 14) {
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date2 = /* @__PURE__ */ new Date();
      date2.setDate(date2.getDate() - i);
      date2.setHours(0, 0, 0, 0);
      const nextDay = new Date(date2);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayCount = allCalls.filter((call) => {
        const callDate = new Date(call.createdAt);
        return callDate >= date2 && callDate < nextDay;
      }).length;
      dailyCalls.push({ date: date2.toISOString(), count: dayCount });
    }
  } else if (daysToShow <= 90) {
    const weeksToShow = Math.ceil(daysToShow / 7);
    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekEnd = /* @__PURE__ */ new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weekCount = allCalls.filter((call) => {
        const callDate = new Date(call.createdAt);
        return callDate >= weekStart && callDate <= weekEnd;
      }).length;
      dailyCalls.push({ date: weekStart.toISOString(), count: weekCount });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const monthStart = /* @__PURE__ */ new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);
      const monthCount = allCalls.filter((call) => {
        const callDate = new Date(call.createdAt);
        return callDate >= monthStart && callDate <= monthEnd;
      }).length;
      dailyCalls.push({ date: monthStart.toISOString(), count: monthCount });
    }
  }
  return dailyCalls;
}
async function calculateDashboardData(userId) {
  const now = /* @__PURE__ */ new Date();
  const weekAgo = /* @__PURE__ */ new Date();
  weekAgo.setDate(now.getDate() - 7);
  const userCampaigns = await db.select().from(campaigns).where(eq5(campaigns.userId, userId));
  const campaignIds = userCampaigns.map((c) => c.id);
  const userIncomingConnections = await db.select().from(incomingConnections).where(eq5(incomingConnections.userId, userId));
  const incomingConnectionIds = userIncomingConnections.map((c) => c.id);
  let allUserCalls = [];
  const directOwnershipCalls = await db.select().from(calls).where(eq5(calls.userId, userId));
  allUserCalls.push(...directOwnershipCalls);
  if (campaignIds.length > 0) {
    const campaignCalls = await db.select().from(calls).where(inArray(calls.campaignId, campaignIds));
    for (const call of campaignCalls) {
      if (!allUserCalls.find((c) => c.id === call.id)) {
        allUserCalls.push(call);
      }
    }
  }
  if (incomingConnectionIds.length > 0) {
    const incomingCalls = await db.select().from(calls).where(inArray(calls.incomingConnectionId, incomingConnectionIds));
    for (const call of incomingCalls) {
      if (!allUserCalls.find((c) => c.id === call.id)) {
        allUserCalls.push(call);
      }
    }
  }
  const twilioOpenAICallsData = await db.select().from(twilioOpenaiCalls).where(eq5(twilioOpenaiCalls.userId, userId));
  for (const toc of twilioOpenAICallsData) {
    const engineCall = {
      id: toc.id,
      userId: toc.userId,
      campaignId: toc.campaignId,
      contactId: toc.contactId,
      phoneNumber: toc.fromNumber,
      status: toc.status,
      callDirection: toc.callDirection,
      duration: toc.duration,
      classification: toc.classification,
      sentiment: toc.sentiment,
      createdAt: toc.createdAt,
      metadata: toc.metadata,
      incomingConnectionId: null
    };
    if (allUserCalls.find((c) => c.id === toc.id)) {
      continue;
    }
    if (toc.campaignId && toc.contactId) {
      const tocTime = new Date(toc.createdAt).getTime();
      const dupIdx = allUserCalls.findIndex((c) => {
        if (c.campaignId !== toc.campaignId || c.contactId !== toc.contactId) return false;
        const cTime = new Date(c.createdAt).getTime();
        return Math.abs(tocTime - cTime) < 5 * 60 * 1e3;
      });
      if (dupIdx !== -1) {
        allUserCalls[dupIdx] = engineCall;
        continue;
      }
    }
    allUserCalls.push(engineCall);
  }
  const incomingDirections = ["incoming", "inbound", "bridged", "simulcall"];
  const outgoingDirections = ["outgoing", "outbound"];
  const isBatchCall = (c) => {
    const meta = c.metadata;
    return !!(meta?.batch_call || meta?.batchCall || meta?.batchId || meta?.batchJobId || meta?.batch_calling);
  };
  const isIncomingCall = (c) => {
    if (isBatchCall(c)) return false;
    return incomingDirections.includes(c.callDirection || "") || !!c.incomingConnectionId;
  };
  const isOutgoingCall = (c) => {
    if (isBatchCall(c)) return false;
    if (outgoingDirections.includes(c.callDirection || "")) return true;
    if (c.campaignId && !c.incomingConnectionId && !incomingDirections.includes(c.callDirection || "")) return true;
    if (!isIncomingCall(c)) return true;
    return false;
  };
  const prevWeekStart = /* @__PURE__ */ new Date();
  prevWeekStart.setDate(now.getDate() - 14);
  const thisWeekCalls = allUserCalls.filter((c) => new Date(c.createdAt) >= weekAgo);
  const prevWeekCalls = allUserCalls.filter((c) => {
    const date2 = new Date(c.createdAt);
    return date2 >= prevWeekStart && date2 < weekAgo;
  });
  const incomingThisWeek = thisWeekCalls.filter(isIncomingCall);
  const outgoingThisWeek = thisWeekCalls.filter(isOutgoingCall);
  const incomingPrevWeek = prevWeekCalls.filter(isIncomingCall);
  const outgoingPrevWeek = prevWeekCalls.filter(isOutgoingCall);
  const calcTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  };
  const calcStats = (callList) => {
    const completed = callList.filter((c) => c.status === "completed");
    const successRate = callList.length > 0 ? Math.round(completed.length / callList.length * 100) : 0;
    const avgDuration = completed.length > 0 ? Math.round(completed.reduce((sum, c) => sum + (c.duration || 0), 0) / completed.length) : 0;
    return { successRate, avgDuration };
  };
  const dailyBreakdown = [];
  for (let i = 6; i >= 0; i--) {
    const day = /* @__PURE__ */ new Date();
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const dayCalls = thisWeekCalls.filter((c) => {
      const callDate = new Date(c.createdAt);
      return callDate >= day && callDate <= dayEnd;
    });
    dailyBreakdown.push({
      date: day.toISOString(),
      incoming: dayCalls.filter(isIncomingCall).length,
      outgoing: dayCalls.filter(isOutgoingCall).length
    });
  }
  const leadDistribution = {
    hot: allUserCalls.filter((c) => c.classification?.toLowerCase() === "hot" || c.classification?.toLowerCase() === "qualified").length,
    warm: allUserCalls.filter((c) => c.classification?.toLowerCase() === "warm" || c.classification?.toLowerCase() === "interested").length,
    cold: allUserCalls.filter((c) => c.classification?.toLowerCase() === "cold" || c.classification?.toLowerCase() === "not_interested").length,
    lost: allUserCalls.filter((c) => c.classification?.toLowerCase() === "lost" || c.classification?.toLowerCase() === "do_not_call").length
  };
  const recentCalls = await db.select({
    id: calls.id,
    phoneNumber: calls.phoneNumber,
    status: calls.status,
    duration: calls.duration,
    classification: calls.classification,
    callDirection: calls.callDirection,
    createdAt: calls.createdAt,
    campaignId: calls.campaignId,
    incomingConnectionId: calls.incomingConnectionId,
    metadata: calls.metadata
  }).from(calls).where(eq5(calls.userId, userId)).orderBy(desc2(calls.createdAt)).limit(10);
  let recentUsers = [];
  const [currentUser] = await db.select().from(users).where(eq5(users.id, userId));
  if (currentUser?.role === "admin" || currentUser?.role === "super_admin") {
    recentUsers = await db.select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt
    }).from(users).orderBy(desc2(users.createdAt)).limit(5);
  }
  const totalCampaigns = userCampaigns.length;
  const activeCampaigns = userCampaigns.filter(
    (c) => c.status === "in_progress" || c.status === "scheduled" || c.status === "pending"
  ).length;
  const completedCampaigns = userCampaigns.filter((c) => c.status === "completed").length;
  let allCampaignCalls = [];
  if (campaignIds.length > 0) {
    allCampaignCalls = await db.select().from(calls).where(inArray(calls.campaignId, campaignIds));
  }
  const campaignCallsCompleted = allCampaignCalls.filter((c) => c.status === "completed");
  const campaignSuccessRate = allCampaignCalls.length > 0 ? Math.round(campaignCallsCompleted.length / allCampaignCalls.length * 100) : 0;
  const campaignAvgDuration = campaignCallsCompleted.length > 0 ? Math.round(campaignCallsCompleted.reduce((sum, c) => sum + (c.duration || 0), 0) / campaignCallsCompleted.length) : 0;
  const [appointmentsResult] = await db.select({ count: sql3`count(*)` }).from(appointments).where(eq5(appointments.userId, userId));
  const appointmentsCount = Number(appointmentsResult?.count || 0);
  const userForms = await db.select({ id: forms.id }).from(forms).where(eq5(forms.userId, userId));
  const formsCount = userForms.length;
  let formSubmissionsCount = 0;
  if (userForms.length > 0) {
    const formIds = userForms.map((f) => f.id);
    const [submissionsResult] = await db.select({ count: sql3`count(*)` }).from(formSubmissions).where(inArray(formSubmissions.formId, formIds));
    formSubmissionsCount = Number(submissionsResult?.count || 0);
  }
  const [kbResult] = await db.select({ count: sql3`count(*)` }).from(knowledgeBase).where(eq5(knowledgeBase.userId, userId));
  const knowledgeBaseCount = Number(kbResult?.count || 0);
  const [webhooksResult] = await db.select({ count: sql3`count(*)` }).from(webhookSubscriptions).where(eq5(webhookSubscriptions.userId, userId));
  const webhooksCount = Number(webhooksResult?.count || 0);
  const [userTemplatesResult] = await db.select({ count: sql3`count(*)` }).from(promptTemplates).where(eq5(promptTemplates.userId, userId));
  const userTemplatesCount = Number(userTemplatesResult?.count || 0);
  const [systemTemplatesResult] = await db.select({ count: sql3`count(*)` }).from(promptTemplates).where(eq5(promptTemplates.isSystemTemplate, true));
  const systemTemplatesCount = Number(systemTemplatesResult?.count || 0);
  const templatesCount = userTemplatesCount + systemTemplatesCount;
  const sentimentDistribution = {
    positive: allUserCalls.filter((c) => c.sentiment === "positive").length,
    neutral: allUserCalls.filter((c) => c.sentiment === "neutral").length,
    negative: allUserCalls.filter((c) => c.sentiment === "negative").length
  };
  const incomingAllTime = allUserCalls.filter(isIncomingCall);
  const outgoingAllTime = allUserCalls.filter(isOutgoingCall);
  const incomingAllStats = calcStats(incomingAllTime);
  const outgoingAllStats = calcStats(outgoingAllTime);
  return {
    callTypeStats: {
      incoming: {
        count: incomingAllTime.length,
        trend: calcTrend(incomingThisWeek.length, incomingPrevWeek.length),
        successRate: incomingAllStats.successRate,
        avgDuration: incomingAllStats.avgDuration
      },
      outgoing: {
        count: outgoingAllTime.length,
        trend: calcTrend(outgoingThisWeek.length, outgoingPrevWeek.length),
        successRate: outgoingAllStats.successRate,
        avgDuration: outgoingAllStats.avgDuration
      },
      campaign: {
        count: totalCampaigns,
        active: activeCampaigns,
        completed: completedCampaigns,
        successRate: campaignSuccessRate,
        avgDuration: campaignAvgDuration,
        totalCalls: allCampaignCalls.length
      }
    },
    weeklyCallsChart: dailyBreakdown,
    leadDistribution,
    sentimentDistribution,
    recentCalls: recentCalls.map((c) => ({
      ...c,
      callType: isBatchCall(c) ? "batch" : c.callDirection === "incoming" || c.incomingConnectionId ? "incoming" : "outgoing"
    })),
    recentUsers,
    userName: currentUser?.name || currentUser?.email?.split("@")[0] || "User",
    totalCalls: allUserCalls.length,
    totalThisWeek: thisWeekCalls.length,
    totalPrevWeek: prevWeekCalls.length,
    weeklyTrend: calcTrend(thisWeekCalls.length, prevWeekCalls.length),
    appointmentsBooked: appointmentsCount,
    formsSubmitted: formSubmissionsCount,
    formsCount,
    knowledgeBaseCount,
    webhooksCount,
    templatesCount
  };
}

// server/storage.ts
var DbStorage = class {
  // Users
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq6(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq6(users.email, email));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserCredits(userId, credits) {
    await db.update(users).set({ credits }).where(eq6(users.id, userId));
  }
  // Agents
  async getAgent(id) {
    const [agent] = await db.select().from(agents).where(eq6(agents.id, id));
    return agent;
  }
  async getUserAgents(userId) {
    return db.select().from(agents).where(eq6(agents.userId, userId));
  }
  async createAgent(insertAgent) {
    const [agent] = await db.insert(agents).values(insertAgent).returning();
    return agent;
  }
  async updateAgent(id, agent) {
    await db.update(agents).set(agent).where(eq6(agents.id, id));
  }
  async deleteAgent(id) {
    await db.delete(agents).where(eq6(agents.id, id));
  }
  // Knowledge Base
  async getKnowledgeBaseItem(id) {
    const [item] = await db.select().from(knowledgeBase).where(eq6(knowledgeBase.id, id));
    return item;
  }
  async getUserKnowledgeBase(userId) {
    return db.select().from(knowledgeBase).where(eq6(knowledgeBase.userId, userId));
  }
  async getUserKnowledgeBaseCount(userId) {
    const result = await db.select({ count: sql4`count(*)` }).from(knowledgeBase).where(eq6(knowledgeBase.userId, userId));
    return Number(result[0]?.count || 0);
  }
  async createKnowledgeBaseItem(insertItem) {
    const [item] = await db.insert(knowledgeBase).values(insertItem).returning();
    return item;
  }
  async updateKnowledgeBaseItem(id, item) {
    await db.update(knowledgeBase).set(item).where(eq6(knowledgeBase.id, id));
  }
  async deleteKnowledgeBaseItem(id) {
    await db.delete(knowledgeBase).where(eq6(knowledgeBase.id, id));
  }
  // Campaigns
  async getCampaign(id) {
    const [campaign] = await db.select().from(campaigns).where(and6(
      eq6(campaigns.id, id),
      isNull2(campaigns.deletedAt)
    ));
    return campaign;
  }
  async getCampaignIncludingDeleted(id) {
    const [campaign] = await db.select().from(campaigns).where(eq6(campaigns.id, id));
    return campaign;
  }
  async getUserCampaigns(userId) {
    return db.select().from(campaigns).where(and6(
      eq6(campaigns.userId, userId),
      isNull2(campaigns.deletedAt)
    ));
  }
  async getUserDeletedCampaigns(userId) {
    return db.select().from(campaigns).where(and6(
      eq6(campaigns.userId, userId),
      isNotNull2(campaigns.deletedAt)
    ));
  }
  async createCampaign(insertCampaign) {
    const [campaign] = await db.insert(campaigns).values(insertCampaign).returning();
    return campaign;
  }
  async updateCampaign(id, campaign) {
    await db.update(campaigns).set(campaign).where(eq6(campaigns.id, id));
  }
  async deleteCampaign(id) {
    await db.update(campaigns).set({ deletedAt: /* @__PURE__ */ new Date() }).where(eq6(campaigns.id, id));
  }
  async restoreCampaign(id) {
    await db.update(campaigns).set({ deletedAt: null }).where(eq6(campaigns.id, id));
  }
  // Contacts
  async getContact(id) {
    const [contact] = await db.select().from(contacts).where(eq6(contacts.id, id));
    return contact;
  }
  async getCampaignContacts(campaignId) {
    return db.select().from(contacts).where(eq6(contacts.campaignId, campaignId));
  }
  async getUserContacts(userId) {
    const results = await db.select({
      contact: contacts,
      campaign: campaigns
    }).from(contacts).innerJoin(campaigns, eq6(contacts.campaignId, campaigns.id)).where(and6(
      eq6(campaigns.userId, userId),
      isNull2(campaigns.deletedAt)
    ));
    return results.map((r) => ({
      ...r.contact,
      campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : null
    }));
  }
  async getUserContactsDeduplicated(userId) {
    const results = await db.select({
      contact: contacts,
      campaign: campaigns
    }).from(contacts).innerJoin(campaigns, eq6(contacts.campaignId, campaigns.id)).where(and6(
      eq6(campaigns.userId, userId),
      isNull2(campaigns.deletedAt)
    )).orderBy(desc3(contacts.createdAt));
    const phoneGroups = /* @__PURE__ */ new Map();
    for (const result of results) {
      const { contact, campaign } = result;
      const phone = contact.phone;
      if (!phoneGroups.has(phone)) {
        phoneGroups.set(phone, {
          phone,
          email: contact.email,
          names: /* @__PURE__ */ new Set(),
          namesList: [],
          campaigns: /* @__PURE__ */ new Set(),
          campaignsList: [],
          statuses: /* @__PURE__ */ new Set(),
          latestContactId: contact.id,
          latestStatus: contact.status,
          latestEmail: contact.email,
          latestCreatedAt: contact.createdAt,
          source: "campaign",
          callCount: 0
        });
      }
      const group = phoneGroups.get(phone);
      const nameKey = `${contact.firstName.toLowerCase()}|${(contact.lastName || "").toLowerCase()}`;
      if (!group.names.has(nameKey)) {
        group.names.add(nameKey);
        group.namesList.push({
          firstName: contact.firstName,
          lastName: contact.lastName
        });
      }
      if (!group.campaigns.has(campaign.id) && campaign) {
        group.campaigns.add(campaign.id);
        group.campaignsList.push({
          id: campaign.id,
          name: campaign.name
        });
      }
      group.statuses.add(contact.status);
      if (contact.createdAt > group.latestCreatedAt) {
        group.latestContactId = contact.id;
        group.latestStatus = contact.status;
        group.latestEmail = contact.email;
        group.latestCreatedAt = contact.createdAt;
      }
    }
    const callsWithoutContacts = await db.select({
      phoneNumber: calls.phoneNumber,
      callDirection: calls.callDirection,
      createdAt: calls.createdAt,
      status: calls.status
    }).from(calls).where(and6(
      eq6(calls.userId, userId),
      isNull2(calls.contactId),
      isNotNull2(calls.phoneNumber)
    )).orderBy(desc3(calls.createdAt));
    for (const call of callsWithoutContacts) {
      const phone = call.phoneNumber;
      if (!phone || phone === "Unknown Caller" || phone === "unknown") continue;
      const callStatus = call.callDirection === "incoming" ? "incoming_call" : "outgoing_call";
      if (!phoneGroups.has(phone)) {
        phoneGroups.set(phone, {
          phone,
          email: null,
          names: /* @__PURE__ */ new Set(),
          namesList: [],
          campaigns: /* @__PURE__ */ new Set(),
          campaignsList: [],
          statuses: /* @__PURE__ */ new Set([callStatus]),
          latestContactId: `call-${phone}`,
          // Virtual ID for call-only contacts
          latestStatus: callStatus,
          latestEmail: null,
          latestCreatedAt: call.createdAt,
          source: "call",
          callCount: 1
        });
      } else {
        const group = phoneGroups.get(phone);
        group.callCount = (group.callCount || 0) + 1;
        group.statuses.add(callStatus);
        if (call.createdAt > group.latestCreatedAt) {
          group.latestStatus = callStatus;
          group.latestCreatedAt = call.createdAt;
        }
      }
    }
    return Array.from(phoneGroups.values()).map((group) => ({
      id: group.latestContactId,
      phone: group.phone,
      email: group.latestEmail,
      names: group.namesList,
      campaigns: group.campaignsList,
      status: group.latestStatus,
      allStatuses: Array.from(group.statuses),
      source: group.source,
      callCount: group.callCount
    }));
  }
  async createContact(insertContact) {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }
  async createContacts(insertContacts) {
    return db.insert(contacts).values(insertContacts).returning();
  }
  async deleteContact(id) {
    await db.delete(contacts).where(eq6(contacts.id, id));
  }
  async updateContact(id, data) {
    const [updated] = await db.update(contacts).set(data).where(eq6(contacts.id, id)).returning();
    return updated;
  }
  async deleteAllUserContacts(userId) {
    const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq6(campaigns.userId, userId));
    if (userCampaigns.length === 0) return 0;
    const campaignIds = userCampaigns.map((c) => c.id);
    const result = await db.delete(contacts).where(inArray2(contacts.campaignId, campaignIds)).returning();
    return result.length;
  }
  // Calls
  async getCall(id) {
    const [call] = await db.select().from(calls).where(eq6(calls.id, id));
    return call;
  }
  async getCallWithDetails(id) {
    const elevenLabsResults = await db.select({
      call: calls,
      campaign: campaigns,
      contact: contacts,
      incomingConnection: incomingConnections,
      widget: websiteWidgets
    }).from(calls).leftJoin(campaigns, eq6(calls.campaignId, campaigns.id)).leftJoin(contacts, eq6(calls.contactId, contacts.id)).leftJoin(incomingConnections, eq6(calls.incomingConnectionId, incomingConnections.id)).leftJoin(websiteWidgets, eq6(calls.widgetId, websiteWidgets.id)).where(eq6(calls.id, id));
    const staleThresholdMs = 60 * 60 * 1e3;
    const now = Date.now();
    if (elevenLabsResults.length > 0) {
      const r = elevenLabsResults[0];
      const metadataEngine = r.call.metadata?.engine;
      const engine = metadataEngine || "elevenlabs";
      let normalizedStatus = r.call.status;
      if (normalizedStatus === "in-progress" || normalizedStatus === "in_progress") {
        if (r.call.endedAt) {
          normalizedStatus = "completed";
        } else if (r.call.createdAt && now - new Date(r.call.createdAt).getTime() > staleThresholdMs) {
          normalizedStatus = "completed";
        }
      }
      return {
        ...r.call,
        status: normalizedStatus,
        engine,
        campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : null,
        contact: r.contact ? { id: r.contact.id, firstName: r.contact.firstName, lastName: r.contact.lastName, phone: r.contact.phone } : null,
        incomingConnection: r.incomingConnection ? { id: r.incomingConnection.id, agentId: r.incomingConnection.agentId } : null,
        widget: r.widget ? { id: r.widget.id, name: r.widget.name } : null
      };
    }
    const twilioOpenAIResults = await db.select({
      call: twilioOpenaiCalls,
      campaign: campaigns,
      contact: contacts,
      agent: agents
    }).from(twilioOpenaiCalls).leftJoin(campaigns, eq6(twilioOpenaiCalls.campaignId, campaigns.id)).leftJoin(contacts, eq6(twilioOpenaiCalls.contactId, contacts.id)).leftJoin(agents, eq6(twilioOpenaiCalls.agentId, agents.id)).where(eq6(twilioOpenaiCalls.id, id));
    if (twilioOpenAIResults.length > 0) {
      const r = twilioOpenAIResults[0];
      let normalizedStatus = r.call.status;
      if (normalizedStatus === "in-progress" || normalizedStatus === "in_progress") {
        if (r.call.endedAt) {
          normalizedStatus = "completed";
        } else if (r.call.createdAt && now - new Date(r.call.createdAt).getTime() > staleThresholdMs) {
          normalizedStatus = "completed";
        }
      }
      return {
        id: r.call.id,
        userId: r.call.userId,
        campaignId: r.call.campaignId,
        contactId: r.call.contactId,
        agentId: r.call.agentId,
        phoneNumber: r.call.fromNumber,
        fromNumber: r.call.fromNumber,
        toNumber: r.call.toNumber,
        twilioSid: r.call.twilioCallSid,
        status: normalizedStatus,
        callDirection: r.call.callDirection === "inbound" ? "incoming" : r.call.callDirection === "outbound" ? "outgoing" : r.call.callDirection,
        duration: r.call.duration,
        recordingUrl: r.call.recordingUrl,
        transcript: r.call.transcript,
        aiSummary: r.call.aiSummary,
        sentiment: r.call.sentiment,
        wasTransferred: r.call.wasTransferred,
        transferredTo: r.call.transferredTo,
        transferredAt: r.call.transferredAt,
        startedAt: r.call.startedAt,
        endedAt: r.call.endedAt,
        createdAt: r.call.createdAt,
        metadata: r.call.metadata,
        engine: "twilio-openai",
        openaiSessionId: r.call.openaiSessionId,
        openaiVoice: r.call.openaiVoice,
        openaiModel: r.call.openaiModel,
        campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : null,
        contact: r.contact ? { id: r.contact.id, firstName: r.contact.firstName, lastName: r.contact.lastName, phone: r.contact.phone } : null,
        incomingConnection: null,
        agent: r.agent ? { id: r.agent.id, name: r.agent.name } : null
      };
    }
    return void 0;
  }
  async getCampaignCalls(campaignId) {
    return db.select().from(calls).where(eq6(calls.campaignId, campaignId));
  }
  async getUserCalls(userId) {
    const results = await db.select({ calls }).from(calls).leftJoin(campaigns, eq6(calls.campaignId, campaigns.id)).leftJoin(incomingConnections, eq6(calls.incomingConnectionId, incomingConnections.id)).where(
      or2(
        eq6(calls.userId, userId),
        and6(isNotNull2(calls.campaignId), eq6(campaigns.userId, userId)),
        and6(isNotNull2(calls.incomingConnectionId), eq6(incomingConnections.userId, userId))
      )
    );
    return results.map((r) => r.calls);
  }
  async getUserCallsWithDetails(userId) {
    const elevenLabsResults = await db.select({
      call: calls,
      campaign: campaigns,
      contact: contacts,
      incomingConnection: incomingConnections,
      widget: websiteWidgets
    }).from(calls).leftJoin(campaigns, eq6(calls.campaignId, campaigns.id)).leftJoin(contacts, eq6(calls.contactId, contacts.id)).leftJoin(incomingConnections, eq6(calls.incomingConnectionId, incomingConnections.id)).leftJoin(websiteWidgets, eq6(calls.widgetId, websiteWidgets.id)).where(
      or2(
        // Primary filter: Direct user ownership (guaranteed isolation)
        eq6(calls.userId, userId),
        // Fallback for legacy calls: Check via campaign ownership
        and6(isNotNull2(calls.campaignId), eq6(campaigns.userId, userId)),
        // Fallback for legacy calls: Check via incoming connection ownership
        and6(isNotNull2(calls.incomingConnectionId), eq6(incomingConnections.userId, userId))
      )
    ).orderBy(sql4`${calls.createdAt} DESC`);
    const staleThresholdMs = 60 * 60 * 1e3;
    const now = Date.now();
    const elevenLabsCalls = elevenLabsResults.map((r) => {
      const metadataEngine = r.call.metadata?.engine;
      const engine = metadataEngine || "elevenlabs";
      let normalizedStatus = r.call.status;
      if (normalizedStatus === "in-progress" || normalizedStatus === "in_progress") {
        if (r.call.endedAt) {
          normalizedStatus = "completed";
        } else if (r.call.createdAt && now - new Date(r.call.createdAt).getTime() > staleThresholdMs) {
          normalizedStatus = "completed";
        }
      }
      return {
        ...r.call,
        status: normalizedStatus,
        engine,
        campaignName: r.campaign?.name || null,
        campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : null,
        contact: r.contact ? { id: r.contact.id, firstName: r.contact.firstName, lastName: r.contact.lastName, phone: r.contact.phone } : null,
        incomingConnection: r.incomingConnection ? { id: r.incomingConnection.id, agentId: r.incomingConnection.agentId } : null,
        widget: r.widget ? { id: r.widget.id, name: r.widget.name } : null
      };
    });
    const twilioOpenAIResults = await db.select({
      call: twilioOpenaiCalls,
      campaign: campaigns,
      contact: contacts,
      agent: agents
    }).from(twilioOpenaiCalls).leftJoin(campaigns, eq6(twilioOpenaiCalls.campaignId, campaigns.id)).leftJoin(contacts, eq6(twilioOpenaiCalls.contactId, contacts.id)).leftJoin(agents, eq6(twilioOpenaiCalls.agentId, agents.id)).where(eq6(twilioOpenaiCalls.userId, userId)).orderBy(sql4`${twilioOpenaiCalls.createdAt} DESC`);
    const twilioOpenAICalls = twilioOpenAIResults.map((r) => {
      let normalizedStatus = r.call.status;
      if (normalizedStatus === "in-progress" || normalizedStatus === "in_progress") {
        if (r.call.endedAt) {
          normalizedStatus = "completed";
        } else if (r.call.createdAt && now - new Date(r.call.createdAt).getTime() > staleThresholdMs) {
          normalizedStatus = "completed";
        }
      }
      return {
        id: r.call.id,
        userId: r.call.userId,
        campaignId: r.call.campaignId,
        contactId: r.call.contactId,
        agentId: r.call.agentId,
        phoneNumber: r.call.fromNumber,
        fromNumber: r.call.fromNumber,
        toNumber: r.call.toNumber,
        twilioSid: r.call.twilioCallSid,
        status: normalizedStatus,
        callDirection: r.call.callDirection === "inbound" ? "incoming" : "outgoing",
        duration: r.call.duration,
        recordingUrl: r.call.recordingUrl,
        transcript: r.call.transcript,
        aiSummary: r.call.aiSummary,
        classification: r.call.classification,
        sentiment: r.call.sentiment,
        wasTransferred: r.call.wasTransferred,
        transferredTo: r.call.transferredTo,
        transferredAt: r.call.transferredAt,
        startedAt: r.call.startedAt,
        endedAt: r.call.endedAt,
        createdAt: r.call.createdAt,
        metadata: r.call.metadata,
        engine: "twilio-openai",
        openaiSessionId: r.call.openaiSessionId,
        openaiVoice: r.call.openaiVoice,
        openaiModel: r.call.openaiModel,
        campaignName: r.campaign?.name || null,
        campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : null,
        contact: r.contact ? { id: r.contact.id, firstName: r.contact.firstName, lastName: r.contact.lastName, phone: r.contact.phone } : null,
        incomingConnection: null,
        agent: r.agent ? { id: r.agent.id, name: r.agent.name } : null
      };
    });
    const deduped = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const call of twilioOpenAICalls) {
      seenIds.add(call.id);
      if (call.campaignId && call.contactId) {
        const dupIdx = elevenLabsCalls.findIndex(
          (el) => el.campaignId === call.campaignId && el.contactId === call.contactId && Math.abs(new Date(el.createdAt).getTime() - new Date(call.createdAt).getTime()) < 5 * 60 * 1e3
        );
        if (dupIdx !== -1) {
          seenIds.add(elevenLabsCalls[dupIdx].id);
        }
      }
      deduped.push(call);
    }
    for (const call of elevenLabsCalls) {
      if (!seenIds.has(call.id)) {
        deduped.push(call);
      }
    }
    deduped.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return deduped;
  }
  async createCall(insertCall) {
    const [call] = await db.insert(calls).values(insertCall).returning();
    return call;
  }
  async updateCall(id, call) {
    await db.update(calls).set(call).where(eq6(calls.id, id));
  }
  // Call Responses (Screening Questions)
  async getCallResponses(callId) {
    return db.select().from(callResponses).where(eq6(callResponses.callId, callId));
  }
  async createCallResponse(response) {
    const [created] = await db.insert(callResponses).values(response).returning();
    return created;
  }
  async createCallResponses(responses) {
    if (responses.length === 0) return [];
    return db.insert(callResponses).values(responses).returning();
  }
  async deleteCallResponses(callId) {
    await db.delete(callResponses).where(eq6(callResponses.callId, callId));
  }
  async getConcernedQuestionsCount(callId) {
    const result = await db.select({ count: sql4`count(*)::int` }).from(callResponses).where(and6(eq6(callResponses.callId, callId), eq6(callResponses.isConcern, true)));
    return result[0]?.count || 0;
  }
  // Credit Transactions
  async getCreditTransaction(id) {
    const [transaction] = await db.select().from(creditTransactions).where(eq6(creditTransactions.id, id));
    return transaction;
  }
  async getUserCreditTransactions(userId) {
    return db.select().from(creditTransactions).where(eq6(creditTransactions.userId, userId));
  }
  async createCreditTransaction(insertTransaction) {
    const [transaction] = await db.insert(creditTransactions).values(insertTransaction).returning();
    return transaction;
  }
  // Atomic credit purchase: creates transaction + adds credits in single DB transaction
  async addCreditsAtomic(userId, credits, description, stripePaymentId) {
    await db.transaction(async (tx) => {
      await tx.insert(creditTransactions).values({
        userId,
        type: "credit",
        amount: credits,
        description,
        stripePaymentId
      });
      await tx.execute(sql4`
        UPDATE users 
        SET credits = COALESCE(credits, 0) + ${credits}
        WHERE id = ${userId}
      `);
    });
  }
  // Tools
  async getTool(id) {
    const [tool] = await db.select().from(tools).where(eq6(tools.id, id));
    return tool;
  }
  async getUserTools(userId) {
    return db.select().from(tools).where(eq6(tools.userId, userId));
  }
  async createTool(insertTool) {
    const [tool] = await db.insert(tools).values(insertTool).returning();
    return tool;
  }
  async updateTool(id, tool) {
    await db.update(tools).set(tool).where(eq6(tools.id, id));
  }
  async deleteTool(id) {
    await db.delete(tools).where(eq6(tools.id, id));
  }
  // Phone Number Rentals
  async createPhoneNumberRental(insertRental) {
    const [rental] = await db.insert(phoneNumberRentals).values(insertRental).returning();
    return rental;
  }
  async getPhoneNumberRentals(phoneNumberId) {
    return db.select().from(phoneNumberRentals).where(eq6(phoneNumberRentals.phoneNumberId, phoneNumberId)).orderBy(desc3(phoneNumberRentals.createdAt));
  }
  // Voices
  async getVoice(id) {
    const [voice] = await db.select().from(voices).where(eq6(voices.id, id));
    return voice;
  }
  async getUserVoices(userId) {
    return db.select().from(voices).where(eq6(voices.userId, userId));
  }
  async createVoice(insertVoice) {
    const [voice] = await db.insert(voices).values(insertVoice).returning();
    return voice;
  }
  async deleteVoice(id) {
    await db.delete(voices).where(eq6(voices.id, id));
  }
  // Plans
  async getPlan(id) {
    const [plan] = await db.select().from(plans).where(eq6(plans.id, id));
    return plan;
  }
  async getPlanByName(name) {
    const [plan] = await db.select().from(plans).where(eq6(plans.name, name));
    return plan;
  }
  async getAllPlans() {
    return db.select().from(plans).where(eq6(plans.isActive, true));
  }
  async createPlan(insertPlan) {
    const [plan] = await db.insert(plans).values(insertPlan).returning();
    return plan;
  }
  async updatePlan(id, plan) {
    const result = await db.update(plans).set(plan).where(eq6(plans.id, id)).returning({ id: plans.id });
    if (result.length === 0) {
      throw new Error(`Failed to update plan: Plan with id '${id}' not found`);
    }
  }
  async deletePlan(id) {
    await db.delete(plans).where(eq6(plans.id, id));
  }
  // Global Settings
  async getGlobalSetting(key) {
    const [setting] = await db.select().from(globalSettings).where(eq6(globalSettings.key, key));
    if (setting && setting.value !== null && setting.value !== void 0) {
      let val = setting.value;
      if (typeof val === "string" && val.startsWith('"') && val.endsWith('"')) {
        try {
          val = JSON.parse(val);
        } catch {
        }
      }
      return { ...setting, value: val };
    }
    return setting;
  }
  async updateGlobalSetting(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await db.execute(sql4`
        INSERT INTO global_settings (id, key, value, updated_at)
        VALUES (gen_random_uuid(), ${key}, ${jsonValue}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET 
          value = ${jsonValue}::jsonb,
          updated_at = NOW()
      `);
      console.log(`\u2705 [Settings] Saved setting '${key}' successfully`);
    } catch (error) {
      console.error(`\u274C [Settings] Failed to save setting '${key}':`, error.message);
      throw new Error(`Failed to save setting '${key}': ${error.message}`);
    }
  }
  // Credit Packages
  async getCreditPackage(id) {
    const [pack] = await db.select().from(creditPackages).where(eq6(creditPackages.id, id));
    return pack;
  }
  async getAllCreditPackages() {
    return db.select().from(creditPackages).where(eq6(creditPackages.isActive, true));
  }
  async createCreditPackage(insertPack) {
    const [pack] = await db.insert(creditPackages).values(insertPack).returning();
    return pack;
  }
  async updateCreditPackage(id, pack) {
    const result = await db.update(creditPackages).set(pack).where(eq6(creditPackages.id, id)).returning({ id: creditPackages.id });
    if (result.length === 0) {
      throw new Error(`Failed to update credit package: Package with id '${id}' not found`);
    }
  }
  // Admin Functions
  async getAllUsers() {
    return db.select().from(users).orderBy(desc3(users.createdAt));
  }
  async getAllAdminUsers() {
    return db.select().from(users).where(
      sql4`${users.role} = 'admin'`
    ).orderBy(desc3(users.createdAt));
  }
  async updateUser(id, user) {
    const result = await db.update(users).set(user).where(eq6(users.id, id)).returning({ id: users.id });
    if (result.length === 0) {
      throw new Error(`Failed to update user: User with id '${id}' not found`);
    }
  }
  async getSystemPhoneNumbers() {
    const results = await db.select({
      phone: phoneNumbers,
      user: users
    }).from(phoneNumbers).leftJoin(users, eq6(phoneNumbers.userId, users.id));
    return results.map((r) => ({
      ...r.phone,
      userEmail: r.user?.email
    }));
  }
  async getGlobalAnalytics(timeRange) {
    return calculateGlobalAnalytics(timeRange);
  }
  // User Subscriptions
  async getUserSubscription(userId) {
    const result = await db.select({
      subscription: userSubscriptions,
      plan: plans
    }).from(userSubscriptions).leftJoin(plans, eq6(userSubscriptions.planId, plans.id)).where(eq6(userSubscriptions.userId, userId)).orderBy(desc3(userSubscriptions.createdAt)).limit(1);
    if (result.length > 0 && result[0].subscription && result[0].plan) {
      return {
        ...result[0].subscription,
        plan: result[0].plan
      };
    }
    const [freePlan] = await db.select().from(plans).where(eq6(plans.name, "free")).limit(1);
    if (!freePlan) {
      return null;
    }
    return null;
  }
  async getAllUserSubscriptions() {
    return await db.select().from(userSubscriptions);
  }
  async getUserSubscriptionByPaystackCode(subscriptionCode) {
    const [subscription] = await db.select().from(userSubscriptions).where(eq6(userSubscriptions.paystackSubscriptionCode, subscriptionCode)).limit(1);
    return subscription;
  }
  async createUserSubscription(insertSubscription) {
    const [subscription] = await db.insert(userSubscriptions).values(insertSubscription).returning();
    return subscription;
  }
  async updateUserSubscription(id, subscription) {
    await db.update(userSubscriptions).set(subscription).where(eq6(userSubscriptions.id, id));
  }
  async updateUserSubscriptionByUserId(userId, subscription) {
    await db.update(userSubscriptions).set({ ...subscription, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(userSubscriptions.userId, userId));
  }
  // Get effective limits for a user - merges plan defaults with per-user overrides
  async getUserEffectiveLimits(userId) {
    const subscriptionWithPlan = await this.getUserSubscription(userId);
    const defaultLimits = {
      maxAgents: 1,
      maxCampaigns: 1,
      maxContactsPerCampaign: 5,
      maxWebhooks: 3,
      maxKnowledgeBases: 5,
      maxFlows: 3,
      maxPhoneNumbers: 0,
      includedCredits: 0,
      sources: {
        maxAgents: "plan",
        maxCampaigns: "plan",
        maxContactsPerCampaign: "plan",
        maxWebhooks: "plan",
        maxKnowledgeBases: "plan",
        maxFlows: "plan",
        maxPhoneNumbers: "plan",
        includedCredits: "plan"
      },
      planName: "free",
      planDisplayName: "Free"
    };
    if (!subscriptionWithPlan || !subscriptionWithPlan.plan) {
      const [freePlan] = await db.select().from(plans).where(eq6(plans.name, "free")).limit(1);
      if (freePlan) {
        return {
          maxAgents: freePlan.maxAgents,
          maxCampaigns: freePlan.maxCampaigns,
          maxContactsPerCampaign: freePlan.maxContactsPerCampaign,
          maxWebhooks: freePlan.maxWebhooks ?? 3,
          maxKnowledgeBases: freePlan.maxKnowledgeBases ?? 5,
          maxFlows: freePlan.maxFlows ?? 3,
          maxPhoneNumbers: freePlan.maxPhoneNumbers ?? 0,
          includedCredits: freePlan.includedCredits,
          sources: {
            maxAgents: "plan",
            maxCampaigns: "plan",
            maxContactsPerCampaign: "plan",
            maxWebhooks: "plan",
            maxKnowledgeBases: "plan",
            maxFlows: "plan",
            maxPhoneNumbers: "plan",
            includedCredits: "plan"
          },
          planName: freePlan.name,
          planDisplayName: freePlan.displayName
        };
      }
      return defaultLimits;
    }
    const plan = subscriptionWithPlan.plan;
    const sub = subscriptionWithPlan;
    return {
      maxAgents: sub.overrideMaxAgents ?? plan.maxAgents,
      maxCampaigns: sub.overrideMaxCampaigns ?? plan.maxCampaigns,
      maxContactsPerCampaign: sub.overrideMaxContactsPerCampaign ?? plan.maxContactsPerCampaign,
      maxWebhooks: sub.overrideMaxWebhooks ?? plan.maxWebhooks ?? 3,
      maxKnowledgeBases: sub.overrideMaxKnowledgeBases ?? plan.maxKnowledgeBases ?? 5,
      maxFlows: sub.overrideMaxFlows ?? plan.maxFlows ?? 3,
      maxPhoneNumbers: sub.overrideMaxPhoneNumbers ?? plan.maxPhoneNumbers ?? 0,
      includedCredits: sub.overrideIncludedCredits ?? plan.includedCredits,
      sources: {
        maxAgents: sub.overrideMaxAgents !== null ? "override" : "plan",
        maxCampaigns: sub.overrideMaxCampaigns !== null ? "override" : "plan",
        maxContactsPerCampaign: sub.overrideMaxContactsPerCampaign !== null ? "override" : "plan",
        maxWebhooks: sub.overrideMaxWebhooks !== null ? "override" : "plan",
        maxKnowledgeBases: sub.overrideMaxKnowledgeBases !== null ? "override" : "plan",
        maxFlows: sub.overrideMaxFlows !== null ? "override" : "plan",
        maxPhoneNumbers: sub.overrideMaxPhoneNumbers !== null ? "override" : "plan",
        includedCredits: sub.overrideIncludedCredits !== null ? "override" : "plan"
      },
      planName: plan.name,
      planDisplayName: plan.displayName
    };
  }
  // Phone Numbers
  async getPhoneNumber(id) {
    const [phoneNumber] = await db.select().from(phoneNumbers).where(eq6(phoneNumbers.id, id));
    return phoneNumber;
  }
  async getUserPhoneNumbers(userId) {
    return db.select().from(phoneNumbers).where(eq6(phoneNumbers.userId, userId));
  }
  async getAllPhoneNumbers() {
    return db.select().from(phoneNumbers);
  }
  async createPhoneNumber(insertPhoneNumber) {
    const [phoneNumber] = await db.insert(phoneNumbers).values(insertPhoneNumber).returning();
    return phoneNumber;
  }
  async updatePhoneNumber(id, phoneNumber) {
    await db.update(phoneNumbers).set(phoneNumber).where(eq6(phoneNumbers.id, id));
  }
  async deletePhoneNumber(id) {
    await db.delete(phoneNumbers).where(eq6(phoneNumbers.id, id));
  }
  // Usage Records
  async createUsageRecord(insertRecord) {
    const [record] = await db.insert(usageRecords).values(insertRecord).returning();
    return record;
  }
  async getUserUsageRecords(userId) {
    return db.select().from(usageRecords).where(eq6(usageRecords.userId, userId));
  }
  // Analytics methods - delegate to extracted helper functions
  async getUserAnalytics(userId, timeRange = "7days", callType = "all") {
    return calculateUserAnalytics(userId, timeRange, callType);
  }
  async getDashboardData(userId) {
    return calculateDashboardData(userId);
  }
  // Webhooks (Subscriptions)
  async getWebhook(id) {
    const [webhook] = await db.select().from(webhookSubscriptions).where(eq6(webhookSubscriptions.id, id));
    return webhook;
  }
  async getUserWebhooks(userId) {
    return await db.select().from(webhookSubscriptions).where(eq6(webhookSubscriptions.userId, userId)).orderBy(desc3(webhookSubscriptions.createdAt));
  }
  async getUserWebhookCount(userId) {
    const result = await db.select({ count: sql4`count(*)` }).from(webhookSubscriptions).where(eq6(webhookSubscriptions.userId, userId));
    return Number(result[0]?.count || 0);
  }
  async getWebhooksForEvent(userId, event, campaignId) {
    const allUserWebhooks = await db.select().from(webhookSubscriptions).where(and6(
      eq6(webhookSubscriptions.userId, userId),
      eq6(webhookSubscriptions.isActive, true)
    ));
    return allUserWebhooks.filter((webhook) => {
      if (!webhook.events.includes(event)) return false;
      if (campaignId && webhook.campaignIds && webhook.campaignIds.length > 0) {
        return webhook.campaignIds.includes(campaignId);
      }
      return true;
    });
  }
  async createWebhook(webhook) {
    const [newWebhook] = await db.insert(webhookSubscriptions).values({
      ...webhook,
      id: nanoid()
    }).returning();
    return newWebhook;
  }
  async updateWebhook(id, webhook) {
    const updateData = { ...webhook, updatedAt: /* @__PURE__ */ new Date() };
    await db.update(webhookSubscriptions).set(updateData).where(eq6(webhookSubscriptions.id, id));
  }
  async deleteWebhook(id) {
    await db.delete(webhookSubscriptions).where(eq6(webhookSubscriptions.id, id));
  }
  // Webhook Delivery Logs
  async getWebhookLog(id) {
    const [log] = await db.select().from(webhookDeliveryLogs).where(eq6(webhookDeliveryLogs.id, id));
    return log;
  }
  async getWebhookLogs(webhookId, limit = 50) {
    return await db.select().from(webhookDeliveryLogs).where(eq6(webhookDeliveryLogs.webhookId, webhookId)).orderBy(desc3(webhookDeliveryLogs.createdAt)).limit(limit);
  }
  async createWebhookLog(log) {
    const [newLog] = await db.insert(webhookDeliveryLogs).values(log).returning();
    return newLog;
  }
  async updateWebhookLog(id, log) {
    await db.update(webhookDeliveryLogs).set(log).where(eq6(webhookDeliveryLogs.id, id));
  }
  async getFailedWebhookLogs(limit = 100) {
    return await db.select().from(webhookDeliveryLogs).where(and6(
      eq6(webhookDeliveryLogs.success, false),
      isNotNull2(webhookDeliveryLogs.nextRetryAt)
    )).orderBy(asc(webhookDeliveryLogs.nextRetryAt)).limit(limit);
  }
  // Notifications
  async getNotification(id) {
    const [notification] = await db.select().from(notifications).where(eq6(notifications.id, id));
    return notification;
  }
  async getUserNotifications(userId, limit = 50) {
    return await db.select().from(notifications).where(eq6(notifications.userId, userId)).orderBy(desc3(notifications.createdAt)).limit(limit);
  }
  async getUnreadNotificationCount(userId) {
    const result = await db.select({ count: sql4`count(*)` }).from(notifications).where(and6(eq6(notifications.userId, userId), eq6(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }
  async createNotification(notification) {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }
  async markNotificationAsRead(id) {
    await db.update(notifications).set({ isRead: true }).where(eq6(notifications.id, id));
  }
  async markAllNotificationsAsRead(userId) {
    await db.update(notifications).set({ isRead: true }).where(eq6(notifications.userId, userId));
  }
  async getBannerNotifications(userId) {
    return await db.select().from(notifications).where(and6(
      eq6(notifications.userId, userId),
      or2(
        eq6(notifications.displayType, "banner"),
        eq6(notifications.displayType, "both")
      ),
      eq6(notifications.isDismissed, false),
      or2(
        isNull2(notifications.expiresAt),
        gte2(notifications.expiresAt, /* @__PURE__ */ new Date())
      )
    )).orderBy(desc3(notifications.priority), desc3(notifications.createdAt));
  }
  async dismissNotification(id, userId) {
    if (userId) {
      await db.update(notifications).set({ isDismissed: true }).where(and6(eq6(notifications.id, id), eq6(notifications.userId, userId)));
    } else {
      await db.update(notifications).set({ isDismissed: true }).where(eq6(notifications.id, id));
    }
  }
  async deleteNotification(id) {
    await db.delete(notifications).where(eq6(notifications.id, id));
  }
  // Email Templates
  async getEmailTemplates() {
    return await db.select().from(emailTemplates).orderBy(emailTemplates.templateType);
  }
  async getEmailTemplate(templateType) {
    const [template] = await db.select().from(emailTemplates).where(eq6(emailTemplates.templateType, templateType));
    return template;
  }
  async updateEmailTemplate(id, data) {
    await db.update(emailTemplates).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(emailTemplates.id, id));
  }
  async createEmailTemplate(data) {
    const [template] = await db.insert(emailTemplates).values(data).returning();
    return template;
  }
  // Prompt Templates
  async getPromptTemplate(id) {
    const [template] = await db.select().from(promptTemplates).where(eq6(promptTemplates.id, id));
    return template;
  }
  async getUserPromptTemplates(userId) {
    return await db.select().from(promptTemplates).where(eq6(promptTemplates.userId, userId)).orderBy(desc3(promptTemplates.createdAt));
  }
  async getSystemPromptTemplates() {
    return await db.select().from(promptTemplates).where(eq6(promptTemplates.isSystemTemplate, true)).orderBy(asc(promptTemplates.category), asc(promptTemplates.name));
  }
  async getPublicPromptTemplates() {
    return await db.select().from(promptTemplates).where(eq6(promptTemplates.isPublic, true)).orderBy(desc3(promptTemplates.usageCount), asc(promptTemplates.name));
  }
  async createPromptTemplate(template) {
    const [newTemplate] = await db.insert(promptTemplates).values(template).returning();
    return newTemplate;
  }
  async updatePromptTemplate(id, template) {
    await db.update(promptTemplates).set({ ...template, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(promptTemplates.id, id));
  }
  async deletePromptTemplate(id) {
    await db.delete(promptTemplates).where(eq6(promptTemplates.id, id));
  }
  async incrementPromptTemplateUsage(id) {
    await db.update(promptTemplates).set({
      usageCount: sql4`${promptTemplates.usageCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(promptTemplates.id, id));
  }
  // Agent Versions
  async getAgentVersion(id) {
    const [version] = await db.select().from(agentVersions).where(eq6(agentVersions.id, id));
    return version;
  }
  async getAgentVersions(agentId) {
    return await db.select().from(agentVersions).where(eq6(agentVersions.agentId, agentId)).orderBy(desc3(agentVersions.versionNumber));
  }
  async getAgentVersionByNumber(agentId, versionNumber) {
    const [version] = await db.select().from(agentVersions).where(and6(
      eq6(agentVersions.agentId, agentId),
      eq6(agentVersions.versionNumber, versionNumber)
    ));
    return version;
  }
  async getLatestAgentVersion(agentId) {
    const [version] = await db.select().from(agentVersions).where(eq6(agentVersions.agentId, agentId)).orderBy(desc3(agentVersions.versionNumber)).limit(1);
    return version;
  }
  async createAgentVersion(version) {
    const [newVersion] = await db.insert(agentVersions).values(version).returning();
    return newVersion;
  }
  // SEO Settings
  async getSeoSettings() {
    const [settings] = await db.select().from(seoSettings).limit(1);
    return settings;
  }
  async updateSeoSettings(settings) {
    const existing = await this.getSeoSettings();
    if (existing) {
      const updateData = { ...settings, updatedAt: /* @__PURE__ */ new Date() };
      const [updated] = await db.update(seoSettings).set(updateData).where(eq6(seoSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(seoSettings).values(settings).returning();
      return created;
    }
  }
  // Analytics Scripts
  async getAnalyticsScript(id) {
    const [script] = await db.select().from(analyticsScripts).where(eq6(analyticsScripts.id, id));
    return script;
  }
  async getAllAnalyticsScripts() {
    return db.select().from(analyticsScripts).orderBy(desc3(analyticsScripts.loadPriority), asc(analyticsScripts.createdAt));
  }
  async getEnabledAnalyticsScripts() {
    return db.select().from(analyticsScripts).where(eq6(analyticsScripts.enabled, true)).orderBy(desc3(analyticsScripts.loadPriority), asc(analyticsScripts.createdAt));
  }
  async createAnalyticsScript(script) {
    const [created] = await db.insert(analyticsScripts).values(script).returning();
    return created;
  }
  async updateAnalyticsScript(id, script) {
    const updateData = { ...script, updatedAt: /* @__PURE__ */ new Date() };
    await db.update(analyticsScripts).set(updateData).where(eq6(analyticsScripts.id, id));
  }
  async deleteAnalyticsScript(id) {
    await db.delete(analyticsScripts).where(eq6(analyticsScripts.id, id));
  }
  // Payment Transactions
  async getPaymentTransaction(id) {
    const [transaction] = await db.select().from(paymentTransactions).where(eq6(paymentTransactions.id, id));
    return transaction;
  }
  async getPaymentTransactionByGatewayId(gateway, gatewayTransactionId) {
    const [transaction] = await db.select().from(paymentTransactions).where(and6(
      eq6(paymentTransactions.gateway, gateway),
      eq6(paymentTransactions.gatewayTransactionId, gatewayTransactionId)
    ));
    return transaction;
  }
  async getUserPaymentTransactions(userId) {
    return db.select().from(paymentTransactions).where(eq6(paymentTransactions.userId, userId)).orderBy(desc3(paymentTransactions.createdAt));
  }
  async getAllPaymentTransactions(filters) {
    const conditions = [];
    if (filters?.gateway) {
      conditions.push(eq6(paymentTransactions.gateway, filters.gateway));
    }
    if (filters?.type) {
      conditions.push(eq6(paymentTransactions.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq6(paymentTransactions.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte2(paymentTransactions.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte2(paymentTransactions.createdAt, filters.endDate));
    }
    if (conditions.length > 0) {
      return db.select().from(paymentTransactions).where(and6(...conditions)).orderBy(desc3(paymentTransactions.createdAt));
    }
    return db.select().from(paymentTransactions).orderBy(desc3(paymentTransactions.createdAt));
  }
  async createPaymentTransaction(transaction) {
    const [created] = await db.insert(paymentTransactions).values(transaction).returning();
    return created;
  }
  async updatePaymentTransaction(id, transaction) {
    await db.update(paymentTransactions).set({ ...transaction, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(paymentTransactions.id, id));
  }
  async getPaymentAnalytics(startDate, endDate) {
    const revenueStatuses = ["completed", "refunded", "partially_refunded"];
    const conditions = [];
    if (startDate) conditions.push(gte2(paymentTransactions.createdAt, startDate));
    if (endDate) conditions.push(lte2(paymentTransactions.createdAt, endDate));
    const transactions = await db.select().from(paymentTransactions).where(
      conditions.length > 0 ? and6(
        inArray2(paymentTransactions.status, revenueStatuses),
        ...conditions
      ) : inArray2(paymentTransactions.status, revenueStatuses)
    );
    const dateConditions = [];
    if (startDate) dateConditions.push(gte2(paymentTransactions.createdAt, startDate));
    if (endDate) dateConditions.push(lte2(paymentTransactions.createdAt, endDate));
    const allTransactions = await db.select().from(paymentTransactions).where(dateConditions.length > 0 ? and6(...dateConditions) : void 0);
    const refundConditions = [];
    if (startDate) refundConditions.push(gte2(refunds.createdAt, startDate));
    if (endDate) refundConditions.push(lte2(refunds.createdAt, endDate));
    const allRefunds = await db.select().from(refunds).where(refundConditions.length > 0 ? and6(...refundConditions) : void 0);
    let totalRevenue = 0;
    const revenueByGateway = {};
    const revenueByType = {};
    const transactionsByStatus = {};
    for (const tx of transactions) {
      const amount = parseFloat(tx.amount || "0");
      totalRevenue += amount;
      revenueByGateway[tx.gateway] = (revenueByGateway[tx.gateway] || 0) + amount;
      revenueByType[tx.type] = (revenueByType[tx.type] || 0) + amount;
    }
    for (const tx of allTransactions) {
      transactionsByStatus[tx.status] = (transactionsByStatus[tx.status] || 0) + 1;
    }
    let totalRefunded = 0;
    for (const refund of allRefunds) {
      totalRefunded += parseFloat(refund.amount || "0");
    }
    return {
      totalRevenue,
      revenueByGateway,
      revenueByType,
      transactionCount: allTransactions.length,
      transactionsByStatus,
      refundCount: allRefunds.length,
      totalRefunded
    };
  }
  // Refunds
  async getRefund(id) {
    const [refund] = await db.select().from(refunds).where(eq6(refunds.id, id));
    return refund;
  }
  async getTransactionRefunds(transactionId) {
    return db.select().from(refunds).where(eq6(refunds.transactionId, transactionId)).orderBy(desc3(refunds.createdAt));
  }
  async getUserRefunds(userId) {
    return db.select().from(refunds).where(eq6(refunds.userId, userId)).orderBy(desc3(refunds.createdAt));
  }
  async getAllRefunds() {
    return db.select().from(refunds).orderBy(desc3(refunds.createdAt));
  }
  async createRefund(refund) {
    const [created] = await db.insert(refunds).values(refund).returning();
    return created;
  }
  async updateRefund(id, refund) {
    await db.update(refunds).set({ ...refund, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(refunds.id, id));
  }
  // Invoices
  async getInvoice(id) {
    const [invoice] = await db.select().from(invoices).where(eq6(invoices.id, id));
    return invoice;
  }
  async getInvoiceByNumber(invoiceNumber) {
    const [invoice] = await db.select().from(invoices).where(eq6(invoices.invoiceNumber, invoiceNumber));
    return invoice;
  }
  async getTransactionInvoice(transactionId) {
    const [invoice] = await db.select().from(invoices).where(eq6(invoices.transactionId, transactionId));
    return invoice;
  }
  async getUserInvoices(userId) {
    return db.select().from(invoices).where(eq6(invoices.userId, userId)).orderBy(desc3(invoices.createdAt));
  }
  async getAllInvoices() {
    return db.select().from(invoices).orderBy(desc3(invoices.createdAt));
  }
  async createInvoice(invoice) {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }
  async updateInvoice(id, invoice) {
    await db.update(invoices).set({ ...invoice, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(invoices.id, id));
  }
  async getNextInvoiceNumber() {
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const [prefixSetting] = await db.select().from(globalSettings).where(eq6(globalSettings.key, "invoice_prefix"));
    let rawPrefix = prefixSetting?.value ? String(prefixSetting.value).replace(/"/g, "") : "INV";
    const prefix = rawPrefix.replace(/[^A-Za-z0-9_]/g, "").substring(0, 10) || "INV";
    const [startSetting] = await db.select().from(globalSettings).where(eq6(globalSettings.key, "invoice_start_number"));
    const startNumber = startSetting?.value ? parseInt(String(startSetting.value).replace(/"/g, ""), 10) || 1 : 1;
    const likePattern = `${prefix}-${year}-%`;
    const result = await db.execute(sql4`
      SELECT MAX(CAST(SPLIT_PART(${invoices.invoiceNumber}, '-', 3) AS INTEGER)) as max_num
      FROM ${invoices}
      WHERE ${invoices.invoiceNumber} LIKE ${likePattern}
    `);
    let nextNum = startNumber;
    const maxNum = result.rows?.[0]?.max_num;
    if (maxNum !== null && maxNum !== void 0 && !isNaN(Number(maxNum))) {
      nextNum = Math.max(Number(maxNum) + 1, startNumber);
    }
    return `${prefix}-${year}-${String(nextNum).padStart(5, "0")}`;
  }
  async getNextRefundNoteNumber() {
    const [prefixSetting] = await db.select().from(globalSettings).where(eq6(globalSettings.key, "refund_note_prefix"));
    let rawPrefix = prefixSetting?.value ? String(prefixSetting.value).replace(/"/g, "") : "RF";
    const prefix = rawPrefix.replace(/[^A-Za-z0-9]/g, "").substring(0, 10) || "RF";
    const result = await db.execute(sql4`
      SELECT MAX(
        CAST(
          REGEXP_REPLACE(refund_note_number, '^[A-Za-z]+', '', 'g') 
          AS INTEGER
        )
      ) as max_num
      FROM refunds
      WHERE refund_note_number ~ ${`^${prefix}[0-9]+$`}
    `);
    let nextNum = 1;
    const maxNum = result.rows?.[0]?.max_num;
    if (maxNum !== null && maxNum !== void 0 && !isNaN(Number(maxNum))) {
      nextNum = Number(maxNum) + 1;
    }
    return `${prefix}${String(nextNum).padStart(2, "0")}`;
  }
  // Payment Webhook Queue
  async getWebhookQueueItem(id) {
    const [item] = await db.select().from(paymentWebhookQueue).where(eq6(paymentWebhookQueue.id, id));
    return item;
  }
  async getPendingWebhooks() {
    return db.select().from(paymentWebhookQueue).where(eq6(paymentWebhookQueue.status, "pending")).orderBy(asc(paymentWebhookQueue.receivedAt));
  }
  async getWebhookByEventId(gateway, eventId) {
    const [item] = await db.select().from(paymentWebhookQueue).where(and6(
      eq6(paymentWebhookQueue.gateway, gateway),
      eq6(paymentWebhookQueue.eventId, eventId)
    ));
    return item;
  }
  async createWebhookQueueItem(item) {
    const [created] = await db.insert(paymentWebhookQueue).values(item).returning();
    return created;
  }
  async updateWebhookQueueItem(id, item) {
    await db.update(paymentWebhookQueue).set(item).where(eq6(paymentWebhookQueue.id, id));
  }
  async getExpiredWebhooks() {
    const now = /* @__PURE__ */ new Date();
    return db.select().from(paymentWebhookQueue).where(and6(
      eq6(paymentWebhookQueue.status, "pending"),
      lte2(paymentWebhookQueue.expiresAt, now)
    ));
  }
  async getRetryableWebhooks() {
    const now = /* @__PURE__ */ new Date();
    return db.select().from(paymentWebhookQueue).where(and6(
      or2(
        eq6(paymentWebhookQueue.status, "pending"),
        eq6(paymentWebhookQueue.status, "failed")
      ),
      sql4`${paymentWebhookQueue.attemptCount} < ${paymentWebhookQueue.maxAttempts}`,
      or2(
        isNull2(paymentWebhookQueue.nextRetryAt),
        lte2(paymentWebhookQueue.nextRetryAt, now)
      ),
      gte2(paymentWebhookQueue.expiresAt, now)
    )).orderBy(asc(paymentWebhookQueue.receivedAt));
  }
  // Email Notification Settings
  async getEmailNotificationSetting(eventType) {
    const [setting] = await db.select().from(emailNotificationSettings).where(eq6(emailNotificationSettings.eventType, eventType));
    return setting;
  }
  async getAllEmailNotificationSettings() {
    return db.select().from(emailNotificationSettings).orderBy(asc(emailNotificationSettings.category), asc(emailNotificationSettings.eventType));
  }
  async getEmailNotificationSettingsByCategory(category) {
    return db.select().from(emailNotificationSettings).where(eq6(emailNotificationSettings.category, category)).orderBy(asc(emailNotificationSettings.eventType));
  }
  async createEmailNotificationSetting(setting) {
    const [created] = await db.insert(emailNotificationSettings).values(setting).returning();
    return created;
  }
  async updateEmailNotificationSetting(eventType, setting) {
    await db.update(emailNotificationSettings).set({ ...setting, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(emailNotificationSettings.eventType, eventType));
  }
  // Admin Call Monitoring
  async getAdminCalls(options) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (options.userId) {
      conditions.push(eq6(calls.userId, options.userId));
    }
    if (options.status) {
      conditions.push(eq6(calls.status, options.status));
    }
    if (options.startDate) {
      conditions.push(gte2(calls.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte2(calls.createdAt, options.endDate));
    }
    if (options.search) {
      conditions.push(
        or2(
          sql4`${calls.phoneNumber} ILIKE ${`%${options.search}%`}`,
          sql4`${calls.transcript} ILIKE ${`%${options.search}%`}`
        )
      );
    }
    const whereClause = conditions.length > 0 ? and6(...conditions) : void 0;
    const violationCountSubquery = db.select({
      callId: contentViolations.callId,
      count: sql4`count(*)`.as("violation_count"),
      summary: sql4`string_agg(${contentViolations.detectedWord}, ', ' ORDER BY ${contentViolations.createdAt} DESC)`.as("violation_summary")
    }).from(contentViolations).groupBy(contentViolations.callId).as("violation_counts");
    let query = db.select({
      call: calls,
      user: {
        id: users.id,
        email: users.email,
        name: users.name
      },
      campaign: {
        id: campaigns.id,
        name: campaigns.name
      },
      violationCount: sql4`COALESCE(${violationCountSubquery.count}, 0)`,
      violationSummary: sql4`${violationCountSubquery.summary}`
    }).from(calls).leftJoin(users, eq6(calls.userId, users.id)).leftJoin(campaigns, eq6(calls.campaignId, campaigns.id)).leftJoin(violationCountSubquery, eq6(calls.id, violationCountSubquery.callId));
    if (whereClause) {
      query = query.where(whereClause);
    }
    if (options.hasViolations === true) {
      query = query.where(sql4`COALESCE(${violationCountSubquery.count}, 0) > 0`);
    } else if (options.hasViolations === false) {
      query = query.where(sql4`COALESCE(${violationCountSubquery.count}, 0) = 0`);
    }
    const results = await query.orderBy(desc3(calls.createdAt)).limit(pageSize).offset(offset);
    const countResult = await db.select({ count: sql4`count(*)` }).from(calls).where(whereClause);
    const totalItems = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      data: results.map((r) => ({
        ...r.call,
        user: r.user,
        campaign: r.campaign,
        violationCount: Number(r.violationCount),
        violationSummary: r.violationSummary || null
      })),
      pagination: { page, pageSize, totalItems, totalPages }
    };
  }
  async getAdminCallById(id) {
    const [result] = await db.select({
      call: calls,
      user: {
        id: users.id,
        email: users.email,
        name: users.name
      },
      campaign: {
        id: campaigns.id,
        name: campaigns.name
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
        email: contacts.email
      }
    }).from(calls).leftJoin(users, eq6(calls.userId, users.id)).leftJoin(campaigns, eq6(calls.campaignId, campaigns.id)).leftJoin(contacts, eq6(calls.contactId, contacts.id)).where(eq6(calls.id, id));
    if (!result) return void 0;
    const violations = await this.getViolationsByCallId(id);
    return {
      ...result.call,
      user: result.user,
      campaign: result.campaign,
      contact: result.contact,
      violations
    };
  }
  async getUserById(id) {
    return this.getUser(id);
  }
  // Content Violations
  async getViolationsByCallId(callId) {
    return db.select().from(contentViolations).where(eq6(contentViolations.callId, callId)).orderBy(desc3(contentViolations.createdAt));
  }
  async getContentViolations(options) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (options.userId) {
      conditions.push(eq6(contentViolations.userId, options.userId));
    }
    if (options.status) {
      conditions.push(eq6(contentViolations.status, options.status));
    }
    if (options.severity) {
      conditions.push(eq6(contentViolations.severity, options.severity));
    }
    if (options.startDate) {
      conditions.push(gte2(contentViolations.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte2(contentViolations.createdAt, options.endDate));
    }
    const whereClause = conditions.length > 0 ? and6(...conditions) : void 0;
    let query = db.select({
      violation: contentViolations,
      user: {
        id: users.id,
        email: users.email,
        name: users.name
      },
      call: {
        id: calls.id,
        phoneNumber: calls.phoneNumber,
        status: calls.status
      }
    }).from(contentViolations).leftJoin(users, eq6(contentViolations.userId, users.id)).leftJoin(calls, eq6(contentViolations.callId, calls.id));
    if (whereClause) {
      query = query.where(whereClause);
    }
    const results = await query.orderBy(desc3(contentViolations.createdAt)).limit(pageSize).offset(offset);
    const countResult = await db.select({ count: sql4`count(*)` }).from(contentViolations).where(whereClause);
    const totalItems = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      data: results.map((r) => ({
        ...r.violation,
        user: r.user,
        call: r.call
      })),
      pagination: { page, pageSize, totalItems, totalPages }
    };
  }
  async updateContentViolation(id, data) {
    const [updated] = await db.update(contentViolations).set(data).where(eq6(contentViolations.id, id)).returning();
    return updated;
  }
  async createContentViolation(data) {
    const [violation] = await db.insert(contentViolations).values(data).returning();
    return violation;
  }
  // Banned Words
  async getBannedWords() {
    return db.select().from(bannedWords).orderBy(asc(bannedWords.word));
  }
  async getActiveBannedWords() {
    return db.select().from(bannedWords).where(eq6(bannedWords.isActive, true)).orderBy(asc(bannedWords.word));
  }
  async createBannedWord(data) {
    const [word] = await db.insert(bannedWords).values(data).returning();
    return word;
  }
  async updateBannedWord(id, data) {
    const [updated] = await db.update(bannedWords).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(bannedWords.id, id)).returning();
    return updated;
  }
  async deleteBannedWord(id) {
    const result = await db.delete(bannedWords).where(eq6(bannedWords.id, id)).returning();
    return result.length > 0;
  }
  async getCallsWithTranscripts() {
    return db.select().from(calls).where(and6(
      isNotNull2(calls.transcript),
      sql4`${calls.transcript} != ''`
    ));
  }
  // Demo Sessions - Browser-based demo calls
  async createDemoSession(data) {
    const [session] = await db.insert(demoSessions).values(data).returning();
    return session;
  }
  async getDemoSession(id) {
    const [session] = await db.select().from(demoSessions).where(eq6(demoSessions.id, id));
    return session;
  }
  async getDemoSessionByToken(token) {
    const [session] = await db.select().from(demoSessions).where(eq6(demoSessions.sessionToken, token));
    return session;
  }
  async updateDemoSession(id, data) {
    await db.update(demoSessions).set(data).where(eq6(demoSessions.id, id));
  }
  async getActiveDemoSessionCount() {
    const result = await db.select({ count: sql4`count(*)` }).from(demoSessions).where(eq6(demoSessions.status, "active"));
    return Number(result[0]?.count || 0);
  }
  async getRecentDemoSessionByIp(ip, cooldownMinutes) {
    const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1e3);
    const [session] = await db.select().from(demoSessions).where(and6(
      eq6(demoSessions.visitorIp, ip),
      gte2(demoSessions.createdAt, cooldownTime)
    )).orderBy(desc3(demoSessions.createdAt)).limit(1);
    return session;
  }
  async getDemoSessionStats(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
    const sessions = await db.select().from(demoSessions).where(gte2(demoSessions.createdAt, startDate));
    const completed = sessions.filter((s) => s.status === "completed");
    const totalDuration = completed.reduce((sum, s) => sum + (s.duration || 0), 0);
    const languageBreakdown = {};
    for (const session of sessions) {
      languageBreakdown[session.language] = (languageBreakdown[session.language] || 0) + 1;
    }
    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      averageDuration: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
      languageBreakdown
    };
  }
  // Agent Presets
  async getAgentPresets() {
    return db.select().from(agentPresets).where(eq6(agentPresets.isActive, true)).orderBy(asc(agentPresets.sortOrder));
  }
  async getAgentPreset(id) {
    const [preset] = await db.select().from(agentPresets).where(eq6(agentPresets.id, id));
    return preset;
  }
  async createBedrockKBFile(data) {
    const [file] = await db.insert(bedrockKbFiles).values(data).returning();
    return file;
  }
  async getBedrockKBFiles(userId) {
    return db.select().from(bedrockKbFiles).where(eq6(bedrockKbFiles.userId, userId)).orderBy(desc3(bedrockKbFiles.createdAt));
  }
  async getBedrockKBFile(fileId) {
    const [file] = await db.select().from(bedrockKbFiles).where(eq6(bedrockKbFiles.id, fileId));
    return file;
  }
  async updateBedrockKBFile(fileId, data) {
    await db.update(bedrockKbFiles).set(data).where(eq6(bedrockKbFiles.id, fileId));
  }
  async deleteBedrockKBFile(fileId) {
    await db.delete(bedrockKbFiles).where(eq6(bedrockKbFiles.id, fileId));
  }
  // Callpilot Tasks
  async getOpsTask(id) {
    const [task] = await db.select().from(opsTasks).where(eq6(opsTasks.id, id));
    return task;
  }
  async getUserOpsTasks(userId, filters) {
    const conditions = [eq6(opsTasks.userId, userId), eq6(opsTasks.isDeleted, false)];
    if (filters?.status) conditions.push(eq6(opsTasks.status, filters.status));
    if (filters?.taskType) conditions.push(eq6(opsTasks.taskType, filters.taskType));
    if (filters?.priority) conditions.push(eq6(opsTasks.priority, filters.priority));
    if (filters?.startDate) conditions.push(gte2(opsTasks.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte2(opsTasks.createdAt, filters.endDate));
    return db.select().from(opsTasks).where(and6(...conditions)).orderBy(desc3(opsTasks.createdAt));
  }
  async getCallOpsTasks(callId) {
    return db.select().from(opsTasks).where(
      and6(eq6(opsTasks.callId, callId), eq6(opsTasks.isDeleted, false))
    ).orderBy(desc3(opsTasks.createdAt));
  }
  async getRecentUnanalyzedCalls(userId, limit) {
    const analyzedRuns = await db.select({ callId: opsAnalysisRuns.callId }).from(opsAnalysisRuns).where(eq6(opsAnalysisRuns.userId, userId));
    const analyzedIds = analyzedRuns.map((r) => r.callId);
    const baseConditions = and6(
      eq6(twilioOpenaiCalls.userId, userId),
      isNotNull2(twilioOpenaiCalls.transcript)
    );
    const whereClause = analyzedIds.length > 0 ? and6(baseConditions, notInArray(twilioOpenaiCalls.id, analyzedIds)) : baseConditions;
    return db.select().from(twilioOpenaiCalls).where(whereClause).orderBy(desc3(twilioOpenaiCalls.createdAt)).limit(limit);
  }
  async getAllUnanalyzedCalls(limit) {
    const analyzedIds = await db.select({ callId: opsAnalysisRuns.callId }).from(opsAnalysisRuns);
    const ids = analyzedIds.map((r) => r.callId);
    const whereClause = ids.length > 0 ? and6(isNotNull2(twilioOpenaiCalls.transcript), isNotNull2(twilioOpenaiCalls.userId), notInArray(twilioOpenaiCalls.id, ids)) : and6(isNotNull2(twilioOpenaiCalls.transcript), isNotNull2(twilioOpenaiCalls.userId));
    return db.select().from(twilioOpenaiCalls).where(whereClause).orderBy(desc3(twilioOpenaiCalls.createdAt)).limit(limit);
  }
  async recordOpsAnalysisRun(userId, callId, tasksCreated) {
    await db.insert(opsAnalysisRuns).values({ userId, callId, tasksCreated }).onConflictDoNothing();
  }
  async createOpsTask(data) {
    const [task] = await db.insert(opsTasks).values(data).returning();
    return task;
  }
  async createOpsTasks(data) {
    if (data.length === 0) return [];
    return db.insert(opsTasks).values(data).returning();
  }
  async updateOpsTask(id, data) {
    const [task] = await db.update(opsTasks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(opsTasks.id, id)).returning();
    return task;
  }
  async deleteOpsTask(id) {
    await db.update(opsTasks).set({ isDeleted: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(opsTasks.id, id));
  }
  async deleteOpsTasksByCallId(callId, userId) {
    const deleted = await db.update(opsTasks).set({ isDeleted: true, updatedAt: /* @__PURE__ */ new Date() }).where(and6(eq6(opsTasks.callId, callId), eq6(opsTasks.userId, userId))).returning();
    return deleted.length;
  }
  async deleteOpsAnalysisRun(callId) {
    await db.delete(opsAnalysisRuns).where(eq6(opsAnalysisRuns.callId, callId));
  }
  async getOpsTaskStats(userId) {
    const tasks = await db.select().from(opsTasks).where(
      and6(eq6(opsTasks.userId, userId), eq6(opsTasks.isDeleted, false))
    );
    const stats = { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: tasks.length };
    for (const t of tasks) {
      const s = t.status;
      if (s in stats) stats[s]++;
    }
    return stats;
  }
  async getOpsMetrics(userId, startDate, endDate) {
    const callConditions = [eq6(calls.userId, userId), isNotNull2(calls.transcript)];
    if (startDate) callConditions.push(gte2(calls.createdAt, startDate));
    if (endDate) callConditions.push(lte2(calls.createdAt, endDate));
    const userCalls = await db.select({
      id: calls.id,
      duration: calls.duration,
      sentiment: calls.sentiment,
      sessionOutcome: calls.sessionOutcome
    }).from(calls).where(and6(...callConditions));
    const taskConditions = [eq6(opsTasks.userId, userId), eq6(opsTasks.isDeleted, false)];
    if (startDate) taskConditions.push(gte2(opsTasks.createdAt, startDate));
    if (endDate) taskConditions.push(lte2(opsTasks.createdAt, endDate));
    const userTasks = await db.select({
      status: opsTasks.status,
      callId: opsTasks.callId
    }).from(opsTasks).where(and6(...taskConditions));
    const callsWithDuration = userCalls.filter((c) => c.duration && c.duration > 0);
    const aht = callsWithDuration.length > 0 ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length) : 0;
    const resolvedKeywords = ["resolved", "completed", "success", "done", "satisfied"];
    const fcrCalls = userCalls.filter(
      (c) => c.sessionOutcome && resolvedKeywords.some((kw) => c.sessionOutcome.toLowerCase().includes(kw))
    );
    const fcrRate = userCalls.length > 0 ? Math.round(fcrCalls.length / userCalls.length * 100) : 0;
    const completedTasks = userTasks.filter((t) => t.status === "completed");
    const taskCompletionRate = userTasks.length > 0 ? Math.round(completedTasks.length / userTasks.length * 100) : 0;
    const sentimentBreakdown = {};
    for (const c of userCalls) {
      const s = (c.sentiment || "unknown").toLowerCase();
      sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1;
    }
    const analyzedCallIds = new Set(userTasks.map((t) => t.callId).filter(Boolean));
    const agentProductivity = analyzedCallIds.size;
    return {
      aht,
      fcrRate,
      taskCompletionRate,
      sentimentBreakdown,
      agentProductivity,
      totalCallsAnalyzed: analyzedCallIds.size,
      totalTasksCreated: userTasks.length
    };
  }
  // Products
  async getProduct(id) {
    const [product] = await db.select().from(products).where(eq6(products.id, id));
    return product;
  }
  async getUserProducts(userId) {
    return db.select().from(products).where(eq6(products.userId, userId)).orderBy(desc3(products.createdAt));
  }
  async createProduct(product) {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }
  async createProducts(items) {
    if (items.length === 0) return [];
    return db.insert(products).values(items).returning();
  }
  async updateProduct(id, product) {
    const [updated] = await db.update(products).set({ ...product, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(products.id, id)).returning();
    return updated;
  }
  async deleteProduct(id) {
    await db.delete(products).where(eq6(products.id, id));
  }
  // User SMTP Settings
  async getUserSmtpSettings(userId) {
    const [settings] = await db.select().from(userSmtpSettings).where(eq6(userSmtpSettings.userId, userId));
    return settings;
  }
  async upsertUserSmtpSettings(settings) {
    const existing = await this.getUserSmtpSettings(settings.userId);
    if (existing) {
      const [updated] = await db.update(userSmtpSettings).set({ ...settings, isVerified: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(userSmtpSettings.userId, settings.userId)).returning();
      return updated;
    }
    const [created] = await db.insert(userSmtpSettings).values(settings).returning();
    return created;
  }
  async deleteUserSmtpSettings(userId) {
    await db.delete(userSmtpSettings).where(eq6(userSmtpSettings.userId, userId));
  }
  async updateUserSmtpVerified(userId, isVerified) {
    await db.update(userSmtpSettings).set({ isVerified, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(userSmtpSettings.userId, userId));
  }
};
var storage = new DbStorage();

// server/utils/errors.ts
var AppError = class _AppError extends Error {
  statusCode;
  code;
  isOperational;
  context;
  timestamp;
  cause;
  /**
   * Creates an instance of AppError.
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} code - Machine-readable error code (default: 'INTERNAL_ERROR')
   * @param {boolean} isOperational - Whether this is an operational error (default: true)
   * @param {Record<string, unknown>} context - Additional context for debugging
   * @param {Error} cause - Original error that caused this error (for error wrapping)
   */
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", isOperational = true, context, cause) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
  /**
   * Converts the error to a JSON-serializable object for API responses.
   * Excludes sensitive information like stack traces in production.
   * @returns {object} JSON representation of the error
   */
  toJSON() {
    const json = {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
    if (process.env.NODE_ENV === "development" && this.context) {
      json.context = this.context;
    }
    return json;
  }
  /**
   * Wraps an existing error with additional context.
   * @param {Error} originalError - The original error to wrap
   * @param {string} message - New message for context
   * @param {Record<string, unknown>} additionalContext - Extra context to add
   * @returns {AppError} Wrapped error instance
   */
  static wrap(originalError, message, additionalContext) {
    const context = {
      originalMessage: originalError.message,
      originalName: originalError.name,
      ...additionalContext
    };
    return new _AppError(
      message,
      500,
      "WRAPPED_ERROR",
      true,
      context,
      originalError
    );
  }
};
var ExternalServiceError = class extends AppError {
  serviceName;
  serviceError;
  constructor(serviceName, message, originalError, context) {
    super(
      message,
      502,
      "EXTERNAL_SERVICE_ERROR",
      true,
      {
        ...context,
        serviceName,
        serviceError: originalError?.message
      },
      originalError
    );
    this.serviceName = serviceName;
    this.serviceError = originalError?.message;
  }
};

// server/services/twilio-connector.ts
async function getCredentials() {
  const dbAccountSid = await storage.getGlobalSetting("twilio_account_sid");
  const dbAuthToken = await storage.getGlobalSetting("twilio_auth_token");
  if (dbAccountSid?.value && dbAuthToken?.value) {
    console.log("\u{1F4DE} Using Twilio credentials from database");
    return {
      accountSid: dbAccountSid.value,
      apiKey: dbAccountSid.value,
      apiKeySecret: dbAuthToken.value,
      phoneNumber: null
    };
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    console.log("\u{1F4DE} Using Twilio credentials from environment variables");
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      apiKey: process.env.TWILIO_ACCOUNT_SID,
      apiKeySecret: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: null
    };
  }
  throw new ExternalServiceError(
    "Twilio",
    "No Twilio credentials found. Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file or via Admin Panel > Settings.",
    void 0,
    { operation: "getCredentials" }
  );
}
async function getTwilioClient() {
  const credentials = await getCredentials();
  return twilio(credentials.apiKey, credentials.apiKeySecret, {
    accountSid: credentials.accountSid
  });
}

// plugins/sip-engine/routes/sip-twilio-onboard.routes.ts
var connectSchema = z6.object({
  trunkName: z6.string().min(1).max(100),
  sipHost: z6.string().min(1),
  sipPort: z6.number().int().min(1).max(65535).default(5061),
  transport: z6.enum(["udp", "tcp", "tls"]).default("tls"),
  mediaEncryption: z6.enum(["require", "prefer", "none"]).default("require"),
  phoneNumbers: z6.array(z6.object({
    phoneNumber: z6.string().min(1),
    friendlyName: z6.string().optional(),
    manual: z6.boolean().optional()
  })).min(1).max(100)
});
function setupSipTwilioOnboardRoutes(app, sessionAuth) {
  app.get("/api/sip/twilio/list-numbers", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      try {
        const client = await getTwilioClient();
        const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
        const phoneNumbers2 = numbers.map((num) => ({
          sid: num.sid,
          phoneNumber: num.phoneNumber,
          friendlyName: num.friendlyName,
          country: num.isoCountry || null,
          capabilities: {
            voice: num.capabilities?.voice ?? false,
            sms: num.capabilities?.sms ?? false,
            mms: num.capabilities?.mms ?? false
          }
        }));
        res.json({ phoneNumbers: phoneNumbers2, total: phoneNumbers2.length });
      } catch (twilioError) {
        if (twilioError.status === 401 || twilioError.code === 20003) {
          return res.status(500).json({ error: "Twilio credentials are not configured properly. Please contact your administrator." });
        }
        throw twilioError;
      }
    } catch (error) {
      console.error("[SIP Twilio Onboard] List numbers error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/twilio/connect", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = connectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const { trunkName, sipHost, sipPort, transport, mediaEncryption, phoneNumbers: phoneNumbers2 } = validation.data;
      const twilioNumbers = phoneNumbers2.filter((p) => !p.manual);
      if (twilioNumbers.length > 0) {
        try {
          const client = await getTwilioClient();
          const ownedNumbers = await client.incomingPhoneNumbers.list({ limit: 200 });
          const ownedSet = new Set(ownedNumbers.map((n) => n.phoneNumber));
          const unowned = twilioNumbers.filter((p) => !ownedSet.has(p.phoneNumber));
          if (unowned.length > 0) {
            return res.status(400).json({
              error: `The following numbers are not found on the Twilio account: ${unowned.map((p) => p.phoneNumber).join(", ")}`
            });
          }
        } catch (twilioError) {
          if (twilioError.status === 401 || twilioError.code === 20003) {
            return res.status(500).json({ error: "Twilio credentials are not configured properly. Please contact your administrator." });
          }
          return res.status(500).json({ error: "Failed to verify phone number ownership with Twilio" });
        }
      }
      const trunk = await ElevenLabsSipService.createSipTrunk({
        userId,
        name: trunkName,
        provider: "twilio",
        sipHost,
        sipPort,
        transport,
        mediaEncryption
      });
      const results = [];
      for (const phone of phoneNumbers2) {
        try {
          const created = await ElevenLabsSipService.addPhoneNumber({
            userId,
            sipTrunkId: trunk.id,
            phoneNumber: phone.phoneNumber,
            label: phone.friendlyName || phone.phoneNumber
          });
          results.push({ phoneNumber: phone.phoneNumber, success: true, id: created.id });
        } catch (err) {
          results.push({ phoneNumber: phone.phoneNumber, success: false, error: err.message });
        }
      }
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      res.json({
        success: true,
        trunk: {
          id: trunk.id,
          name: trunk.name,
          sipHost: trunk.sipHost,
          sipPort: trunk.sipPort,
          transport: trunk.transport
        },
        imported: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("[SIP Twilio Onboard] Connect error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] Twilio SIP onboarding routes registered");
}

// plugins/sip-engine/services/number-porting.service.ts
import { eq as eq7, and as and7, desc as desc4 } from "drizzle-orm";
var GCC_CARRIERS = {
  AE: {
    name: "United Arab Emirates",
    carriers: ["Etisalat (e&)", "du (EITC)", "Virgin Mobile UAE"]
  },
  SA: {
    name: "Saudi Arabia",
    carriers: ["STC", "Mobily (Etihad Etisalat)", "Zain KSA", "Virgin Mobile KSA", "Lebara KSA"]
  },
  BH: {
    name: "Bahrain",
    carriers: ["Batelco", "Zain Bahrain", "STC Bahrain (VIVA)", "Virgin Mobile Bahrain"]
  },
  KW: {
    name: "Kuwait",
    carriers: ["Zain Kuwait", "Ooredoo Kuwait", "STC Kuwait (VIVA)"]
  },
  OM: {
    name: "Oman",
    carriers: ["Omantel", "Ooredoo Oman", "Vodafone Oman"]
  },
  QA: {
    name: "Qatar",
    carriers: ["Ooredoo Qatar", "Vodafone Qatar"]
  }
};
var GCC_REGULATORS = {
  AE: { body: "TDRA (Telecommunications & Digital Government Regulatory Authority)", note: "UAE porting typically takes 5-10 business days. TDRA requires the number to be active and in good standing." },
  SA: { body: "CST (Communications, Space & Technology Commission)", note: "Saudi Arabia porting may take 7-14 business days. Ensure no outstanding balance with current carrier." },
  BH: { body: "TRA (Telecommunications Regulatory Authority)", note: "Bahrain porting usually completes within 3-5 business days." },
  KW: { body: "CITRA (Communication & Information Technology Regulatory Authority)", note: "Kuwait porting takes approximately 5-7 business days." },
  OM: { body: "TRA (Telecommunications Regulatory Authority)", note: "Oman porting typically takes 5-10 business days." },
  QA: { body: "CRA (Communications Regulatory Authority)", note: "Qatar porting usually takes 3-7 business days." }
};
var COUNTRY_PREFIXES = {
  AE: "+971",
  SA: "+966",
  BH: "+973",
  KW: "+965",
  OM: "+968",
  QA: "+974"
};
var NumberPortingService = class {
  static getGccCountries() {
    return Object.entries(GCC_CARRIERS).map(([code, data]) => ({
      code,
      name: data.name,
      prefix: COUNTRY_PREFIXES[code],
      carriers: data.carriers,
      regulator: GCC_REGULATORS[code]
    }));
  }
  static getCarriersForCountry(countryCode) {
    return GCC_CARRIERS[countryCode]?.carriers || [];
  }
  static async createPortRequest(data) {
    const loaText = this.generateLoaText(data);
    const [request] = await db.insert(portRequests).values({
      ...data,
      loaText,
      status: "submitted"
    }).returning();
    console.log(`[Number Porting] Port request created: ${request.id} for ${data.phoneNumber}`);
    return request;
  }
  static async getUserPortRequests(userId) {
    return db.select().from(portRequests).where(eq7(portRequests.userId, userId)).orderBy(desc4(portRequests.createdAt));
  }
  static async getPortRequest(id, userId) {
    const [request] = await db.select().from(portRequests).where(and7(eq7(portRequests.id, id), eq7(portRequests.userId, userId))).limit(1);
    return request || null;
  }
  static async updatePortRequestStatus(id, status, adminNotes) {
    const updates = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (adminNotes) updates.adminNotes = adminNotes;
    if (status === "completed") updates.completedAt = /* @__PURE__ */ new Date();
    const [updated] = await db.update(portRequests).set(updates).where(eq7(portRequests.id, id)).returning();
    if (updated) {
      console.log(`[Number Porting] Request ${id} status updated to: ${status}`);
    }
    return updated || null;
  }
  static async cancelPortRequest(id, userId) {
    const [request] = await db.select().from(portRequests).where(and7(eq7(portRequests.id, id), eq7(portRequests.userId, userId))).limit(1);
    if (!request) return false;
    if (["completed", "cancelled"].includes(request.status)) return false;
    await db.update(portRequests).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq7(portRequests.id, id));
    console.log(`[Number Porting] Request ${id} cancelled`);
    return true;
  }
  static generateLoaText(data) {
    const countryName = GCC_CARRIERS[data.countryCode || ""]?.name || data.country || "";
    const regulator = GCC_REGULATORS[data.countryCode || ""];
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return `
LETTER OF AUTHORIZATION (LOA)
FOR NUMBER PORTING
${"=".repeat(50)}

Date: ${today}

AUTHORIZATION

I, ${data.authorizedName || "_______________"}${data.companyName ? `, on behalf of ${data.companyName},` : ","} hereby authorize the transfer (porting) of the following telephone number(s) from the current service provider to Twilio Inc.

PHONE NUMBER(S) TO BE PORTED
Phone Number: ${data.phoneNumber || "_______________"}
Country: ${countryName}

CURRENT SERVICE PROVIDER
Carrier: ${data.currentCarrier || "_______________"}
Account Number: ${data.accountNumber || "N/A"}

AUTHORIZED CONTACT
Name: ${data.authorizedName || "_______________"}
${data.companyName ? `Company: ${data.companyName}` : ""}
Address: ${data.addressLine1 || "_______________"}${data.addressLine2 ? `, ${data.addressLine2}` : ""}
City: ${data.city || "_______________"}${data.region ? `, ${data.region}` : ""}${data.postalCode ? ` ${data.postalCode}` : ""}
Country: ${data.country || "_______________"}

RECEIVING PROVIDER
Twilio Inc.
101 Spear Street, Suite 500
San Francisco, CA 94105
United States

REGULATORY COMPLIANCE
${regulator ? `Regulatory Body: ${regulator.body}` : ""}
This porting request is made in compliance with the applicable number portability regulations in ${countryName}.

DECLARATION
I hereby declare that:
1. I am the authorized user/account holder of the above telephone number(s).
2. I authorize the transfer of the number(s) to Twilio Inc.
3. I understand that upon completion of the port, the number(s) will no longer be serviced by the current provider.
4. All information provided in this letter is accurate and complete.
5. I understand that the porting process may result in a brief interruption of service.

${regulator ? `
NOTE: ${regulator.note}` : ""}

SIGNATURE

_______________________________
${data.authorizedName || "_______________"}
Date: ${today}

${"=".repeat(50)}
This document serves as authorization for number porting
in accordance with ${regulator?.body || "local telecommunications regulatory"} guidelines.
`.trim();
  }
  static async checkPortability(phoneNumber, countryCode) {
    const prefix = COUNTRY_PREFIXES[countryCode];
    if (!prefix) {
      return {
        portable: false,
        message: `Country code ${countryCode} is not a supported GCC country for porting.`,
        requirements: []
      };
    }
    if (!phoneNumber.startsWith(prefix) && !phoneNumber.startsWith("+")) {
      return {
        portable: false,
        message: `Phone number must start with ${prefix} for ${GCC_CARRIERS[countryCode]?.name}.`,
        requirements: []
      };
    }
    const requirements = [
      "Number must be active and in good standing with current carrier",
      "No outstanding balance on the account",
      "Number must not be under contract lock-in period",
      "Valid government-issued ID of the account holder",
      "Recent bill or account statement from current carrier",
      "Completed and signed Letter of Authorization (LOA)"
    ];
    const estimatedDays = {
      AE: 10,
      SA: 14,
      BH: 5,
      KW: 7,
      OM: 10,
      QA: 7
    };
    return {
      portable: true,
      message: `Number appears eligible for porting from ${GCC_CARRIERS[countryCode]?.name}. Estimated processing time: ${estimatedDays[countryCode]} business days.`,
      estimatedDays: estimatedDays[countryCode],
      requirements
    };
  }
};

// plugins/sip-engine/routes/number-porting.routes.ts
function setupNumberPortingRoutes(app, sessionAuth) {
  app.get("/api/porting/countries", sessionAuth, async (_req, res) => {
    try {
      const countries = NumberPortingService.getGccCountries();
      res.json(countries);
    } catch (error) {
      console.error("[Porting Routes] Get countries error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/porting/check", sessionAuth, async (req, res) => {
    try {
      const { phoneNumber, countryCode } = req.body;
      if (!phoneNumber || !countryCode) {
        return res.status(400).json({ error: "phoneNumber and countryCode are required" });
      }
      const result = await NumberPortingService.checkPortability(phoneNumber, countryCode);
      res.json(result);
    } catch (error) {
      console.error("[Porting Routes] Portability check error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/porting/requests", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.createPortRequest({
        ...req.body,
        userId
      });
      res.status(201).json(request);
    } catch (error) {
      console.error("[Porting Routes] Create port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const requests = await NumberPortingService.getUserPortRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("[Porting Routes] List port requests error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.getPortRequest(req.params.id, userId);
      if (!request) return res.status(404).json({ error: "Port request not found" });
      res.json(request);
    } catch (error) {
      console.error("[Porting Routes] Get port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests/:id/loa", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.getPortRequest(req.params.id, userId);
      if (!request) return res.status(404).json({ error: "Port request not found" });
      res.json({ loaText: request.loaText });
    } catch (error) {
      console.error("[Porting Routes] Get LOA error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const { status, adminNotes } = req.body;
      const updated = await NumberPortingService.updatePortRequestStatus(
        req.params.id,
        status,
        adminNotes
      );
      if (!updated) return res.status(404).json({ error: "Port request not found" });
      res.json(updated);
    } catch (error) {
      console.error("[Porting Routes] Update port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const cancelled = await NumberPortingService.cancelPortRequest(req.params.id, userId);
      if (!cancelled) return res.status(400).json({ error: "Cannot cancel this request" });
      res.json({ success: true });
    } catch (error) {
      console.error("[Porting Routes] Cancel port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] Number porting routes registered");
}

// plugins/sip-engine/index.ts
function registerSipEnginePlugin(app, options) {
  console.log("[SIP Engine] Registering SIP Engine plugin...");
  setupSipTrunkRoutes(app, options.sessionAuthMiddleware);
  setupSipPhoneRoutes(app, options.sessionAuthMiddleware);
  setupSipCallRoutes(app, options.sessionAuthMiddleware);
  setupSipWebhookRoutes(app);
  setupTcxcRoutes(app, options.sessionAuthMiddleware, options.adminAuthMiddleware);
  setupSipTwilioOnboardRoutes(app, options.sessionAuthMiddleware);
  setupNumberPortingRoutes(app, options.sessionAuthMiddleware);
  console.log("[SIP Engine] SIP Engine plugin registered successfully");
  console.log("[SIP Engine] Supported providers: TCXC, Twilio SIP, Telnyx, Vonage, Exotel, Bandwidth, DIDWW, Generic");
}
export {
  ELEVENLABS_SIP_CONFIG,
  ElevenLabsSipService,
  SIP_PROVIDERS,
  TcxcApiService,
  getProviderDefaults,
  registerSipEnginePlugin
};
