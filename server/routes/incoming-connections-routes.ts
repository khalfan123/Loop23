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
import { Router } from "express";
import { db } from "../db";
import { incomingConnections, humanIncomingConnections, agents, phoneNumbers, insertIncomingConnectionSchema, ivrConfigurations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth";
import { authenticateHybrid } from "../middleware/hybrid-auth";
import { twilioService } from "../services/twilio";
import { getDomain } from "../utils/domain";
import { PhoneMigrator } from "../engines/elevenlabs-migration";
import { ElevenLabsService } from "../services/elevenlabs";
import { ElevenLabsPoolService } from "../services/elevenlabs-pool";

const router = Router();

// GET /api/incoming-connections - List all connections for the user
router.get("/", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get all connections with agent and phone number details
    // Filter to only include Twilio + ElevenLabs connections (exclude twilio_openai agents)
    const allConnections = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
        phoneNumberId: incomingConnections.phoneNumberId,
        createdAt: incomingConnections.createdAt,
        updatedAt: incomingConnections.updatedAt,
        agent: {
          id: agents.id,
          name: agents.name,
          language: agents.language,
          elevenLabsAgentId: agents.elevenLabsAgentId,
          systemPrompt: agents.systemPrompt,
          personality: agents.personality,
          voiceTone: agents.voiceTone,
          firstMessage: agents.firstMessage,
          transferPhoneNumber: agents.transferPhoneNumber,
          transferEnabled: agents.transferEnabled,
          telephonyProvider: agents.telephonyProvider,
        },
        phoneNumber: {
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
          friendlyName: phoneNumbers.friendlyName,
          country: phoneNumbers.country,
          status: phoneNumbers.status,
        },
      })
      .from(incomingConnections)
      .leftJoin(agents, eq(incomingConnections.agentId, agents.id))
      .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .where(eq(incomingConnections.userId, userId));
    
    // Filter out connections with OpenAI-based agents (twilio_openai) for UI display
    const connections = allConnections.filter(c => {
      const provider = c.agent?.telephonyProvider;
      return !provider || provider === 'twilio'; // Include null/undefined or 'twilio' (ElevenLabs)
    });

    // Get ALL phone numbers owned by user (not system pool, active)
    const connectedPhoneIds = allConnections.map((c) => c.phoneNumberId);
    const allUserNumbers = await db
      .select()
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.userId, userId),
          eq(phoneNumbers.isSystemPool, false),
          eq(phoneNumbers.status, "active")
        )
      );

    // Get phone numbers assigned to ANY IVR/department configurations (including Deprock)
    const ivrPhoneAssignments = await db
      .select({ phoneNumberId: ivrConfigurations.phoneNumberId, isActive: ivrConfigurations.isActive, engineType: ivrConfigurations.engineType, name: ivrConfigurations.name })
      .from(ivrConfigurations)
      .where(eq(ivrConfigurations.userId, userId));
    const ivrPhoneIds = ivrPhoneAssignments
      .map((ivr) => ivr.phoneNumberId)
      .filter((id): id is string => id !== null);
    const ivrPhoneLookup = new Map<string, { isActive: boolean; engineType: string; name: string }>();
    for (const ivr of ivrPhoneAssignments) {
      if (ivr.phoneNumberId) {
        ivrPhoneLookup.set(ivr.phoneNumberId, {
          isActive: ivr.isActive,
          engineType: ivr.engineType || 'default',
          name: ivr.name || 'IVR',
        });
      }
    }

    // Get phone numbers assigned to human agent connections
    const humanPhoneAssignments = await db
      .select({ phoneNumberId: humanIncomingConnections.phoneNumberId })
      .from(humanIncomingConnections)
      .where(eq(humanIncomingConnections.userId, userId));
    const humanPhoneIds = humanPhoneAssignments.map((h) => h.phoneNumberId);

    // Build a connection lookup for connected phone numbers
    const connectionLookup = new Map<string, { agentName: string }>();
    for (const conn of allConnections) {
      if (conn.phoneNumberId) {
        connectionLookup.set(conn.phoneNumberId, {
          agentName: (conn as any).agent?.name || "Unknown Agent",
        });
      }
    }

    // Mark every phone number with its availability status and reason.
    // NOTE: Campaign usage (outbound) does NOT block inbound routing assignment —
    // a number can simultaneously run outbound campaigns and receive inbound calls.
    const availablePhoneNumbersWithConflict = allUserNumbers.map(pn => {
      const isConnected = connectedPhoneIds.includes(pn.id);
      const isIvrAssigned = ivrPhoneIds.includes(pn.id);
      const isHumanConnected = humanPhoneIds.includes(pn.id);
      const connInfo = connectionLookup.get(pn.id);

      let unavailableReason: string | null = null;
      if (isConnected) {
        unavailableReason = `Connected to ${connInfo?.agentName || "an agent"}`;
      } else if (isHumanConnected) {
        unavailableReason = "Connected to human agent";
      } else if (isIvrAssigned) {
        const ivrInfo = ivrPhoneLookup.get(pn.id);
        if (ivrInfo?.engineType === 'bedrock-polly') {
          unavailableReason = `Used in Deprock (${ivrInfo.name})`;
        } else {
          unavailableReason = `Assigned to department/IVR (${ivrInfo?.name || 'IVR'})`;
        }
      }

      return {
        ...pn,
        isUnavailable: isConnected || isHumanConnected || isIvrAssigned,
        unavailableReason,
        isConflicted: false,
        conflictReason: null,
        conflictCampaignName: null,
        conflictCampaignStatus: null,
      };
    });

    // Get incoming agents (type='incoming') for connection selection
    // Filter to only include Twilio + ElevenLabs agents (exclude twilio_openai)
    const allIncomingAgents = await db
      .select()
      .from(agents)
      .where(and(eq(agents.userId, userId), eq(agents.type, "incoming"), eq(agents.isActive, true)));
    
    // Filter out OpenAI-based agents
    const incomingAgents = allIncomingAgents.filter(a => {
      const provider = a.telephonyProvider;
      return !provider || provider === 'twilio'; // Include null/undefined or 'twilio' (ElevenLabs)
    });

    res.json({
      connections,
      allConnections,
      availablePhoneNumbers: availablePhoneNumbersWithConflict,
      incomingAgents,
      stats: {
        totalConnections: allConnections.length,
        elevenLabsConnections: connections.length,
        availableNumbers: availablePhoneNumbersWithConflict.filter(pn => !pn.isUnavailable).length,
        totalAgents: incomingAgents.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching incoming connections:", error);
    res.status(500).json({ message: "Failed to fetch incoming connections" });
  }
});

