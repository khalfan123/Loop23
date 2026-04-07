'use strict';
/**
 * ============================================================
 * Bedrock Agent Factory
 * 
 * Creates Bedrock+Polly agents with integrated tools:
 * - Configure voice (Polly), model (Bedrock), system prompt
 * - Add tools (KB lookup, appointments, forms, webhooks)
 * - Handle Flow Builder compiled configurations
 * 
 * This factory produces configs for TEXT-BASED Bedrock
 * interaction. The agent config is consumed by an audio bridge
 * that: receives audio from Twilio → transcribes → sends text
 * to Bedrock Claude → gets text response → converts to speech
 * via Polly.
 * ============================================================
 */

import type { 
  PollyVoiceId, 
  BedrockModel, 
  AgentTool, 
  AgentConfig, 
  CompiledFlowConfig,
  FlowNode,
  FlowEdge
} from '../types';
import { POLLY_VOICES, MODEL_TIER_CONFIG } from '../types';
import { RAGKnowledgeService } from '../../../services/rag-knowledge';
import { db } from '../../../db';
import { appointments, appointmentSettings, formSubmissions, agents, forms, formFields, calls, twilioOpenaiCalls } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { webhookDeliveryService } from '../../../services/webhook-delivery';
import { buildDynamicFormTools, DYNAMIC_FORM_PROMPT } from '../../../services/dynamic-form-tools';

export interface ToolContext {
  userId: string;
  agentId: string;
  callId?: string;
}

export interface AgentConfigWithContext extends AgentConfig {
  toolContext?: ToolContext;
}

export class BedrockAgentFactory {
  static getAvailableVoices(): typeof POLLY_VOICES {
    return POLLY_VOICES;
  }

  static getAvailableModels(tier: 'free' | 'pro'): BedrockModel[] {
    return MODEL_TIER_CONFIG[tier].models;
  }

  static validateVoice(voice: string): PollyVoiceId {
    const validVoice = POLLY_VOICES.find(v => v.id === voice);
    if (!validVoice) {
      console.warn(`[Bedrock Agent Factory] Invalid voice "${voice}", falling back to "Joanna"`);
      return 'Joanna';
    }
    return voice as PollyVoiceId;
  }

  static validateModel(model: string, tier: 'free' | 'pro' = 'free'): BedrockModel {
    const allowedModels = this.getAvailableModels(tier);
    if (!allowedModels.includes(model as BedrockModel)) {
      console.warn(`[Bedrock Agent Factory] Model "${model}" not allowed for tier "${tier}", falling back to ${allowedModels[0]}`);
      return allowedModels[0];
    }
    return model as BedrockModel;
  }

