import {
  EmptyState,
  EmptyStateBody,
  Title,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '@/app/AppContext';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { MatchListRow } from '@/ui/MatchListRow';
import type { GameRequest, Match, MatchGender } from '@/domain/types';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import {
  isDeclinedRequestVisible,
  isPendingRequestActive,
} from '@/domain/requests';
import type { BackNav } from '@/nav/backNav';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  deleteGameRequestInFirestore,
} from '@/services/orgData';

const PENDING_BACK: BackNav = {
  to: '/referee/appointments/requested',
  label: 'Requested',
};

function daysPending(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function RequestStatusTrailing({
  request,
  onRemove,
}: {
  request: GameRequest;
  onRemove: () => void;
}) {
  const declined = request.status === 'declined';
  const pendingDays = daysPending(request.createdAt);

  return (
    <button
      type="button"
      className="rs-raise-hand-col rs-request-remove-hit"
      aria-label={declined ? 'Dismiss declined request' : 'Remove request'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
    >
      {declined ? (
        <span className="rs-pill rs-pill--urgent">Declined</span>
      ) : (
        <span className="rs-pill rs-pill--warn">Pending {pendingDays}d</span>
      )}
      {request.preferredSlot && (
        <span className="rs-pill rs-pill--ink">
          {REQUESTABLE_SLOT_SHORT[request.preferredSlot]}
        </span>
      )}
      <span className="rs-request-remove-hit__label">
        {declined ? 'Dismiss' : 'Remove'}
      </span>
    </button>
  );
}

export function PendingRequestsPage() {
  const { currentUser, state, store, refresh, dataMode } = useApp();
  const [pendingRemoval, setPendingRemoval] = useState<{
    request: GameRequest;
    match: Match;
  } | null>(null);
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const pool = useMemo(() => {
    if (!currentUser) return [] as { request: GameRequest; match: Match }[];
    return state.requests
      .filter(
        (r) =>
          r.userId === currentUser.uid &&
          (r.status === 'pending' || r.status === 'declined'),
      )
      .map((request) => {
        const match = state.matches.find((m) => m.id === request.matchId);
        return match ? { request, match } : null;
      })
      .filter((x): x is { request: GameRequest; match: Match } => x != null)
      .filter(
        ({ request, match }) =>
          isPendingRequestActive(match, request) ||
          isDeclinedRequestVisible(request),
      )
      .sort((a, b) => {
        const declinedDelta =
          Number(b.request.status === 'declined') -
          Number(a.request.status === 'declined');
        if (declinedDelta !== 0) return declinedDelta;
        return compareKickoffAsc(a.match, b.match);
      });
  }, [currentUser, state.requests, state.matches]);

  const filterOptions = useMemo(
    () =>
      divisionFilterOptionsFromMatches(
        pool.map((r) => r.match),
        competitionFilter,
      ),
    [pool, competitionFilter],
  );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        pool
          .filter(({ match }) => {
            if (genderFilter && match.gender !== genderFilter) return false;
            if (levelFilter && match.level !== levelFilter) return false;
            if (competitionFilter && match.competition !== competitionFilter) {
              return false;
            }
            return true;
          })
          .map((r) => r.match),
      ),
    [pool, genderFilter, levelFilter, competitionFilter],
  );

  const rows = useMemo(
    () =>
      pool.filter(({ match }) => {
        if (genderFilter && match.gender !== genderFilter) return false;
        if (levelFilter && match.level !== levelFilter) return false;
        if (competitionFilter && match.competition !== competitionFilter) {
          return false;
        }
        return matchOnCalendarDate(match, dateFilter);
      }),
    [pool, genderFilter, levelFilter, competitionFilter, dateFilter],
  );

  const byMonth = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      items: { request: GameRequest; match: Match }[];
    }[] = [];
    for (const row of rows) {
      const key = monthKey(row.match.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(row);
      else
        groups.push({
          key,
          label: monthLabel(row.match.kickoffAt),
          items: [row],
        });
    }
    return groups;
  }, [rows]);

  if (!currentUser) return null;

  const confirmRemove = () => {
    if (!pendingRemoval) return;
    const { request } = pendingRemoval;
    void (async () => {
      flushSync(() => {
        store.withdrawRequest(request.id, currentUser!.uid);
        refresh();
        setPendingRemoval(null);
      });
      if (dataMode === 'live' && isFirebaseConfigured) {
        try {
          await deleteGameRequestInFirestore(
            defaultOrgId(),
            request.matchId,
            request.id,
          );
        } catch (err) {
          console.error('Withdraw request failed', err);
          window.alert(
            err instanceof Error
              ? err.message
              : 'Could not remove your request. Try again.',
          );
        }
      }
    })();
  };

  return (
    <div className="rs-stack">
      {pool.length === 0 ? (
        <EmptyState titleText="Nothing pending" headingLevel="h3">
          <EmptyStateBody>
            When you raise your hand on Available matches, waiting requests show
            up here. If an assigner declines one, it stays here with their
            reason until you dismiss it.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          <GlobalDivisionFilters
            options={filterOptions}
            genderFilter={genderFilter}
            levelFilter={levelFilter}
            competitionFilter={competitionFilter}
            onGenderChange={setGenderFilter}
            onLevelChange={setLevelFilter}
            onCompetitionChange={setCompetitionFilter}
            showDate
            dateFilter={dateFilter}
            onDateChange={setDateFilter}
            availableDates={availableDates}
            ariaLabel="Filter requested matches"
          />
          {rows.length === 0 ? (
            <p className="rs-match-card__meta">
              No games match these filters. Clear competition, date, or chips to
              widen.
            </p>
          ) : (
            byMonth.map((group) => (
              <section key={group.key} className="rs-month-section">
                <Title headingLevel="h3" size="md" className="rs-month-heading">
                  {group.label}
                </Title>
                <ul className="rs-list">
                  {group.items.map(({ request, match }) => (
                    <li key={request.id}>
                      <MatchListRow
                        match={match}
                        to={`/matches/${match.id}`}
                        showTime
                        split="action"
                        urgent={request.status === 'declined'}
                        back={PENDING_BACK}
                        meta={
                          request.status === 'declined' ? (
                            <span className="rs-list-row__hint">
                              {request.declineReason?.trim()
                                ? `Declined: ${request.declineReason.trim()}`
                                : 'Declined by the assigner.'}
                            </span>
                          ) : undefined
                        }
                        trailing={
                          <RequestStatusTrailing
                            request={request}
                            onRemove={() =>
                              setPendingRemoval({ request, match })
                            }
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        aria-labelledby="remove-request-title"
        aria-describedby="remove-request-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="remove-request-title" size="lg">
            {pendingRemoval?.request.status === 'declined'
              ? 'Dismiss decision?'
              : 'Remove request?'}
          </Title>
        </ModalHeader>
        <ModalBody>
          {pendingRemoval && pendingRemoval.request.status === 'declined' ? (
            <p id="remove-request-desc" className="rs-modal-lede">
              Dismiss this declined request for{' '}
              <strong>
                {pendingRemoval.match.homeTeamName} vs{' '}
                {pendingRemoval.match.awayTeamName}
              </strong>
              ? You can raise your hand again from Available matches if the game
              is still open.
            </p>
          ) : pendingRemoval ? (
            <p id="remove-request-desc" className="rs-modal-lede">
              Remove your request for{' '}
              <strong>
                {pendingRemoval.match.homeTeamName} vs{' '}
                {pendingRemoval.match.awayTeamName}
              </strong>
              ? You can raise your hand again later from Available matches if
              the game is still open.
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="link"
            onClick={() => setPendingRemoval(null)}
          >
            {pendingRemoval?.request.status === 'declined'
              ? 'Keep'
              : 'Keep request'}
          </Button>
          <Button type="button" variant="danger" onClick={confirmRemove}>
            {pendingRemoval?.request.status === 'declined'
              ? 'Dismiss'
              : 'Remove request'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
