import {
  CREW_SLOTS,
  assignmentForUser,
  crewPeople,
  emptyCrew,
  type CrewSlot,
  type Match,
  type MatchGender,
  type UserProfile,
} from '@/domain/types';
import {
  isFivePointValue,
  parseFivePointChoice,
  SCALE_NA,
  type FivePointChoice,
  type FivePointValue,
} from '@/domain/fivePointScale';
import type { CardLawId, PlayerPosition } from '@/domain/cardLaws';

/** Minutes after kickoff when MO/AR/CMO report notices open. */
export const REPORT_DUE_AFTER_MS = 90 * 60 * 1000;

/** CMO guidance deadline after kickoff. */
export const CMO_DEADLINE_AFTER_MS = 48 * 60 * 60 * 1000;

export type ReportFormKind =
  | 'mo_quick'
  | 'mo_performance'
  | 'ar_basic'
  | 'cmo';

export type ReportAssigneeSlot = 'mo' | 'ar1' | 'ar2' | 'cmo';

export type MatchReportStatus = 'pending' | 'submitted';

export type CompetitionUnion =
  | 'rugby_texas_youth'
  | 'ncr_lonestar_college'
  | 'texas_rugby_union_club';

export const COMPETITION_UNION_LABELS: Record<CompetitionUnion, string> = {
  rugby_texas_youth: 'Rugby Texas Youth Rugby (HS Boys, HS Girls, Youth)',
  ncr_lonestar_college: 'Lone Star College Rugby (Men’s/Women’s)',
  texas_rugby_union_club:
    'Texas Rugby Union Club Rugby (Men’s/Women’s D1–D4, Senior)',
};

export type CardColor = 'yellow' | 'red';

export type CardConference = 'lonestar_men' | 'lonestar_women';

export const CARD_CONFERENCE_LABELS: Record<CardConference, string> = {
  lonestar_men: 'Lonestar Men',
  lonestar_women: 'Lonestar Women',
};

export type SecondOffenseColor = 'second_yellow_red' | 'red';

export interface SecondOffense {
  color: SecondOffenseColor;
  approximateTime: string;
  lawIds: CardLawId[];
  summary: string;
}

export interface CardIncident {
  id: string;
  color: CardColor;
  /** Display name — derived from first/last when those are set. */
  playerName: string;
  playerFirstName?: string;
  playerLastName?: string;
  playerJersey?: string;
  playerPosition?: PlayerPosition | '';
  teamId: string;
  teamName: string;
  /** Approximate time of the infraction (minute or relative, e.g. early second half). */
  minute?: string;
  /** Legacy free-text law/reason. New reports use lawIds + offenseSummary. */
  reason: string;
  lawIds?: CardLawId[];
  offenseSummary?: string;
  receivedAnotherCard?: boolean;
  secondOffense?: SecondOffense;
  /** Scheduler-only notes for this card. */
  additionalInfoPrivate?: string;
}

export type MatchFormat = '7s' | '10s' | '15s';

export const BREAKDOWN_REWARD_OPTIONS = [
  'Tackler Not Rolling',
  'Tackler Not Releasing',
  'Ball Carrier Not Releasing',
  'Defense Off Feet',
  'Attack Off Feet',
] as const;

export type BreakdownReward = (typeof BREAKDOWN_REWARD_OPTIONS)[number];

/** MO Quick / Performance — optional match-wide comment. */
export const MATCH_FEEDBACK_LABEL = 'Feedback on the match';

export const AR_COMFORT_QUESTION =
  "Were you comfortable serving as an assistant referee at this match's level?";

export type CrewAttendanceSlot = CrewSlot | 'cmo';

export interface CrewAttendanceEntry {
  slot: CrewAttendanceSlot;
  userId: string;
  userName: string;
  attended: boolean;
}

/** Assigned fee crew + CMO for attendance confirmation. */
export function crewForAttendance(match: Match): CrewAttendanceEntry[] {
  const out: CrewAttendanceEntry[] = [];
  for (const slot of CREW_SLOTS) {
    for (const a of crewPeople(match.crew[slot])) {
      if (a.userId && a.userName) {
        out.push({
          slot,
          userId: a.userId,
          userName: a.userName,
          attended: true,
        });
      }
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userId && c.userName) {
      out.push({
        slot: 'cmo',
        userId: c.userId,
        userName: c.userName,
        attended: true,
      });
    }
  }
  return out;
}

