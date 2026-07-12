/**
 * ============================================================
 * Voice metrics routes
 *
 * Read-only visibility into the voice-core per-turn latency
 * recorder and TTS provider router health. Consumed by the
 * operations UI; authenticated like the other engine routes.
 * ============================================================
 */

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { voiceMetrics } from '../voice-core';
import { getDeprockTTSRouter } from '../engines/twilio-bedrock-polly/services/tts-router';

export function createVoiceMetricsRoutes(authenticate: RequestHandler) {
  const router = Router();

  // GET /api/voice-metrics — latency percentiles, TTS aggregates, provider health
  router.get('/', authenticate, (_req: Request, res: Response) => {
    try {
      res.json({
        ...voiceMetrics.summary(),
        providers: getDeprockTTSRouter().healthSnapshot(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/voice-metrics/turns?limit=N — most recent per-turn breakdowns
  router.get('/turns', authenticate, (req: Request, res: Response) => {
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 50;
      res.json({ turns: voiceMetrics.recentTurns(limit) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
