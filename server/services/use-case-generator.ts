import { db } from "../db";
import { storage } from "../storage";
import { generatedUseCases } from "@shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const VALID_CATEGORIES = new Set([
  'sales', 'support', 'collections', 'appointments', 'surveys',
  'healthcare', 'real_estate', 'finance', 'ecommerce', 'travel'
]);

const activeGenerations = new Set<string>();

async function getBusinessContextFromKB(userId: string): Promise<{ context: string; businessName: string; industry: string }> {
  const kbItems = await storage.getUserKnowledgeBase(userId);
  if (!kbItems || kbItems.length === 0) {
    return { context: '', businessName: '', industry: '' };
  }

  const contextParts = kbItems.slice(0, 25).map(item => {
    const contentSnippet = item.content ? item.content.substring(0, 600) : '';
    return `[${item.title}]${item.type === 'url' && item.url ? ` (source: ${item.url})` : ''}:\n${contentSnippet}`;
  });

  const allTitles = kbItems.map(i => i.title).join(', ');
  const allContent = kbItems.slice(0, 5).map(i => i.content?.substring(0, 300) || '').join(' ');

  return {
    context: contextParts.join('\n\n'),
    businessName: allTitles,
    industry: allContent.substring(0, 200),
  };
}

export async function generateUseCasesFromKB(userId: string): Promise<void> {
  if (activeGenerations.has(userId)) {
    return;
  }
  activeGenerations.add(userId);

  try {
    const { context } = await getBusinessContextFromKB(userId);
    if (!context) return;

    try {
      const { resolveOpenAIApiKey } = await import("./openai-modelfarm");
      await resolveOpenAIApiKey();
    } catch {
      console.warn("[UseCaseGenerator] OpenAI API key not configured, skipping generation");
      return;
    }

    const useCases = await callAIForUseCases(context, undefined);
    if (!useCases || useCases.length === 0) return;

    await db.delete(generatedUseCases).where(eq(generatedUseCases.userId, userId));

    for (const uc of useCases) {
      await db.insert(generatedUseCases).values({
        id: nanoid(),
        userId,
        name: uc.name,
        description: uc.description,
        category: uc.category,
      });
    }

    console.log(`[UseCaseGenerator] Generated ${useCases.length} use cases for user ${userId}`);
  } catch (error: any) {
    console.error("[UseCaseGenerator] Error generating use cases:", error.message);
  } finally {
    activeGenerations.delete(userId);
  }
}

export async function generateUseCasesOnDemand(userId: string, userGoal?: string): Promise<Array<{ name: string; description: string; category: string }>> {
  const { context } = await getBusinessContextFromKB(userId);

  const { resolveOpenAIApiKey } = await import("./openai-modelfarm");
  try {
    await resolveOpenAIApiKey();
  } catch {
    throw new Error("AI service not configured. Please set the OpenAI API key in Admin Settings or environment variables.");
  }

  const useCases = await callAIForUseCases(context, userGoal);
  if (!useCases || useCases.length === 0) {
    throw new Error("Failed to generate use cases");
  }

  await db.delete(generatedUseCases).where(eq(generatedUseCases.userId, userId));

  for (const uc of useCases) {
    await db.insert(generatedUseCases).values({
      id: nanoid(),
      userId,
      name: uc.name,
      description: uc.description,
      category: uc.category,
    });
  }

  const saved = await db.select().from(generatedUseCases).where(eq(generatedUseCases.userId, userId));
  return saved;
}

async function callAIForUseCases(
  businessContext: string,
  userGoal?: string
): Promise<Array<{ name: string; description: string; category: string }>> {
  const { getOpenAIClient } = await import("./openai-modelfarm");
  const openai = await getOpenAIClient();

  const goalInstruction = userGoal
    ? `\n\nThe user has described what they want to achieve:\n"${userGoal}"\n\nPrioritize use cases that directly help them achieve this goal. Make the use cases highly specific to their stated objective and their business.`
    : '';

  const hasBusinessContext = businessContext.length > 0;

  const systemPrompt = `You are an expert AI campaign strategist for an AI-powered calling platform. Your job is to analyze a business's knowledge base and generate highly specific, tailored outbound calling campaign use cases.

CRITICAL RULES:
1. Every use case MUST reference the actual business, its products, services, or industry. NEVER generate generic use cases like "Lead Qualification" or "Customer Support" — instead generate specific ones like "eSIM Plan Upgrade Calls" or "Property Viewing Scheduling" based on what the business actually does.
2. Read the knowledge base carefully to understand: What does this business sell? Who are their customers? What problems do they solve? What services do they offer?
3. Generate 8-12 use cases that a real sales/operations manager at THIS specific business would want to run.
4. Always include one appointment/booking related use case specific to the business.
5. Each use case name should contain business-specific terminology (product names, service types, industry terms).${goalInstruction}

Categories must be one of: sales, support, collections, appointments, surveys, healthcare, real_estate, finance, ecommerce, travel

Output ONLY a valid JSON array:
[
  { "name": "...", "description": "one sentence explaining the specific campaign goal", "category": "..." }
]
No markdown, no explanation, no wrapping.`;

  const userMessage = hasBusinessContext
    ? `Here is the business's knowledge base content. Analyze it thoroughly and generate tailored campaign use cases:\n\n${businessContext}`
    : userGoal
      ? `The user wants to achieve: "${userGoal}". Generate relevant campaign use cases based on this goal.`
      : 'Generate general outbound calling campaign use cases.';

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_completion_tokens: 2000,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  let useCases: Array<{ name: string; description: string; category: string }> = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) useCases = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[UseCaseGenerator] Failed to parse AI response:", raw.substring(0, 200));
    return [];
  }

  if (!Array.isArray(useCases) || useCases.length === 0) {
    return [];
  }

  const validUseCases = useCases
    .filter(uc => uc.name && typeof uc.name === 'string' && uc.description && typeof uc.description === 'string')
    .map(uc => ({
      name: uc.name.trim().substring(0, 100),
      description: uc.description.trim().substring(0, 250),
      category: VALID_CATEGORIES.has(uc.category) ? uc.category : 'sales',
    }));

  const hasAppointment = validUseCases.some(uc => uc.name.toLowerCase().includes('appointment') || uc.name.toLowerCase().includes('booking'));
  if (!hasAppointment && validUseCases.length > 0) {
    validUseCases.push({ name: "Appointment Booking", description: "Schedule appointments with prospects or customers", category: "appointments" });
  }

  return validUseCases;
}
