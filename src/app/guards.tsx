import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { defaultRoleView, ROLE_HOME, useApp } from '@/app/AppContext';
import { withDemoPrefix } from '@/app/demoPaths';

export function RequireAuth() {
  const { currentUser, dataMode } = useApp();
  const location = useLocation();
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
    const home = ROLE_HOME[defaultRoleView(currentUser)];
    return (
      <Navigate
        to={dataMode === 'demo' ? withDemoPrefix(home) : home}
        replace
      />
    );
  }
  return <Outlet />;
}
