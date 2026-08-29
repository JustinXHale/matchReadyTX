import { Button } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { formatMemberCityState, officialEffectiveLevel } from '@/domain/members';
import { gameRequestPreferredSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  type GameRequest,
  type RequestableSlot,
  type UserProfile,
} from '@/domain/types';
import { useOfficialQuickLook } from '@/features/scheduler/officialQuickLookContext';
import { useRaiseHandRequestModals } from '@/features/scheduler/queues/useRaiseHandRequestModals';
import { MatchListRow } from '@/ui/MatchListRow';

function formatPreferredSlots(request: GameRequest): string {
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
  const { openOfficial } = useOfficialQuickLook();
  const { startApprove, startDecline, modals } = useRaiseHandRequestModals(
    onApprove,
    onDecline,
  );

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending raise-hand requests.</p>
    );
  }

  return (
    <>
      <ul className="rs-list">
        {requests.map((r) => {
          const matchMissing = !state.matches.some((m) => m.id === r.matchId);
          return (
            <RaiseHandItem
              key={r.id}
              request={r}
              user={state.users.find((u) => u.uid === r.userId)}
              onApprove={() => startApprove(r)}
              onDecline={() => {
                if (matchMissing) {
                  onDecline(r.id, 'Match removed from schedule');
                  return;
                }
                startDecline(r);
              }}
              onOpenProfile={() => {
                openOfficial(r.userId, { matchBack: QUEUES_BACK });
              }}
            />
          );
        })}
      </ul>
      {modals}
    </>
  );
}

function RaiseHandItem({
  request,
  user,
  onApprove,
  onDecline,
  onOpenProfile,
}: {
  request: GameRequest;
  user: UserProfile | undefined;
  onApprove: () => void;
  onDecline: () => void;
  onOpenProfile: () => void;
}) {
  const { state } = useApp();
  const match = state.matches.find((m) => m.id === request.matchId);
  const slotLabel = formatPreferredSlots(request);
  const name = user?.displayName ?? request.userName;
  const level =
    user != null && officialEffectiveLevel(user) != null
      ? String(officialEffectiveLevel(user))
      : '—';
  const cityState = user ? formatMemberCityState(user) : null;

  if (!match) {
    return (
      <li className="rs-request-item">
        <div className="rs-request-item__main">
          <strong>{name}</strong>
          <div className="rs-match-card__meta">
            {slotLabel} — match no longer on schedule
            {request.matchId ? ` (${request.matchId})` : ''}
          </div>
        </div>
        <div className="rs-queue-decision__actions">
          <Button size="sm" variant="danger" onClick={onDecline}>
            Dismiss
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li>
      <MatchListRow
        match={match}
        to={`/matches/${request.matchId}`}
        showTime
        split="action"
        back={QUEUES_BACK}
        meta={
          request.note ? (
            <span className="rs-list-row__hint">“{request.note}”</span>
          ) : undefined
        }
        trailing={
          <div className="rs-queue-decision">
            <span className="rs-pill rs-pill--ink rs-queue-decision__slot">
              {slotLabel}
            </span>
            <button
              type="button"
              className="rs-queue-decision__name"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenProfile();
              }}
            >
              {name} ({level})
            </button>
            {cityState ? (
              <p className="rs-queue-decision__dist">{cityState}</p>
            ) : null}
            <div className="rs-queue-decision__actions">
              <Button size="sm" variant="primary" onClick={onApprove}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={onDecline}>
                Decline
              </Button>
            </div>
          </div>
        }
      />
    </li>
  );
}