/** MO Quick / Performance payload. */
export interface MoReportPayload {
  homePoints: number;
  awayPoints: number;
  /** Totals (home + away). Kept for card-report nudge / Quick Report. */
  yellowCards: number;
  redCards: number;
  homeYellowCards?: number;
  homeRedCards?: number;
  awayYellowCards?: number;
  awayRedCards?: number;
  refereeName?: string;
  matchDate?: string;
  format?: MatchFormat;
  division?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  /** Legacy free-text crew list / summary. */
  refereeTeamNote?: string;
  /** Per-person attendance (defaults all present). */
  crewAttendance?: CrewAttendanceEntry[];
  /** Required when anyone marked absent. */
  crewAbsenceNote?: string;
  /**
   * Optional note about issues with someone on the referee team.
   * Scheduler-confidential (admin): only shown in Scheduler lens (`isAssignerView`).
   */
  crewIssuesNote?: string;
  lightFeedback?: string;
  /** When a CMO was assigned but did not show — unlocks Quick Report. */
  cmoDidNotAttend?: boolean;
  /** Tournament day — score and card counts are not collected. */
  tournamentMatch?: boolean;
  /** Section 2 — Snapshot self assessment */
  gameTemperature?: number;
  controlAndFlow?: number;
  todayIPerformed?: string;
  /** Section 3 — Match reflection */
  typeOfMoment?: string;
  decidedAndWhy?: string;
  breakdownRewards?: BreakdownReward[];
  setPieceChallenge?: string;
  advantageUse?: number;
  /** Section 4 — Closing */
  nonCardProblems?: string;
  otherCommentsOrLink?: string;
  /** Legacy / Quick-oriented fields (optional) */
  whatWentWell?: string;
  whatToImprove?: string;
  keyDecisions?: string;
  fitnessPositioning?: string;
  otherNotes?: string;
}

export interface ArReportPayload {
  stillComfortable: 'yes' | 'no' | '';
  keyIncidents?: string;
  note?: string;
  /** Optional AR notes on the match (not MO performance review). */
  matchFeedback?: string;
  crewAttendance?: CrewAttendanceEntry[];
  crewAbsenceNote?: string;
  /** Scheduler-confidential when filed by AR. */
  crewIssuesNote?: string;
}

export type CmoScaleKey =
  | 'scrum'
  | 'breakdown'
  | 'advantage'
  | 'gameControl'
  | 'communication'
  | 'materiality'
  | 'positioning'
  | 'lineout'
  | 'fitness'
  | 'bigDecisions';

/** Competency order matches last year’s CMO Google Form. */
export const CMO_SCALE_KEYS: CmoScaleKey[] = [
  'scrum',
  'breakdown',
  'advantage',
  'gameControl',
  'communication',
  'materiality',
  'positioning',
  'lineout',
  'fitness',
  'bigDecisions',
];

export const CMO_SCALE_LABELS: Record<CmoScaleKey, string> = {
  scrum: 'Scrum Management',
  breakdown: 'Breakdown/Tackle Management',
  advantage: 'Advantage Application',
  gameControl: 'Game Control & Flow',
  communication: 'Communication & Player Management',
  materiality: 'Materiality',
  positioning: 'Positioning & Movement',
  lineout: 'Lineout/Touch/Maul Management',
  fitness: 'Level of Fitness',
  bigDecisions: 'Big Decisions',
};

export const CMO_COMPLEXITY_OPTIONS = [
  'Severe weather (wind, rain, etc...)',
  'scrums frequently unstable',
  'repeated foul play theme',
  'rivalry/high stakes',
  'short benches/injuries',
  'coach/crowd pressure',
  'travel squad/new players',
  'NO MAJOR FAVORS. GREAT DAY',
] as const;

export type CmoComplexityFactor = (typeof CMO_COMPLEXITY_OPTIONS)[number];

/** Last year’s Match Type (League / Friendly / Play-off / Championship). */
export const CMO_MATCH_KINDS = [
  'League Match',
  'Friendly',
  'Play-off',
  'Championship',
] as const;

export type CmoMatchKind = (typeof CMO_MATCH_KINDS)[number];

export const CMO_TEMPERATURE_CARD_LABELS: Partial<
  Record<FivePointValue, string>
> = {
  1: 'Friendly / low emotion',
  2: '',
  3: 'Competitive',
  4: '',
  5: 'Very hot, high stakes',
};

export const CMO_BALANCE_CARD_LABELS: Partial<Record<FivePointValue, string>> = {
  1: 'Heavy mismatch',
  2: '',
  3: 'Somewhat uneven',
  4: '',
  5: 'Very even',
};

export const CMO_CONFIDENCE_CARD_LABELS: Partial<
  Record<FivePointValue, string>
> = {
  1: 'Guess / low evidence',
  2: '',
  3: 'Moderate',
  4: '',
  5: 'Very confident',
};

export function cmoComplexityComplete(
  factors: readonly string[],
  other: string,
): boolean {
  return factors.length > 0 || other.trim().length > 0;
}

/** CMO assessed rating: 1 highest, 10 lowest. */
export const CMO_ASSESSED_RATING_MIN = 1;
export const CMO_ASSESSED_RATING_MAX = 10;

