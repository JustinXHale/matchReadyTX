import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { withDemoPrefix } from '@/app/demoPaths';
import { assigneeReportStatusesForMatch } from '@/domain/paymentReadiness';
import {
  kickoffHasPassed,
  buildResetMatchReport,
  matchReportsForAssignee,
  orphanCrewMatchReports,
  type CardReport,
  type MatchReport,
  type ReportAssigneeSlot,
} from '@/domain/reports';
import type { Match, RequestableSlot, UserProfile } from '@/domain/types';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import {
  assignerMatchReportFilePath,
  cardReportPath,
  cmoReportViewPath,
  matchReportViewPath,
} from '@/features/referee/reports/reportLinks';
import {
  persistSchedulerDeleteCardReport,
  persistSchedulerDeleteMatchReport,
  persistSchedulerResetMatchReport,
} from '@/services/reportsLive';

function reportPillClass(ok: boolean, required: boolean): string {
  if (!required) return 'rs-pill rs-pill--quiet';
  return ok ? 'rs-pill rs-pill--ok' : 'rs-pill rs-pill--warn';
}

function reportPillLabel(
  kind: 'match' | 'coaching' | 'card',
  ok: boolean,
  required: boolean,
): string {
  if (!required) return 'N/A';
  if (ok) {
    if (kind === 'coaching') return 'Complete';
    if (kind === 'card') return 'Filed';
    return 'Complete';
  }
  if (kind === 'card') return 'Pending';
  return 'Pending';
}

function crewReportSlot(slot: RequestableSlot): ReportAssigneeSlot | null {
  if (slot === 'mo' || slot === 'ar1' || slot === 'ar2' || slot === 'cmo') {
    return slot;
  }
  return null;
}

function reportKindLabel(slot: RequestableSlot): string {
  return slot === 'cmo' ? 'coaching report' : 'match report';
}

