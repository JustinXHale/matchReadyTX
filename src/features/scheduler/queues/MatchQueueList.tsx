import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '@/app/AppContext';
import { formatMatchKickoff, orgTimeZone } from '@/domain/matchTime';
import { matchHasForfeitOutcome } from '@/domain/matchCardFooter';
import { matchStatusLabel } from '@/domain/matchTransitions';
import {
  openCrewAssignTargets,
  pendingRaiseHandRequestsForMatch,
} from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  REQUESTABLE_SLOT_SHORT,
  type ChangeProposal,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import {
  AssignOfficialModal,
  type CrewPickTarget,
} from '@/features/matches/AssignOfficialModal';
import { CoverageMatchRequesters } from '@/features/scheduler/queues/CoverageMatchRequesters';
import { CoverageMatchCrewSummary } from '@/features/scheduler/queues/CoverageMatchCrewSummary';
import { MatchActionPrompt } from '@/ui/MatchActionPrompt';
import { MatchListRow } from '@/ui/MatchListRow';
import { WORK_QUEUES_BACK } from '@/features/scheduler/queues/workQueuePagesShared';

const QUEUES_BACK = WORK_QUEUES_BACK;

export function MatchQueueList({
  matches,
  emptyText,
  ctaLabel,
  urgent = false,
  assignOpenSlots = false,
  showRaiseHandRequests = false,
  onApproveRaiseHand,
  onDeclineRaiseHand,
  onAlert,
}: {
  matches: Match[];
  emptyText: string;
  /** Short action hint in the right column (e.g. Review). */
  ctaLabel: string;
  urgent?: boolean;
  /** Coverage: show open positions that open the assign modal. */
  assignOpenSlots?: boolean;
  /** Coverage: show pending raise-hand requesters under each match row. */
  showRaiseHandRequests?: boolean;
  onApproveRaiseHand?: (id: string, slot?: RequestableSlot) => void;
  onDeclineRaiseHand?: (id: string, reason?: string) => void;
  /** When set, show Alert / Resend coverage for officials. */
  onAlert?: (matchId: string) => void;
}) {
  const { state } = useApp();
  const [alerted, setAlerted] = useState<Set<string>>(() => new Set());
  const [pick, setPick] = useState<{
    match: Match;
    target: CrewPickTarget;
  } | null>(null);

  if (matches.length === 0) {
    return <p className="rs-match-card__meta">{emptyText}</p>;
  }

  return (
    <>
      <ul className="rs-list">
        {matches.map((m) => {
          const sent = alerted.has(m.id);
          const openSlots = assignOpenSlots ? openCrewAssignTargets(m) : [];
          const raiseHand =
            showRaiseHandRequests && onApproveRaiseHand && onDeclineRaiseHand
              ? pendingRaiseHandRequestsForMatch(state.requests, m.id, m)
              : [];
          return (
            <li
              key={m.id}
              className={assignOpenSlots ? 'rs-coverage-match' : undefined}
            >
              <MatchListRow
                match={m}
                to={`/matches/${m.id}`}
                showTime
                urgent={urgent}
                back={QUEUES_BACK}
                topBanner={
                  assignOpenSlots || raiseHand.length > 0 ? (
                    <CoverageMatchCrewSummary match={m} />
                  ) : undefined
                }
                meta={
                  !matchHasForfeitOutcome(m) ? (
                    <span className="rs-pill">{matchStatusLabel(m)}</span>
                  ) : null
                }
                footer={
                  assignOpenSlots || onAlert || raiseHand.length > 0 ? (
                    <div className="rs-queue-supporting-stack">
                      {assignOpenSlots || onAlert ? (
                        <div className="rs-raise-hand-footer__row">
                          {assignOpenSlots ? (
                            openSlots.length > 0 ? (
                              <div
                                className="rs-queue-action__slots"
                                role="group"
                                aria-label="Open positions"
                              >
                                {openSlots.map((target) => (
                                  <button
                                    key={`${target.slot}-${target.assignmentId ?? 'open'}`}
                                    type="button"
                                    className="rs-filter-chip"
                                    aria-label={`Assign ${REQUESTABLE_SLOT_LABELS[target.slot]}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setPick({
                                        match: m,
                                        target: {
                                          slot: target.slot,
                                          assignmentId: target.assignmentId,
                                        },
                                      });
                                    }}
                                  >
                                    <FontAwesomeIcon
                                      icon={faUserPlus}
                                      className="pf-v5-u-mr-sm"
                                    />
                                    {REQUESTABLE_SLOT_SHORT[target.slot]}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="rs-queue-action__cta">
                                {ctaLabel}
                              </span>
                            )
                          ) : null}
                          {onAlert ? (
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
                          ) : null}
                        </div>
                      ) : null}
                      {raiseHand.length > 0 &&
                      onApproveRaiseHand &&
                      onDeclineRaiseHand ? (
                        <CoverageMatchRequesters
                          match={m}
                          requests={raiseHand}
                          matchBack={QUEUES_BACK}
                          onApprove={onApproveRaiseHand}
                          onDecline={onDeclineRaiseHand}
                        />
                      ) : null}
                    </div>
                  ) : undefined
                }
              />
            </li>
          );
        })}
      </ul>
      <AssignOfficialModal
        match={pick?.match ?? null}
        pickTarget={pick?.target ?? null}
        onClose={() => setPick(null)}
      />
    </>
  );
}

export function ProposalQueueList({
  proposals,
  matches,
  emptyText,
  onAcknowledge,
  onApply,
  onDismiss,
}: {
  proposals: ChangeProposal[];
  matches: Match[];
  emptyText: string;
  onAcknowledge: (proposalId: string) => void;
  onApply: (proposalId: string) => void;
  onDismiss?: (proposalId: string) => void;
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
        const awaitingApply = p.status === 'pending';
        const awaitingAck = !p.assignerAckAt;
        const statusLabel = awaitingApply
          ? p.assignerAckAt
            ? 'Ready to apply'
            : 'Review'
          : 'Awaiting ack';
        return (
          <li key={p.id}>
            <MatchListRow
              match={m}
              to={`/matches/${p.matchId}`}
              showTime
              back={QUEUES_BACK}
              topBanner={
                <MatchActionPrompt
                  message={`${statusLabel}: ${kickoffHint}`}
                  primaryLabel={awaitingApply ? 'Apply' : 'Acknowledge'}
                  onPrimary={() =>
                    awaitingApply ? onApply(p.id) : onAcknowledge(p.id)
                  }
                  secondaryLabel={
                    awaitingApply && onDismiss ? 'Deny' : undefined
                  }
                  onSecondary={
                    awaitingApply && onDismiss
                      ? () => onDismiss(p.id)
                      : undefined
                  }
                  tertiaryLabel={
                    awaitingApply && awaitingAck ? 'Acknowledge' : undefined
                  }
                  onTertiary={
                    awaitingApply && awaitingAck
                      ? () => onAcknowledge(p.id)
                      : undefined
                  }
                  tone="attention"
                  ariaLabel={`Change proposal for ${m.homeTeamName} versus ${m.awayTeamName}`}
                />
              }
              meta={
                <>
                  <span className="rs-pill rs-pill--warn">{statusLabel}</span>
                  <span className="rs-list-row__hint">{kickoffHint}</span>
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
