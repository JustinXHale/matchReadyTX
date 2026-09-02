import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  Page,
  PageSection,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faClipboardList,
  faChartLine,
  faEarthAmericas,
  faGavel,
  faUser,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { ROLE_HOME, ROLE_VIEW_LABELS, useApp, type RoleView } from '@/app/AppContext';
import { appBuildLabel } from '@/app/appBuild';
import { stripDemoPrefix, withDemoPrefix, isDemoPath } from '@/app/demoPaths';
import { isPublicPath } from '@/features/public/publicPaths';
import { WhistleIcon } from '@/ui/WhistleIcon';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { BrandLogo } from '@/ui/BrandLogo';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';
import {
  OfficialQuickLookPicker,
  OfficialQuickLookProvider,
} from '@/features/scheduler/officialQuickLookContext';
import { orgTimeZone } from '@/domain/matchTime';

const navIconClass = 'rs-bottom-nav__icon';

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
};

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

function navForRole(
  roleView: RoleView,
  demo: boolean,
  hasInsightsAccess: boolean,
): NavItem[] {
  const prefix = (path: string) => (demo ? withDemoPrefix(path) : path);
  const active = (base: string) => (p: string) =>
    stripDemoPrefix(p).startsWith(base);

  const about: NavItem = {
    to: prefix('/about'),
    label: 'Info',
    icon: (
      <FontAwesomeIcon
        icon={faCircleInfo}
        className={navIconClass}
        aria-hidden
      />
    ),
    isActive: (p) => {
      const s = stripDemoPrefix(p);
      return s.startsWith('/about');
    },
  };
  const global: NavItem = {
    to: prefix('/global'),
    label: 'League',
    icon: (
      <FontAwesomeIcon
        icon={faEarthAmericas}
        className={navIconClass}
        aria-hidden
      />
    ),
    isActive: active('/global'),
  };
  const insights: NavItem = {
    to: prefix('/insights'),
    label: 'Insights',
    icon: (
      <FontAwesomeIcon
        icon={faChartLine}
        className={navIconClass}
        aria-hidden
      />
    ),
    isActive: (p) => stripDemoPrefix(p).startsWith('/insights'),
  };
  const profile: NavItem = {
    to: prefix('/profile'),
    label: 'Profile',
    icon: (
      <FontAwesomeIcon icon={faUser} className={navIconClass} aria-hidden />
    ),
    isActive: active('/profile'),
  };

  const withInsights = (items: NavItem[]): NavItem[] => {
    if (!hasInsightsAccess) return items;
    const leagueIdx = items.findIndex((i) =>
      stripDemoPrefix(i.to).startsWith('/global'),
    );
    if (leagueIdx >= 0) {
      return [
        ...items.slice(0, leagueIdx + 1),
        insights,
        ...items.slice(leagueIdx + 1),
      ];
    }
    const profileIdx = items.findIndex((i) =>
      stripDemoPrefix(i.to).startsWith('/profile'),
    );
    if (profileIdx < 0) return [...items, insights];
    return [
      ...items.slice(0, profileIdx),
      insights,
      ...items.slice(profileIdx),
    ];
  };

  if (roleView === 'scheduler') {
    return withInsights([
      about,
      {
        to: prefix('/scheduler'),
        label: 'Scheduler',
        icon: (
          <FontAwesomeIcon
            icon={faClipboardList}
            className={navIconClass}
            aria-hidden
          />
        ),
        isActive: active('/scheduler'),
      },
      global,
      profile,
    ]);
  }

  if (roleView === 'judicial') {
    return withInsights([
      about,
      {
        to: prefix('/judicial'),
        label: 'Judicial',
        icon: (
          <FontAwesomeIcon
            icon={faGavel}
            className={navIconClass}
            aria-hidden
          />
        ),
        isActive: active('/judicial'),
      },
      profile,
    ]);
  }

  if (roleView === 'teamAdmin') {
    return withInsights([
      about,
      {
        to: prefix('/team-admin'),
        label: 'Team Admin',
        icon: (
          <FontAwesomeIcon
            icon={faUsers}
            className={navIconClass}
            aria-hidden
          />
        ),
        isActive: (p) => {
          const s = stripDemoPrefix(p);
          return s.startsWith('/team-admin') || s.startsWith('/coach');
        },
      },
      global,
      profile,
    ]);
  }

  if (roleView === 'fan') {
    return withInsights([about, global, profile]);
  }

  return withInsights([
    about,
    {
      to: prefix('/referee'),
      label: 'Referee/CMO',
      icon: <WhistleIcon className={navIconClass} size={18} />,
      isActive: active('/referee'),
    },
    global,
    profile,
  ]);
}

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
  const [now, setNow] = useState(() => new Date());
  const tz = orgTimeZone(state.org.timezone);
  const bottomNav = navForRole(
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
    const home = ROLE_HOME[next];
    navigate(isDemoShowcase ? withDemoPrefix(home) : home);
  };

  return (
    <OfficialQuickLookProvider>
    <Page
      className={
        !showChrome
          ? isPublicDoc
            ? 'rs-page--public-doc'
            : 'rs-page--auth'
          : undefined
      }
      masthead={
        showChrome ? (
          <Masthead className="rs-masthead">
            <MastheadMain className="rs-masthead__main">
              <MastheadBrand className="rs-masthead__brand">
                <span className="rs-brand-block">
                  <span className="rs-brand-row">
                    <BrandLogo width={32} height={32} />
                    <span className="rs-brand">MatchReadyTX</span>
                    <ThemeToggle />
                    {inDemoTree && (
                      <span
                        className="rs-demo-badge"
                        title="Seed showcase — not your live org"
                      >
                        Demo
                      </span>
                    )}
                  </span>
                  <time className="rs-brand-date" dateTime={todayIso}>
                    {clockLabel}
                  </time>
                  <span className="rs-brand-build">{appBuildLabel()}</span>
                </span>
              </MastheadBrand>
            </MastheadMain>
            <MastheadContent className="rs-masthead__content">
              {inDemoTree && hasFirebaseSession && (
                <Button
                  variant="link"
                  className="rs-demo-live"
                  onClick={() => {
                    if (enterLive()) {
                      navigate(ROLE_HOME[roleView]);
                    }
                  }}
                >
                  Back to live
                </Button>
              )}
              {inDemoTree && !hasFirebaseSession && (
                <Button
                  variant="link"
                  className="rs-demo-signin"
                  onClick={() => navigate('/')}
                >
                  Sign in
                </Button>
              )}
              {canSwitchRoleView && (
                <div className="rs-role-switch">
                  <FormSelect
                    className="rs-role-switch__select"
                    value={roleView}
                    onChange={(_, v) => switchView(v as RoleView)}
                    aria-label="Role"
                    ouiaId="RoleViewSwitch"
                  >
                    {availableLenses.map((lens) => (
                      <FormSelectOption
                        key={lens}
                        value={lens}
                        label={ROLE_VIEW_LABELS[lens]}
                      />
                    ))}
                  </FormSelect>
                </div>
              )}
              {isAssignerView && hasAssignerRole && <OfficialQuickLookPicker />}
            </MastheadContent>
          </Masthead>
        ) : undefined
      }
    >
      <PageSection className="rs-page-body" isFilled>
        {inDemoTree && (
          <div className="rs-demo-mode-banner" role="status">
            <strong>Demo showcase</strong>
            <span>Sample schedule and members — not your live org.</span>
          </div>
        )}
        <Outlet />
      </PageSection>
      <UpdatePrompt />
      {showChrome && (
        <nav className="rs-bottom-nav" aria-label="Primary">
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              replace
              className={() =>
                `rs-bottom-nav__with-icon${
                  item.isActive(location.pathname) ? ' active' : ''
                }`
              }
              end={false}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </Page>
    </OfficialQuickLookProvider>
  );
}
