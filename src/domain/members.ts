import {
  assignmentForUser,
  CREW_SLOTS,
  type AvailabilityRange,
  type Match,
  type MatchGender,
  type Role,
  type Team,
  type UserProfile,
  REQUESTABLE_SLOT_SHORT,
} from '@/domain/types';
import { dayKeyInZone, zonedLocalToUtcIso } from '@/domain/availability';
import { formatMatchKickoff } from '@/domain/matchTime';

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

/** Assessed grade when set; otherwise self-reported referee level. */
export function officialEffectiveLevel(user: UserProfile): number | null {
  if (user.assessedLevel != null) return user.assessedLevel;
  if (user.refereeLevel != null) return user.refereeLevel;
  return null;
}

/** Insights-style grade line: assessed, then self-assessed, else unknown. */
export function officialGradeLabel(user: UserProfile): string {
  if (user.assessedLevel != null) return `Assessed ${user.assessedLevel}`;
  if (user.refereeLevel != null) return `Self-assessed ${user.refereeLevel}`;
  return 'Grade unknown';
}

/**
 * Progressive assign filter. Grade 1 is highest, 10 is lowest.
 * Cap 10 = this level and above (everyone 1–10). Cap 9 = 1–9 (excludes 10s).
 * Ungraded officials only match when no cap is set.
 */
export function officialMatchesLevelCap(
  level: number | null,
  cap: number | null,
): boolean {
  if (cap == null) return true;
  if (level == null) return false;
  return level <= cap;
}

/**
 * US club rugby season as YYYY-MM-DD bounds in the org timezone:
 * 1 Aug through 31 Jul. August starts the new season.
 */
export function rugbySeasonDayRange(
  timeZone: string,
  now: Date = new Date(),
): { from: string; to: string } {
  const key = dayKeyInZone(now, timeZone);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const startYear = month >= 8 ? year : year - 1;
  return {
    from: `${startYear}-08-01`,
    to: `${startYear + 1}-07-31`,
  };
}

export type AssignmentGameCounts = {
  upcoming: number;
  total: number;
};

function assignedOfficialIds(match: Match): string[] {
  const ids = new Set<string>();
  for (const slot of CREW_SLOTS) {
    for (const a of match.crew[slot] ?? []) {
      if (a.userId) ids.add(a.userId);
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userId) ids.add(c.userId);
  }
  return [...ids];
}

const DOUBLE_BOOKING_EXCLUDED_STATUSES = new Set<Match['status']>([
  'cancelled',
  'postponed',
  'draft',
]);

function matchEligibleForDoubleBookingCheck(match: Match): boolean {
  return !DOUBLE_BOOKING_EXCLUDED_STATUSES.has(match.status);
}

export type OfficialDayDoubleBooking = {
  userId: string;
  dayKey: string;
  matches: Match[];
};

