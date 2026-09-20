/**
 * Instant Clone (Phase 3) — consent + sample storage + profile IDs.
 * Does not vendor AGPL OmniVoice Studio. Optionally POSTs to
 * LOCAL_CLONE_CLONE_URL when a remote register endpoint exists.
 */
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { eq, and, desc, ne, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { voiceCloneProfiles, agents, type VoiceCloneProfile } from '@shared/schema';
import { LocalCloneTTSProvider } from '../voice-core/providers/local-clone-tts.provider';
import { isLocalCloneBaseConfigured } from '../voice-core/providers/local-clone-config';
import {
  evaluateCostTakeoverGates,
  isCostTakeoverEnabled,
  rolloutBucket,
  costTakeoverRolloutPercent,
  type CostTakeoverHealthSnap,
} from '../voice-core/providers/local-clone-cost-takeover';

export const VOICE_CLONE_CONSENT_VERSION = 'loop9-voice-clone-v1';

const SAMPLE_ROOT = path.join(process.cwd(), 'uploads', 'voice-clones');
const MAX_SAMPLE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
]);

const previewProvider = new LocalCloneTTSProvider();

export function assertCloneSample(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw Object.assign(new Error('Audio sample file is required'), { status: 400 });
  }
  if (file.size > MAX_SAMPLE_BYTES) {
    throw Object.assign(new Error('Sample must be 15MB or smaller'), { status: 400 });
  }
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime) && !mime.startsWith('audio/')) {
    throw Object.assign(new Error('Sample must be an audio file (wav, mp3, m4a, webm, ogg, flac)'), {
      status: 400,
    });
  }
  return file;
}

