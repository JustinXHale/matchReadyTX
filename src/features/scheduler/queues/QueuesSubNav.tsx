import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';

export function QueuesSubNav() {
  const { state } = useApp();
  const workHref = useAppHref('/scheduler/queues');
  const requestsHref = useAppHref('/scheduler/queues/requests');
  const crewHref = useAppHref('/scheduler/queues/crew');

  const queueTotal = useMemo(
    () => countSchedulerQueues(state).totalActionable,
    [state],
  );
  const requestTotal = useMemo(() => {
    const counts = countSchedulerQueues(state);
    return counts.fixtureRequests + counts.teamLinkRequests + counts.raiseHand;
  }, [state]);

  return (
    <nav className="rs-sub-tabs" aria-label="Queues">
      <NavLink
        to={workHref}
        end
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          queueTotal > 0
            ? `Work queues, ${queueTotal} needing action`
            : 'Work queues'
        }
      >
        Work queues
        {queueTotal > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(queueTotal)}
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
