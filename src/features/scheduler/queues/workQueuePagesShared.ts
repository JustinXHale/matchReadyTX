import { useCallback, useMemo, useState } from 'react';
import {
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
} from '@/domain/divisionFilters';
import type { MatchGender } from '@/domain/types';
import { matchMatchesDivisionFilters } from '@/features/scheduler/queues/selectors';
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

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches),
    [state.matches],
  );

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });

  const filterMatch = useCallback(
    <T,>(
      list: T[],
      matchFor: (
        item: T,
      ) => Parameters<typeof matchMatchesDivisionFilters>[0] | undefined,
    ) => {
      if (!divisionActive) return list;
      return list.filter((item) => {
        const m = matchFor(item);
        return (
          m != null &&
          matchMatchesDivisionFilters(
            m,
            genderFilter,
            levelFilter,
            competitionFilter,
          )
        );
      });
    },
    [divisionActive, genderFilter, levelFilter, competitionFilter],
  );

  return {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    filterOptions,
    divisionActive,
    filterMatch,
  };
}
