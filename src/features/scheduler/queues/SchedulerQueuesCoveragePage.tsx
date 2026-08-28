import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { MatchQueueList } from '@/features/scheduler/queues/MatchQueueList';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import { useSchedulerRequestActions } from '@/features/scheduler/queues/requestQueuePagesShared';
import {
  matchesNeedingOfficials,
  matchesNeedingReassignment,
} from '@/features/scheduler/queues/selectors';
import { useWorkDivisionFilters } from '@/features/scheduler/queues/workQueuePagesShared';

export function SchedulerQueuesCoveragePage() {
  const { state, store } = useApp();
  const { onApproveRaiseHand, onDeclineRaiseHand } =
    useSchedulerRequestActions();
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
    filterMatch,
    availableDatesFromMatches,
  } = useWorkDivisionFilters(state);

  const officialsPool = useMemo(
    () => matchesNeedingOfficials(state.matches),
    [state.matches],
  );
  const reassignPool = useMemo(
    () => matchesNeedingReassignment(state.matches),
    [state.matches],
  );

  const availableDates = useMemo(
    () => availableDatesFromMatches([...officialsPool, ...reassignPool]),
    [availableDatesFromMatches, officialsPool, reassignPool],
  );

  const needsOfficials = useMemo(
    () => filterMatch(officialsPool, (m) => m),
    [officialsPool, filterMatch],
  );
  const needsReassignment = useMemo(
    () => filterMatch(reassignPool, (m) => m),
    [reassignPool, filterMatch],
  );

  const filteredTotal = needsOfficials.length + needsReassignment.length;

  if (!filtersActive && filteredTotal === 0) {
    return (
      <EmptyState titleText="Coverage is clear" headingLevel="h3">
        <EmptyStateBody>
          Every released match has officials assigned and nothing needs
          reassignment.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Assign open crew slots and review raise-hand volunteers in context.
        Officials who raised their hand appear under each match. Use Schedule to
        browse the full calendar.
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
        availableDates={availableDates}
        ariaLabel="Filter coverage queues by division"
      />
      {filtersActive && filteredTotal === 0 && (
        <p className="rs-match-card__meta">
          No coverage items for these filters. Clear competition, date, or chips
          to see everything.
        </p>
      )}

      <QueueSection
        id="queue-reassignment"
        title="Needs reassignment"
        count={needsReassignment.length}
      >
        <MatchQueueList
          matches={needsReassignment}
          emptyText="No slots waiting for reassignment."
          ctaLabel="Reassign"
          assignOpenSlots
          showRaiseHandRequests
          onApproveRaiseHand={onApproveRaiseHand}
          onDeclineRaiseHand={onDeclineRaiseHand}
          urgent
          onAlert={(matchId) => store.sendCoverageAlert(matchId)}
        />
      </QueueSection>

      <QueueSection
        id="queue-needs-officials"
        title="Needs officials"
        count={needsOfficials.length}
      >
        <MatchQueueList
          matches={needsOfficials}
          emptyText="All crew slots are filled (except optional CMO)."
          ctaLabel="Assign"
          assignOpenSlots
          showRaiseHandRequests
          onApproveRaiseHand={onApproveRaiseHand}
          onDeclineRaiseHand={onDeclineRaiseHand}
          onAlert={(matchId) => store.sendCoverageAlert(matchId)}
        />
      </QueueSection>
    </>
  );
}
