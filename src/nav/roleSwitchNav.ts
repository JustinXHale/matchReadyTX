import { ROLE_HOME, type RoleView } from '@/app/AppContext';
import { isDemoPath, stripDemoPrefix, withDemoPrefix } from '@/app/demoPaths';

/** Routes that are valid in any lens — keep path (and query) on role switch. */
const SHARED_PATH_PREFIXES = [
  '/about',
  '/matches/',
  '/global/',
  '/profile',
  '/insights/',
] as const;

/** Exact-path equivalents when switching between assigner and official lenses. */
const LENS_EQUIVALENTS: Record<string, Partial<Record<RoleView, string>>> = {
  '/referee/appointments': {
    scheduler: '/scheduler/schedule',
  },
  '/referee/appointments/open': {
    scheduler: '/scheduler/schedule',
  },
  '/referee/appointments/requested': {
    scheduler: '/scheduler/schedule/requests/raise-hand',
  },
  '/scheduler': {
    referee: '/referee/appointments',
  },
  '/scheduler/schedule': {
    referee: '/referee/appointments/open',
  },
  '/scheduler/schedule/coverage': {
    referee: '/referee/appointments/open',
  },
  '/scheduler/schedule/changes': {
    referee: '/referee/appointments/requested',
  },
  '/scheduler/schedule/notifications': {
    referee: '/referee/appointments',
  },
  '/scheduler/schedule/requests/raise-hand': {
    referee: '/referee/appointments/requested',
  },
  '/scheduler/schedule/requests/fixtures': {
    referee: '/referee/appointments/requested',
  },
  '/scheduler/schedule/requests/team-links': {
    referee: '/referee/appointments/requested',
  },
};

function isSharedPath(path: string): boolean {
  return SHARED_PATH_PREFIXES.some(
    (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix),
  );
}

function exactEquivalent(path: string, toRole: RoleView): string | null {
  const direct = LENS_EQUIVALENTS[path]?.[toRole];
  if (direct) return direct;
  if (path.startsWith('/scheduler/schedule/requests/')) {
    return LENS_EQUIVALENTS['/scheduler/schedule/requests/raise-hand']?.[
      toRole
    ] ?? null;
  }
  return null;
}

/**
 * Resolve navigation target when the user changes role lens.
 * Preserves shared routes and maps assigner ↔ official list views; otherwise role home.
 */
export function resolveRoleSwitchTarget(
  pathname: string,
  search: string,
  toRole: RoleView,
): string {
  const demo = isDemoPath(pathname);
  const path = stripDemoPrefix(pathname);
  const query = search || '';

  if (isSharedPath(path)) {
    return pathname + query;
  }

  const equivalent = exactEquivalent(path, toRole);
  if (equivalent) {
    const target = demo ? withDemoPrefix(equivalent) : equivalent;
    return target + query;
  }

  const home = ROLE_HOME[toRole];
  const target = demo ? withDemoPrefix(home) : home;
  return target + query;
}