async function ensureUserDir(userId: string): Promise<string> {
  const dir = path.join(SAMPLE_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function persistSample(userId: string, file: Express.Multer.File): Promise<{ relativePath: string; absPath: string }> {
  const dir = await ensureUserDir(userId);
  const ext = path.extname(file.originalname || '') || mimeToExt(file.mimetype);
  const filename = `${Date.now()}_${nanoid(8)}${ext}`;
  const absPath = path.join(dir, filename);
  await fs.writeFile(absPath, file.buffer);
  return { relativePath: path.join(userId, filename), absPath };
}

function mimeToExt(mime: string): string {
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('flac')) return '.flac';
  return '.bin';
}

async function tryRemoteRegister(params: {
  name: string;
  absPath: string;
  mime: string;
}): Promise<string | null> {
  const endpoint = process.env.LOCAL_CLONE_CLONE_URL?.trim();
  if (!endpoint) return null;

  const apiKey = process.env.LOCAL_CLONE_TTS_API_KEY || 'none';
  const bytes = await fs.readFile(params.absPath);
  const form = new FormData();
  form.append('name', params.name);
  form.append(
    'files',
    new Blob([new Uint8Array(bytes)], { type: params.mime || 'audio/wav' }),
    path.basename(params.absPath),
  );

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Clone register failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const id =
    (typeof json.voice_id === 'string' && json.voice_id) ||
    (typeof json.id === 'string' && json.id) ||
    (typeof json.voice === 'string' && json.voice) ||
    null;
  return id;
}

export async function listVoiceClones(userId: string): Promise<VoiceCloneProfile[]> {
  return db
    .select()
    .from(voiceCloneProfiles)
    .where(eq(voiceCloneProfiles.userId, userId))
    .orderBy(desc(voiceCloneProfiles.createdAt));
}

export async function getVoiceCloneForUser(
  userId: string,
  id: string,
): Promise<VoiceCloneProfile | undefined> {
  const [row] = await db
    .select()
    .from(voiceCloneProfiles)
    .where(and(eq(voiceCloneProfiles.id, id), eq(voiceCloneProfiles.userId, userId)))
    .limit(1);
  return row;
}

export async function createVoiceClone(params: {
  userId: string;
  name: string;
  language?: string;
  consentAccepted: boolean;
  consentIp?: string | null;
  file: Express.Multer.File;
}): Promise<VoiceCloneProfile> {
  if (!params.consentAccepted) {
    throw Object.assign(
      new Error('You must accept the voice cloning consent to continue'),
      { status: 400 },
    );
  }
  const name = params.name.trim();
  if (!name || name.length > 80) {
    throw Object.assign(new Error('Name is required (max 80 characters)'), { status: 400 });
  }

  const file = assertCloneSample(params.file);
  const { relativePath, absPath } = await persistSample(params.userId, file);

  let providerProfileId = `lc_${nanoid(12)}`;
  let status: string = 'ready';
  let errorMessage: string | null = null;

  try {
    const remoteId = await tryRemoteRegister({
      name,
      absPath,
      mime: file.mimetype,
    });
    if (remoteId) {
      providerProfileId = remoteId;
      status = 'ready';
    }
  } catch (err: any) {
    status = 'failed';
    errorMessage = err?.message?.slice(0, 400) || 'Remote clone registration failed';
  }

  // Without a remote endpoint, keep a local profile id for sidecar mapping / ops.
  if (!process.env.LOCAL_CLONE_CLONE_URL?.trim() && status !== 'failed') {
    status = 'ready';
    errorMessage = null;
  }

  const [row] = await db
    .insert(voiceCloneProfiles)
    .values({
      userId: params.userId,
      name,
      providerProfileId,
      status,
      language: params.language || 'en',
      consentAcceptedAt: new Date(),
      consentVersion: VOICE_CLONE_CONSENT_VERSION,
      consentIp: params.consentIp || null,
      samplePath: relativePath,
      sampleMimeType: file.mimetype,
      sampleBytes: file.size,
      errorMessage,
    })
    .returning();

  return row;
}

export async function deleteVoiceClone(userId: string, id: string): Promise<boolean> {
  const existing = await getVoiceCloneForUser(userId, id);
  if (!existing) return false;
  if (existing.samplePath) {
    const abs = path.join(SAMPLE_ROOT, existing.samplePath);
    await fs.unlink(abs).catch(() => undefined);
  }
  await db
    .delete(voiceCloneProfiles)
    .where(and(eq(voiceCloneProfiles.id, id), eq(voiceCloneProfiles.userId, userId)));
  return true;
}

export async function assignVoiceCloneProviderId(
  userId: string,
  id: string,
  providerProfileId: string,
  status: string = 'ready',
): Promise<VoiceCloneProfile | undefined> {
  const existing = await getVoiceCloneForUser(userId, id);
  if (!existing) return undefined;
  const [row] = await db
    .update(voiceCloneProfiles)
    .set({
      providerProfileId,
      status,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(voiceCloneProfiles.id, id), eq(voiceCloneProfiles.userId, userId)))
    .returning();
  return row;
}

export async function previewVoiceClone(
  userId: string,
  id: string,
  text?: string,
): Promise<Buffer> {
  if (!isLocalCloneBaseConfigured()) {
    throw Object.assign(
      new Error('LOCAL_CLONE_TTS_BASE_URL is not configured — preview unavailable'),
      { status: 503 },
    );
  }
  const profile = await getVoiceCloneForUser(userId, id);
  if (!profile) {
    throw Object.assign(new Error('Clone profile not found'), { status: 404 });
  }
  if (profile.status !== 'ready') {
    throw Object.assign(new Error(`Clone profile is ${profile.status}`), { status: 409 });
  }
  const previewText =
    (text || 'Hello, this is a preview of your Instant Clone voice.').slice(0, 400);
  const result = await previewProvider.synthesize({
    text: previewText,
    voiceId: profile.providerProfileId,
    sampleRateHz: 22050,
    format: 'mp3',
  });
  return result.audio;
}

function liveHealthSnaps(): CostTakeoverHealthSnap[] | undefined {
  try {
    // Sync path used by gate checks — router is already constructed on live calls.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDeprockTTSRouter } = require('../engines/twilio-bedrock-polly/services/tts-router') as typeof import('../engines/twilio-bedrock-polly/services/tts-router');
    return getDeprockTTSRouter().healthSnapshot().map((h) => ({
      providerId: h.providerId,
      breaker: h.breaker,
      ewmaLatencyMs: h.ewmaLatencyMs,
      attempts: h.attempts,
      failures: h.failures,
    }));
  } catch {
    return undefined;
  }
}

export async function getCostTakeoverStatus(userId: string) {
  const gates = evaluateCostTakeoverGates(liveHealthSnaps());
  const eligible = await listCostTakeoverEligibleAgents(userId);
  const linkable = await listCostTakeoverLinkableAgents(userId);
  const readyProfiles = await db
    .select({ id: voiceCloneProfiles.id })
    .from(voiceCloneProfiles)
    .where(and(eq(voiceCloneProfiles.userId, userId), eq(voiceCloneProfiles.status, 'ready')));
  const alreadyOnClone = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.voiceProvider, 'local_clone')));
  return {
    ...gates,
    eligibleCount: eligible.length,
    linkableCount: linkable.length,
    readyProfileCount: readyProfiles.length,
    alreadyOnLocalCloneCount: alreadyOnClone.length,
    softTakeoverActive: isCostTakeoverEnabled() && gates.gatesGreen,
  };
}

