import { NavLink } from 'react-router-dom';

/** Third-level tabs — only mount when the user has both CMO duty and received notes. */
export function CoachingSubNav() {
  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Coaching report type"
    >
      <NavLink
        to="/referee/reports/coaching/cmo"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        CMO Reports
      </NavLink>
      <NavLink
        to="/referee/reports/coaching/mine"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        My Coaching Reports
      </NavLink>
    </nav>
  );
}
