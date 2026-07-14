'use strict';
/**
 * ============================================================
 * OpenAI Agent Factory
 * 
 * Creates OpenAI Realtime agents with integrated tools:
 * - Configure voice, model, system prompt
 * - Add tools (KB lookup, appointments, forms, webhooks)
 * - Handle Flow Builder compiled configurations
 * ============================================================
 */

import type { 
  OpenAIVoice, 
  OpenAIRealtimeModel, 
  AgentTool, 
  AgentConfig, 
  CompiledFlowConfig,
  FlowNode,
  FlowEdge
} from '../types';
import { OPENAI_VOICES, MODEL_TIER_CONFIG } from '../types';
import { RAGKnowledgeService } from '../../../services/rag-knowledge';
import { awsBedrockService } from '../../../services/aws-bedrock';
import { db } from '../../../db';
import { appointments, appointmentSettings, formSubmissions, agents, forms, formFields, calls, twilioOpenaiCalls } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { webhookDeliveryService } from '../../../services/webhook-delivery';
import { buildDynamicFormTools, DYNAMIC_FORM_PROMPT } from '../../../services/dynamic-form-tools';
import { applyUaeLanguagePolicy } from '../../../services/phone-human-policy';

export interface DataSchemaField {
  name: string;
  type: "text" | "email" | "phone" | "datetime" | "number" | "yes_no";
  description: string;
  required?: boolean;
}

/**
 * Context passed to tool handlers during calls
 */
export interface ToolContext {
  userId: string;
  agentId: string;
  callId?: string;
}

/**
 * Extended AgentConfig with context for tool handlers
 */
export interface AgentConfigWithContext extends AgentConfig {
  toolContext?: ToolContext;
}

export class OpenAIAgentFactory {
  /**
   * Get available voices
   */
  static getAvailableVoices(): typeof OPENAI_VOICES {
    return OPENAI_VOICES;
  }

  /**
   * Get available models for a tier
   */
  static getAvailableModels(tier: 'free' | 'pro'): OpenAIRealtimeModel[] {
    return MODEL_TIER_CONFIG[tier].models;
  }

  /**
   * Map Polly / ElevenLabs alias IDs → OpenAI Realtime voices.
   * Deprock department agents store `el_*` (ElevenLabs aliases) in `openai_voice`;
   * sending those to GA Realtime rejects session.update and produces total silence.
   */
  private static readonly ALIAS_TO_OPENAI_VOICE: Record<string, OpenAIVoice> = {
    el_rachel: 'coral',
    el_domi: 'coral',
    el_bella: 'shimmer',
    el_nicole: 'shimmer',
    el_elli: 'shimmer',
    el_antoni: 'echo',
    el_josh: 'ash',
    el_arnold: 'ash',
    el_adam: 'echo',
    el_sam: 'echo',
    el_marie: 'shimmer',
    el_pierre: 'echo',
    el_giulia: 'coral',
    el_marco: 'ash',
    el_xiaoli: 'sage',
    el_wei: 'ash',
    el_priya: 'coral',
    el_raj: 'echo',
    el_fatima: 'shimmer',
    el_omar: 'ash',
    // Polly names sometimes written into openai_voice
    Joanna: 'alloy',
    Matthew: 'echo',
    Salli: 'shimmer',
    Kendra: 'coral',
    Kimberly: 'sage',
    Joey: 'ash',
    Justin: 'verse',
    Ivy: 'alloy',
    Ruth: 'shimmer',
    Stephen: 'echo',
    Zeina: 'alloy',
    Hala: 'shimmer',
    Zayd: 'ash',
    // Retired / non-Realtime TTS voices
    fable: 'verse',
    onyx: 'ash',
    nova: 'coral',
  };

  /**
   * Validate and normalize voice selection for OpenAI Realtime.
   */
  static validateVoice(voice: string): OpenAIVoice {
    if (!voice) return 'alloy';
    const aliased = this.ALIAS_TO_OPENAI_VOICE[voice];
    if (aliased) {
      console.warn(`[Agent Factory] Mapping voice alias "${voice}" → "${aliased}" for OpenAI Realtime`);
      return aliased;
    }
    const validVoice = OPENAI_VOICES.find(v => v.id === voice);
    if (!validVoice) {
      console.warn(`[Agent Factory] Invalid voice "${voice}", falling back to "alloy"`);
      return 'alloy';
    }
    return voice as OpenAIVoice;
  }

  /**
   * Validate and normalize model selection based on tier
   */
  static validateModel(model: string, tier: 'free' | 'pro' = 'free'): OpenAIRealtimeModel {
    const allowedModels = this.getAvailableModels(tier);
    if (!allowedModels.includes(model as OpenAIRealtimeModel)) {
      console.warn(`[Agent Factory] Model "${model}" not allowed for tier "${tier}", falling back to ${allowedModels[0]}`);
      return allowedModels[0];
    }
    return model as OpenAIRealtimeModel;
  }

  /**
   * Create an agent configuration for OpenAI Realtime
   */
  static createAgentConfig(params: {
    voice: OpenAIVoice;
    model: OpenAIRealtimeModel;
    systemPrompt: string;
    firstMessage?: string;
    temperature?: number;
    userTier?: 'free' | 'pro';
    toolContext?: ToolContext;
    language?: string;
  }): AgentConfigWithContext {
    const tier = params.userTier || 'free';
    const voice = this.validateVoice(params.voice);
    const model = this.validateModel(params.model, tier);
    const language = params.language || 'en';

    console.log(`[Agent Factory] Creating config: voice=${voice}, model=${model}, tier=${tier}, language=${language}`);

    let systemPrompt = params.systemPrompt;

    const now = new Date();
    const hr = now.getHours();
    const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
    const timeContext = `CURRENT TIME CONTEXT: It is currently ${tod} (${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}). When greeting the caller, use the appropriate time-based greeting (e.g. "Good ${tod}").

GREETING RULES: Your opening greeting must ONLY include the time-based greeting, the company name (if known), your name (if known), and ask how you can help. NEVER mention any products, plans, prices, or offers in the greeting. Do NOT search the knowledge base until the caller states their needs.`;
    const realtimeResponseRules = `REALTIME RESPONSE RULES (PHONE):\n- Start speaking immediately after the caller finishes.\n- Begin with a short acknowledgement (3–6 words), then ask ONE clarifying question.\n- Then continue with the answer. Keep sentences short.\n- If you need to call tools, ask the clarifying question first while tools run.`;
    systemPrompt = `${timeContext}\n\n${realtimeResponseRules}\n\n${systemPrompt}`;

    // Respect agent/IVR language — do not force Arabic-primary when English (or another lang) is selected.
    systemPrompt = applyUaeLanguagePolicy(systemPrompt, language);

    if (language && !params.systemPrompt.includes('LANGUAGE LOCK') && !params.systemPrompt.includes('LANGUAGE:')) {
      const languageName = this.getLanguageName(language);
      systemPrompt = `LANGUAGE: Respond ONLY in ${languageName} unless the caller explicitly asks to switch languages. Match the caller's spoken language if they clearly switch.\n\n${systemPrompt}`;
    }

    // Realtime latency tuning defaults (can be overridden by agent.behaviorConfig or explicit vadSettings).
    // Goal: reduce end-of-speech detection time so the model starts speaking quickly.
    const defaultVadSettings = {
      type: 'semantic_vad' as const,
      eagerness: 'high' as const,
      threshold: 0.75,
      prefixPaddingMs: 250,
      silenceDurationMs: 450,
    };

    return {
      voice,
      model,
      systemPrompt,
      firstMessage: params.firstMessage,
      temperature: params.temperature ?? 0.7,
      tools: [],
      toolContext: params.toolContext,
      vadSettings: defaultVadSettings,
      language,
    };
  }

