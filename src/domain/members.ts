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

export function membersForTab(
  users: UserProfile[],
  tab: MemberTab,
): UserProfile[] {
  return users
    .filter((u) => memberMatchesTab(u, tab))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function teamNamesForUser(
  user: UserProfile,
  teams: Team[],
): string[] {
  return user.teamIds
    .map((id) => teams.find((t) => t.id === id)?.name)
    .filter((n): n is string => Boolean(n));
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
        a.displayName.localeCompare(b.displayName),
      ),
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  // Teams referenced on users but missing from store
  for (const [teamId, list] of byTeam) {
    if (groups.some((g) => g.teamId === teamId)) continue;
    groups.push({
      teamId,
      teamName: teamId,
      admins: list.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    });
  }
  groups.sort((a, b) => a.teamName.localeCompare(b.teamName));

  if (unassigned.length > 0) {
    groups.push({
      teamId: '_none',
      teamName: 'No team linked',
      admins: unassigned.sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    });
  }

  return groups;
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
