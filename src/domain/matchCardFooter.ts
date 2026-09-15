import {
  matchEventTypeLabel,
  matchFormatChoiceLabel,
  matchSideChoiceLabel,
  parseMatchDivision,
} from '@/domain/matchDivision';
import type { Match, Team } from '@/domain/types';

/** Card footer label — explicit title, or derived format + event type (e.g. 7s Tournament). */
export function matchCardEventLabel(
  match: Pick<
    Match,
    'title' | 'level' | 'isTournament' | 'matchType' | 'gender' | 'competition'
  >,
): string | null {
  const title = match.title?.trim();
  if (title) return title;

  const division = parseMatchDivision(match, []);
  const parts: string[] = [];
  if (division.format !== 'xvs') {
    parts.push(matchFormatChoiceLabel(division.format));
  }
  if (division.eventType !== 'league') {
    parts.push(matchEventTypeLabel(division.eventType));
  } else if (division.side) {
    parts.push(matchSideChoiceLabel(division.side));
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

export function teamDisplayAbbreviation(
  team: Pick<Team, 'abbreviation' | 'name'> | undefined,
  fallbackName: string,
): string {
  const abbr = team?.abbreviation?.trim();
  if (abbr) return abbr.toUpperCase();
  const words = fallbackName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 6)
      .toUpperCase();
  }
  const compact = fallbackName.replace(/[^A-Za-z0-9]/g, '');
  return (compact || fallbackName).slice(0, 6).toUpperCase();
}

export type TeamDisplayLabel = {
  name: string;
  abbreviation: string | null;
};

/** Full roster name with sheet abbreviation when available. */
export function teamDisplayLabel(
  team: Pick<Team, 'abbreviation' | 'name'> | undefined,
  storedName: string,
): TeamDisplayLabel {
  const stored = storedName.trim();
  const name = team?.name?.trim() || stored;
  const abbrRaw = team?.abbreviation?.trim();
  if (!abbrRaw) return { name, abbreviation: null };
  const abbreviation = abbrRaw.toUpperCase();
  if (name.toUpperCase() === abbreviation) return { name, abbreviation: null };
  return { name, abbreviation };
}

export function formatTeamDisplayLabel(label: TeamDisplayLabel): string {
  return label.abbreviation
    ? `${label.name} (${label.abbreviation})`
    : label.name;
}

/** Match/event labels — full team name with roster abbreviation beside it. */
export function matchTeamDisplayNames(
  match: Pick<Match, 'homeTeamId' | 'awayTeamId' | 'homeTeamName' | 'awayTeamName'>,
  teamsById: ReadonlyMap<string, Pick<Team, 'abbreviation' | 'name'>>,
): { home: TeamDisplayLabel; away: TeamDisplayLabel } {
  return {
    home: teamDisplayLabel(teamsById.get(match.homeTeamId), match.homeTeamName),
    away: teamDisplayLabel(teamsById.get(match.awayTeamId), match.awayTeamName),
  };
}

export function matchHasForfeitOutcome(
  match: Pick<Match, 'forfeitTeamId' | 'playedForfeit'>,
): boolean {
  return Boolean(match.forfeitTeamId) || match.playedForfeit === true;
}

export function matchShowsTeamConfirmation(
  match: Pick<Match, 'status' | 'forfeitTeamId' | 'playedForfeit'>,
): boolean {
  if (matchHasForfeitOutcome(match)) return false;
  return (
    match.status !== 'draft' &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed'
  );
}

export type MatchUnconfirmedTeamBadge = {
  side: 'home' | 'away';
  abbreviation: string;
  label: string;
};

/** Red-chip labels for sides that have not confirmed match details yet. */
export function matchUnconfirmedTeamBadges(
  match: Pick<
    Match,
    | 'status'
    | 'homeTeamId'
    | 'awayTeamId'
    | 'homeTeamName'
    | 'awayTeamName'
    | 'homeConfirmedAt'
    | 'awayConfirmedAt'
  >,
  teamsById: ReadonlyMap<string, Pick<Team, 'abbreviation' | 'name'>>,
): MatchUnconfirmedTeamBadge[] {
  if (!matchShowsTeamConfirmation(match)) return [];

  const out: MatchUnconfirmedTeamBadge[] = [];
  if (!match.homeConfirmedAt) {
    const abbreviation = teamDisplayAbbreviation(
      teamsById.get(match.homeTeamId),
      match.homeTeamName,
    );
    out.push({
      side: 'home',
      abbreviation,
      label: `${abbreviation} - unconfirmed`,
    });
  }
  if (!match.awayConfirmedAt) {
    const abbreviation = teamDisplayAbbreviation(
      teamsById.get(match.awayTeamId),
      match.awayTeamName,
    );
    out.push({
      side: 'away',
      abbreviation,
      label: `${abbreviation} - unconfirmed`,
    });
  }
  return out;
}
