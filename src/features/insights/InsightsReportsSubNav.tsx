import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

export function InsightsReportsSubNav() {
  const cmoHref = useAppHref('/insights/reports/cmo');
  const coachHref = useAppHref('/insights/reports/coach-feedback');

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Report type"
    >
      <NavLink
        to={cmoHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        CMO reports
      </NavLink>
      <NavLink
        to={coachHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Coach feedback
      </NavLink>
    </nav>
  );
}
