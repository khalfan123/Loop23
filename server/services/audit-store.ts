/**
 * ============================================================
 * Enterprise engineering — persistent security audit writer
 *
 * Bridges the compliance-controls SecurityAuditTrail (which is transport-
 * agnostic over an AuditLogWriter) to the platform's existing persistent
 * audit pipeline (logAuditEvent → batched insert into the `audit_logs`
 * table). An in-memory trail is not a SOC2 control; this makes it durable
 * evidence without duplicating the audit store.
 *
 * The mapping SecurityAuditEvent → AuditLogEntry is pure and unit-tested;
 * DbAuditLogWriter just forwards it to logAuditEvent.
 * ============================================================
 */

import { logAuditEvent, type AuditAction, type AuditLogEntry } from './audit-log';
import type { AuditLogWriter, SecurityAuditEvent } from './compliance-controls';

const ACTION_BY_TYPE: Record<SecurityAuditEvent['type'], AuditAction> = {
  data_export: 'gdpr.data_export',
  data_erasure: 'gdpr.data_erasure',
  permission_change: 'compliance.permission_change',
  tenant_access_denied: 'compliance.tenant_access_denied',
  residency_violation: 'compliance.residency_violation',
  auth: 'user.login',
};

/** Pure map from a SecurityAuditEvent to the platform's AuditLogEntry shape. */
export function securityEventToAuditEntry(event: SecurityAuditEvent): AuditLogEntry {
  const action: AuditAction =
    event.type === 'auth' && event.outcome === 'denied'
      ? 'security.unauthorized_access'
      : ACTION_BY_TYPE[event.type];

  return {
    action,
    userId: event.actorUserId,
    targetUserId: event.targetOwnerId,
    resourceType: 'tenant',
    metadata: {
      outcome: event.outcome,
      ...(event.orgId ? { orgId: event.orgId } : {}),
      ...(event.detail ? { detail: event.detail } : {}),
      at: event.at,
    },
    // A denied outcome is at least a warning regardless of the action default.
    ...(event.outcome === 'denied' ? { severity: 'warning' as const } : {}),
  };
}

/** AuditLogWriter that persists security events through the batched audit pipeline. */
export class DbAuditLogWriter implements AuditLogWriter {
  async write(event: SecurityAuditEvent): Promise<void> {
    await logAuditEvent(securityEventToAuditEntry(event));
  }
}
