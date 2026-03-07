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

export async function generateUseCasesFromKB(userId: string): Promise<void> {
  if (activeGenerations.has(userId)) {
    return;
  }
  activeGenerations.add(userId);

  try {
    const kbItems = await storage.getUserKnowledgeBase(userId);
    if (!kbItems || kbItems.length === 0) {
      return;
    }

    const businessContext = kbItems.slice(0, 20).map(item => {
      const contentSnippet = item.content ? item.content.substring(0, 400) : '';
      return `- ${item.title}${item.type === 'url' && item.url ? ` (${item.url})` : ''}: ${contentSnippet}`;
    }).join('\n');

    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      console.warn("[UseCaseGenerator] OpenAI API key not configured, skipping generation");
      return;
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert campaign strategist. Based on a business's knowledge base content, generate 8-12 highly specific, tailored outbound calling campaign use cases that would make sense for THIS particular business.

Each use case must be specific to the business (e.g., "eSIM Activation Support" not just "Customer Support"). Include the business's actual products, services, or industry terms in the use case names.

Always include "Appointment Booking" as one of the use cases.

Categories must be one of: sales, support, collections, appointments, surveys, healthcare, real_estate, finance, ecommerce, travel

Output ONLY a valid JSON array:
[
  { "name": "...", "description": "one sentence", "category": "..." },
  ...
]
No markdown, no explanation.`
        },
        {
          role: "user",
          content: `Based on this business's knowledge base, generate tailored campaign use cases:\n\n${businessContext}`
        }
      ],
      max_completion_tokens: 1500,
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    let useCases: Array<{ name: string; description: string; category: string }> = [];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) useCases = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("[UseCaseGenerator] Failed to parse AI response:", raw.substring(0, 200));
      return;
    }

    if (!Array.isArray(useCases) || useCases.length === 0) {
      return;
    }

    const validUseCases = useCases
      .filter(uc => uc.name && typeof uc.name === 'string' && uc.description && typeof uc.description === 'string')
      .map(uc => ({
        name: uc.name.trim().substring(0, 100),
        description: uc.description.trim().substring(0, 250),
        category: VALID_CATEGORIES.has(uc.category) ? uc.category : 'sales',
      }));

    if (validUseCases.length === 0) {
      return;
    }

    const hasAppointment = validUseCases.some(uc => uc.name.toLowerCase().includes('appointment') || uc.name.toLowerCase().includes('booking'));
    if (!hasAppointment) {
      validUseCases.unshift({ name: "Appointment Booking", description: "Schedule appointments with prospects or customers", category: "appointments" });
    }

    await db.delete(generatedUseCases).where(eq(generatedUseCases.userId, userId));

    for (const uc of validUseCases) {
      await db.insert(generatedUseCases).values({
        id: nanoid(),
        userId,
        name: uc.name,
        description: uc.description,
        category: uc.category,
      });
    }

    console.log(`[UseCaseGenerator] Generated ${validUseCases.length} use cases for user ${userId}`);
  } catch (error: any) {
    console.error("[UseCaseGenerator] Error generating use cases:", error.message);
  } finally {
    activeGenerations.delete(userId);
  }
}
