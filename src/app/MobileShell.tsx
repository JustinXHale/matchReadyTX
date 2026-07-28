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
  faEarthAmericas,
  faUser,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { ROLE_HOME, useApp, type RoleView } from '@/app/AppContext';
import { stripDemoPrefix, withDemoPrefix } from '@/app/demoPaths';
import { WhistleIcon } from '@/ui/WhistleIcon';
import './shell.css';

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

function navForRole(roleView: RoleView, demo: boolean): NavItem[] {
  const prefix = (path: string) => (demo ? withDemoPrefix(path) : path);
  const active = (base: string) => (p: string) =>
    stripDemoPrefix(p).startsWith(base);

  const about: NavItem = {
    to: prefix('/about'),
    label: 'About',
    icon: (
      <FontAwesomeIcon
        icon={faCircleInfo}
        className={navIconClass}
        aria-hidden
      />
    ),
    isActive: active('/about'),
  };
  const global: NavItem = {
    to: prefix('/global'),
    label: 'Global',
    icon: (
      <FontAwesomeIcon
        icon={faEarthAmericas}
        className={navIconClass}
        aria-hidden
      />
    ),
    isActive: active('/global'),
  };
  const members: NavItem = {
    to: prefix('/members'),
    label: 'Members',
    icon: (
      <FontAwesomeIcon icon={faUsers} className={navIconClass} aria-hidden />
    ),
    isActive: active('/members'),
  };
  const profile: NavItem = {
    to: prefix('/profile'),
    label: 'Profile',
    icon: (
      <FontAwesomeIcon icon={faUser} className={navIconClass} aria-hidden />
    ),
    isActive: active('/profile'),
  };

  if (roleView === 'scheduler') {
    return [
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
      members,
      global,
      profile,
    ];
  }

  if (roleView === 'teamAdmin') {
    return [
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
      members,
      global,
      profile,
    ];
  }

  return [
    about,
    {
      to: prefix('/referee'),
      label: 'Referee/CMO',
      icon: <WhistleIcon className={navIconClass} size={18} />,
      isActive: active('/referee'),
    },
    members,
    global,
    profile,
  ];
}

export function MobileShell() {
  const {
    currentUser,
    isDemoShowcase,
    hasFirebaseSession,
    canSwitchRoleView,
    roleView,
    setRoleView,
    state,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const tz = state.org.timezone || undefined;
  const bottomNav = navForRole(roleView, isDemoShowcase);
  const showChrome = Boolean(currentUser) && location.pathname !== '/login';

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
    <Page
      className={!showChrome ? 'rs-page--auth' : undefined}
      masthead={
        showChrome ? (
          <Masthead className="rs-masthead">
            <MastheadMain className="rs-masthead__main">
              <MastheadBrand className="rs-masthead__brand">
                <span className="rs-brand-block">
                  <span className="rs-brand-row">
                    <span className="rs-brand">MatchReadyTX</span>
                    {isDemoShowcase && (
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
                </span>
              </MastheadBrand>
            </MastheadMain>
            <MastheadContent className="rs-masthead__content">
              {isDemoShowcase && !hasFirebaseSession && (
                <Button
                  variant="link"
                  className="rs-demo-signin"
                  onClick={() => navigate('/login')}
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
                    <FormSelectOption value="referee" label="Referee/CMO" />
                    <FormSelectOption value="teamAdmin" label="Team Admin" />
                    <FormSelectOption value="scheduler" label="Scheduler" />
                  </FormSelect>
                </div>
              )}
            </MastheadContent>
          </Masthead>
        ) : undefined
      }
    >
      <PageSection className="rs-page-body" isFilled>
        <Outlet />
      </PageSection>
      {showChrome && (
        <nav className="rs-bottom-nav" aria-label="Primary">
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
  );
}
