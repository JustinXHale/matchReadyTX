import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** Upcoming | Completed under Global → Schedule. */
export function GlobalScheduleSubNav() {
  const upcomingHref = useAppHref('/global/schedule/upcoming');
  const completedHref = useAppHref('/global/schedule/completed');

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Schedule time range"
    >
      <NavLink
        to={upcomingHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Upcoming Matches
      </NavLink>
      <NavLink
        to={completedHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Completed Matches
      </NavLink>
    </nav>
  );
}