// POST /api/incoming-connections - Create a new connection
router.post("/", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body using Zod schema
    const validatedData = insertIncomingConnectionSchema.parse({
      ...req.body,
      userId,
    });

    const { agentId, phoneNumberId } = validatedData;

    // Verify agent exists, belongs to user, and is type='incoming'
    const agent = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId), eq(agents.type, "incoming")))
      .limit(1);

    if (!agent.length) {
      return res.status(404).json({ message: "Incoming agent not found or invalid type" });
    }

    // Verify phone number exists, belongs to user, and is not in system pool
    const phoneNumber = await db
      .select({
        id: phoneNumbers.id,
        phoneNumber: phoneNumbers.phoneNumber,
        twilioSid: phoneNumbers.twilioSid,
        elevenLabsPhoneNumberId: phoneNumbers.elevenLabsPhoneNumberId,
        elevenLabsCredentialId: phoneNumbers.elevenLabsCredentialId,
        userId: phoneNumbers.userId,
        isSystemPool: phoneNumbers.isSystemPool,
      })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, phoneNumberId),
          eq(phoneNumbers.userId, userId),
          eq(phoneNumbers.isSystemPool, false)
        )
      )
      .limit(1);

    if (!phoneNumber.length) {
      return res.status(404).json({ message: "Phone number not found or not owned by user" });
    }

    // Check if phone number is already connected (new system)
    const existingConnection = await db
      .select()
      .from(incomingConnections)
      .where(eq(incomingConnections.phoneNumberId, phoneNumberId))
      .limit(1);

    if (existingConnection.length) {
      return res.status(400).json({ message: "Phone number is already connected to an agent" });
    }

    // Check if phone number is connected to a human agent
    const existingHumanConnection = await db
      .select()
      .from(humanIncomingConnections)
      .where(eq(humanIncomingConnections.phoneNumberId, phoneNumberId))
      .limit(1);

    if (existingHumanConnection.length) {
      return res.status(400).json({ message: "Phone number is already connected to a human agent" });
    }

    // Check if phone number has assignment via deprecated incoming_agents system
    const deprecatedAssignment = await db
      .select({
        assignedIncomingAgentId: phoneNumbers.assignedIncomingAgentId,
      })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, phoneNumberId))
      .limit(1);

    if (deprecatedAssignment.length && deprecatedAssignment[0].assignedIncomingAgentId) {
      return res.status(400).json({ 
        message: "Phone number is assigned via legacy system. Please unassign it first.",
        legacySystem: true 
      });
    }

    // ========================================
    // PRE-FLIGHT CHECKS (before creating connection)
    // Order: Credential check → Migration → Verification
    // ========================================
    
    // Import pool service for credential management
    const elevenLabsPoolModule = await import('../services/elevenlabs-pool');
    
    // STEP 0: Auto-sync agent with ElevenLabs if missing elevenLabsAgentId
    // Only applies to Twilio/ElevenLabs agents (not twilio_openai providers)
    const isOpenAIProvider = agent[0].telephonyProvider === 'twilio_openai';
    
    if (!agent[0].elevenLabsAgentId && !isOpenAIProvider) {
      console.log(`📞 [Incoming Connection] Agent "${agent[0].name}" missing elevenLabsAgentId — auto-syncing with ElevenLabs...`);
      
      const agentData = agent[0];
      
      if (!agentData.elevenLabsVoiceId) {
        return res.status(400).json({
          message: "Agent is missing a voice configuration. Please edit the agent and assign a voice before connecting a phone number.",
          error: "Agent missing elevenLabsVoiceId"
        });
      }
      
      try {
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (!credential) {
          return res.status(400).json({
            message: "No ElevenLabs API keys available. Please configure ElevenLabs credentials in admin settings.",
            error: "No active credentials in pool"
          });
        }

        const syncService = new ElevenLabsService(credential.apiKey);
        
        const { storage } = await import('../storage');
        const knowledgeBases: Array<{ type: string; title: string; elevenLabsDocId: string }> = [];
        if (agentData.knowledgeBaseIds && Array.isArray(agentData.knowledgeBaseIds) && agentData.knowledgeBaseIds.length > 0) {
          for (const kbId of agentData.knowledgeBaseIds) {
            try {
              const kbItem = await storage.getKnowledgeBaseItem(kbId);
              if (kbItem && kbItem.elevenLabsDocId) {
                knowledgeBases.push({
                  type: kbItem.type,
                  title: kbItem.title,
                  elevenLabsDocId: kbItem.elevenLabsDocId
                });
              }
            } catch (e: any) {
              console.warn(`⚠️ [Auto-sync] Skipping KB ${kbId}: ${e.message}`);
            }
          }
        }

        const syncResponse = await syncService.createAgent({
          name: agentData.name,
          voice_id: agentData.elevenLabsVoiceId,
          prompt: agentData.systemPrompt || "You are a helpful assistant.",
          first_message: agentData.firstMessage || "Hello! How can I help you today?",
          language: agentData.language || "en",
          model: agentData.llmModel || "gpt-4o-mini",
          temperature: agentData.temperature ? Number(agentData.temperature) : 0.5,
          personality: agentData.personality || "helpful",
          voice_tone: agentData.voiceTone || "professional",
          knowledge_bases: knowledgeBases.length > 0 ? knowledgeBases : undefined,
          transferEnabled: agentData.transferEnabled || false,
          transferPhoneNumber: agentData.transferPhoneNumber || undefined,
          detectLanguageEnabled: agentData.detectLanguageEnabled || false,
          endConversationEnabled: agentData.endConversationEnabled || false,
          voiceStability: agentData.voiceStability ? Number(agentData.voiceStability) : 0.55,
          voiceSimilarityBoost: agentData.voiceSimilarityBoost ? Number(agentData.voiceSimilarityBoost) : 0.85,
          voiceSpeed: agentData.voiceSpeed ? Number(agentData.voiceSpeed) : 1.0,
          skipWorkflow: true,
        });

        const newElevenLabsAgentId = syncResponse.agent_id;
        console.log(`✅ [Incoming Connection] Auto-synced agent "${agentData.name}" → ElevenLabs ID: ${newElevenLabsAgentId}`);

        await db.update(agents)
          .set({ 
            elevenLabsAgentId: newElevenLabsAgentId,
            elevenLabsCredentialId: credential.id
          })
          .where(eq(agents.id, agentData.id));

        await ElevenLabsPoolService.updateAssignmentCount(credential.id, true);

        agent[0].elevenLabsAgentId = newElevenLabsAgentId;
        agent[0].elevenLabsCredentialId = credential.id;
      } catch (syncError: any) {
        console.error(`❌ [Incoming Connection] Auto-sync failed for agent "${agent[0].name}":`, syncError.message);
        return res.status(400).json({
          message: "Failed to sync agent with ElevenLabs. Please try again or check your ElevenLabs configuration.",
          error: syncError.message || "ElevenLabs sync failed"
        });
      }
    }
    
    // STEP 1: Ensure agent has a credential (auto-assign if missing)
    let agentCredentialId = agent[0].elevenLabsCredentialId;
    if (!agentCredentialId) {
      console.log(`📞 [Incoming Connection] Agent missing credential - auto-assigning from pool...`);
      const leastLoadedCredential = await elevenLabsPoolModule.ElevenLabsPoolService.getLeastLoadedCredential();
      
      if (!leastLoadedCredential) {
        return res.status(400).json({
          message: "No active ElevenLabs credentials available. Please configure ElevenLabs API keys in admin settings.",
          error: "No active credentials in pool"
        });
      }
      
      // Update the agent with the assigned credential
      await db.update(agents)
        .set({ elevenLabsCredentialId: leastLoadedCredential.id })
        .where(eq(agents.id, agent[0].id));
      
      await elevenLabsPoolModule.ElevenLabsPoolService.updateAssignmentCount(leastLoadedCredential.id, true);
      
      agentCredentialId = leastLoadedCredential.id;
      agent[0].elevenLabsCredentialId = leastLoadedCredential.id;
      console.log(`✅ [Incoming Connection] Credential auto-assigned: ${leastLoadedCredential.name}`);
    }
    
    // STEP 2: Check credential alignment and migrate if needed
    // This must happen BEFORE verification to ensure phone is on correct account
    if (phoneNumber[0].elevenLabsCredentialId && 
        phoneNumber[0].elevenLabsCredentialId !== agentCredentialId) {
      console.log(`📞 [Incoming Connection] Phone on different credential - initiating migration`);
      console.log(`   Phone credential: ${phoneNumber[0].elevenLabsCredentialId}`);
      console.log(`   Agent credential: ${agentCredentialId}`);
      
      try {
        const migrationResult = await PhoneMigrator.syncPhoneToAgentCredential(
          phoneNumberId,
          agentId
        );
        
        if (migrationResult.success) {
          console.log(`✅ [Incoming Connection] Phone migrated: ${migrationResult.oldElevenLabsPhoneId} -> ${migrationResult.newElevenLabsPhoneId}`);
          phoneNumber[0].elevenLabsPhoneNumberId = migrationResult.newElevenLabsPhoneId;
          phoneNumber[0].elevenLabsCredentialId = migrationResult.newCredentialId;
        } else {
          console.error(`❌ [Incoming Connection] Migration failed: ${migrationResult.error}`);
          return res.status(400).json({
            message: "Failed to migrate phone number to agent's ElevenLabs account. The phone and agent must be on the same API key.",
            error: migrationResult.error
          });
        }
      } catch (migrationError: any) {
        console.error(`❌ [Incoming Connection] Migration error: ${migrationError.message}`);
        return res.status(500).json({
          message: "Phone number migration failed. Please try again or contact support.",
          error: migrationError.message
        });
      }
    }
    
    // STEP 3: Verify phone exists on ElevenLabs (after migration, on correct credential)
    // This handles stale IDs - phones that were deleted from ElevenLabs but still in DB
    console.log(`📞 [Incoming Connection] Verifying phone ${phoneNumber[0].phoneNumber} on ElevenLabs...`);
    
    const verifyResult = await PhoneMigrator.verifyAndEnsurePhoneExists(
      phoneNumberId,
      agentCredentialId,
      agent[0].elevenLabsAgentId || undefined // Pass agent ID for assignment after re-import
    );
    
    if (!verifyResult.success) {
      console.error(`❌ [Incoming Connection] Phone verification failed: ${verifyResult.error}`);
      return res.status(400).json({
        message: "Phone number is not available on ElevenLabs. Please try re-syncing your phone numbers.",
        error: verifyResult.error,
        suggestion: "Go to Phone Numbers and click 'Sync' to refresh your phone number status."
      });
    }
    
    // Update local variable with verified/re-imported phone ID
    if (verifyResult.wasReimported && verifyResult.elevenLabsPhoneId) {
      console.log(`✅ [Incoming Connection] Phone was re-imported: ${verifyResult.elevenLabsPhoneId}`);
      phoneNumber[0].elevenLabsPhoneNumberId = verifyResult.elevenLabsPhoneId;
      phoneNumber[0].elevenLabsCredentialId = agentCredentialId;
    }
    
    console.log(`✅ [Incoming Connection] Phone verified: ${verifyResult.elevenLabsPhoneId}`);
    
    // ========================================
    // CREATE CONNECTION (after all pre-flight checks pass)
    // ========================================

    // Create the connection
    const [newConnection] = await db
      .insert(incomingConnections)
      .values({
        userId,
        agentId,
        phoneNumberId,
      })
      .returning();

    // Get the full connection with agent and phone details first
    const fullConnection = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
        phoneNumberId: incomingConnections.phoneNumberId,
        createdAt: incomingConnections.createdAt,
        updatedAt: incomingConnections.updatedAt,
        agent: {
          id: agents.id,
          name: agents.name,
          language: agents.language,
        },
        phoneNumber: {
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
          friendlyName: phoneNumbers.friendlyName,
        },
      })
      .from(incomingConnections)
      .leftJoin(agents, eq(incomingConnections.agentId, agents.id))
      .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .where(eq(incomingConnections.id, newConnection.id))
      .limit(1);

    // Sync agent assignment to ElevenLabs (native integration)
    // Note: Migration and verification already done in pre-flight checks above
    try {
      console.log(`📞 [ElevenLabs Sync] Assigning agent to phone number in ElevenLabs`);
      
      // Guard: Verify ElevenLabs IDs are present (should be set by now from pre-flight)
      if (!phoneNumber[0].elevenLabsPhoneNumberId || !agent[0].elevenLabsAgentId) {
        console.warn(`⚠️  [ElevenLabs Sync] Missing ElevenLabs IDs after pre-flight - skipping assignment sync`);
        console.warn(`   Phone has EL ID: ${!!phoneNumber[0].elevenLabsPhoneNumberId}`);
        console.warn(`   Agent has EL ID: ${!!agent[0].elevenLabsAgentId}`);
        return res.status(201).json(fullConnection[0]);
      }
      
      // Resolve credential (already ensured in pre-flight)
      const credential = await elevenLabsPoolModule.ElevenLabsPoolService.getCredentialById(agentCredentialId);
      
      if (!credential) {
        console.warn(`⚠️  [ElevenLabs Sync] Credential not found - skipping assignment sync`);
        return res.status(201).json(fullConnection[0]);
      }
      
      if (!credential.isActive) {
        console.warn(`⚠️  [ElevenLabs Sync] Credential is inactive - skipping assignment sync`);
        return res.status(201).json(fullConnection[0]);
      }
      
      // Use the credential for agent assignment
      const elevenLabsModule = await import('../services/elevenlabs');
      const elevenLabsService = new elevenLabsModule.ElevenLabsService(credential.apiKey);
      
      await elevenLabsService.assignAgentToPhoneNumber(
        phoneNumber[0].elevenLabsPhoneNumberId!,
        agent[0].elevenLabsAgentId!
      );
      
      console.log(`✅ [ElevenLabs Sync] Agent assigned to phone number successfully using credential: ${credential.name}`);
      
      // Configure ElevenLabs webhook on agent to receive call completion notifications
      try {
        const domain = getDomain();
        const webhookUrl = `${domain}/api/webhooks/elevenlabs`;
        const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        
        console.log(`🔗 [ElevenLabs Webhook] Configuring webhook for agent: ${agent[0].elevenLabsAgentId}`);
        await elevenLabsService.configureAgentWebhook(agent[0].elevenLabsAgentId, {
          webhookUrl,
          events: ['conversation.completed'],
          secret: webhookSecret,
        });
        console.log(`✅ [ElevenLabs Webhook] Webhook configured: ${webhookUrl}`);
      } catch (webhookError: any) {
        console.error('⚠️  [ElevenLabs Webhook] Failed to configure webhook:', webhookError.message);
      }
      
      // Configure Twilio to route calls to ElevenLabs native endpoint
      if (phoneNumber[0].twilioSid) {
        try {
          await twilioService.configurePhoneWebhookForElevenLabs(
            phoneNumber[0].twilioSid, 
            phoneNumber[0].phoneNumber,
            agent[0].elevenLabsAgentId  // Pass the agent ID so Twilio can route to the correct agent
          );
        } catch (twilioError: any) {
          console.error('⚠️  [Twilio Config] Failed to configure Twilio webhook:', twilioError);
          // Don't fail - the ElevenLabs side is configured, Twilio can be fixed manually
        }
      } else {
        console.warn(`⚠️  [Twilio Config] No Twilio SID found for phone number - skipping webhook config`);
      }
    } catch (elevenLabsError: any) {
      console.error('⚠️  [ElevenLabs Sync] Failed to assign agent in ElevenLabs:', elevenLabsError);
      // Don't fail the whole request - connection is created in DB
      // Admin can manually sync later if needed
    }

    // Return the full connection
    res.status(201).json(fullConnection[0]);
  } catch (error: any) {
    console.error("Error creating incoming connection:", error);
    res.status(500).json({ message: "Failed to create incoming connection" });
  }
});

