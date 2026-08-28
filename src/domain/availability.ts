import type { AvailabilityRange } from './types';

export const DEFAULT_AVAIL_START_HM = '07:00';
export const DEFAULT_AVAIL_END_HM = '21:00';

export type DayAvailabilityState = 'unmarked' | 'available' | 'blocked';

export type TimeWindow = { startHm: string; endHm: string };

export type DayAvailability = {
  dayKey: string;
  state: DayAvailabilityState;
  /** Local time windows when available (sorted by start). */
  windows: TimeWindow[];
  rangeIds: string[];
};

export type KickoffAvailability =
  | 'available'
  | 'outside_window'
  | 'blocked'
  | 'unset';

/** YYYY-MM-DD for an instant in the given IANA timezone. */
export function dayKeyInZone(
  isoOrDate: string | Date,
  timeZone: string,
): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const parts = zonedParts(d, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** HH:mm for an instant in the timezone. */
export function hmInZone(isoOrDate: string | Date, timeZone: string): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const parts = zonedParts(d, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return {
    year: bag.year!,
    month: bag.month!,
    day: bag.day!,
    hour: bag.hour === '24' ? '00' : bag.hour!,
    minute: bag.minute!,
    second: bag.second ?? '00',
  };
}

/**
 * Convert a local civil datetime in `timeZone` to a UTC ISO string.
 * Uses iterative offset correction (handles DST).
 */
export function zonedLocalToUtcIso(
  dayKey: string,
  hm: string,
  timeZone: string,
): string {
  const [ys, ms, ds] = dayKey.split('-').map(Number);
  const [hs, mins] = hm.split(':').map(Number);
  const y = ys!;
  const mo = ms!;
  const day = ds!;
  const h = hs!;
  const mi = mins!;

  // Initial guess: treat as UTC
  let utc = Date.UTC(y, mo - 1, day, h, mi, 0);
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const wanted = Date.UTC(y, mo - 1, day, h, mi, 0);
    utc += wanted - asUtc;
  }
  return new Date(utc).toISOString();
}

/** Full local calendar day as blocked window (00:00–23:59:59.999). */
export function blockedDayRange(
  userId: string,
  dayKey: string,
  timeZone: string,
  id?: string,
): AvailabilityRange {
  return {
    id: id ?? '',
    userId,
    startAt: zonedLocalToUtcIso(dayKey, '00:00', timeZone),
    endAt: zonedLocalToUtcIso(dayKey, '23:59', timeZone),
    kind: 'blocked',
  };
}

export function availableDayRange(
  userId: string,
  dayKey: string,
  timeZone: string,
  window: TimeWindow,
  id?: string,
): AvailabilityRange {
  return {
    id: id ?? '',
    userId,
    startAt: zonedLocalToUtcIso(dayKey, window.startHm, timeZone),
    endAt: zonedLocalToUtcIso(dayKey, window.endHm, timeZone),
    kind: 'available',
  };
}

function rangesForUserDay(
  ranges: AvailabilityRange[],
  userId: string,
  dayKey: string,
  timeZone: string,
): AvailabilityRange[] {
  return ranges.filter((r) => {
    if (r.userId !== userId) return false;
    return dayKeyInZone(r.startAt, timeZone) === dayKey;
  });
}

/** Summarize one calendar day for a user. Blocked wins over available. */
export function dayAvailability(
  ranges: AvailabilityRange[],
  userId: string,
  dayKey: string,
  timeZone: string,
): DayAvailability {
  const mine = rangesForUserDay(ranges, userId, dayKey, timeZone);
  if (mine.length === 0) {
    return { dayKey, state: 'unmarked', windows: [], rangeIds: [] };
  }
  const blocked = mine.filter((r) => r.kind === 'blocked');
  if (blocked.length > 0) {
    return {
      dayKey,
      state: 'blocked',
      windows: [],
      rangeIds: mine.map((r) => r.id),
    };
  }
  const available = mine
    .filter((r) => r.kind === 'available')
    .map((r) => ({
      startHm: hmInZone(r.startAt, timeZone),
      endHm: hmInZone(r.endAt, timeZone),
    }))
    .sort((a, b) => a.startHm.localeCompare(b.startHm));
  if (available.length > 0) {
    return {
      dayKey,
      state: 'available',
      windows: available,
      rangeIds: mine.map((r) => r.id),
    };
  }
  return {
    dayKey,
    state: 'unmarked',
    windows: [],
    rangeIds: mine.map((r) => r.id),
  };
}

/** Map of dayKey → DayAvailability for a month (1–12). */
export function monthDayMap(
  ranges: AvailabilityRange[],
  userId: string,
  year: number,
  month: number,
  timeZone: string,
): Map<string, DayAvailability> {
  const map = new Map<string, DayAvailability>();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    map.set(dayKey, dayAvailability(ranges, userId, dayKey, timeZone));
  }
  return map;
}

