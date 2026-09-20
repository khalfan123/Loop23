'use strict';

import { storage } from '../storage';
import { CallpilotAI, BusinessContext } from './callpilot-ai';
import { logger } from '../utils/logger';
import { db } from '../db';
import { agents, users, departments, departmentAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

const BATCH_SIZE = 20;
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let running = false;

async function fetchBusinessContext(call: any): Promise<BusinessContext> {
  const ctx: BusinessContext = {};

  try {
    if (call.userId) {
      const [user] = await db.select({ company: users.company }).from(users).where(eq(users.id, call.userId)).limit(1);
      if (user?.company) {
        ctx.companyName = user.company;
      }
    }

    if (call.agentId) {
      const [agent] = await db.select({
        name: agents.name,
        systemPrompt: agents.systemPrompt,
        language: agents.language,
      }).from(agents).where(eq(agents.id, call.agentId)).limit(1);

      if (agent) {
        ctx.agentName = agent.name;
        ctx.agentSystemPrompt = agent.systemPrompt;
        ctx.language = agent.language;
      }

      const deptAgent = await db.select({
        deptName: departments.name,
      })
        .from(departmentAgents)
        .innerJoin(departments, eq(departments.id, departmentAgents.departmentId))
        .where(eq(departmentAgents.agentId, call.agentId))
        .limit(1);

      if (deptAgent.length > 0) {
        ctx.departmentName = deptAgent[0].deptName;
      }
    }
  } catch (err: any) {
    logger.warn(`[CallpilotWorker] Failed to fetch business context: ${err.message}`, undefined, 'CallpilotWorker');
  }

  return ctx;
}

async function sweep(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const unanalyzed = await storage.getAllUnanalyzedCalls(BATCH_SIZE);

    if (unanalyzed.length === 0) {
      return;
    }

    logger.info(
      `[CallpilotWorker] Processing ${unanalyzed.length} unanalyzed call(s)`,
      undefined,
      'CallpilotWorker'
    );

    for (const call of unanalyzed) {
      if (!call.transcript || call.transcript.length < 50 || !call.userId) continue;

      try {
        const businessContext = await fetchBusinessContext(call);

        const result = await CallpilotAI.extractTasksFromTranscript(call.transcript, {
          aiSummary: call.aiSummary,
          classification: call.classification,
          sentiment: call.sentiment,
          duration: call.duration,
          sessionOutcome: call.sessionOutcome,
        }, businessContext);

        const insertData = CallpilotAI.buildInsertTasks(result.tasks, call.userId, call.id);
        await storage.createOpsTasks(insertData);
        await storage.recordOpsAnalysisRun(call.userId, call.id, insertData.length, {
          outputLanguage: businessContext.language || null,
          provider: result.provider,
          modelUsed: result.modelUsed,
          callSummary: result.callSummary,
          callBrief: result.callBrief as unknown as Record<string, unknown>,
        });

        logger.info(
          `[CallpilotWorker] Call ${call.id} → ${insertData.length} task(s) via ${result.provider} [company: ${businessContext.companyName || 'unknown'}]`,
          undefined,
          'CallpilotWorker'
        );
      } catch (err: any) {
        logger.error(
          `[CallpilotWorker] Failed on call ${call.id}: ${err.message}`,
          undefined,
          'CallpilotWorker'
        );
      }
    }
  } catch (err: any) {
    logger.error(
      `[CallpilotWorker] Sweep error: ${err.message}`,
      undefined,
      'CallpilotWorker'
    );
  } finally {
    running = false;
  }
}

export function startCallpilotWorker(): void {
  logger.info('[CallpilotWorker] Starting — sweeping every 2 minutes', undefined, 'CallpilotWorker');
  sweep();
  setInterval(sweep, INTERVAL_MS);
}