// POST /api/incoming-connections/:id/sync-webhook - Sync webhook configuration for an existing connection
router.post("/:id/sync-webhook", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { id } = req.params;
    
    // Get connection with agent and phone details
    const connection = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
        phoneNumberId: incomingConnections.phoneNumberId,
        agent: {
          elevenLabsAgentId: agents.elevenLabsAgentId,
          elevenLabsCredentialId: agents.elevenLabsCredentialId,
          name: agents.name,
        },
        phoneNumber: {
          phoneNumber: phoneNumbers.phoneNumber,
          twilioSid: phoneNumbers.twilioSid,
        },
      })
      .from(incomingConnections)
      .leftJoin(agents, eq(incomingConnections.agentId, agents.id))
      .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .where(and(eq(incomingConnections.id, id), eq(incomingConnections.userId, userId)))
      .limit(1);
    
    if (!connection.length) {
      return res.status(404).json({ message: "Connection not found" });
    }
    
    const conn = connection[0];
    
    if (!conn.agent?.elevenLabsAgentId || !conn.agent?.elevenLabsCredentialId) {
      return res.status(400).json({ message: "Connection agent is not properly configured" });
    }
    
    console.log(`🔄 [Webhook Sync] Syncing webhook for connection ${id}, agent: ${conn.agent.name}`);
    
    // Get the credential
    const elevenLabsPoolModule = await import('../services/elevenlabs-pool');
    const credential = await elevenLabsPoolModule.ElevenLabsPoolService.getCredentialById(
      conn.agent.elevenLabsCredentialId
    );
    
    if (!credential) {
      return res.status(500).json({ message: "ElevenLabs credential not found" });
    }
    
    // Configure webhook on the agent
    const elevenLabsModule = await import('../services/elevenlabs');
    const elevenLabsService = new elevenLabsModule.ElevenLabsService(credential.apiKey);
    
    const domain = getDomain();
    const webhookUrl = `${domain}/api/webhooks/elevenlabs`;
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    
    console.log(`🔗 [Webhook Sync] Configuring ElevenLabs webhook: ${webhookUrl}`);
    
    await elevenLabsService.configureAgentWebhook(conn.agent.elevenLabsAgentId, {
      webhookUrl,
      events: ['conversation.completed'],
      secret: webhookSecret,
    });
    
    console.log(`✅ [Webhook Sync] ElevenLabs webhook configured successfully`);
    
    // Also sync the Twilio voiceUrl to include the agent_id parameter
    if (conn.phoneNumber?.twilioSid) {
      try {
        console.log(`📞 [Webhook Sync] Updating Twilio voiceUrl with agent ID for routing`);
        await twilioService.configurePhoneWebhookForElevenLabs(
          conn.phoneNumber.twilioSid,
          conn.phoneNumber.phoneNumber,
          conn.agent.elevenLabsAgentId
        );
        console.log(`✅ [Webhook Sync] Twilio voiceUrl configured successfully`);
      } catch (twilioError: any) {
        console.warn(`⚠️  [Webhook Sync] Failed to update Twilio webhook:`, twilioError.message);
        // Don't fail the whole request - ElevenLabs side is configured
      }
    }
    
    res.json({ 
      success: true, 
      message: "Webhooks synced successfully",
      elevenlabsWebhook: webhookUrl,
      agentId: conn.agent.elevenLabsAgentId,
    });
  } catch (error: any) {
    console.error("Error syncing webhook:", error);
    res.status(500).json({ message: "Failed to sync webhook", error: error.message });
  }
});

