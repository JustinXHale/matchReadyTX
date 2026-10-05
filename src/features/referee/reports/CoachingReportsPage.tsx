import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button, Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  displayMatchForCmoReport,
  MATCH_REPORT_SOURCE_OUTSIDE,
  submittedCmoReportsAboutOfficial,
} from '@/domain/reports';
import {
  isOutsideCmoUnlockedForReferee,
  isOutsideSessionComplete,
  outsideCmoReport,
  outsidePerformanceReport,
  sessionsForUser,
  type OutsideCoachingSession,
} from '@/domain/outsideCoaching';
import { cmoSubjectName } from '@/features/insights/insightsDisplay';
import { CoachingSubNav } from '@/features/referee/reports/CoachingSubNav';
import { ReportsSubNav } from '@/features/referee/reports/ReportsSubNav';
import {
  COACHING_CMO_BACK,
  COACHING_MINE_BACK,
  COACHING_REPORTS_BACK,
  cmoReportPath,
  cmoReportViewPath,
  createOutsideReportPath,
  outsideCmoPath,
  outsideCmoViewPath,
  outsidePerformancePath,
} from '@/features/referee/reports/reportLinks';
import { MatchListRow } from '@/ui/MatchListRow';

type StatusFilter = 'due' | 'submitted' | 'all';
type CoachingPane = 'cmo' | 'mine';

function paneFromPath(pathname: string): CoachingPane | 'index' {
  if (pathname.endsWith('/coaching/cmo')) return 'cmo';
  if (pathname.endsWith('/coaching/mine')) return 'mine';
  return 'index';
}

