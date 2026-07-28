import { useMemo, useState } from 'react';
import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { needsCardReportNudge } from '@/domain/reports';
import { ReportsSubNav } from '@/features/referee/reports/ReportsSubNav';
import {
  MATCH_REPORTS_BACK,
  reportHrefForPending,
  reportHrefForSubmitted,
} from '@/features/referee/reports/reportLinks';
import { MatchListRow } from '@/ui/MatchListRow';

type StatusFilter = 'due' | 'submitted' | 'all';

export function MatchReportsPage() {
  const { currentUser, state } = useApp();

  const mine = useMemo(() => {
    if (!currentUser) return [];
    return state.matchReports.filter(
      (r) => r.officialId === currentUser.uid && r.slot !== 'cmo',
    );
  }, [currentUser, state.matchReports]);

  const hasDue = useMemo(
    () => mine.some((r) => r.status === 'pending'),
    [mine],
  );

  const [filter, setFilter] = useState<StatusFilter>(() =>
    hasDue ? 'due' : 'all',
  );

  const reports = useMemo(() => {
    const filtered =
      filter === 'due'
        ? mine.filter((r) => r.status === 'pending')
        : filter === 'submitted'
          ? mine.filter((r) => r.status === 'submitted')
          : mine;
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
  }, [mine, filter]);

  if (!currentUser) return null;

  return (
    <div className="rs-stack">
      <ReportsSubNav />
      <Title headingLevel="h2" size="lg">
        Match Reports
      </Title>
      <p className="rs-match-card__meta">
        Match reports are required for every appointment so you can get paid.
      </p>

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

      {reports.length === 0 ? (
        <EmptyState
          titleText={
            filter === 'due'
              ? 'No reports due'
              : filter === 'submitted'
                ? 'No submitted reports'
                : 'No match reports'
          }
          headingLevel="h3"
        >
          <EmptyStateBody>
            {filter === 'due'
              ? 'Nothing pending right now.'
              : 'When you are MO, AR1, or AR2, reports appear here after kickoff + 90 minutes.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-list">
          {reports.map((r) => {
            const match = state.matches.find((m) => m.id === r.matchId);
            if (!match) return null;
            const to =
              r.status === 'pending'
                ? reportHrefForPending(r)
                : reportHrefForSubmitted(r);
            const slotLabel =
              r.slot === 'mo'
                ? 'MO'
                : r.slot === 'ar1'
                  ? 'AR1'
                  : r.slot === 'ar2'
                    ? 'AR2'
                    : r.slot;
            return (
              <li key={r.id}>
                <MatchListRow
                  match={match}
                  to={to}
                  back={MATCH_REPORTS_BACK}
                  hideScore={r.status === 'pending'}
                  meta={
                    <>
                      <span className="rs-pill">{slotLabel}</span>{' '}
                      <span
                        className={`rs-pill${
                          r.status === 'pending' ? ' rs-pill--urgent' : ''
                        }`}
                      >
                        {r.status === 'pending' ? 'Report due' : 'Submitted'}
                      </span>
                      {r.status === 'submitted' &&
                        needsCardReportNudge(r, state.cardReports) && (
                          <>
                            {' '}
                            <span className="rs-pill rs-pill--urgent">
                              Card report required
                            </span>
                          </>
                        )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
