import { useMemo } from 'react';
import {
  groupMatchesByMonth,
  splitMatchesByToday,
  type MatchMonthGroup,
} from '@/domain/matchTime';

type KickoffMatchRef = { id: string; kickoffAt: string };

export function useScheduleListSections<T extends KickoffMatchRef>(
  matches: readonly T[],
  timeZone: string,
  collapsePast: boolean,
) {
  return useMemo(() => {
    if (!collapsePast) {
      return {
        upcomingByMonth: groupMatchesByMonth(matches, timeZone),
        pastByMonth: [] as MatchMonthGroup<T>[],
        pastCount: 0,
        showPastCollapsed: false,
      };
    }
    const { upcoming, past } = splitMatchesByToday(matches, timeZone);
    return {
      upcomingByMonth: groupMatchesByMonth(upcoming, timeZone),
      pastByMonth: groupMatchesByMonth(past, timeZone),
      pastCount: past.length,
      showPastCollapsed: past.length > 0,
    };
  }, [matches, timeZone, collapsePast]);
}
