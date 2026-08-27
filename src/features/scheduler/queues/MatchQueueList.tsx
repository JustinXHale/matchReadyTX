import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { formatMatchKickoff, orgTimeZone } from '@/domain/matchTime';
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
  onApply,
}: {
  proposals: ChangeProposal[];
  matches: Match[];
  emptyText: string;
  onAcknowledge: (proposalId: string) => void;
  onApply: (proposalId: string) => void;
}) {
  const { state } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);

  if (proposals.length === 0) {
    return <p className="rs-match-card__meta">{emptyText}</p>;
  }

  return (
    <ul className="rs-list">
      {proposals.map((p) => {
        const m = matches.find((x) => x.id === p.matchId);
        if (!m) {
          return (
            <li key={p.id} className="rs-request-item">
              <div className="rs-request-item__main">
                <strong>
                  {p.proposedByName ?? 'Team proposal'}
                </strong>
                <div className="rs-match-card__meta">
                  Match no longer on schedule
                  {p.matchId ? ` (${p.matchId})` : ''}
                </div>
              </div>
              <div className="rs-queue-action">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onAcknowledge(p.id)}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          );
        }
        const kickoffHint = p.kickoffAt
          ? `New kickoff ${formatMatchKickoff(p.kickoffAt, timeZone)}`
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
                      onApply(p.id);
                    }}
                  >
                    Apply change
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    isInline
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAcknowledge(p.id);
                    }}
                  >
                    Acknowledge only
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
