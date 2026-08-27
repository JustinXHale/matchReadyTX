import { dayKeyInZone } from '@/domain/availability';

/** Sheet sync and kickoff parsing use this IANA zone (see sheetParse / csvImport). */
export const DEFAULT_ORG_TIMEZONE = 'America/Chicago';

export function orgTimeZone(timezone?: string | null): string {
  const t = timezone?.trim();
  return t || DEFAULT_ORG_TIMEZONE;
}

function parseIso(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full kickoff label in org local time (matches sheet columns). */
export function formatMatchKickoff(
  iso: string,
  timeZone?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: orgTimeZone(timeZone),
    ...options,
  });
}

export function formatMatchKickoffTime(
  iso: string,
  timeZone?: string | null,
): string {
  const d = parseIso(iso);
  if (!d) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: orgTimeZone(timeZone),
  });
}

export function formatMatchKickoffDate(
  iso: string,
  timeZone?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: orgTimeZone(timeZone),
    ...options,
  });
}

export function formatMatchMonthLabel(
  iso: string,
  timeZone?: string | null,
): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: orgTimeZone(timeZone),
  });
}

/** YYYY-MM for grouping lists by calendar month in org timezone. */
export function matchMonthKey(iso: string, timeZone?: string | null): string {
  return dayKeyInZone(iso, orgTimeZone(timeZone)).slice(0, 7);
}
