import {
  gameplayFormatFromLabel,
  matchGameplayFormat,
  type GameplayFormat,
} from '@/domain/matchGameplayFormat';
import type { Match, MatchGender } from '@/domain/types';

export type MatchEventType = 'league' | 'exhibition' | 'tournament';
export type MatchFormatChoice = 'xvs' | '10s' | '7s';
export const ALL_MATCH_FORMAT_CHOICES: MatchFormatChoice[] = ['xvs', '10s', '7s'];
export type MatchSideChoice = '1st' | '2nd' | '3rd';

export type MatchDivisionSelection = {
  gender: MatchGender;
  tier: string;
  eventType: MatchEventType;
  format: MatchFormatChoice;
  side: MatchSideChoice | null;
};

const SIDE_RE = /\b(1st|2nd|3rd)\s*side\b/i;

const RESERVED_LEVELS = new Set(['exhibition', 'tourney', 'tournament']);

function tierSortKey(label: string): number {
  const trimmed = label.trim();
  const tier = /^tier\s+(\d+)$/i.exec(trimmed);
  if (tier) return Number(tier[1]);
  const div = /^d(\d+)$/i.exec(trimmed);
  if (div) return Number(div[1]);
  return 1000;
}

export function ensureCompleteTierSequence(tiers: string[]): string[] {
  const out = [...tiers];
  const addIfMissing = (label: string) => {
    if (!out.includes(label)) out.push(label);
  };
  const hasTier = (n: number) =>
    out.some((t) => t.trim().toLowerCase() === `tier ${n}`);
  const hasD = (n: number) =>
    out.some((t) => t.trim().toUpperCase() === `D${n}`);

  if (hasTier(1) || hasTier(2) || hasTier(3) || hasTier(4)) {
    for (let n = 1; n <= 4; n += 1) addIfMissing(`Tier ${n}`);
  }
  if (hasD(1) || hasD(2) || hasD(3) || hasD(4)) {
    for (let n = 1; n <= 4; n += 1) addIfMissing(`D${n}`);
  }

  return out.sort(
    (a, b) => tierSortKey(a) - tierSortKey(b) || a.localeCompare(b),
  );
}

/** League tiers from org config — excludes exhibition/tournament/format labels. */
export function tierOptionsFromOrgLevels(levels: string[]): string[] {
  const tiers = levels.filter((level) => {
    const trimmed = level.trim();
    if (!trimmed) return false;
    if (RESERVED_LEVELS.has(trimmed.toLowerCase())) return false;
    if (gameplayFormatFromLabel(trimmed)) return false;
    return true;
  });
  if (tiers.length > 0) return ensureCompleteTierSequence(tiers);
  return ['D1', 'D2', 'D3', 'D4'];
}

export function parseMatchEventType(
  match: Pick<Match, 'level' | 'isTournament'>,
): MatchEventType {
  if (match.isTournament === true) return 'tournament';
  const fold = match.level?.trim().toLowerCase() ?? '';
  if (fold === 'tourney' || fold === 'tournament') return 'tournament';
  if (fold === 'exhibition') return 'exhibition';
  return 'league';
}

export function parseMatchTier(
  match: Pick<Match, 'level' | 'isTournament'>,
  tierOptions: string[],
): string {
  if (parseMatchEventType(match) !== 'league') {
    return tierOptions[0] ?? 'D1';
  }
  const level = match.level?.trim() ?? '';
  if (tierOptions.includes(level)) return level;
  return tierOptions[0] ?? 'D1';
}

export function parseMatchSide(
  match: Pick<Match, 'matchType'>,
): MatchSideChoice | null {
  const hit = match.matchType?.match(SIDE_RE);
  if (!hit?.[1]) return null;
  const raw = hit[1].toLowerCase();
  if (raw === '1st' || raw === '2nd' || raw === '3rd') return raw;
  return null;
}

export function parseMatchFormatChoice(
  match: Partial<
    Pick<Match, 'matchType' | 'title' | 'level' | 'competition'>
  >,
): MatchFormatChoice {
  const parsed: GameplayFormat | null = matchGameplayFormat(match);
  if (parsed === '7s') return '7s';
  if (parsed === '10s') return '10s';
  return 'xvs';
}

export function parseMatchDivision(
  match: Pick<
    Match,
    'gender' | 'level' | 'isTournament' | 'matchType' | 'title' | 'competition'
  >,
  tierOptions: string[],
): MatchDivisionSelection {
  return {
    gender: match.gender,
    tier: parseMatchTier(match, tierOptions),
    eventType: parseMatchEventType(match),
    format: parseMatchFormatChoice(match),
    side: parseMatchSide(match),
  };
}

export function composeMatchTypeLabel(
  format: MatchFormatChoice,
  side: MatchSideChoice | null,
): string | undefined {
  const parts: string[] = [];
  if (format === '7s') parts.push('7s');
  else if (format === '10s') parts.push('10s');
  if (side) parts.push(`${side} Side`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function applyMatchDivision(
  division: MatchDivisionSelection,
): Pick<Match, 'gender' | 'level' | 'isTournament' | 'matchType'> {
  let level: string;
  let isTournament: boolean;

  if (division.eventType === 'exhibition') {
    level = 'Exhibition';
    isTournament = false;
  } else if (division.eventType === 'tournament') {
    level = 'Tournament';
    isTournament = true;
  } else {
    level = division.tier;
    isTournament = false;
  }

  return {
    gender: division.gender,
    level,
    isTournament,
    matchType: composeMatchTypeLabel(division.format, division.side),
  };
}

export function matchEventTypeLabel(eventType: MatchEventType): string {
  if (eventType === 'exhibition') return 'Exhibition';
  if (eventType === 'tournament') return 'Tournament';
  return 'League';
}

export function matchFormatChoiceLabel(format: MatchFormatChoice): string {
  if (format === '7s') return '7s';
  if (format === '10s') return '10s';
  return 'XVs';
}

export function matchSideChoiceLabel(side: MatchSideChoice): string {
  return `${side} Side`;
}

/** Compact read-only labels for match detail header. */
export function matchDivisionSummaryLabels(
  match: Pick<
    Match,
    'gender' | 'level' | 'isTournament' | 'matchType' | 'title' | 'competition'
  >,
  tierOptions: string[],
  genderLabelFn: (g: MatchGender) => string,
): string[] {
  const division = parseMatchDivision(match, tierOptions);
  const labels = [genderLabelFn(division.gender)];
  if (division.eventType === 'league') {
    labels.push(division.tier);
  } else {
    labels.push(matchEventTypeLabel(division.eventType));
  }
  if (division.format !== 'xvs') {
    labels.push(matchFormatChoiceLabel(division.format));
  }
  if (division.side) {
    labels.push(matchSideChoiceLabel(division.side));
  }
  return labels;
}
