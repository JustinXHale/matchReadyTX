import type { Match, Team, UserProfile } from '@/domain/types';
import { memberListName } from '@/domain/members';

export type TeamVenue = {
  venueName: string;
  venueAddress: string;
};

export type ScheduleTeamEntry = {
  team: Team;
  matchCount: number;
  genders: string[];
  levels: string[];
  competitions: string[];
};

export type ConferenceTeamOption = {
  id: string;
  name: string;
  conference: string;
};

function competitionFromGender(gender: string): string | null {
  if (gender === 'women') return 'Lonestar Women';
  if (gender === 'men') return 'Lonestar Men';
  return null;
}

/** Union of org teams + every club appearing on synced matches. */
export function teamsFromSchedule(matches: Match[], teams: Team[]): Team[] {
  const byId = new Map<string, Team>();
  for (const t of teams) byId.set(t.id, t);
  for (const m of matches) {
    for (const side of [
      { id: m.homeTeamId, name: m.homeTeamName },
      { id: m.awayTeamId, name: m.awayTeamName },
    ]) {
      if (!byId.has(side.id)) {
        byId.set(side.id, {
          id: side.id,
          name: side.name,
          contactEmails: [],
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export function scheduleTeamEntries(
  matches: Match[],
  teams: Team[],
): ScheduleTeamEntry[] {
  const allTeams = teamsFromSchedule(matches, teams);
  const stats = new Map<
    string,
    {
      matchCount: number;
      genders: Set<string>;
      levels: Set<string>;
      competitions: Set<string>;
    }
  >();

  for (const m of matches) {
    if (m.status === 'cancelled' || m.status === 'draft') continue;
    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      let s = stats.get(teamId);
      if (!s) {
        s = {
          matchCount: 0,
          genders: new Set(),
          levels: new Set(),
          competitions: new Set(),
        };
        stats.set(teamId, s);
      }
      s.matchCount += 1;
      s.genders.add(m.gender);
      s.levels.add(m.level);
      if (m.competition?.trim()) s.competitions.add(m.competition.trim());
    }
  }

  const entries = allTeams.map((team) => {
    const s = stats.get(team.id);
    const competitions = new Set<string>();
    if (team.competition?.trim()) competitions.add(team.competition.trim());
    if (s) {
      for (const c of s.competitions) competitions.add(c);
      // Backfill conference when legacy matches have gender but no competition.
      if (competitions.size === 0) {
        for (const g of s.genders) {
          const comp = competitionFromGender(g);
          if (comp) competitions.add(comp);
        }
      }
    }
    return {
      team,
      matchCount: s?.matchCount ?? 0,
      genders: s ? [...s.genders] : [],
      levels: s ? [...s.levels].sort() : [],
      competitions: [...competitions].sort(),
    };
  });

  // Hide stale legacy "unknown conference" variants when split conference teams exist.
  const grouped = new Map<string, ScheduleTeamEntry[]>();
  for (const entry of entries) {
    const key = entry.team.name.trim().toLowerCase();
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }
  const hiddenIds = new Set<string>();
  for (const group of grouped.values()) {
    const hasKnown = group.some((e) => e.competitions.length > 0);
    if (!hasKnown) continue;
    for (const entry of group) {
      const unknown = entry.competitions.length === 0;
      const likelyLegacy = unknown && entry.matchCount === 0;
      if (likelyLegacy) hiddenIds.add(entry.team.id);
    }
  }

  return entries.filter((entry) => !hiddenIds.has(entry.team.id));
}

/** Most common home venue for a club (from schedule when they are home). */
export function primaryHomeVenueForTeam(
  teamId: string,
  matches: Match[],
): TeamVenue | null {
  const counts = new Map<
    string,
    { venueName: string; venueAddress: string; count: number }
  >();
  for (const m of matches) {
    if (m.homeTeamId !== teamId) continue;
    if (m.status === 'cancelled' || m.status === 'draft') continue;
    const venueName = m.venueName?.trim() || 'TBD';
    const venueAddress = m.venueAddress?.trim() || '';
    const key = `${venueName.toLowerCase()}|${venueAddress.toLowerCase()}`;
    const prev = counts.get(key);
    if (prev) prev.count += 1;
    else counts.set(key, { venueName, venueAddress, count: 1 });
  }
  let best: { venueName: string; venueAddress: string; count: number } | null =
    null;
  for (const v of counts.values()) {
    if (!best || v.count > best.count) best = v;
  }
  if (!best) return null;
  return { venueName: best.venueName, venueAddress: best.venueAddress };
}

export function formatTeamVenue(venue: TeamVenue | null): string {
  if (!venue) return '—';
  const parts = [venue.venueName, venue.venueAddress].filter(Boolean);
  return parts.join(' · ') || '—';
}

/** Registered team admins linked to this club. */
export function teamAdminsForTeam(
  teamId: string,
  users: UserProfile[],
): UserProfile[] {
  return users
    .filter(
      (u) =>
        u.roles.includes('teamAdmin') &&
        u.profileComplete &&
        u.teamIds.includes(teamId),
    )
    .sort((a, b) => memberListName(a).localeCompare(memberListName(b)));
}

/** Contact emails on the team record (Contacts sheet — may not be registered yet). */
export function teamContactEmails(team: Team): string[] {
  return [...new Set(team.contactEmails.map((e) => e.trim()).filter(Boolean))];
}

export function teamConferenceLabel(competitions: string[]): string {
  if (competitions.length === 0) return 'Conference unknown';
  if (competitions.length === 1) return competitions[0]!;
  return competitions.join(' · ');
}

/**
 * Shared picker options for conference-grouped team selection.
 * Keeps member edit + profile request flows in sync.
 */
export function conferenceTeamOptions(
  matches: Match[],
  teams: Team[],
  allowedTeamIds?: Set<string>,
): ConferenceTeamOption[] {
  return scheduleTeamEntries(matches, teams)
    .filter((entry) =>
      allowedTeamIds ? allowedTeamIds.has(entry.team.id) : true,
    )
    .map((entry) => ({
      id: entry.team.id,
      name: entry.team.name,
      conference: teamConferenceLabel(entry.competitions),
    }))
    .filter((entry) => entry.conference !== 'Conference unknown')
    .sort((a, b) =>
      a.conference === b.conference
        ? a.name.localeCompare(b.name)
        : a.conference.localeCompare(b.conference),
    );
}