// DELETE /api/incoming-connections/:id - Delete a connection
router.delete("/:id", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { id } = req.params;

    // Verify connection exists and belongs to user - get full details including agent credential for ElevenLabs sync
    const connection = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
        phoneNumberId: incomingConnections.phoneNumberId,
        phoneNumber: {
          elevenLabsPhoneNumberId: phoneNumbers.elevenLabsPhoneNumberId,
          twilioSid: phoneNumbers.twilioSid,
        },
        agent: {
          elevenLabsCredentialId: agents.elevenLabsCredentialId,
        },
      })
      .from(incomingConnections)
      .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .leftJoin(agents, eq(incomingConnections.agentId, agents.id))
      .where(and(eq(incomingConnections.id, id), eq(incomingConnections.userId, userId)))
      .limit(1);

    if (!connection.length) {
      return res.status(404).json({ message: "Connection not found" });
    }

    // Unassign agent from phone number in ElevenLabs (native integration)
    if (connection[0].phoneNumber?.elevenLabsPhoneNumberId && connection[0].agent?.elevenLabsCredentialId) {
      try {
        console.log(`📞 [ElevenLabs Sync] Unassigning agent from phone number in ElevenLabs`);
        
        // Use the connection's agent credential for unassignment
        const elevenLabsPoolModule = await import('../services/elevenlabs-pool');
        const credential = await elevenLabsPoolModule.ElevenLabsPoolService.getCredentialById(
          connection[0].agent.elevenLabsCredentialId
        );
        
        if (credential) {
          // Import ElevenLabsService class
          const elevenLabsModule = await import('../services/elevenlabs');
          const elevenLabsService = new elevenLabsModule.ElevenLabsService(credential.apiKey);
          
          await elevenLabsService.unassignAgentFromPhoneNumber(
            connection[0].phoneNumber.elevenLabsPhoneNumberId
          );
          
          console.log(`✅ [ElevenLabs Sync] Agent unassigned from phone number successfully using credential: ${credential.name}`);
        } else {
          console.warn(`⚠️  [ElevenLabs Sync] Credential not found - skipping unassignment sync`);
        }
      } catch (elevenLabsError: any) {
        console.error('⚠️  [ElevenLabs Sync] Failed to unassign agent in ElevenLabs:', elevenLabsError);
        // Continue with deletion even if ElevenLabs sync fails
      }
    }

    // Clear Twilio webhook (remove ElevenLabs routing)
    if (connection[0].phoneNumber?.twilioSid) {
      try {
        await twilioService.clearPhoneWebhook(connection[0].phoneNumber.twilioSid);
      } catch (twilioError: any) {
        console.error('⚠️  [Twilio Config] Failed to clear Twilio webhook:', twilioError);
        // Continue with deletion even if Twilio sync fails
      }
    }

    // Delete the connection from database
    await db.delete(incomingConnections).where(eq(incomingConnections.id, id));

    res.json({ message: "Connection deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting incoming connection:", error);
    res.status(500).json({ message: "Failed to delete incoming connection" });
  }
});

