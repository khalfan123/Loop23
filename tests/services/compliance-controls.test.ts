import { describe, it, expect } from 'vitest';
import {
  GdprExecutor,
  SecurityAuditTrail,
  InMemoryAuditWriter,
  isResidencyViolation,
  resolveRegion,
  ResidencyViolationError,
  type DataStore,
} from '../../server/services/compliance-controls';
import type { DataSubjectScope } from '../../server/services/tenant-isolation';

const NOW = 1_700_000_000_000;
const now = () => NOW;

function scope(subjectUserId: string, performedBy = subjectUserId): DataSubjectScope {
  return { subjectUserId, ownerIds: [subjectUserId], performedBy, requestedAt: NOW };
}

function mockStore(category: string, data: Record<string, unknown[]>): DataStore {
  return {
    category,
    exportForOwner: (ownerId) => data[ownerId] ?? [],
    eraseForOwner: (ownerId) => {
      const n = (data[ownerId] ?? []).length;
      data[ownerId] = [];
      return n;
    },
  };
}

describe('GdprExecutor', () => {
  it('exports every registered category for the subject', async () => {
    const gdpr = new GdprExecutor()
      .register(mockStore('calls', { u1: [{ id: 'c1' }, { id: 'c2' }] }))
      .register(mockStore('transcripts', { u1: [{ id: 't1' }] }));
    const bundle = await gdpr.export(scope('u1'), now);
    expect(bundle.subjectUserId).toBe('u1');
    expect(bundle.generatedAt).toBe(NOW);
    expect(bundle.categories.map(c => c.category)).toEqual(['calls', 'transcripts']);
    expect((bundle.categories[0].data as unknown[]).length).toBe(2);
  });

  it('erases across categories and reports the counts', async () => {
    const calls = mockStore('calls', { u1: [{ id: 'c1' }, { id: 'c2' }] });
    const recordings = mockStore('recordings', { u1: [{ id: 'r1' }] });
    const gdpr = new GdprExecutor().register(calls).register(recordings);
    const receipt = await gdpr.erase(scope('u1', 'admin'), now);
    expect(receipt.totalErased).toBe(3);
    expect(receipt.performedBy).toBe('admin');
    expect(receipt.categories).toEqual([
      { category: 'calls', erased: 2 },
      { category: 'recordings', erased: 1 },
    ]);
    // Data is actually gone on a second pass.
    expect((await gdpr.erase(scope('u1'), now)).totalErased).toBe(0);
  });
});

describe('SecurityAuditTrail', () => {
  it('records typed events with a stamped timestamp', async () => {
    const writer = new InMemoryAuditWriter();
    const trail = new SecurityAuditTrail(writer, now);
    await trail.record({ type: 'data_erasure', actorUserId: 'admin', outcome: 'success', targetOwnerId: 'u1' });
    await trail.record({ type: 'tenant_access_denied', actorUserId: 'u2', outcome: 'denied' });
    expect(writer.events).toHaveLength(2);
    expect(writer.events[0]).toMatchObject({ type: 'data_erasure', outcome: 'success', at: NOW });
    expect(writer.events[1].type).toBe('tenant_access_denied');
  });
});

describe('data residency', () => {
  it('detects residency violations against the allowed set', () => {
    const policy = { homeRegion: 'eu-west-1', allowedRegions: ['eu-west-1', 'eu-central-1'] };
    expect(isResidencyViolation(policy, 'eu-central-1')).toBe(false);
    expect(isResidencyViolation(policy, 'us-east-1')).toBe(true);
  });

  it('defaults the allowed set to the home region only', () => {
    expect(isResidencyViolation({ homeRegion: 'ap-south-1' }, 'us-east-1')).toBe(true);
    expect(isResidencyViolation({ homeRegion: 'ap-south-1' }, 'ap-south-1')).toBe(false);
  });

  it('resolveRegion returns home when unspecified and honors allowed requests', () => {
    const policy = { homeRegion: 'us-east-1', allowedRegions: ['us-east-1', 'us-west-2'] };
    expect(resolveRegion(policy)).toBe('us-east-1');
    expect(resolveRegion(policy, 'us-west-2')).toBe('us-west-2');
  });

  it('pins to home or rejects a disallowed region per policy', () => {
    const strict = { homeRegion: 'eu-west-1' };
    expect(() => resolveRegion(strict, 'us-east-1')).toThrow(ResidencyViolationError);
    const lenient = { homeRegion: 'eu-west-1', pinToHome: true };
    expect(resolveRegion(lenient, 'us-east-1')).toBe('eu-west-1');
  });
});
