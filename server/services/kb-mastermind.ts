'use strict';
import { db } from '../db';
import { departments, departmentKnowledgeBases, departmentAgents, knowledgeBase, knowledgeChunks, agents } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { RAGKnowledgeService } from './rag-knowledge';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;
let lastRunTimestamp: number | null = null;
let lastRunStats: RunStats | null = null;

interface RunStats {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  departmentsProcessed: number;
  kbsProcessed: number;
  chunksRefreshed: number;
  chunksSkipped: number;
  cacheWarmed: number;
  errors: string[];
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function getActiveDepartmentsWithKBs(departmentId?: string): Promise<Array<{
  deptId: string;
  deptName: string;
  userId: string;
  kbIds: string[];
}>> {
  let deptQuery = db
    .select({
      id: departments.id,
      name: departments.name,
      userId: departments.userId,
    })
    .from(departments)
    .where(
      departmentId
        ? and(eq(departments.id, departmentId), eq(departments.isActive, true), eq(departments.engineType, 'bedrock-polly'))
        : and(eq(departments.isActive, true), eq(departments.engineType, 'bedrock-polly'))
    );

  const depts = await deptQuery;
  if (depts.length === 0) return [];

  const results: Array<{ deptId: string; deptName: string; userId: string; kbIds: string[] }> = [];

  for (const dept of depts) {
    const deptKBs = await db
      .select({ knowledgeBaseId: departmentKnowledgeBases.knowledgeBaseId })
      .from(departmentKnowledgeBases)
      .where(eq(departmentKnowledgeBases.departmentId, dept.id));

    const kbIds = deptKBs.map(dk => dk.knowledgeBaseId);
    if (kbIds.length === 0) continue;

    results.push({
      deptId: dept.id,
      deptName: dept.name,
      userId: dept.userId,
      kbIds,
    });
  }

  return results;
}

async function reprocessKB(kbId: string, userId: string): Promise<{ chunksRefreshed: number; chunksSkipped: number }> {
  const [kb] = await db
    .select()
    .from(knowledgeBase)
    .where(and(eq(knowledgeBase.id, kbId), eq(knowledgeBase.userId, userId)))
    .limit(1);

  if (!kb || !kb.content) {
    return { chunksRefreshed: 0, chunksSkipped: 0 };
  }

  const newHash = contentHash(kb.content);

  const existingChunks = await db
    .select({ id: knowledgeChunks.id, metadata: knowledgeChunks.metadata })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.knowledgeBaseId, kbId))
    .limit(1);

  if (existingChunks.length > 0) {
    const meta = existingChunks[0].metadata as any;
    if (meta?.contentHash === newHash) {
      return { chunksRefreshed: 0, chunksSkipped: 1 };
    }
  }

  const result = await RAGKnowledgeService.processKnowledgeItem(
    kbId,
    userId,
    kb.content,
    { contentHash: newHash, reprocessedAt: new Date().toISOString(), source: 'kb-mastermind' }
  );

  if (result.success && result.chunksCreated > 0) {
    const oldChunkIds = existingChunks.length > 0
      ? (await db
          .select({ id: knowledgeChunks.id })
          .from(knowledgeChunks)
          .where(and(
            eq(knowledgeChunks.knowledgeBaseId, kbId),
            sql`(${knowledgeChunks.metadata}->>'source') IS DISTINCT FROM 'kb-mastermind'
                 OR (${knowledgeChunks.metadata}->>'contentHash') IS DISTINCT FROM ${newHash}`
          ))
        ).map(c => c.id)
      : [];

    if (oldChunkIds.length > 0) {
      await db
        .delete(knowledgeChunks)
        .where(inArray(knowledgeChunks.id, oldChunkIds));
    }
  }

  return {
    chunksRefreshed: result.chunksCreated,
    chunksSkipped: 0,
  };
}

