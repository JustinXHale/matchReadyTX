import { useCallback, useMemo, useState } from 'react';
import {
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  matchMatchesDivisionFilters,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import type { Match, MatchGender } from '@/domain/types';
import type { AppState } from '@/services/demoStore';

export const WORK_QUEUES_BACK = {
  to: '/scheduler/queues/coverage',
  label: 'Queues',
} as const;

export function useWorkDivisionFilters(state: AppState) {
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches, competitionFilter),
    [state.matches, competitionFilter],
  );

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });
  const filtersActive = divisionActive || dateFilter != null;

  const matchPassesDivision = useCallback(
    (m: Match) =>
      matchMatchesDivisionFilters(
        m,
        genderFilter,
        levelFilter,
        competitionFilter,
      ),
    [genderFilter, levelFilter, competitionFilter],
  );

  const filterMatch = useCallback(
    <T,>(
      list: T[],
      matchFor: (item: T) => Match | undefined,
    ) => {
      if (!filtersActive) return list;
      return list.filter((item) => {
        const m = matchFor(item);
        if (m == null) return false;
        if (!matchPassesDivision(m)) return false;
        return matchOnCalendarDate(m, dateFilter);
      });
    },
    [filtersActive, matchPassesDivision, dateFilter],
  );

  const availableDatesFromMatches = useCallback(
    (matches: Match[]) =>
      uniqueMatchCalendarDates(matches.filter(matchPassesDivision)),
    [matchPassesDivision],
  );

  return {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    dateFilter,
    setDateFilter,
    filterOptions,
    divisionActive,
    filtersActive,
    filterMatch,
    availableDatesFromMatches,
  };
}
