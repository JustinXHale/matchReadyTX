import { NavLink, useLocation } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';
import { stripDemoPrefix } from '@/app/demoPaths';

export function GlobalSubNav() {
  const { pathname } = useLocation();
  const scheduleActive = stripDemoPrefix(pathname).startsWith('/global/schedule');
  const upcomingHref = useAppHref('/global/schedule/upcoming');
  const standingsHref = useAppHref('/global/standings');
  const teamsHref = useAppHref('/global/teams');

  return (
    <nav className="rs-sub-tabs" aria-label="League">
      <NavLink
        to={upcomingHref}
        className={() => (scheduleActive ? 'active' : '')}
      >
        Schedule
      </NavLink>
      <NavLink
        to={standingsHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Standings
      </NavLink>
      <NavLink
        to={teamsHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Teams
      </NavLink>
    </nav>
  );
}
