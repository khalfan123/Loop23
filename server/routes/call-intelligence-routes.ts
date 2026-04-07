'use strict';

import { Router, Response } from 'express';
import { RouteContext, AuthRequest } from './common';
import { requireInternalOrUser } from '../middleware/auth';
import { db } from '../db';
import { ciCalls, ciAnalyses, calls, callQaAnalyses } from '@shared/schema';
import { eq, sql, desc, and, inArray, leftJoin } from 'drizzle-orm';

function isInternalRequest(req: AuthRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  return !!(secret && req.headers['x-internal-api-key'] === secret);
}

export function createCallIntelligenceRoutes(_ctx: RouteContext): Router {
  const router = Router();

  router.get('/api/call-intelligence/calls', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(400).json({ error: 'x-user-id header is required' });
      }
      const userId = req.userId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      const [rows, countResult] = await Promise.all([
        db.select()
          .from(ciCalls)
          .where(eq(ciCalls.userId, userId))
          .orderBy(desc(ciCalls.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(ciCalls)
          .where(eq(ciCalls.userId, userId)),
      ]);

      res.json({
        calls: rows,
        pagination: {
          page,
          pageSize,
          totalItems: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / pageSize),
        },
      });
    } catch (error: any) {
      console.error('Failed to list CI calls', error);
      res.status(500).json({ error: 'Failed to list calls' });
    }
  });

  router.get('/api/call-intelligence/calls/:id', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(400).json({ error: 'x-user-id header is required' });
      }
      const userId = req.userId as string;
      const callId = req.params.id as string;

      const [call] = await db.select()
        .from(ciCalls)
        .where(and(eq(ciCalls.callId, callId), eq(ciCalls.userId, userId)));

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      const [analysis] = await db.select()
        .from(ciAnalyses)
        .where(eq(ciAnalyses.callId, call.callId));

      res.json({ call, analysis: analysis || null });
    } catch (error: any) {
      console.error('Failed to get CI call', error);
      res.status(500).json({ error: 'Failed to get call' });
    }
  });

  router.get('/api/call-intelligence/insights', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(400).json({ error: 'x-user-id header is required' });
      }
      const userId = req.userId;

      const userCalls = await db.select()
        .from(ciCalls)
        .where(eq(ciCalls.userId, userId));

      const callIds = userCalls.map(c => c.callId);

      let analyses: (typeof ciAnalyses.$inferSelect)[] = [];
      if (callIds.length > 0) {
        analyses = await db.select()
          .from(ciAnalyses)
          .where(inArray(ciAnalyses.callId, callIds));
      }

      const sentimentBreakdown: Record<string, number> = {};
      for (const c of userCalls) {
        const s = c.sentiment || 'unknown';
        sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1;
      }

      const topicCounts: Record<string, number> = {};
      const objectionCounts: Record<string, number> = {};
      for (const a of analyses) {
        for (const t of (a.topics || [])) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
        for (const o of (a.objections || [])) {
          objectionCounts[o] = (objectionCounts[o] || 0) + 1;
        }
      }

      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      const topObjections = Object.entries(objectionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([objection, count]) => ({ objection, count }));

      const avgScores = analyses.length > 0
        ? {
            accuracy: analyses.reduce((s, a) => s + (a.agentScore?.accuracy || 0), 0) / analyses.length,
            clarity: analyses.reduce((s, a) => s + (a.agentScore?.clarity || 0), 0) / analyses.length,
            tone: analyses.reduce((s, a) => s + (a.agentScore?.tone || 0), 0) / analyses.length,
            completion: analyses.reduce((s, a) => s + (a.agentScore?.completion || 0), 0) / analyses.length,
            overall: analyses.reduce((s, a) => s + (a.agentScore?.overall || 0), 0) / analyses.length,
          }
        : null;

      res.json({
        totalCalls: userCalls.length,
        sentimentBreakdown,
        topTopics,
        topObjections,
        averageAgentScore: avgScores,
      });
    } catch (error: any) {
      console.error('Failed to get CI insights', error);
      res.status(500).json({ error: 'Failed to get insights' });
    }
  });

  router.get('/api/call-intelligence/stats', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      if (!isInternalRequest(req)) {
        return res.status(403).json({ error: 'Admin-wide stats require internal API key' });
      }

      const allCalls = await db.select().from(ciCalls);

      const sentimentBreakdown: Record<string, number> = {};
      const outcomeCounts: Record<string, number> = {};
      let totalDuration = 0;
      let durationCount = 0;

      for (const c of allCalls) {
        const s = c.sentiment || 'unknown';
        sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1;
        const o = c.outcome || 'unknown';
        outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
        if (c.duration) {
          totalDuration += c.duration;
          durationCount++;
        }
      }

      res.json({
        totalCalls: allCalls.length,
        sentimentBreakdown,
        outcomeCounts,
        averageDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      });
    } catch (error: any) {
      console.error('Failed to get CI stats', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  router.get('/api/admin/call-intelligence/calls', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      if (!isInternalRequest(req)) {
        return res.status(403).json({ error: 'Admin endpoints require internal API key' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
      const offset = (page - 1) * pageSize;

      const [rows, countResult] = await Promise.all([
        db.select({
          call: calls,
          analysis: callQaAnalyses,
        })
          .from(calls)
          .leftJoin(callQaAnalyses, eq(calls.id, callQaAnalyses.callId))
          .orderBy(desc(calls.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(calls),
      ]);

      res.json({
        calls: rows.map(r => ({ ...r.call, analysis: r.analysis || null })),
        pagination: {
          page,
          pageSize,
          totalItems: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / pageSize),
        },
      });
    } catch (error: any) {
      console.error('Failed to list admin CI calls', error);
      res.status(500).json({ error: 'Failed to list calls' });
    }
  });

  router.post('/api/call-intelligence/store', requireInternalOrUser, async (req: AuthRequest, res: Response) => {
    try {
      const {
        callId,
        analysisId,
        agentId,
        duration,
        outcome,
        callTimestamp,
        rawTranscript,
        sentiment,
        customerIntent,
        summary,
        topics,
        objections,
        keywords,
        agentScore,
        failedResponses,
        missedOpportunities,
        recommendations,
      } = req.body;

      if (!callId || !analysisId) {
        return res.status(400).json({ error: 'callId and analysisId are required' });
      }

      if (!req.userId) {
        return res.status(400).json({ error: 'x-user-id header is required' });
      }
      const effectiveUserId = req.userId;

      const result = await db.transaction(async (tx) => {
        const [call] = await tx.insert(ciCalls).values({
          callId,
          userId: effectiveUserId,
          agentId: agentId || null,
          duration: duration != null ? Number(duration) : null,
          outcome: outcome || null,
          callTimestamp: callTimestamp ? new Date(callTimestamp) : null,
          rawTranscript: rawTranscript || null,
          sentiment: sentiment || null,
          customerIntent: customerIntent || null,
          summary: summary || null,
        }).returning();

        const [analysis] = await tx.insert(ciAnalyses).values({
          analysisId,
          callId,
          topics: topics || [],
          objections: objections || [],
          keywords: keywords || [],
          agentScore: agentScore || null,
          failedResponses: failedResponses || [],
          missedOpportunities: missedOpportunities || [],
          recommendations: recommendations || [],
        }).returning();

        return { call, analysis };
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to store CI call', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Call or analysis with this ID already exists' });
      }
      res.status(500).json({ error: 'Failed to store call data' });
    }
  });

  return router;
}