export function CoachingReportsPage() {
  const { currentUser, state } = useApp();
  const location = useLocation();
  const pathPane = paneFromPath(location.pathname);
  const coachingIndexHref = useAppHref('/referee/reports/coaching');
  const coachingCmoHref = useAppHref('/referee/reports/coaching/cmo');
  const createAsCoachHref = useAppHref(createOutsideReportPath('coach'));
  const createAsRefereeHref = useAppHref(createOutsideReportPath('referee'));

  /** Reports this user files (or must file) as CMO. */
  const toFile = useMemo(() => {
    if (!currentUser) return [];
    return state.matchReports.filter(
      (r) => r.officialId === currentUser.uid && r.slot === 'cmo',
    );
  }, [currentUser, state.matchReports]);

  /** Same CMO form, submitted about this user as MO. */
  const received = useMemo(() => {
    if (!currentUser) return [];
    return submittedCmoReportsAboutOfficial(
      state.matchReports,
      state.matches,
      currentUser.uid,
    );
  }, [currentUser, state.matchReports, state.matches]);

  const mySessions = useMemo(() => {
    if (!currentUser) return [];
    return sessionsForUser(state.outsideCoachingSessions, currentUser.uid).sort(
      (a, b) => b.matchDate.localeCompare(a.matchDate),
    );
  }, [currentUser, state.outsideCoachingSessions]);

  const hasCmoDuty = toFile.length > 0;
  const hasReceived = received.length > 0;
  const hasOutsideAsCoach = mySessions.some(
    (s) => currentUser && s.coachId === currentUser.uid,
  );
  const hasOutsideAsReferee = mySessions.some(
    (s) => currentUser && s.refereeId === currentUser.uid,
  );
  /** Split only when both a CMO filer and a subject of coaching. */
  const showSubNav =
    (hasCmoDuty || hasOutsideAsCoach) && (hasReceived || hasOutsideAsReferee);

  const hasDue = useMemo(
    () => toFile.some((r) => r.status === 'pending'),
    [toFile],
  );

  const [filter, setFilter] = useState<StatusFilter>(() =>
    hasDue ? 'due' : 'all',
  );

  const filedList = useMemo(() => {
    const filtered =
      filter === 'due'
        ? toFile.filter((r) => r.status === 'pending')
        : filter === 'submitted'
          ? toFile.filter((r) => r.status === 'submitted')
          : toFile;
    const pending = filtered
      .filter((r) => r.status === 'pending')
      .sort(
        (a, b) =>
          new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
      );
    const done = filtered
      .filter((r) => r.status !== 'pending')
      .sort(
        (a, b) =>
          new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
      );
    return [...pending, ...done];
  }, [toFile, filter]);

  if (!currentUser) return null;

  if (showSubNav && pathPane === 'index') {
    return <Navigate to={coachingCmoHref} replace />;
  }

  if (pathPane === 'cmo' && !showSubNav) {
    return <Navigate to={coachingIndexHref} replace />;
  }
  if (pathPane === 'mine' && !showSubNav) {
    return <Navigate to={coachingIndexHref} replace />;
  }

  const pane: CoachingPane =
    showSubNav && (pathPane === 'cmo' || pathPane === 'mine')
      ? pathPane
      : hasCmoDuty || hasOutsideAsCoach
        ? 'cmo'
        : 'mine';

  const showingCmo =
    (hasCmoDuty || hasOutsideAsCoach) && (!showSubNav || pane === 'cmo');
  const showingMine =
    (hasReceived || hasOutsideAsReferee) && (!showSubNav || pane === 'mine');
  /** Official-only: received under main Coaching Reports (no sub-tabs). */
  const officialOnlyReceived =
    !hasCmoDuty && !hasOutsideAsCoach && (hasReceived || hasOutsideAsReferee);

  const listBack = showSubNav
    ? pane === 'mine'
      ? COACHING_MINE_BACK
      : COACHING_CMO_BACK
    : COACHING_REPORTS_BACK;

  const pageTitle = showSubNav
    ? showingMine && !showingCmo
      ? COACHING_MINE_BACK.label
      : 'CMO Reports'
    : 'Coaching Reports';

  const pageMeta = officialOnlyReceived
    ? 'Coaching reports filed about you as Match Official (read-only).'
    : showingMine && !showingCmo
      ? 'Coaching reports filed about you as Match Official (read-only).'
      : 'Reports you file as CMO after kickoff. Complete within 48 hours.';

  const createHref =
    showingMine && !showingCmo ? createAsRefereeHref : createAsCoachHref;

  const coachSessions = mySessions.filter((s) => s.coachId === currentUser.uid);
  const refereeSessions = mySessions.filter(
    (s) => s.refereeId === currentUser.uid,
  );

  return (
    <div className="rs-stack">
      <ReportsSubNav />
      {showSubNav && <CoachingSubNav />}
      <div className="rs-page-title-row">
        <Title headingLevel="h2" size="lg">
          {pageTitle}
        </Title>
        <Button
          variant="secondary"
          component={(props) => <Link {...props} to={createHref} />}
        >
          <FontAwesomeIcon icon={faPlus} className="pf-v5-u-mr-sm" />
          Create outside report
        </Button>
      </div>
      <p className="rs-match-card__meta">{pageMeta}</p>

      {showingCmo && (
        <>
          <div className="rs-slot-picker" role="radiogroup" aria-label="Filter">
            {(
              [
                ['all', 'All'],
                ['due', 'Due'],
                ['submitted', 'Submitted'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={filter === id}
                className={`rs-filter-chip${
                  filter === id ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {coachSessions.length > 0 && (
            <ul className="rs-list">
              {coachSessions.map((session) => (
                <OutsideSessionCoachRow
                  key={session.id}
                  session={session}
                  reports={state.matchReports}
                  users={state.users}
                  back={listBack}
                  filter={filter}
                />
              ))}
            </ul>
          )}

          {filedList.length === 0 && coachSessions.length === 0 ? (
            <EmptyState
              titleText={
                filter === 'due'
                  ? 'No CMO reports due'
                  : filter === 'submitted'
                    ? 'No submitted CMO reports'
                    : 'No CMO reports'
              }
              headingLevel="h3"
            >
              <EmptyStateBody>
                When you are assigned as CMO, reports appear here after kickoff
                + 90 minutes. Use Create outside report for club or society
                games.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <ul className="rs-list">
              {filedList
                .filter((r) => r.source !== MATCH_REPORT_SOURCE_OUTSIDE)
                .map((r) => {
                const match = displayMatchForCmoReport(r, state.matches);
                if (!match) return null;
                const moName = cmoSubjectName(r, match, state.users);
                const to =
                  r.status === 'pending'
                    ? cmoReportPath(r.matchId, r.subjectOfficialId)
                    : cmoReportViewPath(r.matchId, r.subjectOfficialId);
                return (
                  <li key={r.id}>
                    <MatchListRow
                      match={match}
                      to={to}
                      back={listBack}
                      hideScore={r.status === 'pending'}
                      meta={
                        <>
                          <span
                            className={`rs-pill${
                              r.status === 'pending' ? ' rs-pill--urgent' : ''
                            }`}
                          >
                            {r.status === 'pending'
                              ? 'Due — you file as CMO'
                              : 'You filed as CMO'}
                          </span>{' '}
                          <span className="rs-pill">About {moName}</span>
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {showingMine && (
        <>
          {refereeSessions.length > 0 && (
            <ul className="rs-list">
              {refereeSessions.map((session) => (
                <OutsideSessionRefereeRow
                  key={session.id}
                  session={session}
                  reports={state.matchReports}
                  users={state.users}
                  back={listBack}
                />
              ))}
            </ul>
          )}

          {received.filter((r) => r.source !== MATCH_REPORT_SOURCE_OUTSIDE)
            .length === 0 &&
          refereeSessions.length === 0 ? (
            <EmptyState
              titleText="No coaching reports about you"
              headingLevel="h3"
            >
              <EmptyStateBody>
                When a CMO submits a report on a match where you were MO, it
                appears here. Use Create outside report for club or society
                games.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <ul className="rs-list">
              {received
                .filter((r) => r.source !== MATCH_REPORT_SOURCE_OUTSIDE)
                .map((r) => {
                const match = displayMatchForCmoReport(r, state.matches);
                if (!match) return null;
                const author =
                  state.users.find((u) => u.uid === r.officialId)
                    ?.displayName ?? 'CMO';
                return (
                  <li key={r.id}>
                    <MatchListRow
                      match={match}
                      to={cmoReportViewPath(r.matchId, r.subjectOfficialId, {
                        officialId: r.officialId,
                      })}
                      back={listBack}
                      showTime={r.source !== 'legacy_form'}
                      meta={
                        <>
                          <span className="rs-pill">About you</span>{' '}
                          <span className="rs-pill">Filed by {author}</span>
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {!hasCmoDuty &&
        !hasReceived &&
        !hasOutsideAsCoach &&
        !hasOutsideAsReferee && (
        <EmptyState titleText="No coaching reports" headingLevel="h3">
          <EmptyStateBody>
            CMO duty reports and coaching reports about you appear here when
            available. Use Create outside report for club or society games.
          </EmptyStateBody>
        </EmptyState>
      )}
    </div>
  );
}

function OutsideSessionCoachRow({
  session,
  reports,
  users,
  back,
  filter,
}: {
  session: OutsideCoachingSession;
  reports: import('@/domain/reports').MatchReport[];
  users: { uid: string; displayName?: string }[];
  back: typeof COACHING_REPORTS_BACK;
  filter: StatusFilter;
}) {
  const cmo = outsideCmoReport(reports, session.id);
  const status = cmo?.status ?? 'pending';
  if (filter === 'due' && status !== 'pending') return null;
  if (filter === 'submitted' && status !== 'submitted') return null;

  const match = displayMatchForCmoReport(
    cmo ?? {
      id: `pending_${session.id}`,
      matchId: `outside_${session.id}`,
      officialId: session.coachId,
      subjectOfficialId: session.refereeId,
      slot: 'cmo' as const,
      status: 'pending' as const,
      formKind: 'cmo' as const,
      source: MATCH_REPORT_SOURCE_OUTSIDE,
      outsideSessionId: session.id,
      dueAt: `${session.matchDate}T12:00:00.000Z`,
      kickoffAt: `${session.matchDate}T12:00:00.000Z`,
      legacyFixture: {
        teamsText: `${session.homeTeamName} vs ${session.awayTeamName}`,
        homeTeamName: session.homeTeamName,
        awayTeamName: session.awayTeamName,
        matchLevel: session.division,
      },
    },
    [],
  );
  if (!match) return null;
  const moName =
    users.find((u) => u.uid === session.refereeId)?.displayName ?? 'Referee';
  const to =
    status === 'pending'
      ? outsideCmoPath(session.id)
      : outsideCmoViewPath(session.id);

  return (
    <li>
      <MatchListRow
        match={match}
        to={to}
        back={back}
        hideScore={status === 'pending'}
        showTime={false}
        meta={
          <>
            <span
              className={`rs-pill${
                status === 'pending' ? ' rs-pill--urgent' : ''
              }`}
            >
              {status === 'pending'
                ? 'Outside — complete coaching report'
                : 'Outside — you filed'}
            </span>{' '}
            <span className="rs-pill">About {moName}</span>
          </>
        }
      />
    </li>
  );
}

function OutsideSessionRefereeRow({
  session,
  reports,
  users,
  back,
}: {
  session: OutsideCoachingSession;
  reports: import('@/domain/reports').MatchReport[];
  users: { uid: string; displayName?: string }[];
  back: typeof COACHING_REPORTS_BACK;
}) {
  const perf = outsidePerformanceReport(reports, session.id);
  const cmo = outsideCmoReport(reports, session.id);
  const unlocked = isOutsideCmoUnlockedForReferee(session.id, reports);
  const complete = isOutsideSessionComplete(session, reports);
  const coachName =
    users.find((u) => u.uid === session.coachId)?.displayName ?? 'CMO';

  const match = displayMatchForCmoReport(
    cmo ??
      perf ?? {
        id: `pending_ref_${session.id}`,
        matchId: `outside_${session.id}`,
        officialId: session.refereeId,
        subjectOfficialId: session.refereeId,
        slot: 'mo' as const,
        status: 'pending' as const,
        formKind: 'mo_performance' as const,
        source: MATCH_REPORT_SOURCE_OUTSIDE,
        outsideSessionId: session.id,
        dueAt: `${session.matchDate}T12:00:00.000Z`,
        kickoffAt: `${session.matchDate}T12:00:00.000Z`,
        legacyFixture: {
          teamsText: `${session.homeTeamName} vs ${session.awayTeamName}`,
          homeTeamName: session.homeTeamName,
          awayTeamName: session.awayTeamName,
          matchLevel: session.division,
        },
      },
    [],
  );
  if (!match) return null;

  let to = outsidePerformancePath(session.id);
  let label = 'Outside — finish performance report';
  let urgent = true;

  if (perf?.status !== 'submitted') {
    to = outsidePerformancePath(session.id);
    label = perf
      ? 'Outside — finish performance report'
      : 'Outside — start performance report';
  } else if (cmo?.status === 'submitted' && unlocked) {
    to = outsideCmoViewPath(session.id);
    label = complete
      ? 'Outside — coaching report'
      : 'Outside — view coaching report';
    urgent = false;
  } else if (cmo?.status === 'submitted' && !unlocked) {
    to = outsideCmoViewPath(session.id);
    label = 'Coaching report pending — finish performance';
  } else {
    to = outsidePerformancePath(session.id);
    label = 'Outside — performance submitted · waiting on coach';
    urgent = false;
  }

  return (
    <li>
      <MatchListRow
        match={match}
        to={to}
        back={back}
        hideScore={perf?.status !== 'submitted'}
        showTime={false}
        meta={
          <>
            <span className={`rs-pill${urgent ? ' rs-pill--urgent' : ''}`}>
              {label}
            </span>{' '}
            <span className="rs-pill">Coach {coachName}</span>
          </>
        }
      />
    </li>
  );
}