  /**
   * Add knowledge base lookup tool to agent
   * Uses RAGKnowledgeService for vector similarity search
   */
  static addKnowledgeBaseTool(
    config: AgentConfigWithContext, 
    knowledgeBaseIds: string[],
    userId: string,
    knowledgeBaseOnly?: boolean
  ): AgentConfigWithContext {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      console.log(`[Agent Factory] No knowledge bases to add`);
      return config;
    }

    console.log(`[Agent Factory] Adding KB tool for ${knowledgeBaseIds.length} knowledge bases`);

    RAGKnowledgeService.processUnchunkedKnowledgeBases(knowledgeBaseIds, userId)
      .catch(err => console.error(`[Agent Factory] Background KB processing error:`, err.message));

    const kbTool: AgentTool = {
      name: 'lookup_knowledge_base',
      description: 'Search your knowledge base for product details, pricing, features, availability, and any business information. ALWAYS use this tool FIRST when the caller asks about products, prices, services, plans, packages, or any factual question. Never guess — always search first. If the first search returns nothing, try rephrasing with different keywords and search again.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query in ENGLISH to find product details, pricing, and business information. Translate the caller question to English keywords for best results.',
          },
        },
        required: ['query'],
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          const query = params.query as string;
          console.log(`[KB Tool] Searching: "${query.substring(0, 50)}..."`);
          
          const results = await RAGKnowledgeService.searchKnowledge(
            query,
            knowledgeBaseIds,
            userId,
            5
          );
          
          if (results.length === 0) {
            console.log(`[KB Tool] No results found`);
            return { 
              found: false, 
              message: 'No exact match found for that query. Try searching again with different keywords, broader terms, or category names. If still no results, offer the closest alternative you know about.' 
            };
          }
          
          const formattedResponse = RAGKnowledgeService.formatResultsForAgent(results, 1200);
          console.log(`[KB Tool] Found ${results.length} results`);
          
          return { 
            found: true, 
            information: formattedResponse 
          };
        } catch (error: any) {
          console.error(`[KB Tool] Error:`, error.message);
          return { 
            found: false, 
            message: 'Search temporarily unavailable. Acknowledge this naturally and offer to help with what you know from the conversation so far.' 
          };
        }
      },
    };

    const kbPrompt = `

You have a knowledge base with product catalog, pricing, and business information. CRITICAL RULES:
- ALWAYS use the lookup_knowledge_base tool BEFORE answering ANY question about products, prices, plans, packages, features, availability, or business details. Search in ENGLISH even if the caller speaks another language.
- You are an elite sales agent. Your mission: understand the caller's needs deeply, match them with the perfect product, and guide them confidently toward a purchase.
- When presenting products, lead with the benefit that matters most to THIS caller based on what they've told you, then follow with features and pricing.
- Present pricing confidently as YOUR pricing. Never hesitate. Say "That plan is X per month" not "I believe it costs around X."
- ALWAYS proactively suggest: related products, bundles, upgrades, or better value options. A great agent anticipates needs.
- If one search returns nothing, rephrase and search AGAIN with different keywords before giving up. Try category names, synonyms, or broader terms.
- When you find multiple relevant products, compare them briefly and recommend the best fit: "Based on what you've told me, I'd recommend X because..."
- Never say "I don't have that information" or "check the website" — exhaust your knowledge base first, then offer alternatives.
- Never mention the knowledge base, internal systems, databases, or that you are looking things up.
- Respond with specific numbers, features, and details from search results — never give vague answers when you have exact data.
- Remember everything discussed in this call. Reference earlier topics to show continuity and build rapport.`;

    return {
      ...config,
      systemPrompt: config.systemPrompt + kbPrompt,
      knowledgeBaseIds,
      tools: [...(config.tools || []), kbTool],
    };
  }

  /**
   * Optional escalation tool: ask Bedrock (Claude Sonnet) for deeper reasoning.
   * Must be used sparingly; it is slower than GPT Realtime.
   */
  static addBedrockReasoningTool(
    config: AgentConfigWithContext,
    language: string = 'en'
  ): AgentConfigWithContext {
    if (config.tools?.some((t) => t.name === 'escalate_reasoning')) {
      return config;
    }

    const tool: AgentTool = {
      name: 'escalate_reasoning',
      description: 'Use ONLY when the user question is complex, ambiguous, or high-stakes and you need deeper reasoning. Return a concise answer.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The user question (in the user language).' },
          context: { type: 'string', description: 'Short relevant context from the conversation (optional).' },
        },
        required: ['question'],
      },
      handler: async (params: Record<string, unknown>) => {
        const question = String(params.question || '').trim();
        const context = String(params.context || '').trim();
        const prompt =
          `Reply in ${language}. Be concise (2-5 sentences). If facts are uncertain, say what is missing.` +
          `\n\nQuestion:\n${question}\n\nContext:\n${context}`;
        const model = awsBedrockService.selectModelForTask('reasoning');
        const resp = await awsBedrockService.invoke({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          maxTokens: 900,
        });
        return { answer: resp.content, model };
      },
    };

    return {
      ...config,
      systemPrompt:
        config.systemPrompt +
        `\n\nReasoning escalation: If the caller asks a complex or high-stakes question, you may call escalate_reasoning(question, context) to get a deeper answer. Ask one short clarifying question first if needed.`,
      tools: [...(config.tools || []), tool],
    };
  }

  /**
   * Add appointment booking tool to agent
   * Creates appointments in database directly
   */
  static addAppointmentTool(
    config: AgentConfigWithContext,
    userId: string,
    agentId: string,
    callId?: string
  ): AgentConfigWithContext {
    // Skip if appointment tool already exists to prevent duplicates
    if (config.tools?.some(t => t.name === 'book_appointment')) {
      console.log(`[Agent Factory] Appointment tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Agent Factory] Adding appointment tool for agent ${agentId}`);

    const appointmentTool: AgentTool = {
      name: 'book_appointment',
      description: 'Book an appointment for the caller. Collect their name, phone number, preferred date and time before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          contactName: { 
            type: 'string', 
            description: 'The name of the person booking the appointment' 
          },
          contactPhone: { 
            type: 'string', 
            description: 'Phone number exactly as spoken. Accept any format.' 
          },
          contactEmail: { 
            type: 'string', 
            description: 'Optional email address' 
          },
          appointmentDate: { 
            type: 'string', 
            description: 'Appointment date in YYYY-MM-DD format' 
          },
          appointmentTime: { 
            type: 'string', 
            description: 'Appointment time in HH:MM format (24-hour)' 
          },
          duration: { 
            type: 'number', 
            description: 'Duration in minutes (default 30)' 
          },
          serviceName: { 
            type: 'string', 
            description: 'Name of the service being booked' 
          },
          notes: { 
            type: 'string', 
            description: 'Additional notes or requirements' 
          },
        },
        required: ['contactName', 'contactPhone', 'appointmentDate', 'appointmentTime'],
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          console.log(`[Appointment Tool] Booking: ${JSON.stringify(params)}`);
          
          // Validate required parameters
          if (!params.contactName || !params.contactPhone || !params.appointmentDate || !params.appointmentTime) {
            return {
              success: false,
              message: 'Please provide name, phone, date and time for the appointment.'
            };
          }
          
          // Get agent's flowId if available
          const [agent] = await db
            .select({ flowId: agents.flowId })
            .from(agents)
            .where(eq(agents.id, agentId))
            .limit(1);
          
          // Check user's appointment settings for overlap validation and working hours
          const [settings] = await db
            .select()
            .from(appointmentSettings)
            .where(eq(appointmentSettings.userId, userId));
          
          // Default working hours
          const defaultWorkingHours: Record<string, { start: string; end: string; enabled: boolean }> = {
            monday: { start: "09:00", end: "17:00", enabled: true },
            tuesday: { start: "09:00", end: "17:00", enabled: true },
            wednesday: { start: "09:00", end: "17:00", enabled: true },
            thursday: { start: "09:00", end: "17:00", enabled: true },
            friday: { start: "09:00", end: "17:00", enabled: true },
            saturday: { start: "09:00", end: "17:00", enabled: false },
            sunday: { start: "09:00", end: "17:00", enabled: false },
          };
          
          // Validate working hours
          const appointmentDate = params.appointmentDate as string;
          const appointmentTime = params.appointmentTime as string;
          const parsedDate = new Date(appointmentDate + 'T12:00:00');
          
          if (!isNaN(parsedDate.getTime())) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
            const dayOfWeek = parsedDate.getDay();
            const dayName = dayNames[dayOfWeek];
            
            const userWorkingHours = settings?.workingHours as Record<string, { start: string; end: string; enabled: boolean }> | undefined;
            const daySettings = userWorkingHours?.[dayName] 
              ? { ...defaultWorkingHours[dayName], ...userWorkingHours[dayName] }
              : defaultWorkingHours[dayName];
            
            console.log(`[Appointment Tool] Working hours for ${dayName}:`, daySettings);
            
            if (!daySettings?.enabled) {
              const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
              console.log(`[Appointment Tool] Rejected: ${dayName} is not available for appointments`);
              return {
                success: false,
                message: `We're not available on ${capitalizedDay}s. Please choose a different day.`
              };
            }
            
            // Check time is within working hours
            try {
              const parseTimeToMinutes = (timeStr: string): number => {
                const parts = timeStr.split(':');
                return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
              };
              
              const requestedMinutes = parseTimeToMinutes(appointmentTime);
              const startMinutes = parseTimeToMinutes(daySettings.start || "09:00");
              const endMinutes = parseTimeToMinutes(daySettings.end || "17:00");
              const duration = (params.duration as number) || 30;
              const appointmentEndMinutes = requestedMinutes + duration;
              
              if (requestedMinutes < startMinutes || appointmentEndMinutes > endMinutes) {
                const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                console.log(`[Appointment Tool] Rejected: ${appointmentTime} is outside working hours`);
                return {
                  success: false,
                  message: `${appointmentTime} is outside our available hours on ${capitalizedDay}. We're available from ${daySettings.start} to ${daySettings.end}.`
                };
              }
            } catch (e) {
              console.log(`[Appointment Tool] Time validation error, allowing booking`);
            }
          }
          
          // Check for duplicate booking from same call (prevents double-booking during same conversation)
          if (callId) {
            const duplicateFromCall = await db
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.callId, callId),
                  eq(appointments.appointmentDate, params.appointmentDate as string),
                  eq(appointments.status, 'scheduled')
                )
              );
            
            if (duplicateFromCall.length > 0) {
              console.log(`[Appointment Tool] Duplicate booking attempt from same call ${callId}`);
              return {
                success: true,
                appointmentId: duplicateFromCall[0].id,
                message: `Your appointment is already confirmed for ${params.appointmentDate} at ${duplicateFromCall[0].appointmentTime}.`,
                alreadyBooked: true
              };
            }
          }

          // Check for duplicate booking by same contact phone on same date/time
          const duplicateByContact = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.userId, userId),
                eq(appointments.contactPhone, params.contactPhone as string),
                eq(appointments.appointmentDate, params.appointmentDate as string),
                eq(appointments.appointmentTime, params.appointmentTime as string),
                eq(appointments.status, 'scheduled')
              )
            );
          
          if (duplicateByContact.length > 0) {
            console.log(`[Appointment Tool] Duplicate booking attempt by same contact`);
            return {
              success: true,
              appointmentId: duplicateByContact[0].id,
              message: `You already have an appointment at this time. Your appointment is confirmed for ${params.appointmentDate} at ${params.appointmentTime}.`,
              alreadyBooked: true
            };
          }

          // Check for overlapping appointments if not allowed
          if (settings && !settings.allowOverlapping) {
            const existing = await db
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.userId, userId),
                  eq(appointments.appointmentDate, params.appointmentDate as string),
                  eq(appointments.appointmentTime, params.appointmentTime as string),
                  eq(appointments.status, 'scheduled')
                )
              );
            
            if (existing.length > 0) {
              console.log(`[Appointment Tool] Slot conflict at ${params.appointmentDate} ${params.appointmentTime}`);
              return {
                success: false,
                message: `That time slot is already booked. Please choose a different time.`
              };
            }
          }
          
          const appointmentId = nanoid();
          const [newAppointment] = await db
            .insert(appointments)
            .values({
              id: appointmentId,
              userId,
              callId: callId || null,
              flowId: agent?.flowId || null,
              contactName: params.contactName as string,
              contactPhone: params.contactPhone as string,
              contactEmail: (params.contactEmail as string) || null,
              appointmentDate: params.appointmentDate as string,
              appointmentTime: params.appointmentTime as string,
              duration: (params.duration as number) || 30,
              serviceName: (params.serviceName as string) || null,
              notes: (params.notes as string) || null,
              status: 'scheduled',
              metadata: { source: 'openai-agent', agentId },
            })
            .returning();
          
          console.log(`[Appointment Tool] Created appointment ${appointmentId}`);
          
          return { 
            success: true, 
            appointmentId,
            message: `Appointment booked for ${params.contactName} on ${params.appointmentDate} at ${params.appointmentTime}` 
          };
        } catch (error: any) {
          console.error(`[Appointment Tool] Error:`, error.message, error.stack);
          return { 
            success: false, 
            message: 'Unable to book appointment at this time. Please try again.' 
          };
        }
      },
    };

    return {
      ...config,
      tools: [...(config.tools || []), appointmentTool],
    };
  }

  /**
   * Add form submission tool to agent
   * Submits collected data to form submission table
   */
  static addFormTool(
    config: AgentConfigWithContext, 
    formId: string,
    formName: string,
    formFields: Array<{ id: string; question: string; fieldType: string; isRequired: boolean }>,
    userId: string,
    callId?: string
  ): AgentConfigWithContext {
    // Skip if form tool already exists to prevent duplicates
    // Form tool names can be "submit_form" or "submit_form_node_2" (with node ID suffix)
    if (config.tools?.some(t => t.name.startsWith('submit_form'))) {
      console.log(`[Agent Factory] Form tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Agent Factory] Adding form tool for form ${formId} (${formName})`);

    // Build field descriptions for the tool
    const fieldProperties: Record<string, any> = {
      contactName: {
        type: 'string',
        description: 'Name of the person providing the information'
      },
      contactPhone: {
        type: 'string',
        description: 'Phone number exactly as spoken'
      }
    };
    
    const requiredFields = ['contactName', 'contactPhone'];
    
    for (const field of formFields) {
      const fieldKey = `field_${field.id.replace(/-/g, '_')}`;
      
      switch (field.fieldType) {
        case 'number':
          fieldProperties[fieldKey] = {
            type: 'number',
            description: `Numeric answer to: "${field.question}"`
          };
          break;
        case 'yes_no':
          fieldProperties[fieldKey] = {
            type: 'boolean',
            description: `Yes/No answer to: "${field.question}" (true = yes, false = no)`
          };
          break;
        default:
          fieldProperties[fieldKey] = {
            type: 'string',
            description: `Answer to: "${field.question}"`
          };
      }
      
      if (field.isRequired) {
        requiredFields.push(fieldKey);
      }
    }

    const formTool: AgentTool & { _formId: string; _formName: string; _formFields: typeof formFields } = {
      name: 'submit_form',
      description: `Submit the collected information for "${formName}". Collect all required fields before calling this tool.`,
      parameters: {
        type: 'object',
        properties: fieldProperties,
        required: requiredFields,
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          console.log(`[Form Tool] Submitting to form ${formId}: ${JSON.stringify(params)}`);
          
          // Build responses array in the required format
          const responses: Array<{ fieldId: string; question: string; answer: string }> = [];
          
          for (const field of formFields) {
            const fieldKey = `field_${field.id.replace(/-/g, '_')}`;
            const value = params[fieldKey];
            if (value !== undefined && value !== null) {
              responses.push({
                fieldId: field.id,
                question: field.question,
                answer: String(value),
              });
            }
          }
          
          const submissionId = nanoid();
          const [submission] = await db
            .insert(formSubmissions)
            .values({
              id: submissionId,
              formId,
              callId: callId || null,
              contactName: (params.contactName as string) || null,
              contactPhone: (params.contactPhone as string) || null,
              responses,
            })
            .returning();
          
          console.log(`[Form Tool] Created submission ${submissionId}`);
          
          // Trigger form.submitted webhook event
          try {
            await webhookDeliveryService.triggerEvent(userId, 'form.submitted', {
              submission: {
                id: submissionId,
                formId: formId,
                formName: formName,
                contactName: (params.contactName as string) || null,
                contactPhone: (params.contactPhone as string) || null,
                responses: responses,
                submittedAt: new Date().toISOString(),
              },
              call: {
                id: callId || null,
              },
            });
            console.log(`[Form Tool] Triggered form.submitted webhook event`);
          } catch (webhookError: any) {
            console.error(`[Form Tool] Failed to trigger webhook:`, webhookError.message);
          }
          
          return { 
            success: true, 
            submissionId,
            message: 'Your information has been saved successfully.' 
          };
        } catch (error: any) {
          console.error(`[Form Tool] Error:`, error.message);
          return { 
            success: false, 
            message: 'Unable to save information at this time. Please try again.' 
          };
        }
      },
      // Store for serialization
      _formId: formId,
      _formName: formName,
      _formFields: formFields,
    };

    return {
      ...config,
      tools: [...(config.tools || []), formTool],
    };
  }

  /**
   * Add call transfer tool to agent
   */
  static addTransferTool(
    config: AgentConfigWithContext,
    transferNumber: string,
    transferMessage?: string
  ): AgentConfigWithContext {
    // Skip if transfer tool already exists to prevent duplicates
    if (config.tools?.some(t => t.name === 'transfer_call')) {
      console.log(`[Agent Factory] Transfer tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Agent Factory] Adding transfer tool to ${transferNumber}`);

    const transferTool: AgentTool & { _transferNumber: string } = {
      name: 'transfer_call',
      description: 'Transfer the call to a human representative. IMPORTANT: ONLY use this tool when the caller explicitly asks for a human/representative/agent/real person (e.g. "human agent", "representative", "talk to a person", "موظف", "ممثل خدمة العملاء"). Do NOT use this tool as a default escalation or because something is slow. Before calling this function, say ONE brief line like "Okay — I’ll transfer you now." then immediately call this function.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for the transfer'
          }
        },
        required: ['reason'],
      },
      handler: async (params: Record<string, unknown>) => {
        console.log(`[Transfer Tool] Initiating transfer to ${transferNumber}, reason: ${params.reason || 'none'}`);
        // The actual transfer is handled by the audio bridge
        return { 
          action: 'transfer',
          phoneNumber: transferNumber,
          reason: params.reason as string
        };
      },
      _transferNumber: transferNumber, // Store for serialization
    };

    return {
      ...config,
      tools: [...(config.tools || []), transferTool],
    };
  }

  static addTransferToAgentTool(
    config: AgentConfigWithContext,
    targetAgentId: string,
    transferMessage?: string
  ): AgentConfigWithContext {
    if (config.tools?.some(t => t.name === 'transfer_to_agent')) {
      console.log(`[Agent Factory] Transfer to agent tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Agent Factory] Adding transfer to agent tool for agent ${targetAgentId}`);

    const transferToAgentTool: AgentTool & { _transferAgentId: string } = {
      name: 'transfer_to_agent',
      description: 'Transfer the call to a different AI agent who can better assist the caller. IMPORTANT: Before calling this function, you MUST first say a brief transfer announcement like "Sure, let me connect you with the right specialist" or "One moment, I will transfer you to our specialist". After speaking this announcement, immediately call this function. Use this when the caller needs assistance in a different language or from a specialized department.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for the transfer'
          }
        },
        required: ['reason'],
      },
      handler: async (params: Record<string, unknown>) => {
        console.log(`[Transfer To Agent Tool] Initiating agent transfer to ${targetAgentId}, reason: ${params.reason || 'none'}`);
        return { 
          action: 'transfer_to_agent',
          targetAgentId: targetAgentId,
          reason: params.reason as string
        };
      },
      _transferAgentId: targetAgentId,
    };

    return {
      ...config,
      tools: [...(config.tools || []), transferToAgentTool],
    };
  }

  /**
   * Add end call tool to agent
   */
  static addEndCallTool(config: AgentConfigWithContext): AgentConfigWithContext {
    // Skip if end_call tool already exists to prevent duplicates
    if (config.tools?.some(t => t.name === 'end_call')) {
      console.log(`[Agent Factory] End call tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Agent Factory] Adding end call tool`);

    const endCallTool: AgentTool = {
      name: 'end_call',
      description: 'IMMEDIATELY end the call. You MUST call this function when: (1) the user says "bye", "goodbye", "thank you bye", "have a good day", "that\'s all", "I\'m done", "hang up", or any farewell phrase, (2) the conversation has naturally concluded and all tasks are complete, (3) the user explicitly asks to end the call. DO NOT just say goodbye - you MUST actually call this function to disconnect the call.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for ending the call'
          }
        },
        required: [],
      },
      handler: async (params: Record<string, unknown>) => {
        console.log(`[End Call Tool] Ending call, reason: ${params.reason || 'conversation complete'}`);
        return { 
          action: 'end_call',
          reason: params.reason as string || 'conversation complete'
        };
      },
    };

    return {
      ...config,
      tools: [...(config.tools || []), endCallTool],
    };
  }

  static buildDataSchemaPrompt(dataSchema: DataSchemaField[]): string {
    if (!dataSchema || dataSchema.length === 0) return '';

    const lines: string[] = [
      '',
      '# Required Data to Collect',
      'You must collect the following information during the conversation. Ask about each field naturally as part of the conversation flow.',
      ''
    ];

    for (const field of dataSchema) {
      const typeLabel = field.type === 'yes_no' ? 'Yes/No' : field.type;
      let line = `- **${field.name}** (${typeLabel}): ${field.description}`;
      if (field.required) {
        line += ' — This field is required. Do not end the conversation without collecting it.';
      }
      lines.push(line);
    }

    lines.push('');
    lines.push('When you collect a piece of data, immediately call the update_collected_data tool with the field name and value. Do not wait until the end of the conversation — save each field as soon as it is provided.');
    lines.push('Before ending the call, verify that all required fields have been collected. If any required field is missing, ask for it.');

    return lines.join('\n');
  }

  static addDataCollectionTool(
    config: AgentConfigWithContext,
    dataSchema: DataSchemaField[],
    callId?: string
  ): AgentConfigWithContext {
    if (!dataSchema || dataSchema.length === 0) return config;

    if (config.tools?.some(t => t.name === 'update_collected_data')) {
      console.log(`[Agent Factory] Data collection tool already exists, skipping`);
      return config;
    }

    console.log(`[Agent Factory] Adding data collection tool for ${dataSchema.length} fields`);

    const fieldNames = dataSchema.map(f => f.name);

    const dataCollectionTool: AgentTool = {
      name: 'update_collected_data',
      description: 'Save a piece of structured data collected from the caller. Call this tool each time you gather a data field during the conversation.',
      parameters: {
        type: 'object',
        properties: {
          field_name: {
            type: 'string',
            enum: fieldNames,
            description: 'The name of the data field being collected'
          },
          field_value: {
            type: 'string',
            description: 'The value collected from the caller for this field'
          }
        },
        required: ['field_name', 'field_value'],
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          const fieldName = params.field_name as string;
          const fieldValue = params.field_value as string;

          if (!fieldNames.includes(fieldName)) {
            return { success: false, message: `Unknown field: ${fieldName}` };
          }

          console.log(`[Data Collection Tool] Saving ${fieldName} = "${fieldValue}" for call ${callId || 'unknown'}`);

          if (callId) {
            const updateQuery = sql`
              UPDATE calls
              SET conversation_context = jsonb_set(
                COALESCE(conversation_context, '{"collectedData":{}, "summaryOfDiscussion":"", "lastTopic":"", "pendingQuestions":[]}'),
                '{collectedData,${sql.raw(fieldName)}}',
                ${JSON.stringify(fieldValue)}::jsonb
              )
              WHERE id = ${callId}
            `;
            await db.execute(updateQuery);

            const updateTwilioQuery = sql`
              UPDATE twilio_openai_calls
              SET metadata = jsonb_set(
                COALESCE(metadata, '{}'),
                '{collectedData,${sql.raw(fieldName)}}',
                ${JSON.stringify(fieldValue)}::jsonb
              )
              WHERE twilio_call_sid IN (
                SELECT twilio_sid FROM calls WHERE id = ${callId}
              ) OR id = ${callId}
            `;
            await db.execute(updateTwilioQuery).catch(() => {});
          }

          return {
            success: true,
            message: `Saved ${fieldName}: ${fieldValue}`,
            field_name: fieldName,
            field_value: fieldValue
          };
        } catch (error: any) {
          console.error(`[Data Collection Tool] Error:`, error.message);
          return {
            success: false,
            message: 'Unable to save data at this time.'
          };
        }
      },
    };

    const dataSchemaPrompt = this.buildDataSchemaPrompt(dataSchema);

    return {
      ...config,
      systemPrompt: config.systemPrompt + dataSchemaPrompt,
      tools: [...(config.tools || []), dataCollectionTool],
    };
  }

  static async generateCollectedDataSummary(
    callId: string,
    dataSchema: DataSchemaField[]
  ): Promise<string | null> {
    if (!dataSchema || dataSchema.length === 0) return null;

    try {
      let collectedData: Record<string, string | null> = {};

      const [callRecord] = await db
        .select({ conversationContext: calls.conversationContext })
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (callRecord?.conversationContext?.collectedData) {
        collectedData = callRecord.conversationContext.collectedData;
      }

      if (Object.keys(collectedData).length === 0) {
        const [twilioRecord] = await db
          .select({ metadata: twilioOpenaiCalls.metadata })
          .from(twilioOpenaiCalls)
          .where(eq(twilioOpenaiCalls.id, callId))
          .limit(1);

        const meta = twilioRecord?.metadata as Record<string, unknown> | null;
        if (meta?.collectedData && typeof meta.collectedData === 'object') {
          collectedData = meta.collectedData as Record<string, string | null>;
        }
      }

      const lines: string[] = ['--- STRUCTURED DATA COLLECTED ---'];
      let collectedCount = 0;
      let missingRequired: string[] = [];

      for (const field of dataSchema) {
        const value = collectedData[field.name];
        if (value !== undefined && value !== null) {
          lines.push(`${field.name}: ${value}`);
          collectedCount++;
        } else {
          lines.push(`${field.name}: [NOT COLLECTED]`);
          if (field.required) {
            missingRequired.push(field.name);
          }
        }
      }

      lines.push('');
      lines.push(`Total collected: ${collectedCount}/${dataSchema.length}`);
      if (missingRequired.length > 0) {
        lines.push(`Missing required fields: ${missingRequired.join(', ')}`);
      }
      lines.push('--- END STRUCTURED DATA ---');

      return lines.join('\n');
    } catch (error: any) {
      console.error(`[Data Collection] Error generating summary for call ${callId}:`, error.message);
      return null;
    }
  }

  /**
   * Enable language detection by enhancing the system prompt
   * OpenAI models can naturally detect and respond in multiple languages
   */
  static enableLanguageDetection(config: AgentConfigWithContext): AgentConfigWithContext {
    console.log(`[Agent Factory] Enabling language detection`);

    const languageInstruction = `

LANGUAGE DETECTION: You have automatic language detection enabled. Listen carefully to the language the caller is speaking and ALWAYS respond in the SAME language they use. If they switch languages, you should switch too. Support all major world languages naturally.`;

    return {
      ...config,
      systemPrompt: config.systemPrompt + languageInstruction,
    };
  }

  /**
   * Recursively substitute {{variable}} placeholders in an object with values from params
   */
  private static substituteVariables(
    template: unknown,
    params: Record<string, unknown>
  ): unknown {
    if (typeof template === 'string') {
      let result = template;
      const variablePattern = /\{\{(\w+)\}\}/g;
      let match;
      while ((match = variablePattern.exec(template)) !== null) {
        const varName = match[1];
        const value = params[varName];
        if (value !== undefined) {
          result = result.replace(match[0], String(value));
        }
      }
      return result;
    }
    if (Array.isArray(template)) {
      return template.map(item => this.substituteVariables(item, params));
    }
    if (template !== null && typeof template === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.substituteVariables(value, params);
      }
      return result;
    }
    return template;
  }

  /**
   * Add webhook tool to agent for custom integrations
   */
  static addWebhookTool(
    config: AgentConfigWithContext,
    webhookUrl: string,
    toolName: string,
    description: string,
    parameters: Record<string, any>,
    webhookMethod: string = 'POST',
    payloadTemplate?: Record<string, any>
  ): AgentConfigWithContext {
    console.log(`[Agent Factory] Adding webhook tool: ${toolName} (${webhookMethod})`);
    if (payloadTemplate) {
      console.log(`[Agent Factory] Webhook payload template:`, JSON.stringify(payloadTemplate));
    }

    // Ensure contact_name and contact_phone are always in the parameters so OpenAI collects them
    const enhancedParameters = {
      type: 'object',
      properties: {
        contact_name: {
          type: 'string',
          description: 'Name of the contact (person on the call)'
        },
        contact_phone: {
          type: 'string',
          description: 'Phone number of the contact'
        },
        ...(parameters.properties || {})
      },
      required: ['contact_name', 'contact_phone', ...(parameters.required || [])]
    };

    const webhookTool: AgentTool & { _webhookUrl: string; _webhookMethod: string; _payloadTemplate?: Record<string, any> } = {
      name: toolName,
      description,
      parameters: enhancedParameters,
      handler: async (params: Record<string, unknown>) => {
        try {
          let payload: unknown;
          // Only use payloadTemplate if it has actual content, otherwise use params directly
          if (payloadTemplate && Object.keys(payloadTemplate).length > 0) {
            payload = OpenAIAgentFactory.substituteVariables(payloadTemplate, params);
            console.log(`[Webhook Tool] Substituted payload:`, JSON.stringify(payload));
          } else {
            // Use params directly - this contains the collected conversation data from OpenAI
            payload = params;
            console.log(`[Webhook Tool] Using params as payload:`, JSON.stringify(params));
          }
          
          console.log(`[Webhook Tool] ${webhookMethod} ${webhookUrl} with:`, JSON.stringify(payload));
          
          const fetchOptions: RequestInit = {
            method: webhookMethod,
            headers: { 'Content-Type': 'application/json' },
          };
          
          if (['POST', 'PUT', 'PATCH'].includes(webhookMethod.toUpperCase())) {
            fetchOptions.body = JSON.stringify(payload);
          }
          
          const response = await fetch(webhookUrl, fetchOptions);
          
          if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`[Webhook Tool] Response:`, data);
          return data;
        } catch (error: any) {
          console.error(`[Webhook Tool] Error:`, error.message);
          return { success: false, error: error.message };
        }
      },
      _webhookUrl: webhookUrl,
      _webhookMethod: webhookMethod,
      _payloadTemplate: payloadTemplate,
    };

    return {
      ...config,
      tools: [...(config.tools || []), webhookTool],
    };
  }

  /**
   * Add API call tool to agent for external HTTP requests
   */
  static addApiCallTool(
    config: AgentConfigWithContext,
    nodeId: string,
    apiConfig: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      bodyTemplate?: string;
      responseMapping?: Record<string, string>;
      description?: string;
    }
  ): AgentConfigWithContext {
    const toolName = `api_call_${nodeId.replace(/-/g, '_').substring(0, 8)}`;
    console.log(`[Agent Factory] Adding API call tool: ${toolName} -> ${apiConfig.url}`);

    const apiTool: AgentTool & { 
      _webhookUrl: string; 
      _webhookMethod: string; 
      _webhookHeaders?: Record<string, string>;
      _bodyTemplate?: string;
      _responseMapping?: Record<string, string>;
    } = {
      name: toolName,
      description: apiConfig.description || `Make an API request to ${apiConfig.url}`,
      parameters: {
        type: 'object',
        properties: {
          queryParams: {
            type: 'object',
            description: 'Optional query parameters to include in the request',
          },
          bodyData: {
            type: 'object',
            description: 'Optional body data for POST/PUT requests',
          },
        },
        required: [],
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          const method = apiConfig.method || 'GET';
          let url = apiConfig.url;
          
          // Add query params if provided
          if (params.queryParams && typeof params.queryParams === 'object') {
            const queryString = new URLSearchParams(
              params.queryParams as Record<string, string>
            ).toString();
            url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
          }

          console.log(`[API Call Tool] ${method} ${url}`);

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(apiConfig.headers || {}),
          };

          const fetchOptions: RequestInit = {
            method,
            headers,
          };

          // Add body for POST/PUT/PATCH
          if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            let body: any;
            if (apiConfig.bodyTemplate) {
              // Use template, substituting variables
              body = apiConfig.bodyTemplate;
              if (params.bodyData && typeof params.bodyData === 'object') {
                for (const [key, value] of Object.entries(params.bodyData)) {
                  body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                }
              }
              body = JSON.parse(body);
            } else {
              body = params.bodyData || {};
            }
            fetchOptions.body = JSON.stringify(body);
          }

          const response = await fetch(url, fetchOptions);
          
          if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          let data: any;
          
          if (contentType?.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          console.log(`[API Call Tool] Response received`);

          // Apply response mapping if configured
          if (apiConfig.responseMapping && typeof data === 'object') {
            const mapped: Record<string, unknown> = {};
            for (const [outputKey, jsonPath] of Object.entries(apiConfig.responseMapping)) {
              mapped[outputKey] = this.getNestedValue(data, jsonPath);
            }
            return { success: true, data: mapped };
          }

          return { success: true, data };
        } catch (error: any) {
          console.error(`[API Call Tool] Error:`, error.message);
          return { success: false, error: error.message };
        }
      },
      // Store config for serialization
      _webhookUrl: apiConfig.url,
      _webhookMethod: apiConfig.method || 'GET',
      _webhookHeaders: apiConfig.headers,
      _bodyTemplate: apiConfig.bodyTemplate,
      _responseMapping: apiConfig.responseMapping,
    };

    return {
      ...config,
      tools: [...(config.tools || []), apiTool],
    };
  }

  /**
   * Helper to get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Add custom tool from flow node
   */
  static addCustomTool(
    config: AgentConfigWithContext,
    toolConfig: {
      name: string;
      description: string;
      parameters: Record<string, any>;
      action: 'log' | 'store' | 'webhook';
      webhookUrl?: string;
    }
  ): AgentConfigWithContext {
    console.log(`[Agent Factory] Adding custom tool: ${toolConfig.name}`);

    const customTool: AgentTool = {
      name: toolConfig.name,
      description: toolConfig.description,
      parameters: toolConfig.parameters,
      handler: async (params: Record<string, unknown>) => {
        console.log(`[Custom Tool ${toolConfig.name}] Params:`, params);

        switch (toolConfig.action) {
          case 'log':
            console.log(`[Custom Tool ${toolConfig.name}] Logged:`, params);
            return { success: true, message: 'Data logged successfully' };

          case 'store':
            // Store in metadata/context for later use
            return { success: true, stored: params };

          case 'webhook':
            if (toolConfig.webhookUrl) {
              try {
                const response = await fetch(toolConfig.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(params),
                });
                if (!response.ok) {
                  throw new Error(`Webhook returned ${response.status}`);
                }
                return await response.json();
              } catch (error: any) {
                return { success: false, error: error.message };
              }
            }
            return { success: false, error: 'No webhook URL configured' };

          default:
            return { success: true, data: params };
        }
      },
    };

    return {
      ...config,
      tools: [...(config.tools || []), customTool],
    };
  }

  /**
   * Get the actual node type from node.data.type or node.data.config.type
   * Flow builder uses type: "custom" at top level, real type is in data
   */
  private static getNodeType(node: FlowNode): string {
    const data = node.data || {};
    return (data.type as string) || (data.config as any)?.type || node.type || 'unknown';
  }

  /**
   * Get node content (message, question, etc.) from the correct location
   */
  private static getNodeContent(node: FlowNode, field: string): string {
    const data = node.data || {};
    const config = (data.config as any) || {};
    return config[field] || (data as any)[field] || '';
  }

  /**
   * Get node data (any type) from the correct location
   */
  private static getNodeData<T>(node: FlowNode, field: string, defaultValue?: T): T | undefined {
    const data = node.data || {};
    const config = (data.config as any) || {};
    const value = config[field] ?? (data as any)[field];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Compile a Flow Builder flow into agent configuration
   * Converts visual flow nodes into system prompt instructions and tools
   */
  static async compileFlow(
    flowConfig: CompiledFlowConfig,
    params: {
      voice: OpenAIVoice;
      model: OpenAIRealtimeModel;
      userId: string;
      agentId: string;
      callId?: string;
      temperature?: number;
      language?: string;
      vadSettings?: {
        threshold?: number;
        prefixPaddingMs?: number;
        silenceDurationMs?: number;
      };
    }
  ): Promise<AgentConfigWithContext> {
    console.log(`[Agent Factory] Compiling flow with ${flowConfig.nodes.length} nodes, language: ${params.language || 'en'}`);
    
    const { nodes, edges, variables } = flowConfig;
    
    // Build system prompt from flow structure with language
    let systemPrompt = this.buildFlowSystemPrompt(nodes, edges, variables, params.language || 'en');

    const now = new Date();
    const hr = now.getHours();
    const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
    const timeContext = `CURRENT TIME CONTEXT: It is currently ${tod} (${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}). When greeting the caller, use the appropriate time-based greeting (e.g. "Good ${tod}").

GREETING RULES: Your opening greeting must ONLY include the time-based greeting, the company name (if known), your name (if known), and ask how you can help. NEVER mention any products, plans, prices, or offers in the greeting. Do NOT search the knowledge base until the caller states their needs.`;
    systemPrompt = `${timeContext}\n\n${systemPrompt}`;
    
    // Find first message from start node
    let firstMessage: string | undefined;
    const startNode = nodes.find(n => this.getNodeType(n) === 'start' || this.getNodeType(n) === 'message');
    if (startNode) {
      const msg = this.getNodeContent(startNode, 'message');
      if (msg) {
        firstMessage = msg;
      }
    }

    let config: AgentConfigWithContext = {
      voice: params.voice,
      model: params.model,
      systemPrompt,
      firstMessage,
      temperature: params.temperature ?? 0.7,
      vadSettings: params.vadSettings,
      tools: [],
      flowConfig,
      toolContext: {
        userId: params.userId,
        agentId: params.agentId,
        callId: params.callId,
      },
    };

    // Add tools based on flow nodes
    for (const node of nodes) {
      const nodeType = this.getNodeType(node);
      switch (nodeType) {
        case 'transfer': {
          const transferType = this.getNodeContent(node, 'transferType');
          
          if (transferType === 'agent') {
            const transferAgentId = this.getNodeContent(node, 'transferAgentId');
            if (transferAgentId) {
              config = this.addTransferToAgentTool(
                config,
                transferAgentId,
                this.getNodeContent(node, 'message')
              );
            }
          } else {
            // Default: phone transfer (backward compatible)
            const phoneNumber = this.getNodeContent(node, 'phoneNumber');
            if (phoneNumber) {
              config = this.addTransferTool(
                config,
                phoneNumber,
                this.getNodeContent(node, 'message')
              );
            }
          }
          break;
        }
        
        case 'end_call':
          config = this.addEndCallTool(config);
          break;
        
        case 'webhook': {
          const url = this.getNodeContent(node, 'url');
          const toolName = this.getNodeContent(node, 'toolName');
          if (url && toolName) {
            const webhookPayload = this.getNodeData<Record<string, any>>(node, 'payload');
            config = this.addWebhookTool(
              config,
              url,
              toolName,
              this.getNodeContent(node, 'description') || 'Custom webhook action',
              this.getNodeData<Record<string, any>>(node, 'parameters') || { type: 'object', properties: {} },
              this.getNodeContent(node, 'method') || 'POST',
              webhookPayload
            );
          }
          break;
        }

        case 'api_call': {
          const apiUrl = this.getNodeContent(node, 'url');
          if (apiUrl) {
            config = this.addApiCallTool(config, node.id, {
              url: apiUrl,
              method: this.getNodeContent(node, 'method') || 'GET',
              headers: this.getNodeData<Record<string, string>>(node, 'headers') || {},
              bodyTemplate: this.getNodeData<string>(node, 'bodyTemplate'),
              responseMapping: this.getNodeData<Record<string, string>>(node, 'responseMapping'),
              description: this.getNodeContent(node, 'description') || undefined,
            });
          }
          break;
        }

        case 'tool': {
          const customToolName = this.getNodeContent(node, 'toolName');
          if (customToolName) {
            config = this.addCustomTool(config, {
              name: customToolName,
              description: this.getNodeContent(node, 'description') || 'Custom action',
              parameters: this.getNodeData<Record<string, any>>(node, 'parameters') || { type: 'object', properties: {} },
              action: this.getNodeData<'log' | 'store' | 'webhook'>(node, 'action') || 'log',
              webhookUrl: this.getNodeContent(node, 'webhookUrl') || undefined,
            });
          }
          break;
        }
        
        case 'appointment':
          // Add appointment booking tool when flow has appointment nodes
          if (!config.tools?.some(t => t.name === 'book_appointment')) {
            config = this.addAppointmentTool(
              config,
              params.userId,
              params.agentId,
              params.callId
            );
          }
          break;
        
        case 'form': {
          // Add form submission tool when flow has form nodes
          const formId = this.getNodeContent(node, 'formId');
          if (formId) {
            // Fetch form and its fields from database (fields stored in separate formFields table)
            const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
            if (form) {
              // Fetch form fields from the formFields table
              const formFieldRows = await db
                .select()
                .from(formFields)
                .where(eq(formFields.formId, formId))
                .orderBy(formFields.order);
              
              if (formFieldRows.length > 0) {
                const formFieldsData = formFieldRows.map(f => ({
                  id: f.id,
                  question: f.question,
                  fieldType: f.fieldType,
                  isRequired: f.isRequired,
                }));
                config = this.addFormTool(
                  config,
                  formId,
                  form.name || 'Form',
                  formFieldsData,
                  params.userId,
                  params.callId
                );
                console.log(`[Agent Factory] Added form tool for form ${formId} with ${formFieldsData.length} fields`);
              } else {
                console.warn(`[Agent Factory] Form ${formId} has no fields, skipping form tool`);
              }
            }
          }
          break;
        }
      }
    }

    // Always ensure end_call tool is available for flow agents
    const hasEndCallTool = config.tools?.some(t => t.name === 'end_call');
    if (!hasEndCallTool) {
      config = this.addEndCallTool(config);
    }

    return config;
  }

  /**
   * Get human-readable language name from code
   */
  private static getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'pl': 'Polish',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
      'fil': 'Filipino',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu',
      'mr': 'Marathi',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'pa': 'Punjabi',
      'ur': 'Urdu',
      'fa': 'Persian',
      'he': 'Hebrew',
      'uk': 'Ukrainian',
      'cs': 'Czech',
      'ro': 'Romanian',
      'hu': 'Hungarian',
      'el': 'Greek',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
    };
    return languageNames[code] || code.toUpperCase();
  }

  /**
   * Build system prompt from flow nodes
   */
  private static buildFlowSystemPrompt(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: Record<string, unknown>,
    language: string = 'en'
  ): string {
    const languageName = this.getLanguageName(language);
    
    const parts: string[] = [
      `LANGUAGE: Speak in ${languageName}. Match the caller's language naturally.`,
      '',
      'You are an AI assistant following a structured conversation flow.',
      'Guide the conversation through the following steps:',
      ''
    ];

    // Build adjacency map with edge conditions
    const adjacencyMap = new Map<string, Array<{ targetId: string; condition?: string }>>();
    for (const edge of edges) {
      const targets = adjacencyMap.get(edge.source) || [];
      targets.push({ targetId: edge.target, condition: edge.condition });
      adjacencyMap.set(edge.source, targets);
    }

    // Build node lookup
    const nodeMap = new Map<string, FlowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Find start node
    const startNode = nodes.find(n => this.getNodeType(n) === 'start' || !edges.some(e => e.target === n.id));
    if (!startNode) {
      parts.push('Follow the conversation naturally based on user responses.');
      return parts.join('\n');
    }

    // Traverse flow to build instructions with branching
    const visited = new Set<string>();
    const queue: Array<{ node: FlowNode; depth: number }> = [{ node: startNode, depth: 0 }];
    let stepNumber = 1;

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const instruction = this.nodeToInstruction(node, stepNumber, edges, nodeMap);
      if (instruction) {
        const indent = '  '.repeat(depth);
        parts.push(`${indent}${stepNumber}. ${instruction}`);
        stepNumber++;
      }

      // Handle branching for condition nodes
      const nextEdges = adjacencyMap.get(node.id) || [];
      const currentNodeType = this.getNodeType(node);
      
      if (currentNodeType === 'condition' && nextEdges.length > 1) {
        // Add branching instructions
        parts.push('');
        parts.push(`   BRANCHING based on: ${this.getNodeContent(node, 'condition') || 'user response'}`);
        
        for (const nextEdge of nextEdges) {
          const targetNode = nodeMap.get(nextEdge.targetId);
          if (targetNode && !visited.has(targetNode.id)) {
            const conditionLabel = nextEdge.condition || 'default';
            const targetDescription = this.getNodeContent(targetNode, 'message') || this.getNodeContent(targetNode, 'question') || this.getNodeType(targetNode);
            parts.push(`   - If ${conditionLabel}: proceed to step for "${targetDescription}"`);
            queue.push({ node: targetNode, depth: depth + 1 });
          }
        }
        parts.push('');
      } else {
        // Linear flow
        for (const nextEdge of nextEdges) {
          const targetNode = nodeMap.get(nextEdge.targetId);
          if (targetNode && !visited.has(targetNode.id)) {
            queue.push({ node: targetNode, depth });
          }
        }
      }
    }

    // Add variable context if any
    if (Object.keys(variables).length > 0) {
      parts.push('');
      parts.push('Available context variables (use these in your responses):');
      for (const [key, value] of Object.entries(variables)) {
        parts.push(`- {{${key}}}: ${value}`);
      }
    }

    // Add flow behavior instructions
    parts.push('');
    parts.push('IMPORTANT INSTRUCTIONS:');
    parts.push('- Guide the conversation naturally through the flow steps.');
    parts.push('- Wait for user responses before proceeding to the next step.');
    parts.push('- If the user asks something off-topic, answer briefly then guide them back.');
    parts.push('- Use the available tools when the flow requires an action.');
    parts.push('- Be helpful, patient, and maintain a professional tone.');

    return parts.join('\n');
  }

  /**
   * Convert a flow node to an instruction string
   */
  private static nodeToInstruction(
    node: FlowNode, 
    step: number,
    edges: FlowEdge[],
    nodeMap: Map<string, FlowNode>
  ): string | null {
    const nodeType = this.getNodeType(node);
    switch (nodeType) {
      case 'message': {
        const message = this.getNodeContent(node, 'message');
        if (!message) {
          return null;
        }
        return `Say: "${message}"`;
      }
      
      case 'question': {
        const question = this.getNodeContent(node, 'question') || 'What would you like to do?';
        const options = this.getNodeData<string[]>(node, 'options');
        if (options && options.length > 0) {
          return `Ask: "${question}" (Expected answers: ${options.join(', ')})`;
        }
        return `Ask the user: "${question}" and wait for their response.`;
      }
      
      case 'condition': {
        const condition = this.getNodeContent(node, 'condition') || 'based on user response';
        const conditionType = this.getNodeContent(node, 'conditionType') || 'llm';
        if (conditionType === 'exact') {
          return `Check if the user's response matches: "${condition}"`;
        }
        return `Evaluate: ${condition}. Then proceed based on the result.`;
      }
      
      case 'transfer': {
        const transferMsg = this.getNodeContent(node, 'message') || 'Let me connect you with a human agent.';
        return `If transfer is needed, say "${transferMsg}" then use the transfer_call tool.`;
      }
      
      case 'appointment': {
        const serviceName = this.getNodeContent(node, 'serviceName') || 'an appointment';
        return `Collect appointment details for ${serviceName}: ask for name, phone, date, and time. Then use the book_appointment tool.`;
      }
      
      case 'form': {
        const formName = this.getNodeContent(node, 'formName') || 'the form';
        const fields = this.getNodeData<Array<{ question: string }>>(node, 'fields');
        if (fields && fields.length > 0) {
          const questions = fields.map(f => f.question).join('; ');
          return `Collect information for ${formName} by asking: ${questions}. Then use submit_form tool.`;
        }
        return `Collect the required form information for ${formName}, then use submit_form tool.`;
      }
      
      case 'api_call': {
        const desc = this.getNodeContent(node, 'description') || 'external data';
        const toolName = `api_call_${node.id.replace(/-/g, '_').substring(0, 8)}`;
        return `Use the ${toolName} tool to fetch ${desc}. Use the response in your conversation.`;
      }
      
      case 'tool': {
        const customToolName = this.getNodeContent(node, 'toolName') || 'custom_tool';
        const toolDesc = this.getNodeContent(node, 'description') || 'perform an action';
        return `When appropriate, use the ${customToolName} tool to ${toolDesc}.`;
      }
      
      case 'delay': {
        const delaySeconds = this.getNodeData<number>(node, 'seconds') || this.getNodeData<number>(node, 'duration') || 2;
        const delayMessage = this.getNodeContent(node, 'message');
        if (delayMessage) {
          return `WAIT ${delaySeconds} seconds. During this pause, say: "${delayMessage}"`;
        }
        return `WAIT ${delaySeconds} seconds before continuing to the next step. You may say "One moment please..." during the pause.`;
      }
      
      case 'webhook': {
        const webhookToolName = this.getNodeContent(node, 'toolName') || 'webhook';
        return `When appropriate, use the ${webhookToolName} tool to send data externally.`;
      }
      
      case 'end_call': {
        const endMessage = this.getNodeContent(node, 'message') || 'Thank you for calling. Goodbye!';
        return `End the conversation by saying: "${endMessage}" Then use the end_call tool.`;
      }
      
      case 'start': {
        const startMessage = this.getNodeContent(node, 'message');
        if (startMessage) {
          return `Greet the user with: "${startMessage}"`;
        }
        return null;
      }
      
      default:
        return null;
    }
  }

  /**
   * Create a complete agent from database agent record
   */
  static async createFromAgentRecord(
    agent: {
      id: string;
      userId: string;
      type: string;
      systemPrompt: string;
      firstMessage?: string | null;
      openaiVoice?: string | null;
      openaiModel?: string | null;
      temperature?: number | null;
      knowledgeBaseIds?: string[] | null;
      knowledgeBaseOnly?: boolean | null;
      transferEnabled?: boolean | null;
      transferPhoneNumber?: string | null;
      transferAgentId?: string | null;
      transferMessage?: string | null;
      endConversationEnabled?: boolean | null;
      detectLanguageEnabled?: boolean | null;
      flowId?: string | null;
      language?: string | null;
      dataSchema?: DataSchemaField[] | null;
    },
    userTier: 'free' | 'pro',
    callId?: string,
    flowConfig?: CompiledFlowConfig
  ): Promise<AgentConfigWithContext> {
    console.log(`[Agent Factory] Creating agent from record: ${agent.id}, type: ${agent.type}, language: ${agent.language || 'en'}`);

    const voice = this.validateVoice(agent.openaiVoice || 'alloy');
    const model = this.validateModel(agent.openaiModel || 'gpt-4o-mini-realtime-preview', userTier);

    let config: AgentConfigWithContext;

    // Handle flow-based agents
    if (agent.type === 'flow' && flowConfig) {
      config = await this.compileFlow(flowConfig, {
        voice,
        model,
        userId: agent.userId,
        agentId: agent.id,
        callId,
        temperature: agent.temperature ?? 0.7,
        language: agent.language || 'en',
      });
    } else {
      // Natural or incoming agents
      config = this.createAgentConfig({
        voice,
        model,
        systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
        firstMessage: agent.firstMessage || undefined,
        temperature: agent.temperature || 0.7,
        userTier,
        toolContext: {
          userId: agent.userId,
          agentId: agent.id,
          callId,
        },
      });
    }

    // Add knowledge base tool if configured
    if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
      config = this.addKnowledgeBaseTool(config, agent.knowledgeBaseIds, agent.userId, agent.knowledgeBaseOnly ?? undefined);
    }

    // Add transfer tool if enabled
    if (agent.transferEnabled && agent.transferPhoneNumber) {
      config = this.addTransferTool(config, agent.transferPhoneNumber, agent.transferMessage || undefined);
    }

    if (agent.transferEnabled && agent.transferAgentId) {
      config = this.addTransferToAgentTool(config, agent.transferAgentId);
    }

    // Add end call tool if enabled
    if (agent.endConversationEnabled) {
      config = this.addEndCallTool(config);
    }

    // Enable language detection if enabled
    if (agent.detectLanguageEnabled) {
      config = this.enableLanguageDetection(config);
    }

    // Add data collection tool if dataSchema is defined
    if (agent.dataSchema && agent.dataSchema.length > 0) {
      config = this.addDataCollectionTool(config, agent.dataSchema, callId);
    }

    // Add dynamic form tools when no pre-assigned form tool exists
    const hasStaticFormTool = config.tools?.some(t => t.name.startsWith('submit_form'));
    if (!hasStaticFormTool) {
      const dynamicTools = buildDynamicFormTools({
        userId: agent.userId,
        agentId: agent.id,
        callId,
      });
      if (!config.tools) config.tools = [];
      for (const tool of dynamicTools) {
        config.tools.push(tool);
      }
      config.systemPrompt = (config.systemPrompt || '') + DYNAMIC_FORM_PROMPT;
      console.log(`[Agent Factory] Added dynamic form tools (list_available_forms, submit_dynamic_form)`);
    }

    console.log(`[Agent Factory] Created config with ${config.tools?.length || 0} tools`);
    
    return config;
  }
}
