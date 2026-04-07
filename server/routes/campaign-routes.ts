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
import { eq, and, inArray } from "drizzle-orm";
import { 
  campaigns, contacts, calls, agents, phoneNumbers, incomingConnections, sipPhoneNumbers, flows, forms, formFields, knowledgeBase, generatedUseCases 
} from "@shared/schema";
import { flowTemplates } from "../services/flow-templates";
import { nanoid } from "nanoid";
import { ElevenLabsService } from "../services/elevenlabs";
import { ElevenLabsPoolService } from "../services/elevenlabs-pool";
import { BatchCallingService } from "../services/batch-calling";
import { PlanLimitExceededError } from "../services/contact-upload-service";

export function createCampaignRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { 
    db, storage, authenticateToken, authenticateHybrid, upload, escapeCSV,
    campaignExecutor, webhookDeliveryService, contactUploadService
  } = ctx;

  // Get all campaigns
  router.get("/api/campaigns", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const allCampaigns = await storage.getUserCampaigns(req.userId!);
      const deletedCampaigns = await storage.getUserDeletedCampaigns(req.userId!);
      
      const activeCount = allCampaigns.length;
      const deletedCount = deletedCampaigns.length;

      const requestsPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
      
      if (requestsPagination) {
        const page = parseInt(req.query.page as string, 10) || 1;
        const pageSize = parseInt(req.query.pageSize as string, 10) || 25;
        const offset = (page - 1) * pageSize;

        const totalItems = allCampaigns.length;
        const totalPages = Math.ceil(totalItems / pageSize);

        const paginatedCampaigns = allCampaigns.slice(offset, offset + pageSize);

        res.json({
          data: paginatedCampaigns,
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages
          }
        });
      } else {
        res.json(allCampaigns);
      }
    } catch (error: any) {
      console.error("Get campaigns error:", error);
      res.status(500).json({ error: "Failed to get campaigns" });
    }
  });

  // Get deleted campaigns
  router.get("/api/campaigns/deleted", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const deletedCampaigns = await storage.getUserDeletedCampaigns(req.userId!);
      res.json(deletedCampaigns);
    } catch (error: any) {
      console.error("Get deleted campaigns error:", error);
      res.status(500).json({ error: "Failed to get deleted campaigns" });
    }
  });

  // Restore a deleted campaign
  router.patch("/api/campaigns/:id/restore", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaignIncludingDeleted(req.params.id);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!campaign.deletedAt) {
        return res.status(400).json({ error: "Campaign is not deleted" });
      }
      
      await storage.restoreCampaign(req.params.id);
      
      const restoredCampaign = await storage.getCampaign(req.params.id);
      res.json(restoredCampaign);
    } catch (error: any) {
      console.error("Restore campaign error:", error);
      res.status(500).json({ error: "Failed to restore campaign" });
    }
  });

  // AI Generate Greeting Message
  router.post("/api/campaigns/generate-greeting", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { callType, campaignName, useCase, useCaseDescription, language, agentName, companyName, contactName, productOrService } = req.body;
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const agentIdentity = agentName || 'the agent';
      let company = companyName || '';
      if (useCase && company) {
        const useCaseLower = useCase.toLowerCase();
        const companyLower = company.toLowerCase();
        if (!useCaseLower.includes(companyLower)) {
          const brandMatch = useCase.match(/(?:for|from|by|at)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)/);
          if (brandMatch) {
            company = brandMatch[1];
          }
        }
      }

      let purposeLine = '';
      if (useCase && useCaseDescription) {
        purposeLine = `USE CASE: "${useCase}" — ${useCaseDescription}. The greeting MUST state this specific purpose of calling.`;
      } else if (productOrService) {
        purposeLine = `The agent is calling about: ${productOrService}. The greeting MUST mention what they're calling about.`;
      } else {
        purposeLine = `This is a general outbound call. The greeting should mention a clear reason for calling.`;
      }

      let personalizationNote = ' Always start with "Hi {{firstName}}" — this placeholder gets replaced with the real name at call time.';

      const langInstruction = language && language !== 'en'
        ? ` Generate the greeting in the language matching the code "${language}" (e.g. es=Spanish, fr=French, de=German, etc.).`
        : '';

      const useCaseExamples: Record<string, string> = {
        'appointment': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. I'm calling to schedule an appointment with you — do you have a quick moment?`,
        'survey': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. We'd love your feedback on a quick survey — do you have a couple of minutes?`,
        'collections': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. I'm calling regarding your account balance — do you have a moment to discuss?`,
        'sales': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. I'm reaching out because we have something that could really benefit you — got a quick minute?`,
        'support': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. I'm following up on your recent request — is now a good time to chat?`,
        'default': `Hi {{firstName}}, this is ${agentIdentity}${company ? ` from ${company}` : ''}. I'm calling about [purpose] — can I have a moment of your time?`,
      };

      let styleExample = useCaseExamples['default'];
      if (useCase) {
        const lcUseCase = useCase.toLowerCase();
        if (lcUseCase.includes('appointment') || lcUseCase.includes('booking') || lcUseCase.includes('schedule')) {
          styleExample = useCaseExamples['appointment'];
        } else if (lcUseCase.includes('survey') || lcUseCase.includes('feedback') || lcUseCase.includes('nps')) {
          styleExample = useCaseExamples['survey'];
        } else if (lcUseCase.includes('collect') || lcUseCase.includes('payment') || lcUseCase.includes('past due') || lcUseCase.includes('invoice')) {
          styleExample = useCaseExamples['collections'];
        } else if (lcUseCase.includes('lead') || lcUseCase.includes('sales') || lcUseCase.includes('demo') || lcUseCase.includes('upsell') || lcUseCase.includes('offer')) {
          styleExample = useCaseExamples['sales'];
        } else if (lcUseCase.includes('support') || lcUseCase.includes('follow') || lcUseCase.includes('inquiry') || lcUseCase.includes('complaint')) {
          styleExample = useCaseExamples['support'];
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You write the FIRST LINE an outbound AI phone agent says when the person picks up. This is an OUTBOUND call — the agent called THEM, not the other way around.

STRICT RULES:
1. Start with "Hi {{firstName}}" (this is a template variable, use it exactly)
2. Introduce the agent by name${company ? ` and company "${company}"` : ''}
3. State the SPECIFIC REASON for calling based on the use case (e.g. "I'm calling to book an appointment", "I'm calling about your account balance", "I'm calling to share an exciting offer")
4. End with a polite ask for their time (e.g. "can I have a moment?", "do you have a quick minute?", "is now a good time?")
5. Keep it 2-3 sentences MAX — natural and conversational
6. NEVER say "How can I assist you?" or "How can I help?" — YOU called THEM, you know why you're calling
7. NEVER use quotes around the output

Style example for reference: "${styleExample}"${personalizationNote}${langInstruction}

Only output the greeting text. Nothing else.`
          },
          {
            role: "user",
            content: `Generate an outbound calling greeting. Agent name: "${agentIdentity}"${company ? `, Company: "${company}"` : ''}. ${purposeLine}`
          }
        ],
        max_completion_tokens: 150,
      });

      const greeting = response.choices[0]?.message?.content?.trim() || "";
      res.json({ greeting });
    } catch (error: any) {
      console.error("Error generating greeting:", error);
      res.status(500).json({ error: "Failed to generate greeting message" });
    }
  });

  router.post("/api/campaigns/suggest-agent-name", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { useCase, useCaseDescription, voiceName, voiceGender, campaignName, companyName } = req.body;
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const context = [
        useCase ? `Use case: ${useCase}` : '',
        useCaseDescription ? `Description: ${useCaseDescription}` : '',
        voiceName ? `Voice: ${voiceName}` : '',
        voiceGender ? `Voice gender: ${voiceGender}` : '',
        campaignName ? `Campaign: ${campaignName}` : '',
        companyName ? `Company: ${companyName}` : '',
      ].filter(Boolean).join('. ');

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You suggest 3 short, professional AI agent names for an outbound calling agent. Names should be human-like and match the voice gender if provided. Return ONLY a JSON array of 3 strings. Example: ["Sara", "Alex", "Jordan"]. No explanation.`
          },
          {
            role: "user",
            content: context || 'Suggest 3 professional agent names for a general outbound calling agent.'
          }
        ],
        max_completion_tokens: 60,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '[]';
      let suggestions: string[] = [];
      try {
        suggestions = JSON.parse(raw);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch {
        const matches = raw.match(/"([^"]+)"/g);
        suggestions = matches ? matches.map(m => m.replace(/"/g, '')) : [];
      }
      res.json({ suggestions: suggestions.slice(0, 3) });
    } catch (error: any) {
      console.error("Error suggesting agent name:", error);
      res.status(500).json({ error: "Failed to suggest agent names" });
    }
  });

  router.post("/api/campaigns/generate-script", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { campaignType, campaignName, campaignGoal } = req.body;
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: "You are an expert call script writer. Generate 3 different call script suggestions for the given campaign. Each script should be natural, professional, and effective. Output ONLY a JSON array of 3 strings, each being a complete call script. No markdown, no explanation."
          },
          {
            role: "user",
            content: `Generate 3 call script suggestions for a "${campaignType}" campaign${campaignName ? ` named "${campaignName}"` : ''}${campaignGoal ? `. Goal: ${campaignGoal}` : ''}.`
          }
        ],
        max_completion_tokens: 1500,
      });

      const raw = response.choices[0]?.message?.content?.trim() || "[]";
      let suggestions: string[] = [];
      try {
        suggestions = JSON.parse(raw);
      } catch {
        suggestions = [raw];
      }
      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error generating script:", error);
      res.status(500).json({ error: "Failed to generate script suggestions" });
    }
  });

  router.post("/api/campaigns/generate-outbound-content", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const {
        useCase,
        useCaseDescription,
        category,
        agentName,
        companyName,
        language,
        contactSample,
        productOrService,
      } = req.body;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const rawCustomFields = contactSample?.customFields || {};
      const sampleCustomFields: Record<string, string> = {};
      let fieldCount = 0;
      for (const [key, val] of Object.entries(rawCustomFields)) {
        if (fieldCount >= 20) break;
        const strVal = String(val || '').substring(0, 200);
        if (strVal.trim()) {
          sampleCustomFields[key.substring(0, 50)] = strVal;
          fieldCount++;
        }
      }
      const availableVariables: string[] = ['firstName', 'lastName', 'email', 'phone'];
      const knownContactKeys = ['company', 'organization', 'industry', 'city', 'title', 'role', 'department', 'notes', 'language'];
      for (const key of knownContactKeys) {
        if (sampleCustomFields[key]) {
          availableVariables.push(key);
        }
      }
      for (const key of Object.keys(sampleCustomFields)) {
        if (!knownContactKeys.includes(key) && !availableVariables.includes(key)) {
          availableVariables.push(key);
        }
      }

      const variableList = availableVariables.map(v => `{{${v}}}`).join(', ');

      const sampleContext = contactSample ? `
Sample contact data for reference (use to understand available personalization):
- Name: ${contactSample.firstName || 'John'} ${contactSample.lastName || 'Smith'}
- Email: ${contactSample.email || 'N/A'}
${Object.entries(sampleCustomFields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : '';

      const langInstruction = language && language !== 'en'
        ? `Generate ALL content in the language matching code "${language}" (e.g., es=Spanish, fr=French, de=German).`
        : '';

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert outbound sales strategist and call script writer. You create highly personalized, persuasive outbound call content optimized for AI voice agents powered by Claude (via Amazon Bedrock).

Your output must include template variables using double curly braces (e.g., {{firstName}}, {{company}}) that will be dynamically substituted with real contact data at call time.

Available template variables: ${variableList}

RULES:
- Greeting: 1-2 sentences max. Warm, human, conversational. Must include {{firstName}} and the agent's name. If company context is available, weave it in naturally.
- Call Script: A step-by-step conversational playbook (5-8 steps). Each step should be a clear action with example phrasing. Include personalization variables where they add value. Include objection handling. Optimized for the specific use case and industry.
- System Prompt: An identity and behavioral prompt for Claude. Structure it with clear sections. Include the agent's persona, communication style, goal, and rules of engagement. Optimize for natural phone conversation — short responses (1-3 sentences), active listening cues, empathy markers.

Output ONLY valid JSON with this exact structure:
{
  "greeting": "the greeting template",
  "callScript": "the full call script",
  "systemPrompt": "the system prompt"
}

No markdown. No explanation. Only the JSON object. ${langInstruction}`
          },
          {
            role: "user",
            content: `Generate personalized outbound call content for:

USE CASE: ${useCase || 'General Outbound'}${useCaseDescription ? ` — ${useCaseDescription}` : ''}
CATEGORY: ${category || 'General'}
AGENT NAME: ${agentName || 'AI Agent'}
COMPANY: ${(() => { let co = companyName || 'Our Company'; if (useCase && co) { const ucLower = (useCase as string).toLowerCase(); const coLower = co.toLowerCase(); if (!ucLower.includes(coLower)) { const m = (useCase as string).match(/(?:for|from|by|at)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)/); if (m) co = m[1]; } } return co; })()}
${productOrService ? `PRODUCT/SERVICE: ${productOrService}` : ''}
${sampleContext}

Create a greeting template, call script playbook, and system prompt that maximize personalization, contextual relevance, and engagement. The content should feel like a well-prepared sales professional who has researched the prospect before calling.`
          }
        ],
        max_completion_tokens: 2500,
        temperature: 0.8,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      let parsed: { greeting?: string; callScript?: string; systemPrompt?: string } = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        parsed = { greeting: raw, callScript: '', systemPrompt: '' };
      }

      res.json({
        greeting: parsed.greeting || '',
        callScript: parsed.callScript || '',
        systemPrompt: parsed.systemPrompt || '',
        availableVariables,
      });
    } catch (error: any) {
      console.error("Error generating outbound content:", error);
      res.status(500).json({ error: "Failed to generate outbound content" });
    }
  });

  router.post("/api/campaigns/change-tone", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { script, tone } = req.body;
      if (!script || !tone) return res.status(400).json({ error: "Script and tone are required" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: `Rewrite the following call script in a ${tone} tone. Keep the same meaning and structure but adjust the language, word choice, and phrasing to match a ${tone} style. Output ONLY the rewritten script text, nothing else.`
          },
          { role: "user", content: script }
        ],
        max_completion_tokens: 1000,
      });

      const result = response.choices[0]?.message?.content?.trim() || script;
      res.json({ script: result });
    } catch (error: any) {
      console.error("Error changing tone:", error);
      res.status(500).json({ error: "Failed to change script tone" });
    }
  });

  router.post("/api/campaigns/humanize-script", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { script, level } = req.body;
      if (!script || !level) return res.status(400).json({ error: "Script and level are required" });

      const levelInstructions: Record<string, string> = {
        light: "Make very subtle changes - add 1-2 natural filler words, slight pauses, and minor conversational touches while keeping the script mostly intact.",
        moderate: "Add natural speech patterns, conversational transitions, empathetic phrases, and varied sentence structures while maintaining the core message.",
        heavy: "Completely transform into natural human conversation - add fillers, varied pacing, emotional reactions, rhetorical questions, and make it sound like an authentic human conversation.",
      };

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: `Humanize the following call script at a ${level} level. ${levelInstructions[level] || levelInstructions.moderate} Output ONLY the humanized script text, nothing else.`
          },
          { role: "user", content: script }
        ],
        max_completion_tokens: 1000,
      });

      const result = response.choices[0]?.message?.content?.trim() || script;
      res.json({ script: result });
    } catch (error: any) {
      console.error("Error humanizing script:", error);
      res.status(500).json({ error: "Failed to humanize script" });
    }
  });

  router.post("/api/campaigns/generate-form", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { useCase, language } = req.body;
      if (!useCase) return res.status(400).json({ error: "Use case is required" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const langNote = language && language !== 'en'
        ? `Generate field questions in the language matching code "${language}".`
        : '';

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert form designer for AI phone agents. Given a campaign use case, generate the ideal set of form fields that the AI agent should collect during the call. Each field must have: question (what the agent asks), fieldType (one of: text, number, yes_no, multiple_choice, email, phone, date, rating), isRequired (boolean), and options (array of strings, only for multiple_choice). Output ONLY a valid JSON object with this structure:
{
  "formName": "short descriptive name",
  "formDescription": "one sentence description",
  "fields": [
    { "question": "...", "fieldType": "text", "isRequired": true, "options": null },
    ...
  ]
}
Generate 4-8 fields appropriate for the use case. No markdown, no explanation. ${langNote}`
          },
          {
            role: "user",
            content: `Generate form fields for a "${useCase}" calling campaign.`
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      let parsed: any = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(500).json({ error: "Failed to parse generated form" });
      }

      res.json({
        formName: parsed.formName || `${useCase} Form`,
        formDescription: parsed.formDescription || '',
        fields: parsed.fields || [],
      });
    } catch (error: any) {
      console.error("Error generating form:", error);
      res.status(500).json({ error: "Failed to generate form" });
    }
  });

  router.post("/api/campaigns/create-form", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { formName, formDescription, fields } = req.body;
      if (!formName || !fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ error: "Form name and fields are required" });
      }

      const formId = nanoid();
      const now = new Date();
      await db.insert(forms).values({
        id: formId,
        userId: req.userId!,
        name: formName,
        description: formDescription || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        await db.insert(formFields).values({
          id: nanoid(),
          formId,
          question: field.question,
          fieldType: field.fieldType || 'text',
          options: field.options || null,
          isRequired: field.isRequired ?? true,
          order: i,
        });
      }

      res.json({ formId, formName });
    } catch (error: any) {
      console.error("Error creating form:", error);
      res.status(500).json({ error: "Failed to create form" });
    }
  });

  router.post("/api/campaigns/generate-use-case-prompt", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { useCase, agentId, knowledgeBaseIds, formFields: formFieldsList, language } = req.body;
      if (!useCase) return res.status(400).json({ error: "Use case is required" });

      let agentName = 'AI Agent';
      let agentLanguage = 'en';
      let agentPersonality = '';
      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          agentName = agent.name || 'AI Agent';
          agentLanguage = agent.language || 'en';
          if (agent.systemPrompt) {
            agentPersonality = agent.systemPrompt.substring(0, 500);
          }
        }
      }

      let kbContext = '';
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        try {
          const kbRecords = await db.select({ title: knowledgeBase.title, type: knowledgeBase.type })
            .from(knowledgeBase)
            .where(inArray(knowledgeBase.id, knowledgeBaseIds))
            .limit(10);
          if (kbRecords.length > 0) {
            kbContext = `Reference knowledge bases available: ${kbRecords.map(kb => kb.title).join(', ')}.`;
          }
        } catch {}
      }

      let formContext = '';
      if (formFieldsList && formFieldsList.length > 0) {
        formContext = formFieldsList.map((f: any, i: number) => `${i + 1}. "${f.question}" (type: ${f.fieldType}${f.isRequired ? ', REQUIRED' : ', optional'})`).join('\n');
      }

      const isAppointment = useCase.toLowerCase().includes('appointment') || useCase.toLowerCase().includes('booking');

      const langInstruction = (language && language !== 'en') || (agentLanguage && agentLanguage !== 'en')
        ? `\n\nLANGUAGE REQUIREMENT: The agent MUST conduct the entire conversation in the language matching code "${language || agentLanguage}". All greetings, questions, responses, and objection handling must be in this language. Do NOT mix languages.`
        : '';

      const metaPrompt = `You are a world-class prompt engineer specializing in AI phone agents for outbound calling campaigns. Your task is to generate the BEST possible system prompt for an AI agent that will make outbound phone calls for a specific use case.

THE USE CASE: "${useCase}"
AGENT NAME: "${agentName}"
${agentPersonality ? `AGENT'S EXISTING PERSONALITY (incorporate this tone/style):\n${agentPersonality}\n` : ''}
${kbContext ? `${kbContext} The agent has a lookup_knowledge_base tool and should use it for questions outside the primary call objective.\n` : ''}

WHAT YOU MUST GENERATE:
Create a comprehensive system prompt that covers ALL of the following:

1. IDENTITY & OPENING
   - Who the agent is (use their name: "${agentName}")
   - A warm, natural opening approach for this specific "${useCase}" scenario
   - How to establish rapport quickly (this is a cold/outbound call — the person didn't expect it)

2. PRIMARY OBJECTIVE — ${isAppointment ? 'APPOINTMENT BOOKING' : `"${useCase}" DATA COLLECTION`}
${isAppointment ? `   - The agent's #1 goal is to BOOK AN APPOINTMENT
   - Must collect: contact name, preferred date, preferred time, phone number
   - When all details are confirmed, use the book_appointment tool
   - Suggest 2-3 available time slots to make booking easier
   - If the person is hesitant, emphasize the value/benefit of the meeting` : ''}
${formContext ? `   - The agent must collect the following data points during the call using the submit_form tool:
${formContext}
   - Ask ONE question at a time — never batch multiple questions together
   - Use conversational transitions between questions ("Great, and just to make sure I have everything...")
   - If the caller gives a partial answer, probe gently for the complete information
   - When all required fields are collected, use the submit_form tool to save the data` : ''}

3. CONVERSATION FLOW (step-by-step)
   - Step 1: Greet and introduce yourself + purpose of the call (1-2 sentences max)
   - Step 2: Wait for response — if positive, proceed; if hesitant, acknowledge and provide value
   - Step 3: ${isAppointment ? 'Present the appointment opportunity and suggest times' : 'Begin collecting information one question at a time'}
   - Step 4: ${isAppointment ? 'Confirm all details and book the appointment' : 'After collecting all data, summarize what you gathered'}
   - Step 5: Thank them and close the call professionally

4. OBJECTION HANDLING
   - "I'm busy right now" → Offer to call back at a better time or keep it very brief
   - "Not interested" → Acknowledge, briefly mention one key benefit, respect their decision
   - "How did you get my number?" → Be transparent, don't be defensive
   - "Send me an email instead" → Offer to do so, but try to quickly cover the main point first
   - Custom objections specific to "${useCase}" scenarios

5. VOICE & TONE RULES
   - Keep EVERY response to 1-3 sentences MAX. This is a phone call, not an email.
   - Use contractions (I'm, we're, you'll) — sound human, not corporate
   - Never read bullet points or lists aloud
   - Pause naturally — don't rush through the script
   - Match the caller's energy — if they're brief, be brief; if they're chatty, be warmer
   - NEVER repeat the same thing twice. If they didn't hear you, rephrase.
${langInstruction}

OUTPUT RULES:
- Output ONLY the system prompt text. No JSON, no markdown code blocks, no explanations.
- Do NOT start with "You are..." — start with a clear identity statement like "Your name is ${agentName}."
- Make it specific to the "${useCase}" use case — generic prompts are NOT acceptable.
- Include concrete examples of what to say in key moments.`;

      const { AWSBedrockService } = await import("../services/aws-bedrock");
      const bedrockService = new AWSBedrockService();

      let systemPrompt = '';

      if (bedrockService.isConfigured()) {
        try {
          const bedrockResponse = await bedrockService.invoke({
            model: 'claude-sonnet-4-6',
            systemPrompt: metaPrompt,
            messages: [
              { role: 'user', content: `Generate the best possible system prompt for a "${useCase}" outbound calling campaign with agent "${agentName}".` }
            ],
            maxTokens: 2000,
            temperature: 0.6,
          });
          systemPrompt = bedrockResponse.content?.trim() || '';
        } catch (bedrockErr: any) {
          console.error("Bedrock prompt generation failed, falling back to OpenAI:", bedrockErr.message);
        }
      }

      if (!systemPrompt && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: metaPrompt },
            { role: "user", content: `Generate the best possible system prompt for a "${useCase}" outbound calling campaign with agent "${agentName}".` }
          ],
          max_completion_tokens: 2000,
          temperature: 0.6,
        });
        systemPrompt = response.choices[0]?.message?.content?.trim() || '';
      }

      if (!systemPrompt) {
        return res.status(500).json({ error: "Failed to generate prompt. Please ensure AWS Bedrock or OpenAI credentials are configured." });
      }

      res.json({ systemPrompt, isAppointment });
    } catch (error: any) {
      console.error("Error generating use case prompt:", error);
      res.status(500).json({ error: "Failed to generate prompt" });
    }
  });

  router.post("/api/campaigns/import-reference-url", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: "URL is required" });

      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
        }
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254', 'metadata.google.internal'];
        if (blockedHosts.includes(parsedUrl.hostname) || parsedUrl.hostname.startsWith('10.') || parsedUrl.hostname.startsWith('192.168.') || parsedUrl.hostname.startsWith('172.')) {
          return res.status(400).json({ error: "Internal/private URLs are not allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let html: string;
      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Platform-Knowledge-Bot/1.0', 'Accept': 'text/html, */*' },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        html = await resp.text();
      } catch (fetchErr: any) {
        if (fetchErr?.message?.includes('certificate') || fetchErr?.cause?.code?.includes('CERT')) {
          const { execSync } = await import('child_process');
          const safeUrl = url.replace(/["`$\\]/g, '');
          html = execSync(`curl -sSLk --max-time 25 "${safeUrl}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        } else {
          throw fetchErr;
        }
      } finally {
        clearTimeout(timeout);
      }

      let textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      if (textContent.length < 50) {
        return res.status(400).json({ error: "Could not extract meaningful content from the URL" });
      }

      textContent = textContent.substring(0, 500000);

      let pageTitle = '';
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim();

      const kbId = nanoid();
      const domain = new URL(url).hostname;
      await db.insert(knowledgeBase).values({
        id: kbId,
        userId: req.userId!,
        title: pageTitle || `Reference: ${domain}`,
        type: 'url',
        url: url,
        content: textContent,
        createdAt: new Date(),
      });

      try {
        const { RAGKnowledgeService } = await import("../services/rag-knowledge");
        RAGKnowledgeService.processKnowledgeItem(kbId, req.userId!, textContent).catch((err: any) => {
          console.error(`Failed to process KB ${kbId}:`, err.message);
        });
      } catch {}

      res.json({
        knowledgeBaseId: kbId,
        title: pageTitle || `Reference: ${domain}`,
        contentLength: textContent.length,
      });
    } catch (error: any) {
      console.error("Error importing reference URL:", error);
      res.status(500).json({ error: "Failed to import reference URL" });
    }
  });

  router.post("/api/campaigns/test-call", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber, agentId, phoneNumberId, script, telephonyType } = req.body;
      if (!phoneNumber || !agentId) {
        return res.status(400).json({ error: "Phone number and agent are required for test call" });
      }

      const agent = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.userId, req.userId!))).then(r => r[0]);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      let fromNumber: any = null;
      if (telephonyType === 'sip' && phoneNumberId) {
        fromNumber = await db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.id, phoneNumberId), eq(sipPhoneNumbers.userId, req.userId!))).then(r => r[0]);
      } else if (phoneNumberId) {
        fromNumber = await db.select().from(phoneNumbers).where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.userId, req.userId!))).then(r => r[0]);
      }

      res.json({ success: true, message: `Test call initiated to ${phoneNumber}` });
    } catch (error: any) {
      console.error("Error initiating test call:", error);
      res.status(500).json({ error: "Failed to initiate test call" });
    }
  });

  // Create campaign
  router.post("/api/campaigns", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { name, type, goal, script, flowId, agentId, voiceId, phoneNumberId, sipPhoneNumberId, scheduledFor, batchMode, greetingMessage, languageOptions, selectedFormId, knowledgeBaseIds, knowledgeBaseOnly, appointmentBookingEnabled } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
      }

      if (!agentId) {
        return res.status(400).json({ error: "Please select an agent for this campaign" });
      }

      if (flowId && script) {
        return res.status(400).json({ error: "Cannot use both visual flow and custom script. Please choose one." });
      }

      // Validate preset template exists if one is selected (before other validations)
      let presetTemplate = null;
      if (flowId && flowId.startsWith('template-')) {
        presetTemplate = flowTemplates.find((t) => t.id === flowId);
        if (!presetTemplate) {
          return res.status(404).json({ error: "Flow template not found" });
        }
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const plan = await storage.getPlanByName(user.planType || 'free');
      if (!plan) {
        return res.status(500).json({ error: "Plan configuration not found" });
      }

      const existingCampaigns = await storage.getUserCampaigns(req.userId!);
      // Skip limit check if explicitly unlimited (-1 or 999)
      if (plan.maxCampaigns !== -1 && plan.maxCampaigns !== 999 && existingCampaigns.length >= plan.maxCampaigns) {
        return res.status(403).json({ 
          error: `Campaign limit reached. Your ${plan.displayName} allows maximum ${plan.maxCampaigns} campaign(s).`,
          upgradeRequired: true
        });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent || agent.userId !== req.userId) {
        return res.status(403).json({ error: "Invalid agent selection" });
      }

      if (phoneNumberId) {
        const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
        if (!phoneNumber) {
          return res.status(403).json({ error: "Invalid phone number selection" });
        }
        
        const isOwned = phoneNumber.userId === req.userId;
        const isSystemPool = phoneNumber.userId === null && phoneNumber.isSystemPool === true;
        
        if (isSystemPool && user.planType === 'pro') {
          return res.status(403).json({ 
            error: "Pro users cannot use system numbers",
            message: "As a Pro plan user, please purchase your own phone number for campaigns. System pool numbers are only available for Free plan users."
          });
        }
        
        if (!isOwned && !isSystemPool) {
          return res.status(403).json({ error: "Invalid phone number selection" });
        }

        const incomingConnectionCheck = await db
          .select({ id: incomingConnections.id, agentId: incomingConnections.agentId })
          .from(incomingConnections)
          .where(eq(incomingConnections.phoneNumberId, phoneNumberId))
          .limit(1);
        
        if (incomingConnectionCheck.length > 0) {
          const [connectedAgent] = await db
            .select({ name: agents.name })
            .from(agents)
            .where(eq(agents.id, incomingConnectionCheck[0].agentId))
            .limit(1);
          
          return res.status(409).json({ 
            error: "Phone number conflict",
            message: `This phone number is attached to an incoming connection for "${connectedAgent?.name || 'an agent'}". A phone number cannot be used for both outbound campaigns and incoming calls simultaneously. Please either buy a new number for campaigns, or detach this number from the incoming connection first.`,
            conflictType: 'incoming_connection',
            connectedAgentName: connectedAgent?.name
          });
        }
      }

      // Validate SIP phone number if provided
      if (sipPhoneNumberId) {
        const [sipPhoneNumber] = await db
          .select()
          .from(sipPhoneNumbers)
          .where(eq(sipPhoneNumbers.id, sipPhoneNumberId))
          .limit(1);

        if (!sipPhoneNumber) {
          return res.status(404).json({ error: "SIP phone number not found" });
        }

        // Validate ownership
        if (sipPhoneNumber.userId !== req.userId) {
          return res.status(403).json({ error: "You don't have access to this SIP phone number" });
        }

        // Validate engine compatibility with agent
        if (agent.telephonyProvider && sipPhoneNumber.engine !== agent.telephonyProvider) {
          return res.status(400).json({ 
            error: "Engine mismatch",
            message: `The selected SIP phone number uses ${sipPhoneNumber.engine} engine but the agent uses ${agent.telephonyProvider}. Please select a compatible phone number.`
          });
        }
      }

      // Clone preset template after all validations pass (to avoid orphan flows)
      let resolvedFlowId = flowId || null;
      if (presetTemplate) {
        const newFlowId = nanoid();
        const now = new Date();
        const [clonedFlow] = await db
          .insert(flows)
          .values({
            id: newFlowId,
            userId: req.userId!,
            name: `${presetTemplate.name} (Campaign: ${name})`,
            description: presetTemplate.description || null,
            nodes: presetTemplate.nodes,
            edges: presetTemplate.edges,
            isActive: true,
            isTemplate: false,
            createdAt: now,
            updatedAt: now,
          } as typeof flows.$inferInsert)
          .returning();
        
        resolvedFlowId = clonedFlow.id;
        console.log(`[Campaign] Cloned preset template "${presetTemplate.name}" to flow ${resolvedFlowId} for campaign "${name}"`);
      }

      const campaignConfig: Record<string, unknown> = {};
      if (batchMode) {
        if (!['flow_template', 'dynamic_form'].includes(batchMode)) {
          return res.status(400).json({ error: "Invalid batch mode. Must be 'flow_template' or 'dynamic_form'." });
        }
        campaignConfig.batchMode = batchMode;
      }
      if (greetingMessage && typeof greetingMessage === 'string') {
        campaignConfig.greetingMessage = greetingMessage;
      }
      if (script && typeof script === 'string') {
        campaignConfig.callScript = script;
      }
      if (languageOptions && Array.isArray(languageOptions)) {
        campaignConfig.languageOptions = languageOptions.filter((l: unknown) => typeof l === 'string');
      }
      if (selectedFormId && typeof selectedFormId === 'string') {
        const [formRecord] = await db
          .select({ id: forms.id })
          .from(forms)
          .where(and(eq(forms.id, selectedFormId), eq(forms.userId, req.userId!), eq(forms.isActive, true)));
        if (!formRecord) {
          return res.status(400).json({ error: "Selected form not found or is inactive." });
        }
        campaignConfig.selectedFormId = selectedFormId;
      }
      if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds)) {
        campaignConfig.knowledgeBaseIds = knowledgeBaseIds.filter((id: unknown) => typeof id === 'string');
      }
      if (typeof knowledgeBaseOnly === 'boolean') {
        campaignConfig.knowledgeBaseOnly = knowledgeBaseOnly;
      }
      if (typeof appointmentBookingEnabled === 'boolean') {
        campaignConfig.appointmentBookingEnabled = appointmentBookingEnabled;
      }

      const campaign = await storage.createCampaign({
        userId: req.userId!,
        agentId,
        voiceId: voiceId || null,
        phoneNumberId: phoneNumberId || null,
        sipPhoneNumberId: sipPhoneNumberId || null,
        flowId: resolvedFlowId,
        name,
        type,
        goal: goal || null,
        script: script || null,
        status: "pending",
        totalContacts: 0,
        scheduledFor: scheduledFor || null,
        startedAt: null,
        completedAt: null,
        config: Object.keys(campaignConfig).length > 0 ? campaignConfig : null,
      });

      res.json(campaign);
    } catch (error: any) {
      console.error("Create campaign error:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  router.get("/api/campaigns/use-cases", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db.select().from(generatedUseCases).where(eq(generatedUseCases.userId, req.userId!));
      if (existing.length > 0) {
        return res.json(existing);
      }
      res.json([
        { id: "default-appointment", name: "Appointment Booking", description: "Schedule appointments with prospects or customers", category: "appointments" },
        { id: "default-lead", name: "Lead Qualification", description: "Qualify inbound leads and assess buying intent", category: "sales" },
        { id: "default-feedback", name: "Feedback Collection", description: "Gather customer feedback and satisfaction scores", category: "surveys" },
        { id: "default-promotional", name: "Promotional", description: "Promote products, services, or special offers", category: "sales" },
        { id: "default-payment", name: "Payment Reminder", description: "Remind customers about pending or overdue payments", category: "collections" },
        { id: "default-event", name: "Event Promotion", description: "Promote upcoming events and drive registrations", category: "sales" },
        { id: "default-survey", name: "Survey", description: "Conduct structured surveys to collect data", category: "surveys" },
      ]);
    } catch (error: any) {
      console.error("Error fetching use cases:", error);
      res.status(500).json({ error: "Failed to fetch use cases" });
    }
  });

  router.post("/api/campaigns/generate-use-cases", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { goal } = req.body;
      const { generateUseCasesOnDemand } = await import("../services/use-case-generator");
      const useCases = await generateUseCasesOnDemand(req.userId!, goal || undefined);
      res.json(useCases);
    } catch (error: any) {
      console.error("Error generating use cases:", error);
      res.status(500).json({ error: error.message || "Failed to generate use cases" });
    }
  });

  // Get single campaign
  router.get("/api/campaigns/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(campaign);
    } catch (error: any) {
      console.error("Get campaign error:", error);
      res.status(500).json({ error: "Failed to get campaign" });
    }
  });

  // Export campaign data
  router.get("/api/campaigns/:id/export", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const callsList = await storage.getCampaignCalls(campaign.id);
      
      const contactIds = callsList.map(c => c.contactId).filter(Boolean) as string[];
      const uniqueContactIds = Array.from(new Set(contactIds));
      const contactsArray = await Promise.all(
        uniqueContactIds.map(id => storage.getContact(id))
      );
      
      const contactMap = new Map(
        contactsArray.filter(Boolean).map(c => [c!.id, c])
      );
      
      const headers = [
        "Contact Name",
        "Phone Number",
        "Email",
        "Call Status",
        "Lead Classification",
        "Duration (seconds)",
        "Call Started",
        "Call Ended",
        "Transcript",
        "AI Summary",
        "Error Message"
      ];

      const csvRows = [headers.join(",")];

      for (const call of callsList) {
        const contact = call.contactId ? contactMap.get(call.contactId) : undefined;
        const fullName = contact ? `${contact.firstName} ${contact.lastName || ""}`.trim() : "";
        const phone = contact?.phone || "";
        const email = contact?.email || "";
        
        const row = [
          escapeCSV(fullName),
          escapeCSV(phone),
          escapeCSV(email),
          escapeCSV(call.status || ""),
          escapeCSV(call.classification || ""),
          call.duration || 0,
          escapeCSV(call.startedAt ? new Date(call.startedAt).toISOString() : ""),
          escapeCSV(call.endedAt ? new Date(call.endedAt).toISOString() : ""),
          escapeCSV(call.transcript || ""),
          escapeCSV(call.aiSummary || ""),
          ""
        ];
        
        csvRows.push(row.join(","));
      }

      const csv = csvRows.join("\n");
      const filename = `campaign-${campaign.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      console.error("Export campaign error:", error);
      res.status(500).json({ error: "Failed to export campaign" });
    }
  });

  // Update campaign
  router.patch("/api/campaigns/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { agentId, voiceId, phoneNumberId, name, type, goal, script } = req.body;

      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (!agent || agent.userId !== req.userId) {
          return res.status(403).json({ error: "Invalid agent selection" });
        }
      }

      if (phoneNumberId) {
        const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
        if (!phoneNumber || phoneNumber.userId !== req.userId) {
          return res.status(403).json({ error: "Invalid phone number selection" });
        }
      }

      await storage.updateCampaign(req.params.id, req.body);
      const updated = await storage.getCampaign(req.params.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Update campaign error:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  // Delete campaign
  router.delete("/api/campaigns/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      await storage.deleteCampaign(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete campaign error:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Get campaign contacts
  router.get("/api/campaigns/:campaignId/contacts", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const contactsList = await storage.getCampaignContacts(req.params.campaignId);
      res.json(contactsList);
    } catch (error: any) {
      console.error("Get contacts error:", error);
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  router.post("/api/campaigns/:campaignId/contacts/assign", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { contactIds } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "contactIds array is required" });
      }

      const existingContacts = await db
        .select()
        .from(contacts)
        .where(inArray(contacts.id, contactIds));

      const userCampaigns = await storage.getUserCampaigns(req.userId!);
      const userCampaignIds = new Set(userCampaigns.map((c) => c.id));
      const validContacts = existingContacts.filter(
        (c) => c.campaignId && userCampaignIds.has(c.campaignId)
      );

      if (validContacts.length === 0) {
        return res.status(400).json({ error: "No valid contacts found" });
      }

      const newContacts = validContacts.map((c) => ({
        id: nanoid(),
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: "pending" as const,
      }));

      const created = await storage.createContacts(newContacts);

      await db
        .update(campaigns)
        .set({ totalContacts: campaign.totalContacts + created.length })
        .where(eq(campaigns.id, campaignId));

      res.json({ count: created.length, contacts: created });
    } catch (error: any) {
      console.error("Assign contacts error:", error);
      res.status(500).json({ error: "Failed to assign contacts to campaign" });
    }
  });

  // Upload contacts to campaign
  router.post("/api/campaigns/:campaignId/contacts/upload", authenticateToken, upload.single("file"), async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const plan = await storage.getPlanByName(user.planType || 'free');
      if (!plan) {
        return res.status(500).json({ error: "Plan configuration not found" });
      }

      const fileContent = await contactUploadService.readFileContent(req.file);
      const parsedContacts = contactUploadService.parseContactsFromCSV(fileContent, req.params.campaignId);

      contactUploadService.validateContactsAgainstPlanLimit(
        parsedContacts.length,
        campaign.totalContacts,
        plan.maxContactsPerCampaign,
        plan.displayName
      );

      const createdContacts = await contactUploadService.createContactsForCampaign(
        req.params.campaignId,
        parsedContacts,
        campaign.totalContacts
      );

      res.json({ count: createdContacts.length, contacts: createdContacts });
    } catch (error: any) {
      if (error instanceof PlanLimitExceededError) {
        return res.status(403).json({
          error: error.message,
          upgradeRequired: error.upgradeRequired,
          currentContacts: error.currentContacts,
          maxContacts: error.maxContacts
        });
      }
      console.error("Upload contacts error:", error);
      res.status(500).json({ error: "Failed to upload contacts" });
    }
  });

  // Get campaign calls
  router.get("/api/campaigns/:campaignId/calls", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const callsList = await storage.getCampaignCalls(req.params.campaignId);
      res.json(callsList);
    } catch (error: any) {
      console.error("Get campaign calls error:", error);
      res.status(500).json({ error: "Failed to get campaign calls" });
    }
  });

  // Get campaign batch job (campaignId param version)
  router.get("/api/campaigns/:campaignId/batch", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (!campaign.batchJobId) {
        return res.status(404).json({ error: "No batch job associated with this campaign" });
      }

      if (!campaign.agentId) {
        return res.status(400).json({ error: "Campaign has no agent assigned" });
      }

      const agent = await storage.getAgent(campaign.agentId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      const batchJobId = campaign.batchJobId;
      const provider = batchJobId.startsWith('bedrock-polly-') ? 'bedrock-polly'
        : agent.telephonyProvider === 'twilio_openai' ? 'twilio-openai'
        : (agent.telephonyProvider === 'elevenlabs-sip' || agent.telephonyProvider === 'openai-sip') ? 'sip'
        : 'elevenlabs';

      if (provider === 'bedrock-polly' || provider === 'twilio-openai' || provider === 'sip') {
        const completedCalls = campaign.completedCalls || 0;
        const successfulCalls = campaign.successfulCalls || 0;
        const totalContacts = campaign.totalContacts || 0;
        const failedCalls = completedCalls - successfulCalls;
        const progress = totalContacts > 0 ? Math.round((completedCalls / totalContacts) * 100) : 0;
        return res.json({
          batchJob: {
            id: batchJobId,
            status: campaign.batchJobStatus || campaign.status || 'unknown',
            name: campaign.name,
            total_calls_scheduled: totalContacts,
            total_calls_dispatched: completedCalls,
          },
          stats: {
            pending: Math.max(0, totalContacts - completedCalls),
            scheduled: 0,
            dispatched: completedCalls,
            in_progress: campaign.status === 'running' ? Math.max(0, totalContacts - completedCalls) : 0,
            completed: successfulCalls,
            failed: Math.max(0, failedCalls),
            total: totalContacts,
            progress,
          },
          provider,
        });
      }

      const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
      if (!credential) {
        return res.status(500).json({ error: "No credential found for agent" });
      }

      const batchService = new BatchCallingService(credential.apiKey);
      const batchJob = await batchService.getBatch(batchJobId);
      const stats = BatchCallingService.getBatchStats(batchJob);

      res.json({ batchJob, stats, provider });
    } catch (error: any) {
      console.error("Get batch job error:", error);
      res.status(500).json({ error: error.message || "Failed to get batch job status" });
    }
  });

  // Cancel campaign batch job
  router.post("/api/campaigns/:campaignId/batch/cancel", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (!campaign.batchJobId) {
        return res.status(400).json({ error: "No batch job to cancel" });
      }

      if (!campaign.agentId) {
        return res.status(400).json({ error: "Campaign has no agent assigned" });
      }

      const agent = await storage.getAgent(campaign.agentId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
      if (!credential) {
        return res.status(500).json({ error: "No credential found for agent" });
      }

      const batchService = new BatchCallingService(credential.apiKey);
      const result = await batchService.cancelBatch(campaign.batchJobId);

      await storage.updateCampaign(campaign.id, {
        status: 'cancelled',
        batchJobStatus: 'cancelled',
      });

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Cancel batch job error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel batch job" });
    }
  });

  // Retry campaign batch job
  router.post("/api/campaigns/:campaignId/batch/retry", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.campaignId);
      if (!campaign || campaign.userId !== req.userId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (!campaign.batchJobId) {
        return res.status(400).json({ error: "No batch job to retry" });
      }

      if (!campaign.agentId) {
        return res.status(400).json({ error: "Campaign has no agent assigned" });
      }

      const agent = await storage.getAgent(campaign.agentId);
      if (!agent) {
        return res.status(400).json({ error: "Agent not found" });
      }

      const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
      if (!credential) {
        return res.status(500).json({ error: "No credential found for agent" });
      }

      const batchService = new BatchCallingService(credential.apiKey);
      const result = await batchService.retryBatch(campaign.batchJobId);

      await storage.updateCampaign(campaign.id, {
        status: 'in-progress',
        batchJobStatus: 'in_progress',
      });

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Retry batch job error:", error);
      res.status(500).json({ error: error.message || "Failed to retry batch job" });
    }
  });

  // Validate campaign before execution
  router.get("/api/campaigns/:id/validate", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const validation = await campaignExecutor.validateCampaign(id);
      
      res.json({
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        canStart: validation.valid,
      });
    } catch (error: any) {
      console.error("Campaign validation error:", error);
      res.status(500).json({ error: error.message || "Failed to validate campaign" });
    }
  });

  // Execute campaign
  router.post("/api/campaigns/:id/execute", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (campaign.status !== 'pending' && campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        return res.status(400).json({ error: "Campaign is already running or completed" });
      }
      
      if (!campaign.agentId || !campaign.phoneNumberId) {
        return res.status(400).json({ error: "Campaign must have agent and phone number configured" });
      }
      
      const incomingConnectionCheck = await db
        .select({ id: incomingConnections.id, agentId: incomingConnections.agentId })
        .from(incomingConnections)
        .where(eq(incomingConnections.phoneNumberId, campaign.phoneNumberId))
        .limit(1);
      
      if (incomingConnectionCheck.length > 0) {
        const [connectedAgent] = await db
          .select({ name: agents.name })
          .from(agents)
          .where(eq(agents.id, incomingConnectionCheck[0].agentId))
          .limit(1);
        
        return res.status(409).json({
          error: "Phone number conflict",
          message: `This phone number is attached to an incoming agent "${connectedAgent?.name || 'Unknown'}". A phone number can only be used for either incoming calls OR outbound campaigns, not both.`,
          suggestion: "Please either purchase a new phone number for this campaign, or disconnect this number from the incoming agent first.",
          conflictType: "incoming_connection",
          connectedAgentName: connectedAgent?.name
        });
      }
      
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const totalContacts = campaign.totalContacts || 0;
      if (totalContacts === 0) {
        return res.status(400).json({ error: "Campaign has no contacts. Please add contacts before starting." });
      }
      
      const estimatedMinutes = totalContacts * 2;
      const estimatedCredits = estimatedMinutes;
      
      if (user.credits < estimatedCredits) {
        return res.status(402).json({ 
          error: "Insufficient credits",
          message: `You need approximately ${estimatedCredits} credits to run this campaign (${totalContacts} contacts × ~2 min/call). You currently have ${user.credits} credits. Please purchase more credits to continue.`,
          required: estimatedCredits,
          available: user.credits
        });
      }
      
      const campaignConfig = (campaign.config as Record<string, any>) || {};
      const agentUpdates: Record<string, any> = {};
      
      if (campaignConfig.knowledgeBaseIds && Array.isArray(campaignConfig.knowledgeBaseIds) && campaignConfig.knowledgeBaseIds.length > 0) {
        agentUpdates.knowledgeBaseIds = campaignConfig.knowledgeBaseIds;
        agentUpdates.knowledgeBaseOnly = campaignConfig.knowledgeBaseOnly === true;
        console.log(`[Campaign] Will update agent ${campaign.agentId} with ${campaignConfig.knowledgeBaseIds.length} knowledge base(s), knowledgeBaseOnly=${agentUpdates.knowledgeBaseOnly}`);
      }
      
      if (campaignConfig.greetingMessage && typeof campaignConfig.greetingMessage === 'string') {
        agentUpdates.firstMessage = campaignConfig.greetingMessage;
        console.log(`[Campaign] Will update agent ${campaign.agentId} greeting: "${campaignConfig.greetingMessage.substring(0, 50)}..."`);
      }

      if (campaignConfig.callScript && typeof campaignConfig.callScript === 'string') {
        console.log(`[Campaign] Call script stored in campaign config (${campaignConfig.callScript.length} chars) — will be injected at call time per-campaign`);
      }
      
      if (Object.keys(agentUpdates).length > 0) {
        await db
          .update(agents)
          .set(agentUpdates)
          .where(eq(agents.id, campaign.agentId!));
        console.log(`[Campaign] Agent ${campaign.agentId} updated with campaign config`);
      }

      const result = await campaignExecutor.executeCampaign(id);
      
      webhookDeliveryService.triggerEvent(req.userId!, 'campaign.started', {
        campaign: { 
          id: campaign.id, 
          name: campaign.name, 
          type: campaign.type,
          totalContacts: campaign.totalContacts,
          agentId: campaign.agentId,
          phoneNumberId: campaign.phoneNumberId,
        },
        startedAt: new Date().toISOString(),
        totalCallsScheduled: result.batchJob.total_calls_scheduled,
        batchJobId: result.batchJob.id,
      }, id).catch(err => {
        console.error('❌ [Webhook] Error triggering campaign.started event:', err);
      });
      
      res.json({ 
        message: "Campaign started with batch job", 
        campaignId: id,
        batchJobId: result.batchJob.id,
        batchJobStatus: result.batchJob.status,
        totalCallsScheduled: result.batchJob.total_calls_scheduled,
        estimatedCredits,
        availableCredits: user.credits
      });
    } catch (error: any) {
      console.error("Campaign execution error:", error);
      res.status(500).json({ error: error.message || "Failed to execute campaign" });
    }
  });

  // Cancel campaign
  router.post("/api/campaigns/:id/cancel", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!campaign.batchJobId) {
        return res.status(400).json({ error: "Campaign has no active batch job to cancel" });
      }
      
      const batchJob = await campaignExecutor.cancelCampaign(id);
      
      res.json({ 
        message: "Campaign cancelled", 
        campaignId: id,
        batchJob
      });
    } catch (error: any) {
      console.error("Campaign cancel error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel campaign" });
    }
  });

  // Retry campaign
  router.post("/api/campaigns/:id/retry", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!campaign.batchJobId) {
        return res.status(400).json({ error: "Campaign has no batch job to retry" });
      }
      
      const batchJob = await campaignExecutor.retryCampaign(id);
      
      res.json({ 
        message: "Campaign retry started", 
        campaignId: id,
        batchJob
      });
    } catch (error: any) {
      console.error("Campaign retry error:", error);
      res.status(500).json({ error: error.message || "Failed to retry campaign" });
    }
  });

  // Stop campaign (legacy)
  router.post("/api/campaigns/:id/stop", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (campaign.batchJobId) {
        await campaignExecutor.cancelCampaign(id);
      } else {
        await campaignExecutor.stopCampaign(id);
      }
      
      res.json({ message: "Campaign stopped", campaignId: id });
    } catch (error: any) {
      console.error("Campaign stop error:", error);
      res.status(500).json({ error: error.message || "Failed to stop campaign" });
    }
  });

  // Pause campaign
  router.post("/api/campaigns/:id/pause", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (campaign.status !== "running" && campaign.status !== "in-progress" && campaign.status !== "in_progress") {
        return res.status(400).json({ error: "Campaign is not running" });
      }
      
      if (campaign.batchJobId) {
        const batchJob = await campaignExecutor.pauseCampaign(id, 'manual');
        res.json({ 
          message: "Campaign paused", 
          campaignId: id,
          batchJob
        });
      } else {
        await storage.updateCampaign(id, {
          status: "paused",
        });
        
        webhookDeliveryService.triggerEvent(req.userId!, 'campaign.paused', {
          campaign: { 
            id: campaign.id, 
            name: campaign.name,
            type: campaign.type,
            totalContacts: campaign.totalContacts,
            completedCalls: campaign.completedCalls,
            successfulCalls: campaign.successfulCalls,
            failedCalls: campaign.failedCalls,
          },
          pausedAt: new Date().toISOString(),
          reason: 'manual',
        }, id).catch(err => {
          console.error('❌ [Webhook] Error triggering campaign.paused event:', err);
        });
        
        res.json({ message: "Campaign paused", campaignId: id });
      }
    } catch (error: any) {
      console.error("Campaign pause error:", error);
      res.status(500).json({ error: error.message || "Failed to pause campaign" });
    }
  });

  // Resume campaign
  router.post("/api/campaigns/:id/resume", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (campaign.status !== "paused" && campaign.status !== "completed" && campaign.status !== "failed") {
        return res.status(400).json({ error: "Campaign cannot be resumed. Must be paused, completed, or failed." });
      }

      if (campaign.phoneNumberId) {
        const incomingConnectionCheck = await db
          .select({ id: incomingConnections.id, agentId: incomingConnections.agentId })
          .from(incomingConnections)
          .where(eq(incomingConnections.phoneNumberId, campaign.phoneNumberId))
          .limit(1);
        
        if (incomingConnectionCheck.length > 0) {
          const [connectedAgent] = await db
            .select({ name: agents.name })
            .from(agents)
            .where(eq(agents.id, incomingConnectionCheck[0].agentId))
            .limit(1);
          
          return res.status(409).json({
            error: "Phone number conflict",
            message: `This phone number is attached to an incoming agent "${connectedAgent?.name || 'Unknown'}". A phone number can only be used for either incoming calls OR outbound campaigns, not both.`,
            suggestion: "Please either purchase a new phone number for this campaign, or disconnect this number from the incoming agent first.",
            conflictType: "incoming_connection",
            connectedAgentName: connectedAgent?.name
          });
        }
      }
      
      if (campaign.batchJobId) {
        const batchJob = await campaignExecutor.resumeCampaign(id, 'manual');
        res.json({ 
          message: "Campaign resumed", 
          campaignId: id,
          batchJob
        });
      } else {
        await storage.updateCampaign(id, {
          status: "running",
        });
        
        webhookDeliveryService.triggerEvent(req.userId!, 'campaign.started', {
          campaign: { 
            id: campaign.id, 
            name: campaign.name,
            type: campaign.type,
            totalContacts: campaign.totalContacts,
            completedCalls: campaign.completedCalls,
            successfulCalls: campaign.successfulCalls,
            failedCalls: campaign.failedCalls,
          },
          resumedAt: new Date().toISOString(),
          isResume: true,
        }, id).catch(err => {
          console.error('❌ [Webhook] Error triggering campaign.started (resumed) event:', err);
        });
        
        res.json({ message: "Campaign resumed", campaignId: id });
      }
    } catch (error: any) {
      console.error("Campaign resume error:", error);
      res.status(500).json({ error: error.message || "Failed to resume campaign" });
    }
  });

  // Test call for campaign
  router.post("/api/campaigns/:id/test-call", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { phoneNumber } = req.body;

      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (campaign.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      if (!phoneNumber.startsWith('+')) {
        return res.status(400).json({ error: "Phone number must include country code (e.g., +1234567890)" });
      }

      if (!campaign.phoneNumberId) {
        return res.status(400).json({ error: "Campaign must have a phone number configured" });
      }

      const [campaignPhone] = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, campaign.phoneNumberId))
        .limit(1);

      if (!campaignPhone) {
        return res.status(404).json({ error: "Campaign phone number not found" });
      }

      if (!campaignPhone.elevenLabsPhoneNumberId) {
        return res.status(400).json({ error: "Phone number not synced with ElevenLabs. Please sync your phone numbers first." });
      }

      if (!campaign.agentId) {
        return res.status(400).json({ error: "Campaign must have an agent configured" });
      }

      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, campaign.agentId))
        .limit(1);

      if (!agent || !agent.elevenLabsAgentId) {
        return res.status(400).json({ error: "Agent not found or not synced with ElevenLabs" });
      }

      const credential = await ElevenLabsPoolService.getCredentialForAgent(agent.id);
      if (!credential) {
        return res.status(500).json({ error: "No ElevenLabs credential found for agent" });
      }

      console.log(`📞 [Test Call] Initiating test call via ElevenLabs native API`);
      console.log(`   Campaign: ${campaign.name} (${campaign.id})`);
      console.log(`   To: ${phoneNumber}`);
      console.log(`   From: ${campaignPhone.phoneNumber} (ElevenLabs ID: ${campaignPhone.elevenLabsPhoneNumberId})`);
      console.log(`   Agent: ${agent.name} (ElevenLabs ID: ${agent.elevenLabsAgentId})`);
      console.log(`   Credential: ${credential.name}`);

      const [callRecord] = await db
        .insert(calls)
        .values({
          userId: campaign.userId,
          campaignId: campaign.id,
          contactId: null,
          phoneNumber: phoneNumber,
          status: 'initiated',
          callDirection: 'outgoing',
          startedAt: new Date(),
        })
        .returning();

      const elevenLabsSvc = new ElevenLabsService(credential.apiKey);
      
      try {
        const callResult = await elevenLabsSvc.initiateOutboundCall({
          phoneNumberId: campaignPhone.elevenLabsPhoneNumberId,
          toNumber: phoneNumber,
          agentId: agent.elevenLabsAgentId,
          firstMessage: agent.firstMessage || undefined,
        });

        console.log(`✅ [Test Call] ElevenLabs call initiated`);
        console.log(`   Conversation ID: ${callResult.conversation_id}`);
        if (callResult.call_sid) {
          console.log(`   Call SID: ${callResult.call_sid}`);
        }

        await db
          .update(calls)
          .set({ 
            elevenLabsConversationId: callResult.conversation_id,
            twilioSid: callResult.call_sid || null,
            status: 'ringing',
            metadata: {
              initiatedVia: 'elevenlabs_native',
              agentName: agent.name,
              credentialName: credential.name,
              isTestCall: true,
            }
          })
          .where(eq(calls.id, callRecord.id));

        // Trigger call.started webhook event
        try {
          await webhookDeliveryService.triggerEvent(campaign.userId, 'call.started', {
            campaign: { id: campaign.id, name: campaign.name, type: campaign.type },
            contact: { phone: phoneNumber },
            agent: { id: agent.id, name: agent.name },
            call: {
              id: callRecord.id,
              status: 'initiated',
              phoneNumber: phoneNumber,
              startedAt: callRecord.startedAt,
              conversationId: callResult.conversation_id,
              twilioSid: callResult.call_sid,
            }
          }, campaign.id).catch(err => {
            console.error(`Failed to trigger call.started webhook: ${err.message}`);
          });
        } catch (webhookError: any) {
          console.error(`Failed to trigger call.started webhook: ${webhookError.message}`);
        }

        res.json({ 
          success: true, 
          message: "Test call initiated successfully via ElevenLabs",
          callId: callRecord.id,
          conversationId: callResult.conversation_id,
          twilioSid: callResult.call_sid
        });

      } catch (callError: any) {
        console.error(`❌ [Test Call] ElevenLabs call initiation failed:`, callError);
        
        await db
          .update(calls)
          .set({ 
            status: 'failed',
            endedAt: new Date(),
            metadata: { error: `ElevenLabs error: ${callError.message}` }
          })
          .where(eq(calls.id, callRecord.id));
        
        throw new Error(`ElevenLabs call failed: ${callError.message}`);
      }

    } catch (error: any) {
      console.error("Test call error:", error);
      res.status(500).json({ 
        error: "Failed to initiate test call",
        details: error.message 
      });
    }
  });

  return router;
}
