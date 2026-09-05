import { isTournamentMatchLevel } from '@/domain/matchScheduleUrl';
import type { FeeTable, Match, MatchGender } from '@/domain/types';

/** Scheduler fee form — AR rate applies to both AR1 and AR2. */
export type FeeDefaultsInput = {
  mo: number;
  ar: number;
  no4: number;
  cmo: number;
};

export function feeTableFromInput(input: FeeDefaultsInput): FeeTable {
  return {
    mo: input.mo,
    ar1: input.ar,
    ar2: input.ar,
    no4: input.no4,
    cmo: input.cmo,
  };
}

export function feeInputFromTable(table: FeeTable): FeeDefaultsInput {
  return {
    mo: table.mo,
    ar: table.ar1,
    no4: table.no4,
    cmo: table.cmo ?? 0,
  };
}

export function feeOverrideForMatch(
  match: Match,
  league: FeeTable,
  tourney: FeeTable,
): Partial<FeeTable> {
  const base = isTournamentMatchLevel(match.level) ? tourney : league;
  return { ...base };
}

export function matchesForFeeApply(
  matches: Match[],
  opts: {
    periodStart: string;
    periodEnd: string;
    competition?: string | null;
    gender?: MatchGender | null;
  },
): Match[] {
  const startMs = new Date(opts.periodStart).getTime();
  const endMs = new Date(opts.periodEnd).getTime() + 86_400_000 - 1;
  return matches.filter((m) => {
    if (m.status === 'cancelled' || m.status === 'draft') return false;
    const kickoffMs = new Date(m.kickoffAt).getTime();
    if (kickoffMs < startMs || kickoffMs > endMs) return false;
    if (opts.competition && m.competition !== opts.competition) return false;
    if (opts.gender && m.gender !== opts.gender) return false;
    return true;
  });
}
