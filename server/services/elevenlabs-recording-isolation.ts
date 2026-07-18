/**
 * Post-call ElevenLabs Audio Isolation (optional, off by default).
 * Downloads a Twilio recording, isolates speech, caches locally, and
 * marks the call metadata so playback can prefer the cleaned file.
 */

import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { twilioOpenaiCalls, calls } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { ElevenLabsService } from './elevenlabs';
import { recordingService } from './recording-service';
import { ElevenLabsPoolService } from './elevenlabs-pool';

const ISOLATED_DIR = path.join(process.cwd(), 'uploads', 'isolated-recordings');

export function isolatedRecordingPath(callId: string): string {
  return path.join(ISOLATED_DIR, `${callId}.mp3`);
}

export async function readIsolatedRecording(callId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(isolatedRecordingPath(callId));
  } catch {
    return null;
  }
}

async function isIsolationEnabled(): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    const setting = await storage.getGlobalSetting('elevenlabs_audio_isolation_on_recordings');
    if (!setting) return false;
    const value = setting.value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '"true"';
    return Boolean(value);
  } catch {
    return false;
  }
}

async function resolveApiKey(userId: string | null | undefined): Promise<string | null> {
  if (userId) {
    try {
      const cred = await ElevenLabsPoolService.getUserCredential(userId);
      if (cred?.apiKey) return cred.apiKey;
    } catch {
      // fall through
    }
  }
  return process.env.ELEVENLABS_API_KEY || null;
}

async function markIsolationStatus(
  callId: string,
  table: 'twilio' | 'legacy',
  status: 'ready' | 'failed',
  detail?: string
): Promise<void> {
  const patch = {
    audioIsolation: {
      status,
      detail: detail || null,
      processedAt: new Date().toISOString(),
    },
  };
  const fragment = sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`;
  if (table === 'twilio') {
    await db
      .update(twilioOpenaiCalls)
      .set({ metadata: fragment as any })
      .where(eq(twilioOpenaiCalls.id, callId));
  } else {
    await db
      .update(calls)
      .set({ metadata: fragment as any })
      .where(eq(calls.id, callId));
  }
}

/**
 * Fire-and-forget safe entry point. Never throws to the caller.
 */
export function maybeIsolateCallRecording(params: {
  callId: string;
  recordingUrl: string;
  userId?: string | null;
  table?: 'twilio' | 'legacy';
}): void {
  void isolateCallRecording(params).catch((err) => {
    console.error(
      `[AudioIsolation] Unexpected failure for call ${params.callId}:`,
      err?.message || err
    );
  });
}

export async function isolateCallRecording(params: {
  callId: string;
  recordingUrl: string;
  userId?: string | null;
  table?: 'twilio' | 'legacy';
}): Promise<boolean> {
  const table = params.table || 'twilio';
  const enabled = await isIsolationEnabled();
  if (!enabled) return false;

  const apiKey = await resolveApiKey(params.userId);
  if (!apiKey) {
    console.warn(`[AudioIsolation] Skipped call ${params.callId}: no ElevenLabs API key`);
    return false;
  }

  const fetched = await recordingService.fetchTwilioRecordingByUrl(params.recordingUrl);
  if (!fetched?.audioBuffer?.length) {
    console.warn(`[AudioIsolation] Skipped call ${params.callId}: could not download recording`);
    await markIsolationStatus(params.callId, table, 'failed', 'download_failed');
    return false;
  }

  try {
    const service = new ElevenLabsService(apiKey);
    const isolated = await service.isolateAudio(fetched.audioBuffer, {
      fileFormat: 'other',
      filename: `${params.callId}.mp3`,
    });

    await fs.mkdir(ISOLATED_DIR, { recursive: true });
    await fs.writeFile(isolatedRecordingPath(params.callId), isolated);
    await markIsolationStatus(params.callId, table, 'ready');
    console.log(
      `[AudioIsolation] Isolated recording ready for call ${params.callId} (${isolated.length} bytes)`
    );
    return true;
  } catch (err: any) {
    console.error(`[AudioIsolation] Failed for call ${params.callId}:`, err?.message || err);
    await markIsolationStatus(params.callId, table, 'failed', err?.message || 'isolation_failed');
    return false;
  }
}
