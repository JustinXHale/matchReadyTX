import type { Match, MatchGender } from './types';
import { genderLabel } from './types';

export type StandingRow = {
  teamId: string;
  teamName: string;
  played: number;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  pd: number;
};

export type StandingGroup = {
  key: string;
  gender: MatchGender;
  level: string;
  label: string;
  rows: StandingRow[];
};

function isScored(match: Match): match is Match & {
  homeScore: number;
  awayScore: number;
} {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore) &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed' &&
    match.status !== 'draft' &&
    !match.playedForfeit
  );
}

/** Build W / L / T / PF / PA / PD tables grouped by gender × level. */
export function standingsByDivision(matches: Match[]): StandingGroup[] {
  const scored = matches.filter(isScored);
  const groupMap = new Map<
    string,
    {
      gender: MatchGender;
      level: string;
      teams: Map<string, StandingRow>;
    }
  >();

  const ensureTeam = (
    teams: Map<string, StandingRow>,
    teamId: string,
    teamName: string,
  ): StandingRow => {
    let row = teams.get(teamId);
    if (!row) {
      row = {
        teamId,
        teamName,
        played: 0,
        w: 0,
        l: 0,
        t: 0,
        pf: 0,
        pa: 0,
        pd: 0,
      };
      teams.set(teamId, row);
    }
    return row;
  };

  for (const m of scored) {
    const key = `${m.gender}::${m.level}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { gender: m.gender, level: m.level, teams: new Map() };
      groupMap.set(key, group);
    }

    const home = ensureTeam(group.teams, m.homeTeamId, m.homeTeamName);
    const away = ensureTeam(group.teams, m.awayTeamId, m.awayTeamName);

    home.played += 1;
    away.played += 1;
    home.pf += m.homeScore;
    home.pa += m.awayScore;
    away.pf += m.awayScore;
    away.pa += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.w += 1;
      away.l += 1;
    } else if (m.homeScore < m.awayScore) {
      away.w += 1;
      home.l += 1;
    } else {
      home.t += 1;
      away.t += 1;
    }
  }

  const groups: StandingGroup[] = [];
  for (const group of groupMap.values()) {
    const rows = [...group.teams.values()].map((r) => ({
      ...r,
      pd: r.pf - r.pa,
    }));
    rows.sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      if (b.pd !== a.pd) return b.pd - a.pd;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.teamName.localeCompare(b.teamName);
    });
    groups.push({
      key: `${group.gender}-${group.level}`,
      gender: group.gender,
      level: group.level,
      label: `${genderLabel(group.gender)} · ${group.level}`,
      rows,
    });
  }

  groups.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
    return a.level.localeCompare(b.level);
  });

  return groups;
}

/** Merge tier tables into one list per gender (teams that play across tiers). */
export function standingsCombined(matches: Match[]): StandingGroup[] {
  const byDivision = standingsByDivision(matches);
  const byGender = new Map<
    MatchGender,
    Map<string, StandingRow>
  >();

  for (const group of byDivision) {
    let teams = byGender.get(group.gender);
    if (!teams) {
      teams = new Map();
      byGender.set(group.gender, teams);
    }
    for (const row of group.rows) {
      const existing = teams.get(row.teamId);
      if (!existing) {
        teams.set(row.teamId, { ...row });
        continue;
      }
      existing.played += row.played;
      existing.w += row.w;
      existing.l += row.l;
      existing.t += row.t;
      existing.pf += row.pf;
      existing.pa += row.pa;
      existing.pd = existing.pf - existing.pa;
    }
  }

  const groups: StandingGroup[] = [];
  for (const [gender, teams] of byGender) {
    const rows = [...teams.values()];
    rows.sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      if (b.pd !== a.pd) return b.pd - a.pd;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.teamName.localeCompare(b.teamName);
    });
    groups.push({
      key: gender,
      gender,
      level: '',
      label: genderLabel(gender),
      rows,
    });
  }

  groups.sort((a, b) => a.gender.localeCompare(b.gender));
  return groups;
}
