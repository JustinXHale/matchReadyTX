import type { Role, Team, TeamLinkRequest, UserProfile } from './types';
import { normalizeEmail } from './contacts';

/** Max clubs someone can request in one onboarding/profile submit. */
export const MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH = 2;

export function isConferencePickerNodeId(id: string): boolean {
  return id.startsWith('conf:');
}

export function validateTeamLinkRequestBatch(
  teamIds: string[],
): { ok: true; value: string[] } | { ok: false; error: string } {
  const unique = [...new Set(teamIds.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: false, error: 'Select at least one club.' };
  }
  if (unique.some(isConferencePickerNodeId)) {
    return {
      ok: false,
      error: 'Select individual clubs, not a whole conference.',
    };
  }
  if (unique.length > MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH) {
    return {
      ok: false,
      error: `Select at most ${MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH} clubs at a time.`,
    };
  }
  return { ok: true, value: unique };
}

/** True when email is listed on the team's Contacts. */
export function emailMatchesTeamContacts(
  email: string,
  team: Team | undefined,
): boolean {
  if (!team) return false;
  const e = normalizeEmail(email);
  if (!e) return false;
  return team.contactEmails.some((c) => normalizeEmail(c) === e);
}

export function pendingTeamLinkRequests(
  requests: TeamLinkRequest[],
): TeamLinkRequest[] {
  return requests.filter((r) => r.status === 'pending');
}

/** Pending requests an assigner sees (all) or a TA sees for their clubs. */
export function teamLinkRequestsForReviewer(
  requests: TeamLinkRequest[],
  reviewer: UserProfile | null,
): TeamLinkRequest[] {
  if (!reviewer) return [];
  const pending = pendingTeamLinkRequests(requests);
  if (reviewer.roles.includes('assigner')) return pending;
  if (!reviewer.roles.includes('teamAdmin')) return [];
  const ids = new Set(reviewer.teamIds);
  return pending.filter((r) => ids.has(r.teamId));
}

/**
 * After denying a request: strip teamAdmin if no approved teams and no other
 * pending requests. Fan only when no working roles remain.
 */
export function rolesAfterTeamLinkDenial(
  user: Pick<UserProfile, 'roles' | 'teamIds'>,
  remainingPendingCount: number,
): { roles: Role[]; teamIds: string[] } {
  const teamIds = [...user.teamIds];
  if (teamIds.length > 0 || remainingPendingCount > 0) {
    return { roles: [...user.roles], teamIds };
  }
  let roles = user.roles.filter((r) => r !== 'teamAdmin');
  const hasWorking = roles.some(
    (r) => r === 'official' || r === 'cmo' || r === 'assigner',
  );
  if (!hasWorking) {
    roles = ['fan'];
  }
  return { roles, teamIds };
}

/** Lenses helper: teamAdmin only when linked; temp Fan while TA pending alone. */
export function shouldShowTeamAdminLens(user: UserProfile | null): boolean {
  return Boolean(
    user?.roles.includes('teamAdmin') && (user.teamIds?.length ?? 0) > 0,
  );
}

export function shouldShowPendingFanBrowse(user: UserProfile | null): boolean {
  if (!user?.roles.includes('teamAdmin')) return false;
  if ((user.teamIds?.length ?? 0) > 0) return false;
  if (user.roles.includes('fan')) return true;
  const hasOtherWorking = user.roles.some(
    (r) => r === 'official' || r === 'cmo' || r === 'assigner',
  );
  return !hasOtherWorking;
}
