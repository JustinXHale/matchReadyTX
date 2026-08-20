import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { FixtureRequestQueue } from '@/features/scheduler/queues/FixtureRequestQueue';
import {
  pendingFixtureRequests,
} from '@/features/scheduler/queues/selectors';
import {
  useRequestDivisionFilters,
  useSchedulerRequestActions,
} from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesFixtureRequestsPage() {
  const { state } = useApp();
  const {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    filterOptions,
    divisionActive,
    filterFixture,
  } = useRequestDivisionFilters(state);
  const { fixtureBusyId, onApproveFixture, onDeclineFixture } =
    useSchedulerRequestActions();

  const fixtureReqs = useMemo(
    () => filterFixture(pendingFixtureRequests(state.fixtureRequests)),
    [state.fixtureRequests, filterFixture],
  );

  if (!divisionActive && fixtureReqs.length === 0) {
    return (
      <EmptyState titleText="No fixture requests" headingLevel="h3">
        <EmptyStateBody>
          There are no pending fixture proposals waiting for review.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        New match proposals submitted by Team Admins for scheduler approval.
      </p>
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        ariaLabel="Filter fixture requests by division"
      />
      {divisionActive && fixtureReqs.length === 0 && (
        <p className="rs-match-card__meta">
          No fixture requests for this division. Clear Men/Women or level chips
          to see everything.
        </p>
      )}
      <FixtureRequestQueue
        requests={fixtureReqs}
        busyId={fixtureBusyId}
        onApprove={(id) => void onApproveFixture(id)}
        onDecline={(id, reason) => void onDeclineFixture(id, reason)}
      />
    </>
  );
}
