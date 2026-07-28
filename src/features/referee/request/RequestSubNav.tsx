import { NavLink } from 'react-router-dom';

export function RequestSubNav() {
  return (
    <nav className="rs-sub-tabs" aria-label="Request">
      <NavLink
        to="/referee/request/pending"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Pending
      </NavLink>
      <NavLink
        to="/referee/request/global"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Global
      </NavLink>
    </nav>
  );
}