// ========================================
// HUMAN AGENT TRANSFER CONNECTIONS
// ========================================

// GET /api/incoming-connections/human - List all human transfer connections for the user
router.get("/human", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connections = await db
      .select({
        id: humanIncomingConnections.id,
        phoneNumberId: humanIncomingConnections.phoneNumberId,
        agentId: humanIncomingConnections.agentId,
        transferNumber: humanIncomingConnections.transferNumber,
        transferTargetType: humanIncomingConnections.transferTargetType,
        ivrEnabled: humanIncomingConnections.ivrEnabled,
        ivrGreeting: humanIncomingConnections.ivrGreeting,
        label: humanIncomingConnections.label,
        createdAt: humanIncomingConnections.createdAt,
        phoneNumber: {
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
          friendlyName: phoneNumbers.friendlyName,
          country: phoneNumbers.country,
          status: phoneNumbers.status,
        },
        agent: {
          id: agents.id,
          name: agents.name,
        },
      })
      .from(humanIncomingConnections)
      .leftJoin(phoneNumbers, eq(humanIncomingConnections.phoneNumberId, phoneNumbers.id))
      .leftJoin(agents, eq(humanIncomingConnections.agentId, agents.id))
      .where(eq(humanIncomingConnections.userId, userId));

    // Get incoming agents for optional AI agent assignment
    const incomingAgentsList = await db
      .select({
        id: agents.id,
        name: agents.name,
        language: agents.language,
        type: agents.type,
      })
      .from(agents)
      .where(and(eq(agents.userId, userId), eq(agents.type, "incoming"), eq(agents.isActive, true)));

    // Get available phone numbers (not used by AI connections, IVR, campaigns, or human connections)
    const humanConnectedPhoneIds = connections.map(c => c.phoneNumberId);
    
    const aiConnections = await db
      .select({ phoneNumberId: incomingConnections.phoneNumberId })
      .from(incomingConnections)
      .where(eq(incomingConnections.userId, userId));
    const aiConnectedPhoneIds = aiConnections.map(c => c.phoneNumberId);

    const ivrPhoneAssignments = await db
      .select({ phoneNumberId: ivrConfigurations.phoneNumberId })
      .from(ivrConfigurations)
      .where(and(eq(ivrConfigurations.userId, userId), eq(ivrConfigurations.isActive, true)));
    const ivrPhoneIds = ivrPhoneAssignments
      .map((ivr) => ivr.phoneNumberId)
      .filter((id): id is string => id !== null);

    const allUserNumbers = await db
      .select()
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.userId, userId),
          eq(phoneNumbers.isSystemPool, false),
          eq(phoneNumbers.status, "active")
        )
      );

    // NOTE: Campaign usage (outbound) does NOT block inbound routing assignment —
    // a number can simultaneously run outbound campaigns and receive inbound calls.
    const allUsedPhoneIds = [...aiConnectedPhoneIds, ...humanConnectedPhoneIds, ...ivrPhoneIds];

    const availablePhoneNumbers = allUserNumbers.map(pn => {
      const isUsed = allUsedPhoneIds.includes(pn.id);
      const isTollFree = pn.numberType === 'toll_free' || pn.numberType === 'tollfree';
      let unavailableReason: string | null = null;
      if (aiConnectedPhoneIds.includes(pn.id)) {
        unavailableReason = "Connected to AI agent";
      } else if (humanConnectedPhoneIds.includes(pn.id)) {
        unavailableReason = "Connected to human agent";
      } else if (ivrPhoneIds.includes(pn.id)) {
        unavailableReason = "Assigned to department/IVR";
      } else if (isTollFree) {
        unavailableReason = "Toll-free numbers cannot transfer calls — they can only receive inbound calls and cannot originate the outbound call needed to connect to the transfer number. Use a local or mobile number instead.";
      }
      return {
        ...pn,
        isUnavailable: isUsed || isTollFree,
        unavailableReason,
      };
    });

    res.json({
      connections,
      availablePhoneNumbers,
      incomingAgents: incomingAgentsList,
      stats: {
        totalConnections: connections.length,
        availableNumbers: availablePhoneNumbers.filter(pn => !pn.isUnavailable).length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching human incoming connections:", error);
    res.status(500).json({ message: "Failed to fetch human incoming connections" });
  }
});

