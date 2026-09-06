import { useMemo, useState } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { kickoffHasPassed } from '@/domain/reports';
import {
  matchCrewReportSummary,
  type MatchCrewReportSummary,
} from '@/domain/paymentReadiness';
import type { Match } from '@/domain/types';
import { MatchListRow } from '@/ui/MatchListRow';

type StatusFilter = 'all' | 'pending' | 'complete';

function summaryMeta(summary: MatchCrewReportSummary) {
  const parts: string[] = [];
  if (summary.pendingMatchReports > 0) {
    parts.push(
      `${summary.pendingMatchReports} match report${
        summary.pendingMatchReports === 1 ? '' : 's'
      } pending`,
    );
  } else {
    parts.push('Match reports complete');
  }
  if (summary.pendingCardReports > 0) {
    parts.push(
      `${summary.pendingCardReports} card report${
        summary.pendingCardReports === 1 ? '' : 's'
      } pending`,
    );
  }
  return parts.join(' · ');
}

function summaryTrailing(summary: MatchCrewReportSummary) {
  if (summary.pendingMatchReports > 0) {
    return (
      <span className="rs-pill rs-pill--warn">
        {summary.pendingMatchReports} pending
      </span>
    );
  }
  if (summary.pendingCardReports > 0) {
    return (
      <span className="rs-pill rs-pill--quiet">
        Card{summary.pendingCardReports === 1 ? '' : 's'} pending
      </span>
    );
  }
  return <span className="rs-pill rs-pill--ok">Complete</span>;
}

export function SchedulerMatchReportsPage() {
  const { state, hasAssignerRole } = useApp();
  const matchDetailBase = useAppHref('/matches');
  const reportsListHref = useAppHref('/scheduler/reports');
  const matchReportsBack = useMemo(
    () => ({ to: reportsListHref, label: 'Match reports' }),
    [reportsListHref],
  );

  const rows = useMemo(() => {
    const out: { match: Match; summary: MatchCrewReportSummary }[] = [];
    for (const match of state.matches) {
      if (match.status === 'cancelled' || match.status === 'draft') continue;
      if (!kickoffHasPassed(match.kickoffAt)) continue;
      const summary = matchCrewReportSummary(
        match,
        state.users,
        state.matchReports,
        state.cardReports,
      );
      if (summary) out.push({ match, summary });
    }
    return out.sort(
      (a, b) =>
        new Date(b.match.kickoffAt).getTime() -
        new Date(a.match.kickoffAt).getTime(),
    );
  }, [state.matches, state.users, state.matchReports, state.cardReports]);

  const hasPending = useMemo(
    () => rows.some((r) => r.summary.pendingMatchReports > 0),
    [rows],
  );

  const [filter, setFilter] = useState<StatusFilter>(() =>
    hasPending ? 'pending' : 'all',
  );

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return rows.filter((r) => r.summary.pendingMatchReports > 0);
    }
    if (filter === 'complete') {
      return rows.filter((r) => r.summary.allMatchReportsIn);
    }
    return rows;
  }, [rows, filter]);

  if (!hasAssignerRole) {
    return (
      <p className="rs-match-card__meta">
        Scheduler tools require an assigner role.
      </p>
    );
  }

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Match reports
      </Title>
      <p className="rs-match-card__meta">
        Crew match and coaching report status after kickoff. Match reports gate
        payout; card reports are tracked separately. Open a match for full crew
        detail.
      </p>

      <div className="rs-slot-picker" role="radiogroup" aria-label="Filter">
        {(
          [
            ['all', 'All'],
            ['pending', 'Pending'],
            ['complete', 'Complete'],
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

      {filtered.length === 0 ? (
        <EmptyState
          titleText={
            filter === 'pending'
              ? 'No pending match reports'
              : filter === 'complete'
                ? 'No completed match reports yet'
                : 'No matches with crew yet'
          }
          headingLevel="h3"
        >
          <EmptyStateBody>
            {filter === 'pending'
              ? 'Every assigned official has filed their match or coaching report.'
              : 'Past matches with assigned crew appear here after kickoff.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-list">
          {filtered.map(({ match, summary }) => (
            <li key={match.id}>
              <MatchListRow
                match={match}
                to={`${matchDetailBase}/${match.id}`}
                back={matchReportsBack}
                split="action"
                meta={
                  <span className="rs-match-card__meta">
                    {summaryMeta(summary)}
                  </span>
                }
                trailing={summaryTrailing(summary)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