export function MatchCrewReportStatusPanel({
  match,
  users,
  matchReports,
  cardReports,
  now = Date.now(),
}: {
  match: Match;
  users: UserProfile[];
  matchReports: MatchReport[];
  cardReports: CardReport[];
  now?: number;
}) {
  const { store, dataMode } = useApp();
  const href = (path: string) =>
    dataMode === 'demo' ? withDemoPrefix(path) : path;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kickoffPassed = kickoffHasPassed(match.kickoffAt, now);
  const orphans = orphanCrewMatchReports(match, matchReports);
  const rows = assigneeReportStatusesForMatch(
    match,
    users,
    matchReports,
    cardReports,
    now,
  ).filter((r) => r.officialId);

  const runForReports = async (
    rowKey: string,
    reports: MatchReport[],
    action: 'reset' | 'delete',
    confirmMessage: string,
  ) => {
    if (reports.length === 0) return;
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    setBusyKey(rowKey);
    try {
      for (const report of reports) {
        if (action === 'reset') {
          if (report.status !== 'submitted') continue;
          if (dataMode === 'live') {
            await persistSchedulerResetMatchReport(report, match);
          } else {
            store.resetMatchReportLocal(buildResetMatchReport(report, match));
          }
        } else if (dataMode === 'live') {
          await persistSchedulerDeleteMatchReport(report.id);
        } else {
          store.removeMatchReportLocal(report.id);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update match report.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const deleteCardReport = async (
    rowKey: string,
    report: CardReport,
    officialName: string,
  ) => {
    if (
      !window.confirm(
        `Delete ${officialName}'s card report for this match?`,
      )
    ) {
      return;
    }
    setError(null);
    setBusyKey(rowKey);
    try {
      if (dataMode === 'live') {
        await persistSchedulerDeleteCardReport(report.id);
      } else {
        store.removeCardReportLocal(report.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete card report.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  if (rows.length === 0 && orphans.length === 0) return null;

  return (
    <section className="rs-detail-card" aria-labelledby="crew-reports-heading">
      <h3 id="crew-reports-heading" className="rs-detail-section__label">
        Reports
      </h3>
      <p className="rs-detail-note">
        Match and coaching reports gate payout. Card reports are filed separately
        and do not block pay. Reset clears a submission so the official can
        file again; delete removes the record (a new due report appears when
        they open Reports). Orphan rows are for people no longer on this crew.
      </p>
      {!kickoffPassed ? (
        <p className="rs-match-card__meta">Reports are due after kickoff.</p>
      ) : rows.length > 0 ? (
        <ul className="rs-detail-people rs-crew-report-status">
          {rows.map((row) => {
            const isCmo = row.slot === 'cmo';
            const reportSlot = crewReportSlot(row.slot);
            const assigneeReports =
              reportSlot != null
                ? matchReportsForAssignee(
                    matchReports,
                    match.id,
                    row.officialId,
                    reportSlot,
                  )
                : [];
            const submittedReports = assigneeReports.filter(
              (r) => r.status === 'submitted',
            );
            const rowKey = `${row.slot}-${row.officialId}`;
            const kind = reportKindLabel(row.slot);
            const matchViewPath =
              reportSlot && row.matchReportSubmitted
                ? matchReportViewPath(match.id, {
                    officialId: row.officialId,
                    slot: reportSlot,
                  })
                : undefined;
            const coachingViewPath =
              isCmo && row.matchReportSubmitted
                ? cmoReportViewPath(match.id, row.cmoSubjectOfficialId, {
                    officialId: row.officialId,
                  })
                : undefined;
            const cardViewPath =
              row.cardReportSubmitted || row.cardReportRequired
                ? cardReportPath(match.id)
                : undefined;
            const cardRows = cardReports.filter(
              (c) =>
                c.matchId === match.id && c.officialId === row.officialId,
            );
            const busy = busyKey === rowKey;

            return (
              <li key={rowKey}>
                <div className="rs-detail-people__row rs-detail-people__row--static">
                  <span className="rs-detail-people__slot">
                    {REQUESTABLE_SLOT_SHORT[row.slot]}
                  </span>
                  <span className="rs-detail-people__name">{row.officialName}</span>
                  <span className="rs-crew-report-status__pills">
                    <span
                      className={reportPillClass(
                        row.matchReportSubmitted,
                        row.matchReportRequired,
                      )}
                      title={isCmo ? 'Coaching report' : 'Match report'}
                    >
                      {isCmo ? 'Coach' : 'Match'}:{' '}
                      {reportPillLabel(
                        isCmo ? 'coaching' : 'match',
                        row.matchReportSubmitted,
                        row.matchReportRequired,
                      )}
                    </span>
                    {row.slot === 'mo' && (
                      <span
                        className={reportPillClass(
                          row.cardReportSubmitted,
                          row.cardReportRequired,
                        )}
                        title="Card report"
                      >
                        Card:{' '}
                        {reportPillLabel(
                          'card',
                          row.cardReportSubmitted,
                          row.cardReportRequired,
                        )}
                      </span>
                    )}
                  </span>
                </div>
                {kickoffPassed && (
                  <div className="rs-match-card__meta rs-crew-report-status__links">
                    {matchViewPath && (
                      <Link to={matchViewPath}>View match report</Link>
                    )}
                    {coachingViewPath && (
                      <Link to={coachingViewPath}>View coaching report</Link>
                    )}
                    {row.cardReportSubmitted && cardViewPath && (
                      <Link to={cardViewPath}>View card report</Link>
                    )}
                    {row.cardReportRequired && !row.cardReportSubmitted && (
                      <span>Card report still needed</span>
                    )}
                    {!row.matchReportSubmitted &&
                      row.matchReportRequired &&
                      reportSlot &&
                      reportSlot !== 'cmo' && (
                        <Link
                          to={href(
                            assignerMatchReportFilePath(
                              match.id,
                              row.officialId,
                              reportSlot,
                            ),
                          )}
                        >
                          File report
                        </Link>
                      )}
                    {assigneeReports.length > 0 && (
                      <span className="rs-crew-report-status__admin">
                        {submittedReports.length > 0 && (
                          <Button
                            variant="link"
                            isInline
                            isDisabled={busy}
                            onClick={() =>
                              void runForReports(
                                rowKey,
                                assigneeReports,
                                'reset',
                                `Reset ${row.officialName}'s ${kind}? Their answers will be cleared and the report will show as due again.`,
                              )
                            }
                          >
                            Reset report
                          </Button>
                        )}
                        <Button
                          variant="link"
                          isInline
                          isDisabled={busy}
                          onClick={() =>
                            void runForReports(
                              rowKey,
                              assigneeReports,
                              'delete',
                              `Delete ${row.officialName}'s ${kind} record${
                                assigneeReports.length > 1 ? 's' : ''
                              }?`,
                            )
                          }
                        >
                          Delete report
                        </Button>
                        {row.slot === 'mo' &&
                          cardRows.map((card) => (
                            <Button
                              key={card.id}
                              variant="link"
                              isInline
                              isDisabled={busy}
                              onClick={() =>
                                void deleteCardReport(
                                  `${rowKey}-card-${card.id}`,
                                  card,
                                  row.officialName,
                                )
                              }
                            >
                              Delete card report
                            </Button>
                          ))}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {orphans.length > 0 && (
        <>
          <p className="rs-detail-note">
            These report records belong to officials who are no longer on this
            crew. Delete them to clear stray due items (including card-report
            prompts).
          </p>
          <ul className="rs-detail-people rs-crew-report-status">
            {orphans.map((report) => {
            const name =
              users.find((u) => u.uid === report.officialId)?.displayName ??
              report.officialId;
            const rowKey = `orphan-${report.id}`;
            const busy = busyKey === rowKey;
            const slot = report.slot as ReportAssigneeSlot;
            const viewPath =
              report.status === 'submitted'
                ? matchReportViewPath(match.id, {
                    officialId: report.officialId,
                    slot,
                  })
                : undefined;
            const orphanCards = cardReports.filter(
              (c) =>
                c.matchId === match.id && c.officialId === report.officialId,
            );
            return (
              <li key={rowKey}>
                <div className="rs-detail-people__row rs-detail-people__row--static">
                  <span className="rs-detail-people__slot">
                    {REQUESTABLE_SLOT_SHORT[slot]}
                  </span>
                  <span className="rs-detail-people__name">{name}</span>
                  <span className="rs-pill rs-pill--quiet">Off crew</span>
                  <span className="rs-pill">
                    {report.status === 'submitted' ? 'Submitted' : 'Pending'}
                  </span>
                </div>
                <div className="rs-match-card__meta rs-crew-report-status__links">
                  {viewPath && <Link to={viewPath}>View match report</Link>}
                  <span className="rs-crew-report-status__admin">
                    {report.status === 'submitted' && (
                      <Button
                        variant="link"
                        isInline
                        isDisabled={busy}
                        onClick={() =>
                          void runForReports(
                            rowKey,
                            [report],
                            'reset',
                            `Reset ${name}'s match report?`,
                          )
                        }
                      >
                        Reset report
                      </Button>
                    )}
                    <Button
                      variant="link"
                      isInline
                      isDisabled={busy}
                      onClick={() =>
                        void runForReports(
                          rowKey,
                          [report],
                          'delete',
                          `Delete ${name}'s match report record? This clears stray due items when they are no longer on the crew.`,
                        )
                      }
                    >
                      Delete report
                    </Button>
                    {orphanCards.map((card) => (
                      <Button
                        key={card.id}
                        variant="link"
                        isInline
                        isDisabled={busy}
                        onClick={() =>
                          void deleteCardReport(
                            `${rowKey}-card-${card.id}`,
                            card,
                            name,
                          )
                        }
                      >
                        Delete card report
                      </Button>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
          </ul>
        </>
      )}
      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
