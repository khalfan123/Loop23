import { awsBedrockService, estimateTokenCount } from "./aws-bedrock";

export interface BusinessProfile {
  companyName: string;
  industry: string;
  description: string;
  products: Array<{
    name: string;
    description: string;
    pricing?: string;
    features?: string[];
  }>;
  differentiators: string[];
  targetMarket: string;
  valueProposition: string;
  contactInfo: {
    phones?: string[];
    emails?: string[];
    addresses?: string[];
    businessHours?: string;
    website?: string;
  };
}

export interface SynthesizedFAQ {
  question: string;
  answer: string;
  category: string;
  confidence: number;
}

export interface DecisionTree {
  scenario: string;
  steps: Array<{
    condition: string;
    action: string;
    nextStep?: string;
  }>;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
  category: string;
}

export interface CompetitiveIntelligence {
  positioning: string;
  advantages: string[];
  targetComparison: string;
}

export interface EscalationTrigger {
  trigger: string;
  reason: string;
  suggestedAction: string;
}

export interface SynthesizedKnowledge {
  businessProfile: BusinessProfile;
  faqs: SynthesizedFAQ[];
  decisionTrees: DecisionTree[];
  objectionHandlers: ObjectionHandler[];
  competitiveIntelligence: CompetitiveIntelligence;
  escalationTriggers: EscalationTrigger[];
  sourceUrl: string;
  synthesizedAt: string;
  totalTokensProcessed: number;
  processingMode: string;
}

export interface SynthesisJobProgress {
  stage: string;
  progress: number;
  totalStages: number;
  currentStage: number;
  message: string;
}

type ProgressCallback = (progress: SynthesisJobProgress) => void;

const SYNTHESIS_STAGES = [
  "business_profile",
  "faq_generation",
  "decision_trees",
  "objection_handlers",
  "competitive_intelligence",
  "escalation_triggers",
] as const;

export class KnowledgeSynthesisService {
  private static reportProgress(
    cb: ProgressCallback | undefined,
    stageIndex: number,
    message: string
  ) {
    if (!cb) return;
    cb({
      stage: SYNTHESIS_STAGES[stageIndex],
      progress: Math.round(((stageIndex + 1) / SYNTHESIS_STAGES.length) * 100),
      totalStages: SYNTHESIS_STAGES.length,
      currentStage: stageIndex + 1,
      message,
    });
  }

  static async synthesize(
    rawContent: string,
    sourceUrl: string,
    onProgress?: ProgressCallback
  ): Promise<SynthesizedKnowledge> {
    const contentTokens = estimateTokenCount(rawContent);
    console.log(
      `[KnowledgeSynthesis] Starting synthesis of ~${contentTokens} tokens from ${sourceUrl}`
    );

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let processingMode = "single";

    this.reportProgress(onProgress, 0, "Extracting business profile...");
    const profileResult = await this.extractBusinessProfile(rawContent);
    totalInputTokens += profileResult.inputTokens;
    totalOutputTokens += profileResult.outputTokens;
    if (profileResult.mode === "chunked") processingMode = "chunked";

    this.reportProgress(onProgress, 1, "Generating FAQ database...");
    const faqResult = await this.generateFAQs(rawContent);
    totalInputTokens += faqResult.inputTokens;
    totalOutputTokens += faqResult.outputTokens;

    this.reportProgress(onProgress, 2, "Building decision trees...");
    const dtResult = await this.buildDecisionTrees(rawContent);
    totalInputTokens += dtResult.inputTokens;
    totalOutputTokens += dtResult.outputTokens;

    this.reportProgress(onProgress, 3, "Preparing objection handlers...");
    const ohResult = await this.buildObjectionHandlers(rawContent);
    totalInputTokens += ohResult.inputTokens;
    totalOutputTokens += ohResult.outputTokens;

    this.reportProgress(
      onProgress,
      4,
      "Analyzing competitive positioning..."
    );
    const ciResult = await this.analyzeCompetitiveIntelligence(rawContent);
    totalInputTokens += ciResult.inputTokens;
    totalOutputTokens += ciResult.outputTokens;

    this.reportProgress(onProgress, 5, "Identifying escalation triggers...");
    const etResult = await this.identifyEscalationTriggers(rawContent);
    totalInputTokens += etResult.inputTokens;
    totalOutputTokens += etResult.outputTokens;

    const result: SynthesizedKnowledge = {
      businessProfile: profileResult.data,
      faqs: faqResult.data,
      decisionTrees: dtResult.data,
      objectionHandlers: ohResult.data,
      competitiveIntelligence: ciResult.data,
      escalationTriggers: etResult.data,
      sourceUrl,
      synthesizedAt: new Date().toISOString(),
      totalTokensProcessed: totalInputTokens + totalOutputTokens,
      processingMode,
    };

    console.log(
      `[KnowledgeSynthesis] Synthesis complete. FAQs: ${result.faqs.length}, Decision Trees: ${result.decisionTrees.length}, Objections: ${result.objectionHandlers.length}, Escalations: ${result.escalationTriggers.length}`
    );

    return result;
  }

