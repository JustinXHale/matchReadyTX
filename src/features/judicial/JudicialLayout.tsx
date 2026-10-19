import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import '@/features/insights/insights.css';
import './judicial.css';
import { ROLE_HOME, useApp, useAppHref } from '@/app/AppContext';

function seasonSearch(search: string): string {
  const sp = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const key of ['conference', 'from', 'to'] as const) {
    const v = sp.get(key);
    if (v) keep.set(key, v);
  }
  const q = keep.toString();
  return q ? `?${q}` : '';
}

export function JudicialLayout() {
  const { hasJudicialRole, isJudicialView, roleView, state } = useApp();
  const location = useLocation();
  const dashboardHref = useAppHref('/judicial');
  const casesHref = useAppHref('/judicial/cases');
  const cardReopenHref = useAppHref('/judicial/card-reopen');
  const roleHome = useAppHref(ROLE_HOME[roleView]);
  const seasonQs = seasonSearch(location.search);
  const pendingReopen = state.cardReportReopenRequests.filter(
    (r) => r.status === 'pending',
  ).length;

  if (!hasJudicialRole) {
    return (
      <p className="rs-match-card__meta">
        Judicial tools require a Judicial role. Ask a Scheduler or Judicial
        officer to grant access.
      </p>
    );
  }

  if (!isJudicialView) {
    return <Navigate to={roleHome} replace />;
  }

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label="Judicial">
        <NavLink
          to={`${dashboardHref}${seasonQs}`}
          end
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Dashboard
        </NavLink>
        <NavLink
          to={`${casesHref}${location.search}`}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Cases
        </NavLink>
        <NavLink
          to={cardReopenHref}
          className={({ isActive }) =>
            `rs-nav-with-badge${isActive ? ' active' : ''}`
          }
          aria-label={
            pendingReopen > 0
              ? `Card reopen, ${pendingReopen} pending`
              : 'Card reopen'
          }
        >
          Card reopen
          {pendingReopen > 0 && (
            <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
              {pendingReopen}
            </span>
          )}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
