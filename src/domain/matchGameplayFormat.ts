import type { Match } from '@/domain/types';

export const GAMEPLAY_FORMATS = ['7s', '10s', '15s'] as const;

export type GameplayFormat = (typeof GAMEPLAY_FORMATS)[number];

/** Parse 7s / 10s / 15s from a schedule or display label. */
export function gameplayFormatFromLabel(
  raw?: string | null,
): GameplayFormat | null {
  const text = raw?.trim();
  if (!text) return null;
  const folded = text.toLowerCase();
  if (/\b7s\b|7-a-side|sevens|^7$/.test(folded)) return '7s';
  if (/\b10s\b|10-a-side|^10$/.test(folded)) return '10s';
  if (/\b15s\b|15-a-side|\bxv\b|^15$/.test(folded)) return '15s';
  return null;
}

/** Rugby side count from match labels (match_type, title, level, competition). */
export function matchGameplayFormat(
  match: Partial<Pick<Match, 'matchType' | 'title' | 'level' | 'competition'>>,
): GameplayFormat | null {
  for (const source of [
    match.matchType,
    match.title,
    match.level,
    match.competition,
  ]) {
    const format = gameplayFormatFromLabel(source);
    if (format) return format;
  }
  return null;
}