// POST /api/incoming-connections/human - Create a new human transfer connection
router.post("/human", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { phoneNumberIds, transferNumber, transferTargetType, ivrEnabled, ivrGreeting, label, agentId } = req.body;

    if (!phoneNumberIds || !Array.isArray(phoneNumberIds) || phoneNumberIds.length === 0) {
      return res.status(400).json({ message: "At least one phone number is required" });
    }
    if (!transferNumber || typeof transferNumber !== "string") {
      return res.status(400).json({ message: "Transfer number is required" });
    }

    if (!transferNumber.trim().match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ message: "Transfer number must be a valid phone number (E.164 format recommended, e.g. +1234567890)" });
    }

    const createdConnections = [];
    const errors = [];

    for (const phoneNumberId of phoneNumberIds) {
      // Verify phone number belongs to user
      const phoneNumber = await db
        .select()
        .from(phoneNumbers)
        .where(
          and(
            eq(phoneNumbers.id, phoneNumberId),
            eq(phoneNumbers.userId, userId),
            eq(phoneNumbers.isSystemPool, false)
          )
        )
        .limit(1);

      if (!phoneNumber.length) {
        errors.push({ phoneNumberId, error: "Phone number not found or not owned by user" });
        continue;
      }

      // Check if phone number is already used (AI connection)
      const existingAiConnection = await db
        .select()
        .from(incomingConnections)
        .where(eq(incomingConnections.phoneNumberId, phoneNumberId))
        .limit(1);

      if (existingAiConnection.length) {
        errors.push({ phoneNumberId, error: "Phone number is already connected to an AI agent" });
        continue;
      }

      // Check if phone number already has a human connection
      const existingHumanConnection = await db
        .select()
        .from(humanIncomingConnections)
        .where(eq(humanIncomingConnections.phoneNumberId, phoneNumberId))
        .limit(1);

      if (existingHumanConnection.length) {
        errors.push({ phoneNumberId, error: "Phone number is already connected to a human agent" });
        continue;
      }

      // Check IVR assignment
      const ivrCheck = await db
        .select()
        .from(ivrConfigurations)
        .where(
          and(
            eq(ivrConfigurations.phoneNumberId, phoneNumberId),
            eq(ivrConfigurations.userId, userId)
          )
        )
        .limit(1);

      if (ivrCheck.length) {
        errors.push({ phoneNumberId, error: "Phone number is assigned to department/IVR" });
        continue;
      }

      // Create the connection
      const [newConnection] = await db
        .insert(humanIncomingConnections)
        .values({
          userId,
          phoneNumberId,
          agentId: agentId || null,
          transferNumber: transferNumber.trim(),
          transferTargetType: transferTargetType || "phone",
          ivrEnabled: ivrEnabled !== false,
          ivrGreeting: ivrGreeting || null,
          label: label || null,
        })
        .returning();

      createdConnections.push(newConnection);

      if (phoneNumber[0].twilioSid) {
        try {
          await twilioService.configurePhoneWebhook(phoneNumber[0].twilioSid);
          console.log(`✅ [Human Connection] Configured Twilio webhook for ${phoneNumber[0].phoneNumber}`);
        } catch (twilioError: any) {
          console.error('⚠️  [Human Connection] Failed to configure Twilio webhook:', twilioError);
        }
      }
    }

    if (createdConnections.length === 0 && errors.length > 0) {
      return res.status(400).json({ message: "Failed to create any connections", errors });
    }

    res.status(201).json({
      message: `${createdConnections.length} human transfer connection(s) created successfully`,
      connections: createdConnections,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error creating human incoming connection:", error);
    res.status(500).json({ message: "Failed to create human incoming connection" });
  }
});

