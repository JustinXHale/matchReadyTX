import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faClipboardList,
  faChartLine,
  faEarthAmericas,
  faGavel,
  faFileInvoiceDollar,
  faUser,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import type { RoleView } from '@/app/AppContext';
import { stripDemoPrefix, withDemoPrefix } from '@/app/demoPaths';
import { WhistleIcon } from '@/ui/WhistleIcon';

const navIconClass = 'rs-nav-dest__icon';

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
};

export function navForRole(
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
    isActive: (p) => stripDemoPrefix(p).startsWith('/about'),
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

  if (roleView === 'finance') {
    return [
      about,
      {
        to: prefix('/finance/payouts'),
        label: 'Finance',
        icon: (
          <FontAwesomeIcon
            icon={faFileInvoiceDollar}
            className={navIconClass}
            aria-hidden
          />
        ),
        isActive: active('/finance'),
      },
      profile,
    ];
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

  // Referee/CMO — primary mobile lens (appointments, request, reports)
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
