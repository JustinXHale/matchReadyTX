import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  countCardReportsDue,
  countCoachingReportsDue,
  countMatchReportsDue,
  formatDueBadge,
} from '@/features/referee/reports/dueCounts';

export function ReportsSubNav() {
  const { currentUser, state } = useApp();
  const matchHref = useAppHref('/referee/reports/match');
  const cardsHref = useAppHref('/referee/reports/cards');
  const coachingHref = useAppHref('/referee/reports/coaching');

  const matchDue = useMemo(() => {
    if (!currentUser) return 0;
    return countMatchReportsDue(state.matchReports, currentUser.uid);
  }, [currentUser, state.matchReports]);
  const cardDue = useMemo(() => {
    if (!currentUser) return 0;
    return countCardReportsDue(
      state.matches,
      state.cardReports,
      currentUser.uid,
    );
  }, [currentUser, state.matches, state.cardReports]);
  const coachingDue = useMemo(() => {
    if (!currentUser) return 0;
    return countCoachingReportsDue(state.matchReports, currentUser.uid);
  }, [currentUser, state.matchReports]);

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
        to={coachingHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          coachingDue > 0
            ? `Coaching reports, ${coachingDue} due`
            : 'Coaching reports'
        }
      >
        Coaching Reports
        {coachingDue > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(coachingDue)}
          </span>
        )}
      </NavLink>
    </nav>
  );
}
