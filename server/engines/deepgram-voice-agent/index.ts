/**
 * ============================================================
 * Deepgram Voice Agent engine — public exports
 *
 * Twilio ↔ Deepgram Agent (Flux + think-model + Aura-2) bridge.
 * ============================================================
 */

import { db } from '../../db';
import { agents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createDeepgramAgentWebhookRoutes } from './routes/webhooks';

export { setupDeepgramAgentStreamHandler } from './routes/stream';
export { DeepgramAgentBridge } from './services/agent-bridge.service';
export { buildAgentSettings, DEEPGRAM_AGENT_URL, DEEPGRAM_AGENT_DEFAULTS } from './config/settings';

/** Webhook router wired to the agents table. */
export const deepgramAgentWebhookRoutes = createDeepgramAgentWebhookRoutes({
  loadAgent: async (agentId: string) => {
    const [agent] = await db
      .select({
        systemPrompt: agents.systemPrompt,
        firstMessage: agents.firstMessage,
        userId: agents.userId,
        knowledgeBaseIds: agents.knowledgeBaseIds,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    if (!agent) return null;
    return {
      systemPrompt: agent.systemPrompt || 'You are a helpful voice assistant.',
      greeting: agent.firstMessage,
      userId: agent.userId ?? undefined,
      knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
    };
  },
});
