import type { FixtureRequest, Match, MatchGender } from './types';
import {
  parseMatchEventType,
  parseMatchFormatChoice,
  parseMatchSide,
  type MatchEventType,
  type MatchFormatChoice,
  type MatchSideChoice,
} from './matchDivision';
import {
  matchInCompetition,
  uniqueDisplayedCompetitions,
} from './competitions';

export type DivisionFilterOptions = {
  genders: MatchGender[];
  levels: string[];
  competitions: string[];
  formats: MatchFormatChoice[];
  eventTypes: MatchEventType[];
  sides: MatchSideChoice[];
};

export type DivisionFilterState = {
  gender: MatchGender | null;
  level: string | null;
  competition: string | null;
  format?: MatchFormatChoice | null;
  eventType?: MatchEventType | null;
  side?: MatchSideChoice | null;
};

export type MultiDivisionFilterState = {
  genders: MatchGender[];
  levels: string[];
  competitions: string[];
  formats: MatchFormatChoice[];
  eventTypes: MatchEventType[];
  sides: MatchSideChoice[];
};

const NON_LEAGUE_LEVELS = new Set(['exhibition', 'tourney', 'tournament']);

const FORMAT_ORDER: MatchFormatChoice[] = ['xvs', '10s', '7s'];
const EVENT_TYPE_ORDER: MatchEventType[] = ['league', 'exhibition', 'tournament'];
const SIDE_ORDER: MatchSideChoice[] = ['1st', '2nd', '3rd'];

export function parseFormatFilterParam(
  raw: string | null,
): MatchFormatChoice | null {
  if (!raw) return null;
  if (raw === '15s' || raw === 'xvs' || raw === 'XVs') return 'xvs';
  if (raw === '10s') return '10s';
  if (raw === '7s') return '7s';
  return null;
}

const EVENT_TYPE_VALUES = new Set<MatchEventType>([
  'league',
  'exhibition',
  'tournament',
]);

export function parseEventTypeFilterParam(
  raw: string | null,
): MatchEventType | null {
  if (raw && EVENT_TYPE_VALUES.has(raw as MatchEventType)) {
    return raw as MatchEventType;
  }
  return null;
}

const SIDE_VALUES = new Set<MatchSideChoice>(['1st', '2nd', '3rd']);

export function parseSideFilterParam(
  raw: string | null,
): MatchSideChoice | null {
  if (raw && SIDE_VALUES.has(raw as MatchSideChoice)) {
    return raw as MatchSideChoice;
  }
  return null;
}

function isLeagueTierLevel(level: string): boolean {
  const trimmed = level.trim();
  if (!trimmed) return false;
  if (NON_LEAGUE_LEVELS.has(trimmed.toLowerCase())) return false;
  return parseMatchFormatChoice({ level: trimmed }) === 'xvs';
}

function sortedFormats(values: Iterable<MatchFormatChoice>): MatchFormatChoice[] {
  const set = new Set(values);
  return FORMAT_ORDER.filter((f) => set.has(f));
}

function sortedEventTypes(values: Iterable<MatchEventType>): MatchEventType[] {
  const set = new Set(values);
  return EVENT_TYPE_ORDER.filter((e) => set.has(e));
}

function sortedSides(values: Iterable<MatchSideChoice>): MatchSideChoice[] {
  const set = new Set(values);
  return SIDE_ORDER.filter((s) => set.has(s));
}

export function divisionFiltersActive(filters: DivisionFilterState): boolean {
  return (
    filters.gender != null ||
    filters.level != null ||
    filters.competition != null ||
    filters.format != null ||
    filters.eventType != null ||
    filters.side != null
  );
}

export function multiDivisionFiltersActive(
  filters: MultiDivisionFilterState,
): boolean {
  return (
    filters.genders.length > 0 ||
    filters.levels.length > 0 ||
    filters.competitions.length > 0 ||
    filters.formats.length > 0 ||
    filters.eventTypes.length > 0 ||
    filters.sides.length > 0
  );
}

function normalizeCompetitionFilter(
  competitionFilter?: string | null | string[],
): string[] {
  if (competitionFilter == null) return [];
  if (Array.isArray(competitionFilter)) return competitionFilter;
  return competitionFilter ? [competitionFilter] : [];
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
  const formats = new Set<MatchFormatChoice>();
  const eventTypes = new Set<MatchEventType>();
  const sides = new Set<MatchSideChoice>();

  for (const m of matches) {
    genders.add(m.gender);
    if (m.level?.trim() && isLeagueTierLevel(m.level)) {
      levels.push(m.level.trim());
    }
    if (m.competition?.trim()) competitions.push(m.competition.trim());
    formats.add(parseMatchFormatChoice(m));
    eventTypes.add(parseMatchEventType(m));
    const side = parseMatchSide(m);
    if (side) sides.add(side);
  }

  return {
    genders: (['men', 'women'] as MatchGender[]).filter((g) => genders.has(g)),
    levels: sortedUnique(levels),
    competitions: uniqueDisplayedCompetitions(competitions),
    formats: sortedFormats(formats),
    eventTypes: sortedEventTypes(eventTypes),
    sides: sortedSides(sides),
  };
}

