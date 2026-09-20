/**
 * Optional per-number inbound routing: VIP bypass and business-hours rejection.
 */

export type WeeklySlot = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  /** "HH:MM" 24h */
  start: string;
  end: string;
};

export type InboundRoutingPolicy = {
  /** IANA timezone e.g. America/New_York */
  timezone?: string;
  /** If true, callers in vipNumbers always pass business-hours checks */
  vipBypassHours?: boolean;
  /** E.164 numbers */
  vipNumbers?: string[];
  weeklyHours?: WeeklySlot[];
  /** When true and outside weeklyHours, reject the call with outsideHoursMessage */
  rejectOutsideHours?: boolean;
  outsideHoursMessage?: string;
};

function parseHm(s: string): { h: number; m: number } | null {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function localDayAndMinutes(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const byType: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') byType[p.type] = p.value;
  }
  const hour = parseInt(byType.hour || '0', 10);
  const minute = parseInt(byType.minute || '0', 10);
  const wd = byType.weekday || 'Sun';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { day: dayMap[wd] ?? 0, minutes: hour * 60 + minute };
}

function isWithinWeeklyHours(
  day: number,
  minutes: number,
  weekly: WeeklySlot[]
): boolean {
  for (const slot of weekly) {
    if (slot.day !== day) continue;
    const st = parseHm(slot.start);
    const en = parseHm(slot.end);
    if (!st || !en) continue;
    const startM = st.h * 60 + st.m;
    const endM = en.h * 60 + en.m;
    if (endM <= startM) {
      if (minutes >= startM || minutes < endM) return true;
    } else if (minutes >= startM && minutes < endM) {
      return true;
    }
  }
  return false;
}

export function evaluateInboundRoutingPolicy(
  policy: InboundRoutingPolicy | null | undefined,
  callerE164: string,
  now: Date
): { action: 'continue' | 'reject'; isVip: boolean; outsideHours: boolean; message?: string } {
  if (!policy || typeof policy !== 'object') {
    return { action: 'continue', isVip: false, outsideHours: false };
  }

  const normCaller = callerE164.replace(/[\s\-()]/g, '');
  const vipSet = new Set(
    (policy.vipNumbers || []).map((n) => n.replace(/[\s\-()]/g, ''))
  );
  const isVip = vipSet.has(normCaller);

  const tz = policy.timezone || 'UTC';
  const weekly = policy.weeklyHours || [];

  let outsideHours = false;
  if (weekly.length > 0) {
    const { day, minutes } = localDayAndMinutes(now, tz);
    outsideHours = !isWithinWeeklyHours(day, minutes, weekly);
  }

  if (outsideHours && policy.rejectOutsideHours) {
    if (isVip && policy.vipBypassHours) {
      return { action: 'continue', isVip: true, outsideHours: true };
    }
    return {
      action: 'reject',
      isVip,
      outsideHours: true,
      message:
        policy.outsideHoursMessage ||
        'Thank you for calling. We are currently closed. Please try again during business hours.',
    };
  }

  return { action: 'continue', isVip, outsideHours };
}
