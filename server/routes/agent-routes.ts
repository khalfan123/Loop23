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

import { Router, Request, Response } from "express";
import { RouteContext, AuthRequest } from "./common";
import { eq, and, inArray, sql } from "drizzle-orm";
import { llmModels, flows, FlowNode, FlowEdge, knowledgeBase, departmentAgents, departments, agents as agentsTable } from "@shared/schema";
import { ElevenLabsService } from "../services/elevenlabs";
import { ElevenLabsPoolService } from "../services/elevenlabs-pool";
import { OpenAIPoolService } from "../services/openai-pool.service";
import { IncomingAgentService } from "../services/incoming-agent";
import { FlowAgentService } from "../services/flow-agent";
import { setupRAGToolForAgent, isRAGEnabled } from "../services/rag-elevenlabs-tool";
import { generateAgentAvatar } from "../services/avatar-generator";
import { generateUseCasesFromKB } from "../services/use-case-generator";
import { buildElevenLabsDynamicFormWebhookTools, DYNAMIC_FORM_PROMPT } from "../services/dynamic-form-tools";

export function createAgentRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { db, storage, authenticateToken, authenticateHybrid, elevenLabsService, upload } = ctx;

  // ========================================
  // Agent CRUD Routes
  // ========================================

  router.get("/api/agents", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      let agents = await storage.getUserAgents(req.userId!);
      
      const typeFilter = req.query.type as string | undefined;
      if (typeFilter && (typeFilter === 'incoming' || typeFilter === 'flow')) {
        agents = agents.filter(agent => agent.type === typeFilter);
      }
      
      res.json(agents);
    } catch (error: any) {
      console.error("Get agents error:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  router.get("/api/agents/deprock-linked", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userDepts = await db.select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));
      
      if (userDepts.length === 0) {
        return res.json({ agentIds: [], departmentMap: {} });
      }

      const deptIds = userDepts.map(d => d.id);
      const links = await db.select({
        agentId: departmentAgents.agentId,
        departmentId: departmentAgents.departmentId,
        language: departmentAgents.language,
        isPrimary: departmentAgents.isPrimary,
        deptName: departments.name,
      })
        .from(departmentAgents)
        .innerJoin(departments, eq(departmentAgents.departmentId, departments.id))
        .innerJoin(agentsTable, eq(departmentAgents.agentId, agentsTable.id))
        .where(and(
          inArray(departmentAgents.departmentId, deptIds),
          eq(agentsTable.userId, req.userId!)
        ));

      const agentIds = [...new Set(links.map(l => l.agentId))];
      const departmentMap: Record<string, { departmentId: string; departmentName: string; language: string; isPrimary: boolean }[]> = {};
      for (const link of links) {
        if (!departmentMap[link.agentId]) departmentMap[link.agentId] = [];
        departmentMap[link.agentId].push({
          departmentId: link.departmentId,
          departmentName: link.deptName || 'Unknown',
          language: link.language,
          isPrimary: link.isPrimary,
        });
      }

      res.json({ agentIds, departmentMap });
    } catch (error: any) {
      console.error("Get deprock-linked agents error:", error);
      res.status(500).json({ error: "Failed to get deprock-linked agents" });
    }
  });

  router.post("/api/agents", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { 
        type, 
        name, 
        voiceTone, 
        personality, 
        systemPrompt, 
        config,
        elevenLabsVoiceId,
        firstMessage,
        language,
        llmModel,
        temperature,
        knowledgeBaseIds,
        transferEnabled,
        transferPhoneNumber,
        transferAgentId,
        transferMessage,
        detectLanguageEnabled,
        endConversationEnabled,
        appointmentBookingEnabled,
        knowledgeBaseOnly,
        voiceStability,
        voiceSimilarityBoost,
        voiceSpeed,
        telephonyProvider,
        openaiVoice,
        voiceProvider,
        sourceTemplateId,
        isFromTemplate,
        tags,
        specialist,
        avatarUrl
      } = req.body;

      if (!type || (type !== 'incoming' && type !== 'flow')) {
        return res.status(400).json({ error: "Valid agent type is required (incoming or flow)" });
      }

      if (!name) {
        return res.status(400).json({ error: "Agent name is required" });
      }

      if (type === 'incoming' && !systemPrompt) {
        return res.status(400).json({ error: "System prompt is required for incoming agents" });
      }

      if (type === 'flow' && (!voiceTone || !personality)) {
        return res.status(400).json({ error: "Voice tone and personality are required for flow agents" });
      }

      // Voice validation depends on telephony provider
      // OpenAI-based providers (twilio_openai) use OpenAI voices, not ElevenLabs
      const isOpenAIProvider = telephonyProvider === 'twilio_openai';
      
      if (type === 'incoming') {
        if (isOpenAIProvider) {
          // OpenAI-based agents use OpenAI voices - openaiVoice has a default in schema ('alloy')
          // No validation needed as schema provides default
          console.log(`📞 Creating ${telephonyProvider} agent with OpenAI voice: ${openaiVoice || 'alloy'}`);
        } else if (voiceProvider === 'aws_polly') {
          // AWS Polly agents use awsPollyVoiceId, not ElevenLabs
          if (!req.body.awsPollyVoiceId) {
            return res.status(400).json({ error: "AWS Polly Voice ID is required for Polly agents" });
          }
          console.log(`📞 Creating AWS Polly agent with voice: ${req.body.awsPollyVoiceId}`);
        } else {
          // Twilio/ElevenLabs agents require elevenLabsVoiceId
          if (!elevenLabsVoiceId) {
            return res.status(400).json({ error: "Voice ID is required for incoming agents" });
          }
        }
      }

      if (type === 'incoming' && transferEnabled && !transferPhoneNumber?.trim() && !transferAgentId?.trim()) {
        return res.status(400).json({ error: "Transfer phone number or transfer agent is required when call transfer is enabled" });
      }

      // Sanitize sipPhoneNumberId: convert empty string to null to avoid foreign key constraint violation
      if ('sipPhoneNumberId' in req.body && req.body.sipPhoneNumberId === '') {
        req.body.sipPhoneNumberId = null;
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const plan = await storage.getPlanByName(user.planType || 'free');
      if (!plan) {
        return res.status(500).json({ error: "Plan configuration not found" });
      }

      const existingAgents = await storage.getUserAgents(req.userId!);
      // Skip limit check if explicitly unlimited (-1 or 999)
      if (plan.maxAgents !== -1 && plan.maxAgents !== 999 && existingAgents.length >= plan.maxAgents) {
        return res.status(403).json({ 
          error: `Agent limit reached. Your ${plan.displayName} allows maximum ${plan.maxAgents} agent(s).`,
          upgradeRequired: true
        });
      }

      if (llmModel) {
        const { getUserPlanCapabilities } = await import('../services/membership-service');
        const capabilities = await getUserPlanCapabilities(req.userId!);
        
        if (!capabilities.canChooseLlm) {
          const { or } = await import('drizzle-orm');
          const requestedModel = await db
            .select({ tier: llmModels.tier })
            .from(llmModels)
            .where(or(eq(llmModels.name, llmModel), eq(llmModels.modelId, llmModel)))
            .limit(1);
          
          const modelTier = requestedModel.length > 0 ? requestedModel[0].tier : null;
          
          if (modelTier && modelTier !== 'free') {
            return res.status(403).json({
              error: "Plan upgrade required",
              message: `Your ${capabilities.planDisplayName} plan only allows free-tier LLM models. Please upgrade to Pro to use premium models.`,
              upgradeRequired: true
            });
          }
        }
      }

      let elevenLabsAgentId = null;
      let effectiveLlmModelId: string | null = "gpt-4o-mini";
      
      if (llmModel) {
        const modelRecord = await db
          .select({ modelId: llmModels.modelId })
          .from(llmModels)
          .where(eq(llmModels.name, llmModel))
          .limit(1);
        
        if (modelRecord.length > 0) {
          effectiveLlmModelId = modelRecord[0].modelId;
          console.log(`📝 Using user-selected LLM model: ${llmModel} → ${effectiveLlmModelId}`);
        } else {
          effectiveLlmModelId = llmModel;
          console.log(`📝 Using user-provided LLM model ID: ${effectiveLlmModelId}`);
        }
      } else {
        const defaultSetting = await storage.getGlobalSetting('default_llm_free');
        if (defaultSetting?.value) {
          const displayName = String(defaultSetting.value).replace(/^"|"$/g, '');
          console.log(`📝 Admin default LLM display name: ${displayName}`);
          
          const modelRecord = await db
            .select({ modelId: llmModels.modelId })
            .from(llmModels)
            .where(eq(llmModels.name, displayName))
            .limit(1);
          
          if (modelRecord.length > 0) {
            effectiveLlmModelId = modelRecord[0].modelId;
            console.log(`📝 Resolved to model ID: ${effectiveLlmModelId}`);
          } else {
            console.log(`⚠️  Could not find model for "${displayName}", using default: ${effectiveLlmModelId}`);
          }
        }
      }

      // Validate that the model is a conversational model, not a transcription model
      // Transcription models like "scribe_v2_realtime" are not valid for ElevenLabs Conversational AI
      const INVALID_TRANSCRIPTION_MODELS = ['scribe_v2_realtime', 'scribe_v2', 'scribe'];
      if (effectiveLlmModelId && INVALID_TRANSCRIPTION_MODELS.some(m => effectiveLlmModelId!.toLowerCase().includes(m))) {
        return res.status(400).json({ 
          error: "Invalid LLM model for conversational agents",
          message: "Scribe models are designed for transcription, not conversational AI. Please select a different LLM model such as GPT-4o Mini, Claude 3, or Gemini."
        });
      }

      let usedCredentialId: string | null = null;

      const isAwsPollyProvider = voiceProvider === 'aws_polly';

      if (type === 'incoming' && !isOpenAIProvider && !isAwsPollyProvider) {
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (!credential) {
          return res.status(500).json({ error: "No available ElevenLabs API keys" });
        }
        usedCredentialId = credential.id;

        try {
          const knowledgeBases: Array<{ type: string; title: string; elevenLabsDocId: string }> = [];
          if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds) && knowledgeBaseIds.length > 0) {
            console.log(`📚 Preparing ${knowledgeBaseIds.length} knowledge base(s) for agent creation`);
            
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
                knowledgeBases.push({
                  type: kbItem.type,
                  title: kbItem.title,
                  elevenLabsDocId: kbItem.elevenLabsDocId
                });
              } catch (error: any) {
                console.error(`   ❌ Failed to fetch KB ${kbId}:`, error.message);
              }
            }
          }

          const incomingElevenLabsService = new ElevenLabsService(credential.apiKey);

          const enhancedPromptForEL = systemPrompt + DYNAMIC_FORM_PROMPT;

          const agentResponse = await incomingElevenLabsService.createAgent({
            name,
            voice_id: elevenLabsVoiceId,
            prompt: enhancedPromptForEL,
            first_message: firstMessage || "Hello! How can I help you today?",
            language: language || "en",
            model: effectiveLlmModelId!,
            temperature: temperature || 0.5,
            personality: personality || "helpful",
            voice_tone: voiceTone || "professional",
            knowledge_bases: knowledgeBases.length > 0 ? knowledgeBases : undefined,
            transferEnabled: transferEnabled || false,
            transferPhoneNumber: transferPhoneNumber || undefined,
            detectLanguageEnabled: detectLanguageEnabled || false,
            endConversationEnabled: endConversationEnabled || false,
            knowledgeBaseOnly: (knowledgeBaseIds && knowledgeBaseIds.length > 0) ? (knowledgeBaseOnly !== undefined ? knowledgeBaseOnly : true) : false,
            voiceStability: voiceStability ?? 0.55,
            voiceSimilarityBoost: voiceSimilarityBoost ?? 0.85,
            voiceSpeed: voiceSpeed ?? 1.0,
            skipWorkflow: true,
          });

          elevenLabsAgentId = agentResponse.agent_id;

          const dynamicFormWebhookTools = buildElevenLabsDynamicFormWebhookTools(
            req.userId!,
            elevenLabsAgentId
          );
          try {
            await incomingElevenLabsService.updateAgent(elevenLabsAgentId, {
              webhookTools: dynamicFormWebhookTools,
              skipWorkflowRebuild: true,
            });
          } catch (toolErr: any) {
            console.warn(`📋 [Agent Create] Could not add dynamic form tools: ${toolErr.message}`);
          }
        } catch (error) {
          console.error("Error creating ElevenLabs agent:", error);
          return res.status(500).json({ error: "Failed to create ElevenLabs agent" });
        }
      }
      
      // Log OpenAI-based agent creation
      if (type === 'incoming' && isOpenAIProvider) {
        console.log(`📞 [${telephonyProvider} Agent Create] Creating ${telephonyProvider} agent "${name}" with OpenAI voice: ${openaiVoice || 'alloy'}`);
      }

      if (type === 'flow') {
        const { flowId, maxDurationSeconds } = req.body;
        
        if (!flowId) {
          return res.status(400).json({ error: "Flow ID is required for flow agents" });
        }
        
        // Voice validation depends on telephony provider for flow agents
        if (isOpenAIProvider) {
          // OpenAI-based flow agents use OpenAI voices - openaiVoice has a default in schema ('alloy')
          console.log(`📞 [Flow Agent Create] Creating ${telephonyProvider} flow agent with OpenAI voice: ${openaiVoice || 'alloy'}`);
        } else {
          // ElevenLabs/Twilio flow agents require elevenLabsVoiceId
          if (!elevenLabsVoiceId) {
            return res.status(400).json({ error: "Voice ID is required for flow agents" });
          }
        }

        const [flow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, flowId));

        if (!flow) {
          return res.status(404).json({ error: "Selected flow not found" });
        }

        if (isOpenAIProvider) {
          console.log(`📞 [Flow Agent Create] Skipping ElevenLabs agent creation for ${telephonyProvider} flow agent`);
          // elevenLabsAgentId remains null for non-ElevenLabs flow agents
        } else {
          // ElevenLabs/Twilio flow agents - delegate to FlowAgentService for proper two-phase creation
          // This handles play audio nodes, appointment nodes, form nodes, and webhook tools correctly
          try {
            const result = await FlowAgentService.createInElevenLabs({
              userId: req.userId!,
              name,
              flowId,
              elevenLabsVoiceId: elevenLabsVoiceId!,
              systemPrompt: systemPrompt || undefined,
              firstMessage: firstMessage || undefined,
              language: language || 'en',
              llmModel: effectiveLlmModelId || undefined,
              temperature: temperature ?? 0.3,
              maxDurationSeconds: maxDurationSeconds || 600,
              voiceStability: voiceStability ?? 0.55,
              voiceSimilarityBoost: voiceSimilarityBoost ?? 0.85,
              voiceSpeed: voiceSpeed ?? 1.0,
              detectLanguageEnabled: detectLanguageEnabled || false,
              knowledgeBaseIds: knowledgeBaseIds || undefined,
              knowledgeBaseOnly: (knowledgeBaseIds && knowledgeBaseIds.length > 0) ? (knowledgeBaseOnly !== undefined ? knowledgeBaseOnly : true) : false,
            });
            
            elevenLabsAgentId = result.elevenLabsAgentId;
            usedCredentialId = result.credentialId;
            console.log(`✅ [Flow Agent Create] ElevenLabs agent created via FlowAgentService: ${elevenLabsAgentId}`);
          } catch (error: any) {
            console.error("Error creating ElevenLabs Flow agent:", error);
            const statusCode = error.status || 500;
            return res.status(statusCode).json({ 
              error: "Failed to create ElevenLabs Flow agent: " + error.message,
              code: error.code || 'INTERNAL_ERROR'
            });
          }
        } // End of else block for non-OpenAI providers
      }

      const { flowId, maxDurationSeconds } = req.body;

      const agent = await storage.createAgent({
        userId: req.userId!,
        type,
        name,
        voiceTone: voiceTone || null,
        personality: personality || null,
        systemPrompt,
        config: config || null,
        elevenLabsAgentId,
        elevenLabsCredentialId: usedCredentialId,
        elevenLabsVoiceId: (type === 'incoming' || type === 'flow') ? elevenLabsVoiceId : null,
        firstMessage: (type === 'incoming' || type === 'flow') ? (firstMessage || null) : null,
        language: (type === 'incoming' || type === 'flow') ? (language || null) : null,
        llmModel: (type === 'incoming' || type === 'flow') ? effectiveLlmModelId : null,
        temperature: (type === 'incoming' || type === 'flow') ? (temperature ?? null) : null,
        knowledgeBaseIds: (type === 'incoming' || type === 'flow') ? (knowledgeBaseIds || null) : null,
        transferEnabled: type === 'incoming' ? (transferEnabled || false) : false,
        transferPhoneNumber: type === 'incoming' ? (transferPhoneNumber || null) : null,
        transferAgentId: type === 'incoming' ? (transferAgentId || null) : null,
        detectLanguageEnabled: (type === 'incoming' || type === 'flow') ? (detectLanguageEnabled || false) : false,
        endConversationEnabled: type === 'incoming' ? (endConversationEnabled || false) : false,
        appointmentBookingEnabled: type === 'incoming' ? (appointmentBookingEnabled || false) : false,
        knowledgeBaseOnly: (knowledgeBaseIds && knowledgeBaseIds.length > 0) ? (knowledgeBaseOnly !== undefined ? knowledgeBaseOnly : true) : false,
        flowId: type === 'flow' ? flowId : null,
        maxDurationSeconds: type === 'flow' ? (maxDurationSeconds || 600) : null,
        voiceStability: (type === 'incoming' || type === 'flow') ? (voiceStability ?? 0.55) : null,
        voiceSimilarityBoost: (type === 'incoming' || type === 'flow') ? (voiceSimilarityBoost ?? 0.85) : null,
        voiceSpeed: (type === 'incoming' || type === 'flow') ? (voiceSpeed ?? 1.0) : null,
        // Voice provider configuration
        voiceProvider: voiceProvider || 'elevenlabs',
        awsPollyVoiceId: voiceProvider === 'aws_polly' ? req.body.awsPollyVoiceId : null,
        // OpenAI Realtime configuration (for twilio_openai provider)
        telephonyProvider: isOpenAIProvider ? telephonyProvider : 'twilio',
        openaiVoice: isOpenAIProvider ? (openaiVoice || 'alloy') : null,
        // Template tracking fields
        sourceTemplateId: sourceTemplateId || null,
        isFromTemplate: isFromTemplate || false,
        tags: tags || null,
        specialist: specialist || null,
        avatarUrl: avatarUrl || null,
        // Behavior and agent assist config
        behaviorConfig: req.body.behaviorConfig || null,
        waitingMessages: req.body.waitingMessages || null,
        dataSchema: req.body.dataSchema || null,
        agentAssistConfig: req.body.agentAssistConfig || null,
      });

      if (usedCredentialId) {
        try {
          await ElevenLabsPoolService.updateAssignmentCount(usedCredentialId, true);
          console.log(`📊 [Agent Create] Incremented agent count for credential ${usedCredentialId}`);
        } catch (countError) {
          console.warn("Failed to update credential agent count:", countError);
        }
      }

      if (type === 'flow' && flowId) {
        try {
          await db
            .update(flows)
            .set({ agentId: agent.id })
            .where(eq(flows.id, flowId));
          console.log(`✅ [Flow Agent Create] Flow ${flowId} now references agent ${agent.id}`);
          
          await ElevenLabsPoolService.syncExistingAgents();
        } catch (poolError) {
          console.warn("Failed to update flow or sync agent to pool:", poolError);
        }
      }
      
      if (type === 'incoming') {
        try {
          await ElevenLabsPoolService.syncExistingAgents();
        } catch (poolError) {
          console.warn("Failed to sync incoming agent to pool:", poolError);
        }
      }

      let updatedAgent = agent;
      
      // If appointment booking is enabled for incoming agents, update ElevenLabs with the tool
      // The webhook URL uses the ElevenLabs agent ID which is available at this point
      if (type === 'incoming' && appointmentBookingEnabled && elevenLabsAgentId && usedCredentialId) {
        try {
          console.log(`📅 [Agent Create] Adding appointment booking tool for ElevenLabs agent ${elevenLabsAgentId}`);
          const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
          if (credential) {
            const appointmentElevenLabsService = new ElevenLabsService(credential.apiKey);
            await appointmentElevenLabsService.updateAgent(elevenLabsAgentId, {
              appointmentBookingEnabled: true,
              skipWorkflowRebuild: true,
            });
            console.log(`✅ [Agent Create] Appointment booking tool added`);
          }
        } catch (appointmentError) {
          console.warn("Failed to add appointment booking tool (non-fatal):", appointmentError);
        }
      }
      
      if (elevenLabsAgentId && isRAGEnabled() && knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        try {
          console.log(`📚 [Agent Create] Setting up RAG workspace tool for agent ${agent.id}`);
          
          const systemTools: any[] = [];
          
          if (type === 'incoming') {
            if (transferEnabled && transferPhoneNumber) {
              systemTools.push({
                type: "system",
                name: "transfer_to_number",
                description: transferMessage || "Transfer the call to a human when the customer requests to speak to a human or if the query is beyond AI capabilities",
                phone_number: transferPhoneNumber,
              });
            }
            if (detectLanguageEnabled) {
              systemTools.push({
                type: "system",
                name: "detect_language",
                description: "Detect the language the user is speaking",
              });
            }
            if (endConversationEnabled) {
              systemTools.push({
                type: "system",
                name: "end_conversation",
                description: "End the conversation when the user indicates they are done",
              });
            }
          }
          
          if (type === 'flow') {
            if (detectLanguageEnabled) {
              systemTools.push({
                type: "system",
                name: "detect_language",
                description: "Detect the language the user is speaking",
              });
            }
          }
          
          await setupRAGToolForAgent(
            agent.id,
            elevenLabsAgentId,
            knowledgeBaseIds,
            systemTools
          );
          console.log(`✅ [Agent Create] RAG tool setup complete`);
          
          updatedAgent = await storage.getAgent(agent.id) || agent;
        } catch (ragError) {
          console.warn("Failed to setup RAG tool (non-fatal):", ragError);
        }
      }
      
      if (elevenLabsVoiceId) {
        setImmediate(async () => {
          try {
            const { VoiceSyncService } = await import("../services/voice-sync");
            
            if (elevenLabsVoiceId.startsWith('21m00') || elevenLabsVoiceId.length < 20) {
              console.log(`🔊 Voice ${elevenLabsVoiceId} is a default voice, skipping sync`);
              return;
            }
            
            const sharedVoices = await elevenLabsService.listSharedVoices({ search: '' });
            const matchingVoice = sharedVoices.voices.find(v => v.voice_id === elevenLabsVoiceId);
            
            if (matchingVoice?.public_owner_id) {
              console.log(`🔊 Starting async voice sync for ${elevenLabsVoiceId} (${matchingVoice.name})`);
              const result = await VoiceSyncService.syncVoiceToAllCredentials(
                elevenLabsVoiceId,
                matchingVoice.public_owner_id,
                matchingVoice.name
              );
              console.log(`🔊 Voice sync complete: ${result.synced} synced, ${result.failed} failed`);
            } else {
              console.log(`🔊 Voice ${elevenLabsVoiceId} not found in shared library, skipping pool sync`);
            }
          } catch (syncError) {
            console.warn(`⚠️ Async voice sync failed:`, syncError);
          }
        });
      }
      
      // Generate avatar asynchronously if not provided
      if (!avatarUrl && name) {
        setImmediate(async () => {
          try {
            console.log(`🎨 [Agent Create] Generating avatar for agent "${name}"`);
            const generatedAvatarUrl = await generateAgentAvatar(name, specialist);
            if (generatedAvatarUrl) {
              await storage.updateAgent(agent.id, { avatarUrl: generatedAvatarUrl });
              console.log(`✅ [Agent Create] Avatar generated and saved: ${generatedAvatarUrl}`);
            }
          } catch (avatarError) {
            console.warn(`⚠️ Avatar generation failed (non-fatal):`, avatarError);
          }
        });
      }
      
      res.json(updatedAgent);
    } catch (error: any) {
      console.error("Create agent error:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  router.get("/api/agents/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json(agent);
    } catch (error: any) {
      console.error("Get agent error:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  router.patch("/api/agents/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }


      if (agent.type === 'incoming' && req.body.transferEnabled === true && !req.body.transferPhoneNumber?.trim() && !req.body.transferAgentId?.trim()) {
        return res.status(400).json({ error: "Transfer phone number or transfer agent is required when call transfer is enabled" });
      }

      // Sanitize sipPhoneNumberId: convert empty string to null to avoid foreign key constraint violation
      if ('sipPhoneNumberId' in req.body && req.body.sipPhoneNumberId === '') {
        req.body.sipPhoneNumberId = null;
      }

      try {
        console.log(`📝 [Version History] Agent update for ${agent.id} (${agent.type})`);
        console.log(`   Request body keys: ${Object.keys(req.body).join(', ')}`);
        
        const latestVersion = await storage.getLatestAgentVersion(agent.id);
        const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;
        
        const currentSnapshot = {
          name: agent.name,
          type: agent.type,
          voiceTone: agent.voiceTone,
          personality: agent.personality,
          systemPrompt: agent.systemPrompt,
          language: agent.language,
          firstMessage: agent.firstMessage,
          llmModel: agent.llmModel,
          temperature: agent.temperature,
          elevenLabsVoiceId: agent.elevenLabsVoiceId,
          voiceStability: agent.voiceStability,
          voiceSimilarityBoost: agent.voiceSimilarityBoost,
          voiceSpeed: agent.voiceSpeed,
          transferPhoneNumber: agent.transferPhoneNumber,
          transferAgentId: agent.transferAgentId,
          transferEnabled: agent.transferEnabled,
          detectLanguageEnabled: agent.detectLanguageEnabled,
          endConversationEnabled: agent.endConversationEnabled,
          knowledgeBaseIds: agent.knowledgeBaseIds,
          knowledgeBaseOnly: agent.knowledgeBaseOnly,
          maxDurationSeconds: agent.maxDurationSeconds,
          config: agent.config as Record<string, unknown> | null,
          // Template tracking fields (preserved for audit)
          sourceTemplateId: agent.sourceTemplateId,
          isFromTemplate: agent.isFromTemplate,
          tags: agent.tags,
        };
        
        const changedFields: string[] = [];
        const changeDescriptions: string[] = [];
        
        const fieldsToCheck = [
          'name', 'voiceTone', 'personality', 'systemPrompt', 'language',
          'firstMessage', 'llmModel', 'temperature', 'elevenLabsVoiceId',
          'voiceStability', 'voiceSimilarityBoost', 'voiceSpeed',
          'transferPhoneNumber', 'transferAgentId', 'transferEnabled', 'detectLanguageEnabled',
          'endConversationEnabled', 'knowledgeBaseIds', 'knowledgeBaseOnly', 'maxDurationSeconds',
          'flowId', 'config', 'agentAssistConfig'
        ];
        
        for (const field of fieldsToCheck) {
          const reqValue = req.body[field];
          const agentValue = (agent as any)[field];
          
          if (reqValue !== undefined) {
            let hasChanged = false;
            
            if (field === 'config' || field === 'knowledgeBaseIds') {
              hasChanged = JSON.stringify(reqValue) !== JSON.stringify(agentValue);
            } else {
              hasChanged = reqValue !== agentValue;
            }
            
            if (hasChanged) {
              changedFields.push(field);
              if (field === 'systemPrompt' || field === 'firstMessage') {
                changeDescriptions.push(`Updated ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
              } else if (field === 'config') {
                changeDescriptions.push('Updated agent configuration');
              } else if (field === 'flowId') {
                changeDescriptions.push('Changed conversation flow');
              } else {
                changeDescriptions.push(`Changed ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
              }
            }
          }
        }
        
        if (changedFields.length > 0) {
          console.log(`   ✅ Creating version ${nextVersionNumber}: ${changedFields.join(', ')}`);
          await storage.createAgentVersion({
            agentId: agent.id,
            versionNumber: nextVersionNumber,
            snapshot: currentSnapshot,
            changesSummary: changeDescriptions.join(', ') || 'Configuration updated',
            changedFields,
            editedBy: req.userId!,
            note: null,
          });
        } else {
          console.log(`   ⏭️ No changes detected, skipping version creation`);
        }
      } catch (versionError) {
        console.warn("Failed to create agent version:", versionError);
      }

      const { 
        name, 
        systemPrompt, 
        elevenLabsVoiceId, 
        language, 
        llmModel, 
        knowledgeBaseIds, 
        transferEnabled, 
        transferPhoneNumber,
        detectLanguageEnabled,
        endConversationEnabled,
        appointmentBookingEnabled,
        knowledgeBaseOnly,
        flowId: newFlowId,
        maxDurationSeconds: newMaxDuration,
        voiceStability,
        voiceSimilarityBoost,
        voiceSpeed
      } = req.body;

      if (llmModel && llmModel !== agent.llmModel) {
        const { getUserPlanCapabilities } = await import('../services/membership-service');
        const capabilities = await getUserPlanCapabilities(req.userId!);
        
        if (!capabilities.canChooseLlm) {
          const { or } = await import('drizzle-orm');
          const requestedModel = await db
            .select({ tier: llmModels.tier })
            .from(llmModels)
            .where(or(eq(llmModels.name, llmModel), eq(llmModels.modelId, llmModel)))
            .limit(1);
          
          const modelTier = requestedModel.length > 0 ? requestedModel[0].tier : null;
          
          if (modelTier && modelTier !== 'free') {
            return res.status(403).json({
              error: "Plan upgrade required",
              message: `Your ${capabilities.planDisplayName} plan only allows free-tier LLM models. Please upgrade to Pro to use premium models.`,
              upgradeRequired: true
            });
          }
        }
      }

      if (agent.type === 'flow') {
        if (agent.elevenLabsAgentId) {
          try {
            await FlowAgentService.updateInElevenLabs(
              agent.id,
              agent.elevenLabsAgentId,
              agent,
              {
                name,
                flowId: newFlowId,
                elevenLabsVoiceId,
                systemPrompt,
                firstMessage: req.body.firstMessage,
                language,
                llmModel,
                temperature: req.body.temperature,
                maxDurationSeconds: newMaxDuration,
                detectLanguageEnabled,
                knowledgeBaseIds,
                knowledgeBaseOnly,
                voiceStability,
                voiceSimilarityBoost,
                voiceSpeed,
              }
            );
          } catch (syncError: any) {
            console.error(`❌ Flow agent ElevenLabs sync failed:`, syncError.message);
            return res.status(500).json({ 
              error: "Failed to sync changes to ElevenLabs",
              details: syncError.message 
            });
          }
        }
        
        let resolvedLlmModel: string | null = agent.llmModel;
        if (llmModel) {
          const modelRecord = await db
            .select({ modelId: llmModels.modelId })
            .from(llmModels)
            .where(eq(llmModels.name, llmModel))
            .limit(1);
          resolvedLlmModel = modelRecord.length > 0 ? modelRecord[0].modelId : llmModel;
        }
        
        const flowAgentUpdateBody = {
          ...req.body,
          llmModel: resolvedLlmModel || agent.llmModel,
          temperature: req.body.temperature !== undefined ? req.body.temperature : agent.temperature,
          knowledgeBaseIds: knowledgeBaseIds !== undefined ? knowledgeBaseIds : agent.knowledgeBaseIds,
        };
        await storage.updateAgent(req.params.id, flowAgentUpdateBody);
        const updatedAgent = await storage.getAgent(req.params.id);
        return res.json(updatedAgent);
      }

      if (agent.type === 'incoming') {
        await storage.updateAgent(req.params.id, req.body);
        
        const updatedAgent = await storage.getAgent(req.params.id);
        if (!updatedAgent) {
          return res.status(500).json({ error: "Failed to retrieve updated agent" });
        }
        
        if (updatedAgent.elevenLabsAgentId) {
          try {
            await IncomingAgentService.updateInElevenLabs(
              agent.id,
              updatedAgent.elevenLabsAgentId,
              agent,
              {
                name,
                systemPrompt,
                elevenLabsVoiceId,
                firstMessage: req.body.firstMessage,
                language,
                llmModel,
                temperature: req.body.temperature,
                knowledgeBaseIds,
                transferEnabled,
                transferPhoneNumber,
                detectLanguageEnabled,
                endConversationEnabled,
                appointmentBookingEnabled,
                knowledgeBaseOnly,
                voiceStability,
                voiceSimilarityBoost,
                voiceSpeed,
                databaseAgentId: agent.id,
              }
            );
          } catch (error: any) {
            console.error("Failed to sync Incoming agent to ElevenLabs:", error);
          }
        }
        
        return res.json(updatedAgent);
      }

      await storage.updateAgent(req.params.id, req.body);
      const updatedAgent = await storage.getAgent(req.params.id);
      if (!updatedAgent) {
        return res.status(500).json({ error: "Failed to retrieve updated agent" });
      }
      
      res.json(updatedAgent);
    } catch (error: any) {
      console.error("Update agent error:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  router.delete("/api/agents/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      if (agent.elevenLabsAgentId) {
        try {
          const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
          if (credential) {
            const agentElevenLabsService = new ElevenLabsService(credential.apiKey);
            await agentElevenLabsService.deleteAgent(agent.elevenLabsAgentId);
            console.log(`✅ Deleted agent ${agent.name} from ElevenLabs (${agent.elevenLabsAgentId})`);
          } else {
            await elevenLabsService.deleteAgent(agent.elevenLabsAgentId);
            console.log(`✅ Deleted agent ${agent.name} from ElevenLabs using default credential`);
          }
        } catch (elevenLabsError: any) {
          console.error(`⚠️ Failed to delete from ElevenLabs (will still delete from database):`, elevenLabsError.message);
        }
      }

      if (agent.elevenLabsCredentialId) {
        try {
          await ElevenLabsPoolService.updateAssignmentCount(agent.elevenLabsCredentialId, false);
          console.log(`📊 [Agent Delete] Decremented agent count for credential ${agent.elevenLabsCredentialId}`);
        } catch (countError) {
          console.warn("Failed to update credential agent count:", countError);
        }
      }

      await storage.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete agent error:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // ========================================
  // Language Replication Routes
  // ========================================

  router.post("/api/agents/:id/replicate-languages", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { languageReplicationService, TARGET_LANGUAGES } = await import("../services/language-replication");
      
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.userId !== req.userId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      console.log(`🌍 Starting language replication for agent "${agent.name}" (${agent.id})`);
      
      // Fetch available ElevenLabs voices for language-specific voice mapping
      let availableVoices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> = [];
      try {
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (credential) {
          const voiceElevenLabsService = new ElevenLabsService(credential.apiKey);
          const voicesResult = await voiceElevenLabsService.listVoices();
          availableVoices = voicesResult.voices || [];
          console.log(`🎤 Fetched ${availableVoices.length} ElevenLabs voices for language mapping`);
        }
      } catch (voiceError) {
        console.warn('Could not fetch ElevenLabs voices for language mapping, will use OpenAI voices only:', voiceError);
      }
      
      // Generate language variants
      const variants = await languageReplicationService.generateLanguageVariants({
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt || '',
        firstMessage: agent.firstMessage || 'Hello! How can I help you today?',
        language: agent.language || 'en',
        type: agent.type,
        voiceTone: agent.voiceTone || undefined,
        personality: agent.personality || undefined,
        elevenLabsVoiceId: agent.elevenLabsVoiceId || undefined,
        openaiVoice: agent.openaiVoice || undefined,
        telephonyProvider: agent.telephonyProvider || undefined,
        llmModel: agent.llmModel || undefined,
        temperature: agent.temperature ?? undefined,
        knowledgeBaseIds: agent.knowledgeBaseIds || undefined,
        transferEnabled: agent.transferEnabled ?? undefined,
        transferPhoneNumber: agent.transferPhoneNumber || undefined,
        detectLanguageEnabled: agent.detectLanguageEnabled ?? undefined,
        endConversationEnabled: agent.endConversationEnabled ?? undefined,
        appointmentBookingEnabled: agent.appointmentBookingEnabled ?? undefined,
        voiceStability: agent.voiceStability ?? undefined,
        voiceSimilarityBoost: agent.voiceSimilarityBoost ?? undefined,
        voiceSpeed: agent.voiceSpeed ?? undefined,
        specialist: agent.specialist || undefined,
        tags: agent.tags || undefined,
      }, availableVoices);

      const createdAgents = [];

      for (const variant of variants) {
        console.log(`🌐 Creating ${variant.languageName} variant: "${variant.name}"`);
        
        const variantData = languageReplicationService.createVariantAgentData(
          {
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.systemPrompt || '',
            firstMessage: agent.firstMessage || '',
            language: agent.language || 'en',
            type: agent.type,
            voiceTone: agent.voiceTone || undefined,
            personality: agent.personality || undefined,
            elevenLabsVoiceId: agent.elevenLabsVoiceId || undefined,
            openaiVoice: agent.openaiVoice || undefined,
            telephonyProvider: agent.telephonyProvider || undefined,
            llmModel: agent.llmModel || undefined,
            temperature: agent.temperature ?? undefined,
            knowledgeBaseIds: agent.knowledgeBaseIds || undefined,
            transferEnabled: agent.transferEnabled ?? undefined,
            transferPhoneNumber: agent.transferPhoneNumber || undefined,
            transferMessage: (agent as any).transferMessage || undefined,
            detectLanguageEnabled: agent.detectLanguageEnabled ?? undefined,
            endConversationEnabled: agent.endConversationEnabled ?? undefined,
            appointmentBookingEnabled: agent.appointmentBookingEnabled ?? undefined,
            voiceStability: agent.voiceStability ?? undefined,
            voiceSimilarityBoost: agent.voiceSimilarityBoost ?? undefined,
            voiceSpeed: agent.voiceSpeed ?? undefined,
            specialist: agent.specialist || undefined,
            tags: agent.tags || undefined,
            flowId: agent.flowId || undefined,
            maxDurationSeconds: agent.maxDurationSeconds || undefined,
            config: agent.config || undefined,
            sipPhoneNumberId: (agent as any).sipPhoneNumberId || undefined,
          },
          variant
        );

        // Create the agent in the database (without ElevenLabs for now - user can configure later)
        const newAgent = await storage.createAgent({
          userId: req.userId!,
          type: variantData.type as 'incoming' | 'flow',
          name: variantData.name,
          voiceTone: variantData.voiceTone || null,
          personality: variantData.personality || null,
          systemPrompt: variantData.systemPrompt,
          config: variantData.config || null,
          elevenLabsAgentId: null,
          elevenLabsCredentialId: null,
          elevenLabsVoiceId: variantData.elevenLabsVoiceId || null,
          firstMessage: variantData.firstMessage,
          language: variantData.language,
          llmModel: variantData.llmModel || null,
          temperature: variantData.temperature ?? null,
          knowledgeBaseIds: variantData.knowledgeBaseIds || null,
          transferEnabled: variantData.transferEnabled || false,
          transferPhoneNumber: variantData.transferPhoneNumber || null,
          detectLanguageEnabled: variantData.detectLanguageEnabled || false,
          endConversationEnabled: variantData.endConversationEnabled || false,
          appointmentBookingEnabled: variantData.appointmentBookingEnabled || false,
          flowId: variantData.flowId || null,
          maxDurationSeconds: variantData.maxDurationSeconds || null,
          voiceStability: variantData.voiceStability ?? 0.55,
          voiceSimilarityBoost: variantData.voiceSimilarityBoost ?? 0.85,
          voiceSpeed: variantData.voiceSpeed ?? 1.0,
          telephonyProvider: variantData.telephonyProvider || 'twilio',
          openaiVoice: variantData.openaiVoice || 'alloy',
          sourceTemplateId: agent.sourceTemplateId,
          isFromTemplate: agent.isFromTemplate,
          tags: variantData.tags || null,
          specialist: variantData.specialist || null,
          avatarUrl: agent.avatarUrl || null,
        });

        createdAgents.push({
          id: newAgent.id,
          name: newAgent.name,
          language: variant.languageCode,
          languageName: variant.languageName,
        });

        console.log(`✅ Created ${variant.languageName} agent: ${newAgent.name} (${newAgent.id})`);
      }

      res.json({
        success: true,
        message: `Successfully created ${createdAgents.length} language variants`,
        originalAgent: { id: agent.id, name: agent.name },
        createdAgents,
      });
    } catch (error: any) {
      console.error("Language replication error:", error);
      res.status(500).json({ error: "Failed to replicate agent to other languages: " + error.message });
    }
  });

  router.get("/api/languages/available", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { TARGET_LANGUAGES } = await import("../services/language-replication");
      res.json(TARGET_LANGUAGES);
    } catch (error: any) {
      console.error("Get languages error:", error);
      res.status(500).json({ error: "Failed to get available languages" });
    }
  });

  // Batch replicate all English agents to 5 languages
  router.post("/api/agents/batch-replicate-languages", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { languageReplicationService, TARGET_LANGUAGES } = await import("../services/language-replication");
      
      // Get all user's agents that are in English (or don't have language set)
      const allAgents = await storage.getUserAgents(req.userId!);
      const englishAgents = allAgents.filter(a => !a.language || a.language === 'en');
      
      if (englishAgents.length === 0) {
        return res.json({ 
          success: true, 
          message: "No English agents found to replicate",
          totalCreated: 0 
        });
      }

      console.log(`🌍 Batch replicating ${englishAgents.length} English agents to 5 languages`);
      
      // Fetch available ElevenLabs voices once for all agents
      let availableVoices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> = [];
      try {
        const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
        if (credential) {
          const voiceElevenLabsService = new ElevenLabsService(credential.apiKey);
          const voicesResult = await voiceElevenLabsService.listVoices();
          availableVoices = voicesResult.voices || [];
          console.log(`🎤 Fetched ${availableVoices.length} ElevenLabs voices for language mapping`);
        }
      } catch (voiceError) {
        console.warn('Could not fetch ElevenLabs voices for language mapping:', voiceError);
      }

      const allCreatedAgents = [];
      const errors: string[] = [];

      for (const agent of englishAgents) {
        try {
          console.log(`\n🌐 Processing agent: "${agent.name}" (${agent.id})`);
          
          const variants = await languageReplicationService.generateLanguageVariants({
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.systemPrompt || '',
            firstMessage: agent.firstMessage || 'Hello! How can I help you today?',
            language: agent.language || 'en',
            type: agent.type,
            voiceTone: agent.voiceTone || undefined,
            personality: agent.personality || undefined,
            elevenLabsVoiceId: agent.elevenLabsVoiceId || undefined,
            openaiVoice: agent.openaiVoice || undefined,
            telephonyProvider: agent.telephonyProvider || undefined,
            llmModel: agent.llmModel || undefined,
            temperature: agent.temperature ?? undefined,
            knowledgeBaseIds: agent.knowledgeBaseIds || undefined,
            transferEnabled: agent.transferEnabled ?? undefined,
            transferPhoneNumber: agent.transferPhoneNumber || undefined,
            detectLanguageEnabled: agent.detectLanguageEnabled ?? undefined,
            endConversationEnabled: agent.endConversationEnabled ?? undefined,
            appointmentBookingEnabled: agent.appointmentBookingEnabled ?? undefined,
            voiceStability: agent.voiceStability ?? undefined,
            voiceSimilarityBoost: agent.voiceSimilarityBoost ?? undefined,
            voiceSpeed: agent.voiceSpeed ?? undefined,
            specialist: agent.specialist || undefined,
            tags: agent.tags || undefined,
          }, availableVoices);

          for (const variant of variants) {
            const variantData = languageReplicationService.createVariantAgentData(
              {
                id: agent.id,
                name: agent.name,
                systemPrompt: agent.systemPrompt || '',
                firstMessage: agent.firstMessage || '',
                language: agent.language || 'en',
                type: agent.type,
                voiceTone: agent.voiceTone || undefined,
                personality: agent.personality || undefined,
                elevenLabsVoiceId: agent.elevenLabsVoiceId || undefined,
                openaiVoice: agent.openaiVoice || undefined,
                telephonyProvider: agent.telephonyProvider || undefined,
                llmModel: agent.llmModel || undefined,
                temperature: agent.temperature ?? undefined,
                knowledgeBaseIds: agent.knowledgeBaseIds || undefined,
                transferEnabled: agent.transferEnabled ?? undefined,
                transferPhoneNumber: agent.transferPhoneNumber || undefined,
                transferMessage: (agent as any).transferMessage || undefined,
                detectLanguageEnabled: agent.detectLanguageEnabled ?? undefined,
                endConversationEnabled: agent.endConversationEnabled ?? undefined,
                appointmentBookingEnabled: agent.appointmentBookingEnabled ?? undefined,
                voiceStability: agent.voiceStability ?? undefined,
                voiceSimilarityBoost: agent.voiceSimilarityBoost ?? undefined,
                voiceSpeed: agent.voiceSpeed ?? undefined,
                specialist: agent.specialist || undefined,
                tags: agent.tags || undefined,
                flowId: agent.flowId || undefined,
                maxDurationSeconds: agent.maxDurationSeconds || undefined,
                config: agent.config || undefined,
                sipPhoneNumberId: (agent as any).sipPhoneNumberId || undefined,
              },
              variant
            );

            const newAgent = await storage.createAgent({
              userId: req.userId!,
              type: variantData.type as 'incoming' | 'flow',
              name: variantData.name,
              voiceTone: variantData.voiceTone || null,
              personality: variantData.personality || null,
              systemPrompt: variantData.systemPrompt,
              config: variantData.config || null,
              elevenLabsAgentId: null,
              elevenLabsCredentialId: null,
              elevenLabsVoiceId: variantData.elevenLabsVoiceId || null,
              firstMessage: variantData.firstMessage,
              language: variantData.language,
              llmModel: variantData.llmModel || null,
              temperature: variantData.temperature ?? null,
              knowledgeBaseIds: variantData.knowledgeBaseIds || null,
              transferEnabled: variantData.transferEnabled || false,
              transferPhoneNumber: variantData.transferPhoneNumber || null,
              detectLanguageEnabled: variantData.detectLanguageEnabled || false,
              endConversationEnabled: variantData.endConversationEnabled || false,
              appointmentBookingEnabled: variantData.appointmentBookingEnabled || false,
              flowId: variantData.flowId || null,
              maxDurationSeconds: variantData.maxDurationSeconds || null,
              voiceStability: variantData.voiceStability ?? 0.55,
              voiceSimilarityBoost: variantData.voiceSimilarityBoost ?? 0.85,
              voiceSpeed: variantData.voiceSpeed ?? 1.0,
              telephonyProvider: variantData.telephonyProvider || 'twilio',
              openaiVoice: variantData.openaiVoice || 'alloy',
              sourceTemplateId: agent.sourceTemplateId,
              isFromTemplate: agent.isFromTemplate,
              tags: variantData.tags || null,
              specialist: variantData.specialist || null,
              avatarUrl: agent.avatarUrl || null,
            });

            allCreatedAgents.push({
              id: newAgent.id,
              name: newAgent.name,
              language: variant.languageCode,
              languageName: variant.languageName,
              originalAgentId: agent.id,
              originalAgentName: agent.name,
            });

            console.log(`  ✅ Created ${variant.languageName}: ${newAgent.name}`);
          }
        } catch (agentError: any) {
          console.error(`  ❌ Error replicating agent "${agent.name}":`, agentError.message);
          errors.push(`${agent.name}: ${agentError.message}`);
        }
      }

      res.json({
        success: true,
        message: `Successfully created ${allCreatedAgents.length} language variants from ${englishAgents.length} English agents`,
        totalOriginalAgents: englishAgents.length,
        totalCreated: allCreatedAgents.length,
        createdAgents: allCreatedAgents,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Batch language replication error:", error);
      res.status(500).json({ error: "Failed to batch replicate agents: " + error.message });
    }
  });

  // ========================================
  // Knowledge Base Routes
  // ========================================

  router.get("/api/knowledge-base", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const items = await storage.getUserKnowledgeBase(req.userId!);
      res.json(items);
    } catch (error: any) {
      console.error("Get knowledge base error:", error);
      res.status(500).json({ error: "Failed to get knowledge base" });
    }
  });

  router.post("/api/knowledge-base", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { type, title, content, url, metadata } = req.body;

      if (!type || !title) {
        return res.status(400).json({ error: "Type and title are required" });
      }

      const currentCount = await storage.getUserKnowledgeBaseCount(req.userId!);
      const limits = await storage.getUserEffectiveLimits(req.userId!);
      const maxKnowledgeBases = typeof limits.maxKnowledgeBases === 'number' ? limits.maxKnowledgeBases : 5;
      
      // Skip limit check if explicitly unlimited (999 or -1)
      if (maxKnowledgeBases !== 999 && maxKnowledgeBases !== -1 && currentCount >= maxKnowledgeBases) {
        return res.status(403).json({ 
          error: `Knowledge base limit reached (${maxKnowledgeBases}). Upgrade your plan or contact support to increase your limit.`
        });
      }

      const storageSize = content ? content.length : 0;

      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type,
        title,
        content: content || null,
        url: url || null,
        fileUrl: null,
        metadata: metadata || null,
        storageSize,
      });

      generateUseCasesFromKB(req.userId!).catch(err => console.error("[KB] Use case generation error:", err));

      res.json(item);
    } catch (error: any) {
      console.error("Create knowledge base item error:", error);
      res.status(500).json({ error: "Failed to create knowledge base item" });
    }
  });

  router.post("/api/knowledge-base/upload", authenticateHybrid, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const currentCount = await storage.getUserKnowledgeBaseCount(req.userId!);
      const limits = await storage.getUserEffectiveLimits(req.userId!);
      const maxKnowledgeBases = typeof limits.maxKnowledgeBases === 'number' ? limits.maxKnowledgeBases : 5;
      
      // Skip limit check if explicitly unlimited (999 or -1)
      if (maxKnowledgeBases !== 999 && maxKnowledgeBases !== -1 && currentCount >= maxKnowledgeBases) {
        return res.status(403).json({ 
          error: `Knowledge base limit reached (${maxKnowledgeBases}). Upgrade your plan or contact support to increase your limit.`
        });
      }

      const { name } = req.body;
      const filename = req.file.originalname;
      
      if (req.file.size > 20 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds 20MB limit" });
      }

      const elevenLabsResult = await elevenLabsService.uploadKnowledgeBaseFile(
        req.file.buffer,
        filename,
        name || filename
      );

      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'file',
        title: name || filename,
        content: null,
        url: null,
        fileUrl: filename,
        elevenLabsDocId: elevenLabsResult.id,
        metadata: { filename, mimeType: req.file.mimetype },
        storageSize: req.file.size,
      });

      generateUseCasesFromKB(req.userId!).catch(err => console.error("[KB] Use case generation error:", err));

      res.json(item);
    } catch (error: any) {
      console.error("Upload knowledge base file error:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  router.post("/api/knowledge-base/url", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { url, name } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const currentCount = await storage.getUserKnowledgeBaseCount(req.userId!);
      const limits = await storage.getUserEffectiveLimits(req.userId!);
      const maxKnowledgeBases = typeof limits.maxKnowledgeBases === 'number' ? limits.maxKnowledgeBases : 5;
      
      // Skip limit check if explicitly unlimited (999 or -1)
      if (maxKnowledgeBases !== 999 && maxKnowledgeBases !== -1 && currentCount >= maxKnowledgeBases) {
        return res.status(403).json({ 
          error: `Knowledge base limit reached (${maxKnowledgeBases}). Upgrade your plan or contact support to increase your limit.`
        });
      }

      const elevenLabsResult = await elevenLabsService.addKnowledgeBaseFromUrl(url, name);

      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'url',
        title: name || url,
        content: null,
        url: url,
        fileUrl: null,
        elevenLabsDocId: elevenLabsResult.id,
        metadata: { url },
        storageSize: 0,
      });

      generateUseCasesFromKB(req.userId!).catch(err => console.error("[KB] Use case generation error:", err));

      res.json(item);
    } catch (error: any) {
      console.error("Add knowledge base URL error:", error);
      res.status(500).json({ error: error.message || "Failed to add URL" });
    }
  });

  router.post("/api/knowledge-base/text", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { text, name } = req.body;

      if (!text || !name) {
        return res.status(400).json({ error: "Text and name are required" });
      }

      const currentCount = await storage.getUserKnowledgeBaseCount(req.userId!);
      const limits = await storage.getUserEffectiveLimits(req.userId!);
      const maxKnowledgeBases = typeof limits.maxKnowledgeBases === 'number' ? limits.maxKnowledgeBases : 5;
      
      // Skip limit check if explicitly unlimited (999 or -1)
      if (maxKnowledgeBases !== 999 && maxKnowledgeBases !== -1 && currentCount >= maxKnowledgeBases) {
        return res.status(403).json({ 
          error: `Knowledge base limit reached (${maxKnowledgeBases}). Upgrade your plan or contact support to increase your limit.`
        });
      }

      if (text.length > 300000) {
        return res.status(400).json({ error: "Text exceeds 300,000 character limit" });
      }

      const elevenLabsResult = await elevenLabsService.addKnowledgeBaseFromText(text, name);

      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'text',
        title: name,
        content: text,
        url: null,
        fileUrl: null,
        elevenLabsDocId: elevenLabsResult.id,
        metadata: null,
        storageSize: text.length,
      });

      generateUseCasesFromKB(req.userId!).catch(err => console.error("[KB] Use case generation error:", err));

      res.json(item);
    } catch (error: any) {
      console.error("Add knowledge base text error:", error);
      res.status(500).json({ error: error.message || "Failed to add text" });
    }
  });

  router.delete("/api/knowledge-base/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const item = await storage.getKnowledgeBaseItem(req.params.id);
      if (!item || item.userId !== req.userId) {
        return res.status(404).json({ error: "Knowledge base item not found" });
      }

      if (item.elevenLabsDocId) {
        try {
          await elevenLabsService.deleteKnowledgeBase(item.elevenLabsDocId);
        } catch (elevenLabsError: any) {
          console.error("Failed to delete from ElevenLabs:", elevenLabsError.message);
        }
      }

      await storage.deleteKnowledgeBaseItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete knowledge base item error:", error);
      res.status(500).json({ error: "Failed to delete knowledge base item" });
    }
  });

  // ========================================
  // Agent Version History Routes
  // ========================================
  
  router.get("/api/agents/:agentId/versions", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (agent.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const versions = await storage.getAgentVersions(req.params.agentId);
      res.json(versions);
    } catch (error: any) {
      console.error("Get agent versions error:", error);
      res.status(500).json({ error: "Failed to get agent versions" });
    }
  });

  router.get("/api/agents/:agentId/versions/:versionNumber", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (agent.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const versionNumber = parseInt(req.params.versionNumber, 10);
      if (isNaN(versionNumber)) {
        return res.status(400).json({ error: "Invalid version number" });
      }
      
      const version = await storage.getAgentVersionByNumber(req.params.agentId, versionNumber);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      res.json(version);
    } catch (error: any) {
      console.error("Get agent version error:", error);
      res.status(500).json({ error: "Failed to get agent version" });
    }
  });

  router.post("/api/agents/:agentId/versions/:versionNumber/rollback", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (agent.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const versionNumber = parseInt(req.params.versionNumber, 10);
      if (isNaN(versionNumber)) {
        return res.status(400).json({ error: "Invalid version number" });
      }
      
      const targetVersion = await storage.getAgentVersionByNumber(req.params.agentId, versionNumber);
      if (!targetVersion) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      const latestVersion = await storage.getLatestAgentVersion(req.params.agentId);
      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;
      
      const currentSnapshot = {
        name: agent.name,
        type: agent.type,
        voiceTone: agent.voiceTone,
        personality: agent.personality,
        systemPrompt: agent.systemPrompt,
        language: agent.language,
        firstMessage: agent.firstMessage,
        llmModel: agent.llmModel,
        temperature: agent.temperature,
        elevenLabsVoiceId: agent.elevenLabsVoiceId,
        voiceStability: agent.voiceStability,
        voiceSimilarityBoost: agent.voiceSimilarityBoost,
        voiceSpeed: agent.voiceSpeed,
        transferPhoneNumber: agent.transferPhoneNumber,
        transferEnabled: agent.transferEnabled,
        detectLanguageEnabled: agent.detectLanguageEnabled,
        endConversationEnabled: agent.endConversationEnabled,
        knowledgeBaseIds: agent.knowledgeBaseIds,
        maxDurationSeconds: agent.maxDurationSeconds,
        config: agent.config as Record<string, unknown> | null,
      };
      
      await storage.createAgentVersion({
        agentId: req.params.agentId,
        versionNumber: nextVersionNumber,
        snapshot: currentSnapshot,
        changesSummary: `Snapshot before rollback to version ${versionNumber}`,
        changedFields: [],
        editedBy: req.userId!,
        note: req.body.note || null,
      });
      
      const targetSnapshot = targetVersion.snapshot as typeof currentSnapshot;
      await storage.updateAgent(req.params.agentId, {
        name: targetSnapshot.name,
        voiceTone: targetSnapshot.voiceTone,
        personality: targetSnapshot.personality,
        systemPrompt: targetSnapshot.systemPrompt,
        language: targetSnapshot.language,
        firstMessage: targetSnapshot.firstMessage,
        llmModel: targetSnapshot.llmModel,
        temperature: targetSnapshot.temperature,
        elevenLabsVoiceId: targetSnapshot.elevenLabsVoiceId,
        voiceStability: targetSnapshot.voiceStability,
        voiceSimilarityBoost: targetSnapshot.voiceSimilarityBoost,
        voiceSpeed: targetSnapshot.voiceSpeed,
        transferPhoneNumber: targetSnapshot.transferPhoneNumber,
        transferEnabled: targetSnapshot.transferEnabled,
        detectLanguageEnabled: targetSnapshot.detectLanguageEnabled,
        endConversationEnabled: targetSnapshot.endConversationEnabled,
        knowledgeBaseIds: targetSnapshot.knowledgeBaseIds,
        maxDurationSeconds: targetSnapshot.maxDurationSeconds,
        config: targetSnapshot.config,
        updatedAt: new Date(),
      });
      
      if (agent.elevenLabsAgentId) {
        try {
          const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
          if (credential) {
            const rollbackElevenLabsService = new ElevenLabsService(credential.apiKey);
            await rollbackElevenLabsService.updateAgent(agent.elevenLabsAgentId, {
              name: targetSnapshot.name,
              first_message: targetSnapshot.firstMessage || undefined,
              prompt: targetSnapshot.systemPrompt || undefined,
              voice_id: targetSnapshot.elevenLabsVoiceId || undefined,
              language: targetSnapshot.language || 'en',
              model: targetSnapshot.llmModel || undefined,
              temperature: targetSnapshot.temperature || undefined,
            });
          }
        } catch (syncError) {
          console.warn("Failed to sync rollback with ElevenLabs:", syncError);
        }
      }
      
      const updatedAgent = await storage.getAgent(req.params.agentId);
      
      res.json({
        success: true,
        message: `Rolled back to version ${versionNumber}`,
        agent: updatedAgent,
        previousVersionNumber: nextVersionNumber,
      });
    } catch (error: any) {
      console.error("Rollback agent version error:", error);
      res.status(500).json({ error: "Failed to rollback agent version" });
    }
  });

  // ========================================
  // Voices Routes (Agent-related)
  // ========================================

  router.get("/api/voices", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const voices = await storage.getUserVoices(req.userId!);
      res.json(voices);
    } catch (error: any) {
      console.error("Get voices error:", error);
      res.status(500).json({ error: "Failed to get voices" });
    }
  });

  router.post("/api/voices/preview", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId, text, voiceSettings, modelId } = req.body;
      
      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }
      
      const previewText = text || "Hello! This is a preview of how I'll sound. I can adjust my tone and style based on your preferences.";
      
      if (previewText.length > 500) {
        return res.status(400).json({ error: "Preview text cannot exceed 500 characters" });
      }
      
      const credential = await ElevenLabsPoolService.getUserCredential(req.userId!);
      if (!credential) {
        return res.status(500).json({ error: "No available ElevenLabs API keys" });
      }
      
      const previewService = new ElevenLabsService(credential.apiKey);
      
      const audioBuffer = await previewService.generateVoicePreview({
        voiceId,
        text: previewText,
        voiceSettings,
        modelId,
      });
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("Voice preview error:", error);
      res.status(500).json({ error: error.message || "Failed to generate voice preview" });
    }
  });

  // ========================================
  // OpenAI Voice Preview Route
  // ========================================

  router.post("/api/openai/voices/preview", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId, text, speed } = req.body;
      
      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }
      
      const validVoices = ["alloy", "echo", "shimmer", "ash", "ballad", "coral", "sage", "verse", "cedar", "marin"];
      if (!validVoices.includes(voiceId)) {
        return res.status(400).json({ error: `Invalid voice. Must be one of: ${validVoices.join(", ")}` });
      }
      
      const previewText = text || "Hello! This is a preview of how I'll sound. I can adjust my tone and style based on your preferences.";
      
      if (previewText.length > 500) {
        return res.status(400).json({ error: "Preview text cannot exceed 500 characters" });
      }
      
      const credential = await OpenAIPoolService.getLeastLoadedCredential();
      if (!credential) {
        return res.status(500).json({ error: "No available OpenAI API keys" });
      }
      
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credential.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: previewText,
          voice: voiceId,
          response_format: "mp3",
          speed: speed || 1.0,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI TTS error:", errorText);
        return res.status(500).json({ error: "Failed to generate voice preview" });
      }
      
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("OpenAI voice preview error:", error);
      res.status(500).json({ error: error.message || "Failed to generate voice preview" });
    }
  });

  return router;
}
