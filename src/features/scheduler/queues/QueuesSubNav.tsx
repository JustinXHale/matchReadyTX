import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { countSchedulerQueues } from '@/features/scheduler/queues/selectors';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';

function useWorkQueuesActive(baseHref: string) {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === baseHref || pathname === `${baseHref}/`) return true;
    return (
      pathname.startsWith(`${baseHref}/changes`) ||
      pathname.startsWith(`${baseHref}/notifications`)
    );
  }, [pathname, baseHref]);
}

function useRequestsQueuesActive(requestsBaseHref: string) {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (
      pathname === requestsBaseHref ||
      pathname === `${requestsBaseHref}/`
    ) {
      return true;
    }
    return pathname.startsWith(`${requestsBaseHref}/`);
  }, [pathname, requestsBaseHref]);
}

export function QueuesSubNav() {
  const { state } = useApp();
  const workHref = useAppHref('/scheduler/queues/changes');
  const queuesBaseHref = useAppHref('/scheduler/queues');
  const requestsHref = useAppHref('/scheduler/queues/requests/raise-hand');
  const requestsBaseHref = useAppHref('/scheduler/queues/requests');
  const crewHref = useAppHref('/scheduler/queues/crew');
  const workActive = useWorkQueuesActive(queuesBaseHref);
  const requestsActive = useRequestsQueuesActive(requestsBaseHref);

  const workTotal = useMemo(
    () => countSchedulerQueues(state).workActionable,
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
        className={`rs-nav-with-badge${workActive ? ' active' : ''}`}
        aria-label={
          workTotal > 0
            ? `Work queues, ${workTotal} needing action`
            : 'Work queues'
        }
      >
        Work queues
        {workTotal > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(workTotal)}
          </span>
        )}
      </NavLink>
      <NavLink
        to={requestsHref}
        className={`rs-nav-with-badge${requestsActive ? ' active' : ''}`}
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
