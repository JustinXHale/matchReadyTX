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

  if (rows.length === 0) return null;

  return (
    <section className="rs-detail-card" aria-labelledby="crew-reports-heading">
      <h3 id="crew-reports-heading" className="rs-detail-section__label">
        Reports
      </h3>
      <p className="rs-detail-note">
        Match and coaching reports gate payout. Card reports are filed separately
        and do not block pay. Reset clears a submission so the official can
        file again; delete removes the record (a new due report appears when
        they open Reports).
      </p>
      {!kickoffPassed ? (
        <p className="rs-match-card__meta">Reports are due after kickoff.</p>
      ) : (
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
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
