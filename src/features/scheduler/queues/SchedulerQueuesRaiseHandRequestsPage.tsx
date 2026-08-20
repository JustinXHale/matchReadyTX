import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
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
    filterOptions,
    divisionActive,
    filterRaiseHand,
  } = useRequestDivisionFilters(state);
  const { onApproveRaiseHand, onDeclineRaiseHand } =
    useSchedulerRequestActions();

  const raiseHand = useMemo(
    () => filterRaiseHand(pendingRaiseHandRequests(state.requests)),
    [state.requests, filterRaiseHand],
  );

  if (!divisionActive && raiseHand.length === 0) {
    return (
      <EmptyState titleText="No raise-hand requests" headingLevel="h3">
        <EmptyStateBody>
          No referees have raised their hand for an open crew slot.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Referees volunteering for open slots on released matches.
      </p>
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        ariaLabel="Filter raise-hand requests by division"
      />
      {divisionActive && raiseHand.length === 0 && (
        <p className="rs-match-card__meta">
          No raise-hand requests for this division. Clear Men/Women or level
          chips to see everything.
        </p>
      )}
      <RaiseHandQueue
        requests={raiseHand}
        onApprove={onApproveRaiseHand}
        onDecline={onDeclineRaiseHand}
      />
    </>
  );
}
