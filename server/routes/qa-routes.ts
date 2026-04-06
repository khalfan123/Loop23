'use strict';

import { Router, Response } from 'express';
import { RouteContext, AuthRequest } from './common';
import { QaAnalysisService } from '../services/qa-analysis.service';
import { logger } from '../utils/logger';

export function createQaRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateHybrid } = ctx;

  router.get('/api/qa/dashboard', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : undefined;
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : undefined;

      const stats = await QaAnalysisService.getDashboardStats(userId, startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      logger.error('Failed to get QA dashboard stats', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  });

  router.get('/api/qa/analyses', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await QaAnalysisService.getUserAnalyses(userId, page, pageSize);
      res.json(result);
    } catch (error: any) {
      logger.error('Failed to get QA analyses', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to get analyses' });
    }
  });

  router.get('/api/qa/calls-pending', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;

      const calls = await QaAnalysisService.getCallsForAnalysis(userId, limit);
      res.json({ calls, count: calls.length });
    } catch (error: any) {
      logger.error('Failed to get pending calls', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to get pending calls' });
    }
  });

  router.get('/api/qa/analysis/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const callId = req.params.callId as string;
      const analysis = await QaAnalysisService.getAnalysis(callId);
      
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      res.json(analysis);
    } catch (error: any) {
      logger.error('Failed to get analysis', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to get analysis' });
    }
  });

  router.post('/api/qa/analyze/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const callId = req.params.callId as string;

      const existingAnalysis = await QaAnalysisService.getAnalysis(callId);
      if (existingAnalysis) {
        return res.json({ 
          message: 'Analysis already exists',
          analysis: existingAnalysis 
        });
      }

      const analysis = await QaAnalysisService.analyzeCall(callId, userId);
      
      if (!analysis) {
        return res.status(400).json({ 
          error: 'Could not analyze call. Make sure the call has a transcript.' 
        });
      }

      res.json({ 
        message: 'Analysis completed',
        analysis 
      });
    } catch (error: any) {
      logger.error('Failed to analyze call', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to analyze call' });
    }
  });

  router.post('/api/qa/analyze-batch', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { callIds } = req.body;

      if (!Array.isArray(callIds) || callIds.length === 0) {
        return res.status(400).json({ error: 'callIds array is required' });
      }

      if (callIds.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 calls can be analyzed at once' });
      }

      const results: { callId: string; success: boolean; error?: string }[] = [];

      for (const callId of callIds) {
        try {
          const existingAnalysis = await QaAnalysisService.getAnalysis(callId);
          if (existingAnalysis) {
            results.push({ callId, success: true });
            continue;
          }

          const analysis = await QaAnalysisService.analyzeCall(callId, userId);
          results.push({ 
            callId, 
            success: !!analysis,
            error: analysis ? undefined : 'No transcript available'
          });
        } catch (err: any) {
          results.push({ callId, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ 
        message: `Analyzed ${successCount}/${callIds.length} calls`,
        results 
      });
    } catch (error: any) {
      logger.error('Batch analysis failed', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Batch analysis failed' });
    }
  });

  return router;
}
