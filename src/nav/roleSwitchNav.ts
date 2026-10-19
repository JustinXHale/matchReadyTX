import { ROLE_HOME, type RoleView } from '@/app/AppContext';
import { isDemoPath, withDemoPrefix } from '@/app/demoPaths';

/**
 * Navigation target when the user changes role lens.
 * Always goes to that persona’s primary home (bottom-nav landing), not the
 * previous page — so switching to Referee / CMO / Team Admin / etc. never
 * leaves the user stuck on another lens’s screen.
 */
export function resolveRoleSwitchTarget(
  pathname: string,
  _search: string,
  toRole: RoleView,
): string {
  const demo = isDemoPath(pathname);
  const home = ROLE_HOME[toRole];
  return demo ? withDemoPrefix(home) : home;
}
