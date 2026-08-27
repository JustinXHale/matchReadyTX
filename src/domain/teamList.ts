import type { Team } from '@/domain/types';

/** Collapse duplicate roster rows that share display name + competition (e.g. SHSU slug dupes). */
export function dedupeTeamsForPicker<T extends Pick<Team, 'id' | 'name' | 'competition'>>(
  teams: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const team of teams) {
    const key = `${team.name.trim().toLowerCase()}|${(team.competition ?? '').trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, team);
      continue;
    }
    // Prefer canonical abbrev+competition ids (t_shsu_lonestar_men) over slug-only dupes.
    const preferNew =
      team.id.includes('_lonestar_') && !existing.id.includes('_lonestar_');
    if (preferNew) byKey.set(key, team);
  }
  return [...byKey.values()];
}
