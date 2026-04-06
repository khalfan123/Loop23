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

  router.post('/api/qa/benchmark/twilio-openai/:callId', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const callId = req.params.callId as string;

      const analysis = await QaAnalysisService.analyzeTwilioOpenAIBenchmarkCall(callId, userId);
      if (!analysis) {
        return res.status(400).json({
          error: 'Could not benchmark call. Make sure the call exists and has a transcript.'
        });
      }

      res.json({
        message: 'Twilio OpenAI benchmark analysis completed',
        analysis
      });
    } catch (error: any) {
      logger.error('Failed to benchmark Twilio OpenAI call', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to benchmark call' });
    }
  });

  router.post('/api/qa/benchmark/twilio-openai-batch', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { callIds } = req.body;

      if (!Array.isArray(callIds) || callIds.length === 0) {
        return res.status(400).json({ error: 'callIds array is required' });
      }

      if (callIds.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 calls can be benchmarked at once' });
      }

      const results: { callId: string; success: boolean; error?: string }[] = [];

      for (const callId of callIds) {
        try {
          const analysis = await QaAnalysisService.analyzeTwilioOpenAIBenchmarkCall(String(callId), userId);
          results.push({
            callId: String(callId),
            success: !!analysis,
            error: analysis ? undefined : 'Call not found or transcript unavailable'
          });
        } catch (err: any) {
          results.push({ callId: String(callId), success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        message: `Benchmarked ${successCount}/${callIds.length} calls`,
        results
      });
    } catch (error: any) {
      logger.error('Twilio OpenAI benchmark batch failed', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Benchmark batch failed' });
    }
  });

  router.get('/api/qa/benchmark/regressions', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
      const regressions = await QaAnalysisService.getTopRegressionSignals(userId, limit);
      res.json(regressions);
    } catch (error: any) {
      logger.error('Failed to fetch benchmark regressions', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to fetch benchmark regressions' });
    }
  });

  router.get('/api/qa/benchmark/retell-readiness-summary', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string, 10) || 50));
      const summary = await QaAnalysisService.getRetellReadinessSummary(userId, limit);
      res.json(summary);
    } catch (error: any) {
      logger.error('Failed to fetch retell readiness summary', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to fetch retell readiness summary' });
    }
  });

  router.post('/api/qa/benchmark/twilio-openai/recent', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const limitRaw = req.body?.limit;
      const limit = Math.max(1, Math.min(100, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 20));
      const result = await QaAnalysisService.runBenchmarkForRecentTwilioOpenAICalls(userId, limit);
      res.json({
        message: `Recent benchmark run completed (${result.successful}/${result.processed})`,
        ...result,
      });
    } catch (error: any) {
      logger.error('Failed to run recent Twilio OpenAI benchmark', { error: error.message }, 'QA Routes');
      res.status(500).json({ error: 'Failed to run recent benchmark' });
    }
  });

  router.post('/api/qa/benchmark/gate', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const limitRaw = req.body?.limit;
      const minReadinessRaw = req.body?.minReadinessScore;
      const maxRiskFrequencyRaw = req.body?.maxTopRiskFrequencyPct;
      const allowNoDataRaw = req.body?.allowNoData;

      const limit = Math.max(1, Math.min(200, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 50));
      const minReadinessScore = Number.isFinite(Number(minReadinessRaw)) ? Number(minReadinessRaw) : 85;
      const maxTopRiskFrequencyPct = Number.isFinite(Number(maxRiskFrequencyRaw)) ? Number(maxRiskFrequencyRaw) : 45;
      const allowNoData = allowNoDataRaw === undefined ? true : Boolean(allowNoDataRaw);

      const summary = await QaAnalysisService.getRetellReadinessSummary(userId, limit);
      const regressions = await QaAnalysisService.getTopRegressionSignals(userId, limit);

      const topRiskPct = regressions.topRisks[0]?.percentage || 0;
      const failures: string[] = [];

      if (summary.analyzedCalls === 0 && !allowNoData) {
        failures.push('No benchmark data available in the selected window.');
      }
      if (summary.analyzedCalls > 0 && summary.avgRetellReadiness < minReadinessScore) {
        failures.push(`Average readiness ${summary.avgRetellReadiness} is below threshold ${minReadinessScore}.`);
      }
      if (summary.analyzedCalls > 0 && topRiskPct > maxTopRiskFrequencyPct) {
        failures.push(`Top regression risk frequency ${topRiskPct}% exceeds threshold ${maxTopRiskFrequencyPct}%.`);
      }

      const passed = failures.length === 0;
      const payload = {
        passed,
        thresholdConfig: {
          limit,
          minReadinessScore,
          maxTopRiskFrequencyPct,
          allowNoData,
        },
        summary,
        regressions,
        failures,
      };

      return res.status(passed ? 200 : 422).json(payload);
    } catch (error: any) {
      logger.error('Failed to evaluate benchmark quality gate', { error: error.message }, 'QA Routes');
      return res.status(500).json({ error: 'Failed to evaluate benchmark quality gate' });
    }
  });

  return router;
}