/** Other assignments for an official on the same local calendar day. */
export function otherAssignmentsOnSameDay(
  matches: Match[],
  userId: string,
  kickoffAt: string,
  timeZone: string,
  opts?: { excludeMatchId?: string; nowMs?: number; upcomingOnly?: boolean },
): Match[] {
  const dayKey = dayKeyInZone(kickoffAt, timeZone);
  const nowMs = opts?.nowMs ?? Date.now();
  const upcomingOnly = opts?.upcomingOnly !== false;
  return matches
    .filter((m) => {
      if (opts?.excludeMatchId && m.id === opts.excludeMatchId) return false;
      if (!matchEligibleForDoubleBookingCheck(m)) return false;
      if (dayKeyInZone(m.kickoffAt, timeZone) !== dayKey) return false;
      if (assignmentForUser(m, userId) == null) return false;
      const kickoffMs = new Date(m.kickoffAt).getTime();
      if (Number.isNaN(kickoffMs)) return false;
      if (upcomingOnly && kickoffMs < nowMs) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
}

/** Officials on this match who also have another assignment that day. */
export function doubleBookedOfficialIdsForMatch(
  matches: Match[],
  match: Match,
  timeZone: string,
  opts?: { nowMs?: number; upcomingOnly?: boolean },
): string[] {
  if (!matchEligibleForDoubleBookingCheck(match)) return [];
  return assignedOfficialIds(match).filter(
    (uid) =>
      otherAssignmentsOnSameDay(matches, uid, match.kickoffAt, timeZone, {
        excludeMatchId: match.id,
        ...opts,
      }).length > 0,
  );
}

/** Every official assigned to two or more matches on the same local day. */
export function officialDoubleBookings(
  matches: Match[],
  timeZone: string,
  opts?: { nowMs?: number; upcomingOnly?: boolean },
): OfficialDayDoubleBooking[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const upcomingOnly = opts?.upcomingOnly !== false;
  const byUserDay = new Map<string, Map<string, Match[]>>();

  for (const match of matches) {
    if (!matchEligibleForDoubleBookingCheck(match)) continue;
    const kickoffMs = new Date(match.kickoffAt).getTime();
    if (Number.isNaN(kickoffMs)) continue;
    if (upcomingOnly && kickoffMs < nowMs) continue;

    const dayKey = dayKeyInZone(match.kickoffAt, timeZone);
    for (const uid of assignedOfficialIds(match)) {
      let days = byUserDay.get(uid);
      if (!days) {
        days = new Map();
        byUserDay.set(uid, days);
      }
      const list = days.get(dayKey) ?? [];
      list.push(match);
      days.set(dayKey, list);
    }
  }

  const out: OfficialDayDoubleBooking[] = [];
  for (const [userId, days] of byUserDay) {
    for (const [dayKey, matchList] of days) {
      if (matchList.length < 2) continue;
      out.push({
        userId,
        dayKey,
        matches: [...matchList].sort(
          (a, b) =>
            new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
        ),
      });
    }
  }

  return out.sort((a, b) => {
    const dayCmp = a.dayKey.localeCompare(b.dayKey);
    if (dayCmp !== 0) return dayCmp;
    return a.userId.localeCompare(b.userId);
  });
}

/** Match ids where at least one assigned official is double-booked that day. */
export function matchIdsWithDoubleBookings(
  matches: Match[],
  timeZone: string,
  opts?: { nowMs?: number; upcomingOnly?: boolean },
): Set<string> {
  const ids = new Set<string>();
  for (const row of officialDoubleBookings(matches, timeZone, opts)) {
    for (const match of row.matches) ids.add(match.id);
  }
  return ids;
}

/** Upcoming and in-range assignment counts per official (one count per match). */
export function assignmentGameCountsByOfficial(
  matches: Match[],
  opts: {
    timeZone: string;
    fromDay?: string | null;
    toDay?: string | null;
    nowMs?: number;
  },
): Map<string, AssignmentGameCounts> {
  const nowMs = opts.nowMs ?? Date.now();
  const fromMs = opts.fromDay
    ? new Date(zonedLocalToUtcIso(opts.fromDay, '00:00', opts.timeZone)).getTime()
    : null;
  const toMs = opts.toDay
    ? new Date(zonedLocalToUtcIso(opts.toDay, '23:59', opts.timeZone)).getTime()
    : null;
  const map = new Map<string, AssignmentGameCounts>();
  for (const match of matches) {
    const kickoffMs = new Date(match.kickoffAt).getTime();
    if (Number.isNaN(kickoffMs)) continue;
    if (fromMs != null && kickoffMs < fromMs) continue;
    if (toMs != null && kickoffMs > toMs) continue;
    for (const uid of assignedOfficialIds(match)) {
      const cur = map.get(uid) ?? { upcoming: 0, total: 0 };
      cur.total += 1;
      if (kickoffMs >= nowMs) cur.upcoming += 1;
      map.set(uid, cur);
    }
  }
  return map;
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

/** All assignments for a member, oldest kickoff first (newest at bottom). */
export function allAssignmentsForMember(
  matches: Match[],
  userId: string,
): Match[] {
  return matches
    .filter((m) => assignmentForUser(m, userId) != null)
    .sort(
      (a, b) =>
        new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
}

/** Assignments for a member within an optional local day range (inclusive). */
export function assignmentsForMemberInDayRange(
  matches: Match[],
  userId: string,
  opts: {
    timeZone: string;
    fromDay?: string | null;
    toDay?: string | null;
  },
): Match[] {
  const fromMs = opts.fromDay
    ? new Date(
        zonedLocalToUtcIso(opts.fromDay, '00:00', opts.timeZone),
      ).getTime()
    : null;
  const toMs = opts.toDay
    ? new Date(zonedLocalToUtcIso(opts.toDay, '23:59', opts.timeZone)).getTime()
    : null;
  return allAssignmentsForMember(matches, userId).filter((m) => {
    const kickoffMs = new Date(m.kickoffAt).getTime();
    if (Number.isNaN(kickoffMs)) return false;
    if (fromMs != null && kickoffMs < fromMs) return false;
    if (toMs != null && kickoffMs > toMs) return false;
    return true;
  });
}

/** Most recent assignments (any crew role), default last five. */
export function recentAssignmentsForMember(
  matches: Match[],
  userId: string,
  limit = 5,
): Match[] {
  return matchesForMember(matches, userId).slice(0, limit);
}

export function nextMatchForMember(
  matches: Match[],
  userId: string,
): Match | undefined {
  return upcomingMatchesForMember(matches, userId)[0];
}

export function formatMemberScheduleHint(
  match: Match | undefined,
  timeZone?: string | null,
): string {
  if (!match) return 'No upcoming games';
  const when = formatMatchKickoff(match.kickoffAt, timeZone, {
    weekday: 'short',
  });
  return `Next Match: ${when}`;
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
