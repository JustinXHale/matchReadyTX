import { Button } from '@patternfly/react-core';
import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { gameRequestPreferredSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  type GameRequest,
  type RequestableSlot,
} from '@/domain/types';
import { CoverageMatchCrewSummary } from '@/features/scheduler/queues/CoverageMatchCrewSummary';
import { CoverageMatchRequesters } from '@/features/scheduler/queues/CoverageMatchRequesters';
import { MatchListRow } from '@/ui/MatchListRow';

function formatPreferredSlotsLong(request: GameRequest): string {
  const slots = gameRequestPreferredSlots(request);
  if (slots.length === 0) return 'Position TBD';
  return slots.map((s) => REQUESTABLE_SLOT_LABELS[s]).join(' · ');
}

const QUEUES_BACK = {
  to: '/scheduler/schedule/requests/raise-hand',
  label: 'Raise-hand',
} as const;

export function RaiseHandQueue({
  requests,
  onApprove,
  onDecline,
}: {
  requests: GameRequest[];
  onApprove: (id: string, slot?: RequestableSlot) => void;
  onDecline: (id: string, reason?: string) => void;
}) {
  const { state } = useApp();

  const groups = useMemo(() => {
    const byMatch = new Map<string, GameRequest[]>();
    const orphan: GameRequest[] = [];
    for (const request of requests) {
      const match = state.matches.find((m) => m.id === request.matchId);
      if (!match) {
        orphan.push(request);
        continue;
      }
      const list = byMatch.get(request.matchId) ?? [];
      list.push(request);
      byMatch.set(request.matchId, list);
    }
    return { byMatch, orphan };
  }, [requests, state.matches]);

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending raise-hand requests.</p>
    );
  }

  return (
    <>
      <ul className="rs-list">
        {[...groups.byMatch.entries()].map(([matchId, matchRequests]) => {
          const match = state.matches.find((m) => m.id === matchId)!;
          return (
            <li key={matchId} className="rs-coverage-match">
              <MatchListRow
                match={match}
                to={`/matches/${matchId}`}
                showTime
                back={QUEUES_BACK}
                topBanner={<CoverageMatchCrewSummary match={match} />}
                footer={
                  <CoverageMatchRequesters
                    match={match}
                    requests={matchRequests}
                    matchBack={QUEUES_BACK}
                    onApprove={onApprove}
                    onDecline={onDecline}
                  />
                }
                meta={
                  matchRequests.length === 1 && matchRequests[0]?.note ? (
                    <span className="rs-list-row__hint">
                      “{matchRequests[0].note}”
                    </span>
                  ) : undefined
                }
              />
            </li>
          );
        })}
        {groups.orphan.map((request) => {
          const user = state.users.find((u) => u.uid === request.userId);
          const name = user?.displayName ?? request.userName;
          return (
            <li key={request.id} className="rs-request-item">
              <div className="rs-request-item__main">
                <strong>{name}</strong>
                <div className="rs-match-card__meta">
                  {formatPreferredSlotsLong(request)} — match no longer on
                  schedule
                  {request.matchId ? ` (${request.matchId})` : ''}
                </div>
              </div>
              <div className="rs-queue-decision__actions">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    onDecline(request.id, 'Match removed from schedule')
                  }
                >
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