  static createAgentConfig(params: {
    voice: string;
    model: BedrockModel;
    systemPrompt: string;
    firstMessage?: string;
    temperature?: number;
    userTier?: 'free' | 'pro';
    toolContext?: ToolContext;
    language?: string;
    ttsProvider?: 'aws_polly' | 'elevenlabs' | 'cartesia';
    elevenLabsVoiceId?: string;
    elevenLabsApiKey?: string;
    agentName?: string;
    behaviorConfig?: Record<string, any>;
    waitingMessages?: string[];
    dataSchema?: Array<{ name: string; type: string; description: string; required?: boolean }>;
  }): AgentConfigWithContext {
    const tier = params.userTier || 'free';
    const voice = (params.ttsProvider === 'elevenlabs' || params.ttsProvider === 'cartesia') ? params.voice : this.validateVoice(params.voice);
    const model = this.validateModel(params.model, tier);
    const language = params.language || 'en';

    console.log(`[Bedrock Agent Factory] Creating config: voice=${voice}, model=${model}, tier=${tier}, language=${language}`);

    let systemPrompt = params.systemPrompt;

    const now = new Date();
    const hr = now.getHours();
    const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';

    const languageName = (language && language !== 'en') ? this.getLanguageName(language) : null;
    const timeGreeting = this.getTimeGreeting(language, tod);

    const naturalPrompt = `CURRENT TIME CONTEXT: It is currently ${tod} (${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}). When greeting the caller, use the appropriate time-based greeting in ${languageName || 'English'} (e.g. "${timeGreeting}").

GREETING RULES: Your opening greeting must ONLY include the time-based greeting in ${languageName || 'English'}, the company name (if known), your name (if known), and ask how you can help — ALL in ${languageName || 'English'}. NEVER mention any products, plans, prices, or offers in the greeting. Do NOT search the knowledge base until the caller states their needs.

You are on a live phone call. Below is your identity — WHO you are, what you know, and how you should behave. Use it as your foundation and answer everything using your intelligence and any knowledge base available to you.

${systemPrompt}

${languageName === 'Arabic' ? `CRITICAL LANGUAGE RULE: You MUST speak ONLY in Gulf Arabic (خليجي) dialect for the ENTIRE conversation. This is NON-NEGOTIABLE.
- Use natural Gulf Arabic as spoken in the UAE — words like "إن شاء الله", "يا هلا", "ما عليك أمر", "أبشر", "تفضل".
- Do NOT use formal Modern Standard Arabic (فصحى). Speak casually and naturally like a real Emirati or Gulf professional would on a phone call.
- NEVER use English words or mix languages. Translate everything into spoken Gulf Arabic.
- If the knowledge base content is in English, translate it into natural Gulf Arabic before speaking.` : languageName ? `CRITICAL LANGUAGE RULE: You MUST speak ONLY in fluent, native ${languageName} for the ENTIRE conversation.
- Every single word must be in ${languageName}. NEVER mix languages.
- If content is in English, translate it into natural ${languageName} before speaking.
- Speak like a native ${languageName} speaker on a phone call.` : 'LANGUAGE: Match the caller\'s language naturally.'}

NUMBER RULES: NEVER say raw digits. Spell out all numbers as words.${languageName === 'Arabic' ? ` Round prices: "مئة وخمسة وثلاثين درهم" not "135.056". Say phone digits separately.` : ` Round prices: "one hundred thirty-five" not "135.06". Say phone digits separately.`} Never say SKU codes aloud.

RESPONSE STYLE: You are a seasoned expert. Answer immediately and directly in 1-2 sentences. No filler, no hesitation. Never reveal you are AI.`;

    systemPrompt = naturalPrompt;

    return {
      voice,
      model,
      systemPrompt,
      firstMessage: params.firstMessage,
      temperature: params.temperature ?? 0.4,
      tools: [],
      toolContext: params.toolContext,
      ttsProvider: params.ttsProvider,
      elevenLabsVoiceId: params.elevenLabsVoiceId,
      elevenLabsApiKey: params.elevenLabsApiKey,
      agentName: params.agentName,
      language,
      behaviorConfig: params.behaviorConfig,
      waitingMessages: params.waitingMessages,
      dataSchema: params.dataSchema,
    };
  }

  static addKnowledgeBaseTool(
    config: AgentConfigWithContext, 
    knowledgeBaseIds: string[],
    userId: string,
    knowledgeBaseOnly?: boolean
  ): AgentConfigWithContext {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      console.log(`[Bedrock Agent Factory] No knowledge bases to add`);
      return config;
    }

    console.log(`[Bedrock Agent Factory] Adding KB tool for ${knowledgeBaseIds.length} knowledge bases`);

    RAGKnowledgeService.processUnchunkedKnowledgeBases(knowledgeBaseIds, userId)
      .catch(err => console.error(`[Bedrock Agent Factory] Background KB processing error:`, err.message));

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
          
          let formattedResponse = RAGKnowledgeService.formatResultsForAgent(results, 1200);

          if (config.dataSchema && config.dataSchema.length > 0) {
            const dataSchemaContext = RAGKnowledgeService.buildDataSchemaContext(config.dataSchema);
            if (dataSchemaContext) {
              formattedResponse += '\n' + dataSchemaContext;
            }
          }

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

