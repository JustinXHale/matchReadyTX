import type { Match } from '@/domain/types';
import type { CardReport, MatchReport } from '@/domain/reports';
import {
  countCardReportsDue as countCardDue,
  countCmoReportsDue,
  countMatchReportsDue as countMatchDue,
} from '@/domain/reports';

/** Match reports (MO/AR) still needing submission for this official. */
export function countMatchReportsDue(
  reports: MatchReport[],
  userId: string,
  now = Date.now(),
): number {
  return countMatchDue(reports, userId, now);
}

/** CMO reports still needing submission (Coaching Reports tab). */
export function countCoachingReportsDue(
  reports: MatchReport[],
  userId: string,
  now = Date.now(),
): number {
  return countCmoReportsDue(reports, userId, now);
}

/** Card reports still open for MO after kickoff. */
export function countCardReportsDue(
  matches: Match[],
  cardReports: CardReport[],
  userId: string,
  now = Date.now(),
): number {
  return countCardDue(matches, cardReports, userId, now);
}

export function countReportsDue(
  matchReports: MatchReport[],
  matches: Match[],
  cardReports: CardReport[],
  userId: string,
  now = Date.now(),
): number {
  return (
    countMatchReportsDue(matchReports, userId, now) +
    countCoachingReportsDue(matchReports, userId, now) +
    countCardReportsDue(matches, cardReports, userId, now)
  );
}

export function formatDueBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}
