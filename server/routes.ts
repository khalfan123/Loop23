'use strict';
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
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { storage } from "./storage";
import { db } from "./db";
import { nanoid } from "nanoid";
import { phoneNumbers, agents, calls, creditTransactions, paymentTransactions, phoneNumberRentals, campaigns, contacts, incomingConnections, llmModels, twilioCountries, users, knowledgeBase, userSubscriptions, twilioOpenaiCalls, globalSettings } from "@shared/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { authenticateToken, requireRole, generateTokenAsync, checkActiveMembership, checkUserActive, type AuthRequest } from "./middleware/auth";
import { authRateLimiter, strictRateLimiter, paymentRateLimiter } from "./middleware/rateLimiter";
import { validateTwilioWebhook } from "./middleware/webhookValidation";
import { elevenLabsService, ElevenLabsService } from "./services/elevenlabs";
import { ElevenLabsPoolService } from "./services/elevenlabs-pool";
import { twilioService } from "./services/twilio";

const elevenLabsPoolService = new ElevenLabsPoolService();
import { getTwilioClient } from "./services/twilio-connector";
import { campaignExecutor } from "./services/campaign-executor";
import { BatchCallingService } from "./services/batch-calling";
import { 
  handleTwilioVoiceWebhook,
  handleIncomingCallWebhook,
  handleIvrSelection,
  handleIvrLanguageSelection,
  handleTwilioStatusWebhook,
  handleHumanDialStatusWebhook,
  handleTwilioRecordingWebhook, 
  handleTwilioStreamWebSocket,
  handleFlowVoiceAnswer,
  handleFlowNode,
  handleFlowGather,
  handleFlowContinue,
  handleFlowStatus,
  handleElevenLabsWebhook,
  fetchElevenLabsConversation,
  handleRAGToolWebhook,
  handleAppointmentToolWebhook,
  handleFormSubmissionWebhook,
  handleDynamicFormSubmissionWebhook,
  handleDynamicFormListWebhook,
  handlePlayAudioToolWebhook
} from "./routes/webhook-routes";
// Flow Agent WebSocket handler removed - all agents now execute through ElevenLabs
import { getDomain } from "./utils/domain";
import { createPublicRoutes } from "./routes/public-routes";
import { createAuthRoutes } from "./routes/auth-routes";
import { createAgentRoutes } from "./routes/agent-routes";
import { createCampaignRoutes } from "./routes/campaign-routes";
import { createQaRoutes } from "./routes/qa-routes";
import { createOpsRoutes } from "./routes/ops-routes";
import { createPhoneRoutes } from "./routes/phone-routes";
import { createUserAddressRoutes } from "./routes/user-address-routes";
import { createAnalyticsRoutes } from "./routes/analytics-routes";
import { createCallIntelligenceRoutes } from "./routes/call-intelligence-routes";
import { createRouteContext } from "./routes/common";
// Payment Engine v1.0.0 - All payment gateway routers
import {
  stripeRouter,
  razorpayRouter,
  paypalRouter,
  paystackRouter,
  mercadopagoRouter,
  PAYMENT_ENGINE_VERSION,
} from "./engines/payment";
// Twilio + OpenAI Realtime Engine
import { twilioOpenaiWebhookRoutes, setupTwilioOpenAIStreamHandler, twilioOpenaiIncomingConnectionsRoutes } from "./engines/twilio-openai";
// Twilio + Bedrock + Polly Engine (ISOLATED from other engines)
import { bedrockPollyWebhookRoutes, setupBedrockPollyStreamHandler, setupBrowserVoiceStreamHandler } from "./engines/twilio-bedrock-polly";
import { deepgramAgentWebhookRoutes, setupDeepgramAgentStreamHandler } from "./engines/deepgram-voice-agent";
// KYC Engine
import { registerKycRoutes } from "./engines/kyc";
import { checkAdmin } from "./middleware/admin-auth";
import flowAutomationRouter from "./routes/flow-automation-routes";
import { flows, FlowNode, FlowEdge, insertPromptTemplateSchema } from "@shared/schema";
import { ElevenLabsFlowCompiler } from "./services/elevenlabs-flow-compiler";
import incomingConnectionsRouter from "./routes/incoming-connections-routes";
import { platformLanguagesPublicRouter } from "./routes/platform-languages-routes";
import transactionsRouter from "./routes/transactions-routes";
import invoiceRouter from "./routes/invoice-routes";
import internalApiRouter from "./routes/internal-api-routes";
import audioRoutes from "./routes/audio-routes";
import { createRAGKnowledgeRoutes } from "./routes/rag-knowledge-routes";
import { createProductRoutes } from "./routes/product-routes";
import { createUserSmtpRoutes } from "./routes/user-smtp-routes";
import { createUserApiKeysRoutes } from "./routes/user-api-keys-routes";
import { registerBedrockKBRoutes } from "./routes/bedrock-kb-routes";
import { createKnowledgeIntelligenceRoutes } from "./routes/knowledge-intelligence-routes";
import { createDepartmentRoutes, createIvrAudioRoutes } from "./routes/department-routes";
import { createDeprockRoutes, createDeprockIvrAudioRoutes } from "./routes/deprock-routes";
import { createVoiceMetricsRoutes } from "./routes/voice-metrics-routes";
import { createNotificationRoutes } from "./routes/notification-routes";
import { createUserWebhookRoutes } from "./routes/user-webhook-routes";
import { createTemplateRoutes } from "./routes/template-routes";
import { createSubscriptionRoutes } from "./routes/subscription-routes";
import { createSupportTicketRoutes, createPublicSupportRoutes } from "./routes/support-ticket-routes";
import crmRoutes from "./routes/crm-routes";
import searchRoutes from "./routes/search-routes";
import { createLiveMonitoringRoutes } from "./routes/live-monitoring-routes";
import { liveMonitoringWs } from "./services/live-monitoring-ws";
import integrationRoutes from "./routes/integration-routes";
import integrationOAuthCallback from "./routes/integration-oauth-callback";
import contactImportRoutes from "./routes/contact-import-routes";
import { widgetRoutes, publicWidgetRoutes } from "./modules/widget";
import bcrypt from "bcrypt";
import multer from "multer";
import Papa from "papaparse";
// Team Management Middleware - allows team members to access user data with their parent's userId
// Uses adapter for optional plugin loading
import { getTeamContextMiddleware, isTeamManagementInstalled, initializeAdapter as initTeamAdapter } from "./plugins/team-management-adapter";
import crypto from "crypto";
import { NotificationService } from "./services/notification-service";
import { IncomingAgentService } from "./services/incoming-agent";
import { FlowAgentService } from "./services/flow-agent";
import { setupRAGToolForAgent, isRAGEnabled } from "./services/rag-elevenlabs-tool";
import PDFDocument from "pdfkit";
import { webhookDeliveryService } from "./services/webhook-delivery";
import { webhookTestService } from "./services/webhook-test-service";
import { contactUploadService, PlanLimitExceededError } from "./services/contact-upload-service";
import { recordingService } from "./services/recording-service";
import { TwilioOpenAIAudioBridge } from "./engines/twilio-openai/services/audio-bridge.service";
import { OpenAIPoolService } from "./services/openai-pool.service";
import { OpenAIAgentFactory } from "./engines/twilio-openai/services/openai-agent-factory";
import { CampaignScheduler } from "./services/campaign-scheduler";
import { emailService } from "./services/email-service";
import { generateRefundNoteForRefund, refundNoteService } from "./services/refund-note-service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  }
});