function extractSampleQueries(content: string, maxQueries: number = 3): string[] {
  const queries: string[] = [];

  const lines = content.split('\n').filter(l => l.trim().length > 10);

  const headings = lines.filter(l => /^#{1,4}\s+/.test(l.trim()));
  for (const h of headings.slice(0, 2)) {
    const clean = h.replace(/^#+\s*/, '').trim();
    if (clean.length > 5 && clean.length < 100) {
      queries.push(clean);
    }
  }

  const qaPairs = lines.filter(l => /^(Q:|Question:)/i.test(l.trim()));
  for (const q of qaPairs.slice(0, 2)) {
    const clean = q.replace(/^(Q:|Question:)\s*/i, '').trim();
    if (clean.length > 5 && clean.length < 150) {
      queries.push(clean);
    }
  }

  if (queries.length < maxQueries) {
    const sentences = content.match(/[^.!?؟]+[.!?؟]/g) || [];
    const meaningful = sentences
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 120 && !/^(note|warning|disclaimer)/i.test(s));

    for (const s of meaningful.slice(0, maxQueries - queries.length)) {
      queries.push(s.replace(/[.!?؟]$/, '').trim());
    }
  }

  return queries.slice(0, maxQueries);
}

async function warmSearchCache(kbIds: string[], userId: string, content: string): Promise<number> {
  const queries = extractSampleQueries(content);
  let warmed = 0;

  for (const query of queries) {
    try {
      await RAGKnowledgeService.searchKnowledge(query, kbIds, userId, 3);
      warmed++;
    } catch (err: any) {
      console.warn(`[KB Mastermind] Cache warm query failed: ${err.message}`);
    }
  }

  return warmed;
}

export async function runKBMastermind(departmentId?: string): Promise<RunStats> {
  if (isRunning) {
    console.log('[KB Mastermind] Already running, skipping...');
    return lastRunStats || {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      departmentsProcessed: 0,
      kbsProcessed: 0,
      chunksRefreshed: 0,
      chunksSkipped: 0,
      cacheWarmed: 0,
      errors: ['Skipped: already running'],
    };
  }

  isRunning = true;
  const startTime = Date.now();
  const stats: RunStats = {
    startedAt: new Date().toISOString(),
    completedAt: '',
    durationMs: 0,
    departmentsProcessed: 0,
    kbsProcessed: 0,
    chunksRefreshed: 0,
    chunksSkipped: 0,
    cacheWarmed: 0,
    errors: [],
  };

  try {
    console.log(`\n🧠 ============================================`);
    console.log(`🧠 KB MASTERMIND: Starting training cycle`);
    console.log(`🧠 ============================================`);
    if (departmentId) {
      console.log(`🧠 Target: Department ${departmentId}`);
    } else {
      console.log(`🧠 Target: All active Deprock departments`);
    }

    const depts = await getActiveDepartmentsWithKBs(departmentId);

    if (depts.length === 0) {
      console.log(`🧠 No departments with linked KBs found`);
      stats.completedAt = new Date().toISOString();
      stats.durationMs = Date.now() - startTime;
      lastRunTimestamp = Date.now();
      lastRunStats = stats;
      isRunning = false;
      return stats;
    }

    console.log(`🧠 Found ${depts.length} department(s) with knowledge bases`);

    for (const dept of depts) {
      console.log(`\n🧠 [${dept.deptName}] Processing ${dept.kbIds.length} KB(s)...`);
      let deptContent = '';

      for (const kbId of dept.kbIds) {
        try {
          const result = await reprocessKB(kbId, dept.userId);
          stats.kbsProcessed++;

          if (result.chunksSkipped > 0) {
            stats.chunksSkipped++;
            console.log(`   ⏭️  KB ${kbId}: unchanged, skipped`);
          } else {
            stats.chunksRefreshed += result.chunksRefreshed;
            console.log(`   ✅ KB ${kbId}: ${result.chunksRefreshed} chunks refreshed`);
          }

          const [kb] = await db
            .select({ content: knowledgeBase.content })
            .from(knowledgeBase)
            .where(eq(knowledgeBase.id, kbId))
            .limit(1);
          if (kb?.content) {
            deptContent += kb.content.substring(0, 2000) + '\n';
          }
        } catch (err: any) {
          const errMsg = `KB ${kbId} in ${dept.deptName}: ${err.message}`;
          stats.errors.push(errMsg);
          console.error(`   ❌ ${errMsg}`);
        }
      }

      if (deptContent.length > 0) {
        try {
          const warmed = await warmSearchCache(dept.kbIds, dept.userId, deptContent);
          stats.cacheWarmed += warmed;
          console.log(`   🔥 Cache warmed with ${warmed} queries`);
        } catch (err: any) {
          console.warn(`   ⚠️  Cache warming failed: ${err.message}`);
        }
      }

      stats.departmentsProcessed++;
    }

    stats.completedAt = new Date().toISOString();
    stats.durationMs = Date.now() - startTime;
    lastRunTimestamp = Date.now();
    lastRunStats = stats;

    console.log(`\n🧠 ============================================`);
    console.log(`🧠 KB MASTERMIND: Training cycle complete`);
    console.log(`🧠 Departments: ${stats.departmentsProcessed}`);
    console.log(`🧠 KBs processed: ${stats.kbsProcessed}`);
    console.log(`🧠 Chunks refreshed: ${stats.chunksRefreshed}`);
    console.log(`🧠 Chunks skipped (unchanged): ${stats.chunksSkipped}`);
    console.log(`🧠 Cache queries warmed: ${stats.cacheWarmed}`);
    console.log(`🧠 Errors: ${stats.errors.length}`);
    console.log(`🧠 Duration: ${stats.durationMs}ms`);
    console.log(`🧠 ============================================\n`);

  } catch (error: any) {
    stats.errors.push(`Fatal: ${error.message}`);
    console.error(`❌ [KB Mastermind] Fatal error:`, error.message);
    stats.completedAt = new Date().toISOString();
    stats.durationMs = Date.now() - startTime;
    lastRunStats = stats;
  } finally {
    isRunning = false;
  }

  return stats;
}

export function startKBMastermind(): void {
  if (intervalId) {
    console.log('[KB Mastermind] Already running');
    return;
  }

  console.log(`🧠 [KB Mastermind] Starting daily scheduler (runs every 24h, first run in ${INITIAL_DELAY_MS / 1000}s)`);

  setTimeout(() => {
    runKBMastermind().catch(err => {
      console.error('[KB Mastermind] Initial run failed:', err);
    });
  }, INITIAL_DELAY_MS);

  intervalId = setInterval(() => {
    runKBMastermind().catch(err => {
      console.error('[KB Mastermind] Scheduled run failed:', err);
    });
  }, DAILY_INTERVAL_MS);
}

export function stopKBMastermind(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[KB Mastermind] Scheduler stopped');
  }
}

export function getKBMastermindStatus(): {
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunStats: RunStats | null;
} {
  return {
    isRunning,
    lastRunAt: lastRunTimestamp ? new Date(lastRunTimestamp).toISOString() : null,
    lastRunStats,
  };
}
