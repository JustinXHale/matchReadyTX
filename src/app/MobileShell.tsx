import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ROLE_HOME, useApp, type RoleView } from '@/app/AppContext';
import { resolveRoleSwitchTarget } from '@/nav/roleSwitchNav';
import { isDemoPath } from '@/app/demoPaths';
import { isPublicPath } from '@/features/public/publicPaths';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';
import { OfficialQuickLookProvider } from '@/features/scheduler/officialQuickLookContext';
import { orgTimeZone } from '@/domain/matchTime';
import { navForRole } from '@/app/shell/navItems';
import { PrimaryNav } from '@/app/shell/PrimaryNav';
import { TopAppBar } from '@/app/shell/TopAppBar';
import { useCompactWidth } from '@/app/shell/useCompactWidth';
import {
  ContextualBarContext,
  type ContextualBarSpec,
} from '@/app/shell/contextualBar';

function formatHeaderClock(now: Date, timeZone?: string): string {
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
  return `${date} · ${time}`;
}

/**
 * Material 3 mobile-first AppShell (Vite + React 19 + TypeScript).
 *
 * Compact (under 600dp): top app bar + bottom navigation bar for referees.
 * Medium+: same destinations as a navigation rail (presentation change only).
 */
export function MobileShell() {
  const {
    currentUser,
    isDemoShowcase,
    hasFirebaseSession,
    enterLive,
    canSwitchRoleView,
    availableLenses,
    roleView,
    setRoleView,
    hasInsightsAccess,
    state,
    hasAssignerRole,
    isAssignerView,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const compact = useCompactWidth();
  const [now, setNow] = useState(() => new Date());
  const [contextualBar, setContextualBar] =
    useState<ContextualBarSpec | null>(null);
  const tz = orgTimeZone(state.org.timezone);
  const primaryNav = navForRole(
    roleView,
    isDemoShowcase,
    hasInsightsAccess,
  );
  const showChrome =
    Boolean(currentUser) && !isPublicPath(location.pathname);
  const inDemoTree = isDemoPath(location.pathname);
  const isPublicDoc = location.pathname === '/privacy';

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const clockLabel = formatHeaderClock(now, tz);
  const todayIso = now.toLocaleDateString('en-CA', { timeZone: tz });

  const switchView = (next: RoleView) => {
    setRoleView(next);
    const target = resolveRoleSwitchTarget(
      location.pathname,
      location.search,
      next,
    );
    navigate(target);
  };

  const shellClass = [
    'rs-app-shell',
    showChrome && (compact ? 'rs-app-shell--compact' : 'rs-app-shell--medium'),
    !showChrome && (isPublicDoc ? 'rs-app-shell--public-doc' : 'rs-app-shell--auth'),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ContextualBarContext.Provider value={setContextualBar}>
      <OfficialQuickLookProvider>
        <div className={shellClass}>
        <a className="rs-skip-link" href="#main">
          Skip to main content
        </a>

        {showChrome && (
          <TopAppBar
            clockLabel={clockLabel}
            todayIso={todayIso}
            inDemoTree={inDemoTree}
            hasFirebaseSession={hasFirebaseSession}
            canSwitchRoleView={canSwitchRoleView}
            availableLenses={availableLenses}
            roleView={roleView}
            isAssignerView={isAssignerView}
            hasAssignerRole={hasAssignerRole}
            onEnterLive={() => {
              if (enterLive()) {
                navigate(ROLE_HOME[roleView]);
              }
            }}
            onSignIn={() => navigate('/')}
            onSwitchView={switchView}
          />
        )}

          <div className="rs-app-shell__frame">
            {showChrome && !compact && (
              <PrimaryNav items={primaryNav} variant="rail" />
            )}

            <div className="rs-app-shell__content">
              {showChrome && contextualBar ? (
                <div className="rs-contextual-bar">
                  <button
                    type="button"
                    className="rs-contextual-bar__action"
                    onClick={contextualBar.onActivate}
                  >
                    ← {contextualBar.label}
                  </button>
                </div>
              ) : null}

              <main id="main" className="rs-page-body rs-page-main" tabIndex={-1}>
                {inDemoTree && (
                  <div className="rs-demo-mode-banner" role="status">
                    <strong>Demo showcase</strong>
                    <span>Sample schedule and members — not your live org.</span>
                  </div>
                )}
                {/* pathname only — search-param updates must not remount (e.g. members search). */}
                <Outlet key={location.pathname} />
              </main>
            </div>
          </div>

        {showChrome && compact && (
          <PrimaryNav items={primaryNav} variant="bar" />
        )}

        <UpdatePrompt />
        </div>
      </OfficialQuickLookProvider>
    </ContextualBarContext.Provider>
  );
}