/** EL agents that already have a localCloneVoiceId (ready for hard flip). */
export async function listCostTakeoverEligibleAgents(userId: string) {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      voiceProvider: agents.voiceProvider,
      elevenLabsVoiceId: agents.elevenLabsVoiceId,
      localCloneVoiceId: agents.localCloneVoiceId,
      openaiVoice: agents.openaiVoice,
    })
    .from(agents)
    .where(
      and(
        eq(agents.userId, userId),
        eq(agents.voiceProvider, 'elevenlabs'),
        isNotNull(agents.localCloneVoiceId),
        ne(agents.localCloneVoiceId, ''),
      ),
    );

  const percent = costTakeoverRolloutPercent();
  return rows
    .filter((r) => percent >= 100 || rolloutBucket(r.id) < percent)
    .map((r) => ({
      id: r.id,
      name: r.name,
      voiceProvider: r.voiceProvider,
      elevenLabsVoiceId: r.elevenLabsVoiceId,
      localCloneVoiceId: r.localCloneVoiceId || r.openaiVoice,
      readyToFlip: true as const,
    }));
}

/** EL agents that can receive a clone id then flip (hard assign+migrate). */
export async function listCostTakeoverLinkableAgents(userId: string) {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      voiceProvider: agents.voiceProvider,
      elevenLabsVoiceId: agents.elevenLabsVoiceId,
      localCloneVoiceId: agents.localCloneVoiceId,
    })
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.voiceProvider, 'elevenlabs')));

  const percent = costTakeoverRolloutPercent();
  return rows
    .filter((r) => percent >= 100 || rolloutBucket(r.id) < percent)
    .map((r) => ({
      id: r.id,
      name: r.name,
      voiceProvider: r.voiceProvider,
      elevenLabsVoiceId: r.elevenLabsVoiceId,
      localCloneVoiceId: r.localCloneVoiceId,
      readyToFlip: !!(r.localCloneVoiceId && r.localCloneVoiceId.trim()),
    }));
}

export async function migrateCostTakeoverAgents(
  userId: string,
  opts: {
    dryRun?: boolean;
    agentIds?: string[];
    /** Instant Clone row id — assigns providerProfileId onto agents before flip */
    voiceCloneProfileId?: string;
    /** Direct TTS voice id if not resolving via voiceCloneProfileId */
    providerProfileId?: string;
    /** Bypass gate check for intentional hard cutover (ops). */
    force?: boolean;
  } = {},
) {
  const gates = evaluateCostTakeoverGates(liveHealthSnaps());
  if (!gates.gatesGreen && !opts.dryRun && !opts.force) {
    throw Object.assign(
      new Error(`Cost takeover gates not green: ${gates.reasons.join('; ') || 'disabled'}`),
      { status: 409 },
    );
  }

  let cloneId = opts.providerProfileId?.trim() || '';
  if (opts.voiceCloneProfileId) {
    const profile = await getVoiceCloneForUser(userId, opts.voiceCloneProfileId);
    if (!profile) {
      throw Object.assign(new Error('Voice clone profile not found'), { status: 404 });
    }
    if (profile.status !== 'ready') {
      throw Object.assign(new Error(`Clone profile is ${profile.status}`), { status: 409 });
    }
    cloneId = profile.providerProfileId;
  }

  // With a clone id: hard-assign onto selected (or all linkable) EL agents, then flip.
  // Without: only flip agents that already have localCloneVoiceId.
  let targets: Array<{
    id: string;
    name: string;
    voiceProvider: string | null;
    elevenLabsVoiceId: string | null;
    localCloneVoiceId: string | null | undefined;
  }>;

  if (cloneId) {
    const linkable = await listCostTakeoverLinkableAgents(userId);
    targets = opts.agentIds?.length
      ? linkable.filter((a) => opts.agentIds!.includes(a.id))
      : linkable;
    if (opts.agentIds?.length && targets.length === 0) {
      throw Object.assign(new Error('No matching ElevenLabs agents for the given agentIds'), {
        status: 400,
      });
    }
  } else {
    targets = await listCostTakeoverEligibleAgents(userId);
    if (opts.agentIds?.length) {
      const allow = new Set(opts.agentIds);
      targets = targets.filter((a) => allow.has(a.id));
    }
  }

  const candidates = targets.map((a) => ({
    id: a.id,
    name: a.name,
    voiceProvider: a.voiceProvider,
    elevenLabsVoiceId: a.elevenLabsVoiceId,
    localCloneVoiceId: cloneId || a.localCloneVoiceId || null,
  }));

  if (opts.dryRun) {
    return {
      dryRun: true,
      migrated: 0,
      assignedCloneId: cloneId || null,
      candidates,
      gates,
      forced: !!opts.force,
    };
  }

  let migrated = 0;
  for (const agent of candidates) {
    const nextCloneId = (cloneId || agent.localCloneVoiceId || '').trim();
    if (!nextCloneId) continue;
    await db
      .update(agents)
      .set({
        voiceProvider: 'local_clone',
        localCloneVoiceId: nextCloneId,
        openaiVoice: nextCloneId,
      })
      .where(and(eq(agents.id, agent.id), eq(agents.userId, userId)));
    migrated++;
  }

  return {
    dryRun: false,
    migrated,
    assignedCloneId: cloneId || null,
    candidates,
    gates,
    forced: !!opts.force,
  };
}
