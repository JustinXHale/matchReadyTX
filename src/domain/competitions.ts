import type { Match, OrgSettings, UserProfile } from '@/domain/types';
import { DEFAULT_COMPETITIONS } from '@/domain/types';

const LONE_STAR_MEN_ALIASES = new Set([
  'lone star men',
  'lonestar men',
  'lone star men’s',
  'lonestar men’s',
  'lone star mens',
  'lonestar mens',
]);

const LONE_STAR_WOMEN_ALIASES = new Set([
  'lone star women',
  'lonestar women',
  'lone star women’s',
  'lonestar women’s',
]);

function foldedCompetition(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\s+/g, ' ');
}

/** User-visible conference/union copy: Lonestar (one word). */
export function displayCompetitionLabel(name: string): string {
  return name.replace(/Lone\s+Star/gi, 'Lonestar');
}

export function isLoneStarMenCompetition(name: string): boolean {
  return LONE_STAR_MEN_ALIASES.has(foldedCompetition(name));
}

export function isLoneStarWomenCompetition(name: string): boolean {
  return LONE_STAR_WOMEN_ALIASES.has(foldedCompetition(name));
}

export function competitionsEqual(a: string, b: string): boolean {
  if (foldedCompetition(a) === foldedCompetition(b)) return true;
  if (isLoneStarMenCompetition(a) && isLoneStarMenCompetition(b)) return true;
  if (isLoneStarWomenCompetition(a) && isLoneStarWomenCompetition(b)) return true;
  return false;
}

/** Deduped user-facing conference names (Lone Star → Lonestar). */
export function uniqueDisplayedCompetitions(names: Iterable<string>): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const label = displayCompetitionLabel(raw.trim());
    if (!label) continue;
    if (!out.some((existing) => competitionsEqual(existing, label))) {
      out.push(label);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

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
  return orgList.filter((c) => access.some((a) => competitionsEqual(a, c)));
}

export function matchInCompetition(
  match: Pick<Match, 'competition'> | { competition?: string },
  competition: string | null,
): boolean {
  if (!competition) return true;
  return competitionsEqual(match.competition ?? '', competition);
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