  static addBedrockKBTool(
    config: AgentConfigWithContext,
    bedrockKbId: string
  ): AgentConfigWithContext {
    const { bedrockKBService } = require("../../../services/bedrock-knowledge-base.service");

    const bedrockKbTool: AgentTool = {
      name: 'lookup_bedrock_knowledge_base',
      description: 'Search the enhanced multimodal knowledge base for information including text, images, audio, and video content. Use this when the primary knowledge base does not have enough information or when looking for multimedia content.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant information from the multimodal knowledge base.',
          },
        },
        required: ['query'],
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          const query = params.query as string;
          console.log(`[Bedrock KB Tool] Searching: "${query.substring(0, 50)}..."`);

          const results = await bedrockKBService.retrieve(bedrockKbId, query, 5);

          if (results.length === 0) {
            return {
              found: false,
              message: 'No results found in the enhanced knowledge base. Use your existing knowledge to answer.',
            };
          }

          const formattedResults = results
            .map((r: any, i: number) => `[${i + 1}] (Score: ${(r.score * 100).toFixed(0)}%) ${r.text.substring(0, 500)}`)
            .join('\n\n');

          console.log(`[Bedrock KB Tool] Found ${results.length} results`);
          return {
            found: true,
            information: formattedResults,
          };
        } catch (error: any) {
          console.error(`[Bedrock KB Tool] Error:`, error.message);
          return {
            found: false,
            message: 'Could not retrieve from enhanced knowledge base. Use your existing knowledge.',
          };
        }
      },
    };

    const enhancedPrompt = config.systemPrompt + `

ENHANCED MULTIMODAL KNOWLEDGE BASE:
=====================================
You have access to an enhanced knowledge base that contains multimodal content (text, images, audio, video). Use the 'lookup_bedrock_knowledge_base' tool when you need more detailed or multimedia-sourced information. This complements your primary knowledge base tool.`;

    return {
      ...config,
      systemPrompt: enhancedPrompt,
      tools: [...(config.tools || []), bedrockKbTool],
    };
  }

  static addAppointmentTool(
    config: AgentConfigWithContext,
    userId: string,
    agentId: string,
    callId?: string
  ): AgentConfigWithContext {
    if (config.tools?.some(t => t.name === 'book_appointment')) {
      console.log(`[Bedrock Agent Factory] Appointment tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Bedrock Agent Factory] Adding appointment tool for agent ${agentId}`);

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
          
          if (!params.contactName || !params.contactPhone || !params.appointmentDate || !params.appointmentTime) {
            return {
              success: false,
              message: 'Please provide name, phone, date and time for the appointment.'
            };
          }
          
          const [agent] = await db
            .select({ flowId: agents.flowId })
            .from(agents)
            .where(eq(agents.id, agentId))
            .limit(1);
          
          const [settings] = await db
            .select()
            .from(appointmentSettings)
            .where(eq(appointmentSettings.userId, userId));
          
          const defaultWorkingHours: Record<string, { start: string; end: string; enabled: boolean }> = {
            monday: { start: "09:00", end: "17:00", enabled: true },
            tuesday: { start: "09:00", end: "17:00", enabled: true },
            wednesday: { start: "09:00", end: "17:00", enabled: true },
            thursday: { start: "09:00", end: "17:00", enabled: true },
            friday: { start: "09:00", end: "17:00", enabled: true },
            saturday: { start: "09:00", end: "17:00", enabled: false },
            sunday: { start: "09:00", end: "17:00", enabled: false },
          };
          
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
              metadata: { source: 'bedrock-agent', agentId },
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

  static addFormTool(
    config: AgentConfigWithContext, 
    formId: string,
    formName: string,
    formFieldsData: Array<{ id: string; question: string; fieldType: string; isRequired: boolean }>,
    userId: string,
    callId?: string
  ): AgentConfigWithContext {
    if (config.tools?.some(t => t.name.startsWith('submit_form'))) {
      console.log(`[Bedrock Agent Factory] Form tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Bedrock Agent Factory] Adding form tool for form ${formId} (${formName})`);

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
    
    for (const field of formFieldsData) {
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

    const formTool: AgentTool & { _formId: string; _formName: string; _formFields: typeof formFieldsData } = {
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
          
          const responses: Array<{ fieldId: string; question: string; answer: string }> = [];
          
          for (const field of formFieldsData) {
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
      _formId: formId,
      _formName: formName,
      _formFields: formFieldsData,
    };

    return {
      ...config,
      tools: [...(config.tools || []), formTool],
    };
  }

  static addTransferTool(
    config: AgentConfigWithContext,
    transferNumber: string,
    transferMessage?: string
  ): AgentConfigWithContext {
    if (config.tools?.some(t => t.name === 'transfer_call')) {
      console.log(`[Bedrock Agent Factory] Transfer tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Bedrock Agent Factory] Adding transfer tool to ${transferNumber}`);

    const transferTool: AgentTool & { _transferNumber: string } = {
      name: 'transfer_call',
      description: 'Transfer the call to a human agent. IMPORTANT: Before calling this function, you MUST first say a brief transfer announcement like "Sure, let me transfer you to an agent now" or "One moment, I will connect you with a representative". After speaking this announcement, immediately call this function. You MUST call this function when: (1) the user explicitly asks to speak to a human, agent, or real person, (2) the user says "transfer", "connect me", or similar phrases, (3) you cannot help them with their request.',
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
        return { 
          action: 'transfer',
          phoneNumber: transferNumber,
          reason: params.reason as string
        };
      },
      _transferNumber: transferNumber,
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
      console.log(`[Bedrock Agent Factory] Transfer to agent tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Bedrock Agent Factory] Adding transfer to agent tool for agent ${targetAgentId}`);

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

  static addEndCallTool(config: AgentConfigWithContext): AgentConfigWithContext {
    if (config.tools?.some(t => t.name === 'end_call')) {
      console.log(`[Bedrock Agent Factory] End call tool already exists, skipping`);
      return config;
    }
    
    console.log(`[Bedrock Agent Factory] Adding end call tool`);

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

  private static readonly LANGUAGE_SCRIPT_PATTERNS: Record<string, RegExp> = {
    ar: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/,
    zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
    ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    hi: /[\u0900-\u097F]/,
    he: /[\u0590-\u05FF]/,
    th: /[\u0E00-\u0E7F]/,
    ru: /[\u0400-\u04FF]/,
  };

  private static isAlreadyInTargetLanguage(text: string, language: string): boolean {
    const pattern = this.LANGUAGE_SCRIPT_PATTERNS[language];
    if (!pattern) return false;
    const cleanText = text.replace(/[0-9\s\p{P}]/gu, '');
    if (cleanText.length === 0) return false;
    const matches = cleanText.match(new RegExp(pattern.source, 'g'));
    const ratio = (matches?.join('').length || 0) / cleanText.length;
    return ratio > 0.5;
  }

  static async localizeFirstMessage(
    firstMessage: string | undefined | null,
    language: string
  ): Promise<string | undefined> {
    if (!firstMessage || !language || language === 'en') {
      return firstMessage || undefined;
    }

    if (this.isAlreadyInTargetLanguage(firstMessage, language)) {
      console.log(`[Bedrock Agent Factory] First message already in ${language}, skipping translation`);
      return firstMessage;
    }

    const languageName = this.getLanguageName(language);
    console.log(`[Bedrock Agent Factory] Localizing first message to ${languageName} (${language})`);

    try {
      const { awsBedrockService } = await import('../../../services/aws-bedrock');

      const translationPrompt = `Translate the following phone greeting message into ${languageName}. 
Rules:
- Output ONLY the translated text, nothing else
- Keep the same tone and warmth
- Make it sound natural in ${languageName}, not a word-for-word translation
- Do not add quotes or explanations

Message to translate:
${firstMessage}`;

      const response = await awsBedrockService.invoke({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: translationPrompt }],
        systemPrompt: `You are a professional translator. Translate exactly as instructed. Output only the translation.`,
        temperature: 0.3,
        maxTokens: 500,
      });

      const translated = response?.content?.trim();
      if (translated && translated.length > 0) {
        console.log(`[Bedrock Agent Factory] Localized first message: "${translated.substring(0, 80)}..."`);
        return translated;
      }

      return firstMessage;
    } catch (error: any) {
      console.error(`[Bedrock Agent Factory] Failed to localize first message: ${error.message}`);
      return firstMessage;
    }
  }

  static enableLanguageDetection(config: AgentConfigWithContext): AgentConfigWithContext {
    console.log(`[Bedrock Agent Factory] Enabling language detection`);

    const languageInstruction = `

LANGUAGE DETECTION: You have automatic language detection enabled. Listen carefully to the language the caller is speaking and ALWAYS respond in the SAME language they use. If they switch languages, you should switch too. Support all major world languages naturally.`;

    return {
      ...config,
      systemPrompt: config.systemPrompt + languageInstruction,
    };
  }

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

  static addWebhookTool(
    config: AgentConfigWithContext,
    webhookUrl: string,
    toolName: string,
    description: string,
    parameters: Record<string, any>,
    webhookMethod: string = 'POST',
    payloadTemplate?: Record<string, any>
  ): AgentConfigWithContext {
    console.log(`[Bedrock Agent Factory] Adding webhook tool: ${toolName} (${webhookMethod})`);
    if (payloadTemplate) {
      console.log(`[Bedrock Agent Factory] Webhook payload template:`, JSON.stringify(payloadTemplate));
    }

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
          if (payloadTemplate && Object.keys(payloadTemplate).length > 0) {
            payload = BedrockAgentFactory.substituteVariables(payloadTemplate, params);
            console.log(`[Webhook Tool] Substituted payload:`, JSON.stringify(payload));
          } else {
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
    console.log(`[Bedrock Agent Factory] Adding API call tool: ${toolName} -> ${apiConfig.url}`);

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

          if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            let body: any;
            if (apiConfig.bodyTemplate) {
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

  private static getNestedValue(obj: any, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

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
    console.log(`[Bedrock Agent Factory] Adding custom tool: ${toolConfig.name}`);

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

  private static getNodeType(node: FlowNode): string {
    const data = node.data || {};
    return (data.type as string) || (data.config as any)?.type || node.type || 'unknown';
  }

  private static getNodeContent(node: FlowNode, field: string): string {
    const data = node.data || {};
    const config = (data.config as any) || {};
    return config[field] || (data as any)[field] || '';
  }

  private static getNodeData<T>(node: FlowNode, field: string, defaultValue?: T): T | undefined {
    const data = node.data || {};
    const config = (data.config as any) || {};
    const value = config[field] ?? (data as any)[field];
    return value !== undefined ? value : defaultValue;
  }

  static async compileFlow(
    flowConfig: CompiledFlowConfig,
    params: {
      voice: PollyVoiceId;
      model: BedrockModel;
      userId: string;
      agentId: string;
      callId?: string;
      temperature?: number;
      language?: string;
    }
  ): Promise<AgentConfigWithContext> {
    console.log(`[Bedrock Agent Factory] Compiling flow with ${flowConfig.nodes.length} nodes, language: ${params.language || 'en'}`);
    
    const { nodes, edges, variables } = flowConfig;
    
    let systemPrompt = this.buildFlowSystemPrompt(nodes, edges, variables, params.language || 'en');

    const now = new Date();
    const hr = now.getHours();
    const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
    const flowLang = params.language || 'en';
    const flowLangName = this.getLanguageName(flowLang);
    const flowTimeGreeting = this.getTimeGreeting(flowLang, tod);
    const timeContext = `CURRENT TIME CONTEXT: It is currently ${tod} (${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}). When greeting the caller, use the appropriate time-based greeting in ${flowLangName} (e.g. "${flowTimeGreeting}").

GREETING RULES: Your opening greeting must ONLY include the time-based greeting in ${flowLangName}, the company name (if known), your name (if known), and ask how you can help — ALL in ${flowLangName}. NEVER mention any products, plans, prices, or offers in the greeting. Do NOT search the knowledge base until the caller states their needs.

NUMBER PRONUNCIATION RULES (critical for voice calls):
- NEVER write raw digits or decimal numbers. The text-to-speech engine cannot pronounce them naturally.
- Always spell out numbers as spoken words in ${flowLangName}.${flowLang === 'ar' ? `
- Example: Instead of "135.056 درهم", say "مئة وخمسة وثلاثين درهم" (round to the nearest whole number).
- Instead of "14.68 درهم", say "خمسة عشر درهم تقريباً".
- For phone numbers, say each digit separately.
- For SKU codes or reference numbers, spell out each character individually.` : `
- Example: Instead of "135.06", say "one hundred thirty-five".
- Round prices to the nearest whole number when speaking.
- For phone numbers, say each digit separately.`}

RESPONSE STYLE: You are a seasoned expert who knows your field inside out. Answer immediately and decisively — no hesitation, no filler. Give the answer directly, then ask if they need anything else. Keep every response to 1-2 sentences maximum. Be confident and natural like a real professional on a call.`;
    systemPrompt = `${timeContext}\n\n${systemPrompt}`;
    
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
      temperature: params.temperature ?? 0.4,
      tools: [],
      flowConfig,
      toolContext: {
        userId: params.userId,
        agentId: params.agentId,
        callId: params.callId,
      },
    };

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
          const formId = this.getNodeContent(node, 'formId');
          if (formId) {
            const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
            if (form) {
              const formFieldRows = await db
                .select()
                .from(formFields)
                .where(eq(formFields.formId, formId))
                .orderBy(formFields.order);
              
              if (formFieldRows.length > 0) {
                const formFieldsArr = formFieldRows.map(f => ({
                  id: f.id,
                  question: f.question,
                  fieldType: f.fieldType,
                  isRequired: f.isRequired,
                }));
                config = this.addFormTool(
                  config,
                  formId,
                  form.name || 'Form',
                  formFieldsArr,
                  params.userId,
                  params.callId
                );
                console.log(`[Bedrock Agent Factory] Added form tool for form ${formId} with ${formFieldsArr.length} fields`);
              } else {
                console.warn(`[Bedrock Agent Factory] Form ${formId} has no fields, skipping form tool`);
              }
            }
          }
          break;
        }
      }
    }

    const hasEndCallTool = config.tools?.some(t => t.name === 'end_call');
    if (!hasEndCallTool) {
      config = this.addEndCallTool(config);
    }

    return config;
  }

  private static getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'ar': 'Arabic',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'pl': 'Polish',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'cs': 'Czech',
      'ca': 'Catalan',
    };
    return languageNames[code] || code.toUpperCase();
  }

  private static getTimeGreeting(langCode: string, timeOfDay: string): string {
    const greetings: Record<string, Record<string, string>> = {
      ar: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير' },
      hi: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्या' },
      zh: { morning: '早上好', afternoon: '下午好', evening: '晚上好' },
      es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' },
      fr: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir' },
      de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' },
      it: { morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera' },
      pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' },
      ja: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' },
      ko: { morning: '좋은 아침입니다', afternoon: '안녕하세요', evening: '좋은 저녁입니다' },
      tr: { morning: 'Günaydın', afternoon: 'İyi günler', evening: 'İyi akşamlar' },
    };
    const langGreetings = greetings[langCode];
    if (langGreetings && langGreetings[timeOfDay]) {
      return langGreetings[timeOfDay];
    }
    return `Good ${timeOfDay}`;
  }

  private static buildFlowSystemPrompt(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: Record<string, unknown>,
    language: string = 'en'
  ): string {
    const languageName = this.getLanguageName(language);
    
    const parts: string[] = [
      languageName === 'Arabic'
        ? `CRITICAL LANGUAGE RULE: You MUST speak ONLY in Gulf Arabic (خليجي) dialect — natural UAE-style speech. Use words like "يا هلا", "أبشر", "تفضل", "إن شاء الله". Do NOT use formal فصحى. NEVER switch to English.`
        : language !== 'en'
        ? `CRITICAL LANGUAGE RULE: You MUST speak ONLY in ${languageName} for the ENTIRE conversation. NEVER switch to English.`
        : `LANGUAGE: Match the caller's language naturally.`,
      '',
      'You are an AI assistant following a structured conversation flow.',
      'Guide the conversation through the following steps:',
      ''
    ];

    const adjacencyMap = new Map<string, Array<{ targetId: string; condition?: string }>>();
    for (const edge of edges) {
      const targets = adjacencyMap.get(edge.source) || [];
      targets.push({ targetId: edge.target, condition: edge.condition });
      adjacencyMap.set(edge.source, targets);
    }

    const nodeMap = new Map<string, FlowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const startNode = nodes.find(n => this.getNodeType(n) === 'start' || !edges.some(e => e.target === n.id));
    if (!startNode) {
      parts.push('Follow the conversation naturally based on user responses.');
      return parts.join('\n');
    }

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

      const nextEdges = adjacencyMap.get(node.id) || [];
      const currentNodeType = this.getNodeType(node);
      
      if (currentNodeType === 'condition' && nextEdges.length > 1) {
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
        for (const nextEdge of nextEdges) {
          const targetNode = nodeMap.get(nextEdge.targetId);
          if (targetNode && !visited.has(targetNode.id)) {
            queue.push({ node: targetNode, depth });
          }
        }
      }
    }

    if (Object.keys(variables).length > 0) {
      parts.push('');
      parts.push('Available context variables (use these in your responses):');
      for (const [key, value] of Object.entries(variables)) {
        parts.push(`- {{${key}}}: ${value}`);
      }
    }

    parts.push('');
    parts.push('IMPORTANT INSTRUCTIONS:');
    parts.push('- Guide the conversation naturally through the flow steps.');
    parts.push('- Wait for user responses before proceeding to the next step.');
    parts.push('- If the user asks something off-topic, answer briefly then guide them back.');
    parts.push('- Use the available tools when the flow requires an action.');
    parts.push('- Be helpful, patient, and maintain a professional tone.');

    return parts.join('\n');
  }

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
        const fName = this.getNodeContent(node, 'formName') || 'the form';
        const fields = this.getNodeData<Array<{ question: string }>>(node, 'fields');
        if (fields && fields.length > 0) {
          const questions = fields.map(f => f.question).join('; ');
          return `Collect information for ${fName} by asking: ${questions}. Then use submit_form tool.`;
        }
        return `Collect the required form information for ${fName}, then use submit_form tool.`;
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

  static buildDataSchemaPrompt(dataSchema: Array<{ name: string; type: string; description: string; required?: boolean }>): string {
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
    dataSchema: Array<{ name: string; type: string; description: string; required?: boolean }>,
    callId?: string
  ): AgentConfigWithContext {
    if (!dataSchema || dataSchema.length === 0) return config;

    if (config.tools?.some(t => t.name === 'update_collected_data')) {
      return config;
    }

    console.log(`[Bedrock Agent Factory] Adding data collection tool for ${dataSchema.length} fields`);

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

          console.log(`[Bedrock Data Collection] Saving ${fieldName} = "${fieldValue}" for call ${callId || 'unknown'}`);

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
          console.error(`[Bedrock Data Collection] Error:`, error.message);
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
    dataSchema: Array<{ name: string; type: string; description: string; required?: boolean }>
  ): Promise<string | null> {
    if (!dataSchema || dataSchema.length === 0) return null;

    try {
      let collectedData: Record<string, string | null> = {};

      const callResult = await db
        .select({ conversationContext: calls.conversationContext })
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (callResult.length > 0 && callResult[0].conversationContext?.collectedData) {
        collectedData = callResult[0].conversationContext.collectedData;
      }

      if (Object.keys(collectedData).length === 0) {
        const twilioResult = await db
          .select({ metadata: twilioOpenaiCalls.metadata })
          .from(twilioOpenaiCalls)
          .where(eq(twilioOpenaiCalls.id, callId))
          .limit(1);

        if (twilioResult.length > 0) {
          const meta = twilioResult[0].metadata as Record<string, any> | null;
          if (meta?.collectedData) {
            collectedData = meta.collectedData;
          }
        }
      }

      const lines: string[] = ['\n\n--- Structured Data Collection Report ---'];
      let collectedCount = 0;

      for (const field of dataSchema) {
        const value = collectedData[field.name];
        if (value !== undefined && value !== null) {
          lines.push(`✅ ${field.name}: ${value}`);
          collectedCount++;
        } else {
          const label = field.required ? '❌ (REQUIRED)' : '⬜ (optional)';
          lines.push(`${label} ${field.name}: Not collected`);
        }
      }

      lines.push(`Total collected: ${collectedCount}/${dataSchema.length}`);

      return lines.join('\n');
    } catch (error: any) {
      console.error(`[Bedrock Agent Factory] Error generating data summary:`, error.message);
      return null;
    }
  }

  static async createFromAgentRecord(
    agent: {
      id: string;
      userId: string;
      type: string;
      systemPrompt: string;
      firstMessage?: string | null;
      pollyVoice?: string | null;
      bedrockModel?: string | null;
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
      behaviorConfig?: Record<string, any> | null;
      waitingMessages?: string[] | null;
      dataSchema?: Array<{ name: string; type: string; description: string; required?: boolean }> | null;
    },
    userTier: 'free' | 'pro',
    callId?: string,
    flowConfig?: CompiledFlowConfig
  ): Promise<AgentConfigWithContext> {
    console.log(`[Bedrock Agent Factory] Creating agent from record: ${agent.id}, type: ${agent.type}, language: ${agent.language || 'en'}`);

    const voice = this.validateVoice(agent.pollyVoice || 'Joanna');
    const model = this.validateModel(agent.bedrockModel || 'claude-sonnet-4-6', userTier);

    let config: AgentConfigWithContext;

    if (agent.type === 'flow' && flowConfig) {
      config = await this.compileFlow(flowConfig, {
        voice,
        model,
        userId: agent.userId,
        agentId: agent.id,
        callId,
        temperature: agent.temperature ?? 0.4,
        language: agent.language || 'en',
      });
    } else {
      const agentLang = agent.language || 'en';
      const localizedFirst = await this.localizeFirstMessage(agent.firstMessage, agentLang);

      config = this.createAgentConfig({
        voice,
        model,
        systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
        firstMessage: localizedFirst,
        temperature: agent.temperature ?? 0.4,
        userTier,
        language: agentLang,
        toolContext: {
          userId: agent.userId,
          agentId: agent.id,
          callId,
        },
        behaviorConfig: agent.behaviorConfig || undefined,
        waitingMessages: agent.waitingMessages || undefined,
        dataSchema: agent.dataSchema || undefined,
      });
    }

    if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
      config = this.addKnowledgeBaseTool(config, agent.knowledgeBaseIds, agent.userId, agent.knowledgeBaseOnly ?? undefined);
    }

    if (agent.dataSchema && agent.dataSchema.length > 0) {
      config = this.addDataCollectionTool(config, agent.dataSchema, callId);
    }

    if (agent.transferEnabled && agent.transferPhoneNumber) {
      config = this.addTransferTool(config, agent.transferPhoneNumber, agent.transferMessage || undefined);
    }

    if (agent.transferEnabled && agent.transferAgentId) {
      config = this.addTransferToAgentTool(config, agent.transferAgentId);
    }

    if (agent.endConversationEnabled) {
      config = this.addEndCallTool(config);
    }

    if (agent.detectLanguageEnabled) {
      config = this.enableLanguageDetection(config);
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
      console.log(`[Bedrock Agent Factory] Added dynamic form tools (list_available_forms, submit_dynamic_form)`);
    }

    console.log(`[Bedrock Agent Factory] Created config with ${config.tools?.length || 0} tools`);
    
    return config;
  }
}
