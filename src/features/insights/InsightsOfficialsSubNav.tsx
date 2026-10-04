import { NavLink, useSearchParams } from 'react-router-dom';
import { useAppHref } from '@/app/AppContext';

function withSearch(href: string, search: string): string {
  return search ? `${href}?${search}` : href;
}

export function InsightsOfficialsSubNav() {
  const [searchParams] = useSearchParams();
  const shared = new URLSearchParams();
  const grade = searchParams.get('grade');
  if (grade) shared.set('grade', grade);
  const q = shared.toString();
  const ratingsHref = withSearch(useAppHref('/insights/officials'), q);
  const activityHref = withSearch(
    useAppHref('/insights/officials/activity'),
    q,
  );

  return (
    <nav
      className="rs-sub-tabs rs-sub-tabs--tertiary"
      aria-label="Officials view"
    >
      <NavLink
        to={ratingsHref}
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Ratings / feedback
      </NavLink>
      <NavLink
        to={activityHref}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Activity
      </NavLink>
    </nav>
  );
}
