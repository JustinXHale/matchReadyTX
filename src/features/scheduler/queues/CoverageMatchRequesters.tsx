import { useMemo, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  ModalVariant,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  formatMemberCityState,
  memberListName,
  officialEffectiveLevel,
} from '@/domain/members';
import { gameRequestPreferredSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  type GameRequest,
  type Match,
  type RequestableSlot,
  type UserProfile,
} from '@/domain/types';
import { useOfficialQuickLook } from '@/features/scheduler/officialQuickLookContext';
import { useRaiseHandRequestModals } from '@/features/scheduler/queues/useRaiseHandRequestModals';
import type { BackNav } from '@/nav/backNav';

const PREVIEW_NAME_COUNT = 2;

function formatRequestSlots(request: GameRequest): string {
  const slots = gameRequestPreferredSlots(request);
  if (slots.length === 0) return 'TBD';
  return slots.map((s) => REQUESTABLE_SLOT_SHORT[s]).join(', ');
}

function requesterLabel(
  request: GameRequest,
  user: UserProfile | undefined,
): string {
  const name = user ? memberListName(user) : request.userName;
  const level = user != null ? officialEffectiveLevel(user) : null;
  return level != null ? `${name} · Gr. ${level}` : name;
}

function summarizeRequesters(
  requests: GameRequest[],
  users: UserProfile[],
): string {
  const preview = requests.slice(0, PREVIEW_NAME_COUNT).map((request) => {
    const user = users.find((u) => u.uid === request.userId);
    const name = user ? memberListName(user) : request.userName;
    const level = user != null ? officialEffectiveLevel(user) : null;
    return level != null ? `${name} (${level})` : name;
  });
  if (requests.length <= PREVIEW_NAME_COUNT) {
    return preview.join(', ');
  }
  return `${preview.join(', ')}, +${requests.length - PREVIEW_NAME_COUNT} more`;
}

function RaiseHandRequesterRow({
  request,
  user,
  matchBack,
  onApprove,
  onDecline,
  compact = false,
}: {
  request: GameRequest;
  user: UserProfile | undefined;
  matchBack: BackNav;
  onApprove: () => void;
  onDecline: () => void;
  compact?: boolean;
}) {
  const { openOfficial } = useOfficialQuickLook();
  const name = requesterLabel(request, user);
  const slots = formatRequestSlots(request);
  const cityState = user ? formatMemberCityState(user) : null;

  return (
    <li className="rs-raise-hand-footer__row">
      <span className="rs-pill rs-pill--warn rs-raise-hand-footer__slot">
        {slots}
      </span>
      <button
        type="button"
        className="rs-raise-hand-footer__name"
        onClick={() => openOfficial(request.userId, { matchBack })}
      >
        <span className="rs-raise-hand-footer__name-line">{name}</span>
        {!compact && cityState ? (
          <span className="rs-raise-hand-footer__city">{cityState}</span>
        ) : null}
      </button>
      <div className="rs-raise-hand-footer__actions">
        <Button size="sm" variant="primary" onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="danger" onClick={onDecline}>
          Decline
        </Button>
      </div>
      {!compact && request.note ? (
        <p className="rs-coverage-requesters__meta rs-raise-hand-footer__note">
          “{request.note}”
        </p>
      ) : null}
    </li>
  );
}

export function CoverageMatchRequesters({
  match,
  requests,
  matchBack,
  onApprove,
  onDecline,
}: {
  match: Match;
  requests: GameRequest[];
  matchBack: BackNav;
  onApprove: (id: string, slot?: RequestableSlot) => void;
  onDecline: (id: string, reason?: string) => void;
}) {
  const { state } = useApp();
  const [reviewOpen, setReviewOpen] = useState(false);
  const { startApprove, startDecline, modals } = useRaiseHandRequestModals(
    onApprove,
    onDecline,
  );

  const summary = useMemo(
    () => summarizeRequesters(requests, state.users),
    [requests, state.users],
  );

  if (requests.length === 0) return null;

  return (
    <>
      <div className="rs-coverage-requesters" aria-label="Raise-hand requests">
        <button
          type="button"
          className="rs-coverage-requesters__summary-hit"
          onClick={() => setReviewOpen(true)}
          aria-label={`Review ${requests.length} raise-hand ${requests.length === 1 ? 'volunteer' : 'volunteers'}`}
        >
          <div className="rs-coverage-requesters__summary-main">
            <span className="rs-coverage-requesters__label">Raise-hand</span>
            <span className="rs-coverage-requesters__headline">
              {requests.length}{' '}
              {requests.length === 1 ? 'volunteer' : 'volunteers'}
            </span>
            <span className="rs-coverage-requesters__preview">{summary}</span>
            <span className="rs-coverage-requesters__hint">
              Tap to review and approve one per open slot
            </span>
          </div>
          <span className="rs-coverage-requesters__cta" aria-hidden>
            Review
          </span>
        </button>
      </div>

      <Modal
        variant={ModalVariant.medium}
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        aria-labelledby="coverage-raise-hand-title"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="coverage-raise-hand-title" size="lg">
            Raise-hand ({requests.length})
          </Title>
          <p className="rs-modal-lede">
            {match.homeTeamName} vs {match.awayTeamName}. Approve one official
            for each open slot; decline or ignore the rest.
          </p>
        </ModalHeader>
        <ModalBody className="rs-coverage-requesters-modal">
          <ul className="rs-raise-hand-footer">
            {requests.map((request) => (
              <RaiseHandRequesterRow
                key={request.id}
                request={request}
                user={state.users.find((u) => u.uid === request.userId)}
                matchBack={matchBack}
                onApprove={() => startApprove(request)}
                onDecline={() => startDecline(request)}
              />
            ))}
          </ul>
        </ModalBody>
      </Modal>

      {modals}
    </>
  );
}
