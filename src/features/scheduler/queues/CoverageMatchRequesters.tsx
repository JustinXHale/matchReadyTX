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
  const level = officialEffectiveLevel(user);
  return level != null ? `${name} · Gr. ${level}` : name;
}

function summarizeRequesters(
  requests: GameRequest[],
  users: UserProfile[],
): string {
  const preview = requests.slice(0, PREVIEW_NAME_COUNT).map((request) => {
    const user = users.find((u) => u.uid === request.userId);
    const name = user ? memberListName(user) : request.userName;
    const level = officialEffectiveLevel(user);
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
    <li className="rs-coverage-requesters__item">
      <div className="rs-coverage-requesters__main">
        <div className="rs-coverage-requesters__title-row">
          <button
            type="button"
            className="rs-coverage-requesters__name"
            onClick={() => openOfficial(request.userId, { matchBack })}
          >
            {name}
          </button>
          <span className="rs-pill rs-pill--warn rs-coverage-requesters__slot">
            {slots}
          </span>
        </div>
        {!compact && (cityState || request.note) ? (
          <p className="rs-coverage-requesters__meta">
            {[cityState, request.note ? `“${request.note}”` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="rs-coverage-requesters__actions">
        <Button size="sm" variant="primary" onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" onClick={onDecline}>
          Decline
        </Button>
        <Button
          size="sm"
          variant="link"
          isInline
          onClick={() => openOfficial(request.userId, { matchBack })}
        >
          Profile
        </Button>
      </div>
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

  const single = requests.length === 1;
  const onlyRequest = single ? requests[0] : null;
  const onlyUser =
    onlyRequest != null
      ? state.users.find((u) => u.uid === onlyRequest.userId)
      : undefined;

  return (
    <>
      <div className="rs-coverage-requesters" aria-label="Raise-hand requests">
        {single && onlyRequest ? (
          <ul className="rs-coverage-requesters__list">
            <RaiseHandRequesterRow
              request={onlyRequest}
              user={onlyUser}
              matchBack={matchBack}
              onApprove={() => startApprove(onlyRequest)}
              onDecline={() => startDecline(onlyRequest)}
              compact
            />
          </ul>
        ) : (
          <button
            type="button"
            className="rs-coverage-requesters__summary-hit"
            onClick={() => setReviewOpen(true)}
            aria-label={`Review ${requests.length} raise-hand volunteers`}
          >
            <div className="rs-coverage-requesters__summary-main">
              <span className="rs-coverage-requesters__label">Raise-hand</span>
              <span className="rs-coverage-requesters__headline">
                {requests.length} volunteers
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
        )}
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
          <ul className="rs-coverage-requesters__list">
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
