import { useMemo } from 'react';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { TeamLinkRequestQueue } from '@/features/scheduler/queues/TeamLinkRequestQueue';
import { pendingTeamLinkRequests } from '@/features/scheduler/queues/selectors';
import { useSchedulerRequestActions } from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesTeamLinkRequestsPage() {
  const { state } = useApp();
  const { teamLinkBusyId, onReviewTeamLink } = useSchedulerRequestActions();

  const teamLinkReqs = useMemo(
    () => pendingTeamLinkRequests(state.teamLinkRequests),
    [state.teamLinkRequests],
  );

  if (teamLinkReqs.length === 0) {
    return (
      <EmptyState titleText="No Team Admin link requests" headingLevel="h3">
        <EmptyStateBody>
          There are no pending requests to link Team Admin accounts to teams.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="rs-match-card__meta">
        Team Admins requesting access to manage a team roster or schedule.
      </p>
      <TeamLinkRequestQueue
        requests={teamLinkReqs}
        busyId={teamLinkBusyId}
        onApprove={(id) => void onReviewTeamLink(id, 'approve')}
        onDeny={(id, reason) => void onReviewTeamLink(id, 'deny', reason)}
      />
    </>
  );
}
