/**
 * Relay cleanup monitor.
 *
 * The two-hop human-agent relay path emits a `[Transfer] engine=human-agent-
 * relay-cleanup …` log line every time the customer leg has to be torn down
 * because the agent leg failed (origination error, busy, no-answer, failed,
 * canceled). Until now those events were only visible in raw logs; this
 * service maintains a per-workspace rolling-window counter and fires an
 * in-app alert (workspace owner + admins) when the cleanup rate over a small
 * window crosses a threshold, with per-workspace cooldown to avoid flooding.
 *
 * Counters live in-process. That is intentional: alerts are advisory, the
 * thresholds are small and short-windowed, and any restart simply resets the
 * window. There is no persistence requirement.
 */

import { db } from '../db';
import { calls } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { NotificationService } from './notification-service';
import { dispatchRelayAlert, type RelayAlertPayload } from './relay-alert-channels';

interface Notifier {
  notifyAdmins(title: string, message: string, severity: 'info' | 'warning' | 'critical'): Promise<void>;
  create(opts: { userId: string; type: string; title: string; message: string; link?: string; icon?: string; priority?: number; displayType?: 'bell' | 'banner' | 'both' }): Promise<void>;
}

interface Enricher {
  lookupByCallSid(callSid: string): Promise<{ userId: string | null; transferredTo: string | null; transferRelayPhoneNumber: string | null } | null>;
}

interface ExternalDispatcher {
  dispatch(payload: RelayAlertPayload): Promise<void>;
}

const defaultNotifier: Notifier = NotificationService;
const defaultEnricher: Enricher = {
  async lookupByCallSid(callSid) {
    const rows = await db
      .select({
        userId: calls.userId,
        transferredTo: calls.transferredTo,
        transferRelayPhoneNumber: calls.transferRelayPhoneNumber,
      })
      .from(calls)
      .where(eq(calls.twilioSid, callSid))
      .limit(1);
    return rows[0] ?? null;
  },
};

const defaultDispatcher: ExternalDispatcher = {
  dispatch(payload) {
    return dispatchRelayAlert(payload);
  },
};

let notifier: Notifier = defaultNotifier;
let enricher: Enricher = defaultEnricher;
let externalDispatcher: ExternalDispatcher = defaultDispatcher;

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const THRESHOLD = 3; // > N events in window triggers an alert
const COOLDOWN_MS = 30 * 60 * 1000; // do not re-alert same workspace more than 1×/30min

export type RelayCleanupReason =
  | 'hop2-create-failed'
  | 'hop2-busy'
  | 'hop2-failed'
  | 'hop2-no-answer'
  | 'hop2-canceled';

export interface RelayCleanupEvent {
  /** Inbound parent CallSid (the customer leg that was torn down). */
  callSid: string;
  /** Workspace owner (calls.userId / humanIncomingConnections.userId). May be undefined when lookup fails; counted under '__unknown__'. */
  userId?: string | null;
  /** humanIncomingConnections.id, when known. */
  connectionId?: string | null;
  /** Final agent target (E.164) on hop2. */
  target?: string | null;
  /** Relay number (E.164) used as caller ID on hop2. */
  relay?: string | null;
  /** What caused the cleanup. */
  reason: RelayCleanupReason;
}

interface WindowState {
  events: Array<{ at: number; reason: RelayCleanupReason; callSid: string; target?: string | null; relay?: string | null; connectionId?: string | null }>;
  lastAlertAt: number;
}

const state = new Map<string, WindowState>();

function getState(key: string): WindowState {
  let s = state.get(key);
  if (!s) {
    s = { events: [], lastAlertAt: 0 };
    state.set(key, s);
  }
  return s;
}

function trim(s: WindowState, now: number): void {
  const cutoff = now - WINDOW_MS;
  while (s.events.length && s.events[0].at < cutoff) {
    s.events.shift();
  }
}

/**
 * Record a relay cleanup event. If the rolling window for the workspace
 * crosses the threshold, an in-app notification is sent to the workspace
 * owner and to admins (with a per-workspace cooldown).
 *
 * Safe to call from webhook handlers — it never throws and any DB / lookup
 * failures are caught and logged.
 */
