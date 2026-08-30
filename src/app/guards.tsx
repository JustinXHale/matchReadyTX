import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { resolveRoleView, ROLE_HOME, useApp } from '@/app/AppContext';
import { isFirebaseConfigured } from '@/services/firebase';
import { withDemoPrefix } from '@/app/demoPaths';

export function RequireAuth() {
  const { currentUser, dataMode, authReady } = useApp();
  const location = useLocation();

  if (isFirebaseConfigured && !authReady) {
    return <div className="rs-stack">Loading…</div>;
  }

  if (!currentUser) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const q = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${q}`} replace />;
  }
  if (!currentUser.profileComplete) {
    const onboarding =
      dataMode === 'demo' ? withDemoPrefix('/onboarding') : '/onboarding';
    return <Navigate to={onboarding} replace />;
  }
  return <Outlet />;
}

export function RequireProfileIncomplete() {
  const { currentUser, dataMode } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.profileComplete) {
    const home = ROLE_HOME[resolveRoleView(currentUser)];
    return (
      <Navigate
        to={dataMode === 'demo' ? withDemoPrefix(home) : home}
        replace
      />
    );
  }
  return <Outlet />;
}

/** Insights tab — Scheduler, CMO, or delegated reportAnalytics role. */
export function RequireInsightsAccess() {
  const { hasInsightsAccess, dataMode } = useApp();
  if (!hasInsightsAccess) {
    const home = dataMode === 'demo' ? withDemoPrefix('/about') : '/about';
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}

/** Judicial lens — granted judicial role only. */
export function RequireJudicialAccess() {
  const { hasJudicialRole, dataMode } = useApp();
  if (!hasJudicialRole) {
    const home = dataMode === 'demo' ? withDemoPrefix('/about') : '/about';
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}

/** Directory and team lists are for working roles. Individual member profiles are allowed. */
export function RequireMembersAccess() {
  const { isFanView, dataMode } = useApp();
  const location = useLocation();
  if (isFanView && !isMemberProfilePath(location.pathname)) {
    const about = dataMode === 'demo' ? withDemoPrefix('/about') : '/about';
    return <Navigate to={about} replace />;
  }
  return <Outlet />;
}

function isMemberProfilePath(pathname: string): boolean {
  const path = pathname.replace(/^\/demo/, '') || '/';
  return /^\/about\/members\/(?!teams(?:\/|$))[^/]+(?:\/(cmo|feedback)\/[^/]+)?\/?$/.test(
    path,
  );
}
