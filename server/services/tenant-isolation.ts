/**
 * ============================================================
 * Enterprise engineering — tenant isolation & GDPR scoping
 *
 * A fail-closed authorization core for multi-tenancy: given the acting
 * principal's tenant context (user, org, role, org members), it decides
 * which resources they may touch and rejects cross-tenant access. Resources
 * are scoped by their owner id (today = userId; the same guard works
 * unchanged once an explicit orgId column lands).
 *
 * It also provides GDPR data-subject scoping (export / erasure), so a
 * data-subject request only ever touches that subject's records and only an
 * authorized principal can run it.
 *
 * Pure, dependency-free, deterministic — enforce it in storage/route layers
 * and unit-test the policy in isolation. It decides WHO may touch WHAT; the
 * caller performs the actual query/mutation within the returned scope.
 * ============================================================
 */

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TenantAction = 'read' | 'write' | 'delete' | 'admin';

export interface TenantContext {
  /** Acting principal. */
  userId: string;
  /** Organization scope, if the account is an org/team (else solo tenant). */
  orgId?: string;
  role: TenantRole;
  /**
   * User ids in the same org (may include self). When absent/empty the
   * principal is a solo tenant and can only reach their own resources.
   */
  orgMemberIds?: string[];
}

export interface OwnedResource {
  ownerId: string;
}

export class TenantIsolationError extends Error {
  constructor(public resourceOwnerId: string, public actingUserId: string) {
    super(`Cross-tenant access denied: user ${actingUserId} may not access resource owned by ${resourceOwnerId}`);
    this.name = 'TenantIsolationError';
  }
}

export class ForbiddenActionError extends Error {
  constructor(public action: TenantAction, public role: TenantRole) {
    super(`Role "${role}" is not permitted to ${action}`);
    this.name = 'ForbiddenActionError';
  }
}

/** Capability matrix — each role's allowed actions (higher roles are supersets). */
const ROLE_CAPS: Record<TenantRole, ReadonlySet<TenantAction>> = {
  viewer: new Set<TenantAction>(['read']),
  member: new Set<TenantAction>(['read', 'write']),
  admin: new Set<TenantAction>(['read', 'write', 'delete']),
  owner: new Set<TenantAction>(['read', 'write', 'delete', 'admin']),
};

export class TenantGuard {
  private readonly owners: Set<string>;

  constructor(private ctx: TenantContext) {
    if (!ctx.userId) throw new Error('TenantContext.userId is required');
    // Reachable owner ids = self ∪ org members (deduped). Self is always in.
    this.owners = new Set<string>([ctx.userId, ...(ctx.orgMemberIds ?? [])]);
  }

  /** The owner ids this principal may read. */
  allowedOwnerIds(): string[] {
    return Array.from(this.owners);
  }

  /** Owner-id list to scope a query (`WHERE owner_id IN (...)`). */
  scopeOwnerIds(): string[] {
    return this.allowedOwnerIds();
  }

  canAccess(ownerId: string): boolean {
    return this.owners.has(ownerId);
  }

  /** Assert an owner id is in tenant scope; throws TenantIsolationError otherwise. */
  authorizeOwnerId(ownerId: string): void {
    if (!this.canAccess(ownerId)) {
      throw new TenantIsolationError(ownerId, this.ctx.userId);
    }
  }

  /** Authorize a resource (by ownerId) and return it, or throw. */
  authorize<T extends OwnedResource>(resource: T): T {
    this.authorizeOwnerId(resource.ownerId);
    return resource;
  }

  /** Keep only resources within tenant scope (safe read-time filter). */
  filter<T extends OwnedResource>(resources: T[]): T[] {
    return resources.filter(r => this.owners.has(r.ownerId));
  }

  can(action: TenantAction): boolean {
    return ROLE_CAPS[this.ctx.role]?.has(action) ?? false;
  }

  /** Assert the principal's role permits an action; throws ForbiddenActionError. */
  assertCan(action: TenantAction): void {
    if (!this.can(action)) {
      throw new ForbiddenActionError(action, this.ctx.role);
    }
  }

  /**
   * Combined check for a mutating operation on a specific resource: the role
   * must permit the action AND the resource must be in tenant scope.
   */
  authorizeAction<T extends OwnedResource>(action: TenantAction, resource: T): T {
    this.assertCan(action);
    return this.authorize(resource);
  }
}

// ---------------------------------------------------------------------------
// GDPR data-subject requests (export / erasure)
// ---------------------------------------------------------------------------

export interface DataSubjectScope {
  subjectUserId: string;
  /** Owner ids whose records belong to the subject (today just the subject). */
  ownerIds: string[];
  performedBy: string;
  requestedAt: number;
}

/**
 * Build the scope for a GDPR data-subject request. The acting principal may
 * run it for THEMSELVES, or — with the 'delete' capability (admin/owner) — for
 * another member IN THEIR ORG. Any other target is a cross-tenant violation.
 */
export function buildDataSubjectScope(
  ctx: TenantContext,
  subjectUserId: string,
  now: () => number = Date.now
): DataSubjectScope {
  const guard = new TenantGuard(ctx);
  const isSelf = subjectUserId === ctx.userId;
  if (!isSelf) {
    // Acting on another subject requires delete capability AND the subject
    // being inside the principal's tenant scope.
    guard.assertCan('delete');
    guard.authorizeOwnerId(subjectUserId);
  }
  return {
    subjectUserId,
    ownerIds: [subjectUserId],
    performedBy: ctx.userId,
    requestedAt: now(),
  };
}
