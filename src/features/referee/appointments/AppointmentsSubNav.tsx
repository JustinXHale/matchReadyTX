import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { countOfficialRequestInbox } from '@/domain/requests';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';

/** Assigned | Requested | Open under Appointments. */
export function AppointmentsSubNav() {
  const { currentUser, state } = useApp();
  const assignedHref = useAppHref('/referee/appointments');
  const requestedHref = useAppHref('/referee/appointments/requested');
  const openHref = useAppHref('/referee/appointments/open');

  const requestedCount = useMemo(() => {
    if (!currentUser) return 0;
    return countOfficialRequestInbox(
      state.requests,
      state.matches,
      currentUser.uid,
    );
  }, [currentUser, state.requests, state.matches]);

  return (
    <nav className="rs-sub-tabs" aria-label="Appointments">
      <NavLink
        to={assignedHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Assigned
      </NavLink>
      <NavLink
        to={requestedHref}
        className={({ isActive }) =>
          `rs-nav-with-badge${isActive ? ' active' : ''}`
        }
        aria-label={
          requestedCount > 0
            ? `Requested matches, ${requestedCount} waiting`
            : 'Requested matches'
        }
      >
        Requested
        {requestedCount > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(requestedCount)}
          </span>
        )}
      </NavLink>
      <NavLink to={openHref} className={({ isActive }) => (isActive ? 'active' : '')}>
        Open
      </NavLink>
    </nav>
  );
}
