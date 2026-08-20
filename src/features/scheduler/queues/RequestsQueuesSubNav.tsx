import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';

/** Fixtures | Team links | Raise-hand under Requests. */
export function RequestsQueuesSubNav() {
  const { state } = useApp();
  const fixturesHref = useAppHref('/scheduler/queues/requests/fixtures');
  const teamLinksHref = useAppHref('/scheduler/queues/requests/team-links');
  const raiseHandHref = useAppHref('/scheduler/queues/requests/raise-hand');

  const counts = useMemo(() => countSchedulerQueues(state), [state]);

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Request type"
    >
      <NavLink
        to={fixturesHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.fixtureRequests > 0
            ? `Fixtures, ${counts.fixtureRequests} pending`
            : 'Fixtures'
        }
      >
        Fixtures
        {counts.fixtureRequests > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.fixtureRequests)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={teamLinksHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.teamLinkRequests > 0
            ? `Team links, ${counts.teamLinkRequests} pending`
            : 'Team links'
        }
      >
        Team links
        {counts.teamLinkRequests > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.teamLinkRequests)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={raiseHandHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.raiseHand > 0
            ? `Raise-hand, ${counts.raiseHand} pending`
            : 'Raise-hand'
        }
      >
        Raise-hand
        {counts.raiseHand > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.raiseHand)}
          </span>
        )}
      </NavLink>
    </nav>
  );
}