// DELETE /api/incoming-connections/human/:id - Delete a human transfer connection
router.delete("/human/:id", authenticateHybrid, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connectionId = req.params.id;

    const existing = await db
      .select()
      .from(humanIncomingConnections)
      .where(
        and(
          eq(humanIncomingConnections.id, connectionId),
          eq(humanIncomingConnections.userId, userId)
        )
      )
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ message: "Human transfer connection not found" });
    }

    const phoneNumberRecord = await db
      .select({ twilioSid: phoneNumbers.twilioSid })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, existing[0].phoneNumberId))
      .limit(1);

    await db
      .delete(humanIncomingConnections)
      .where(eq(humanIncomingConnections.id, connectionId));

    if (phoneNumberRecord.length && phoneNumberRecord[0].twilioSid) {
      const phoneId = existing[0].phoneNumberId;
      const hasAiConnection = await db
        .select({ id: incomingConnections.id })
        .from(incomingConnections)
        .where(eq(incomingConnections.phoneNumberId, phoneId))
        .limit(1);
      const hasIvr = await db
        .select({ id: ivrConfigurations.id })
        .from(ivrConfigurations)
        .where(eq(ivrConfigurations.phoneNumberId, phoneId))
        .limit(1);

      if (!hasAiConnection.length && !hasIvr.length) {
        try {
          await twilioService.clearPhoneWebhook(phoneNumberRecord[0].twilioSid);
          console.log(`✅ [Human Connection] Cleared Twilio webhook for deleted connection`);
        } catch (twilioError: any) {
          console.error('⚠️  [Human Connection] Failed to clear Twilio webhook:', twilioError);
        }
      } else {
        console.log(`ℹ️  [Human Connection] Keeping Twilio webhook — phone number still used by other connections`);
      }
    }

    res.json({ message: "Human transfer connection deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting human incoming connection:", error);
    res.status(500).json({ message: "Failed to delete human incoming connection" });
  }
});

