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
import { RequestSubNav } from '@/features/referee/request/RequestSubNav';
import { MatchListRow } from '@/ui/MatchListRow';
import type { GameRequest, Match } from '@/domain/types';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import { isPendingRequestActive } from '@/domain/requests';
import type { BackNav } from '@/nav/backNav';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  deleteGameRequestInFirestore,
} from '@/services/orgData';

const PENDING_BACK: BackNav = {
  to: '/referee/request/pending',
  label: 'Pending',
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
  const pendingDays = daysPending(request.createdAt);

  return (
    <button
      type="button"
      className="rs-raise-hand-col rs-request-remove-hit"
      aria-label="Remove request"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
    >
      <span className="rs-pill rs-pill--warn">Pending {pendingDays}d</span>
      {request.preferredSlot && (
        <span className="rs-pill rs-pill--ink">
          {REQUESTABLE_SLOT_SHORT[request.preferredSlot]}
        </span>
      )}
      <span className="rs-request-remove-hit__label">Remove</span>
    </button>
  );
}

export function PendingRequestsPage() {
  const { currentUser, state, store, refresh, dataMode } = useApp();
  const [pendingRemoval, setPendingRemoval] = useState<{
    request: GameRequest;
    match: Match;
  } | null>(null);

  const rows = useMemo(() => {
    if (!currentUser) return [] as { request: GameRequest; match: Match }[];
    return state.requests
      .filter((r) => r.userId === currentUser.uid && r.status === 'pending')
      .map((request) => {
        const match = state.matches.find((m) => m.id === request.matchId);
        return match ? { request, match } : null;
      })
      .filter((x): x is { request: GameRequest; match: Match } => x != null)
      .filter(({ request, match }) => isPendingRequestActive(match, request))
      .sort(
        (a, b) =>
          new Date(a.match.kickoffAt).getTime() -
          new Date(b.match.kickoffAt).getTime(),
      );
  }, [currentUser, state.requests, state.matches]);

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
      <RequestSubNav />

      {rows.length === 0 ? (
        <EmptyState titleText="Nothing pending" headingLevel="h3">
          <EmptyStateBody>
            When you raise your hand on Global, waiting requests show up here.
          </EmptyStateBody>
        </EmptyState>
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
                    back={PENDING_BACK}
                    trailing={
                      <RequestStatusTrailing
                        request={request}
                        onRemove={() => setPendingRemoval({ request, match })}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
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
            Remove request?
          </Title>
        </ModalHeader>
        <ModalBody>
          {pendingRemoval && (
            <p id="remove-request-desc" className="rs-modal-lede">
              Remove your request for{' '}
              <strong>
                {pendingRemoval.match.homeTeamName} vs{' '}
                {pendingRemoval.match.awayTeamName}
              </strong>
              ? You can raise your hand again later from Global if the game is
              still open.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="link"
            onClick={() => setPendingRemoval(null)}
          >
            Keep request
          </Button>
          <Button type="button" variant="danger" onClick={confirmRemove}>
            Remove request
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
