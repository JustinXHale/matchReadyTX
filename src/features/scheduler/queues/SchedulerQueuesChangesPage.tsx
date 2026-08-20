import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { ProposalQueueList } from '@/features/scheduler/queues/MatchQueueList';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import {
  proposalMatchesDivisionFilters,
  proposalsAwaitingAck,
} from '@/features/scheduler/queues/selectors';
import { useWorkDivisionFilters } from '@/features/scheduler/queues/workQueuePagesShared';

export function SchedulerQueuesChangesPage() {
  const { state, store, currentUser } = useApp();
  const {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    filterOptions,
    divisionActive,
  } = useWorkDivisionFilters(state);

  const proposals = useMemo(() => {
    const list = proposalsAwaitingAck(state.proposals);
    if (!divisionActive) return list;
    return list.filter((p) =>
      proposalMatchesDivisionFilters(
        p,
        state.matches,
        genderFilter,
        levelFilter,
        competitionFilter,
      ),
    );
  }, [
    state.proposals,
    state.matches,
    divisionActive,
    genderFilter,
    levelFilter,
    competitionFilter,
  ]);

  if (!divisionActive && proposals.length === 0) {
    return (
      <EmptyState titleText="No pending changes" headingLevel="h3">
        <EmptyStateBody>
          There are no match change proposals waiting for your acknowledgment.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Change proposals submitted by teams or officials that still need
        assigner acknowledgment.
      </p>

      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        ariaLabel="Filter change proposals by division"
      />
      {divisionActive && proposals.length === 0 && (
        <p className="rs-match-card__meta">
          No change proposals for this division. Clear Men/Women or level chips
          to see everything.
        </p>
      )}

      <QueueSection
        id="queue-proposals"
        title="Proposals awaiting ack"
        count={proposals.length}
      >
        {state.org.sheetSyncError && (
          <p className="rs-match-card__meta" role="alert">
            Sheet sync / write-back issue: {state.org.sheetSyncError}. Open
            Upload to fix and sync.
          </p>
        )}
        <ProposalQueueList
          proposals={proposals}
          matches={state.matches}
          emptyText="No change proposals waiting on you."
          onAcknowledge={(id) =>
            store.acknowledgeProposal(id, currentUser?.uid)
          }
        />
      </QueueSection>
    </>
  );
}
