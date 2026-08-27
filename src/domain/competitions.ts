import type { Match, OrgSettings, UserProfile } from '@/domain/types';
import { DEFAULT_COMPETITIONS } from '@/domain/types';

/** Competitions this user may see/manage. Empty/omit access = all org competitions. */
export function competitionsForUser(
  org: OrgSettings,
  user: UserProfile | null,
): string[] {
  const orgList =
    org.competitions?.length > 0
      ? org.competitions
      : [...DEFAULT_COMPETITIONS];
  const access = user?.competitionAccess?.filter(Boolean) ?? [];
  if (access.length === 0) return orgList;
  return orgList.filter((c) => access.includes(c));
}

export function matchInCompetition(
  match: Match,
  competition: string | null,
): boolean {
  if (!competition) return true;
  return (match.competition ?? '') === competition;
}

export function filterMatchesByCompetition(
  matches: Match[],
  competition: string | null,
): Match[] {
  if (!competition) return matches;
  return matches.filter((m) => matchInCompetition(m, competition));
}

export function competitionForGender(
  gender: 'men' | 'women',
): string {
  return gender === 'women' ? 'Lonestar Women' : 'Lonestar Men';
}

/** Locations-tab rows with Competition = VENUE are fields only — not clubs. */
export function isVenueOnlyCompetition(competition?: string): boolean {
  const c = (competition ?? '').trim().toLowerCase();
  return c === 'venue' || c === 'venues';
}
