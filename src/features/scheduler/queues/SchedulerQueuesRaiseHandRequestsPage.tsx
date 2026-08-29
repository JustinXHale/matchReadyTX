import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { compareKickoffAsc } from '@/domain/divisionFilters';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { RaiseHandQueue } from '@/features/scheduler/queues/RaiseHandQueue';
import { pendingRaiseHandRequests } from '@/features/scheduler/queues/selectors';
import {
  useRequestDivisionFilters,
  useSchedulerRequestActions,
} from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesRaiseHandRequestsPage() {
  const { state } = useApp();
  const {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    dateFilter,
    setDateFilter,
    filterOptions,
    filtersActive,
    filterRaiseHand,
    availableDatesForRaiseHand,
  } = useRequestDivisionFilters(state);
  const { onApproveRaiseHand, onDeclineRaiseHand } =
    useSchedulerRequestActions();

  const raiseHand = useMemo(() => {
    const filtered = filterRaiseHand(pendingRaiseHandRequests(state.requests));
    return [...filtered].sort((a, b) => {
      const ma = state.matches.find((m) => m.id === a.matchId);
      const mb = state.matches.find((m) => m.id === b.matchId);
      if (!ma && !mb) return 0;
      if (!ma) return 1;
      if (!mb) return -1;
      return compareKickoffAsc(ma, mb);
    });
  }, [state.requests, state.matches, filterRaiseHand]);

  return (
    <>
      <p className="rs-match-card__meta">
        Referees volunteering for open slots on released matches. You can also
        approve or decline from Schedule when viewing that game.
      </p>
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDatesForRaiseHand}
        ariaLabel="Filter raise-hand requests by division"
      />
      {filtersActive && raiseHand.length === 0 ? (
        <p className="rs-match-card__meta">
          No raise-hand requests for these filters. Clear competition, date, or
          chips to see everything.
        </p>
      ) : raiseHand.length === 0 ? (
        <p className="rs-match-card__meta">
          No referees have raised their hand for an open crew slot.
        </p>
      ) : (
        <RaiseHandQueue
          requests={raiseHand}
          onApprove={onApproveRaiseHand}
          onDecline={onDeclineRaiseHand}
        />
      )}
    </>
  );
}