function stripUserDay(
  ranges: AvailabilityRange[],
  userId: string,
  dayKey: string,
  timeZone: string,
): AvailabilityRange[] {
  const remove = new Set(
    rangesForUserDay(ranges, userId, dayKey, timeZone).map((r) => r.id),
  );
  return ranges.filter((r) => !remove.has(r.id));
}

function withId(range: AvailabilityRange, nextId: () => string): AvailabilityRange {
  return range.id ? range : { ...range, id: nextId() };
}

/**
 * Set a single day's state. Removes prior ranges for that day for the user.
 * `nextId` used when creating ranges without ids.
 */
export function setDayState(
  ranges: AvailabilityRange[],
  userId: string,
  dayKey: string,
  timeZone: string,
  next:
    | { state: 'unmarked' }
    | { state: 'available'; windows: TimeWindow[] }
    | { state: 'blocked' },
  nextId: () => string = () => `av_${Math.random().toString(36).slice(2, 10)}`,
): AvailabilityRange[] {
  let out = stripUserDay(ranges, userId, dayKey, timeZone);
  if (next.state === 'unmarked') return out;
  if (next.state === 'blocked') {
    out = [
      ...out,
      withId(blockedDayRange(userId, dayKey, timeZone), nextId),
    ];
    return out;
  }
  const windows = next.windows.filter(
    (w) => w.startHm.trim() && w.endHm.trim() && w.startHm < w.endHm,
  );
  for (const w of windows) {
    out = [
      ...out,
      withId(availableDayRange(userId, dayKey, timeZone, w), nextId),
    ];
  }
  return out;
}

/** Tap cycle: unmarked → available → blocked → unmarked. */
export function cycleDayState(
  ranges: AvailabilityRange[],
  userId: string,
  dayKey: string,
  timeZone: string,
  window: TimeWindow = {
    startHm: DEFAULT_AVAIL_START_HM,
    endHm: DEFAULT_AVAIL_END_HM,
  },
  nextId?: () => string,
): AvailabilityRange[] {
  const cur = dayAvailability(ranges, userId, dayKey, timeZone);
  if (cur.state === 'unmarked') {
    return setDayState(
      ranges,
      userId,
      dayKey,
      timeZone,
      { state: 'available', windows: [window] },
      nextId,
    );
  }
  if (cur.state === 'available') {
    return setDayState(
      ranges,
      userId,
      dayKey,
      timeZone,
      { state: 'blocked' },
      nextId,
    );
  }
  return setDayState(
    ranges,
    userId,
    dayKey,
    timeZone,
    { state: 'unmarked' },
    nextId,
  );
}

function eachDayKey(fromDayKey: string, toDayKey: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromDayKey.split('-').map(Number);
  const [ty, tm, td] = toDayKey.split('-').map(Number);
  let t = Date.UTC(fy!, fm! - 1, fd!);
  const end = Date.UTC(ty!, tm! - 1, td!);
  if (end < t) return out;
  while (t <= end) {
    const d = new Date(t);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    );
    t += 86400000;
  }
  return out;
}

/** JS weekday: 0=Sun … 6=Sat for a YYYY-MM-DD (calendar date, not TZ-shifted). */
export function weekdayOfDayKey(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/**
 * Apply pattern on matching weekdays in a date span.
 * - available: opens days (preserves blocked; replaces existing open windows)
 * - blocked: marks days blocked (overwrites open/unmarked)
 */
export function applyWeekdayPattern(
  ranges: AvailabilityRange[],
  userId: string,
  opts: {
    fromDayKey: string;
    toDayKey: string;
    /** 0=Sun … 6=Sat */
    weekdays: number[];
    mode: 'available' | 'blocked';
    startHm?: string;
    endHm?: string;
    timeZone: string;
  },
  nextId?: () => string,
): AvailabilityRange[] {
  const want = new Set(opts.weekdays);
  let out = ranges;
  for (const dayKey of eachDayKey(opts.fromDayKey, opts.toDayKey)) {
    if (!want.has(weekdayOfDayKey(dayKey))) continue;
    if (opts.mode === 'blocked') {
      out = setDayState(
        out,
        userId,
        dayKey,
        opts.timeZone,
        { state: 'blocked' },
        nextId,
      );
      continue;
    }
    const cur = dayAvailability(out, userId, dayKey, opts.timeZone);
    if (cur.state === 'blocked') continue;
    out = setDayState(
      out,
      userId,
      dayKey,
      opts.timeZone,
      {
        state: 'available',
        windows: [
          {
            startHm: opts.startHm ?? DEFAULT_AVAIL_START_HM,
            endHm: opts.endHm ?? DEFAULT_AVAIL_END_HM,
          },
        ],
      },
      nextId,
    );
  }
  return out;
}

/** Remove all of a user's ranges in a calendar month. */
export function clearMonth(
  ranges: AvailabilityRange[],
  userId: string,
  year: number,
  month: number,
  timeZone: string,
): AvailabilityRange[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return ranges.filter((r) => {
    if (r.userId !== userId) return true;
    const key = dayKeyInZone(r.startAt, timeZone);
    return !key.startsWith(prefix);
  });
}

/** Open, block, or clear every matching weekday in a month. */
export function setWeekdayInMonth(
  ranges: AvailabilityRange[],
  userId: string,
  year: number,
  month: number,
  timeZone: string,
  weekdays: number[],
  next:
    | { state: 'unmarked' }
    | { state: 'available'; startHm: string; endHm: string }
    | { state: 'blocked' },
  nextId?: () => string,
): AvailabilityRange[] {
  const want = new Set(weekdays);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let out = ranges;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!want.has(weekdayOfDayKey(dayKey))) continue;
    if (next.state === 'available') {
      const cur = dayAvailability(out, userId, dayKey, timeZone);
      if (cur.state === 'blocked') continue;
      out = setDayState(
        out,
        userId,
        dayKey,
        timeZone,
        {
          state: 'available',
          windows: [{ startHm: next.startHm, endHm: next.endHm }],
        },
        nextId,
      );
    } else if (next.state === 'blocked') {
      out = setDayState(
        out,
        userId,
        dayKey,
        timeZone,
        { state: 'blocked' },
        nextId,
      );
    } else {
      out = setDayState(
        out,
        userId,
        dayKey,
        timeZone,
        { state: 'unmarked' },
        nextId,
      );
    }
  }
  return out;
}

