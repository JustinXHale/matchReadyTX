import { useMemo, useState } from 'react';
import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { kickoffHasPassed, needsCardReportNudge } from '@/domain/reports';
import { crewPeople } from '@/domain/types';
import { ReportsSubNav } from '@/features/referee/reports/ReportsSubNav';
import {
  CARD_REPORTS_BACK,
  cardReportPath,
} from '@/features/referee/reports/reportLinks';
import { MatchListRow } from '@/ui/MatchListRow';

type StatusFilter = 'due' | 'submitted' | 'all';

type CardListEntry = {
  matchId: string;
  filed: boolean;
  required: boolean;
};

export function CardReportsPage() {
  const { currentUser, state } = useApp();

  const entries = useMemo((): CardListEntry[] => {
    if (!currentUser) return [];
    const byMatch = new Map<string, CardListEntry>();

    for (const match of state.matches) {
      if (!crewPeople(match.crew.mo).some((a) => a.userId === currentUser.uid)) {
        continue;
      }
      if (!kickoffHasPassed(match.kickoffAt)) continue;
      const filed = state.cardReports.some(
        (c) =>
          c.matchId === match.id &&
          c.officialId === currentUser.uid &&
          c.status === 'submitted',
      );
      const moReport = state.matchReports.find(
        (r) =>
          r.matchId === match.id &&
          r.officialId === currentUser.uid &&
          r.slot === 'mo' &&
          r.status === 'submitted',
      );
      byMatch.set(match.id, {
        matchId: match.id,
        filed,
        required: needsCardReportNudge(moReport, state.cardReports),
      });
    }

    for (const card of state.cardReports) {
      if (card.officialId !== currentUser.uid) continue;
      if (card.status !== 'submitted') continue;
      if (byMatch.has(card.matchId)) continue;
      byMatch.set(card.matchId, {
        matchId: card.matchId,
        filed: true,
        required: false,
      });
    }

    return [...byMatch.values()].sort((a, b) => {
      const ma = state.matches.find((m) => m.id === a.matchId);
      const mb = state.matches.find((m) => m.id === b.matchId);
      const ta = ma ? new Date(ma.kickoffAt).getTime() : 0;
      const tb = mb ? new Date(mb.kickoffAt).getTime() : 0;
      return tb - ta;
    });
  }, [
    currentUser,
    state.matches,
    state.cardReports,
    state.matchReports,
  ]);

  const hasDue = useMemo(
    () => entries.some((e) => !e.filed),
    [entries],
  );

  const [filter, setFilter] = useState<StatusFilter>(() =>
    hasDue ? 'due' : 'all',
  );

  const visible = useMemo(() => {
    const filtered =
      filter === 'due'
        ? entries.filter((e) => !e.filed)
        : filter === 'submitted'
          ? entries.filter((e) => e.filed)
          : entries;
    const open = filtered.filter((e) => !e.filed);
    const done = filtered.filter((e) => e.filed);
    return [...open, ...done];
  }, [entries, filter]);

  if (!currentUser) return null;

  return (
    <div className="rs-stack">
      <ReportsSubNav />
      <Title headingLevel="h2" size="lg">
        Card Reports
      </Title>
      <p className="rs-match-card__meta">
        File cards anytime after kickoff. Required if your match report notes
        cards.
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

      {visible.length === 0 ? (
        <EmptyState
          titleText={
            filter === 'due'
              ? 'No card reports due'
              : filter === 'submitted'
                ? 'No submitted card reports'
                : 'No card reports'
          }
          headingLevel="h3"
        >
          <EmptyStateBody>
            {filter === 'due'
              ? 'Nothing pending right now.'
              : 'When you are MO, card reports appear here after kickoff.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-list">
          {visible.map((entry) => {
            const match = state.matches.find((m) => m.id === entry.matchId);
            if (!match) return null;
            return (
              <li key={entry.matchId}>
                <MatchListRow
                  match={match}
                  to={cardReportPath(match.id)}
                  back={CARD_REPORTS_BACK}
                  hideScore={!entry.filed}
                  showTime
                  meta={
                    <span
                      className={`rs-pill${
                        entry.required || !entry.filed
                          ? ' rs-pill--urgent'
                          : ''
                      }`}
                    >
                      {entry.filed
                        ? 'Card report on file'
                        : entry.required
                          ? 'Card report required'
                          : 'File card report'}
                    </span>
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
