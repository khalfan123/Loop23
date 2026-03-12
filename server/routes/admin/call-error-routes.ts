'use strict';
import { Router, Response } from 'express';
import { AdminRequest } from '../../middleware/admin-auth';
import { db } from '../../db';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';
import { callErrorLogs, users, calls } from '@shared/schema';

export function registerCallErrorRoutes(router: Router) {
  router.get('/call-errors', async (req: AdminRequest, res: Response) => {
    try {
      const rawPage = parseInt(req.query.page as string, 10);
      const rawPageSize = parseInt(req.query.pageSize as string, 10);
      const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
      const pageSize = Math.min(100, Math.max(1, isNaN(rawPageSize) ? 50 : rawPageSize));
      const offset = (page - 1) * pageSize;
      const { category, severity, userId, engine, startDate, endDate } = req.query;

      const validCategories = ['all', 'timeout', 'streaming', 'tts', 'stt', 'tool_call', 'tool_execution', 'connection', 'authentication', 'rate_limit', 'unknown'];
      const validSeverities = ['all', 'critical', 'error', 'warning', 'info'];
      const validEngines = ['all', 'twilio-openai', 'twilio-bedrock-polly', 'plivo', 'elevenlabs', 'browser'];

      if (category && !validCategories.includes(category as string)) {
        return res.status(400).json({ error: 'Invalid category filter' });
      }
      if (severity && !validSeverities.includes(severity as string)) {
        return res.status(400).json({ error: 'Invalid severity filter' });
      }
      if (engine && !validEngines.includes(engine as string)) {
        return res.status(400).json({ error: 'Invalid engine filter' });
      }
      if (startDate && isNaN(Date.parse(startDate as string))) {
        return res.status(400).json({ error: 'Invalid startDate' });
      }
      if (endDate && isNaN(Date.parse(endDate as string))) {
        return res.status(400).json({ error: 'Invalid endDate' });
      }

      const conditions: any[] = [];
      if (category && category !== 'all') conditions.push(eq(callErrorLogs.errorCategory, category as string));
      if (severity && severity !== 'all') conditions.push(eq(callErrorLogs.severity, severity as string));
      if (userId) conditions.push(eq(callErrorLogs.userId, userId as string));
      if (engine && engine !== 'all') conditions.push(eq(callErrorLogs.engineType, engine as string));
      if (startDate) conditions.push(gte(callErrorLogs.createdAt, new Date(startDate as string)));
      if (endDate) {
        const endOfDay = new Date(endDate as string);
        endOfDay.setDate(endOfDay.getDate() + 1);
        conditions.push(lte(callErrorLogs.createdAt, endOfDay));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select({
          id: callErrorLogs.id,
          callId: callErrorLogs.callId,
          userId: callErrorLogs.userId,
          engineType: callErrorLogs.engineType,
          errorCategory: callErrorLogs.errorCategory,
          severity: callErrorLogs.severity,
          message: callErrorLogs.message,
          latencyMs: callErrorLogs.latencyMs,
          metadata: callErrorLogs.metadata,
          createdAt: callErrorLogs.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(callErrorLogs)
        .leftJoin(users, eq(callErrorLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(callErrorLogs.createdAt))
        .limit(pageSize)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(callErrorLogs)
        .where(whereClause);
      const totalItems = Number(totalResult[0]?.count || 0);

      res.json({
        data: logs,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      });
    } catch (error) {
      console.error('Error fetching call error logs:', error);
      res.status(500).json({ error: 'Failed to fetch call error logs' });
    }
  });

  router.get('/call-errors/summary', async (req: AdminRequest, res: Response) => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCondition = gte(callErrorLogs.createdAt, twentyFourHoursAgo);

      const [totalErrors24h] = await db
        .select({ count: sql<number>`count(*)` })
        .from(callErrorLogs)
        .where(recentCondition);

      const topCategory = await db
        .select({
          errorCategory: callErrorLogs.errorCategory,
          count: sql<number>`count(*)`,
        })
        .from(callErrorLogs)
        .where(recentCondition)
        .groupBy(callErrorLogs.errorCategory)
        .orderBy(desc(sql`count(*)`))
        .limit(1);

      const [avgTimeoutLatency] = await db
        .select({ avg: sql<number>`coalesce(avg(${callErrorLogs.latencyMs}), 0)` })
        .from(callErrorLogs)
        .where(and(recentCondition, eq(callErrorLogs.errorCategory, 'timeout')));

      const topAffectedUsers = await db
        .select({
          userId: callErrorLogs.userId,
          userName: users.name,
          userEmail: users.email,
          count: sql<number>`count(*)`,
        })
        .from(callErrorLogs)
        .leftJoin(users, eq(callErrorLogs.userId, users.id))
        .where(recentCondition)
        .groupBy(callErrorLogs.userId, users.name, users.email)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      const severityBreakdown = await db
        .select({
          severity: callErrorLogs.severity,
          count: sql<number>`count(*)`,
        })
        .from(callErrorLogs)
        .where(recentCondition)
        .groupBy(callErrorLogs.severity);

      res.json({
        totalErrors24h: Number(totalErrors24h?.count || 0),
        mostCommonCategory: topCategory[0]?.errorCategory || 'none',
        mostCommonCategoryCount: Number(topCategory[0]?.count || 0),
        avgTimeoutLatencyMs: Math.round(Number(avgTimeoutLatency?.avg || 0)),
        topAffectedUsers: topAffectedUsers.map((u) => ({
          userId: u.userId,
          userName: u.userName,
          userEmail: u.userEmail,
          errorCount: Number(u.count),
        })),
        severityBreakdown: Object.fromEntries(
          severityBreakdown.map((s) => [s.severity, Number(s.count)])
        ),
      });
    } catch (error) {
      console.error('Error fetching call error summary:', error);
      res.status(500).json({ error: 'Failed to fetch call error summary' });
    }
  });
}