export async function recordRelayCleanup(event: RelayCleanupEvent): Promise<void> {
  try {
    let userId = event.userId ?? null;
    let connectionId = event.connectionId ?? null;
    let target = event.target ?? null;
    let relay = event.relay ?? null;

    // Best-effort enrichment when only the parent CallSid is known
    // (status-callback path). The relay branch in webhook-routes.ts persists
    // userId, transferredTo, transferRelayPhoneNumber on the calls row before
    // hop2 is originated, so a single SELECT is enough.
    if (!userId || !target || !relay) {
      try {
        const row = await enricher.lookupByCallSid(event.callSid);
        if (row) {
          userId = userId ?? row.userId ?? null;
          target = target ?? row.transferredTo ?? null;
          relay = relay ?? row.transferRelayPhoneNumber ?? null;
        }
      } catch (lookupErr: any) {
        console.error(`[RelayCleanupMonitor] enrichment lookup failed for ${event.callSid}: ${lookupErr?.message || lookupErr}`);
      }
    }

    const key = userId || '__unknown__';
    const now = Date.now();
    const s = getState(key);
    trim(s, now);
    s.events.push({ at: now, reason: event.reason, callSid: event.callSid, target, relay, connectionId });

    if (s.events.length <= THRESHOLD) return;
    if (now - s.lastAlertAt < COOLDOWN_MS) return;
    s.lastAlertAt = now;

    const count = s.events.length;
    const reasons = summarizeReasons(s.events.map((e) => e.reason));
    const targets = uniq(s.events.map((e) => e.target).filter(Boolean) as string[]).slice(0, 3);
    const relays = uniq(s.events.map((e) => e.relay).filter(Boolean) as string[]).slice(0, 3);
    const connections = uniq(s.events.map((e) => e.connectionId).filter(Boolean) as string[]).slice(0, 3);

    const workspaceLabel = userId ? `workspace ${userId}` : 'an unknown workspace';
    const message =
      `${count} human-agent relay transfers were torn down in the last ${Math.round(WINDOW_MS / 60000)} min for ${workspaceLabel}. ` +
      `Reasons: ${reasons}. Connection(s): ${connections.length ? connections.join(', ') : 'n/a'}. ` +
      `Agent target(s): ${targets.length ? targets.join(', ') : 'n/a'}. Relay number(s): ${relays.length ? relays.join(', ') : 'n/a'}. ` +
      `This usually means the agent handset is offline, the relay number is misconfigured, or the carrier is rejecting the leg.`;

    console.warn(`[RelayCleanupMonitor] ALERT ${message}`);

    try {
      await notifier.notifyAdmins(
        'Human-agent transfers are failing',
        message,
        'warning',
      );
    } catch (notifyErr: any) {
      console.error(`[RelayCleanupMonitor] notifyAdmins failed: ${notifyErr?.message || notifyErr}`);
    }

    if (userId) {
      try {
        await notifier.create({
          userId,
          type: 'human_relay_failures',
          title: 'Calls are not reaching your human agent',
          message,
          link: '/app/phone-numbers',
          icon: 'alert-triangle',
          priority: 70,
          displayType: 'both',
        });
      } catch (notifyErr: any) {
        console.error(`[RelayCleanupMonitor] owner notify failed: ${notifyErr?.message || notifyErr}`);
      }
    }

    // Out-of-band fan-out (email + workspace webhook). Reuses the same
    // throttling: this branch only runs when the in-app alert fires, which
    // is gated by THRESHOLD + COOLDOWN_MS above.
    try {
      await externalDispatcher.dispatch({
        userId,
        count,
        windowMs: WINDOW_MS,
        reasons,
        targets,
        relays,
        connections,
        message,
        occurredAt: new Date(now).toISOString(),
      });
    } catch (dispatchErr: any) {
      console.error(`[RelayCleanupMonitor] external dispatch failed: ${dispatchErr?.message || dispatchErr}`);
    }
  } catch (err: any) {
    // Never throw out of webhook handlers.
    console.error(`[RelayCleanupMonitor] recordRelayCleanup error: ${err?.message || err}`);
  }
}

function summarizeReasons(reasons: RelayCleanupReason[]): string {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([r, c]) => `${r}×${c}`)
    .join(', ');
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

// ─── Test helpers (not part of the public runtime surface) ───────────────
export const __test__ = {
  reset(): void {
    state.clear();
    notifier = defaultNotifier;
    enricher = defaultEnricher;
    externalDispatcher = defaultDispatcher;
  },
  setNotifier(n: Notifier): void {
    notifier = n;
  },
  setEnricher(e: Enricher): void {
    enricher = e;
  },
  setExternalDispatcher(d: ExternalDispatcher): void {
    externalDispatcher = d;
  },
  snapshot(key: string): WindowState | undefined {
    return state.get(key);
  },
  config: { WINDOW_MS, THRESHOLD, COOLDOWN_MS },
};
