'use strict';
import { Router, Request, Response } from 'express';
import { liveCallRegistry } from '../services/live-call-registry';
import { db } from '../db';
import { calls } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getTwilioClient } from '../services/twilio-connector';

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function createLiveMonitoringRoutes(authenticateHybrid: any): Router {
  const router = Router();

  router.get('/api/live-calls', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const isAdmin = req.userRole === 'admin';
      const activeCalls = isAdmin
        ? liveCallRegistry.getAllActiveCalls()
        : liveCallRegistry.getActiveCallsForUser(userId);

      const serialized = activeCalls.map(call => ({
        ...call,
        startedAt: call.startedAt.toISOString(),
        answeredAt: call.answeredAt?.toISOString() || null,
        duration: call.duration || Math.floor((Date.now() - call.startedAt.getTime()) / 1000),
      }));

      return res.json({
        activeCalls: serialized,
        totalActive: serialized.length,
      });
    } catch (error: any) {
      console.error('Error fetching live calls:', error);
      return res.status(500).json({ error: 'Failed to fetch live calls' });
    }
  });

  router.get('/api/live-calls/stats', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const isAdmin = req.userRole === 'admin';
      const activeCalls = isAdmin
        ? liveCallRegistry.getAllActiveCalls()
        : liveCallRegistry.getActiveCallsForUser(userId);

      const stats = {
        totalActive: activeCalls.length,
        inbound: activeCalls.filter(c => c.direction === 'inbound').length,
        outbound: activeCalls.filter(c => c.direction === 'outbound').length,
        byEngine: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
      };

      activeCalls.forEach(call => {
        stats.byEngine[call.engine] = (stats.byEngine[call.engine] || 0) + 1;
        stats.byStatus[call.status] = (stats.byStatus[call.status] || 0) + 1;
      });

      return res.json(stats);
    } catch (error: any) {
      console.error('Error fetching live call stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  router.get('/api/live-calls/flagged', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const isAdmin = req.userRole === 'admin';
      const flaggedCalls = liveCallRegistry.getFlaggedCalls();

      const filtered = isAdmin
        ? flaggedCalls
        : flaggedCalls.filter(c => c.userId === userId);

      const serialized = filtered.map(call => ({
        ...call,
        startedAt: call.startedAt.toISOString(),
        answeredAt: call.answeredAt?.toISOString() || null,
        duration: call.duration || Math.floor((Date.now() - call.startedAt.getTime()) / 1000),
      }));

      return res.json({
        flaggedCalls: serialized,
        totalFlagged: serialized.length,
      });
    } catch (error: any) {
      console.error('Error fetching flagged calls:', error);
      return res.status(500).json({ error: 'Failed to fetch flagged calls' });
    }
  });

  router.get('/api/live-calls/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { callId } = req.params;
      const call = liveCallRegistry.getCall(callId);

      if (!call) {
        return res.status(404).json({ error: 'Call not found or no longer active' });
      }

      const isAdmin = req.userRole === 'admin';
      if (!isAdmin && call.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({
        ...call,
        startedAt: call.startedAt.toISOString(),
        answeredAt: call.answeredAt?.toISOString() || null,
        duration: call.duration || Math.floor((Date.now() - call.startedAt.getTime()) / 1000),
      });
    } catch (error: any) {
      console.error('Error fetching live call:', error);
      return res.status(500).json({ error: 'Failed to fetch call details' });
    }
  });

  router.post('/api/live-calls/:callId/end', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { callId } = req.params;
      const call = liveCallRegistry.getCall(callId);

      if (!call) {
        return res.status(404).json({ error: 'Call not found or no longer active' });
      }

      const isAdmin = req.userRole === 'admin';
      if (!isAdmin && call.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (call.twilioCallSid) {
        try {
          const twilioClient = await getTwilioClient(userId);
          if (twilioClient) {
            await twilioClient.calls(call.twilioCallSid).update({ status: 'completed' });
          }
        } catch (twilioError: any) {
          console.error(`Failed to end Twilio call: ${twilioError.message}`);
        }
      }

      liveCallRegistry.endCall(callId);

      return res.json({ success: true, message: 'Call ended' });
    } catch (error: any) {
      console.error('Error ending call:', error);
      return res.status(500).json({ error: 'Failed to end call' });
    }
  });

  return router;
}
