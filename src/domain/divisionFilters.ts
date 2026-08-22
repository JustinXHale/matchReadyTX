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

function optionsFromMatches(matches: Match[]): DivisionFilterOptions {
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

/** Unique filter chips from match facts — only values that appear in the dataset. */
export function divisionFilterOptionsFromMatches(
  matches: Match[],
  competitionFilter?: string | null,
): DivisionFilterOptions {
  const all = optionsFromMatches(matches);
  if (!competitionFilter) return all;
  const scoped = optionsFromMatches(
    matches.filter((m) => m.competition === competitionFilter),
  );
  return {
    competitions: all.competitions,
    levels: scoped.levels,
    genders: scoped.genders,
  };
}

/** Local calendar YYYY-MM-DD for a kickoff instant. */
export function matchLocalCalendarDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoOnCalendarDate(
  iso: string,
  yyyyMmDd: string | null,
): boolean {
  if (!yyyyMmDd) return true;
  return matchLocalCalendarDate(iso) === yyyyMmDd;
}

export function matchOnCalendarDate(
  match: Match,
  yyyyMmDd: string | null,
): boolean {
  return isoOnCalendarDate(match.kickoffAt, yyyyMmDd);
}

export function compareKickoffAsc(
  a: { kickoffAt: string },
  b: { kickoffAt: string },
): number {
  return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
}

export function sortByKickoffAsc<T extends { kickoffAt: string }>(list: T[]): T[] {
  return [...list].sort(compareKickoffAsc);
}

/** Local YYYY-MM-DD from a Date (calendar cells are local midnight). */
export function calendarDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Distinct local calendar days from ISO kickoff timestamps. */
export function uniqueIsoCalendarDates(isos: string[]): string[] {
  const dates = new Set<string>();
  for (const iso of isos) {
    const key = matchLocalCalendarDate(iso);
    if (key) dates.add(key);
  }
  return [...dates].sort();
}

/** Distinct local calendar days that have a kickoff in `matches`. */
export function uniqueMatchCalendarDates(matches: Match[]): string[] {
  return uniqueIsoCalendarDates(matches.map((m) => m.kickoffAt));
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
