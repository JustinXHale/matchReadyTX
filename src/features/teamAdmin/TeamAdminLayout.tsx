import { NavLink, Outlet } from 'react-router-dom';
import './team-admin.css';
import { useAppHref } from '@/app/AppContext';

/** Top tabs for Team Admin — Schedule vs Referee Feedback. */
export function TeamAdminLayout() {
  const scheduleHref = useAppHref('/team-admin');
  const reportHref = useAppHref('/team-admin/report');

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label="Team Admin">
        <NavLink
          to={scheduleHref}
          end
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Schedule
        </NavLink>
        <NavLink
          to={reportHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Referee Feedback
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
