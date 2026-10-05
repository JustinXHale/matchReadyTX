import {
  MATCH_REPORT_SOURCE_OUTSIDE,
  cmoDeadlineAt,
  matchReportDocId,
  reportDueAt,
  type LegacyCmoFixture,
  type MatchReport,
} from '@/domain/reports';
import { emptyCrew, type Match } from '@/domain/types';

/** Parent record linking an outside Performance report to a CMO coaching report. */
export interface OutsideCoachingSession {
  id: string;
  refereeId: string;
  coachId: string;
  /** YYYY-MM-DD */
  matchDate: string;
  homeTeamName: string;
  awayTeamName: string;
  division?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type OutsideStarterRole = 'referee' | 'coach';

export function outsideMatchId(sessionId: string): string {
  return `outside_${sessionId}`;
}

/** Kickoff ISO used for due windows — noon UTC on the match date. */
export function outsideKickoffAt(matchDate: string): string {
  const day = matchDate.trim().slice(0, 10);
  return `${day}T12:00:00.000Z`;
}

export function outsideFixtureFromSession(
  session: OutsideCoachingSession,
): LegacyCmoFixture {
  const home = session.homeTeamName.trim();
  const away = session.awayTeamName.trim();
  return {
    teamsText: `${home} vs ${away}`,
    homeTeamName: home,
    awayTeamName: away,
    ...(session.division?.trim()
      ? { matchLevel: session.division.trim() }
      : {}),
  };
}

/** Synthetic Match for Performance / CMO forms (no schedule row). */
export function matchFromOutsideSession(
  session: OutsideCoachingSession,
): Match {
  const fixture = outsideFixtureFromSession(session);
  const kickoffAt = outsideKickoffAt(session.matchDate);
  return {
    id: outsideMatchId(session.id),
    sheetRowKey: outsideMatchId(session.id),
    status: 'locked_confirmed',
    kickoffAt,
    venueName: '',
    venueAddress: '',
    homeTeamId: '',
    awayTeamId: '',
    homeTeamName: fixture.homeTeamName,
    awayTeamName: fixture.awayTeamName,
    competition: fixture.matchLevel,
    level: fixture.matchLevel?.trim() || 'Outside',
    gender: 'men',
    matchType: 'Outside game',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: [
        {
          id: `${session.id}_mo`,
          slot: 'mo',
          userId: session.refereeId,
          status: 'confirmed',
          history: [],
        },
      ],
    },
    cmo: [
      {
        id: `${session.id}_cmo`,
        userId: session.coachId,
        status: 'confirmed',
        history: [],
      },
    ],
  };
}

export function outsidePerformanceReportDocId(
  sessionId: string,
  refereeId: string,
): string {
  return matchReportDocId(outsideMatchId(sessionId), refereeId, 'mo');
}

