import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import type { RequestableSlot } from '@/domain/types';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { FixtureRequestQueue } from '@/features/scheduler/queues/FixtureRequestQueue';
import {
  MatchQueueList,
  ProposalQueueList,
} from '@/features/scheduler/queues/MatchQueueList';
import { NotificationsQueue } from '@/features/scheduler/queues/NotificationsQueue';
import { RaiseHandQueue } from '@/features/scheduler/queues/RaiseHandQueue';
import { TeamLinkRequestQueue } from '@/features/scheduler/queues/TeamLinkRequestQueue';
import {
  countSchedulerQueues,
  matchesNeedingOfficials,
  matchesNeedingReassignment,
  matchesT72Due,
  pendingFixtureRequests,
  pendingRaiseHandRequests,
  pendingTeamLinkRequests,
  proposalsAwaitingAck,
} from '@/features/scheduler/queues/selectors';
import { isFirebaseConfigured } from '@/services/firebase';
import { persistCrewAssignmentAndEmail } from '@/services/liveAssignment';
import {
  callApproveFixtureRequest,
  callReviewTeamLinkRequest,
  declineFixtureRequestInFirestore,
  defaultOrgId,
  saveMatchCrewAssignment,
} from '@/services/orgData';

function QueueSection({
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

export function SchedulerQueuesPage() {
  const { state, store, dataMode, refresh, currentUser } = useApp();
  const [fixtureBusyId, setFixtureBusyId] = useState<string | null>(null);
  const [teamLinkBusyId, setTeamLinkBusyId] = useState<string | null>(null);

  const counts = useMemo(() => countSchedulerQueues(state), [state]);
  const fixtureReqs = useMemo(
    () => pendingFixtureRequests(state.fixtureRequests),
    [state.fixtureRequests],
  );
  const teamLinkReqs = useMemo(
    () => pendingTeamLinkRequests(state.teamLinkRequests),
    [state.teamLinkRequests],
  );
  const raiseHand = useMemo(
    () => pendingRaiseHandRequests(state.requests),
    [state.requests],
  );
  const needsOfficials = useMemo(
    () => matchesNeedingOfficials(state.matches),
    [state.matches],
  );
  const needsReassignment = useMemo(
    () => matchesNeedingReassignment(state.matches),
    [state.matches],
  );
  const proposals = useMemo(
    () => proposalsAwaitingAck(state.proposals),
    [state.proposals],
  );
  const t72 = useMemo(() => matchesT72Due(state.matches), [state.matches]);
  const notifications = useMemo(
    () => state.notifications.slice(0, 40),
    [state.notifications],
  );

  const onApproveRaiseHand = (id: string, slot?: RequestableSlot) => {
    const before = state.requests.find((r) => r.id === id);
    store.approveRequest(id, slot);
    if (dataMode !== 'live' || !before) return;
    const chosen = slot ?? before.preferredSlot;
    if (!chosen || chosen === 'cmo') {
      const next = store.getState().matches.find((m) => m.id === before.matchId);
      if (next) {
        void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
          console.error('Failed to save CMO approve', err),
        );
      }
      return;
    }
    const next = store.getState().matches.find((m) => m.id === before.matchId);
    if (!next) return;
    void persistCrewAssignmentAndEmail({
      match: next,
      slot: chosen,
      userId: before.userId,
    }).catch((err) => {
      console.error('Failed to save/email raise-hand approve', err);
      window.alert(
        err instanceof Error
          ? `Approved locally, but email/save failed: ${err.message}`
          : 'Approved locally, but email/save failed.',
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

  if (counts.totalActionable === 0 && notifications.length === 0) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h1" size="lg">
          Queues
        </Title>
        <EmptyState titleText="All clear" headingLevel="h3">
          <EmptyStateBody>
            Nothing needs your action right now. Browse Schedule to assign ahead,
            or Org to sync the Sheet.
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Queues
      </Title>
      <p className="rs-match-card__meta">
        Action items for the society assigner. Use the right-column actions when
        you can; open a match for full detail.
      </p>

      <QueueSection
        id="queue-fixture-requests"
        title="Fixture requests"
        count={counts.fixtureRequests}
      >
        <FixtureRequestQueue
          requests={fixtureReqs}
          busyId={fixtureBusyId}
          onApprove={(id) => void onApproveFixture(id)}
          onDecline={(id, reason) => void onDeclineFixture(id, reason)}
        />
      </QueueSection>

      <QueueSection
        id="queue-team-links"
        title="Team Admin links"
        count={counts.teamLinkRequests}
      >
        <TeamLinkRequestQueue
          requests={teamLinkReqs}
          busyId={teamLinkBusyId}
          onApprove={(id) => void onReviewTeamLink(id, 'approve')}
          onDeny={(id, reason) => void onReviewTeamLink(id, 'deny', reason)}
        />
      </QueueSection>

      <QueueSection
        id="queue-raise-hand"
        title="Raise-hand pending"
        count={counts.raiseHand}
      >
        <RaiseHandQueue
          requests={raiseHand}
          onApprove={onApproveRaiseHand}
          onDecline={(id, reason) => store.declineRequest(id, reason)}
        />
      </QueueSection>

      <QueueSection
        id="queue-needs-officials"
        title="Needs officials"
        count={counts.needsOfficials}
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
        count={counts.needsReassignment}
      >
        <MatchQueueList
          matches={needsReassignment}
          emptyText="No slots waiting for reassignment."
          ctaLabel="Reassign"
          urgent
          onAlert={(matchId) => store.sendCoverageAlert(matchId)}
        />
      </QueueSection>

      <QueueSection
        id="queue-proposals"
        title="Proposals awaiting ack"
        count={counts.proposals}
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

      <QueueSection id="queue-t72" title="T-72 due" count={counts.t72}>
        <MatchQueueList
          matches={t72}
          emptyText="No matches in the T-72 window."
          ctaLabel="Review"
        />
      </QueueSection>

      <QueueSection
        id="queue-notifications"
        title="Notifications"
        count={counts.notifications}
      >
        <NotificationsQueue notifications={notifications} />
      </QueueSection>
    </div>
  );
}
