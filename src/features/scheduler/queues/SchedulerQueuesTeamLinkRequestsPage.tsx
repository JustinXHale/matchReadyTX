import { useMemo } from 'react';
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

  return (
    <>
      <p className="rs-match-card__meta">
        Team Admins requesting access to manage a team roster or schedule.
      </p>
      {teamLinkReqs.length === 0 ? (
        <p className="rs-match-card__meta">
          There are no pending requests to link Team Admin accounts to teams.
        </p>
      ) : (
        <TeamLinkRequestQueue
          requests={teamLinkReqs}
          busyId={teamLinkBusyId}
          onApprove={(id) => void onReviewTeamLink(id, 'approve')}
          onDeny={(id, reason) => void onReviewTeamLink(id, 'deny', reason)}
        />
      )}
    </>
  );
}
