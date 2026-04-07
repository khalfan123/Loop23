'use strict';

import { Router, Response } from 'express';
import { RouteContext, AuthRequest } from './common';
import { z } from 'zod';
import { inArray, and as andOp, eq as eqOp, or as orOp } from 'drizzle-orm';
import { calls, twilioOpenaiCalls, agents, users, departments, departmentAgents } from '../../shared/schema';
import { CallpilotAI, BusinessContext } from '../services/callpilot-ai';
import { logger } from '../utils/logger';
import { db } from '../db';

const updateOpsTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  taskType: z.enum(['refund', 'callback', 'followup', 'escalation', 'other']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

const createOpsTaskSchema = z.object({
  callId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional(),
  taskType: z.enum(['refund', 'callback', 'followup', 'escalation', 'other']).default('other'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  intent: z.string().optional(),
  sourceExcerpt: z.string().optional(),
});

const batchAnalyzeSchema = z.object({
  n: z.number().int().min(1).max(200).default(10),
});

const listOpsTasksQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  taskType: z.enum(['refund', 'callback', 'followup', 'escalation', 'other']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

async function fetchBusinessContext(call: any): Promise<BusinessContext> {
  const ctx: BusinessContext = {};
  try {
    if (call.userId) {
      const [user] = await db.select({ company: users.company }).from(users).where(eqOp(users.id, call.userId)).limit(1);
      if (user?.company) ctx.companyName = user.company;
    }
    if (call.agentId) {
      const [agent] = await db.select({
        name: agents.name,
        systemPrompt: agents.systemPrompt,
        language: agents.language,
      }).from(agents).where(eqOp(agents.id, call.agentId)).limit(1);
      if (agent) {
        ctx.agentName = agent.name;
        ctx.agentSystemPrompt = agent.systemPrompt;
        ctx.language = agent.language;
      }
      const deptAgent = await db.select({ deptName: departments.name })
        .from(departmentAgents)
        .innerJoin(departments, eqOp(departments.id, departmentAgents.departmentId))
        .where(eqOp(departmentAgents.agentId, call.agentId))
        .limit(1);
      if (deptAgent.length > 0) ctx.departmentName = deptAgent[0].deptName;
    }
  } catch (err: any) {
    logger.warn(`[Ops] Failed to fetch business context: ${err.message}`, undefined, 'Ops Routes');
  }
  return ctx;
}

export function createOpsRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { storage, authenticateHybrid } = ctx;

  // Calls with transcripts not yet analyzed by Callpilot
  router.get('/api/ops/calls-pending', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const calls = await storage.getRecentUnanalyzedCalls(req.userId!, limit);
      res.json({ calls, count: calls.length });
    } catch (error: any) {
      logger.error('Failed to get ops pending calls', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to get pending calls' });
    }
  });

  // Dashboard stats
  router.get('/api/ops/stats', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const stats = await storage.getOpsTaskStats(req.userId!);
      res.json(stats);
    } catch (error: any) {
      logger.error('Failed to get ops stats', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to get ops stats' });
    }
  });

  // Aggregated KPI metrics
  router.get('/api/ops/metrics', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const metrics = await storage.getOpsMetrics(req.userId!, startDate, endDate);
      res.json(metrics);
    } catch (error: any) {
      logger.error('Failed to get ops metrics', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to get ops metrics' });
    }
  });

  // List tasks with optional filters including date range
  router.get('/api/ops/tasks', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const parseResult = listOpsTasksQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.errors });
      }
      const { status, taskType, priority, startDate, endDate, page, pageSize } = parseResult.data;

      const filters: { status?: string; taskType?: string; priority?: string; startDate?: Date; endDate?: Date } = {};
      if (status) filters.status = status;
      if (taskType) filters.taskType = taskType;
      if (priority) filters.priority = priority;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const tasks = await storage.getUserOpsTasks(req.userId!, filters);

      const callIds = [...new Set(tasks.map(t => t.callId).filter(Boolean))] as string[];
      const phoneMap: Record<string, string> = {};
      if (callIds.length > 0) {
        const callRows = await ctx.db.select({
          id: calls.id,
          elevenLabsConversationId: calls.elevenLabsConversationId,
          phoneNumber: calls.phoneNumber,
          fromNumber: calls.fromNumber,
          toNumber: calls.toNumber,
        }).from(calls).where(andOp(
          orOp(inArray(calls.id, callIds), inArray(calls.elevenLabsConversationId, callIds)),
          eqOp(calls.userId, req.userId!)
        ));
        for (const c of callRows) {
          const phone = c.fromNumber || c.phoneNumber || c.toNumber || null;
          if (phone) {
            phoneMap[c.id] = phone;
            if (c.elevenLabsConversationId) phoneMap[c.elevenLabsConversationId] = phone;
          }
        }

        const unmatchedIds = callIds.filter(cid => !phoneMap[cid]);
        if (unmatchedIds.length > 0) {
          const twCallRows = await ctx.db.select({
            id: twilioOpenaiCalls.id,
            fromNumber: twilioOpenaiCalls.fromNumber,
            toNumber: twilioOpenaiCalls.toNumber,
          }).from(twilioOpenaiCalls).where(andOp(
            inArray(twilioOpenaiCalls.id, unmatchedIds),
            eqOp(twilioOpenaiCalls.userId, req.userId!)
          ));
          for (const c of twCallRows) {
            const phone = c.fromNumber || c.toNumber || null;
            if (phone) phoneMap[c.id] = phone;
          }
        }
      }

      const enrichedTasks = tasks.map(t => ({
        ...t,
        callerPhone: t.callId ? (phoneMap[t.callId] || null) : null,
      }));

      const totalItems = enrichedTasks.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedTasks = enrichedTasks.slice(offset, offset + pageSize);

      res.json({
        data: paginatedTasks,
        pagination: { page, pageSize, totalItems, totalPages },
      });
    } catch (error: any) {
      logger.error('Failed to list ops tasks', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to list ops tasks' });
    }
  });

  // Get single task
  router.get('/api/ops/tasks/:id', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getOpsTask(req.params.id);
      if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
      if (task.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });
      res.json(task);
    } catch (error: any) {
      logger.error('Failed to get ops task', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to get ops task' });
    }
  });

  // Get tasks for a call
  router.get('/api/ops/calls/:callId/tasks', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const tasks = await storage.getCallOpsTasks(req.params.callId);
      const ownedTasks = tasks.filter((t) => t.userId === req.userId);
      res.json(ownedTasks);
    } catch (error: any) {
      logger.error('Failed to get call ops tasks', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to get call ops tasks' });
    }
  });

  // Create task manually
  router.post('/api/ops/tasks', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createOpsTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }
      const { dueDate, ...rest } = parsed.data;
      const task = await storage.createOpsTask({
        ...rest,
        userId: req.userId!,
        dueDate: dueDate ? new Date(dueDate) : null,
        isDeleted: false,
      });
      res.status(201).json(task);
    } catch (error: any) {
      logger.error('Failed to create ops task', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to create ops task' });
    }
  });

  // Update task
  router.patch('/api/ops/tasks/:id', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getOpsTask(req.params.id);
      if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
      if (task.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });

      const parsed = updateOpsTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }
      const { dueDate, ...rest } = parsed.data;
      const updated = await storage.updateOpsTask(req.params.id, {
        ...rest,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      });
      res.json(updated);
    } catch (error: any) {
      logger.error('Failed to update ops task', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to update ops task' });
    }
  });

  // Delete task (soft delete)
  router.delete('/api/ops/tasks/:id', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getOpsTask(req.params.id);
      if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
      if (task.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });
      await storage.deleteOpsTask(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete ops task', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to delete ops task' });
    }
  });

  // AI extraction: analyze a single call and create tasks
  router.post('/api/ops/analyze/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const callId = req.params.callId;
      const call = await storage.getCallWithDetails(callId);

      if (!call) return res.status(404).json({ error: 'Call not found' });
      if (call.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });
      if (!call.transcript) {
        return res.status(400).json({ error: 'Call has no transcript to analyze' });
      }

      const existing = await storage.getCallOpsTasks(callId);
      const ownedExisting = existing.filter((t) => t.userId === req.userId);
      if (ownedExisting.length > 0 && !req.query.force) {
        return res.json({
          message: 'Tasks already extracted for this call',
          tasks: ownedExisting,
          alreadyExtracted: true,
        });
      }

      const businessContext = await fetchBusinessContext(call);

      const result = await CallpilotAI.extractTasksFromTranscript(call.transcript, {
        aiSummary: call.aiSummary,
        classification: call.classification,
        sentiment: call.sentiment,
        duration: call.duration,
        sessionOutcome: call.sessionOutcome,
      }, businessContext);

      const insertData = CallpilotAI.buildInsertTasks(result.tasks, req.userId!, callId);
      const created = await storage.createOpsTasks(insertData);
      await storage.recordOpsAnalysisRun(req.userId!, callId, created.length);

      res.json({
        message: `Extracted ${created.length} task(s) from call`,
        tasks: created,
        callSummary: result.callSummary,
        callBrief: result.callBrief,
        provider: result.provider,
        modelUsed: result.modelUsed,
      });
    } catch (error: any) {
      logger.error('Failed to analyze call for ops tasks', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to analyze call' });
    }
  });

  // Batch analyze: fetch N most recent unanalyzed calls and process them
  router.post('/api/ops/analyze-batch', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const parseResult = batchAnalyzeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request', details: parseResult.error.errors });
      }
      const { n } = parseResult.data;

      const unanalyzedCalls = await storage.getRecentUnanalyzedCalls(req.userId!, n);

      if (unanalyzedCalls.length === 0) {
        return res.json({
          message: 'No unanalyzed calls with transcripts found',
          results: [],
          totalCreated: 0,
        });
      }

      const results: { callId: string; tasksCreated: number; success: boolean; provider?: string; error?: string }[] = [];

      for (const call of unanalyzedCalls) {
        try {
          if (!call.transcript) {
            results.push({ callId: call.id, tasksCreated: 0, success: false, error: 'No transcript' });
            continue;
          }

          const businessContext = await fetchBusinessContext(call);
          const result = await CallpilotAI.extractTasksFromTranscript(call.transcript, {
            aiSummary: call.aiSummary,
            classification: call.classification,
            sentiment: call.sentiment,
            duration: call.duration,
            sessionOutcome: call.sessionOutcome,
          }, businessContext);

          const insertData = CallpilotAI.buildInsertTasks(result.tasks, req.userId!, call.id);
          const created = await storage.createOpsTasks(insertData);
          await storage.recordOpsAnalysisRun(req.userId!, call.id, created.length);
          results.push({ callId: call.id, tasksCreated: created.length, success: true, provider: result.provider });
        } catch (err: any) {
          results.push({ callId: call.id, tasksCreated: 0, success: false, error: err.message });
        }
      }

      const totalCreated = results.reduce((sum, r) => sum + r.tasksCreated, 0);
      res.json({
        message: `Analyzed ${unanalyzedCalls.length} call(s), created ${totalCreated} task(s)`,
        results,
        totalCreated,
      });
    } catch (error: any) {
      logger.error('Batch ops analysis failed', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Batch analysis failed' });
    }
  });

  router.post('/api/ops/reanalyze/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const callId = req.params.callId;
      const call = await storage.getCallWithDetails(callId);

      if (!call) return res.status(404).json({ error: 'Call not found' });
      if (call.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });
      if (!call.transcript) {
        return res.status(400).json({ error: 'Call has no transcript to analyze' });
      }

      const deletedCount = await storage.deleteOpsTasksByCallId(callId, req.userId!);
      await storage.deleteOpsAnalysisRun(callId);

      logger.info(`[Ops] Re-analyzing call ${callId} — removed ${deletedCount} old task(s)`, undefined, 'Ops Routes');

      const businessContext = await fetchBusinessContext(call);

      const result = await CallpilotAI.extractTasksFromTranscript(call.transcript, {
        aiSummary: call.aiSummary,
        classification: call.classification,
        sentiment: call.sentiment,
        duration: call.duration,
        sessionOutcome: call.sessionOutcome,
      }, businessContext);

      const insertData = CallpilotAI.buildInsertTasks(result.tasks, req.userId!, callId);
      const created = await storage.createOpsTasks(insertData);
      await storage.recordOpsAnalysisRun(req.userId!, callId, created.length);

      res.json({
        message: `Re-analyzed: removed ${deletedCount} old task(s), created ${created.length} new task(s)`,
        tasks: created,
        oldTasksRemoved: deletedCount,
        callSummary: result.callSummary,
        callBrief: result.callBrief,
        provider: result.provider,
        modelUsed: result.modelUsed,
      });
    } catch (error: any) {
      logger.error('Failed to re-analyze call', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Failed to re-analyze call' });
    }
  });

  router.post('/api/ops/reanalyze-all', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const allTasks = await storage.getUserOpsTasks(req.userId!);
      const callIds = [...new Set(allTasks.filter(t => t.callId).map(t => t.callId!))];

      if (callIds.length === 0) {
        return res.json({ message: 'No calls to re-analyze', results: [], totalCreated: 0 });
      }

      const results: { callId: string; oldRemoved: number; newCreated: number; success: boolean; error?: string }[] = [];

      for (const callId of callIds) {
        try {
          const call = await storage.getCallWithDetails(callId);
          if (!call || call.userId !== req.userId) {
            results.push({ callId, oldRemoved: 0, newCreated: 0, success: false, error: 'Not owned or not found' });
            continue;
          }
          if (!call.transcript) {
            results.push({ callId, oldRemoved: 0, newCreated: 0, success: false, error: 'No transcript' });
            continue;
          }

          const deletedCount = await storage.deleteOpsTasksByCallId(callId, req.userId!);
          await storage.deleteOpsAnalysisRun(callId);

          const businessContext = await fetchBusinessContext(call);
          const result = await CallpilotAI.extractTasksFromTranscript(call.transcript, {
            aiSummary: call.aiSummary,
            classification: call.classification,
            sentiment: call.sentiment,
            duration: call.duration,
            sessionOutcome: call.sessionOutcome,
          }, businessContext);

          const insertData = CallpilotAI.buildInsertTasks(result.tasks, req.userId!, callId);
          const created = await storage.createOpsTasks(insertData);
          await storage.recordOpsAnalysisRun(req.userId!, callId, created.length);

          results.push({ callId, oldRemoved: deletedCount, newCreated: created.length, success: true });
        } catch (err: any) {
          results.push({ callId, oldRemoved: 0, newCreated: 0, success: false, error: err.message });
        }
      }

      const totalCreated = results.reduce((sum, r) => sum + r.newCreated, 0);
      const totalRemoved = results.reduce((sum, r) => sum + r.oldRemoved, 0);
      res.json({
        message: `Re-analyzed ${results.length} call(s): removed ${totalRemoved} old, created ${totalCreated} new task(s)`,
        results,
        totalCreated,
        totalRemoved,
      });
    } catch (error: any) {
      logger.error('Re-analyze all failed', { error: error.message }, 'Ops Routes');
      res.status(500).json({ error: 'Re-analysis failed' });
    }
  });

  return router;
}