/** Filter dropdown options derived from values in the match pool. */
export function divisionFilterOptionsFromMatches(
  matches: Match[],
  competitionFilter?: string | null | string[],
): DivisionFilterOptions {
  const all = optionsFromMatches(matches);
  const comps = normalizeCompetitionFilter(competitionFilter);
  if (comps.length === 0) return all;
  const scoped = optionsFromMatches(
    matches.filter((m) => comps.some((c) => matchInCompetition(m, c))),
  );
  return {
    competitions: all.competitions,
    levels: scoped.levels,
    genders: scoped.genders,
    formats: scoped.formats,
    eventTypes: scoped.eventTypes,
    sides: scoped.sides,
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
    formats: [],
    eventTypes: [],
    sides: [],
  };
}

/** Merge options from multiple pools (e.g. matches + fixture requests). */
export function mergeDivisionFilterOptions(
  ...pools: DivisionFilterOptions[]
): DivisionFilterOptions {
  const genders = new Set<MatchGender>();
  const levels: string[] = [];
  const competitions: string[] = [];
  const formats = new Set<MatchFormatChoice>();
  const eventTypes = new Set<MatchEventType>();
  const sides = new Set<MatchSideChoice>();

  for (const pool of pools) {
    for (const g of pool.genders) genders.add(g);
    levels.push(...pool.levels);
    competitions.push(...pool.competitions);
    for (const f of pool.formats) formats.add(f);
    for (const e of pool.eventTypes) eventTypes.add(e);
    for (const s of pool.sides) sides.add(s);
  }

  return {
    genders: (['men', 'women'] as MatchGender[]).filter((g) => genders.has(g)),
    levels: sortedUnique(levels),
    competitions: sortedUnique(competitions),
    formats: sortedFormats(formats),
    eventTypes: sortedEventTypes(eventTypes),
    sides: sortedSides(sides),
  };
}

function genderFromCompetitionName(name: string): MatchGender | null {
  const n = name.trim();
  if (/\bwomen\b|\bfemale\b/i.test(n)) return 'women';
  if (/\bmen\b|\bmale\b/i.test(n)) return 'men';
  return null;
}

/** Competitions like Lone Star Women / Lone Star Men encode gender in the name. */
export function competitionsEncodeGender(competitions: string[]): boolean {
  if (competitions.length === 0) return false;
  return competitions.every((c) => genderFromCompetitionName(c) != null);
}

export function matchMatchesDivisionFilters(
  match: Match,
  genderFilter: MatchGender | null,
  levelFilter: string | null,
  competitionFilter: string | null = null,
  formatFilter: MatchFormatChoice | string | null = null,
  eventTypeFilter: MatchEventType | null = null,
  sideFilter: MatchSideChoice | null = null,
): boolean {
  if (genderFilter && match.gender !== genderFilter) return false;
  if (eventTypeFilter && parseMatchEventType(match) !== eventTypeFilter) {
    return false;
  }
  if (levelFilter) {
    if (parseMatchEventType(match) !== 'league') return false;
    if (match.level !== levelFilter) return false;
  }
  if (sideFilter && parseMatchSide(match) !== sideFilter) return false;
  const wantedFormat =
    typeof formatFilter === 'string'
      ? parseFormatFilterParam(formatFilter)
      : formatFilter;
  if (wantedFormat) {
    const format = parseMatchFormatChoice(match);
    if (format !== wantedFormat) return false;
  }
  if (!matchInCompetition(match, competitionFilter)) return false;
  return true;
}

export function matchMatchesMultiDivisionFilters(
  match: Match,
  filters: MultiDivisionFilterState,
): boolean {
  if (
    filters.genders.length > 0 &&
    !filters.genders.includes(match.gender)
  ) {
    return false;
  }
  if (filters.levels.length > 0 && !filters.levels.includes(match.level)) {
    return false;
  }
  if (filters.eventTypes.length > 0) {
    const eventType = parseMatchEventType(match);
    if (!filters.eventTypes.includes(eventType)) return false;
  }
  if (filters.sides.length > 0) {
    const side = parseMatchSide(match);
    if (!side || !filters.sides.includes(side)) return false;
  }
  if (filters.formats.length > 0) {
    const format = parseMatchFormatChoice(match);
    if (!filters.formats.includes(format)) return false;
  }
  if (filters.competitions.length > 0) {
    const comp = match.competition ?? '';
    if (!filters.competitions.some((c) => matchInCompetition({ competition: comp }, c))) {
      return false;
    }
  }
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
  if (!matchInCompetition({ competition: req.competition }, competitionFilter)) {
    return false;
  }
  return true;
}
