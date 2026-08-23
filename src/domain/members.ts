import {
  assignmentForUser,
  type AvailabilityRange,
  type Match,
  type MatchGender,
  type Role,
  type Team,
  type UserProfile,
  REQUESTABLE_SLOT_SHORT,
} from '@/domain/types';

export type MemberTab = 'referees' | 'teamAdmins' | 'cmos' | 'fans';

export function isRegisteredMember(user: UserProfile): boolean {
  // Include incomplete profiles so assigners can manage new joiners.
  return user.roles.length > 0;
}

/** True when we only have a membership stub (no real profile/name yet). */
export function isPendingMemberStub(user: UserProfile): boolean {
  return (
    !user.profileComplete &&
    !user.firstName?.trim() &&
    !user.lastName?.trim() &&
    (user.displayName === 'Pending profile' || !user.email?.trim())
  );
}

/**
 * Directory label: first + last when present, else displayName.
 * Prefers preferredName as the given name when set (matches syncDisplayName).
 */
export function memberListName(user: UserProfile): string {
  const given = user.preferredName?.trim() || user.firstName?.trim() || '';
  const last = user.lastName?.trim() || '';
  const joined = `${given} ${last}`.trim();
  if (joined) return joined;
  const fallback = user.displayName?.trim();
  if (fallback && fallback !== 'Pending profile') return fallback;
  if (user.email?.trim()) return user.email.trim();
  return 'Pending profile';
}

export function memberMatchesTab(
  user: UserProfile,
  tab: MemberTab,
): boolean {
  if (!isRegisteredMember(user)) return false;
  if (tab === 'referees') return user.roles.includes('official');
  if (tab === 'teamAdmins') return user.roles.includes('teamAdmin');
  if (tab === 'fans') return user.roles.includes('fan');
  return user.roles.includes('cmo');
}

export type MembersForTabOptions = {
  /** When false, hide incomplete / pending stubs (default for non-schedulers). */
  includeIncomplete?: boolean;
};

export function membersForTab(
  users: UserProfile[],
  tab: MemberTab,
  opts: MembersForTabOptions = {},
): UserProfile[] {
  const includeIncomplete = opts.includeIncomplete === true;
  return users
    .filter((u) => memberMatchesTab(u, tab))
    .filter((u) => includeIncomplete || u.profileComplete)
    .sort((a, b) => memberListName(a).localeCompare(memberListName(b)));
}

