import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { withDemoPrefix } from '@/app/demoPaths';
import {
  buildResetMatchReport,
  orphanCrewMatchReports,
  type CardReport,
  type MatchReport,
  type ReportAssigneeSlot,
} from '@/domain/reports';
import type { Match, UserProfile } from '@/domain/types';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import { matchReportViewPath } from '@/features/referee/reports/reportLinks';
import {
  persistSchedulerDeleteCardReport,
  persistSchedulerDeleteMatchReport,
  persistSchedulerResetMatchReport,
} from '@/services/reportsLive';

/** Exceptional scheduler cleanup for report records whose official left the crew. */
export function MatchCrewReportStatusPanel({
  match,
  users,
  matchReports,
  cardReports,
}: {
  match: Match;
  users: UserProfile[];
  matchReports: MatchReport[];
  cardReports: CardReport[];
}) {
  const { store, dataMode } = useApp();
  const href = (path: string) =>
    dataMode === 'demo' ? withDemoPrefix(path) : path;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orphans = orphanCrewMatchReports(match, matchReports);

  const runForReports = async (
    rowKey: string,
    reports: MatchReport[],
    action: 'reset' | 'delete',
    confirmMessage: string,
  ) => {
    if (reports.length === 0 || !window.confirm(confirmMessage)) return;
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
    if (!window.confirm(`Delete ${officialName}'s card report for this match?`)) {
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

  if (orphans.length === 0) return null;

  return (
    <section className="rs-detail-card" aria-labelledby="report-issues-heading">
      <h3 id="report-issues-heading" className="rs-detail-section__label">
        Report issues
      </h3>
      <p className="rs-detail-note">
        These records belong to officials who are no longer on this crew.
        Remove them to clear stray report prompts.
      </p>
      <ul className="rs-detail-people rs-crew-report-status">
        {orphans.map((report) => {
          const name =
            users.find((user) => user.uid === report.officialId)?.displayName ??
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
            (card) =>
              card.matchId === match.id &&
              card.officialId === report.officialId,
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
                {viewPath && <Link to={href(viewPath)}>View report</Link>}
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
                        `Delete ${name}'s orphaned report record?`,
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
      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