export function parseAssessedRating(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const level = trimmed.match(/^level\s+(\d{1,2})\b/i);
  const n = level ? Number(level[1]) : Number(trimmed);
  if (
    !Number.isInteger(n) ||
    n < CMO_ASSESSED_RATING_MIN ||
    n > CMO_ASSESSED_RATING_MAX
  ) {
    return undefined;
  }
  return n;
}

/** Google Form CMO scale: 1–5, or 0 / N/A. */
export function parseCmoFormScale(raw: unknown): FivePointChoice | null {
  if (raw === 0 || raw === '0') return SCALE_NA;
  return parseFivePointChoice(raw);
}

export interface ParsedLegacyTeams {
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
}

/** Parse "Home (12) vs Away (7)" style team lines from last year’s form. */
export function parseLegacyTeamsText(teamsText: string): ParsedLegacyTeams {
  const trimmed = teamsText.trim();
  const vs = trimmed.match(
    /^(.+?)(?:\s*\((\d+)\))?\s+vs\.?\s+(.+?)(?:\s*\((\d+)\))?$/i,
  );
  if (!vs) {
    return { homeTeamName: trimmed || 'Home', awayTeamName: 'Away' };
  }
  const homeScore = vs[2] != null ? Number(vs[2]) : undefined;
  const awayScore = vs[4] != null ? Number(vs[4]) : undefined;
  return {
    homeTeamName: vs[1].trim() || 'Home',
    awayTeamName: vs[3].trim() || 'Away',
    ...(homeScore != null && Number.isFinite(homeScore) ? { homeScore } : {}),
    ...(awayScore != null && Number.isFinite(awayScore) ? { awayScore } : {}),
  };
}

export function inferMatchGenderFromLevel(
  matchLevel: string | undefined,
): MatchGender {
  const t = (matchLevel ?? '').toLowerCase();
  if (/\b(women|woman|womens|girls?)\b/.test(t)) return 'women';
  return 'men';
}

export interface CmoReportPayload {
  scales: Partial<Record<CmoScaleKey, FivePointChoice>>;
  comments: Partial<Record<CmoScaleKey, string>>;
  /** What level the match felt like (may differ from the listed fixture level). */
  playedLike?: string;
  /** League / Friendly / Play-off / Championship (last year’s Match Type). */
  matchKind?: CmoMatchKind;
  /** Emotional/physical intensity 1–5 (not the MO’s performance). */
  gameTemperature?: number;
  /** How even the teams were 1–5 (score does not dictate balance). */
  contestBalance?: number;
  complexityFactors?: CmoComplexityFactor[];
  complexityOther?: string;
  penaltyCount?: string;
  attendedInPerson?: 'yes' | 'no';
  videoLink?: string;
  keep?: string;
  start?: string;
  stop?: string;
  overallComment?: string;
  /** CMO’s assessed rating of the Match Official (1 highest, 10 lowest). */
  assessedRating?: number;
  /** Confidence in the assessed grade, 1–5. */
  gradingConfidence?: number;
  gradingRationale?: string;
}

export function validateCmoScales(
  scales: Partial<Record<CmoScaleKey, FivePointChoice>>,
  keys: CmoScaleKey[],
): boolean {
  return keys.every((k) => {
    const v = scales[k];
    return v === SCALE_NA || isFivePointValue(v);
  });
}

