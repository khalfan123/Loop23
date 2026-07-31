import { Router, Response } from 'express';
import multer from 'multer';
import type { RouteContext, AuthRequest } from './common';
import {
  VOICE_CLONE_CONSENT_VERSION,
  createVoiceClone,
  deleteVoiceClone,
  listVoiceClones,
  previewVoiceClone,
} from '../services/voice-clone';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function statusOf(err: unknown): number {
  return typeof err === 'object' && err && 'status' in err && typeof (err as any).status === 'number'
    ? (err as any).status
    : 500;
}

export function createVoiceCloneRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateHybrid } = ctx;

  router.get('/api/voice-clones/consent', authenticateHybrid, (_req: AuthRequest, res: Response) => {
    res.json({
      version: VOICE_CLONE_CONSENT_VERSION,
      summary:
        'By creating an Instant Clone, you confirm you have the right to use this voice sample, that the speaker consented to cloning for AI phone agents on your Loop9 account, and that you will not use clones for fraud, impersonation without disclosure, or other unlawful purposes.',
      points: [
        'You own or have permission to use the uploaded recording.',
        'The speaker consented to voice cloning for AI agent calls on your account.',
        'You will not use clones to deceive callers about identity where disclosure is required.',
        'Samples are stored for cloning/audit and may be sent to your configured local TTS sidecar.',
      ],
    });
  });

  router.get('/api/voice-clones', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const rows = await listVoiceClones(req.userId!);
      res.json(rows);
    } catch (error: any) {
      console.error('List voice clones error:', error);
      res.status(500).json({ error: 'Failed to list voice clones' });
    }
  });

  router.get('/api/voice-clones/cost-takeover/status', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { getCostTakeoverStatus } = await import('../services/voice-clone');
      res.json(await getCostTakeoverStatus(req.userId!));
    } catch (error: any) {
      console.error('Cost takeover status error:', error);
      res.status(500).json({ error: 'Failed to load cost takeover status' });
    }
  });

  router.get('/api/voice-clones/cost-takeover/eligible', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const {
        listCostTakeoverEligibleAgents,
        listCostTakeoverLinkableAgents,
      } = await import('../services/voice-clone');
      const { evaluateCostTakeoverGates } = await import(
        '../voice-core/providers/local-clone-cost-takeover'
      );
      const { getDeprockTTSRouter } = await import(
        '../engines/twilio-bedrock-polly/services/tts-router'
      );
      let health;
      try {
        health = getDeprockTTSRouter().healthSnapshot();
      } catch {
        health = undefined;
      }
      res.json({
        gates: evaluateCostTakeoverGates(health),
        agents: await listCostTakeoverEligibleAgents(req.userId!),
        linkable: await listCostTakeoverLinkableAgents(req.userId!),
      });
    } catch (error: any) {
      console.error('Cost takeover eligible error:', error);
      res.status(500).json({ error: 'Failed to list eligible agents' });
    }
  });

  router.post('/api/voice-clones/cost-takeover/migrate', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { migrateCostTakeoverAgents } = await import('../services/voice-clone');
      const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';
      const force = req.body?.force === true || req.body?.force === 'true';
      const agentIds = Array.isArray(req.body?.agentIds)
        ? req.body.agentIds.filter((id: unknown) => typeof id === 'string')
        : undefined;
      const voiceCloneProfileId =
        typeof req.body?.voiceCloneProfileId === 'string' ? req.body.voiceCloneProfileId.trim() : undefined;
      const providerProfileId =
        typeof req.body?.providerProfileId === 'string' ? req.body.providerProfileId.trim() : undefined;
      const result = await migrateCostTakeoverAgents(req.userId!, {
        dryRun,
        force,
        agentIds,
        voiceCloneProfileId,
        providerProfileId,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Cost takeover migrate error:', error);
      res.status(statusOf(error)).json({ error: error.message || 'Migration failed' });
    }
  });

  router.post(
    '/api/voice-clones',
    authenticateHybrid,
    upload.single('sample'),
    async (req: AuthRequest, res: Response) => {
      try {
        const consentAccepted =
          req.body?.consentAccepted === true ||
          req.body?.consentAccepted === 'true' ||
          req.body?.consentAccepted === '1';
        const profile = await createVoiceClone({
          userId: req.userId!,
          name: String(req.body?.name || ''),
          language: req.body?.language ? String(req.body.language) : 'en',
          consentAccepted,
          consentIp: req.ip || req.socket?.remoteAddress || null,
          file: req.file as Express.Multer.File,
        });
        res.status(201).json(profile);
      } catch (error: any) {
        console.error('Create voice clone error:', error);
        res.status(statusOf(error)).json({ error: error.message || 'Failed to create voice clone' });
      }
    },
  );

  router.delete('/api/voice-clones/:id', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const ok = await deleteVoiceClone(req.userId!, req.params.id);
      if (!ok) return res.status(404).json({ error: 'Clone profile not found' });
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Delete voice clone error:', error);
      res.status(500).json({ error: 'Failed to delete voice clone' });
    }
  });

  /** Ops / sidecar mapping: assign or override the TTS voice id after manual enrollment. */
  router.patch('/api/voice-clones/:id', authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { assignVoiceCloneProviderId } = await import('../services/voice-clone');
      const providerProfileId =
        typeof req.body?.providerProfileId === 'string' ? req.body.providerProfileId.trim() : '';
      if (!providerProfileId) {
        return res.status(400).json({ error: 'providerProfileId is required' });
      }
      const status =
        typeof req.body?.status === 'string' && req.body.status.trim()
          ? String(req.body.status).trim()
          : 'ready';
      const row = await assignVoiceCloneProviderId(req.userId!, req.params.id, providerProfileId, status);
      if (!row) return res.status(404).json({ error: 'Clone profile not found' });
      res.json(row);
    } catch (error: any) {
      console.error('Patch voice clone error:', error);
      res.status(500).json({ error: error.message || 'Failed to update voice clone' });
    }
  });

  router.post(
    '/api/voice-clones/:id/preview',
    authenticateHybrid,
    async (req: AuthRequest, res: Response) => {
      try {
        const audio = await previewVoiceClone(req.userId!, req.params.id, req.body?.text);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audio.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(audio);
      } catch (error: any) {
        console.error('Preview voice clone error:', error);
        res.status(statusOf(error)).json({ error: error.message || 'Failed to preview clone' });
      }
    },
  );

  return router;
}