export async function fixExistingConnectionWebhooks() {
  try {
    const allConnections = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
        phoneNumber: {
          phoneNumber: phoneNumbers.phoneNumber,
          twilioSid: phoneNumbers.twilioSid,
        },
        agent: {
          elevenLabsAgentId: agents.elevenLabsAgentId,
          elevenLabsCredentialId: agents.elevenLabsCredentialId,
          name: agents.name,
        },
      })
      .from(incomingConnections)
      .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .leftJoin(agents, eq(incomingConnections.agentId, agents.id));

    if (!allConnections.length) {
      console.log(`✅ [Webhook Fix] No incoming connections to fix`);
      return;
    }

    console.log(`🔧 [Webhook Fix] Checking ${allConnections.length} incoming connection(s)...`);

    for (const conn of allConnections) {
      if (conn.phoneNumber?.twilioSid && conn.agent?.elevenLabsAgentId) {
        try {
          await twilioService.configurePhoneWebhookForElevenLabs(
            conn.phoneNumber.twilioSid,
            conn.phoneNumber.phoneNumber,
            conn.agent.elevenLabsAgentId
          );
          console.log(`✅ [Webhook Fix] Fixed webhook for ${conn.phoneNumber.phoneNumber} → ${conn.agent.name}`);
        } catch (err: any) {
          console.warn(`⚠️  [Webhook Fix] Failed to fix ${conn.phoneNumber?.phoneNumber}: ${err.message}`);
        }
      }

      if (conn.agent?.elevenLabsAgentId && conn.agent?.elevenLabsCredentialId) {
        try {
          const credential = await ElevenLabsPoolService.getCredentialById(conn.agent.elevenLabsCredentialId);
          if (credential?.apiKey) {
            console.log(`🔧 [ASR Fix] Clearing hardcoded audio format on agent ${conn.agent.name} (${conn.agent.elevenLabsAgentId})`);
            const patchResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${conn.agent.elevenLabsAgentId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': credential.apiKey,
              },
              body: JSON.stringify({
                conversation_config: {
                  asr: {
                    provider: "elevenlabs",
                  },
                },
              }),
            });
            if (patchResponse.ok) {
              console.log(`✅ [ASR Fix] Agent ${conn.agent.name} ASR config updated (auto-detect audio format)`);
            } else {
              const errText = await patchResponse.text();
              console.warn(`⚠️  [ASR Fix] ElevenLabs returned ${patchResponse.status}: ${errText}`);
            }
          }
        } catch (err: any) {
          console.warn(`⚠️  [ASR Fix] Failed to fix ASR for ${conn.agent?.name}: ${err.message}`);
        }
      }
    }

    console.log(`✅ [Webhook Fix] Done`);
  } catch (error: any) {
    console.error(`❌ [Webhook Fix] Error:`, error.message);
  }
}

export default router;
