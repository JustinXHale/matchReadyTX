import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';

/** Games | Changes | Requests | Crew defaults under Schedule. */
export function ScheduleSubNav() {
  const { state } = useApp();
  const gamesHref = useAppHref('/scheduler/schedule');
  const changesHref = useAppHref('/scheduler/schedule/changes');
  const requestsHref = useAppHref('/scheduler/schedule/requests');
  const crewHref = useAppHref('/scheduler/schedule/crew');

  const counts = useMemo(() => countSchedulerQueues(state), [state]);
  const assignmentCount = counts.needsOfficials + counts.needsReassignment;
  const requestTotal =
    counts.fixtureRequests + counts.teamLinkRequests + counts.raiseHand;

  return (
    <nav className="rs-sub-tabs" aria-label="Schedule">
      <NavLink
        end
        to={gamesHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          assignmentCount > 0
            ? `Games, ${assignmentCount} needing assignment`
            : 'Games'
        }
      >
        Games
        {assignmentCount > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(assignmentCount)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={changesHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          counts.proposals > 0
            ? `Changes, ${counts.proposals} awaiting acknowledgment`
            : 'Changes'
        }
      >
        Changes
        {counts.proposals > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(counts.proposals)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={requestsHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          requestTotal > 0
            ? `Requests, ${requestTotal} needing review`
            : 'Requests'
        }
      >
        Requests
        {requestTotal > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(requestTotal)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={crewHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Crew defaults
      </NavLink>
    </nav>
  );
}
