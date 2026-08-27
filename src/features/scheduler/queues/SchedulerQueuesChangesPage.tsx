import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { compareKickoffAsc } from '@/domain/divisionFilters';
import type { Match } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { ProposalQueueList } from '@/features/scheduler/queues/MatchQueueList';
import { QueueSection } from '@/features/scheduler/queues/QueueSection';
import { proposalsAwaitingAck } from '@/features/scheduler/queues/selectors';
import { useWorkDivisionFilters } from '@/features/scheduler/queues/workQueuePagesShared';

function matchForProposal(
  matchId: string,
  matches: Match[],
): Match | undefined {
  return matches.find((m) => m.id === matchId);
}

export function SchedulerQueuesChangesPage() {
  const { state, store, currentUser } = useApp();
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

  const pool = useMemo(
    () => proposalsAwaitingAck(state.proposals),
    [state.proposals],
  );

  const availableDates = useMemo(
    () =>
      availableDatesFromMatches(
        pool
          .map((p) => matchForProposal(p.matchId, state.matches))
          .filter((m): m is Match => m != null),
      ),
    [pool, state.matches, availableDatesFromMatches],
  );

  const proposals = useMemo(() => {
    const filtered = filterMatch(pool, (p) =>
      matchForProposal(p.matchId, state.matches),
    );
    return [...filtered].sort((a, b) => {
      const ma = matchForProposal(a.matchId, state.matches);
      const mb = matchForProposal(b.matchId, state.matches);
      if (!ma && !mb) return 0;
      if (!ma) return 1;
      if (!mb) return -1;
      return compareKickoffAsc(ma, mb);
    });
  }, [pool, state.matches, filterMatch]);

  if (!filtersActive && proposals.length === 0) {
    return (
      <EmptyState titleText="No pending changes" headingLevel="h3">
        <EmptyStateBody>
          There are no change proposals waiting for your review or apply.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Change proposals that still need assigner review or apply. Acknowledge
        only dismisses from your queue; apply updates the match and Sheet.
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
        ariaLabel="Filter change proposals by division"
      />
      {filtersActive && proposals.length === 0 && (
        <p className="rs-match-card__meta">
          No change proposals for these filters. Clear competition, date, or
          chips to see everything.
        </p>
      )}

      <QueueSection
        id="queue-proposals"
        title="Proposals to review"
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
          onApply={(id) =>
            store.applyProposalAsAssigner(id, currentUser?.uid)
          }
        />
      </QueueSection>
    </>
  );
}
