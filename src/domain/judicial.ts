import type { CardLawId } from '@/domain/cardLaws';
import {
  disciplineTrendLabelWithLaws,
  trendBucketForLaws,
  DISCIPLINE_TREND_BUCKETS,
  type DisciplineTrendBucket,
} from '@/domain/cardLaws';
import {
  displayPlayerName,
  type CardColor,
  type CardConference,
  type CardIncident,
  type CardReport,
  type SecondOffenseColor,
} from '@/domain/reports';

export type JudicialCaseStatus =
  | 'recorded'
  | 'pending'
  | 'upheld'
  | 'dismissed'
  | 'reduced'
  | 'summary_judgment';

export type JudicialCardColor = CardColor | SecondOffenseColor;

export interface JudicialCase {
  id: string;
  reportId: string;
  incidentId: string;
  matchId: string;
  conference: CardConference | '';
  color: JudicialCardColor;
  playerFirstName: string;
  playerLastName: string;
  playerName: string;
  playerJersey?: string;
  teamId: string;
  teamName: string;
  lawIds: CardLawId[];
  offenseSummary: string;
  matchDate?: string;
  officialId?: string;
  officialName?: string;
  status: JudicialCaseStatus;
  sanctionMatches?: number;
  sanctionNote?: string;
  ruledAt?: string;
  ruledByUid?: string;
  ruledByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JudicialComment {
  id: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface JudicialDashboardSettings {
  recommendations: string[];
  updatedAt: string;
  updatedByUid?: string;
  updatedByName?: string;
}

export const JUDICIAL_CASE_STATUS_LABELS: Record<JudicialCaseStatus, string> = {
  recorded: 'Recorded',
  pending: 'Pending hearing',
  upheld: 'Upheld',
  dismissed: 'Dismissed',
  reduced: 'Reduced',
  summary_judgment: 'Summary judgment',
};

export function isHearingColor(color: JudicialCardColor): boolean {
  return color === 'red' || color === 'second_yellow_red';
}

export function defaultCaseStatus(color: JudicialCardColor): JudicialCaseStatus {
  return isHearingColor(color) ? 'pending' : 'recorded';
}

/** Upheld / reduced require a match-ban count or a note (e.g. time served). */
export function rulingNeedsSanction(status: JudicialCaseStatus): boolean {
  return status === 'upheld' || status === 'reduced';
}

export function judicialCaseId(incidentId: string, second = false): string {
  return second ? `${incidentId}_2` : incidentId;
}

export function normalizePlayerTraceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function playerTraceKey(c: JudicialCase): string {
  return `${c.teamName.trim().toLowerCase()}|${normalizePlayerTraceName(c.playerName)}`;
}

export function displayCasePlayer(c: JudicialCase): string {
  const name =
    c.playerName.trim() ||
    `${c.playerFirstName.trim()} ${c.playerLastName.trim()}`.trim();
  if (name) return name;
  if (c.playerJersey?.trim()) return `#${c.playerJersey.trim()}`;
  return 'Unknown player';
}

export function casePlayerNameFromParts(
  first: string,
  last: string,
  jersey?: string,
): {
  playerFirstName: string;
  playerLastName: string;
  playerName: string;
} {
  const playerFirstName = first.trim();
  const playerLastName = last.trim();
  const joined = `${playerFirstName} ${playerLastName}`.trim();
  const playerName =
    joined || (jersey?.trim() ? `#${jersey.trim()}` : '');
  return { playerFirstName, playerLastName, playerName };
}

function snapshotFromIncident(
  report: CardReport,
  card: CardIncident,
  nowIso: string,
  opts: { second: boolean },
): JudicialCase {
  const color: JudicialCardColor = opts.second
    ? (card.secondOffense?.color ?? 'red')
    : card.color;
  const lawIds = opts.second
    ? (card.secondOffense?.lawIds ?? [])
    : (card.lawIds ?? []);
  const summary = opts.second
    ? (card.secondOffense?.summary ?? '')
    : (card.offenseSummary ?? card.reason);
  const first = card.playerFirstName?.trim() ?? '';
  const last = card.playerLastName?.trim() ?? '';
  return {
    id: judicialCaseId(card.id, opts.second),
    reportId: report.id,
    incidentId: card.id,
    matchId: report.matchId,
    conference: report.conference ?? '',
    color,
    playerFirstName: first,
    playerLastName: last,
    playerName: displayPlayerName(card),
    playerJersey: card.playerJersey?.trim() || undefined,
    teamId: card.teamId,
    teamName: card.teamName,
    lawIds,
    offenseSummary: summary,
    matchDate: report.matchDate || undefined,
    officialId: report.officialId || undefined,
    officialName: report.officialName || undefined,
    status: defaultCaseStatus(color),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function casesFromCardReport(
  report: CardReport,
  nowIso = new Date().toISOString(),
): JudicialCase[] {
  const out: JudicialCase[] = [];
  for (const card of report.cards) {
    out.push(snapshotFromIncident(report, card, nowIso, { second: false }));
    if (card.receivedAnotherCard && card.secondOffense) {
      out.push(snapshotFromIncident(report, card, nowIso, { second: true }));
    }
  }
  return out;
}

export function isRedCardColor(color: JudicialCardColor): boolean {
  return color === 'red' || color === 'second_yellow_red';
}

export function sanctionText(c: JudicialCase): string {
  if (c.status === 'summary_judgment') {
    return c.sanctionNote?.trim() || 'Summary judgment / time served';
  }
  if (c.sanctionMatches != null) {
    const n = c.sanctionMatches;
    const matches = `${n} ${n === 1 ? 'match' : 'matches'}`;
    return c.sanctionNote?.trim()
      ? `${matches} — ${c.sanctionNote.trim()}`
      : matches;
  }
  return c.sanctionNote?.trim() || '';
}

export interface JudicialBarBreakdown {
  count: number;
  yellowCount: number;
  redCount: number;
}

export interface JudicialSchoolBarStat extends JudicialBarBreakdown {
  teamId: string;
  teamName: string;
}

export interface JudicialOfficialBarStat extends JudicialBarBreakdown {
  officialId: string;
  officialName: string;
}

export interface JudicialPlayerBarStat extends JudicialBarBreakdown {
  traceKey: string;
  playerName: string;
  teamName: string;
  displayLabel: string;
}

export interface DisciplineDashboardStats {
  totalCards: number;
  yellowCards: number;
  redCards: number;
  redsUpheld: number;
  redsDismissed: number;
  yellowPct: number;
  redPct: number;
  redUpheldPct: number;
  redDismissedPct: number;
  bySchool: JudicialSchoolBarStat[];
  byTrend: { bucket: DisciplineTrendBucket; label: string; count: number; pct: number }[];
  dismissedReds: JudicialCase[];
  upheldReds: JudicialCase[];
  pendingReds: JudicialCase[];
  byOfficial: JudicialOfficialBarStat[];
  byPlayer: JudicialPlayerBarStat[];
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function rugbySeasonLabel(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = month >= 7 ? year : year - 1;
  return `${start}–${start + 1}`;
}

export function rugbySeasonDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = month >= 7 ? year : year - 1;
  return { from: `${start}-08-01`, to: `${start + 1}-07-31` };
}

export type JudicialCaseListFilters = {
  conference?: CardConference | 'all';
  from?: string | null;
  to?: string | null;
  color?: 'all' | 'yellow' | 'red';
  status?: JudicialCaseStatus | 'all';
  school?: string | 'all';
  bucket?: DisciplineTrendBucket | 'all';
  officialId?: string | 'all';
  player?: string | null;
};

function caseMatchDate(c: JudicialCase): string {
  if (c.matchDate && c.matchDate.length >= 10) return c.matchDate.slice(0, 10);
  return c.createdAt.slice(0, 10);
}

export function filterJudicialCases(
  cases: JudicialCase[],
  filters: JudicialCaseListFilters,
): JudicialCase[] {
  const conference = filters.conference ?? 'all';
  const color = filters.color ?? 'all';
  const status = filters.status ?? 'all';
  const school = filters.school && filters.school !== 'all' ? filters.school : '';
  const bucket = filters.bucket ?? 'all';
  const officialId =
    filters.officialId && filters.officialId !== 'all'
      ? filters.officialId
      : '';
  const from = filters.from?.trim() || '';
  const to = filters.to?.trim() || '';
  const playerNeedle = filters.player?.trim()
    ? normalizePlayerTraceName(filters.player)
    : '';
  return cases.filter((c) => {
    if (conference !== 'all' && c.conference !== conference) return false;
    if (color === 'yellow' && c.color !== 'yellow') return false;
    if (color === 'red' && !isHearingColor(c.color)) return false;
    if (status === 'upheld') {
      if (
        c.status !== 'upheld' &&
        c.status !== 'reduced' &&
        c.status !== 'summary_judgment'
      ) {
        return false;
      }
    } else if (status !== 'all' && c.status !== status) {
      return false;
    }
    if (school && c.teamName !== school && c.teamId !== school) return false;
    if (bucket !== 'all' && trendBucketForLaws(c.lawIds) !== bucket) {
      return false;
    }
    if (officialId && c.officialId !== officialId) return false;
    if (playerNeedle) {
      const hay = normalizePlayerTraceName(c.playerName);
      if (school) {
        if (hay !== playerNeedle) return false;
      } else if (!hay.includes(playerNeedle)) {
        return false;
      }
    }
    const d = caseMatchDate(c);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export function filterCasesForDashboard(
  cases: JudicialCase[],
  conference: CardConference | 'all',
): JudicialCase[] {
  return filterJudicialCases(cases, { conference });
}

export function judicialCasesQuery(
  params: Record<string, string | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = raw?.trim();
    if (!value || value === 'all') continue;
    sp.set(key, value);
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function disciplineDashboardStats(
  cases: JudicialCase[],
): DisciplineDashboardStats {
  const totalCards = cases.length;
  const yellowCards = cases.filter((c) => c.color === 'yellow').length;
  const reds = cases.filter((c) => isRedCardColor(c.color));
  const redCards = reds.length;
  const redsUpheld = reds.filter(
    (c) =>
      c.status === 'upheld' ||
      c.status === 'reduced' ||
      c.status === 'summary_judgment',
  ).length;
  const redsDismissed = reds.filter((c) => c.status === 'dismissed').length;

  const schoolMap = new Map<string, JudicialSchoolBarStat>();
  for (const c of cases) {
    const key = c.teamName || c.teamId;
    const cur = schoolMap.get(key);
    const isRed = isRedCardColor(c.color);
    if (cur) {
      cur.count += 1;
      if (isRed) cur.redCount += 1;
      else cur.yellowCount += 1;
    } else {
      schoolMap.set(key, {
        teamId: c.teamId,
        teamName: c.teamName || 'Unknown',
        count: 1,
        yellowCount: isRed ? 0 : 1,
        redCount: isRed ? 1 : 0,
      });
    }
  }
  const bySchool = [...schoolMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.teamName.localeCompare(b.teamName);
  });

  const trendCounts = new Map<DisciplineTrendBucket, number>();
  for (const bucket of DISCIPLINE_TREND_BUCKETS) trendCounts.set(bucket, 0);
  for (const c of cases) {
    const bucket = trendBucketForLaws(c.lawIds);
    trendCounts.set(bucket, (trendCounts.get(bucket) ?? 0) + 1);
  }
  const byTrend = DISCIPLINE_TREND_BUCKETS.map((bucket) => {
    const count = trendCounts.get(bucket) ?? 0;
    return {
      bucket,
      label: disciplineTrendLabelWithLaws(bucket),
      count,
      pct: pct(count, totalCards),
    };
  }).filter((row) => row.count > 0);

  const dismissedReds = reds.filter((c) => c.status === 'dismissed');
  const upheldReds = reds.filter(
    (c) =>
      c.status === 'upheld' ||
      c.status === 'reduced' ||
      c.status === 'summary_judgment',
  );
  const pendingReds = reds.filter((c) => c.status === 'pending');

  const officialMap = new Map<string, JudicialOfficialBarStat>();
  for (const c of cases) {
    const id = c.officialId || c.officialName || 'unknown';
    const cur = officialMap.get(id);
    const isRed = isRedCardColor(c.color);
    if (cur) {
      cur.count += 1;
      if (isRed) cur.redCount += 1;
      else cur.yellowCount += 1;
    } else {
      officialMap.set(id, {
        officialId: c.officialId || '',
        officialName: c.officialName || 'Unknown official',
        count: 1,
        yellowCount: isRed ? 0 : 1,
        redCount: isRed ? 1 : 0,
      });
    }
  }
  const byOfficial = [...officialMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.officialName.localeCompare(b.officialName);
  });

  const playerMap = new Map<string, JudicialPlayerBarStat>();
  for (const c of cases) {
    const key = playerTraceKey(c);
    const cur = playerMap.get(key);
    const isRed = isRedCardColor(c.color);
    if (cur) {
      cur.count += 1;
      if (isRed) cur.redCount += 1;
      else cur.yellowCount += 1;
    } else {
      playerMap.set(key, {
        traceKey: key,
        playerName: c.playerName,
        teamName: c.teamName || 'Unknown',
        displayLabel: `${displayCasePlayer(c)} (${c.teamName || 'Unknown'})`,
        count: 1,
        yellowCount: isRed ? 0 : 1,
        redCount: isRed ? 1 : 0,
      });
    }
  }
  const byPlayer = [...playerMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.displayLabel.localeCompare(b.displayLabel);
  });

  return {
    totalCards,
    yellowCards,
    redCards,
    redsUpheld,
    redsDismissed,
    yellowPct: pct(yellowCards, totalCards),
    redPct: pct(redCards, totalCards),
    redUpheldPct: pct(redsUpheld, redCards),
    redDismissedPct: pct(redsDismissed, redCards),
    bySchool,
    byTrend,
    dismissedReds,
    upheldReds,
    pendingReds,
    byOfficial,
    byPlayer,
  };
}

export function hearingOutcomeLabel(c: JudicialCase): string {
  if (c.status === 'dismissed') return 'Dismissed';
  if (c.status === 'summary_judgment') {
    return sanctionText(c) || 'Summary judgment / time served';
  }
  const text = sanctionText(c);
  if (text) return text;
  if (c.status === 'reduced') return 'Reduced';
  return 'Upheld';
}
