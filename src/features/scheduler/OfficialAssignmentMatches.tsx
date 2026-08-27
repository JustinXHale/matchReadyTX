import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { allAssignmentsForMember, memberSlotLabel } from '@/domain/members';
import { formatMatchKickoff, orgTimeZone } from '@/domain/matchTime';
import type { Match } from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';

type SortDir = 'asc' | 'desc';

function hasMatchScore(match: Match): boolean {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore)
  );
}

function formatScore(match: Match): string {
  if (!hasMatchScore(match)) return '–';
  return `${match.homeScore}–${match.awayScore}`;
}

export function OfficialAssignmentMatches({
  userId,
  matchBack,
  onNavigate,
}: {
  userId: string;
  matchBack?: BackNav;
  onNavigate?: () => void;
}) {
  const { state } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
  const matchBase = useAppHref('/matches');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const matches = useMemo(() => {
    const list = allAssignmentsForMember(state.matches, userId);
    if (sortDir === 'desc') return [...list].reverse();
    return list;
  }, [state.matches, userId, sortDir]);
  const linkState = matchBack ? backState(matchBack) : undefined;
  const now = Date.now();

  if (matches.length === 0) {
    return <p className="rs-match-card__meta">No assignments on file.</p>;
  }

  return (
    <>
      <div
        className="rs-filter-chips rs-official-matches-sort"
        role="group"
        aria-label="Sort matches"
      >
        <button
          type="button"
          className={`rs-filter-chip${sortDir === 'asc' ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={sortDir === 'asc'}
          onClick={() => setSortDir('asc')}
        >
          Oldest first
        </button>
        <button
          type="button"
          className={`rs-filter-chip${sortDir === 'desc' ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={sortDir === 'desc'}
          onClick={() => setSortDir('desc')}
        >
          Newest first
        </button>
      </div>
      <ul className="rs-ref-profile__matches">
      {matches.map((m) => {
        const isPast = new Date(m.kickoffAt).getTime() < now;
        const scored = isPast && hasMatchScore(m);
        const slot = memberSlotLabel(m, userId);
        const when = formatMatchKickoff(m.kickoffAt, timeZone, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return (
          <li key={m.id}>
            <Link
              to={`${matchBase}/${m.id}`}
              state={linkState}
              className="rs-ref-profile__match"
              onClick={() => onNavigate?.()}
            >
              <span className="rs-ref-profile__match-top">
                <span className="rs-ref-profile__match-teams">
                  {m.homeTeamName} vs {m.awayTeamName}
                </span>
                <span className="rs-ref-profile__match-badges">
                  {slot && (
                    <span className="rs-pill rs-pill--ink">{slot}</span>
                  )}
                  {isPast && (
                    <span
                      className={`rs-ref-profile__score${
                        scored ? '' : ' rs-ref-profile__score--empty'
                      }`}
                    >
                      {formatScore(m)}
                    </span>
                  )}
                </span>
              </span>
              <span className="rs-match-card__meta">
                {when}
                {m.venueName ? ` · ${m.venueName}` : ''}
              </span>
            </Link>
          </li>
        );
      })}
      </ul>
    </>
  );
}
