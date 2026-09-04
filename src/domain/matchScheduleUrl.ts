/** Optional Google Drive (or https) link to a tournament bracket / schedule. */

const MAX_SCHEDULE_URL_LENGTH = 500;

/** Match level is tournament-style (Tourney chip, 7s, etc.). */
export function isTournamentMatchLevel(level: string | undefined): boolean {
  const l = (level ?? '').trim().toLowerCase();
  if (!l) return false;
  return (
    l === 'tourney' ||
    l === '7s' ||
    l.includes('tournament') ||
    l.includes('tourney')
  );
}

export function normalizeScheduleUrl(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function isValidScheduleUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SCHEDULE_URL_LENGTH) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateScheduleUrlInput(
  raw?: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const normalized = normalizeScheduleUrl(raw);
  if (!normalized) return { ok: true, value: undefined };
  if (!isValidScheduleUrl(normalized)) {
    return {
      ok: false,
      error: 'Schedule link must be a valid https URL (500 characters or fewer).',
    };
  }
  return { ok: true, value: normalized };
}