/**
 * Kickoff status for assigners.
 * Blocked that local day wins; available if kickoff falls inside an available window;
 * outside_window if day is open but kickoff outside times; unset if unmarked.
 */
export function kickoffAvailabilityStatus(
  ranges: AvailabilityRange[],
  userId: string,
  kickoffAt: string,
  timeZone: string,
): KickoffAvailability {
  const dayKey = dayKeyInZone(kickoffAt, timeZone);
  const day = dayAvailability(ranges, userId, dayKey, timeZone);
  if (day.state === 'blocked') return 'blocked';
  if (day.state === 'unmarked') return 'unset';
  const kick = new Date(kickoffAt).getTime();
  const mine = rangesForUserDay(ranges, userId, dayKey, timeZone).filter(
    (r) => r.kind === 'available',
  );
  const inWindow = mine.some((r) => {
    const s = new Date(r.startAt).getTime();
    const e = new Date(r.endAt).getTime();
    return kick >= s && kick <= e;
  });
  return inWindow ? 'available' : 'outside_window';
}

/** @deprecated Prefer kickoffAvailabilityStatus — returns true only for in-window available. */
export function rangesOverlapKickoff(
  ranges: AvailabilityRange[],
  kickoffAt: string,
  _windowMinutes = 120,
  timeZone = 'America/Chicago',
  userId?: string,
): boolean {
  if (userId) {
    return (
      kickoffAvailabilityStatus(ranges, userId, kickoffAt, timeZone) ===
      'available'
    );
  }
  // Legacy: all ranges assumed same user
  const uid = ranges[0]?.userId;
  if (!uid) return false;
  return (
    kickoffAvailabilityStatus(ranges, uid, kickoffAt, timeZone) === 'available'
  );
}

export function availabilitySortRank(status: KickoffAvailability): number {
  switch (status) {
    case 'available':
      return 0;
    case 'outside_window':
      return 1;
    case 'unset':
      return 2;
    case 'blocked':
      return 3;
    default:
      return 2;
  }
}

export function availabilityStatusLabel(status: KickoffAvailability): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'outside_window':
      return 'Outside window';
    case 'blocked':
      return 'Blocked';
    case 'unset':
      return 'No availability set';
    default:
      return 'No availability set';
  }
}

export type AssignAvailabilityFilter =
  | 'all'
  | 'available'
  | 'unavailable'
  | 'unset'
  | 'requested';

/** Assign-modal buckets: not available = blocked or outside the kickoff window. */
export function matchesAvailabilityFilter(
  status: KickoffAvailability,
  filter: AssignAvailabilityFilter,
  opts?: { hasPendingRequest?: boolean },
): boolean {
  if (filter === 'requested') return opts?.hasPendingRequest === true;
  if (filter === 'all') return true;
  if (filter === 'available') return status === 'available';
  if (filter === 'unset') return status === 'unset';
  return status === 'blocked' || status === 'outside_window';
}

/** Compact label like 8a–5p */
export function formatHmCompact(hm: string): string {
  const [hStr, mStr] = hm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  const suffix = h >= 12 ? 'p' : 'a';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  if (m === 0) return `${h}${suffix}`;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatDayWindowLabel(startHm?: string, endHm?: string): string {
  if (!startHm || !endHm) return '';
  return `${formatHmCompact(startHm)}–${formatHmCompact(endHm)}`;
}

/** Compact multi-window label, e.g. `7a–10a, 11a–4p`. */
export function formatDayWindowsLabel(windows: TimeWindow[]): string {
  if (!windows.length) return '';
  return windows
    .map((w) => formatDayWindowLabel(w.startHm, w.endHm))
    .filter(Boolean)
    .join(', ');
}
