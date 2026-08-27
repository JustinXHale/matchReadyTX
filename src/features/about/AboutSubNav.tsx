import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';

export function AboutSubNav() {
  const { isFanView } = useApp();
  const overviewHref = useAppHref('/about');
  const membersHref = useAppHref('/about/members');
  const resourcesHref = useAppHref('/about/resources');

  if (isFanView) return null;

  return (
    <nav className="rs-sub-tabs" aria-label="Info">
      <NavLink
        to={overviewHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Overview
      </NavLink>
      <NavLink
        to={membersHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Members
      </NavLink>
      <NavLink
        to={resourcesHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Resources
      </NavLink>
    </nav>
  );
}