/** Format membership join date for Scheduler-only UI. */
export function formatMemberJoinedAt(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function teamNamesForUser(
  user: UserProfile,
  teams: Team[],
): string[] {
  return user.teamIds
    .map((id) => teams.find((t) => t.id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

/** Fan favorite club label (listed team or free-text “Other”). */
export function fanFavoriteLabel(
  user: UserProfile,
  teams: Team[],
): string | null {
  const other = user.fanTeamOther?.trim();
  if (other) return other;
  const ids = user.fanTeamIds ?? [];
  for (const id of ids) {
    const name = teams.find((t) => t.id === id)?.name?.trim();
    if (name) return name;
  }
  return null;
}

/** Genders each team has appeared in on the schedule. */
export function teamGendersFromMatches(
  matches: Match[],
): Map<string, Set<MatchGender>> {
  const map = new Map<string, Set<MatchGender>>();
  for (const m of matches) {
    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      let set = map.get(teamId);
      if (!set) {
        set = new Set();
        map.set(teamId, set);
      }
      set.add(m.gender);
    }
  }
  return map;
}

export function teamAdminMatchesGender(
  user: UserProfile,
  gender: MatchGender,
  teamGenders: Map<string, Set<MatchGender>>,
): boolean {
  if (user.teamIds.length === 0) return false;
  return user.teamIds.some((id) => teamGenders.get(id)?.has(gender));
}

export type TeamAdminSort = 'contact' | 'team';

export type TeamAdminGroup = {
  teamId: string;
  teamName: string;
  admins: UserProfile[];
};

/** Group team admins under each club (admins with multiple teams appear in each). */
export function groupTeamAdminsByTeam(
  admins: UserProfile[],
  teams: Team[],
): TeamAdminGroup[] {
  const byTeam = new Map<string, UserProfile[]>();
  const unassigned: UserProfile[] = [];

  for (const admin of admins) {
    if (admin.teamIds.length === 0) {
      unassigned.push(admin);
      continue;
    }
    for (const teamId of admin.teamIds) {
      const list = byTeam.get(teamId) ?? [];
      list.push(admin);
      byTeam.set(teamId, list);
    }
  }

  const groups: TeamAdminGroup[] = teams
    .filter((t) => byTeam.has(t.id))
    .map((t) => ({
      teamId: t.id,
      teamName: t.name,
      admins: (byTeam.get(t.id) ?? []).sort((a, b) =>
        memberListName(a).localeCompare(memberListName(b)),
      ),
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  // Teams referenced on users but missing from store
  for (const [teamId, list] of byTeam) {
    if (groups.some((g) => g.teamId === teamId)) continue;
    groups.push({
      teamId,
      teamName: teamId,
      admins: list.sort((a, b) =>
        memberListName(a).localeCompare(memberListName(b)),
      ),
    });
  }
  groups.sort((a, b) => a.teamName.localeCompare(b.teamName));

  if (unassigned.length > 0) {
    groups.push({
      teamId: '_none',
      teamName: 'No team linked',
      admins: unassigned.sort((a, b) =>
        memberListName(a).localeCompare(memberListName(b)),
      ),
    });
  }

  return groups;
}

/** City and state from the official’s profile (e.g. Austin, TX). */
export function formatMemberCityState(user: UserProfile): string | null {
  const line = [user.homeCity, user.homeRegion]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
  return line || null;
}

/** Home address — assigners only in UI. */
export function formatMemberAddress(user: UserProfile): string | null {
  const line = [
    user.homeStreet,
    user.homeUnit,
    [user.homeCity, user.homeRegion].filter(Boolean).join(', '),
    user.homePostalCode,
  ]
    .filter((p) => p && String(p).trim())
    .join(', ');
  if (line) return line;
  return user.homeAddress?.trim() || null;
}

export function matchesForMember(
  matches: Match[],
  userId: string,
): Match[] {
  return matches
    .filter((m) => assignmentForUser(m, userId) != null)
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    );
}

export function upcomingMatchesForMember(
  matches: Match[],
  userId: string,
): Match[] {
  const now = Date.now();
  return matchesForMember(matches, userId)
    .filter((m) => new Date(m.kickoffAt).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
}

export function pastMatchesForMember(
  matches: Match[],
  userId: string,
): Match[] {
  const now = Date.now();
  return matchesForMember(matches, userId).filter(
    (m) => new Date(m.kickoffAt).getTime() < now,
  );
}

export function nextMatchForMember(
  matches: Match[],
  userId: string,
): Match | undefined {
  return upcomingMatchesForMember(matches, userId)[0];
}

export function formatMemberScheduleHint(match: Match | undefined): string {
  if (!match) return 'No upcoming games';
  const when = new Date(match.kickoffAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return when;
}

export function availabilityForUser(
  ranges: AvailabilityRange[],
  userId: string,
): AvailabilityRange[] {
  return ranges
    .filter((r) => r.userId === userId)
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export function rolePillsForMember(roles: Role[]): string[] {
  const labels: string[] = [];
  if (roles.includes('official')) labels.push('Referee');
  if (roles.includes('cmo')) labels.push('CMO');
  if (roles.includes('teamAdmin')) labels.push('Team Admin');
  if (roles.includes('assigner')) labels.push('Scheduler');
  if (roles.includes('reportAnalytics')) labels.push('Insights');
  if (roles.includes('fan')) labels.push('Fan');
  return labels;
}

export function memberSlotLabel(
  match: Match,
  userId: string,
): string | null {
  const hit = assignmentForUser(match, userId);
  if (!hit) return null;
  return REQUESTABLE_SLOT_SHORT[hit.slot];
}
