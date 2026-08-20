import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { statusLabel } from '@/domain/matchTransitions';
import type { ChangeProposal, Match } from '@/domain/types';
import { MatchListRow } from '@/ui/MatchListRow';
import { WORK_QUEUES_BACK } from '@/features/scheduler/queues/workQueuePagesShared';

const QUEUES_BACK = WORK_QUEUES_BACK;

export function MatchQueueList({
  matches,
  emptyText,
  ctaLabel,
  urgent = false,
  onAlert,
}: {
  matches: Match[];
  emptyText: string;
  /** Short action hint in the right column (e.g. Assign, Reassign). */
  ctaLabel: string;
  urgent?: boolean;
  /** When set, show Alert / Resend coverage for officials. */
  onAlert?: (matchId: string) => void;
}) {
  const [alerted, setAlerted] = useState<Set<string>>(() => new Set());

  if (matches.length === 0) {
    return <p className="rs-match-card__meta">{emptyText}</p>;
  }

  return (
    <ul className="rs-list">
      {matches.map((m) => {
        const sent = alerted.has(m.id);
        return (
          <li key={m.id}>
            <MatchListRow
              match={m}
              to={`/matches/${m.id}`}
              showTime
              split="action"
              urgent={urgent}
              back={QUEUES_BACK}
              meta={
                <span className="rs-pill">{statusLabel(m.status)}</span>
              }
              trailing={
                <div className="rs-queue-action">
                  <span className="rs-queue-action__cta">{ctaLabel}</span>
                  {onAlert && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAlert(m.id);
                        setAlerted((prev) => new Set(prev).add(m.id));
                      }}
                    >
                      {sent ? 'Resend alert' : 'Alert refs'}
                    </Button>
                  )}
                </div>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export function ProposalQueueList({
  proposals,
  matches,
  emptyText,
  onAcknowledge,
}: {
  proposals: ChangeProposal[];
  matches: Match[];
  emptyText: string;
  onAcknowledge: (proposalId: string) => void;
}) {
  if (proposals.length === 0) {
    return <p className="rs-match-card__meta">{emptyText}</p>;
  }

  return (
    <ul className="rs-list">
      {proposals.map((p) => {
        const m = matches.find((x) => x.id === p.matchId);
        if (!m) {
          return (
            <li key={p.id}>
              <p className="rs-match-card__meta">Proposal — match unavailable</p>
            </li>
          );
        }
        const kickoffHint = p.kickoffAt
          ? `New kickoff ${new Date(p.kickoffAt).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}`
          : 'Fact change pending';
        return (
          <li key={p.id}>
            <MatchListRow
              match={m}
              to={`/matches/${p.matchId}`}
              showTime
              split="action"
              back={QUEUES_BACK}
              meta={
                <>
                  <span className="rs-pill rs-pill--warn">Awaiting ack</span>
                  <span className="rs-list-row__hint">{kickoffHint}</span>
                </>
              }
              trailing={
                <div className="rs-queue-action">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAcknowledge(p.id);
                    }}
                  >
                    Acknowledge
                  </Button>
                </div>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