/** Mean of 1–5 competency scores. N/A is skipped. Null when nothing rated. */
export function cmoScaleAverage(
  scales: Partial<Record<CmoScaleKey, FivePointChoice>> | undefined,
): number | null {
  if (!scales) return null;
  const values = CMO_SCALE_KEYS.map((k) => scales[k]).filter(
    (v): v is FivePointValue => isFivePointValue(v),
  );
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Stable Firestore doc id for a match report row. */
export function matchReportDocId(
  matchId: string,
  officialId: string,
  slot: ReportAssigneeSlot,
): string {
  return `${matchId}_${officialId}_${slot}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

/** MO user ids on a match (all MO blocks with a linked user). */
export function moOfficialIdsOnMatch(match: Match): string[] {
  return crewPeople(match.crew.mo)
    .map((a) => a.userId)
    .filter((id): id is string => Boolean(id));
}

/** First MO user id on a match — legacy helper for single-MO fixtures. */
export function moOfficialIdOnMatch(match: Match): string | undefined {
  return moOfficialIdsOnMatch(match)[0];
}

/**
 * Firestore doc id for a CMO coaching report.
 * Single-MO matches keep the legacy `matchId_cmoId_cmo` shape.
 */
export function cmoMatchReportDocId(
  matchId: string,
  cmoOfficialId: string,
  subjectOfficialId: string,
  multiMo: boolean,
): string {
  if (!multiMo) {
    return matchReportDocId(matchId, cmoOfficialId, 'cmo');
  }
  return `${matchId}_${cmoOfficialId}_${subjectOfficialId}_cmo`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

/** In-memory key for merging CMO report rows during sync. */
export function cmoReportStorageKey(
  matchId: string,
  cmoOfficialId: string,
  subjectOfficialId?: string,
): string {
  return subjectOfficialId
    ? `${matchId}:${cmoOfficialId}:cmo:${subjectOfficialId}`
    : `${matchId}:${cmoOfficialId}:cmo`;
}

export function cmoReportStorageKeyFromReport(report: MatchReport): string {
  if (report.slot !== 'cmo') {
    return `${report.matchId}:${report.officialId}:${report.slot}`;
  }
  return cmoReportStorageKey(
    report.matchId,
    report.officialId,
    report.subjectOfficialId,
  );
}

export function defaultMatchReportDocIdForAssignee(
  match: Match,
  assignee: {
    userId: string;
    slot: ReportAssigneeSlot;
    subjectOfficialId?: string;
  },
): string {
  if (assignee.slot === 'cmo' && assignee.subjectOfficialId) {
    return cmoMatchReportDocId(
      match.id,
      assignee.userId,
      assignee.subjectOfficialId,
      moOfficialIdsOnMatch(match).length > 1,
    );
  }
  return matchReportDocId(match.id, assignee.userId, assignee.slot);
}

/** Stable Firestore doc id for a card report (one per MO per match). */
export function cardReportDocId(matchId: string, officialId: string): string {
  return `${matchId}_${officialId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export const MATCH_REPORT_SOURCE_LEGACY_FORM = 'legacy_form' as const;
export type MatchReportSource = typeof MATCH_REPORT_SOURCE_LEGACY_FORM;

/** Placeholder officialId on legacy CMO imports when the CMO has no app account yet. */
export const LEGACY_UNLINKED_OFFICIAL_PREFIX = 'legacy_unlinked_';

/** Display-only fixture facts when the report is not tied to a live schedule match. */
export interface LegacyCmoFixture {
  teamsText: string;
  matchLevel?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  /** Form/roster name when subjectOfficialId is not linked yet. */
  subjectOfficialName?: string;
  subjectOfficialEmail?: string;
  /** Form/roster name when officialId is a legacy_unlinked_* placeholder. */
  cmoOfficialName?: string;
  cmoOfficialEmail?: string;
}

export interface MatchReport {
  id: string;
  matchId: string;
  officialId: string;
  slot: ReportAssigneeSlot;
  /** MO being assessed — set on CMO coaching reports for read rules. */
  subjectOfficialId?: string;
  /** Set when user chooses / is forced into a form; pending may omit until chooser. */
  formKind?: ReportFormKind;
  status: MatchReportStatus;
  dueAt: string;
  /** CMO soft deadline (kickoff + 48h). */
  deadlineAt?: string;
  kickoffAt: string;
  submittedAt?: string;
  moPayload?: MoReportPayload;
  arPayload?: ArReportPayload;
  cmoPayload?: CmoReportPayload;
  /** One-shot archive import — never treated as due work. */
  source?: MatchReportSource;
  legacyFixture?: LegacyCmoFixture;
}

export function parseLegacyCmoFixture(raw: unknown): LegacyCmoFixture | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const teamsText = typeof o.teamsText === 'string' ? o.teamsText : '';
  const homeTeamName =
    typeof o.homeTeamName === 'string' ? o.homeTeamName.trim() : '';
  const awayTeamName =
    typeof o.awayTeamName === 'string' ? o.awayTeamName.trim() : '';
  if (!teamsText && !homeTeamName) return undefined;
  const parsed = parseLegacyTeamsText(teamsText);
  const homeScore =
    typeof o.homeScore === 'number' && Number.isFinite(o.homeScore)
      ? o.homeScore
      : parsed.homeScore;
  const awayScore =
    typeof o.awayScore === 'number' && Number.isFinite(o.awayScore)
      ? o.awayScore
      : parsed.awayScore;
  const optStr = (key: string) => {
    const v = o[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  return {
    teamsText: teamsText || `${homeTeamName} vs ${awayTeamName}`.trim(),
    matchLevel: typeof o.matchLevel === 'string' ? o.matchLevel : undefined,
    homeTeamName: homeTeamName || parsed.homeTeamName,
    awayTeamName: awayTeamName || parsed.awayTeamName,
    ...(homeScore != null ? { homeScore } : {}),
    ...(awayScore != null ? { awayScore } : {}),
    ...(optStr('subjectOfficialName')
      ? { subjectOfficialName: optStr('subjectOfficialName') }
      : {}),
    ...(optStr('subjectOfficialEmail')
      ? { subjectOfficialEmail: optStr('subjectOfficialEmail') }
      : {}),
    ...(optStr('cmoOfficialName')
      ? { cmoOfficialName: optStr('cmoOfficialName') }
      : {}),
    ...(optStr('cmoOfficialEmail')
      ? { cmoOfficialEmail: optStr('cmoOfficialEmail') }
      : {}),
  };
}

/** Live match if present; otherwise a display-only row from archive fixture facts. */
export function displayMatchForCmoReport(
  report: MatchReport,
  matches: Match[],
): Match | undefined {
  const live = matches.find((m) => m.id === report.matchId);
  if (live) return live;
  if (report.source !== MATCH_REPORT_SOURCE_LEGACY_FORM && !report.legacyFixture) {
    return undefined;
  }
  const teams = report.legacyFixture ?? {
    teamsText: '',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
  };
  const moUserId =
    report.slot === 'mo' ? report.officialId : report.subjectOfficialId;
  return {
    id: report.matchId,
    sheetRowKey: report.matchId,
    status: 'locked_confirmed',
    kickoffAt: report.kickoffAt,
    venueName: '',
    venueAddress: '',
    homeTeamId: '',
    awayTeamId: '',
    homeTeamName: teams.homeTeamName,
    awayTeamName: teams.awayTeamName,
    competition: teams.matchLevel,
    level: teams.matchLevel?.trim() || 'Archive',
    gender: inferMatchGenderFromLevel(teams.matchLevel),
    matchType: '2025 archive',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: moUserId
        ? [
            {
              id: `${report.id}_mo`,
              slot: 'mo',
              userId: moUserId,
              status: 'confirmed',
              history: [],
            },
          ]
        : emptyCrew().mo,
    },
    ...(teams.homeScore != null ? { homeScore: teams.homeScore } : {}),
    ...(teams.awayScore != null ? { awayScore: teams.awayScore } : {}),
  };
}

/** @alias displayMatchForCmoReport */
export const displayMatchForArchivedReport = displayMatchForCmoReport;

/** Submitted CMO forms about this user as Match Official. */
export function submittedCmoReportsAboutOfficial(
  reports: MatchReport[],
  matches: Match[],
  userId: string,
): MatchReport[] {
  const moMatchIds = new Set(
    matches
      .filter((m) =>
        crewPeople(m.crew.mo).some((a) => a.userId === userId),
      )
      .map((m) => m.id),
  );
  return reports
    .filter(
      (r) =>
        r.slot === 'cmo' &&
        r.status === 'submitted' &&
        (r.subjectOfficialId === userId ||
          (!r.subjectOfficialId && moMatchIds.has(r.matchId))),
    )
    .sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    );
}

export interface CardReport {
  id: string;
  matchId: string;
  officialId: string;
  status: 'draft' | 'submitted';
  competitionUnion: CompetitionUnion | '';
  conference?: CardConference | '';
  officialName: string;
  officialEmail: string;
  officialPhone: string;
  matchDate: string;
  matchFilmed?: boolean;
  homeScore?: number;
  awayScore?: number;
  cards: CardIncident[];
  /**
   * Optional free-text for the Scheduler only — hidden from public / other lenses.
   */
  additionalInfoPrivate?: string;
  submittedAt?: string;
  createdAt: string;
}

export function reportDueAt(kickoffAt: string, _now = Date.now()): string {
  return new Date(new Date(kickoffAt).getTime() + REPORT_DUE_AFTER_MS).toISOString();
}

export function cmoDeadlineAt(kickoffAt: string): string {
  return new Date(
    new Date(kickoffAt).getTime() + CMO_DEADLINE_AFTER_MS,
  ).toISOString();
}

export function isReportWindowOpen(
  kickoffAt: string,
  now = Date.now(),
): boolean {
  return now >= new Date(kickoffAt).getTime() + REPORT_DUE_AFTER_MS;
}

export function kickoffHasPassed(kickoffAt: string, now = Date.now()): boolean {
  return now >= new Date(kickoffAt).getTime();
}

/** Who owes a post-match report — never No.4. */
export function reportAssignees(
  match: Match,
): { userId: string; slot: ReportAssigneeSlot }[] {
  const out: { userId: string; slot: ReportAssigneeSlot }[] = [];
  for (const slot of ['mo', 'ar1', 'ar2'] as const) {
    for (const a of crewPeople(match.crew[slot])) {
      if (a.userId) out.push({ userId: a.userId, slot });
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userId) out.push({ userId: c.userId, slot: 'cmo' });
  }
  return out;
}

/** True when a CMO is named on the match (roster). */
export function matchHasAssignedCmo(match: Match): boolean {
  return (match.cmo ?? []).some((c) => Boolean(c.userId));
}

/**
 * MO always sees a Quick vs Performance chooser.
 * When a CMO is assigned, Quick is locked unless the MO marks that the CMO did not attend.
 */
export function isQuickReportLocked(
  match: Match,
  cmoDidNotAttend: boolean,
): boolean {
  return matchHasAssignedCmo(match) && !cmoDidNotAttend;
}

/** @deprecated Prefer isQuickReportLocked — kept for call sites that mean “CMO on roster”. */
export function moFormMode(match: Match): 'chooser' | 'performance_only' {
  return matchHasAssignedCmo(match) ? 'performance_only' : 'chooser';
}

export function defaultFormKindForSlot(
  match: Match,
  slot: ReportAssigneeSlot,
): ReportFormKind {
  if (slot === 'cmo') return 'cmo';
  if (slot === 'ar1' || slot === 'ar2') return 'ar_basic';
  // MO chooses in UI; default hint when CMO assigned is Performance.
  return matchHasAssignedCmo(match) ? 'mo_performance' : 'mo_quick';
}

export function slotForUserOnMatch(
  match: Match,
  userId: string,
): ReportAssigneeSlot | null {
  const hit = assignmentForUser(match, userId);
  if (!hit) return null;
  if (hit.slot === 'no4') return null;
  return hit.slot;
}

export function buildPendingReport(
  match: Match,
  assignee: {
    userId: string;
    slot: ReportAssigneeSlot;
    subjectOfficialId?: string;
  },
  idFactory: () => string,
): MatchReport {
  const dueAt = reportDueAt(match.kickoffAt);
  const base: MatchReport = {
    id: idFactory(),
    matchId: match.id,
    officialId: assignee.userId,
    slot: assignee.slot,
    status: 'pending',
    dueAt,
    kickoffAt: match.kickoffAt,
  };
  if (assignee.slot === 'cmo') {
    return {
      ...base,
      formKind: 'cmo',
      deadlineAt: cmoDeadlineAt(match.kickoffAt),
      ...(assignee.subjectOfficialId
        ? { subjectOfficialId: assignee.subjectOfficialId }
        : {}),
    };
  }
  if (assignee.slot === 'ar1' || assignee.slot === 'ar2') {
    return { ...base, formKind: 'ar_basic' };
  }
  // MO: leave formKind unset until chooser (Quick vs Performance).
  return base;
}

/**
 * Ensure every due assignee has a pending/submitted report row.
 * Returns merged list (existing submissions kept; missing pendings added).
 */
export function syncPendingMatchReports(
  matches: Match[],
  existing: MatchReport[],
  now = Date.now(),
  idFactory: (
    match: Match,
    assignee: {
      userId: string;
      slot: ReportAssigneeSlot;
      subjectOfficialId?: string;
    },
  ) => string = defaultMatchReportDocIdForAssignee,
): MatchReport[] {
  const byKey = new Map<string, MatchReport>();
  for (const r of existing) {
    if (r.slot === 'cmo') {
      byKey.set(cmoReportStorageKeyFromReport(r), r);
    } else {
      byKey.set(`${r.matchId}:${r.officialId}:${r.slot}`, r);
    }
  }
  for (const match of matches) {
    if (!isReportWindowOpen(match.kickoffAt, now)) continue;
    if (match.status === 'cancelled' || match.status === 'draft') continue;

    const moIds = moOfficialIdsOnMatch(match);
    const multiMo = moIds.length > 1;

    for (const a of reportAssignees(match)) {
      if (a.slot !== 'cmo') {
        const key = `${match.id}:${a.userId}:${a.slot}`;
        if (!byKey.has(key)) {
          byKey.set(
            key,
            buildPendingReport(match, a, () => idFactory(match, a)),
          );
        }
        continue;
      }

      if (moIds.length === 0) {
        const key = cmoReportStorageKey(match.id, a.userId);
        if (!byKey.has(key)) {
          byKey.set(
            key,
            buildPendingReport(match, a, () => idFactory(match, a)),
          );
        }
        continue;
      }

      const legacyKey = cmoReportStorageKey(match.id, a.userId);
      const legacy = byKey.get(legacyKey);
      if (legacy && multiMo && !legacy.subjectOfficialId) {
        const firstSubject = moIds[0]!;
        byKey.delete(legacyKey);
        byKey.set(
          cmoReportStorageKey(match.id, a.userId, firstSubject),
          { ...legacy, subjectOfficialId: firstSubject },
        );
      }

      for (const subjectId of moIds) {
        const key = multiMo
          ? cmoReportStorageKey(match.id, a.userId, subjectId)
          : cmoReportStorageKey(match.id, a.userId);
        if (byKey.has(key)) {
          const cur = byKey.get(key)!;
          if (!cur.subjectOfficialId && moIds.length === 1) {
            byKey.set(key, { ...cur, subjectOfficialId: subjectId });
          }
          continue;
        }
        const assignee = { ...a, subjectOfficialId: subjectId };
        byKey.set(
          key,
          buildPendingReport(match, assignee, () => idFactory(match, assignee)),
        );
      }
    }
  }
  return [...byKey.values()];
}

/** CMO report row for one subject MO (pending or submitted). */
export function resolveCmoReportForUserOnMatch(
  reports: MatchReport[],
  match: Match,
  cmoUserId: string,
  subjectOfficialId?: string,
): MatchReport | undefined {
  const moIds = moOfficialIdsOnMatch(match);
  const subject =
    subjectOfficialId ?? (moIds.length === 1 ? moIds[0] : undefined);
  if (subject) {
    const keyed = reports.find(
      (r) =>
        r.matchId === match.id &&
        r.officialId === cmoUserId &&
        r.slot === 'cmo' &&
        r.subjectOfficialId === subject,
    );
    if (keyed) return keyed;
    if (moIds.length === 1) {
      return reports.find(
        (r) =>
          r.matchId === match.id &&
          r.officialId === cmoUserId &&
          r.slot === 'cmo' &&
          !r.subjectOfficialId,
      );
    }
    return undefined;
  }
  return reports.find(
    (r) =>
      r.matchId === match.id &&
      r.officialId === cmoUserId &&
      r.slot === 'cmo',
  );
}

export function submittedCmoReportsOnMatch(
  reports: MatchReport[],
  matchId: string,
  opts?: { cmoOfficialId?: string },
): MatchReport[] {
  return reports.filter(
    (r) =>
      r.matchId === matchId &&
      r.slot === 'cmo' &&
      r.status === 'submitted' &&
      (opts?.cmoOfficialId == null || r.officialId === opts.cmoOfficialId),
  );
}

export function pendingReportsForUser(
  reports: MatchReport[],
  userId: string,
  now = Date.now(),
): MatchReport[] {
  return reports.filter(
    (r) =>
      r.officialId === userId &&
      r.status === 'pending' &&
      now >= new Date(r.dueAt).getTime(),
  );
}

/** Pending rows for one official on one match (MO/AR and CMO can both exist). */
export function pendingReportsForOfficialOnMatch(
  reports: MatchReport[],
  matchId: string,
  userId: string,
): MatchReport[] {
  return reports.filter(
    (r) =>
      r.matchId === matchId &&
      r.officialId === userId &&
      r.status === 'pending',
  );
}

export function pendingReportForOfficial(
  reports: MatchReport[],
  matchId: string,
  userId: string,
  slot?: ReportAssigneeSlot,
): MatchReport | undefined {
  return pendingReportsForOfficialOnMatch(reports, matchId, userId).find(
    (r) => slot === undefined || r.slot === slot,
  );
}

/** MO / AR1 / AR2 pending — never the CMO form on the same match. */
export function pendingCrewReportForOfficial(
  reports: MatchReport[],
  matchId: string,
  userId: string,
): MatchReport | undefined {
  return pendingReportsForOfficialOnMatch(reports, matchId, userId).find(
    (r) => r.slot !== 'cmo',
  );
}

export function countMatchReportsDue(
  reports: MatchReport[],
  userId: string,
  now = Date.now(),
): number {
  return pendingReportsForUser(reports, userId, now).filter(
    (r) => r.slot !== 'cmo',
  ).length;
}

export function countCmoReportsDue(
  reports: MatchReport[],
  userId: string,
  now = Date.now(),
): number {
  return pendingReportsForUser(reports, userId, now).filter(
    (r) => r.slot === 'cmo',
  ).length;
}

/** MO past-kickoff matches with no submitted card report yet. */
export function countCardReportsDue(
  matches: Match[],
  cardReports: CardReport[],
  userId: string,
  now = Date.now(),
): number {
  return matches.filter((m) => {
    if (!crewPeople(m.crew.mo).some((a) => a.userId === userId)) return false;
    if (!kickoffHasPassed(m.kickoffAt, now)) return false;
    return !cardReports.some(
      (c) =>
        c.matchId === m.id &&
        c.officialId === userId &&
        c.status === 'submitted',
    );
  }).length;
}

export function totalCardsFromMoPayload(p: MoReportPayload | undefined): {
  yellow: number;
  red: number;
} {
  if (!p || p.tournamentMatch) return { yellow: 0, red: 0 };
  const yellow =
    p.homeYellowCards != null || p.awayYellowCards != null
      ? (p.homeYellowCards ?? 0) + (p.awayYellowCards ?? 0)
      : (p.yellowCards ?? 0);
  const red =
    p.homeRedCards != null || p.awayRedCards != null
      ? (p.homeRedCards ?? 0) + (p.awayRedCards ?? 0)
      : (p.redCards ?? 0);
  return { yellow, red };
}

export function needsCardReportNudge(
  matchReport: MatchReport | undefined,
  cardReports: CardReport[],
): boolean {
  if (!matchReport || matchReport.status !== 'submitted') return false;
  if (matchReport.slot !== 'mo') return false;
  const { yellow, red } = totalCardsFromMoPayload(matchReport.moPayload);
  if (yellow + red <= 0) return false;
  return !cardReports.some(
    (c) =>
      c.matchId === matchReport.matchId &&
      c.officialId === matchReport.officialId &&
      c.status === 'submitted',
  );
}

export function defaultCompetitionUnion(
  match: Match,
): CompetitionUnion | '' {
  const c = (match.competition ?? '').toLowerCase();
  if (
    c.includes('college') ||
    c.includes('ncr') ||
    c.includes('lone star') ||
    c.includes('lonestar')
  ) {
    return 'ncr_lonestar_college';
  }
  if (c.includes('youth') || c.includes('hs')) return 'rugby_texas_youth';
  if (c.includes('club') || c.includes('d1') || c.includes('d2')) {
    return 'texas_rugby_union_club';
  }
  return 'ncr_lonestar_college';
}

export function defaultCardConference(match: Match): CardConference | '' {
  if (match.gender === 'women') return 'lonestar_women';
  if (match.gender === 'men') return 'lonestar_men';
  const c = (match.competition ?? '').toLowerCase();
  if (c.includes('women')) return 'lonestar_women';
  if (c.includes('men')) return 'lonestar_men';
  return '';
}

export function displayPlayerName(card: CardIncident): string {
  const first = card.playerFirstName?.trim() ?? '';
  const last = card.playerLastName?.trim() ?? '';
  const joined = `${first} ${last}`.trim();
  if (joined) return joined;
  const legacy = card.playerName.trim();
  if (legacy) return legacy;
  const jersey = card.playerJersey?.trim();
  if (jersey) return `#${jersey}`;
  return '';
}

export function validateCardReportIdentity(input: {
  officialName: string;
  officialEmail: string;
  officialPhone: string;
  competitionUnion: CompetitionUnion | '';
  conference: CardConference | '';
  matchDate: string;
}): string | null {
  if (
    !input.officialName.trim() ||
    !input.officialEmail.trim() ||
    !input.officialPhone.trim()
  ) {
    return 'Name, email, and phone are required.';
  }
  if (!input.competitionUnion) return 'Select a competition union.';
  if (input.competitionUnion === 'ncr_lonestar_college' && !input.conference) {
    return 'Select Lonestar Men or Lonestar Women.';
  }
  if (!input.matchDate) return 'Match date is required.';
  return null;
}

export function isCompleteCardIncident(card: CardIncident): boolean {
  const name = displayPlayerName(card);
  const jersey = card.playerJersey?.trim();
  const summary = (card.offenseSummary ?? card.reason).trim();
  const laws = card.lawIds ?? [];
  return Boolean(
    card.teamId &&
      card.color &&
      summary &&
      laws.length > 0 &&
      (name || jersey),
  );
}

export function validateCardReportIncidents(
  cards: CardIncident[],
  matchFilmed: boolean | null,
): string | null {
  if (matchFilmed == null) {
    return 'Indicate whether the match was filmed.';
  }
  const valid = cards.filter(isCompleteCardIncident);
  if (valid.length === 0) {
    return 'Add at least one card with team, law(s), summary, and a player name or jersey number.';
  }
  for (const c of valid) {
    if (c.receivedAnotherCard) {
      const second = c.secondOffense;
      if (!second?.summary.trim() || (second.lawIds?.length ?? 0) === 0) {
        return 'Second offense needs a summary and at least one law.';
      }
    }
  }
  return null;
}

/** Shape written on submit — drops incomplete cards and unused second-offense blocks. */
export function cardIncidentsForSubmit(cards: CardIncident[]): CardIncident[] {
  return cards.filter(isCompleteCardIncident).map((c) => ({
    ...c,
    playerFirstName: c.playerFirstName?.trim() || undefined,
    playerLastName: c.playerLastName?.trim() || undefined,
    playerName: displayPlayerName(c),
    playerJersey: c.playerJersey?.trim() || undefined,
    offenseSummary: c.offenseSummary?.trim() || undefined,
    reason: (c.offenseSummary ?? c.reason).trim(),
    minute: c.minute?.trim() || undefined,
    additionalInfoPrivate: c.additionalInfoPrivate?.trim() || undefined,
    secondOffense: c.receivedAnotherCard ? c.secondOffense : undefined,
  }));
}

export function crewNamesForMatch(match: Match): string {
  const names: string[] = [];
  for (const slot of CREW_SLOTS) {
    for (const a of crewPeople(match.crew[slot])) {
      if (a.userName) names.push(`${slot.toUpperCase()}: ${a.userName}`);
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userName) names.push(`CMO: ${c.userName}`);
  }
  return names.join(' · ');
}

export function prefillOfficialContact(user: UserProfile): {
  officialName: string;
  officialEmail: string;
  officialPhone: string;
} {
  return {
    officialName: user.displayName,
    officialEmail: user.email,
    officialPhone: user.phone,
  };
}

/** User's crew slot on match if they are fee crew (includes no4 for other UI). */
export function feeCrewSlotForUser(
  match: Match,
  userId: string,
): CrewSlot | null {
  const hit = assignmentForUser(match, userId);
  if (!hit || hit.slot === 'cmo') return null;
  return hit.slot;
}
