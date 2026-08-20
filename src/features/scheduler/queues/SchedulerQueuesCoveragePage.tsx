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
    filterOptions,
    divisionActive,
    filterMatch,
  } = useWorkDivisionFilters(state);

  const needsOfficials = useMemo(
    () => filterMatch(matchesNeedingOfficials(state.matches), (m) => m),
    [state.matches, filterMatch],
  );
  const needsReassignment = useMemo(
    () => filterMatch(matchesNeedingReassignment(state.matches), (m) => m),
    [state.matches, filterMatch],
  );
  const t72 = useMemo(
    () => filterMatch(matchesT72Due(state.matches), (m) => m),
    [state.matches, filterMatch],
  );

  const filteredTotal =
    needsOfficials.length + needsReassignment.length + t72.length;

  if (!divisionActive && filteredTotal === 0) {
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
        ariaLabel="Filter coverage queues by division"
      />
      {divisionActive && filteredTotal === 0 && (
        <p className="rs-match-card__meta">
          No coverage items for this division. Clear Men/Women or level chips to
          see everything.
        </p>
      )}

      <QueueSection
        id="queue-needs-officials"
        title="Needs officials"
        count={needsOfficials.length}
      >
        <MatchQueueList
          matches={needsOfficials}
          emptyText="Every released match has a Match Official."
          ctaLabel="Assign"
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
