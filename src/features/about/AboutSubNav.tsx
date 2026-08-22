import { NavLink } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';

export function AboutSubNav() {
  const { isFanView } = useApp();
  const aboutHref = useAppHref('/about');
  const membersHref = useAppHref('/about/members');

  if (isFanView) return null;

  return (
    <nav className="rs-sub-tabs" aria-label="About">
      <NavLink
        to={aboutHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        About
      </NavLink>
      <NavLink
        to={membersHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Members
      </NavLink>
    </nav>
  );
}
