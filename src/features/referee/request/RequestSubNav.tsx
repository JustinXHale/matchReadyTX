import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

export function RequestSubNav() {
  const pendingHref = useAppHref('/referee/request/pending');
  const globalHref = useAppHref('/referee/request/global');

  return (
    <nav className="rs-sub-tabs" aria-label="Request">
      <NavLink
        to={pendingHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Pending
      </NavLink>
      <NavLink
        to={globalHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Global
      </NavLink>
    </nav>
  );
}
