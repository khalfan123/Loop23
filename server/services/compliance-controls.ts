/**
 * ============================================================
 * Enterprise engineering — SOC2 / GDPR controls + data residency
 *
 * The code-level controls behind the enterprise pillar (the attestation and
 * cloud provisioning around them are process/infra, not code):
 *
 * - GdprExecutor: executes data-subject export/erasure across pluggable data
 *   stores, scoped by the tenant-authorized DataSubjectScope, so a right-to-
 *   access / right-to-erasure request only ever touches the subject's records.
 * - SecurityAuditTrail: an append-only, typed audit log of security-relevant
 *   events (access denials, exports, erasures, permission changes) — the SOC2
 *   evidence trail — over a pluggable writer.
 * - Data residency: resolve/validate the region a tenant's data may live in,
 *   the code half of multi-region support.
 *
 * Pure and pluggable (stores/writer injected) so every control is unit-tested
 * without a live DB; the store/writer implementations are the thin infra edge.
 * ============================================================
 */

import type { DataSubjectScope } from './tenant-isolation';

// --------------------------------------------------------------------------
// GDPR data-subject execution
// --------------------------------------------------------------------------

/** A category of personal data the platform can export/erase for a subject. */
export interface DataStore {
  /** Stable category name, e.g. 'calls', 'transcripts', 'recordings'. */
  category: string;
  exportForOwner(ownerId: string): Promise<unknown> | unknown;
  eraseForOwner(ownerId: string): Promise<number> | number; // records affected
}

export interface ExportBundle {
  subjectUserId: string;
  generatedAt: number;
  categories: Array<{ category: string; data: unknown }>;
}

export interface ErasureReceipt {
  subjectUserId: string;
  performedBy: string;
  erasedAt: number;
  categories: Array<{ category: string; erased: number }>;
  totalErased: number;
}

export class GdprExecutor {
  private stores: DataStore[] = [];

  register(store: DataStore): this {
    this.stores.push(store);
    return this;
  }

  /** Right-to-access: gather every category's data for the scoped subject. */
  async export(scope: DataSubjectScope, now: () => number = Date.now): Promise<ExportBundle> {
    const categories: ExportBundle['categories'] = [];
    for (const ownerId of scope.ownerIds) {
      for (const store of this.stores) {
        categories.push({ category: store.category, data: await store.exportForOwner(ownerId) });
      }
    }
    return { subjectUserId: scope.subjectUserId, generatedAt: now(), categories };
  }

  /** Right-to-erasure: delete the scoped subject's data across all categories. */
  async erase(scope: DataSubjectScope, now: () => number = Date.now): Promise<ErasureReceipt> {
    const categories: ErasureReceipt['categories'] = [];
    let totalErased = 0;
    for (const ownerId of scope.ownerIds) {
      for (const store of this.stores) {
        const erased = await store.eraseForOwner(ownerId);
        totalErased += erased;
        categories.push({ category: store.category, erased });
      }
    }
    return {
      subjectUserId: scope.subjectUserId,
      performedBy: scope.performedBy,
      erasedAt: now(),
      categories,
      totalErased,
    };
  }
}

// --------------------------------------------------------------------------
// SOC2 security audit trail
// --------------------------------------------------------------------------

export type SecurityEventType =
  | 'data_export'
  | 'data_erasure'
  | 'permission_change'
  | 'tenant_access_denied'
  | 'residency_violation'
  | 'auth';

export interface SecurityAuditEvent {
  type: SecurityEventType;
  actorUserId: string;
  outcome: 'success' | 'denied';
  at: number;
  targetOwnerId?: string;
  orgId?: string;
  detail?: string;
}

export interface AuditLogWriter {
  write(event: SecurityAuditEvent): Promise<void> | void;
}

export class SecurityAuditTrail {
  constructor(private writer: AuditLogWriter, private now: () => number = Date.now) {}

  /** Record an event; `at` is stamped if the caller didn't supply one. */
  async record(event: Omit<SecurityAuditEvent, 'at'> & { at?: number }): Promise<void> {
    await this.writer.write({ ...event, at: event.at ?? this.now() });
  }
}

/** An in-memory writer for tests / a fallback audit sink. */
export class InMemoryAuditWriter implements AuditLogWriter {
  readonly events: SecurityAuditEvent[] = [];
  write(event: SecurityAuditEvent): void {
    this.events.push(event);
  }
}

// --------------------------------------------------------------------------
// Data residency / multi-region
// --------------------------------------------------------------------------

export const SUPPORTED_REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1', 'ap-southeast-1'] as const;
export type Region = (typeof SUPPORTED_REGIONS)[number] | string;

export interface ResidencyPolicy {
  /** Where this tenant's data lives by default. */
  homeRegion: Region;
  /** Regions data may be processed in (defaults to [homeRegion]). */
  allowedRegions?: Region[];
  /** When true, requests for a disallowed region are pinned home, not rejected. */
  pinToHome?: boolean;
}

/** True when placing/processing data in `region` would violate residency. */
export function isResidencyViolation(policy: ResidencyPolicy, region: Region): boolean {
  const allowed = policy.allowedRegions ?? [policy.homeRegion];
  return !allowed.includes(region);
}

export class ResidencyViolationError extends Error {
  constructor(public requested: Region, public policy: ResidencyPolicy) {
    super(`Region "${requested}" is outside tenant residency (home ${policy.homeRegion})`);
    this.name = 'ResidencyViolationError';
  }
}

/**
 * Resolve the region a request should run in. No preference → home region. A
 * disallowed preference is pinned home when `pinToHome`, else rejected.
 */
export function resolveRegion(policy: ResidencyPolicy, requestedRegion?: Region): Region {
  if (!requestedRegion) return policy.homeRegion;
  if (isResidencyViolation(policy, requestedRegion)) {
    if (policy.pinToHome) return policy.homeRegion;
    throw new ResidencyViolationError(requestedRegion, policy);
  }
  return requestedRegion;
}
