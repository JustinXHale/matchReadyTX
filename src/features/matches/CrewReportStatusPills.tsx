import { Link } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { withDemoPrefix } from '@/app/demoPaths';
import { assigneeReportStatusesForMatch } from '@/domain/paymentReadiness';
import { isReportWindowOpen, type CardReport, type MatchReport } from '@/domain/reports';
import type { Match, RequestableSlot, UserProfile } from '@/domain/types';
import {
  assignerMatchReportFilePath,
  cardReportPath,
  cmoReportViewPath,
  matchReportViewPath,
} from '@/features/referee/reports/reportLinks';

function pillClass(complete: boolean): string {
  return complete
    ? 'rs-pill rs-pill--ok'
    : 'rs-pill rs-pill--warn';
}

export function CrewReportStatusPills({
  match,
  slot,
  officialId,
  officialName,
  users,
  matchReports,
  cardReports,
  now = Date.now(),
}: {
  match: Match;
  slot: RequestableSlot;
  officialId: string;
  officialName: string;
  users: UserProfile[];
  matchReports: MatchReport[];
  cardReports: CardReport[];
  now?: number;
}) {
  const { dataMode } = useApp();
  if (!isReportWindowOpen(match.kickoffAt, now) || slot === 'no4') return null;

  const row = assigneeReportStatusesForMatch(
    match,
    users,
    matchReports,
    cardReports,
    now,
  ).find(
    (status) => status.slot === slot && status.officialId === officialId,
  );
  if (!row) return null;

  const href = (path: string) =>
    dataMode === 'demo' ? withDemoPrefix(path) : path;
  const isCmo = slot === 'cmo';
  const submittedPath = isCmo
    ? cmoReportViewPath(match.id, row.cmoSubjectOfficialId, { officialId })
    : matchReportViewPath(match.id, { officialId, slot });
  const pendingPath = !isCmo
    ? assignerMatchReportFilePath(match.id, officialId, slot)
    : undefined;
  const matchPath = row.matchReportSubmitted ? submittedPath : pendingPath;
  const cardRows = cardReports.filter(
    (card) => card.matchId === match.id && card.officialId === officialId,
  );
  const cardActive = row.cardReportRequired || cardRows.length > 0;
  const cardFiled = cardRows.some((card) => card.status === 'submitted');

  return (
    <span className="rs-crew-report-status__pills">
      {matchPath ? (
        <Link
          className="rs-crew-report-status__pill-link"
          to={href(matchPath)}
          aria-label={`${row.matchReportSubmitted ? 'View' : 'File'} ${officialName}'s ${isCmo ? 'coaching' : 'match'} report`}
        >
          <span className={pillClass(row.matchReportSubmitted)}>
            {isCmo ? 'Coach' : 'Match'}:{' '}
            {row.matchReportSubmitted ? 'Complete' : 'Pending'}
          </span>
        </Link>
      ) : (
        <span className={pillClass(row.matchReportSubmitted)}>
          {isCmo ? 'Coach' : 'Match'}:{' '}
          {row.matchReportSubmitted ? 'Complete' : 'Pending'}
        </span>
      )}
      {slot === 'mo' && cardActive && (
        <Link
          className="rs-crew-report-status__pill-link"
          to={href(cardReportPath(match.id))}
          aria-label={`Open ${officialName}'s card report`}
        >
          <span className={pillClass(cardFiled)}>
            Card: {cardFiled ? 'Filed' : 'Pending'}
          </span>
        </Link>
      )}
    </span>
  );
}
