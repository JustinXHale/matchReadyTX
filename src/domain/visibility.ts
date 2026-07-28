import type { Match, UserProfile } from './types';
import { assignmentForUser } from './types';

export function isAssignedTo(match: Match, uid: string): boolean {
  return assignmentForUser(match, uid) != null;
}

export function isTeamMatch(match: Match, teamIds: string[]): boolean {
  return teamIds.includes(match.homeTeamId) || teamIds.includes(match.awayTeamId);
}

export type MatchListRole = 'assigner' | 'official' | 'teamAdmin';

/** Browse vs personal schedule scope for officials / teams. */
export type MatchScope = 'all' | 'mine';

/**
 * Role-aware match list visibility.
 * `asRole` lets dual-role users (assigner + official) browse as one lens.
 */
export function matchesForUser(
  matches: Match[],
  user: UserProfile,
  asRole?: MatchListRole,
): Match[] {
  const role: MatchListRole =
    asRole ??
    (user.roles.includes('assigner')
      ? 'assigner'
      : user.roles.includes('teamAdmin')
        ? 'teamAdmin'
        : 'official');

  if (role === 'assigner') return matches;

  if (role === 'teamAdmin') {
    return matches.filter(
      (m) => m.status !== 'draft' && isTeamMatch(m, user.teamIds),
    );
  }

  // Officials: always see assignments (including draft pending_internal).
  // Also see released open matches for browsing / requesting.
  return matches.filter((m) => {
    if (isAssignedTo(m, user.uid)) return true;
    if (m.status === 'draft' || m.status === 'cancelled') return false;
    return true;
  });
}

/** Released (non-draft) matches for society-wide team browsing. */
export function releasedMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.status !== 'draft' && m.status !== 'cancelled');
}

/**
 * Apply all | mine scope after role visibility.
 * - Officials mine → assigned slots only
 * - Team admins mine → their club games; all → full released schedule
 */
export function applyMatchScope(
  matches: Match[],
  user: UserProfile,
  scope: MatchScope,
  asRole: MatchListRole,
): Match[] {
  if (scope === 'all') {
    if (asRole === 'teamAdmin') return releasedMatches(matches);
    return matchesForUser(matches, user, asRole);
  }

  // mine
  if (asRole === 'official') {
    return matches.filter((m) => isAssignedTo(m, user.uid));
  }
  if (asRole === 'teamAdmin') {
    return matchesForUser(matches, user, 'teamAdmin');
  }
  return matchesForUser(matches, user, asRole);
}