// Helper function to escape CSV fields
function escapeCSV(value: string | number): string {
  if (typeof value === 'number') return value.toString();
  if (!value) return "";
  
  // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
  const stringValue = value.toString();
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  const httpServer = existingServer ?? createServer(app);
  
  // Create shared route context for dependency injection
  const routeContext = createRouteContext();
  
  // Register public routes (installer, health, branding, SEO, contact, etc.)
  const publicRoutes = createPublicRoutes(routeContext);
  app.use(publicRoutes);
  
  // Register authentication routes (login, register, OTP, password, etc.)
  const authRoutes = createAuthRoutes(routeContext);
  app.use(authRoutes);

  // Apply team context middleware globally for all user-facing /api routes
  // This allows team members to access data using their parent user's userId
  // The middleware only activates when Team Management plugin is installed and
  // a Bearer token is present from team member auth
  if (isTeamManagementInstalled()) {
    await initTeamAdapter();
    app.use('/api', getTeamContextMiddleware());
    console.log('✅ Team Management plugin detected - team context middleware enabled');
  }

  // Register agent routes (agents CRUD, knowledge base, versions, voices)
  const agentRoutes = createAgentRoutes(routeContext);
  app.use(agentRoutes);

  // Register campaign routes (campaigns CRUD, contacts, execution)
  const campaignRoutes = createCampaignRoutes(routeContext);
  app.use(campaignRoutes);

  // Register phone number routes (phone numbers CRUD, Twilio integration)
  const phoneRoutes = createPhoneRoutes(routeContext);
  app.use(phoneRoutes);

  // Register user address routes (for phone number regulatory compliance)
  const userAddressRoutes = createUserAddressRoutes(routeContext);
  app.use(userAddressRoutes);

  // Register analytics routes (dashboard, analytics, calls)
  const analyticsRoutes = createAnalyticsRoutes(routeContext);
  app.use(analyticsRoutes);

  // Register QA routes (AI quality assurance analysis)
  const qaRoutes = createQaRoutes(routeContext);
  app.use(qaRoutes);

  // Register call intelligence routes (external call analysis storage & retrieval)
  const callIntelligenceRoutes = createCallIntelligenceRoutes(routeContext);
  app.use(callIntelligenceRoutes);

  // Register Callpilot routes (AI task extraction from call transcripts)
  const opsRoutes = createOpsRoutes(routeContext);
  app.use(opsRoutes);

  // Register notification routes
  const notificationRoutes = createNotificationRoutes(routeContext);
  app.use(notificationRoutes);

  // Register user webhook routes (subscription management)
  const userWebhookRoutes = createUserWebhookRoutes(routeContext);
  app.use(userWebhookRoutes);

  // Register template routes (prompt templates)
  const templateRoutes = createTemplateRoutes(routeContext);
  app.use(templateRoutes);

  // Register subscription routes (plans, credits, billing)
  const subscriptionRoutes = createSubscriptionRoutes(routeContext);
  app.use(subscriptionRoutes);

  // Register support ticket routes (authenticated user routes)
  const supportTicketRoutes = createSupportTicketRoutes(authenticateToken);
  app.use('/api/support', supportTicketRoutes);

  // Register public support API routes (for loopcp admin access via API key)
  const publicSupportRoutes = createPublicSupportRoutes();
  app.use('/api/public/support', publicSupportRoutes);

  // Register global search routes
  app.use(searchRoutes);

  // Initialize Twilio + OpenAI Realtime Engine
  // This provides Twilio telephony with OpenAI Realtime API for international calling
  app.use('/api/twilio-openai', twilioOpenaiWebhookRoutes);
  // TODO: Express middleware type compatibility - see note above about authenticateToken
  app.use('/api/twilio-openai/incoming-connections', authenticateToken as unknown as import('express').RequestHandler, twilioOpenaiIncomingConnectionsRoutes);
  console.log('✅ Twilio + OpenAI Realtime Engine initialized');

  // Initialize Twilio + Bedrock + Polly Engine (ISOLATED from other engines)
  app.use('/api/bedrock-polly', bedrockPollyWebhookRoutes);
  console.log('✅ Twilio + Bedrock + Polly Engine initialized');

  // Initialize Deepgram Voice Agent Engine (Flux listening + Aura-2 speaking)
  app.use('/api/deepgram-agent', deepgramAgentWebhookRoutes);
  console.log('✅ Deepgram Voice Agent Engine initialized');

  (async () => {
    try {
      const { awsBedrockService } = await import('./services/aws-bedrock');
      await awsBedrockService.warmConnection();
    } catch (e: any) {
      console.warn(`[Bedrock] Warm connection probe failed: ${e.message}`);
    }
  })();

  registerKycRoutes(
    app,
    authenticateToken as unknown as import('express').RequestHandler
  );

  const pluginRoutes = await import('./routes/plugin-routes');
  app.use('/api/plugins', pluginRoutes.publicPluginRouter);
  app.use('/api/plugins', authenticateToken, pluginRoutes.userPluginRouter);
  console.log('✅ Plugin Management routes initialized');

  // Auto-load any additional plugins from /plugins directory
  // This allows installing new plugins by just copying the folder and restarting
  try {
    const { loadPlugins } = await import('./plugins/loader');
    const loadedPlugins = await loadPlugins(app, {
      sessionAuthMiddleware: authenticateToken as unknown as import('express').RequestHandler,
      adminAuthMiddleware: checkAdmin as unknown as import('express').RequestHandler,
    });
    if (loadedPlugins.filter(p => p.registered).length > 0) {
      console.log(`✅ Auto-loaded ${loadedPlugins.filter(p => p.registered).length} plugin(s) from /plugins directory`);
    }
  } catch (error) {
    console.warn('[Plugin Loader] Failed to auto-load plugins:', error);
  }

  // Agent Presets - Get all active presets sorted by sortOrder
  app.get("/api/agent-presets", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const presets = await storage.getAgentPresets();
      res.json(presets);
    } catch (error: any) {
      console.error("Get agent presets error:", error);
      res.status(500).json({ error: "Failed to get agent presets" });
    }
  });

  // LLM Models - Get available models for current user (filtered by plan tier)
  app.get("/api/llm-models/available", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { llmModels } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Get user to check their plan tier
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch all active models
      const allModels = await db
        .select()
        .from(llmModels)
        .where(eq(llmModels.isActive, true))
        .orderBy(llmModels.sortOrder, llmModels.name);
      
      // Admins and Pro users can see all models
      if (user.role === 'admin' || user.planType === 'pro') {
        return res.json(allModels);
      }
      
      // Free users can only see free tier models
      const freeModels = allModels.filter(model => model.tier === 'free');
      res.json(freeModels);
    } catch (error: any) {
      console.error("Get available LLM models error:", error);
      res.status(500).json({ error: "Failed to get available LLM models" });
    }
  });

  // Contacts routes
  app.get("/api/contacts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const allContacts = await storage.getUserContacts(req.userId!);

      // Check if pagination is requested
      const requestsPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
      
      if (requestsPagination) {
        const page = parseInt(req.query.page as string, 10) || 1;
        const pageSize = parseInt(req.query.pageSize as string, 10) || 25;
        const offset = (page - 1) * pageSize;

        const totalItems = allContacts.length;
        const totalPages = Math.ceil(totalItems / pageSize);

        const paginatedContacts = allContacts.slice(offset, offset + pageSize);

        res.json({
          data: paginatedContacts,
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages
          }
        });
      } else {
        // Return plain array for backward compatibility
        res.json(allContacts);
      }
    } catch (error: any) {
      console.error("Get all contacts error:", error);
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  app.get("/api/contacts/deduplicated", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contacts = await storage.getUserContactsDeduplicated(req.userId!);
      res.json(contacts);
    } catch (error: any) {
      console.error("Get deduplicated contacts error:", error);
      res.status(500).json({ error: "Failed to get deduplicated contacts" });
    }
  });

  app.delete("/api/contacts/all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.deleteAllUserContacts(req.userId!);
      res.json({ success: true, deleted: count });
    } catch (error: any) {
      console.error("Delete all contacts error:", error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });

  app.delete("/api/contacts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify the contact's campaign belongs to the user
      const campaign = await storage.getCampaign(contact.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Not authorized to delete this contact" });
      }

      await storage.deleteContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete contact error:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  app.post("/api/contacts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { firstName, lastName, phone, email, campaignId } = req.body;
      if (!phone && !email) {
        return res.status(400).json({ error: "Phone or email is required" });
      }
      let targetCampaignId = campaignId;
      if (targetCampaignId) {
        const campaign = await storage.getCampaign(targetCampaignId);
        if (!campaign || campaign.userId !== req.userId) {
          return res.status(403).json({ error: "Not authorized to add contacts to this campaign" });
        }
      } else {
        const userCampaigns = await storage.getUserCampaigns(req.userId!);
        let importCampaign = userCampaigns.find(c => c.name === 'Imported Contacts');
        if (!importCampaign) {
          importCampaign = await storage.createCampaign({
            name: 'Imported Contacts',
            userId: req.userId!,
            status: 'active',
          });
        }
        targetCampaignId = importCampaign.id;
      }
      const contact = await storage.createContact({
        campaignId: targetCampaignId,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        email: email || null,
        status: 'imported',
      });
      res.json(contact);
    } catch (error: any) {
      console.error("Create contact error:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.put("/api/contacts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) return res.status(404).json({ error: "Contact not found" });
      const campaign = await storage.getCampaign(contact.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { firstName, lastName, phone, email } = req.body;
      const updated = await storage.updateContact(req.params.id, {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
      });
      res.json(updated);
    } catch (error: any) {
      console.error("Update contact error:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Contact Groups routes
  app.get("/api/contact-groups", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.execute(sql`SELECT * FROM contact_groups WHERE user_id = ${req.userId} ORDER BY created_at ASC`);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Get contact groups error:", error);
      res.status(500).json({ error: "Failed to get contact groups" });
    }
  });

  app.post("/api/contact-groups", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { name, color } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Group name is required" });
      const id = nanoid();
      await db.execute(sql`INSERT INTO contact_groups (id, user_id, name, color) VALUES (${id}, ${req.userId}, ${name.trim()}, ${color || '#6366f1'})`);
      const result = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${id}`);
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Create contact group error:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.put("/api/contact-groups/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { name, color } = req.body;
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      await db.execute(sql`UPDATE contact_groups SET name = COALESCE(${name || null}, name), color = COALESCE(${color || null}, color) WHERE id = ${req.params.id}`);
      const result = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id}`);
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Update contact group error:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  app.delete("/api/contact-groups/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      await db.execute(sql`DELETE FROM contact_groups WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete contact group error:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  app.get("/api/contact-groups/:id/members", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      const members = await db.execute(sql`SELECT contact_phone FROM contact_group_members WHERE group_id = ${req.params.id}`);
      res.json(members.rows.map((r: any) => r.contact_phone));
    } catch (error: any) {
      console.error("Get group members error:", error);
      res.status(500).json({ error: "Failed to get group members" });
    }
  });

  app.post("/api/contact-groups/:id/members", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { contactPhone } = req.body;
      if (!contactPhone) return res.status(400).json({ error: "Contact phone is required" });
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      const id = nanoid();
      await db.execute(sql`INSERT INTO contact_group_members (id, group_id, contact_phone) VALUES (${id}, ${req.params.id}, ${contactPhone}) ON CONFLICT (group_id, contact_phone) DO NOTHING`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Add group member error:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.delete("/api/contact-groups/:id/members/:phone", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      const phone = decodeURIComponent(req.params.phone);
      await db.execute(sql`DELETE FROM contact_group_members WHERE group_id = ${req.params.id} AND contact_phone = ${phone}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Remove group member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.post("/api/contacts/bulk-delete", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "contactIds array is required" });
      }
      let deleted = 0;
      for (const id of contactIds) {
        const contact = await storage.getContact(id);
        if (!contact) continue;
        const campaign = await storage.getCampaign(contact.campaignId);
        if (!campaign || campaign.userId !== req.userId) continue;
        await storage.deleteContact(id);
        deleted++;
      }
      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error("Bulk delete contacts error:", error);
      res.status(500).json({ error: "Failed to bulk delete contacts" });
    }
  });

  app.post("/api/contact-groups/:id/members/bulk", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      const { phones } = req.body;
      if (!Array.isArray(phones) || phones.length === 0) {
        return res.status(400).json({ error: "phones array is required" });
      }
      let added = 0;
      for (const phone of phones) {
        const existing = await db.execute(sql`SELECT 1 FROM contact_group_members WHERE group_id = ${req.params.id} AND contact_phone = ${phone}`);
        if (existing.rows.length === 0) {
          const memberId = nanoid();
          await db.execute(sql`INSERT INTO contact_group_members (id, group_id, contact_phone) VALUES (${memberId}, ${req.params.id}, ${phone}) ON CONFLICT (group_id, contact_phone) DO NOTHING`);
          added++;
        }
      }
      res.json({ success: true, added });
    } catch (error: any) {
      console.error("Bulk add group members error:", error);
      res.status(500).json({ error: "Failed to bulk add members" });
    }
  });

  app.post("/api/contact-groups/:id/members/bulk-remove", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const group = await db.execute(sql`SELECT * FROM contact_groups WHERE id = ${req.params.id} AND user_id = ${req.userId}`);
      if (group.rows.length === 0) return res.status(404).json({ error: "Group not found" });
      const { phones } = req.body;
      if (!Array.isArray(phones) || phones.length === 0) {
        return res.status(400).json({ error: "phones array is required" });
      }
      for (const phone of phones) {
        await db.execute(sql`DELETE FROM contact_group_members WHERE group_id = ${req.params.id} AND contact_phone = ${phone}`);
      }
      res.json({ success: true, removed: phones.length });
    } catch (error: any) {
      console.error("Bulk remove group members error:", error);
      res.status(500).json({ error: "Failed to bulk remove members" });
    }
  });

  app.get("/api/contact-group-memberships", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT cgm.contact_phone, cgm.group_id, cg.name as group_name, cg.color as group_color 
        FROM contact_group_members cgm 
        JOIN contact_groups cg ON cgm.group_id = cg.id 
        WHERE cg.user_id = ${req.userId}
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Get memberships error:", error);
      res.status(500).json({ error: "Failed to get memberships" });
    }
  });

  // Tools routes
  app.get("/api/tools", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const tools = await storage.getUserTools(req.userId!);
      res.json(tools);
    } catch (error: any) {
      console.error("Get tools error:", error);
      res.status(500).json({ error: "Failed to get tools" });
    }
  });

  // ElevenLabs Agents routes
  app.get("/api/elevenlabs/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const agents = await storage.getUserAgents(req.userId!);
      res.json(agents);
    } catch (error: any) {
      console.error("Get agents error:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.post("/api/elevenlabs/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { 
        type = 'natural', 
        name, 
        voiceTone, 
        personality, 
        systemPrompt, 
        elevenLabsVoiceId, 
        language, 
        model, 
        firstMessage, 
        temperature, 
        transferRules, 
        knowledgeBaseIds,
        flowId,
        maxDurationSeconds,
        voiceStability,
        voiceSimilarityBoost,
        voiceSpeed,
        detectLanguageEnabled,
      } = req.body;

      // Base validation - name and voice required for both types
      // Note: Both agent types need elevenLabsVoiceId:
      //   - Natural agents: voice for ElevenLabs Conversational AI
      //   - Flow agents: voice for ElevenLabs TTS (text-to-speech)
      if (!name || !elevenLabsVoiceId) {
        return res.status(400).json({ error: "Agent name and voice are required" });
      }

      // Type-specific validation
      if (type === 'natural' && !systemPrompt) {
        return res.status(400).json({ error: "Natural agents require a system prompt" });
      }

      if (type === 'flow' && !flowId) {
        return res.status(400).json({ error: "Flow agents require a flow to be selected" });
      }

      // Check user's plan limits
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const plan = await storage.getPlanByName(user.planType || 'free');
      if (!plan) {
        return res.status(500).json({ error: "Plan configuration not found" });
      }

      // Count existing agents
      const existingAgents = await storage.getUserAgents(req.userId!);
      // Skip limit check if explicitly unlimited (-1 or 999)
      if (plan.maxAgents !== -1 && plan.maxAgents !== 999 && existingAgents.length >= plan.maxAgents) {
        return res.status(403).json({ 
          error: `Agent limit reached. Your ${plan.displayName} plan allows maximum ${plan.maxAgents} agent(s). Please upgrade to create more agents.`,
          upgradeRequired: true
        });
      }

      // Build tools configuration if transfer rules are provided
      const tools = transferRules && transferRules.length > 0 ? [{
        type: "transfer_to_number" as const,
        description: "Transfer user to human support when needed",
        transfer_rules: transferRules,
      }] : undefined;

      // Create ElevenLabs agent based on type
      let elevenLabsAgentId: string | null = null;
      let agentLink: string | null = null;
      let usedCredentialId: string | null = null;

      if (type === 'natural') {
        // Use user credential affinity - ensures all user's resources stay on same ElevenLabs account
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (!credential) {
          return res.status(500).json({ error: "No available ElevenLabs API keys" });
        }
        usedCredentialId = credential.id;
        const credentialService = new ElevenLabsService(credential.apiKey);

        // Natural Agent: Create ElevenLabs Conversational AI agent
        // Get KB objects from our knowledge base IDs
        let knowledgeBases: Array<{ type: string; title: string; elevenLabsDocId: string }> | undefined;
        if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
          const kbItems = await Promise.all(
            knowledgeBaseIds.map((id: string) => storage.getKnowledgeBaseItem(id))
          );
          // Verify ownership and filter valid items
          knowledgeBases = kbItems
            .filter(item => item && item.userId === req.userId && item.elevenLabsDocId)
            .map(item => ({
              type: item!.type,
              title: item!.title,
              elevenLabsDocId: item!.elevenLabsDocId!
            }));
          
          console.log(`📚 Filtered ${knowledgeBases.length} valid knowledge base items from ${knowledgeBaseIds.length} selected`);
        }

        // Create agent in ElevenLabs
        const elevenLabsAgent = await credentialService.createAgent({
          name,
          prompt: systemPrompt!,
          voice_id: elevenLabsVoiceId,
          language: language || "en",
          model: model || "gpt-4o-mini",
          first_message: firstMessage || "Hello! How can I help you today?",
          temperature: temperature !== undefined ? temperature : 0.5,
          voice_tone: voiceTone,
          personality: personality,
          tools: tools,
          knowledge_bases: knowledgeBases,
        });

        elevenLabsAgentId = elevenLabsAgent.agent_id;
        agentLink = `https://elevenlabs.io/app/conversational-ai/call/${elevenLabsAgent.agent_id}`;
      } else if (type === 'flow') {
        // Use user credential affinity - ensures all user's resources stay on same ElevenLabs account
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (!credential) {
          return res.status(500).json({ error: "No available ElevenLabs API keys" });
        }
        usedCredentialId = credential.id;
        const credentialService = new ElevenLabsService(credential.apiKey);

        // Flow Agent: Compile flow and create ElevenLabs agent with workflow
        console.log(`🔄 Creating Flow Agent with flowId: ${flowId}`);
        
        // Fetch the flow from database
        const [flow] = await db
          .select()
          .from(flows)
          .where(and(eq(flows.id, flowId), eq(flows.userId, req.userId!)));
        
        if (!flow) {
          return res.status(404).json({ error: "Flow not found or access denied" });
        }

        console.log(`📋 Found flow: ${flow.name} with ${(flow.nodes as FlowNode[]).length} nodes`);

        // Compile the flow to ElevenLabs workflow format
        const compiler = new ElevenLabsFlowCompiler(
          flow.nodes as FlowNode[],
          flow.edges as FlowEdge[]
        );
        const compileResult = compiler.compile();
        const compiledWorkflow = compileResult.workflow;
        const flowFirstMessage = compileResult.firstMessage;
        
        // Validate the compiled workflow
        const validation = compiler.validate();
        if (!validation.valid) {
          console.warn(`⚠️ Flow validation warnings:`, validation.errors);
        }

        console.log(`✅ Compiled workflow: ${Object.keys(compiledWorkflow.nodes).length} nodes, ${Object.keys(compiledWorkflow.edges).length} edges`);
        if (flowFirstMessage) {
          console.log(`📝 First message from flow: "${flowFirstMessage.substring(0, 50)}..."`);
        }
        
        // For Flow agents: Flow's extracted first message takes PRIORITY over request's firstMessage
        // This ensures the agent says the scripted message from the flow, not a form default
        const effectiveFirstMessage = flowFirstMessage || firstMessage;

        // Smart TTS model selection: English uses eleven_turbo_v2, non-English uses admin setting or eleven_multilingual_v2
        // Note: ElevenLabs requires "turbo or flash v2" for conversational agents - v2_5 models are NOT supported
        const isEnglishAgent2 = (language || 'en') === 'en';
        let adminTtsModel: string;
        if (isEnglishAgent2) {
          adminTtsModel = 'eleven_turbo_v2';
        } else {
          const ttsModelSetting = await storage.getGlobalSetting('default_tts_model');
          adminTtsModel = (ttsModelSetting?.value as string) || 'eleven_multilingual_v2';
        }

        // Fetch KB objects with full details (ElevenLabs requires type, id, and name)
        const flowKnowledgeBases: Array<{ type: string; name: string; id: string }> = [];
        if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds) && knowledgeBaseIds.length > 0) {
          console.log(`📚 [Flow] Preparing ${knowledgeBaseIds.length} knowledge base(s)`);
          
          for (const kbId of knowledgeBaseIds) {
            try {
              const kbItem = await storage.getKnowledgeBaseItem(kbId);
              
              if (!kbItem) {
                console.warn(`⚠️  Knowledge base item ${kbId} not found, skipping`);
                continue;
              }

              if (!kbItem.elevenLabsDocId) {
                console.warn(`⚠️  Knowledge base item ${kbId} has no ElevenLabs doc ID, skipping`);
                continue;
              }

              console.log(`   Adding KB "${kbItem.title}" (${kbItem.elevenLabsDocId})`);
              flowKnowledgeBases.push({
                type: kbItem.type === 'text' ? 'text' : 'file',
                name: kbItem.title,
                id: kbItem.elevenLabsDocId
              });
            } catch (error: any) {
              console.error(`   ❌ Failed to fetch KB ${kbId}:`, error.message);
            }
          }
        }

        // Create Flow Agent in ElevenLabs with compiled workflow
        const elevenLabsAgent = await credentialService.createFlowAgent({
          name,
          voice_id: elevenLabsVoiceId,
          language: language || "en",
          maxDurationSeconds: maxDurationSeconds ?? 600,
          voiceStability: voiceStability ?? 0.5,
          voiceSimilarityBoost: voiceSimilarityBoost ?? 0.75,
          voiceSpeed: voiceSpeed ?? 1.0,
          detectLanguageEnabled: detectLanguageEnabled || false,
          systemPrompt: systemPrompt || undefined,
          firstMessage: effectiveFirstMessage || undefined, // Use extracted first message from flow
          knowledgeBases: flowKnowledgeBases.length > 0 ? flowKnowledgeBases : undefined,
          ttsModel: adminTtsModel,
          workflow: compiledWorkflow,
        });

        elevenLabsAgentId = elevenLabsAgent.agent_id;
        agentLink = `https://elevenlabs.io/app/conversational-ai/call/${elevenLabsAgent.agent_id}`;
        
        console.log(`✅ Flow Agent created in ElevenLabs: ${elevenLabsAgentId}`);
      }
      
      // Store in database - save all fields for both agent types
      const agent = await storage.createAgent({
        type: type as 'natural' | 'flow',
        userId: req.userId!,
        name,
        voiceTone: voiceTone || (type === 'natural' ? "professional" : null),
        personality: personality || (type === 'natural' ? "helpful" : null),
        systemPrompt: systemPrompt || null,
        language: language || "en",
        firstMessage: firstMessage || (type === 'natural' ? "Hello! How can I help you today?" : null),
        llmModel: model || (type === 'natural' ? "gpt-4o-mini" : null),
        temperature: temperature !== undefined ? temperature : (type === 'natural' ? 0.5 : null),
        elevenLabsVoiceId: elevenLabsVoiceId,
        elevenLabsAgentId: elevenLabsAgentId,
        agentLink: agentLink,
        // Multi-key pool affinity - store which credential created this agent
        elevenLabsCredentialId: usedCredentialId,
        // Knowledge base - enabled for both natural and flow agents
        knowledgeBaseIds: knowledgeBaseIds || null,
        // Flow Agent fields
        flowId: flowId || null,
        maxDurationSeconds: maxDurationSeconds ?? (type === 'flow' ? 600 : null),
        voiceStability: voiceStability ?? (type === 'flow' ? 0.5 : null),
        voiceSimilarityBoost: voiceSimilarityBoost ?? (type === 'flow' ? 0.75 : null),
        voiceSpeed: voiceSpeed ?? (type === 'flow' ? 1.0 : null),
        // System Tools - enabled for flow agents
        detectLanguageEnabled: type === 'flow' ? (detectLanguageEnabled || false) : false,
        config: { 
          elevenLabsVoiceId,
          model: model || "gpt-4o-mini",
          firstMessage,
          temperature,
          transferRules: type === 'natural' ? transferRules : null,
          knowledgeBaseIds: knowledgeBaseIds || [],
        },
      });

      res.json(agent);
    } catch (error: any) {
      console.error("Create agent error:", error);
      res.status(500).json({ error: error.message || "Failed to create agent" });
    }
  });

  app.patch("/api/elevenlabs/agents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const { 
        type,
        name, 
        voiceTone, 
        personality, 
        systemPrompt, 
        elevenLabsVoiceId, 
        language, 
        model, 
        firstMessage, 
        temperature, 
        transferRules, 
        knowledgeBaseIds,
        flowId,
        maxDurationSeconds,
        voiceStability,
        voiceSimilarityBoost,
        voiceSpeed,
        detectLanguageEnabled,
      } = req.body;

      // Build tools configuration if transfer rules are provided
      const tools = transferRules && transferRules.length > 0 ? [{
        type: "transfer_to_number" as const,
        description: "Transfer user to human support when needed",
        transfer_rules: transferRules,
      }] : undefined;

      // Get ElevenLabs doc IDs from our knowledge base IDs
      let elevenLabsKbIds: string[] | undefined;
      if (knowledgeBaseIds !== undefined) {
        if (knowledgeBaseIds.length > 0) {
          const kbItems = await Promise.all(
            knowledgeBaseIds.map((id: string) => storage.getKnowledgeBaseItem(id))
          );
          // Verify ownership and filter valid items
          elevenLabsKbIds = kbItems
            .filter(item => item && item.userId === req.userId && item.elevenLabsDocId)
            .map(item => item!.elevenLabsDocId!);
          
          console.log(`📚 Filtered ${elevenLabsKbIds.length} valid knowledge base items from ${knowledgeBaseIds.length} selected`);
        } else {
          elevenLabsKbIds = [];
        }
      }

      // Update in database first - this ensures user changes are saved even if ElevenLabs is down
      const existingConfig = (agent.config ?? {}) as import('@shared/schema').AgentConfig;
      const updatedConfig: import('@shared/schema').AgentConfig = {
        ...existingConfig,
        ...(elevenLabsVoiceId && { elevenLabsVoiceId }),
        ...(model && { model }),
        ...(firstMessage !== undefined && { firstMessage }),
        ...(temperature !== undefined && { temperature }),
        ...(transferRules !== undefined && { transferRules }),
        ...(knowledgeBaseIds !== undefined && { knowledgeBaseIds }),
      };

      const updateData: Partial<any> = {
        ...(type && { type }),
        ...(name && { name }),
        ...(voiceTone !== undefined && { voiceTone }),
        ...(personality !== undefined && { personality }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(elevenLabsVoiceId && { elevenLabsVoiceId }),
        ...(language && { language }),
        ...(firstMessage !== undefined && { firstMessage }),
        ...(model && { llmModel: model }),
        ...(temperature !== undefined && { temperature }),
        ...(flowId !== undefined && { flowId }),
        ...(maxDurationSeconds !== undefined && { maxDurationSeconds }),
        ...(voiceStability !== undefined && { voiceStability }),
        ...(voiceSimilarityBoost !== undefined && { voiceSimilarityBoost }),
        ...(voiceSpeed !== undefined && { voiceSpeed }),
        ...(detectLanguageEnabled !== undefined && { detectLanguageEnabled }),
        config: updatedConfig,
      };

      await storage.updateAgent(req.params.id, updateData);

      // Get the agent type (either updated or existing)
      const agentType = type || agent.type || 'natural';

      // Try to sync with ElevenLabs with retry logic
      if (agentType === 'natural' && agent.elevenLabsAgentId && (name || systemPrompt || elevenLabsVoiceId || language || model || firstMessage || temperature !== undefined || voiceTone || personality || tools || elevenLabsKbIds !== undefined)) {
        // Natural Agent: Sync properties
        const effectiveLanguage4 = language || agent.language;
        const isNonEnglish4 = effectiveLanguage4 && effectiveLanguage4 !== 'en';
        
        // Smart TTS model selection for non-English agents
        let adminTtsModel4: string | undefined;
        if (isNonEnglish4) {
          const ttsModelSetting4 = await storage.getGlobalSetting('default_tts_model');
          adminTtsModel4 = (ttsModelSetting4?.value as string) || 'eleven_multilingual_v2';
        }
        
        // Build update payload - no double spreading
        const updatePayload: any = {
          ...(name && { name }),
          ...(systemPrompt && { prompt: systemPrompt }),
          ...(elevenLabsVoiceId && { voice_id: elevenLabsVoiceId }),
          ...(model && { model }),
          ...(firstMessage && { first_message: firstMessage }),
          ...(temperature !== undefined && { temperature }),
          ...(voiceTone && { voice_tone: voiceTone }),
          ...(personality && { personality }),
          ...(tools && { tools }),
          ...(elevenLabsKbIds !== undefined && { knowledge_base_ids: elevenLabsKbIds }),
        };
        
        // For non-English agents: ALWAYS include language and TTS model
        // For English agents changing language: include the new language
        if (isNonEnglish4) {
          updatePayload.language = effectiveLanguage4;
          updatePayload.tts_model = adminTtsModel4;
        } else if (language) {
          updatePayload.language = language;
        }

        // Retry logic: 3 attempts with exponential backoff
        let lastError: any = null;
        const maxRetries = 3;
        const delays = [0, 1000, 2000]; // 0ms, 1s, 2s

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} for ElevenLabs sync...`);
              await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            }
            
            await elevenLabsService.updateAgent(agent.elevenLabsAgentId!, updatePayload);
            console.log("✅ ElevenLabs agent synced successfully");
            break; // Success - exit retry loop
          } catch (error: any) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
            
            // If this was the last attempt, return with warning
            if (attempt === maxRetries - 1) {
              console.error("❌ All retry attempts failed. Changes saved locally only.");
              return res.json({ 
                success: true, 
                warning: "Agent updated locally. ElevenLabs sync failed after 3 attempts. Please try editing again later." 
              });
            }
          }
        }
      } else if (agentType === 'flow' && agent.elevenLabsAgentId && (flowId !== undefined || maxDurationSeconds !== undefined || detectLanguageEnabled !== undefined || elevenLabsVoiceId || name || language || model || temperature !== undefined)) {
        // Flow Agent: Sync workflow when flowId, maxDuration, language detection, voice, or other settings change
        console.log(`🔄 Syncing Flow Agent: ${agent.elevenLabsAgentId}`);
        
        // Get the flow to compile (use new flowId if provided, otherwise use existing)
        const flowToUse = flowId || agent.flowId;
        
        if (flowToUse) {
          try {
            // Fetch the flow from database
            const [flow] = await db
              .select()
              .from(flows)
              .where(and(eq(flows.id, flowToUse), eq(flows.userId, req.userId!)));
            
            if (flow) {
              // Compile the flow to ElevenLabs workflow format
              const compiler = new ElevenLabsFlowCompiler(
                flow.nodes as FlowNode[],
                flow.edges as FlowEdge[]
              );
              const compileResult = compiler.compile();
              const compiledWorkflow = compileResult.workflow;
              const flowFirstMessage = compileResult.firstMessage;
              
              console.log(`📋 Recompiled flow: ${flow.name} with ${Object.keys(compiledWorkflow.nodes).length} nodes`);
              if (flowFirstMessage) {
                console.log(`📝 First message from flow: "${flowFirstMessage.substring(0, 50)}..."`);
              }
              
              // For Flow agents, prioritize the flow's extracted first message over agent's stored value
              const effectiveFirstMessage5 = flowFirstMessage || firstMessage;
              
              // Determine effective language and TTS model for non-English agents
              const effectiveLanguage5 = language || agent.language;
              const isNonEnglish5 = effectiveLanguage5 && effectiveLanguage5 !== 'en';
              
              // Smart TTS model selection for non-English agents
              let adminTtsModel5: string | undefined;
              if (isNonEnglish5) {
                const ttsModelSetting5 = await storage.getGlobalSetting('default_tts_model');
                adminTtsModel5 = (ttsModelSetting5?.value as string) || 'eleven_multilingual_v2';
              }
              
              // Resolve LLM model if provided
              let effectiveLlmModel5: string | undefined;
              if (model) {
                const { llmModels } = await import("@shared/schema");
                const modelRecord = await db
                  .select({ modelId: llmModels.modelId })
                  .from(llmModels)
                  .where(eq(llmModels.name, model))
                  .limit(1);
                
                effectiveLlmModel5 = modelRecord.length > 0 ? modelRecord[0].modelId : model;
                console.log(`📝 Flow agent ElevenLabs sync - LLM model: ${effectiveLlmModel5}`);
              }

              // Update the ElevenLabs agent with new workflow and TTS config
              await elevenLabsService.updateFlowAgentWorkflow(
                agent.elevenLabsAgentId,
                compiledWorkflow,
                maxDurationSeconds ?? (agent.maxDurationSeconds || 600),
                detectLanguageEnabled !== undefined ? detectLanguageEnabled : (agent.detectLanguageEnabled || false),
                isNonEnglish5 ? effectiveLanguage5 : undefined,  // Pass language for non-English
                isNonEnglish5 ? adminTtsModel5 : undefined,  // Pass TTS model for non-English
                effectiveLlmModel5,  // Pass LLM model if provided
                temperature,  // Pass temperature if provided
                effectiveFirstMessage5,  // Pass first message extracted from flow
                elevenLabsVoiceId  // Pass voice ID if provided
              );
              
              console.log("✅ Flow Agent workflow synced successfully");
            } else {
              console.warn(`⚠️ Flow not found for sync: ${flowToUse}`);
            }
          } catch (error: any) {
            console.error("❌ Flow Agent sync failed:", error.message);
            return res.json({ 
              success: true, 
              warning: "Agent updated locally. ElevenLabs workflow sync failed. Please try editing again later." 
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Update agent error:", error);
      res.status(500).json({ error: error.message || "Failed to update agent" });
    }
  });

  app.delete("/api/elevenlabs/agents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Delete from ElevenLabs if exists
      if (agent.elevenLabsAgentId) {
        try {
          await elevenLabsService.deleteAgent(agent.elevenLabsAgentId);
        } catch (error) {
          console.error("Failed to delete from ElevenLabs:", error);
        }
      }

      // Decrement the assigned agents count for the credential
      if (agent.elevenLabsCredentialId) {
        try {
          await ElevenLabsPoolService.updateAssignmentCount(agent.elevenLabsCredentialId, false);
          console.log(`📊 [Agent Delete] Decremented agent count for credential ${agent.elevenLabsCredentialId}`);
        } catch (countError) {
          console.warn("Failed to update credential agent count:", countError);
        }
      }

      // Delete from database
      await storage.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete agent error:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // Test endpoint to add call transfer to an agent
  // Note: Flow agents should NOT use this endpoint - they have transfer nodes in their visual flow
  app.post("/api/elevenlabs/agents/:id/configure-transfer", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Reject Flow agents - they should use transfer nodes in the flow builder instead
      if (agent.type === 'flow') {
        return res.status(400).json({ 
          error: "Flow agents cannot use this endpoint. Use the Transfer node in your flow instead." 
        });
      }

      const { transferNumber, condition, customerMessage, operatorMessage } = req.body;

      if (!transferNumber) {
        return res.status(400).json({ error: "Transfer number is required" });
      }

      const transferRules = [{
        transfer_type: "conference" as const,
        number_type: "phone" as const,
        destination: transferNumber,
        condition: condition || "User explicitly requests to speak to a human or customer care representative",
        customer_message: customerMessage || "Please hold while I transfer you to our support team",
        operator_message: operatorMessage || "Customer needs assistance",
      }];

      const tools = [{
        type: "transfer_to_number" as const,
        description: "Transfer user to human support when needed",
        transfer_rules: transferRules,
      }];

      // Update in ElevenLabs
      if (agent.elevenLabsAgentId) {
        await elevenLabsService.updateAgent(agent.elevenLabsAgentId, { tools });
        console.log(`✅ Call transfer configured for agent ${agent.name} (${agent.elevenLabsAgentId})`);
      }

      // Update in database
      const existingConfig = (agent.config ?? {}) as import('@shared/schema').AgentConfig;
      const updatedConfig: import('@shared/schema').AgentConfig = {
        ...existingConfig,
        transferRules,
      };

      await storage.updateAgent(req.params.id, { config: updatedConfig });
      
      res.json({ 
        success: true,
        message: `Call transfer configured successfully. The AI will now transfer calls to ${transferNumber} when appropriate.`
      });
    } catch (error: any) {
      console.error("Configure transfer error:", error);
      res.status(500).json({ error: error.message || "Failed to configure call transfer" });
    }
  });

  // ElevenLabs Voices routes
  // Uses pool credentials (user affinity) to fetch voices, not global env var
  app.get("/api/elevenlabs/voices", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Get credential from pool - use user affinity for consistency
      const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
      
      if (!credential) {
        // No pool credentials available - return empty array with helpful message
        console.warn("⚠️ [Voices] No ElevenLabs credentials in pool - voices cannot be fetched");
        return res.json([]);
      }
      
      // Create service instance with pool credential
      const poolService = new ElevenLabsService(credential.apiKey);
      const { voices } = await poolService.listVoices();
      res.json(voices);
    } catch (error: any) {
      console.error("Get ElevenLabs voices error:", error);
      res.status(500).json({ error: error.message || "Failed to get voices" });
    }
  });

  // ElevenLabs Voice Limit - Returns voice slot usage and limits
  // Uses pool credentials to fetch subscription info
  app.get("/api/elevenlabs/voice-limit", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Get credential from pool for this user
      const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
      
      if (!credential) {
        // No pool credentials - return defaults
        return res.json({
          used: 0,
          limit: 30,
          atLimit: false,
          canExtend: false,
          tier: 'not_configured',
        });
      }
      
      const poolService = new ElevenLabsService(credential.apiKey);
      const subscription = await poolService.getSubscription();
      
      // ElevenLabs API returns voice_slots_used and voice_limit (not voice_count/max_voice_count)
      const used = subscription.voice_slots_used ?? 0;
      const limit = subscription.voice_limit ?? 30;
      
      const response = {
        used,
        limit,
        atLimit: used >= limit,
        canExtend: subscription.can_extend_voice_limit ?? false,
        tier: subscription.tier ?? 'unknown',
      };
      res.json(response);
    } catch (error: any) {
      console.error("Get voice limit error:", error);
      // Fallback to reasonable defaults if subscription fetch fails
      res.json({
        used: 0,
        limit: 30,
        atLimit: false,
        canExtend: false,
        tier: 'unknown',
      });
    }
  });

  // ElevenLabs Shared Voices (Voice Library) - 5000+ community voices (LEGACY - use /api/voices/search instead)
  app.get("/api/elevenlabs/shared-voices", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { 
        page, 
        pageSize, 
        search, 
        language, 
        gender, 
        age, 
        accent, 
        category,
        useCases 
      } = req.query;

      const result = await elevenLabsService.listSharedVoices({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : 100,
        search: search as string | undefined,
        language: language as string | undefined,
        gender: gender as string | undefined,
        age: age as string | undefined,
        accent: accent as string | undefined,
        category: category as string | undefined,
        useCases: useCases ? (useCases as string).split(',') : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Get ElevenLabs shared voices error:", error);
      res.status(500).json({ error: error.message || "Failed to get shared voices" });
    }
  });

  // ElevenLabs LLM Pricing route
  app.get("/api/elevenlabs/llm-pricing", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Fetch LLM pricing from ElevenLabs
      const pricing = await elevenLabsService.getLLMPricing();
      
      // Get admin margin percentage from global settings (default to 0% if not set)
      const marginSetting = await storage.getGlobalSetting('llm_pricing_margin');
      const marginPercentage = marginSetting ? parseFloat(String(marginSetting.value)) : 0;
      
      // Apply margin to all prices
      const pricingWithMargin = {
        ...pricing,
        llm_prices: pricing.llm_prices.map(llm => ({
          ...llm,
          // Apply margin percentage (e.g., 10% margin = multiply by 1.10)
          cost_per_million_input_tokens: llm.cost_per_million_input_tokens * (1 + marginPercentage / 100),
          cost_per_million_output_tokens: llm.cost_per_million_output_tokens * (1 + marginPercentage / 100),
          cost_per_million_input_cache_read_tokens: llm.cost_per_million_input_cache_read_tokens 
            ? llm.cost_per_million_input_cache_read_tokens * (1 + marginPercentage / 100)
            : undefined,
          cost_per_million_input_cache_write_tokens: llm.cost_per_million_input_cache_write_tokens
            ? llm.cost_per_million_input_cache_write_tokens * (1 + marginPercentage / 100)
            : undefined,
          // Add margin info for transparency
          margin_percentage: marginPercentage,
          original_cost_per_million_input_tokens: llm.cost_per_million_input_tokens,
          original_cost_per_million_output_tokens: llm.cost_per_million_output_tokens,
        })),
      };
      
      res.json(pricingWithMargin);
    } catch (error: any) {
      console.error("Get LLM pricing error:", error);
      res.status(500).json({ error: error.message || "Failed to get LLM pricing" });
    }
  });

  // Phone Numbers routes are now in server/routes/phone-routes.ts

  // Twilio webhook endpoints (validated with Twilio signature verification)
  app.post("/api/webhooks/twilio/voice", validateTwilioWebhook, handleTwilioVoiceWebhook); // Outbound campaign calls
  app.post("/api/webhooks/twilio/incoming", validateTwilioWebhook, handleIncomingCallWebhook); // Incoming calls to purchased numbers
  app.post("/api/webhooks/ivr/handle-language", validateTwilioWebhook, handleIvrLanguageSelection); // IVR language selection
  app.post("/api/webhooks/ivr/handle-selection", validateTwilioWebhook, handleIvrSelection); // IVR department selection
  app.post("/api/webhooks/twilio/status", validateTwilioWebhook, handleTwilioStatusWebhook);
  app.post("/api/webhooks/twilio/human-dial-status", validateTwilioWebhook, handleHumanDialStatusWebhook);
  app.post("/api/webhooks/twilio/recording", validateTwilioWebhook, handleTwilioRecordingWebhook);
  
  // Flow-based execution webhooks (validated with Twilio signature verification)
  app.post("/api/webhooks/twilio/flow/answer", validateTwilioWebhook, handleFlowVoiceAnswer);
  app.post("/api/webhooks/twilio/flow/node", validateTwilioWebhook, handleFlowNode);
  app.post("/api/webhooks/twilio/flow/gather", validateTwilioWebhook, handleFlowGather);
  app.post("/api/webhooks/twilio/flow/continue", validateTwilioWebhook, handleFlowContinue);
  app.post("/api/webhooks/twilio/flow/status", validateTwilioWebhook, handleFlowStatus);
  
  // ElevenLabs webhook endpoints (no authentication - called by ElevenLabs)
  app.post("/api/webhooks/elevenlabs", handleElevenLabsWebhook); // Call completion notifications
  // RAG knowledge base tool - supports both URL-based token (primary) and header token (fallback)
  app.post("/api/webhooks/elevenlabs/rag-tool/:token/:agentId", handleRAGToolWebhook); // New: token in URL
  app.post("/api/webhooks/elevenlabs/rag-tool/:agentId", handleRAGToolWebhook); // Legacy: header auth
  // Appointment booking tool webhook - called by ElevenLabs when appointment node executes
  app.post("/api/webhooks/elevenlabs/appointment/:token/:agentId", handleAppointmentToolWebhook);
  // Form submission tool webhook - called by ElevenLabs when form node executes
  app.post("/api/webhooks/elevenlabs/form/:token/:formId/:agentId", handleFormSubmissionWebhook);
  // Dynamic form submission webhook - called by ElevenLabs when no pre-assigned form exists
  app.post("/api/webhooks/elevenlabs/dynamic-form/:token/:userId/:agentId", handleDynamicFormSubmissionWebhook);
  app.get("/api/webhooks/elevenlabs/dynamic-form-list/:token/:userId/:agentId", handleDynamicFormListWebhook);
  // Play audio tool webhook - called by ElevenLabs when play_audio node executes
  app.post("/api/elevenlabs/tools/play-audio/:agentId", handlePlayAudioToolWebhook);

  // Stripe routes
  app.use("/api/stripe", stripeRouter);

  // Razorpay routes (alternative payment gateway)
  app.use("/api/razorpay", razorpayRouter);

  // PayPal routes (global payment gateway)
  app.use("/api/paypal", paypalRouter);

  // Paystack routes (Africa payment gateway - NGN, GHS, ZAR, KES)
  app.use("/api/paystack", paystackRouter);

  // MercadoPago routes (Latin America payment gateway - BRL, MXN, ARS, CLP, COP)
  app.use("/api/mercadopago", mercadopagoRouter);

  app.use("/api/transactions", transactionsRouter);

  app.use("/api/internal", internalApiRouter);

  // User-accessible refund note download (separate from admin routes)
  app.get("/api/refunds/:id/download", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      
      const refund = await storage.getRefund(id);
      if (!refund) {
        return res.status(404).json({ message: "Refund not found" });
      }

      // Users can only download their own refund notes
      if (refund.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!refund.pdfUrl) {
        try {
          const updatedRefund = await generateRefundNoteForRefund(id);
          if (!updatedRefund.pdfUrl) {
            return res.status(404).json({ message: "Refund note PDF not available" });
          }
        } catch (error) {
          return res.status(404).json({ message: "Refund note PDF not available" });
        }
      }

      const pdfBuffer = await refundNoteService.getRefundNotePDF(id);
      if (!pdfBuffer) {
        return res.status(404).json({ message: "Refund note PDF file not found" });
      }

      const latestRefund = await storage.getRefund(id);
      const fileName = latestRefund?.refundNoteNumber 
        ? `${latestRefund.refundNoteNumber.replace(/\//g, '-')}.pdf`
        : `refund-note-${id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error downloading refund note:", error);
      res.status(500).json({ message: "Failed to download refund note", error: error.message });
    }
  });

  // Audio upload routes
  app.use("/api/audio", audioRoutes);

  // Invoice routes (download, generate)
  app.use("/api/invoices", invoiceRouter);

  // Flow Automation routes
  // Use hybrid auth to allow both users and team members
  app.use("/api/flow-automation", routeContext.authenticateHybrid as unknown as import('express').RequestHandler, flowAutomationRouter);

  // Incoming Connections routes (links agents to phone numbers)
  app.use("/api/incoming-connections", incomingConnectionsRouter);

  // CRM routes - Lead Management (isolated module)
  // Use hybrid auth to allow both users and team members
  app.use("/api/crm", routeContext.authenticateHybrid as unknown as import('express').RequestHandler, crmRoutes);

  // Integration OAuth callback (public - no auth required, receives redirect from OAuth providers)
  app.use("/api/integrations/oauth", integrationOAuthCallback);

  // Integration Marketplace routes (n8n-powered)
  app.use("/api/integrations", routeContext.authenticateHybrid as unknown as import('express').RequestHandler, integrationRoutes);

  // Contact Import routes (CSV, vCard, Google, Microsoft, CRM sync)
  app.use("/api/contact-import", contactImportRoutes(routeContext));

  // Public Platform Languages route - for i18n dynamic loading (no auth required)
  // Must be registered BEFORE publicWidgetRoutes to ensure specific path matches first
  app.use("/api/public/platform-languages", platformLanguagesPublicRouter);

  // IVR Audio routes - NO authentication (Twilio calls this directly during phone calls)
  // Must be registered BEFORE the catch-all /api auth middleware below
  const ivrAudioRoutes = createIvrAudioRoutes();
  app.use("/api/departments", ivrAudioRoutes);

  const deprockIvrAudioRoutes = createDeprockIvrAudioRoutes();
  app.use("/api/deprock", deprockIvrAudioRoutes);

  // Deprock IVR webhook routes - MUST be mounted before authenticated deprock routes
  // These are called by Twilio and cannot require authentication
  const { deprockIvrRouter } = await import("./engines/twilio-bedrock-polly/routes/ivr-webhooks");
  app.use("/api/deprock/ivr", deprockIvrRouter);

  // Website Widget routes - Embeddable voice widgets (isolated module)
  // Public widget routes must be registered BEFORE authenticated routes to allow external website embedding
  app.use("/api/public", publicWidgetRoutes);
  app.use("/api", routeContext.authenticateHybrid as unknown as import('express').RequestHandler, widgetRoutes);

  // RAG Knowledge Base routes (scalable alternative to ElevenLabs 20MB KB)
  // Set USE_RAG_KNOWLEDGE=true to enable this system
  const ragKnowledgeRoutes = createRAGKnowledgeRoutes(routeContext.authenticateHybrid);
  app.use("/api/rag-knowledge", ragKnowledgeRoutes);

  // Product Inventory routes
  const productRoutes = createProductRoutes(routeContext.authenticateHybrid);
  app.use("/api/products", productRoutes);

  const userSmtpRoutes = createUserSmtpRoutes(routeContext.authenticateHybrid);
  app.use("/api/user-smtp", userSmtpRoutes);

  const userApiKeysRoutes = createUserApiKeysRoutes(routeContext.authenticateHybrid);
  app.use("/api/user/api-keys", userApiKeysRoutes);

  app.post("/api/api-keys/regenerate", routeContext.authenticateHybrid as any, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const newKey = "agl_" + crypto.randomBytes(32).toString("hex");
      await db.update(users).set({ apiKey: newKey }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  registerBedrockKBRoutes(app, routeContext.authenticateHybrid);

  // Knowledge Intelligence routes (crawling, AI analysis, content generation)
  const knowledgeIntelligenceRoutes = createKnowledgeIntelligenceRoutes();
  app.use("/api/knowledge-intelligence", routeContext.authenticateHybrid, knowledgeIntelligenceRoutes);

  // Department Management routes
  const departmentRoutes = createDepartmentRoutes(routeContext.authenticateHybrid);
  app.use("/api/departments", departmentRoutes);

  // Deprock (Bedrock + Polly) Department Management routes
  const deprockRoutes = createDeprockRoutes(routeContext.authenticateHybrid);
  app.use("/api/deprock", deprockRoutes);

  // Voice-core per-turn latency metrics and TTS provider health
  const voiceMetricsRoutes = createVoiceMetricsRoutes(routeContext.authenticateHybrid as unknown as import('express').RequestHandler);
  app.use("/api/voice-metrics", voiceMetricsRoutes);

  // Live Call Monitoring routes
  const liveMonitoringRoutes = createLiveMonitoringRoutes(routeContext.authenticateHybrid);
  app.use(liveMonitoringRoutes);

  // This must be registered on the httpServer to properly handle Twilio WebSocket streams
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';
    
    console.log(`🔌 [Upgrade] Request for: ${request.url}`);
    console.log(`   Pathname: ${pathname}`);
    
    // Only handle Twilio stream WebSocket upgrades
    if (pathname === '/api/webhooks/twilio/stream') {
      console.log(`✅ [Upgrade] Handling Twilio stream WebSocket`);
      
      const wss = new WebSocketServer({ noServer: true });
      
      wss.handleUpgrade(request, socket, head, async (ws: any) => {
        console.log(`✅ [WebSocket] Upgrade successful for Twilio stream`);
        console.log(`   Waiting for Twilio 'start' event to determine routing...`);
        
        let handlerRouted = false;
        let startTimeout: NodeJS.Timeout | null = null;
        const bufferedMessages: Buffer[] = [];
        
        // Temporary message handler to wait for 'start' event
        const tempMessageHandler = async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            
            // Buffer all messages as raw Buffers (not parsed objects)
            bufferedMessages.push(message);
            
            // Ignore 'connected' and other non-start events
            if (data.event !== 'start') {
              console.log(`📨 [WebSocket] Received '${data.event}' event, buffering...`);
              return;
            }
            
            // Got start event - clear timeout and route to handler
            if (startTimeout) {
              clearTimeout(startTimeout);
              startTimeout = null;
            }
            
            console.log(`📨 [WebSocket] Received Twilio 'start' event, routing to handler`);
            
            // Extract custom parameters sent from TwiML <Parameter> tags
            const customParams = data.start?.customParameters || {};
            const callId = customParams.callId;
            const agentId = customParams.agentId;
            
            console.log(`   Extracted routing params:`);
            console.log(`   - callId: ${callId}`);
            console.log(`   - agentId: ${agentId}`);
            
            if (!agentId || !callId) {
              console.error(`❌ [WebSocket] Missing required routing parameters (agentId or callId)`);
              ws.close(1008, 'Missing required parameters');
              return;
            }
            
            // Look up agent type to determine routing
            // Note: agentId could be either database UUID (Flow) or ElevenLabs ID (Natural)
            try {
              // Try looking up by database ID first (Flow agents)
              let agentRecords = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
              
              // If not found, try ElevenLabs ID (Natural agents)
              if (agentRecords.length === 0) {
                agentRecords = await db.select().from(agents).where(eq(agents.elevenLabsAgentId, agentId)).limit(1);
              }
              
              const agent = agentRecords[0];
              
              if (!agent) {
                console.error(`❌ [WebSocket] Agent not found for ID: ${agentId}`);
                ws.close(1008, 'Agent not found');
                return;
              }
              
              // Security: Verify the call exists in our database
              // This prevents spoofed WebSocket connections with fake call IDs
              const [existingCall] = await db
                .select({ id: calls.id })
                .from(calls)
                .where(eq(calls.id, callId))
                .limit(1);
              
              if (!existingCall) {
                console.error(`❌ [WebSocket] Security: Call not found for ID: ${callId}`);
                ws.close(1008, 'Call not found');
                return;
              }
              
              console.log(`✅ [WebSocket] Found agent: ${agent.id} (type: ${agent.type})`);
              
              // Remove temp message handler before routing
              ws.removeListener('message', tempMessageHandler);
              handlerRouted = true;
              
              // Extract ALL custom parameters for handlers to use
              const flowId = customParams.flowId;
              const executionId = customParams.executionId;
              const fromPhone = customParams.fromPhone || customParams.from;
              const contactName = customParams.contactName;
              
              // Create mock request with full parameter set for handlers
              const mockReq: any = {
                url: request.url,
                headers: request.headers,
                query: {
                  callId,
                  agentId,
                  flowId,
                  executionId,
                  from: fromPhone,
                  contactName
                }
              };
              
              if (agent.elevenLabsAgentId) {
                console.log(`🔀 [WebSocket] Routing to ElevenLabs handler (agent type: ${agent.type})`);
                if (agent.type === 'flow') {
                  console.log(`   Flow context: flowId=${flowId}, executionId=${executionId}`);
                }
                handleTwilioStreamWebSocket(ws, mockReq);
                
                setTimeout(() => {
                  console.log(`📨 [WebSocket] Replaying ${bufferedMessages.length} buffered messages`);
                  for (const bufferedMsg of bufferedMessages) {
                    ws.emit('message', bufferedMsg);
                  }
                  bufferedMessages.length = 0;
                }, 100);
              } else {
                console.log(`🔀 [WebSocket] Agent has no elevenLabsAgentId, routing to OpenAI Realtime (agent type: ${agent.type})`);
                
                try {
                  let credential = await OpenAIPoolService.reserveSlot();
                  let openaiCredentialId: string | null = null;
                  
                  if (!credential) {
                    console.log(`🔄 [WebSocket] No pool credentials, attempting to use fallback OpenAI API key from global settings/env`);
                    
                    let apiKey: string | undefined;
                    
                    try {
                      const [dbSetting] = await db
                        .select()
                        .from(globalSettings)
                        .where(eq(globalSettings.key, "openai_api_key"))
                        .limit(1);
                      
                      if (dbSetting?.value) {
                        apiKey = (dbSetting.value as string).replace(/^"+|"+$/g, '');
                      }
                    } catch (dbError) {
                      console.warn(`⚠️ [WebSocket] Failed to fetch openai_api_key from global_settings:`, dbError);
                    }
                    
                    if (!apiKey) {
                      apiKey = process.env.OPENAI_API_KEY;
                    }
                    
                    if (!apiKey) {
                      apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
                    }
                    
                    if (!apiKey) {
                      console.error(`❌ [WebSocket] No OpenAI credentials available (not in pool, global_settings, or env vars) for agent ${agent.id}`);
                      ws.close(1011, 'No OpenAI credentials available');
                      return;
                    }
                    
                    credential = {
                      id: 'fallback-global-key',
                      name: 'Global Settings Key (Fallback)',
                      apiKey: apiKey,
                      modelTier: 'free',
                      maxConcurrency: 1,
                      currentLoad: 0,
                      totalAssignedAgents: 0,
                      totalAssignedUsers: 0,
                      maxAgentsThreshold: 0,
                      isActive: true,
                      healthStatus: 'healthy',
                      lastHealthCheck: new Date(),
                      metadata: null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    } as any;
                    
                    openaiCredentialId = null;
                    console.log(`🔄 [WebSocket] Using fallback OpenAI API key from global settings/env`);
                  } else {
                    openaiCredentialId = credential.id;
                    console.log(`✅ [WebSocket] Reserved OpenAI credential: ${credential.name} (ID: ${credential.id})`);
                  }
                  
                  const openaiModel = agent.openaiModel || 'gpt-4o-realtime-preview';
                  const openaiVoice = agent.openaiVoice || 'alloy';
                  
                  const [twilioOpenaiCall] = await db.insert(twilioOpenaiCalls).values({
                    twilioCallSid: data.start?.callSid || callId,
                    agentId: agent.id,
                    userId: agent.userId,
                    fromNumber: fromPhone || '',
                    toNumber: customParams.toNumber || '',
                    callDirection: 'inbound',
                    status: 'in-progress',
                    openaiCredentialId: openaiCredentialId,
                    openaiVoice: openaiVoice,
                    openaiModel: openaiModel,
                    metadata: {
                      systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
                      firstMessage: agent.firstMessage || undefined,
                      temperature: agent.temperature || 0.7,
                      language: agent.language || 'en',
                      transferEnabled: agent.transferEnabled,
                      transferPhoneNumber: agent.transferPhoneNumber,
                      endConversationEnabled: agent.endConversationEnabled,
                      detectLanguageEnabled: agent.detectLanguageEnabled,
                      knowledgeBaseIds: agent.knowledgeBaseIds || [],
                      appointmentBookingEnabled: agent.appointmentBookingEnabled,
                    },
                  }).returning();
                  
                  console.log(`✅ [WebSocket] Created twilioOpenaiCalls record: ${twilioOpenaiCall.id}`);
                  
                  let agentConfig = OpenAIAgentFactory.createAgentConfig({
                    voice: openaiVoice as any,
                    model: openaiModel as any,
                    systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
                    firstMessage: agent.firstMessage || undefined,
                    temperature: agent.temperature || 0.7,
                    toolContext: {
                      userId: agent.userId,
                      agentId: agent.id,
                      callId: twilioOpenaiCall.id,
                    },
                    language: agent.language || 'en',
                  });
                  
                  if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
                    agentConfig = OpenAIAgentFactory.addKnowledgeBaseTool(
                      agentConfig,
                      agent.knowledgeBaseIds,
                      agent.userId
                    );
                  }
                  
                  if (agent.appointmentBookingEnabled && agent.userId) {
                    agentConfig = OpenAIAgentFactory.addAppointmentTool(
                      agentConfig,
                      agent.userId,
                      agent.id,
                      twilioOpenaiCall.id
                    );
                  }
                  
                  if (agent.transferEnabled && agent.transferPhoneNumber) {
                    agentConfig = OpenAIAgentFactory.addTransferTool(
                      agentConfig,
                      agent.transferPhoneNumber,
                      undefined
                    );
                  }
                  
                  if (agent.transferEnabled && agent.transferAgentId) {
                    agentConfig = OpenAIAgentFactory.addTransferToAgentTool(
                      agentConfig,
                      agent.transferAgentId
                    );
                  }
                  
                  if (agent.endConversationEnabled) {
                    agentConfig = OpenAIAgentFactory.addEndCallTool(agentConfig);
                  }
                  
                  if (agent.detectLanguageEnabled) {
                    agentConfig = OpenAIAgentFactory.enableLanguageDetection(agentConfig);
                  }
                  
                  if (!agentConfig.tools?.some((t: any) => t.name === 'end_call')) {
                    agentConfig = OpenAIAgentFactory.addEndCallTool(agentConfig);
                  }
                  
                  console.log(`✅ [WebSocket] OpenAI agent config ready with ${agentConfig.tools?.length || 0} tools`);
                  
                  await TwilioOpenAIAudioBridge.createSession({
                    callSid: data.start?.callSid || callId,
                    openaiApiKey: credential!.apiKey,
                    agentConfig,
                    twilioWs: ws,
                    streamSid: data.start?.streamSid || undefined,
                    fromNumber: fromPhone || '',
                    toNumber: customParams.toNumber || '',
                    callDirection: 'inbound',
                  });
                  
                  console.log(`✅ [WebSocket] OpenAI Realtime session created for call ${callId}`);
                  
                  const bridgeCallSid = data.start?.callSid || callId;
                  
                  const openaiMessageHandler = (msg: Buffer) => {
                    try {
                      const event = JSON.parse(msg.toString());
                      TwilioOpenAIAudioBridge.handleTwilioMedia(bridgeCallSid, event);
                    } catch (err) {
                      console.error(`❌ [WebSocket] Error forwarding message to OpenAI bridge:`, err);
                    }
                  };
                  ws.on('message', openaiMessageHandler);
                  
                  ws.on('close', () => {
                    console.log(`🔌 [WebSocket] Twilio stream closed for ${bridgeCallSid}`);
                    TwilioOpenAIAudioBridge.handleTwilioMedia(bridgeCallSid, { event: 'stop' } as any);
                  });
                  
                  setTimeout(() => {
                    console.log(`📨 [WebSocket] Replaying ${bufferedMessages.length} buffered messages`);
                    for (const bufferedMsg of bufferedMessages) {
                      ws.emit('message', bufferedMsg);
                    }
                    bufferedMessages.length = 0;
                  }, 100);
                } catch (openaiError) {
                  console.error(`❌ [WebSocket] Failed to initialize OpenAI Realtime session:`, openaiError);
                  ws.close(1011, 'Failed to initialize OpenAI session');
                }
              }
              
            } catch (error) {
              console.error('❌ [WebSocket] Error during routing:', error);
              ws.close(1011, 'Internal server error during routing');
            }
          } catch (error) {
            console.error('❌ [WebSocket] Error parsing message:', error);
            // Don't close on parse errors, just log and continue
          }
        };
        
        // Attach temporary message handler
        ws.on('message', tempMessageHandler);
        
        // Set timeout for start event
        startTimeout = setTimeout(() => {
          if (!handlerRouted) {
            console.error('❌ [WebSocket] Timeout waiting for Twilio start event');
            ws.removeListener('message', tempMessageHandler);
            ws.close(1008, 'Start event timeout');
          }
        }, 10000); // 10 second timeout
        
        // Clean up timeout on connection close
        ws.on('close', () => {
          if (startTimeout) {
            clearTimeout(startTimeout);
            startTimeout = null;
          }
        });
      });
    } else {
      // For all other upgrade requests (like Vite HMR), do nothing
      // Let them pass through to other handlers
      console.log(`📡 [Upgrade] Passing through: ${pathname}`);
    }
  });

  // ============================================
  // USER LIMITS API
  // ============================================
  
  // Get all user limits and current usage
  app.get("/api/user/limits", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const limits = await storage.getUserEffectiveLimits(req.userId!);
      
      // Get current counts
      const webhookCount = await storage.getUserWebhookCount(req.userId!);
      const kbCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.userId, req.userId!));
      const flowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(flows)
        .where(eq(flows.userId, req.userId!));
      const phoneCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(phoneNumbers)
        .where(eq(phoneNumbers.userId, req.userId!));
      
      res.json({
        webhooks: {
          current: webhookCount,
          max: limits.maxWebhooks,
          remaining: Math.max(0, limits.maxWebhooks - webhookCount),
          source: limits.sources.maxWebhooks
        },
        knowledgeBases: {
          current: Number(kbCount[0]?.count || 0),
          max: limits.maxKnowledgeBases,
          remaining: Math.max(0, limits.maxKnowledgeBases - Number(kbCount[0]?.count || 0)),
          source: limits.sources.maxKnowledgeBases
        },
        flows: {
          current: Number(flowCount[0]?.count || 0),
          max: limits.maxFlows,
          remaining: Math.max(0, limits.maxFlows - Number(flowCount[0]?.count || 0)),
          source: limits.sources.maxFlows
        },
        phoneNumbers: {
          current: Number(phoneCount[0]?.count || 0),
          max: limits.maxPhoneNumbers,
          remaining: Math.max(0, limits.maxPhoneNumbers - Number(phoneCount[0]?.count || 0)),
          source: limits.sources.maxPhoneNumbers
        }
      });
    } catch (error: any) {
      console.error("Get user limits error:", error);
      res.status(500).json({ error: "Failed to get user limits" });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const notifications = await storage.getUserNotifications(req.userId!, limit);
      res.json(notifications);
    } catch (error: any) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.userId!);
      res.json({ count });
    } catch (error: any) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification || notification.userId !== req.userId) {
        return res.status(404).json({ error: "Notification not found" });
      }

      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead(req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification || notification.userId !== req.userId) {
        return res.status(404).json({ error: "Notification not found" });
      }

      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  app.get("/api/notifications/banner", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const notifications = await storage.getBannerNotifications(req.userId!);
      res.json(notifications);
    } catch (error: any) {
      console.error("Get banner notifications error:", error);
      res.status(500).json({ error: "Failed to get banner notifications" });
    }
  });

  app.patch("/api/notifications/:id/dismiss", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification || notification.userId !== req.userId) {
        return res.status(404).json({ error: "Notification not found" });
      }

      await storage.dismissNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Dismiss notification error:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // ============================================
  // PROMPT TEMPLATES ROUTES
  // ============================================

  // Get all prompt templates available to user (own + system + public)
  app.get("/api/prompt-templates", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      
      // Get user's own templates
      const userTemplates = await storage.getUserPromptTemplates(req.userId!);
      
      // Get system templates
      const systemTemplates = await storage.getSystemPromptTemplates();
      
      // Get public templates (from other users)
      const publicTemplates = await storage.getPublicPromptTemplates();
      
      // Combine and deduplicate (user's own templates take priority, avoid system template duplicates)
      const userTemplateIds = new Set(userTemplates.map(t => t.id));
      const systemTemplateIds = new Set(systemTemplates.map(t => t.id));
      const filteredPublic = publicTemplates.filter(t => 
        !userTemplateIds.has(t.id) && 
        !systemTemplateIds.has(t.id) && 
        t.userId !== req.userId
      );
      
      let allTemplates = [...userTemplates, ...systemTemplates, ...filteredPublic];
      
      // Filter by category if specified
      if (category && category !== 'all') {
        allTemplates = allTemplates.filter(t => t.category === category);
      }
      
      res.json(allTemplates);
    } catch (error: any) {
      console.error("Get prompt templates error:", error);
      res.status(500).json({ error: "Failed to get prompt templates" });
    }
  });

  // Get single prompt template
  app.get("/api/prompt-templates/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template not found" });
      }
      
      // Allow access if: own template, system template, or public template
      const isOwn = template.userId === req.userId;
      const isSystem = template.isSystemTemplate;
      const isPublic = template.isPublic;
      
      if (!isOwn && !isSystem && !isPublic) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error("Get prompt template error:", error);
      res.status(500).json({ error: "Failed to get prompt template" });
    }
  });

  // Create prompt template
  app.post("/api/prompt-templates", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Validate with Zod schema
      const validationResult = insertPromptTemplateSchema.safeParse({
        ...req.body,
        userId: req.userId,
        isSystemTemplate: false,
      });
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => e.message).join(', ');
        return res.status(400).json({ error: `Validation failed: ${errors}` });
      }

      const { 
        name, 
        description, 
        category, 
        systemPrompt, 
        firstMessage, 
        variables,
        suggestedVoiceTone,
        suggestedPersonality,
        isPublic 
      } = validationResult.data;

      // Extract variables from template using {{variable}} pattern
      const extractedVars = (systemPrompt.match(/\{\{(\w+)\}\}/g) || [])
        .map((v: string) => v.replace(/\{\{|\}\}/g, ''));
      const firstMsgVars = (firstMessage?.match(/\{\{(\w+)\}\}/g) || [])
        .map((v: string) => v.replace(/\{\{|\}\}/g, ''));
      
      const allVariables = Array.from(new Set([...extractedVars, ...firstMsgVars, ...(variables || [])]));

      const template = await storage.createPromptTemplate({
        userId: req.userId!,
        name,
        description: description || null,
        category: category || 'general',
        systemPrompt,
        firstMessage: firstMessage || null,
        variables: allVariables.length > 0 ? allVariables : null,
        suggestedVoiceTone: suggestedVoiceTone || null,
        suggestedPersonality: suggestedPersonality || null,
        isSystemTemplate: false,
        isPublic: isPublic || false,
      });

      res.json(template);
    } catch (error: any) {
      console.error("Create prompt template error:", error);
      res.status(500).json({ error: "Failed to create prompt template" });
    }
  });

  // Update prompt template
  app.patch("/api/prompt-templates/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template not found" });
      }
      
      // Only owner can update (not system templates)
      if (template.userId !== req.userId || template.isSystemTemplate) {
        return res.status(403).json({ error: "Cannot modify this template" });
      }

      const { 
        name, 
        description, 
        category, 
        systemPrompt, 
        firstMessage, 
        variables,
        suggestedVoiceTone,
        suggestedPersonality,
        isPublic 
      } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
      if (firstMessage !== undefined) updates.firstMessage = firstMessage;
      if (suggestedVoiceTone !== undefined) updates.suggestedVoiceTone = suggestedVoiceTone;
      if (suggestedPersonality !== undefined) updates.suggestedPersonality = suggestedPersonality;
      if (isPublic !== undefined) updates.isPublic = isPublic;
      
      // Re-extract variables whenever systemPrompt or firstMessage changes
      if (systemPrompt !== undefined || firstMessage !== undefined) {
        const finalSystemPrompt = systemPrompt ?? template.systemPrompt;
        const finalFirstMessage = firstMessage ?? template.firstMessage;
        
        const extractedVars = (finalSystemPrompt.match(/\{\{(\w+)\}\}/g) || [])
          .map((v: string) => v.replace(/\{\{|\}\}/g, ''));
        const firstMsgVars = (finalFirstMessage?.match(/\{\{(\w+)\}\}/g) || [])
          .map((v: string) => v.replace(/\{\{|\}\}/g, ''));
        updates.variables = Array.from(new Set([...extractedVars, ...firstMsgVars]));
      }

      await storage.updatePromptTemplate(req.params.id, updates);
      
      const updated = await storage.getPromptTemplate(req.params.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Update prompt template error:", error);
      res.status(500).json({ error: "Failed to update prompt template" });
    }
  });

  // Delete prompt template
  app.delete("/api/prompt-templates/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template not found" });
      }
      
      // Only owner can delete (not system templates)
      if (template.userId !== req.userId || template.isSystemTemplate) {
        return res.status(403).json({ error: "Cannot delete this template" });
      }

      await storage.deletePromptTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete prompt template error:", error);
      res.status(500).json({ error: "Failed to delete prompt template" });
    }
  });

  // Use template (increments usage count and returns interpolated content)
  app.post("/api/prompt-templates/:id/use", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template not found" });
      }
      
      // Allow access if: own template, system template, or public template
      const isOwn = template.userId === req.userId;
      const isSystem = template.isSystemTemplate;
      const isPublic = template.isPublic;
      
      if (!isOwn && !isSystem && !isPublic) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { variableValues } = req.body;
      
      // Interpolate variables
      let systemPrompt = template.systemPrompt;
      let firstMessage = template.firstMessage;
      
      if (variableValues && typeof variableValues === 'object') {
        for (const [key, value] of Object.entries(variableValues)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          systemPrompt = systemPrompt.replace(regex, String(value));
          if (firstMessage) {
            firstMessage = firstMessage.replace(regex, String(value));
          }
        }
      }

      // Increment usage count
      await storage.incrementPromptTemplateUsage(req.params.id);

      res.json({
        systemPrompt,
        firstMessage,
        suggestedVoiceTone: template.suggestedVoiceTone,
        suggestedPersonality: template.suggestedPersonality,
        usedVariables: variableValues || {},
        missingVariables: (template.variables || []).filter(v => 
          !variableValues || !(v in variableValues)
        )
      });
    } catch (error: any) {
      console.error("Use prompt template error:", error);
      res.status(500).json({ error: "Failed to use prompt template" });
    }
  });


  // Start the campaign scheduler for automatic pause/resume based on time windows
  CampaignScheduler.startBackgroundScheduler();
  
  // Setup Twilio-OpenAI WebSocket stream for Media Streams audio bridging
  setupTwilioOpenAIStreamHandler(httpServer);
  
  // Setup Twilio-Bedrock-Polly WebSocket stream for Media Streams audio bridging
  setupBedrockPollyStreamHandler(httpServer);
  
  // Setup Browser Voice WebSocket stream for Call Simulator real-time conversation
  setupBrowserVoiceStreamHandler(httpServer);

  // Setup Deepgram Voice Agent WebSocket stream (Flux + Aura-2 bridged to Twilio)
  setupDeepgramAgentStreamHandler(httpServer);
  
  // Setup Live Call Monitoring WebSocket for real-time supervisor dashboard
  liveMonitoringWs.setup(httpServer);
  
  return httpServer;
}
