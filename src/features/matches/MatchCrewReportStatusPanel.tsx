import { Link } from 'react-router-dom';
import { assigneeReportStatusesForMatch } from '@/domain/paymentReadiness';
import {
  kickoffHasPassed,
  type CardReport,
  type MatchReport,
  type ReportAssigneeSlot,
} from '@/domain/reports';
import type { Match, UserProfile } from '@/domain/types';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import {
  cardReportPath,
  cmoReportViewPath,
  matchReportViewPath,
} from '@/features/referee/reports/reportLinks';

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
  const kickoffPassed = kickoffHasPassed(match.kickoffAt, now);
  const rows = assigneeReportStatusesForMatch(
    match,
    users,
    matchReports,
    cardReports,
    now,
  ).filter((r) => r.officialId);

  if (rows.length === 0) return null;

  return (
    <section className="rs-detail-card" aria-labelledby="crew-reports-heading">
      <h3 id="crew-reports-heading" className="rs-detail-section__label">
        Reports
      </h3>
      <p className="rs-detail-note">
        Match and coaching reports gate payout. Card reports are filed separately
        and do not block pay.
      </p>
      {!kickoffPassed ? (
        <p className="rs-match-card__meta">Reports are due after kickoff.</p>
      ) : (
        <ul className="rs-detail-people rs-crew-report-status">
          {rows.map((row) => {
            const isCmo = row.slot === 'cmo';
            const reportSlot: ReportAssigneeSlot | undefined =
              row.slot === 'mo' || row.slot === 'ar1' || row.slot === 'ar2'
                ? row.slot
                : undefined;
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

            return (
              <li key={`${row.slot}-${row.officialId}`}>
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
