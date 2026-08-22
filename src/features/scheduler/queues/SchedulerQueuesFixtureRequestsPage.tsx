import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { compareKickoffAsc } from '@/domain/divisionFilters';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { FixtureRequestQueue } from '@/features/scheduler/queues/FixtureRequestQueue';
import { pendingFixtureRequests } from '@/features/scheduler/queues/selectors';
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
    dateFilter,
    setDateFilter,
    filterOptions,
    filtersActive,
    filterFixture,
    availableDatesForFixtures,
  } = useRequestDivisionFilters(state);
  const { fixtureBusyId, onApproveFixture, onDeclineFixture } =
    useSchedulerRequestActions();

  const fixtureReqs = useMemo(
    () =>
      [...filterFixture(pendingFixtureRequests(state.fixtureRequests))].sort(
        compareKickoffAsc,
      ),
    [state.fixtureRequests, filterFixture],
  );

  if (!filtersActive && fixtureReqs.length === 0) {
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
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDatesForFixtures}
        ariaLabel="Filter fixture requests by division"
      />
      {filtersActive && fixtureReqs.length === 0 && (
        <p className="rs-match-card__meta">
          No fixture requests for these filters. Clear competition, date, or
          chips to see everything.
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
