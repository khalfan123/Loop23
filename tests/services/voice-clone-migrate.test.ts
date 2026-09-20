/**
 * Hard cost-takeover migrate — assign Instant Clone id + flip EL agents.
 * Mocks drizzle `db` so tests stay unit-scoped (no live Postgres).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn(() => ({ set: updateSet }));

type SelectPlan = {
  /** Rows returned when the chain is awaited after where() / limit() */
  rows: unknown[];
};

let selectQueue: SelectPlan[] = [];

function thenableRows(rows: unknown[]) {
  const terminal: Record<string, unknown> = {
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
    then: (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return terminal;
}

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(() => {
      const plan = selectQueue.shift() ?? { rows: [] };
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => thenableRows(plan.rows)),
          orderBy: vi.fn(async () => plan.rows),
        })),
      };
    }),
    update: (...args: unknown[]) => dbUpdate(...args),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../server/engines/twilio-bedrock-polly/services/tts-router', () => ({
  getDeprockTTSRouter: vi.fn(() => ({
    healthSnapshot: () => [],
  })),
}));

vi.mock('../../server/voice-core/providers/local-clone-tts.provider', () => ({
  LocalCloneTTSProvider: class {
    id = 'local_clone';
    async synthesize() {
      return { audio: Buffer.alloc(0), sampleRateHz: 8000, format: 'pcm' };
    }
  },
}));

const readyProfile = {
  id: 'clone-row-1',
  userId: 'user-1',
  name: 'Mira',
  providerProfileId: 'lc_mira_abc',
  status: 'ready',
  language: 'en',
  consentVersion: 'loop9-voice-clone-v1',
  samplePath: 'user-1/x.wav',
};

const linkableAgents = [
  {
    id: 'agent-a',
    name: 'Support',
    voiceProvider: 'elevenlabs',
    elevenLabsVoiceId: 'el_1',
    localCloneVoiceId: null,
  },
  {
    id: 'agent-b',
    name: 'Sales',
    voiceProvider: 'elevenlabs',
    elevenLabsVoiceId: 'el_2',
    localCloneVoiceId: 'lc_already',
  },
];

describe('migrateCostTakeoverAgents hard path', () => {
  beforeEach(() => {
    selectQueue = [];
    updateWhere.mockClear();
    updateSet.mockClear();
    dbUpdate.mockClear();
    process.env.LOCAL_CLONE_TTS_BASE_URL = 'http://gpu:3900';
    process.env.LOCAL_CLONE_TTS_LIVE = '1';
    process.env.LOCAL_CLONE_COST_TAKEOVER = '1';
    delete process.env.LOCAL_CLONE_COST_TAKEOVER_PERCENT;
  });

  afterEach(() => {
    delete process.env.LOCAL_CLONE_TTS_BASE_URL;
    delete process.env.LOCAL_CLONE_TTS_LIVE;
    delete process.env.LOCAL_CLONE_COST_TAKEOVER;
    delete process.env.LOCAL_CLONE_COST_TAKEOVER_PERCENT;
    vi.resetModules();
  });

  it('dry-run assign+migrate via voiceCloneProfileId targets selected linkable agents', async () => {
    // getVoiceCloneForUser → limit(1)
    selectQueue.push({ rows: [readyProfile] });
    // listCostTakeoverLinkableAgents
    selectQueue.push({ rows: linkableAgents });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');
    const result = await migrateCostTakeoverAgents('user-1', {
      dryRun: true,
      voiceCloneProfileId: 'clone-row-1',
      agentIds: ['agent-a'],
    });

    expect(result.dryRun).toBe(true);
    expect(result.migrated).toBe(0);
    expect(result.assignedCloneId).toBe('lc_mira_abc');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      id: 'agent-a',
      localCloneVoiceId: 'lc_mira_abc',
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('hard migrate assigns clone id and flips voiceProvider', async () => {
    selectQueue.push({ rows: [readyProfile] });
    selectQueue.push({ rows: linkableAgents });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');
    const result = await migrateCostTakeoverAgents('user-1', {
      voiceCloneProfileId: 'clone-row-1',
      agentIds: ['agent-a', 'agent-b'],
    });

    expect(result.dryRun).toBe(false);
    expect(result.migrated).toBe(2);
    expect(result.assignedCloneId).toBe('lc_mira_abc');
    expect(dbUpdate).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceProvider: 'local_clone',
        localCloneVoiceId: 'lc_mira_abc',
        openaiVoice: 'lc_mira_abc',
      }),
    );
  });

  it('force bypasses red gates; without force throws 409', async () => {
    delete process.env.LOCAL_CLONE_COST_TAKEOVER;
    selectQueue.push({ rows: [readyProfile] });
    selectQueue.push({ rows: linkableAgents });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');

    await expect(
      migrateCostTakeoverAgents('user-1', {
        voiceCloneProfileId: 'clone-row-1',
        agentIds: ['agent-a'],
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/gates not green/i) });

    selectQueue.push({ rows: [readyProfile] });
    selectQueue.push({ rows: linkableAgents });
    const forced = await migrateCostTakeoverAgents('user-1', {
      force: true,
      voiceCloneProfileId: 'clone-row-1',
      agentIds: ['agent-a'],
    });
    expect(forced.forced).toBe(true);
    expect(forced.migrated).toBe(1);
  });

  it('accepts providerProfileId without Instant Clone row lookup', async () => {
    selectQueue.push({ rows: linkableAgents });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');
    const result = await migrateCostTakeoverAgents('user-1', {
      dryRun: true,
      providerProfileId: 'lc_direct',
      agentIds: ['agent-b'],
    });

    expect(result.assignedCloneId).toBe('lc_direct');
    expect(result.candidates[0].localCloneVoiceId).toBe('lc_direct');
  });

  it('without clone id only flips eligible (already have localCloneVoiceId)', async () => {
    const eligible = [
      {
        id: 'agent-b',
        name: 'Sales',
        voiceProvider: 'elevenlabs',
        elevenLabsVoiceId: 'el_2',
        localCloneVoiceId: 'lc_already',
        openaiVoice: 'lc_already',
      },
    ];
    selectQueue.push({ rows: eligible });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');
    const result = await migrateCostTakeoverAgents('user-1', {
      dryRun: true,
      agentIds: ['agent-b'],
    });

    expect(result.assignedCloneId).toBeNull();
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: 'agent-b',
        localCloneVoiceId: 'lc_already',
      }),
    ]);
  });

  it('404 when voiceCloneProfileId missing for user', async () => {
    selectQueue.push({ rows: [] });

    const { migrateCostTakeoverAgents } = await import('../../server/services/voice-clone');
    await expect(
      migrateCostTakeoverAgents('user-1', {
        dryRun: true,
        voiceCloneProfileId: 'missing',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
