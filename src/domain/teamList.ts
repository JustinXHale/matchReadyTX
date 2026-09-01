import {
  displayCompetitionLabel,
  isLoneStarMenCompetition,
  isLoneStarWomenCompetition,
} from '@/domain/competitions';
import type { Team } from '@/domain/types';

function competitionPickerKey(competition?: string): string {
  const raw = (competition ?? '').trim();
  if (!raw) return '';
  if (isLoneStarMenCompetition(raw)) return 'lone star men';
  if (isLoneStarWomenCompetition(raw)) return 'lone star women';
  return displayCompetitionLabel(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

function teamPickerDedupeKey(
  team: Pick<Team, 'id' | 'name' | 'competition' | 'abbreviation'>,
): string {
  const abbr = (team.abbreviation ?? '').trim().toUpperCase();
  const name = team.name.trim().toLowerCase();
  const identity = abbr || name;
  return `${identity}|${competitionPickerKey(team.competition)}`;
}

function pickerTeamScore(
  team: Pick<Team, 'id' | 'name' | 'competition' | 'abbreviation'>,
): number {
  let score = 0;
  if ((team.abbreviation ?? '').trim()) score += 4;
  if (team.id.includes('_lonestar_') && !team.id.includes('_lone_star_')) score += 2;
  else if (team.id.includes('_lonestar_')) score += 1;
  score += Math.min(team.name.trim().length, 100) / 100;
  return score;
}

/** Collapse duplicate roster rows (slug dupes, Lonestar/Lone Star alias drift). */
export function dedupeTeamsForPicker<
  T extends Pick<Team, 'id' | 'name' | 'competition' | 'abbreviation'>,
>(teams: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const team of teams) {
    const key = teamPickerDedupeKey(team);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, team);
      continue;
    }
    if (pickerTeamScore(team) > pickerTeamScore(existing)) {
      byKey.set(key, team);
    }
  }
  return [...byKey.values()];
}
