import { describe, it, expect } from 'vitest';
import { securityEventToAuditEntry } from '../../server/services/audit-store';
import type { SecurityAuditEvent } from '../../server/services/compliance-controls';

const at = 1_700_000_000_000;

describe('securityEventToAuditEntry', () => {
  it('maps a GDPR erasure to the persistent audit action + metadata', () => {
    const ev: SecurityAuditEvent = { type: 'data_erasure', actorUserId: 'admin', outcome: 'success', targetOwnerId: 'u1', orgId: 'orgA', at };
    const entry = securityEventToAuditEntry(ev);
    expect(entry.action).toBe('gdpr.data_erasure');
    expect(entry.userId).toBe('admin');
    expect(entry.targetUserId).toBe('u1');
    expect(entry.metadata).toMatchObject({ outcome: 'success', orgId: 'orgA', at });
  });

  it('maps each event type to a distinct audit action', () => {
    const types: SecurityAuditEvent['type'][] = ['data_export', 'data_erasure', 'permission_change', 'tenant_access_denied', 'residency_violation'];
    const actions = types.map(type => securityEventToAuditEntry({ type, actorUserId: 'a', outcome: 'success', at }).action);
    expect(new Set(actions).size).toBe(types.length); // all distinct
  });

  it('promotes a denied outcome to at least warning severity', () => {
    const denied = securityEventToAuditEntry({ type: 'tenant_access_denied', actorUserId: 'u2', outcome: 'denied', at });
    expect(denied.severity).toBe('warning');
    const ok = securityEventToAuditEntry({ type: 'data_export', actorUserId: 'u1', outcome: 'success', at });
    expect(ok.severity).toBeUndefined(); // action default applies
  });

  it('routes a denied auth event to the unauthorized-access action', () => {
    const entry = securityEventToAuditEntry({ type: 'auth', actorUserId: 'u3', outcome: 'denied', at });
    expect(entry.action).toBe('security.unauthorized_access');
  });

  it('omits optional metadata fields that are absent', () => {
    const entry = securityEventToAuditEntry({ type: 'data_export', actorUserId: 'u1', outcome: 'success', at });
    expect('orgId' in (entry.metadata as object)).toBe(false);
    expect('detail' in (entry.metadata as object)).toBe(false);
  });
});
