import { useState } from 'react';
import {
  Button,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { formatMemberCityState, officialEffectiveLevel } from '@/domain/members';
import {
  approvalSlotsForRaiseHand,
  gameRequestPreferredSlots,
} from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  REQUESTABLE_SLOT_SHORT,
  type GameRequest,
  type RequestableSlot,
  type UserProfile,
} from '@/domain/types';
import { useOfficialQuickLook } from '@/features/scheduler/officialQuickLookContext';
import { MatchListRow } from '@/ui/MatchListRow';

function formatPreferredSlots(request: GameRequest): string {
  const slots = gameRequestPreferredSlots(request);
  if (slots.length === 0) return 'Position TBD';
  return slots.map((s) => REQUESTABLE_SLOT_LABELS[s]).join(' · ');
}

const QUEUES_BACK = {
  to: '/scheduler/queues/requests/raise-hand',
  label: 'Raise-hand',
} as const;

export function RaiseHandQueue({
  requests,
  onApprove,
  onDecline,
}: {
  requests: GameRequest[];
  onApprove: (id: string, slot: RequestableSlot) => void;
  onDecline: (id: string, reason?: string) => void;
}) {
  const { state } = useApp();
  const { openOfficial } = useOfficialQuickLook();
  const [declineTarget, setDeclineTarget] = useState<GameRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<GameRequest | null>(null);
  const [approveSlot, setApproveSlot] = useState<RequestableSlot | ''>('');

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending raise-hand requests.</p>
    );
  }

  const closeDecline = () => {
    setDeclineTarget(null);
    setDeclineReason('');
  };

  const confirmDecline = () => {
    if (!declineTarget) return;
    const reason = declineReason.trim();
    onDecline(declineTarget.id, reason || undefined);
    closeDecline();
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveSlot('');
  };

  const openApprove = (request: GameRequest) => {
    const match = state.matches.find((m) => m.id === request.matchId);
    if (!match) return;
    const slots = approvalSlotsForRaiseHand(match, request);
    if (slots.length === 0) {
      window.alert('No open slots match this request anymore.');
      return;
    }
    if (slots.length === 1) {
      onApprove(request.id, slots[0]);
      return;
    }
    setApproveTarget(request);
    setApproveSlot(slots[0] ?? '');
  };

  const confirmApprove = () => {
    if (!approveTarget || !approveSlot) return;
    onApprove(approveTarget.id, approveSlot);
    closeApprove();
  };

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
            onApprove={() => openApprove(r)}
            onDecline={() => {
              if (matchMissing) {
                onDecline(r.id, 'Match removed from schedule');
                return;
              }
              setDeclineReason('');
              setDeclineTarget(r);
            }}
            onOpenProfile={() => {
              openOfficial(r.userId, { matchBack: QUEUES_BACK });
            }}
          />
          );
        })}
      </ul>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(declineTarget)}
        onClose={closeDecline}
        aria-labelledby="decline-request-title"
        aria-describedby="decline-request-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="decline-request-title" size="lg">
            Decline request?
          </Title>
        </ModalHeader>
        <ModalBody>
          {declineTarget && (
            <>
              <p id="decline-request-desc" className="rs-modal-lede">
                Decline{' '}
                <strong>{declineTarget.userName}</strong>
                {gameRequestPreferredSlots(declineTarget).length > 0
                  ? ` for ${formatPreferredSlots(declineTarget)}`
                  : ''}
                ? You can leave an optional reason for the official.
              </p>
              <FormGroup label="Reason (optional)" fieldId="decline-reason">
                <TextArea
                  id="decline-reason"
                  value={declineReason}
                  onChange={(_, v) => setDeclineReason(v)}
                  rows={3}
                  resizeOrientation="vertical"
                  aria-label="Decline reason"
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeDecline}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={confirmDecline}>
            Decline
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(approveTarget)}
        onClose={closeApprove}
        aria-labelledby="approve-request-title"
        aria-describedby="approve-request-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="approve-request-title" size="lg">
            Assign to role
          </Title>
        </ModalHeader>
        <ModalBody>
          {approveTarget && (
            <>
              <p id="approve-request-desc" className="rs-modal-lede">
                Place <strong>{approveTarget.userName}</strong> in which open
                role?
              </p>
              <FormGroup label="Role" isRequired fieldId="approve-slot">
                <div
                  className="rs-slot-picker"
                  role="radiogroup"
                  aria-label="Assign to role"
                >
                  {(() => {
                    const match = state.matches.find(
                      (m) => m.id === approveTarget.matchId,
                    );
                    const slots = match
                      ? approvalSlotsForRaiseHand(match, approveTarget)
                      : [];
                    return slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={approveSlot === s}
                        className={`rs-filter-chip${
                          approveSlot === s ? ' rs-filter-chip--selected' : ''
                        }`}
                        onClick={() => setApproveSlot(s)}
                      >
                        {REQUESTABLE_SLOT_SHORT[s]}
                      </button>
                    ));
                  })()}
                </div>
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeApprove}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            isDisabled={!approveSlot}
            onClick={confirmApprove}
          >
            Approve
          </Button>
        </ModalFooter>
      </Modal>
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
          <Button
            size="sm"
            variant="danger"
            onClick={onDecline}
          >
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
