import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { MatchQueueList } from '@/features/scheduler/queues/MatchQueueList';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import {
  matchesNeedingOfficials,
  matchesNeedingReassignment,
  matchesT72Due,
} from '@/features/scheduler/queues/selectors';
import { useWorkDivisionFilters } from '@/features/scheduler/queues/workQueuePagesShared';

export function SchedulerQueuesCoveragePage() {
  const { state, store } = useApp();
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
  const t72Pool = useMemo(() => matchesT72Due(state.matches), [state.matches]);

  const availableDates = useMemo(
    () =>
      availableDatesFromMatches([
        ...officialsPool,
        ...reassignPool,
        ...t72Pool,
      ]),
    [availableDatesFromMatches, officialsPool, reassignPool, t72Pool],
  );

  const needsOfficials = useMemo(
    () => filterMatch(officialsPool, (m) => m),
    [officialsPool, filterMatch],
  );
  const needsReassignment = useMemo(
    () => filterMatch(reassignPool, (m) => m),
    [reassignPool, filterMatch],
  );
  const t72 = useMemo(
    () => filterMatch(t72Pool, (m) => m),
    [t72Pool, filterMatch],
  );

  const filteredTotal =
    needsOfficials.length + needsReassignment.length + t72.length;

  if (!filtersActive && filteredTotal === 0) {
    return (
      <EmptyState titleText="Coverage is clear" headingLevel="h3">
        <EmptyStateBody>
          Every released match has officials assigned, nothing needs
          reassignment, and no matches are in the T-72 window.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Matches missing officials, waiting for reassignment, or in the T-72
        confirmation window.
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
        id="queue-needs-officials"
        title="Needs officials"
        count={needsOfficials.length}
      >
        <MatchQueueList
          matches={needsOfficials}
          emptyText="All crew slots are filled (except optional CMO)."
          ctaLabel="Assign"
          assignOpenSlots
          onAlert={(matchId) => store.sendCoverageAlert(matchId)}
        />
      </QueueSection>

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
          urgent
          onAlert={(matchId) => store.sendCoverageAlert(matchId)}
        />
      </QueueSection>

      <QueueSection id="queue-t72" title="T-72 due" count={t72.length}>
        <MatchQueueList
          matches={t72}
          emptyText="No matches in the T-72 window."
          ctaLabel="Review"
        />
      </QueueSection>
    </>
  );
}
