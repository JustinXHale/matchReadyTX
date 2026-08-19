import type { FixtureRequest, Match, MatchGender } from './types';

export type DivisionFilterOptions = {
  genders: MatchGender[];
  levels: string[];
  competitions: string[];
};

export type DivisionFilterState = {
  gender: MatchGender | null;
  level: string | null;
  competition: string | null;
};

export function divisionFiltersActive(filters: DivisionFilterState): boolean {
  return (
    filters.gender != null ||
    filters.level != null ||
    filters.competition != null
  );
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Unique filter chips from match facts — only values that appear in the dataset. */
export function divisionFilterOptionsFromMatches(
  matches: Match[],
): DivisionFilterOptions {
  const genders = new Set<MatchGender>();
  const levels: string[] = [];
  const competitions: string[] = [];

  for (const m of matches) {
    genders.add(m.gender);
    if (m.level?.trim()) levels.push(m.level.trim());
    if (m.competition?.trim()) competitions.push(m.competition.trim());
  }

  return {
    genders: (['men', 'women'] as MatchGender[]).filter((g) => genders.has(g)),
    levels: sortedUnique(levels),
    competitions: sortedUnique(competitions),
  };
}

export function divisionFilterOptionsFromFixtureRequests(
  requests: FixtureRequest[],
): DivisionFilterOptions {
  const genders = new Set<MatchGender>();
  const levels: string[] = [];
  const competitions: string[] = [];

  for (const r of requests) {
    genders.add(r.gender);
    if (r.level?.trim()) levels.push(r.level.trim());
    if (r.competition?.trim()) competitions.push(r.competition.trim());
  }

  return {
    genders: (['men', 'women'] as MatchGender[]).filter((g) => genders.has(g)),
    levels: sortedUnique(levels),
    competitions: sortedUnique(competitions),
  };
}

/** Merge options from multiple pools (e.g. matches + fixture requests). */
export function mergeDivisionFilterOptions(
  ...pools: DivisionFilterOptions[]
): DivisionFilterOptions {
  const genders = new Set<MatchGender>();
  const levels: string[] = [];
  const competitions: string[] = [];

  for (const pool of pools) {
    for (const g of pool.genders) genders.add(g);
    levels.push(...pool.levels);
    competitions.push(...pool.competitions);
  }

  return {
    genders: (['men', 'women'] as MatchGender[]).filter((g) => genders.has(g)),
    levels: sortedUnique(levels),
    competitions: sortedUnique(competitions),
  };
}

function genderFromCompetitionName(name: string): MatchGender | null {
  const n = name.trim();
  if (/\bwomen\b|\bfemale\b/i.test(n)) return 'women';
  if (/\bmen\b|\bmale\b/i.test(n)) return 'men';
  return null;
}

/** Competitions like Lonestar Women / Lonestar Men encode gender in the name. */
export function competitionsEncodeGender(competitions: string[]): boolean {
  if (competitions.length === 0) return false;
  return competitions.every((c) => genderFromCompetitionName(c) != null);
}

export function matchMatchesDivisionFilters(
  match: Match,
  genderFilter: MatchGender | null,
  levelFilter: string | null,
  competitionFilter: string | null = null,
): boolean {
  if (genderFilter && match.gender !== genderFilter) return false;
  if (levelFilter && match.level !== levelFilter) return false;
  if (competitionFilter && match.competition !== competitionFilter) return false;
  return true;
}

export function fixtureMatchesDivisionFilters(
  req: FixtureRequest,
  genderFilter: MatchGender | null,
  levelFilter: string | null,
  competitionFilter: string | null = null,
): boolean {
  if (genderFilter && req.gender !== genderFilter) return false;
  if (levelFilter && req.level !== levelFilter) return false;
  if (competitionFilter && req.competition !== competitionFilter) return false;
  return true;
}
