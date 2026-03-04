'use strict';

import { db } from '../db';
import { calls, agents, incomingConnections } from '@shared/schema';
import { eq, and, gte, desc, isNotNull } from 'drizzle-orm';

interface ConversationContext {
  collectedData: Record<string, string | null>;
  summaryOfDiscussion: string;
  lastTopic: string;
  pendingQuestions: string[];
}

type Call = typeof calls.$inferSelect;

export class ConversationResumptionService {
  async markCallResumable(callId: string, context: ConversationContext): Promise<void> {
    await db
      .update(calls)
      .set({
        resumable: true,
        conversationContext: context,
        lastDisconnectedAt: new Date(),
      })
      .where(eq(calls.id, callId));

    console.log(`[ConversationResumption] Marked call ${callId} as resumable`);
  }

  async findResumableCall(phoneNumber: string, agentId: string): Promise<Call | null> {
    let callbackTimeoutHour = 3;

    try {
      const [agentRecord] = await db
        .select({ behaviorConfig: agents.behaviorConfig })
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (agentRecord?.behaviorConfig?.callbackTimeoutHour) {
        callbackTimeoutHour = agentRecord.behaviorConfig.callbackTimeoutHour;
      }
    } catch (err: any) {
      console.log(`[ConversationResumption] Could not load agent config: ${err.message}`);
    }

    const cutoffTime = new Date(Date.now() - callbackTimeoutHour * 60 * 60 * 1000);

    const results = await db
      .select({ call: calls })
      .from(calls)
      .innerJoin(incomingConnections, eq(calls.incomingConnectionId, incomingConnections.id))
      .where(
        and(
          eq(calls.fromNumber, phoneNumber),
          eq(incomingConnections.agentId, agentId),
          eq(calls.resumable, true),
          isNotNull(calls.conversationContext),
          gte(calls.lastDisconnectedAt, cutoffTime)
        )
      )
      .orderBy(desc(calls.lastDisconnectedAt))
      .limit(1);

    if (results.length > 0) {
      console.log(`[ConversationResumption] Found resumable call ${results[0].call.id} for ${phoneNumber}`);
      return results[0].call;
    }

    return null;
  }

  generateResumptionPrompt(previousCall: Call): string {
    const context = previousCall.conversationContext;
    if (!context) return '';

    const parts: string[] = [];

    parts.push(`The caller previously called and discussed: ${context.summaryOfDiscussion}.`);

    if (context.collectedData && Object.keys(context.collectedData).length > 0) {
      const bullets = Object.entries(context.collectedData)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
      if (bullets) {
        parts.push(`Data already collected:\n${bullets}`);
      }
    }

    if (context.pendingQuestions && context.pendingQuestions.length > 0) {
      const bullets = context.pendingQuestions.map(q => `- ${q}`).join('\n');
      parts.push(`Outstanding items to collect:\n${bullets}`);
    }

    if (context.lastTopic) {
      parts.push(`Last topic discussed: ${context.lastTopic}.`);
    }

    parts.push('Please acknowledge the previous conversation and offer to continue where they left off.');

    return parts.join('\n');
  }

  async markCallResumed(newCallId: string, previousCallId: string): Promise<void> {
    await db
      .update(calls)
      .set({ resumedFromCallId: previousCallId })
      .where(eq(calls.id, newCallId));

    await db
      .update(calls)
      .set({ resumable: false })
      .where(eq(calls.id, previousCallId));

    console.log(`[ConversationResumption] Call ${newCallId} resumed from ${previousCallId}`);
  }
}

export const conversationResumptionService = new ConversationResumptionService();
