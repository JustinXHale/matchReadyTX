import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { recentAssignmentsForMember } from '@/domain/members';
import type { Match } from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';

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

export function OfficialRecentMatches({
  userId,
  matchBack,
  onNavigate,
}: {
  userId: string;
  matchBack?: BackNav;
  onNavigate?: () => void;
}) {
  const { state } = useApp();
  const matchBase = useAppHref('/matches');
  const matches = recentAssignmentsForMember(state.matches, userId, 5);
  const linkState = matchBack ? backState(matchBack) : undefined;

  if (matches.length === 0) {
    return <p className="rs-match-card__meta">No recent assignments.</p>;
  }

  return (
    <ul className="rs-ref-profile__matches">
      {matches.map((m) => {
        const scored = hasMatchScore(m);
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
                <span
                  className={`rs-ref-profile__score${
                    scored ? '' : ' rs-ref-profile__score--empty'
                  }`}
                >
                  {formatScore(m)}
                </span>
              </span>
              <span className="rs-match-card__meta">
                {new Date(m.kickoffAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {m.venueName ? ` · ${m.venueName}` : ''}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
