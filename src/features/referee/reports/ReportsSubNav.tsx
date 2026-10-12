import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  countCardReportsDue,
  countMatchReportsDue,
  formatDueBadge,
} from '@/features/referee/reports/dueCounts';

export function ReportsSubNav() {
  const { currentUser, state, roleView } = useApp();
  const matchHref = useAppHref('/referee/reports/match');
  const cardsHref = useAppHref('/referee/reports/cards');
  const coachingMineHref = useAppHref('/referee/reports/coaching/mine');

  const matchDue = useMemo(() => {
    if (!currentUser) return 0;
    return countMatchReportsDue(state.matchReports, currentUser.uid);
  }, [currentUser, state.matchReports]);
  const cardDue = useMemo(() => {
    if (!currentUser) return 0;
    return countCardReportsDue(
      state.matches,
      state.cardReports,
      state.matchReports,
      currentUser.uid,
    );
  }, [currentUser, state.matches, state.cardReports, state.matchReports]);
  if (roleView === 'cmo') return null;

  return (
    <nav className="rs-sub-tabs" aria-label="Reports">
      <NavLink
        to={matchHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          matchDue > 0 ? `Match reports, ${matchDue} due` : 'Match reports'
        }
      >
        Match Reports
        {matchDue > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(matchDue)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={cardsHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          cardDue > 0 ? `Card reports, ${cardDue} due` : 'Card reports'
        }
      >
        Card Reports
        {cardDue > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(cardDue)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={coachingMineHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Coaching on me
      </NavLink>
    </nav>
  );
}
