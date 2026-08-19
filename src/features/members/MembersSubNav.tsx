import { NavLink } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

export function MembersSubNav() {
  const membersHref = useAppHref('/members');
  const teamsHref = useAppHref('/members/teams');

  return (
    <nav className="rs-sub-tabs" aria-label="Members">
      <NavLink
        to={membersHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Members
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
