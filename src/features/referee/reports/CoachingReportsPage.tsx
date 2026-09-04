import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  displayMatchForCmoReport,
  submittedCmoReportsAboutOfficial,
} from '@/domain/reports';
import { cmoSubjectName } from '@/features/insights/insightsDisplay';
import { CoachingSubNav } from '@/features/referee/reports/CoachingSubNav';
import { ReportsSubNav } from '@/features/referee/reports/ReportsSubNav';
import {
  COACHING_CMO_BACK,
  COACHING_MINE_BACK,
  COACHING_REPORTS_BACK,
  cmoReportPath,
  cmoReportViewPath,
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

  const hasCmoDuty = toFile.length > 0;
  const hasReceived = received.length > 0;
  /** Split only when both a CMO filer and a subject of coaching. */
  const showSubNav = hasCmoDuty && hasReceived;

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
      : hasCmoDuty
        ? 'cmo'
        : 'mine';

  const showingCmo = hasCmoDuty && (!showSubNav || pane === 'cmo');
  const showingMine = hasReceived && (!showSubNav || pane === 'mine');
  /** Official-only: received under main Coaching Reports (no sub-tabs). */
  const officialOnlyReceived = !hasCmoDuty && hasReceived;

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

  return (
    <div className="rs-stack">
      <ReportsSubNav />
      {showSubNav && <CoachingSubNav />}
      <Title headingLevel="h2" size="lg">
        {pageTitle}
      </Title>
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

          {filedList.length === 0 ? (
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
                + 90 minutes.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <ul className="rs-list">
              {filedList.map((r) => {
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
          {received.length === 0 ? (
            <EmptyState
              titleText="No coaching reports about you"
              headingLevel="h3"
            >
              <EmptyStateBody>
                When a CMO submits a report on a match where you were MO, it
                appears here.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <ul className="rs-list">
              {received.map((r) => {
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

      {!hasCmoDuty && !hasReceived && (
        <EmptyState titleText="No coaching reports" headingLevel="h3">
          <EmptyStateBody>
            CMO duty reports and coaching reports about you appear here when
            available.
          </EmptyStateBody>
        </EmptyState>
      )}
    </div>
  );
}