export function outsideCmoReportDocId(
  sessionId: string,
  coachId: string,
  refereeId: string,
): string {
  return `${outsideMatchId(sessionId)}_${coachId}_${refereeId}_cmo`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export function buildOutsidePerformancePending(
  session: OutsideCoachingSession,
): MatchReport {
  const match = matchFromOutsideSession(session);
  return {
    id: outsidePerformanceReportDocId(session.id, session.refereeId),
    matchId: match.id,
    officialId: session.refereeId,
    slot: 'mo',
    subjectOfficialId: session.refereeId,
    formKind: 'mo_performance',
    status: 'pending',
    dueAt: reportDueAt(match.kickoffAt),
    kickoffAt: match.kickoffAt,
    source: MATCH_REPORT_SOURCE_OUTSIDE,
    outsideSessionId: session.id,
    legacyFixture: outsideFixtureFromSession(session),
  };
}

export function buildOutsideCmoPending(
  session: OutsideCoachingSession,
): MatchReport {
  const match = matchFromOutsideSession(session);
  return {
    id: outsideCmoReportDocId(session.id, session.coachId, session.refereeId),
    matchId: match.id,
    officialId: session.coachId,
    slot: 'cmo',
    subjectOfficialId: session.refereeId,
    formKind: 'cmo',
    status: 'pending',
    dueAt: reportDueAt(match.kickoffAt),
    deadlineAt: cmoDeadlineAt(match.kickoffAt),
    kickoffAt: match.kickoffAt,
    source: MATCH_REPORT_SOURCE_OUTSIDE,
    outsideSessionId: session.id,
    legacyFixture: outsideFixtureFromSession(session),
  };
}

export function findOpenOutsideSession(
  sessions: OutsideCoachingSession[],
  refereeId: string,
  coachId: string,
  matchDate: string,
  reports: MatchReport[],
): OutsideCoachingSession | undefined {
  const day = matchDate.trim().slice(0, 10);
  return sessions.find((s) => {
    if (
      s.refereeId !== refereeId ||
      s.coachId !== coachId ||
      s.matchDate.slice(0, 10) !== day
    ) {
      return false;
    }
    return !isOutsideSessionComplete(s, reports);
  });
}

export function outsidePerformanceReport(
  reports: MatchReport[],
  sessionId: string,
): MatchReport | undefined {
  return reports.find(
    (r) =>
      r.outsideSessionId === sessionId &&
      r.slot === 'mo' &&
      r.source === MATCH_REPORT_SOURCE_OUTSIDE,
  );
}

export function outsideCmoReport(
  reports: MatchReport[],
  sessionId: string,
): MatchReport | undefined {
  return reports.find(
    (r) =>
      r.outsideSessionId === sessionId &&
      r.slot === 'cmo' &&
      r.source === MATCH_REPORT_SOURCE_OUTSIDE,
  );
}

/** Both sides submitted. */
export function isOutsideSessionComplete(
  session: OutsideCoachingSession,
  reports: MatchReport[],
): boolean {
  const perf = outsidePerformanceReport(reports, session.id);
  const cmo = outsideCmoReport(reports, session.id);
  return perf?.status === 'submitted' && cmo?.status === 'submitted';
}

/**
 * Referee (subject) may view the CMO report only after their Performance is submitted.
 * Coach / Insights viewers are not gated by this helper.
 */
export function isOutsideCmoUnlockedForReferee(
  sessionId: string,
  reports: MatchReport[],
): boolean {
  return outsidePerformanceReport(reports, sessionId)?.status === 'submitted';
}

export function sessionsForUser(
  sessions: OutsideCoachingSession[],
  userId: string,
): OutsideCoachingSession[] {
  return sessions.filter(
    (s) => s.refereeId === userId || s.coachId === userId,
  );
}

/** Live schedule match, or synthetic match from an outside coaching session. */
export function resolveMatchForReports(
  matchId: string,
  matches: Match[],
  sessions: OutsideCoachingSession[],
): Match | undefined {
  const live = matches.find((m) => m.id === matchId);
  if (live) return live;
  if (!matchId.startsWith('outside_')) return undefined;
  const sessionId = matchId.slice('outside_'.length);
  const session = sessions.find((s) => s.id === sessionId);
  return session ? matchFromOutsideSession(session) : undefined;
}

export function sessionIdFromOutsideMatchId(matchId: string): string | undefined {
  if (!matchId.startsWith('outside_')) return undefined;
  return matchId.slice('outside_'.length);
}

export function parseOutsideCoachingSession(
  id: string,
  data: Record<string, unknown>,
): OutsideCoachingSession | null {
  const refereeId = typeof data.refereeId === 'string' ? data.refereeId : '';
  const coachId = typeof data.coachId === 'string' ? data.coachId : '';
  const matchDate =
    typeof data.matchDate === 'string' ? data.matchDate.trim().slice(0, 10) : '';
  const homeTeamName =
    typeof data.homeTeamName === 'string' ? data.homeTeamName.trim() : '';
  const awayTeamName =
    typeof data.awayTeamName === 'string' ? data.awayTeamName.trim() : '';
  const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt : '';
  const updatedAt =
    typeof data.updatedAt === 'string' ? data.updatedAt : createdAt;
  if (
    !refereeId ||
    !coachId ||
    !matchDate ||
    !homeTeamName ||
    !awayTeamName ||
    !createdBy ||
    !createdAt
  ) {
    return null;
  }
  const division =
    typeof data.division === 'string' && data.division.trim()
      ? data.division.trim()
      : undefined;
  return {
    id,
    refereeId,
    coachId,
    matchDate,
    homeTeamName,
    awayTeamName,
    ...(division ? { division } : {}),
    createdBy,
    createdAt,
    updatedAt,
  };
}
