import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { TeamLinkRequestQueue } from '@/features/scheduler/queues/TeamLinkRequestQueue';
import {
  pendingTeamLinkRequests,
  resolvedTeamLinkRequests,
} from '@/features/scheduler/queues/selectors';
import { useSchedulerRequestActions } from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesTeamLinkRequestsPage() {
  const { state } = useApp();
  const { teamLinkBusyId, onReviewTeamLink } = useSchedulerRequestActions();

  const teamLinkReqs = useMemo(
    () => pendingTeamLinkRequests(state.teamLinkRequests),
    [state.teamLinkRequests],
  );

  const teamLinkHistory = useMemo(
    () => resolvedTeamLinkRequests(state.teamLinkRequests),
    [state.teamLinkRequests],
  );

  const reviewerName = (userId: string | undefined) => {
    if (!userId) return undefined;
    return state.users.find((u) => u.uid === userId)?.displayName;
  };

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

      <details className="rs-detail-tools">
        <summary id="team-link-request-history-heading">
          Team link history
          {teamLinkHistory.length > 0 ? ` (${teamLinkHistory.length})` : ''}
        </summary>
        {teamLinkHistory.length === 0 ? (
          <p className="rs-match-card__meta">
            No approved or denied team-link requests yet.
          </p>
        ) : (
          <ul className="rs-history-list">
            {teamLinkHistory.map((r) => {
              const statusLabel =
                r.status === 'approved' ? 'Approved' : 'Denied';
              const reviewedBy = reviewerName(r.reviewedByUserId);
              return (
                <li key={r.id}>
                  <strong>
                    {statusLabel} · {r.requesterName} → {r.teamName}
                  </strong>
                  <div className="rs-match-card__meta">
                    {r.requesterEmail}
                    {r.autoApproved ? ' · Auto-approved' : ''}
                  </div>
                  <div className="rs-match-card__meta">
                    Submitted {new Date(r.createdAt).toLocaleString()}
                    {r.reviewedAt
                      ? ` · ${statusLabel} ${new Date(r.reviewedAt).toLocaleString()}${
                          reviewedBy ? ` by ${reviewedBy}` : ''
                        }`
                      : ''}
                    {r.denyReason ? ` · ${r.denyReason}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </>
  );
}
