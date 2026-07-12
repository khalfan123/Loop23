/**
 * ============================================================
 * Deprock engine — STT provider composition root
 *
 * Owns OpenAI API-key resolution (env vars, then the DB
 * credential pool with a 5-minute cache) and wires the
 * voice-core batch-Whisper provider. Streaming providers
 * (Deepgram/AssemblyAI) will register here behind the same
 * STTProvider seam.
 * ============================================================
 */

import { db } from '../../../db';
import { openaiCredentials } from '@shared/schema';
import { WhisperBatchSTTProvider } from '../../../voice-core/stt/whisper-batch.provider';

let cachedOpenAIKey: string | null = null;
let cachedKeyTimestamp = 0;
const KEY_CACHE_TTL_MS = 300_000;

function isValidApiKey(key: string | undefined): key is string {
  if (!key || key.trim().length === 0) return false;
  const dummyPatterns = ['_DUMMY_', 'YOUR_KEY', 'placeholder', 'xxx', 'REPLACE', 'changeme', 'test_key'];
  const upper = key.toUpperCase();
  return !dummyPatterns.some(p => upper.includes(p.toUpperCase()));
}

let loggedKeySource: string | null = null;

function logKeySourceOnce(source: string): void {
  // The source doesn't change between turns; logging it per-transcription
  // floods call logs with identical lines.
  if (loggedKeySource !== source) {
    loggedKeySource = source;
    console.log(`[BedrockPolly Bridge] Using OpenAI key from ${source}`);
  }
}

export async function resolveOpenAIKey(): Promise<string | null> {
  if (isValidApiKey(process.env.OPENAI_API_KEY)) {
    logKeySourceOnce('OPENAI_API_KEY env var');
    return process.env.OPENAI_API_KEY;
  }
  if (isValidApiKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY)) {
    logKeySourceOnce('AI_INTEGRATIONS env var');
    return process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  }

  const now = Date.now();
  if (cachedOpenAIKey && (now - cachedKeyTimestamp) < KEY_CACHE_TTL_MS) {
    return cachedOpenAIKey;
  }

  try {
    const [cred] = await db
      .select({ apiKey: openaiCredentials.apiKey })
      .from(openaiCredentials)
      .limit(1);
    if (cred?.apiKey && isValidApiKey(cred.apiKey)) {
      cachedOpenAIKey = cred.apiKey;
      cachedKeyTimestamp = now;
      console.log(`[BedrockPolly Bridge] Resolved OpenAI key from DB (${cred.apiKey.substring(0, 12)}...)`);
      return cred.apiKey;
    }
  } catch (err: any) {
    console.error('[BedrockPolly Bridge] Failed to resolve OpenAI key from DB:', err.message);
  }
  console.error('[BedrockPolly Bridge] No valid OpenAI key found in env vars or DB');
  return null;
}

let sttProvider: WhisperBatchSTTProvider | null = null;

export function getDeprockSTTProvider(): WhisperBatchSTTProvider {
  if (!sttProvider) {
    sttProvider = new WhisperBatchSTTProvider({ resolveApiKey: resolveOpenAIKey });
  }
  return sttProvider;
}
