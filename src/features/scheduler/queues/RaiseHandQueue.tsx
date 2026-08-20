import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { formatMemberCityState } from '@/domain/members';
import type { CoachingReportStub } from '@/services/demoStore';
import {
  CREW_SLOTS,
  REQUESTABLE_SLOT_LABELS,
  crewPeople,
  type GameRequest,
  type Match,
  type RequestableSlot,
  type UserProfile,
} from '@/domain/types';
import { backState } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';
import { UserAvatar } from '@/ui/UserAvatar';

const QUEUES_BACK = {
  to: '/scheduler/queues/requests/raise-hand',
  label: 'Raise-hand',
} as const;

function recentMatchesForOfficial(
  matches: Match[],
  userId: string,
  limit = 5,
): Match[] {
  return matches
    .filter((m) => {
      if ((m.cmo ?? []).some((c) => c.userId === userId)) return true;
      return CREW_SLOTS.some((s) =>
        crewPeople(m.crew[s]).some((a) => a.userId === userId),
      );
    })
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
    .slice(0, limit);
}

function coachingReportsForOfficial(
  reports: CoachingReportStub[],
  userId: string,
): CoachingReportStub[] {
  return reports
    .filter((r) => r.officialId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

function hasMatchScore(match: Match): boolean {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore)
  );
}

function formatScore(match: Match): string {
  if (!hasMatchScore(match)) return '–';
  return `${match.homeScore}–${match.awayScore}`;
}

function formatBegan(value: string | undefined): string {
  if (!value?.trim()) return '—';
  const y = value.trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : '—';
}

function levelLabel(level: number | undefined): string {
  return level != null ? String(level) : '—';
}

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
  const [declineTarget, setDeclineTarget] = useState<GameRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const profileUser = useMemo(
    () => state.users.find((u) => u.uid === profileUserId) ?? null,
    [state.users, profileUserId],
  );
  const profileCityState = profileUser
    ? formatMemberCityState(profileUser)
    : null;
  const recentMatches = useMemo(
    () =>
      profileUserId
        ? recentMatchesForOfficial(state.matches, profileUserId)
        : [],
    [state.matches, profileUserId],
  );
  const coachingReports = useMemo(
    () =>
      profileUserId
        ? coachingReportsForOfficial(state.coachingReports, profileUserId)
        : [],
    [state.coachingReports, profileUserId],
  );

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
            onApprove={() => onApprove(r.id, r.preferredSlot ?? 'mo')}
            onDecline={() => {
              if (matchMissing) {
                onDecline(r.id, 'Match removed from schedule');
                return;
              }
              setDeclineReason('');
              setDeclineTarget(r);
            }}
            onOpenProfile={() => {
              setProfileUserId(r.userId);
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
                {declineTarget.preferredSlot
                  ? ` for ${REQUESTABLE_SLOT_LABELS[declineTarget.preferredSlot]}`
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
        isOpen={Boolean(profileUserId)}
        onClose={() => {
          setProfileUserId(null);
        }}
        aria-labelledby="ref-profile-title"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="ref-profile-title" size="lg">
            {profileUser?.displayName ?? 'Official'}
          </Title>
        </ModalHeader>
        <ModalBody>
          {profileUser ? (
            <div className="rs-ref-profile">
              <div className="rs-ref-profile__top">
                <div className="rs-ref-profile__identity">
                  <UserAvatar user={profileUser} />
                  <p className="rs-ref-profile__name">
                    {profileUser.displayName}
                  </p>
                </div>
                <dl className="rs-ref-profile__facts">
                  <div>
                    <dt>Referee level</dt>
                    <dd>{levelLabel(profileUser.refereeLevel)}</dd>
                  </div>
                  <div>
                    <dt>Started refereeing</dt>
                    <dd>{formatBegan(profileUser.refereeingSince)}</dd>
                  </div>
                  {profileCityState ? (
                    <div>
                      <dt>Location</dt>
                      <dd>{profileCityState}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="rs-ref-profile__coaching-col">
                  <h3 className="rs-ref-profile__heading">Coaching reports</h3>
                  {coachingReports.length === 0 ? (
                    <p className="rs-match-card__meta">None on file.</p>
                  ) : (
                    <ul className="rs-ref-profile__coaching">
                      {coachingReports.map((r) => (
                        <li key={r.id}>
                          <div>
                            <strong>{r.title}</strong>
                            <p className="rs-match-card__meta">{r.summary}</p>
                          </div>
                          <span
                            className={`rs-pill${
                              r.status === 'missing' ? ' rs-pill--urgent' : ''
                            }`}
                          >
                            {r.status === 'missing' ? 'Missing' : 'On file'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <h3 className="rs-ref-profile__heading">Last 5 matches</h3>
                {recentMatches.length === 0 ? (
                  <p className="rs-match-card__meta">No recent assignments.</p>
                ) : (
                  <ul className="rs-ref-profile__matches">
                    {recentMatches.map((m) => {
                      const scored = hasMatchScore(m);
                      return (
                        <li key={m.id}>
                          <Link
                            to={`/matches/${m.id}`}
                            state={backState(QUEUES_BACK)}
                            className="rs-ref-profile__match"
                            onClick={() => setProfileUserId(null)}
                          >
                            <span className="rs-ref-profile__match-top">
                              <span className="rs-ref-profile__match-teams">
                                {m.homeTeamName} vs {m.awayTeamName}
                              </span>
                              <span
                                className={`rs-ref-profile__score${
                                  scored ? '' : ' rs-ref-profile__score--empty'
                                }`}
                              >
                                {formatScore(m)}
                              </span>
                            </span>
                            <span className="rs-match-card__meta">
                              {new Date(m.kickoffAt).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                },
                              )}
                              {m.venueName ? ` · ${m.venueName}` : ''}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="rs-match-card__meta">Profile unavailable.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="primary"
            onClick={() => setProfileUserId(null)}
          >
            Close
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
  const slotLabel = request.preferredSlot
    ? REQUESTABLE_SLOT_LABELS[request.preferredSlot]
    : 'Position TBD';
  const name = user?.displayName ?? request.userName;
  const level = levelLabel(user?.refereeLevel);
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
