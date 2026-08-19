import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  divisionFilterOptionsFromFixtureRequests,
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  mergeDivisionFilterOptions,
} from '@/domain/divisionFilters';
import type { MatchGender, RequestableSlot } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { FixtureRequestQueue } from '@/features/scheduler/queues/FixtureRequestQueue';
import { RaiseHandQueue } from '@/features/scheduler/queues/RaiseHandQueue';
import { TeamLinkRequestQueue } from '@/features/scheduler/queues/TeamLinkRequestQueue';
import {
  fixtureMatchesDivisionFilters,
  matchMatchesDivisionFilters,
  pendingFixtureRequests,
  pendingRaiseHandRequests,
  pendingTeamLinkRequests,
} from '@/features/scheduler/queues/selectors';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callApproveFixtureRequest,
  callReviewTeamLinkRequest,
  declineFixtureRequestInFirestore,
  defaultOrgId,
} from '@/services/orgData';
import {
  approveRaiseHandRequest,
  declineRaiseHandRequest,
} from '@/features/scheduler/queues/raiseHandActions';

function RequestSection({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rs-queue-section" aria-labelledby={id}>
      <Title
        headingLevel="h3"
        size="md"
        id={id}
        className="rs-queue-section__title"
      >
        {title}
        {count > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(count)}
          </span>
        )}
      </Title>
      {children}
    </section>
  );
}

export function SchedulerQueuesRequestsPage() {
  const { state, store, dataMode, refresh, currentUser } = useApp();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [fixtureBusyId, setFixtureBusyId] = useState<string | null>(null);
  const [teamLinkBusyId, setTeamLinkBusyId] = useState<string | null>(null);

  const filterOptions = useMemo(
    () =>
      mergeDivisionFilterOptions(
        divisionFilterOptionsFromMatches(state.matches),
        divisionFilterOptionsFromFixtureRequests(
          pendingFixtureRequests(state.fixtureRequests),
        ),
      ),
    [state.matches, state.fixtureRequests],
  );
  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });

  const fixtureReqs = useMemo(() => {
    const pending = pendingFixtureRequests(state.fixtureRequests);
    if (!divisionActive) return pending;
    return pending.filter((r) =>
      fixtureMatchesDivisionFilters(
        r,
        genderFilter,
        levelFilter,
        competitionFilter,
      ),
    );
  }, [
    state.fixtureRequests,
    divisionActive,
    genderFilter,
    levelFilter,
    competitionFilter,
  ]);

  const teamLinkReqs = useMemo(
    () => pendingTeamLinkRequests(state.teamLinkRequests),
    [state.teamLinkRequests],
  );

  const raiseHand = useMemo(() => {
    const pending = pendingRaiseHandRequests(state.requests);
    if (!divisionActive) return pending;
    return pending.filter((r) => {
      const match = state.matches.find((m) => m.id === r.matchId);
      return (
        match != null &&
        matchMatchesDivisionFilters(
          match,
          genderFilter,
          levelFilter,
          competitionFilter,
        )
      );
    });
  }, [
    state.requests,
    state.matches,
    divisionActive,
    genderFilter,
    levelFilter,
    competitionFilter,
  ]);

  const onApproveRaiseHand = (id: string, slot?: RequestableSlot) => {
    void approveRaiseHandRequest({
      store,
      dataMode,
      requestId: id,
      slot,
    }).catch((err) => {
      console.error('Failed to save/email raise-hand approve', err);
      window.alert(
        err instanceof Error
          ? `Approved locally, but save failed: ${err.message}`
          : 'Approved locally, but save failed.',
      );
    });
  };

  const onApproveFixture = async (id: string) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    setFixtureBusyId(id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callApproveFixtureRequest({ requestId: id });
        refresh();
      } else {
        store.approveFixtureRequest(id, reviewerId);
        refresh();
      }
    } catch (err) {
      console.error('Approve fixture failed', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to approve fixture request.',
      );
    } finally {
      setFixtureBusyId(null);
    }
  };

  const onDeclineFixture = async (id: string, reason?: string) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    store.declineFixtureRequest(id, reviewerId, reason);
    refresh();
    if (dataMode === 'live' && isFirebaseConfigured) {
      try {
        await declineFixtureRequestInFirestore(
          defaultOrgId(),
          id,
          reviewerId,
          reason,
        );
      } catch (err) {
        console.error('Decline fixture failed', err);
        window.alert(
          err instanceof Error
            ? err.message
            : 'Failed to save decline to Firestore.',
        );
      }
    }
  };

  const onReviewTeamLink = async (
    id: string,
    decision: 'approve' | 'deny',
    reason?: string,
  ) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    setTeamLinkBusyId(id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callReviewTeamLinkRequest({
          requestId: id,
          decision,
          denyReason: reason,
        });
        refresh();
      } else {
        store.reviewTeamLinkRequest(id, reviewerId, decision, reason);
        refresh();
      }
    } catch (err) {
      console.error('Team link review failed', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to review Team Admin request.',
      );
    } finally {
      setTeamLinkBusyId(null);
    }
  };

  const totalRequests = fixtureReqs.length + teamLinkReqs.length + raiseHand.length;

  return (
    <>
      <p className="rs-match-card__meta">
        Requests needing scheduler review: fixture proposals, Team Admin link
        requests, and referee raise-hand requests.
      </p>
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        ariaLabel="Filter requests by division"
      />
      {divisionActive && totalRequests === 0 && (
        <p className="rs-match-card__meta">
          No request items for this division. Clear Men/Women or level chips to
          see everything.
        </p>
      )}
      {!divisionActive && totalRequests === 0 && (
        <EmptyState titleText="No pending requests" headingLevel="h3">
          <EmptyStateBody>
            There are no fixture, Team Admin, or raise-hand requests waiting for
            review.
          </EmptyStateBody>
        </EmptyState>
      )}

      <RequestSection
        id="requests-fixture"
        title="Fixture requests"
        count={fixtureReqs.length}
      >
        <FixtureRequestQueue
          requests={fixtureReqs}
          busyId={fixtureBusyId}
          onApprove={(id) => void onApproveFixture(id)}
          onDecline={(id, reason) => void onDeclineFixture(id, reason)}
        />
      </RequestSection>

      <RequestSection
        id="requests-team-links"
        title="Team Admin links"
        count={teamLinkReqs.length}
      >
        <TeamLinkRequestQueue
          requests={teamLinkReqs}
          busyId={teamLinkBusyId}
          onApprove={(id) => void onReviewTeamLink(id, 'approve')}
          onDeny={(id, reason) => void onReviewTeamLink(id, 'deny', reason)}
        />
      </RequestSection>

      <RequestSection
        id="requests-raise-hand"
        title="Raise-hand pending"
        count={raiseHand.length}
      >
        <RaiseHandQueue
          requests={raiseHand}
          onApprove={onApproveRaiseHand}
          onDecline={(id, reason) =>
            void declineRaiseHandRequest({
              store,
              dataMode,
              requestId: id,
              reason,
            }).catch((err) => console.error('Decline raise-hand failed', err))
          }
        />
      </RequestSection>
    </>
  );
}
