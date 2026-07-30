import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

/** Third-level tabs — only mount when the user has both CMO duty and received notes. */
export function CoachingSubNav() {
  const cmoHref = useAppHref('/referee/reports/coaching/cmo');
  const mineHref = useAppHref('/referee/reports/coaching/mine');

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Coaching report type"
    >
      <NavLink
        to={cmoHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        CMO Reports
      </NavLink>
      <NavLink
        to={mineHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        My Coaching Reports
      </NavLink>
    </nav>
  );
}
