import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

export function InsightsSubNav() {
  const dashboardHref = useAppHref('/insights');
  const officialsHref = useAppHref('/insights/officials');
  const reportsHref = useAppHref('/insights/reports');

  return (
    <nav className="rs-sub-tabs" aria-label="Insights">
      <NavLink
        to={dashboardHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Dashboard
      </NavLink>
      <NavLink
        to={reportsHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Reports
      </NavLink>
      <NavLink
        to={officialsHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Officials
      </NavLink>
    </nav>
  );
}
