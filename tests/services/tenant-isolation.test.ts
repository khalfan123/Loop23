import { describe, it, expect } from 'vitest';
import {
  TenantGuard,
  TenantIsolationError,
  ForbiddenActionError,
  buildDataSubjectScope,
  resolveTenantContext,
  type TenantContext,
  type MembershipRow,
} from '../../server/services/tenant-isolation';

const solo = (userId = 'u1', role: TenantContext['role'] = 'owner'): TenantContext => ({ userId, role });
const org = (userId: string, role: TenantContext['role'], members: string[]): TenantContext => ({
  userId,
  role,
  orgId: 'org1',
  orgMemberIds: members,
});

describe('TenantGuard — isolation', () => {
  it('lets a solo tenant reach only their own resources', () => {
    const g = new TenantGuard(solo('u1'));
    expect(g.canAccess('u1')).toBe(true);
    expect(g.canAccess('u2')).toBe(false);
    expect(g.allowedOwnerIds()).toEqual(['u1']);
  });

  it('throws TenantIsolationError on cross-tenant access', () => {
    const g = new TenantGuard(solo('u1'));
    expect(() => g.authorizeOwnerId('u2')).toThrow(TenantIsolationError);
    expect(() => g.authorize({ ownerId: 'u2', id: 'x' })).toThrow(/Cross-tenant access denied/);
  });

  it('returns the resource when authorized', () => {
    const g = new TenantGuard(solo('u1'));
    const r = { ownerId: 'u1', id: 'x' };
    expect(g.authorize(r)).toBe(r);
  });

  it('scopes an org principal to all org members', () => {
    const g = new TenantGuard(org('u1', 'admin', ['u1', 'u2', 'u3']));
    expect(g.canAccess('u2')).toBe(true);
    expect(g.canAccess('u3')).toBe(true);
    expect(g.canAccess('outsider')).toBe(false);
    expect(g.scopeOwnerIds().sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('always includes self even when org members omit it', () => {
    const g = new TenantGuard(org('u1', 'member', ['u2', 'u3']));
    expect(g.canAccess('u1')).toBe(true);
    expect(g.allowedOwnerIds()).toContain('u1');
  });

  it('filters a mixed resource list down to tenant scope', () => {
    const g = new TenantGuard(org('u1', 'member', ['u1', 'u2']));
    const rows = [{ ownerId: 'u1' }, { ownerId: 'u2' }, { ownerId: 'evil' }];
    expect(g.filter(rows)).toEqual([{ ownerId: 'u1' }, { ownerId: 'u2' }]);
  });

  it('requires a userId', () => {
    expect(() => new TenantGuard({ userId: '', role: 'owner' })).toThrow(/userId is required/);
  });
});

describe('TenantGuard — role capabilities', () => {
  it('viewer may read but not write or delete', () => {
    const g = new TenantGuard(solo('u1', 'viewer'));
    expect(g.can('read')).toBe(true);
    expect(g.can('write')).toBe(false);
    expect(() => g.assertCan('write')).toThrow(ForbiddenActionError);
  });

  it('member may read/write but not delete or admin', () => {
    const g = new TenantGuard(solo('u1', 'member'));
    expect(g.can('write')).toBe(true);
    expect(g.can('delete')).toBe(false);
    expect(g.can('admin')).toBe(false);
  });

  it('admin may delete but not perform admin actions', () => {
    const g = new TenantGuard(solo('u1', 'admin'));
    expect(g.can('delete')).toBe(true);
    expect(g.can('admin')).toBe(false);
  });

  it('owner may do everything', () => {
    const g = new TenantGuard(solo('u1', 'owner'));
    for (const a of ['read', 'write', 'delete', 'admin'] as const) expect(g.can(a)).toBe(true);
  });

  it('authorizeAction enforces both role and ownership', () => {
    const g = new TenantGuard(org('u1', 'member', ['u1', 'u2']));
    // member can write an in-scope resource…
    expect(g.authorizeAction('write', { ownerId: 'u2' })).toEqual({ ownerId: 'u2' });
    // …but cannot delete (role), and cannot touch out-of-scope (isolation).
    expect(() => g.authorizeAction('delete', { ownerId: 'u2' })).toThrow(ForbiddenActionError);
    expect(() => g.authorizeAction('write', { ownerId: 'evil' })).toThrow(TenantIsolationError);
  });
});

describe('resolveTenantContext', () => {
  const rows: MembershipRow[] = [
    { userId: 'u1', orgId: 'orgA', role: 'admin' },
    { userId: 'u2', orgId: 'orgA', role: 'member' },
    { userId: 'u3', orgId: 'orgB', role: 'owner' }, // different org
  ];

  it('treats a user with no membership as a solo owner', () => {
    expect(resolveTenantContext('lone', [])).toEqual({ userId: 'lone', role: 'owner' });
  });

  it('builds an org-scoped context from membership rows', () => {
    const ctx = resolveTenantContext('u1', rows);
    expect(ctx.role).toBe('admin');
    expect(ctx.orgId).toBe('orgA');
    expect(ctx.orgMemberIds!.sort()).toEqual(['u1', 'u2']); // only orgA members
  });

  it('scopes a resolved context so it cannot reach another org', () => {
    const guard = new TenantGuard(resolveTenantContext('u2', rows));
    expect(guard.canAccess('u1')).toBe(true);  // same org
    expect(guard.canAccess('u3')).toBe(false); // orgB
  });
});

describe('buildDataSubjectScope — GDPR', () => {
  const NOW = 1_700_000_000_000;
  const now = () => NOW;

  it('lets a user run a request on their own data regardless of role', () => {
    const scope = buildDataSubjectScope(solo('u1', 'viewer'), 'u1', now);
    expect(scope).toEqual({ subjectUserId: 'u1', ownerIds: ['u1'], performedBy: 'u1', requestedAt: NOW });
  });

  it('lets an admin run a request for a member in their org', () => {
    const scope = buildDataSubjectScope(org('admin', 'admin', ['admin', 'member1']), 'member1', now);
    expect(scope.ownerIds).toEqual(['member1']);
    expect(scope.performedBy).toBe('admin');
  });

  it('forbids acting on another subject without delete capability', () => {
    expect(() => buildDataSubjectScope(org('m', 'member', ['m', 'other']), 'other', now)).toThrow(ForbiddenActionError);
  });

  it('forbids acting on a subject outside the tenant scope', () => {
    expect(() => buildDataSubjectScope(org('admin', 'admin', ['admin', 'member1']), 'outsider', now)).toThrow(TenantIsolationError);
  });
});