  private static async extractBusinessProfile(
    content: string
  ): Promise<{
    data: BusinessProfile;
    inputTokens: number;
    outputTokens: number;
    mode: string;
  }> {
    const systemPrompt = `You are a business analyst. Analyze the provided website content and extract a comprehensive business profile. Return ONLY valid JSON with this exact structure:
{
  "companyName": "string",
  "industry": "string",
  "description": "string (2-3 sentences)",
  "products": [{"name":"string","description":"string","pricing":"string or null","features":["string"]}],
  "differentiators": ["string"],
  "targetMarket": "string",
  "valueProposition": "string",
  "contactInfo": {"phones":["string"],"emails":["string"],"addresses":["string"],"businessHours":"string or null","website":"string or null"}
}
Be thorough. Extract ALL products, services, and pricing found. If information is not available, use null or empty arrays.`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-opus-4",
      content,
      systemPrompt,
      maxOutputTokens: 8192,
      temperature: 0.2,
    });

    const data = this.parseJSON<BusinessProfile>(response.content, {
      companyName: "Unknown",
      industry: "Unknown",
      description: "",
      products: [],
      differentiators: [],
      targetMarket: "General",
      valueProposition: "",
      contactInfo: {},
    });

    return {
      data,
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
      mode: response.processingMode,
    };
  }

  private static async generateFAQs(
    content: string
  ): Promise<{
    data: SynthesizedFAQ[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const systemPrompt = `You are a customer service FAQ specialist. Analyze the provided website content and generate 50-100 high-quality Q&A pairs that cover ALL aspects of the business.

Categories to cover:
- Product/Service Information
- Pricing & Plans
- Account Management
- Technical Support
- Billing & Payments
- Shipping & Delivery
- Returns & Refunds
- Security & Privacy
- Getting Started
- Troubleshooting
- Policies
- Contact & Support

Return ONLY a valid JSON array:
[{"question":"string","answer":"string (1-3 sentences, factual, from content only)","category":"string","confidence":0.0-1.0}]

Rules:
- Generate questions a real customer would ask when calling
- Answers must be based ONLY on the provided content
- Set confidence to 0.7-1.0 based on how directly the content supports the answer
- Cover edge cases and follow-up questions
- Avoid duplicate or near-duplicate questions`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-opus-4",
      content,
      systemPrompt,
      maxOutputTokens: 16384,
      temperature: 0.3,
    });

    const data = this.parseJSON<SynthesizedFAQ[]>(response.content, []);

    return {
      data: Array.isArray(data) ? data : [],
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
    };
  }

  private static async buildDecisionTrees(
    content: string
  ): Promise<{
    data: DecisionTree[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const systemPrompt = `You are a customer service workflow designer. Analyze the provided content and create decision trees for common customer scenarios.

Create 5-15 decision trees covering scenarios like:
- New customer onboarding
- Product selection guidance
- Troubleshooting common issues
- Billing inquiries
- Complaint resolution
- Returns/refund process
- Account setup/management
- Upgrade/downgrade paths

Return ONLY valid JSON array:
[{"scenario":"string","steps":[{"condition":"string","action":"string","nextStep":"string or null"}]}]

Each decision tree should have 3-7 steps that guide a customer service agent through the scenario.`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-sonnet-4",
      content,
      systemPrompt,
      maxOutputTokens: 8192,
      temperature: 0.3,
    });

    const data = this.parseJSON<DecisionTree[]>(response.content, []);

    return {
      data: Array.isArray(data) ? data : [],
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
    };
  }

  private static async buildObjectionHandlers(
    content: string
  ): Promise<{
    data: ObjectionHandler[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const systemPrompt = `You are a sales and customer retention specialist. Analyze the provided content and anticipate customer objections, then prepare persuasive yet honest responses.

Categories of objections:
- Price objections ("too expensive", "competitor is cheaper")
- Trust objections ("how do I know it works", "never heard of you")
- Timing objections ("not ready yet", "need to think about it")
- Feature objections ("doesn't have X", "competitor has Y")
- Quality objections ("bad reviews", "doesn't seem reliable")
- Process objections ("too complicated", "takes too long")

Return ONLY valid JSON array with 10-25 objection handlers:
[{"objection":"string (the customer's objection)","response":"string (2-4 sentences, empathetic and factual)","category":"string (price|trust|timing|feature|quality|process)"}]

Responses must be based on actual information from the content. Be empathetic and solution-oriented.`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-sonnet-4",
      content,
      systemPrompt,
      maxOutputTokens: 8192,
      temperature: 0.3,
    });

    const data = this.parseJSON<ObjectionHandler[]>(response.content, []);

    return {
      data: Array.isArray(data) ? data : [],
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
    };
  }

  private static async analyzeCompetitiveIntelligence(
    content: string
  ): Promise<{
    data: CompetitiveIntelligence;
    inputTokens: number;
    outputTokens: number;
  }> {
    const systemPrompt = `You are a competitive intelligence analyst. Analyze the provided content to understand how this business positions itself against alternatives.

Return ONLY valid JSON:
{
  "positioning": "string (2-3 sentences on how the business positions itself)",
  "advantages": ["string (specific advantages mentioned or implied)"],
  "targetComparison": "string (how they compare to alternatives/competitors based on content)"
}

Base your analysis ONLY on information found in the content. If competitive information is limited, note that and focus on the business's self-described strengths.`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-sonnet-4",
      content,
      systemPrompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    const data = this.parseJSON<CompetitiveIntelligence>(response.content, {
      positioning: "No competitive positioning data available.",
      advantages: [],
      targetComparison: "Insufficient data for comparison.",
    });

    return {
      data,
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
    };
  }

  private static async identifyEscalationTriggers(
    content: string
  ): Promise<{
    data: EscalationTrigger[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const systemPrompt = `You are a customer service operations manager. Analyze the provided content and identify situations where an AI agent should escalate to a human agent.

Consider these escalation categories:
- Complex billing disputes or refund requests above a threshold
- Legal or compliance questions
- Technical issues beyond troubleshooting scripts
- Customer expressing extreme frustration or threats
- Requests requiring account-level changes not covered by AI
- Medical, safety, or emergency situations
- Multi-step processes that require human judgment
- Requests for information the AI cannot verify
- Contract negotiations or custom pricing
- Sensitive personal data handling

Return ONLY valid JSON array with 8-20 escalation triggers:
[{"trigger":"string (specific situation description)","reason":"string (why escalation is needed)","suggestedAction":"string (what the AI should say/do before escalating)"}]

Be specific and actionable. Each trigger should be something an AI agent could detect during a conversation.`;

    const response = await awsBedrockService.invokeWithLargeContext({
      model: "claude-sonnet-4",
      content,
      systemPrompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    const data = this.parseJSON<EscalationTrigger[]>(response.content, []);

    return {
      data: Array.isArray(data) ? data : [],
      inputTokens: response.totalInputTokens,
      outputTokens: response.totalOutputTokens,
    };
  }

  private static parseJSON<T>(raw: string, fallback: T): T {
    try {
      const jsonMatch = raw.match(/[\[{][\s\S]*[\]}]/);
      if (!jsonMatch) return fallback;
      return JSON.parse(jsonMatch[0]) as T;
    } catch (e) {
      console.error(
        `[KnowledgeSynthesis] JSON parse error:`,
        (e as Error).message
      );
      return fallback;
    }
  }

  static formatAsRAGContent(knowledge: SynthesizedKnowledge): string {
    const sections: string[] = [];

    const bp = knowledge.businessProfile;
    sections.push(`[BUSINESS PROFILE]
Company: ${bp.companyName}
Industry: ${bp.industry}
Description: ${bp.description}
Value Proposition: ${bp.valueProposition}
Target Market: ${bp.targetMarket}
Differentiators: ${bp.differentiators.join("; ")}
`);

    if (bp.products.length > 0) {
      sections.push(`[PRODUCTS & SERVICES]`);
      for (const p of bp.products) {
        let line = `Product: ${p.name} - ${p.description}`;
        if (p.pricing) line += ` | Pricing: ${p.pricing}`;
        if (p.features && p.features.length > 0)
          line += ` | Features: ${p.features.join(", ")}`;
        sections.push(line);
      }
      sections.push("");
    }

    if (bp.contactInfo) {
      const ci = bp.contactInfo;
      const contactParts: string[] = ["[CONTACT INFORMATION]"];
      if (ci.phones?.length) contactParts.push(`Phone: ${ci.phones.join(", ")}`);
      if (ci.emails?.length) contactParts.push(`Email: ${ci.emails.join(", ")}`);
      if (ci.addresses?.length)
        contactParts.push(`Address: ${ci.addresses.join("; ")}`);
      if (ci.businessHours) contactParts.push(`Hours: ${ci.businessHours}`);
      if (ci.website) contactParts.push(`Website: ${ci.website}`);
      sections.push(contactParts.join("\n"));
      sections.push("");
    }

    if (knowledge.faqs.length > 0) {
      sections.push(`[FREQUENTLY ASKED QUESTIONS]`);
      for (const faq of knowledge.faqs) {
        sections.push(`Q: ${faq.question}\nA: ${faq.answer}\n`);
      }
    }

    if (knowledge.decisionTrees.length > 0) {
      sections.push(`[CUSTOMER SCENARIO GUIDES]`);
      for (const dt of knowledge.decisionTrees) {
        sections.push(`Scenario: ${dt.scenario}`);
        for (const step of dt.steps) {
          sections.push(`  If: ${step.condition} -> ${step.action}`);
        }
        sections.push("");
      }
    }

    if (knowledge.objectionHandlers.length > 0) {
      sections.push(`[OBJECTION HANDLING]`);
      for (const oh of knowledge.objectionHandlers) {
        sections.push(
          `Objection: "${oh.objection}"\nResponse: ${oh.response}\n`
        );
      }
    }

    if (knowledge.competitiveIntelligence.positioning) {
      sections.push(`[COMPETITIVE POSITIONING]
${knowledge.competitiveIntelligence.positioning}
Advantages: ${knowledge.competitiveIntelligence.advantages.join("; ")}
`);
    }

    if (knowledge.escalationTriggers.length > 0) {
      sections.push(`[ESCALATION TRIGGERS - Transfer to Human When:]`);
      for (const et of knowledge.escalationTriggers) {
        sections.push(
          `Trigger: ${et.trigger}\nReason: ${et.reason}\nAction: ${et.suggestedAction}\n`
        );
      }
    }

    return sections.join("\n");
  }
}

export const knowledgeSynthesisService = new KnowledgeSynthesisService();
