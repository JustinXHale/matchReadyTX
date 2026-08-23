import {
  CREW_SLOTS,
  assignmentForUser,
  crewPeople,
  type CrewSlot,
  type Match,
  type UserProfile,
} from '@/domain/types';
import {
  isFivePointValue,
  SCALE_NA,
  type FivePointChoice,
} from '@/domain/fivePointScale';

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
  ncr_lonestar_college: 'NCR Lonestar College Rugby (Men’s/Women’s)',
  texas_rugby_union_club:
    'Texas Rugby Union Club Rugby (Men’s/Women’s D1–D4, Senior)',
};

export type CardColor = 'yellow' | 'red';

export interface CardIncident {
  id: string;
  color: CardColor;
  playerName: string;
  teamId: string;
  teamName: string;
  minute?: string;
  reason: string;
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
}

export type CmoScaleKey =
  | 'scrum'
  | 'breakdown'
  | 'gameControl'
  | 'communication'
  | 'positioning'
  | 'lineout'
  | 'bigDecisions';

export const CMO_SCALE_LABELS: Record<CmoScaleKey, string> = {
  scrum: 'Scrum Management',
  breakdown: 'Breakdown/Tackle Management',
  gameControl: 'Game Control & Flow',
  communication: 'Communication & Player Management',
  positioning: 'Positioning & Movement',
  lineout: 'Lineout/Touch/Maul Management',
  bigDecisions: 'Big Decisions',
};

/** CMO assessed rating: 1 highest, 10 lowest. */
export const CMO_ASSESSED_RATING_MIN = 1;
export const CMO_ASSESSED_RATING_MAX = 10;

export function parseAssessedRating(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (
    !Number.isInteger(n) ||
    n < CMO_ASSESSED_RATING_MIN ||
    n > CMO_ASSESSED_RATING_MAX
  ) {
    return undefined;
  }
  return n;
}

export interface CmoReportPayload {
  scales: Partial<Record<CmoScaleKey, FivePointChoice>>;
  comments: Partial<Record<CmoScaleKey, string>>;
  overallComment?: string;
  /** CMO’s assessed rating of the Match Official (1 highest, 10 lowest). */
  assessedRating?: number;
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

/** Stable Firestore doc id for a card report (one per MO per match). */
export function cardReportDocId(matchId: string, officialId: string): string {
  return `${matchId}_${officialId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
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
}

export interface CardReport {
  id: string;
  matchId: string;
  officialId: string;
  status: 'draft' | 'submitted';
  competitionUnion: CompetitionUnion | '';
  officialName: string;
  officialEmail: string;
  officialPhone: string;
  matchDate: string;
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
  assignee: { userId: string; slot: ReportAssigneeSlot },
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
    assignee: { userId: string; slot: ReportAssigneeSlot },
  ) => string = (match, assignee) =>
    matchReportDocId(match.id, assignee.userId, assignee.slot),
): MatchReport[] {
  const byKey = new Map<string, MatchReport>();
  for (const r of existing) {
    byKey.set(`${r.matchId}:${r.officialId}:${r.slot}`, r);
  }
  for (const match of matches) {
    if (!isReportWindowOpen(match.kickoffAt, now)) continue;
    if (match.status === 'cancelled' || match.status === 'draft') continue;
    for (const a of reportAssignees(match)) {
      const key = `${match.id}:${a.userId}:${a.slot}`;
      if (!byKey.has(key)) {
        byKey.set(
          key,
          buildPendingReport(match, a, () => idFactory(match, a)),
        );
      }
    }
  }
  return [...byKey.values()];
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
  if (!p) return { yellow: 0, red: 0 };
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
  if (c.includes('college') || c.includes('ncr')) return 'ncr_lonestar_college';
  if (c.includes('youth') || c.includes('hs')) return 'rugby_texas_youth';
  if (c.includes('club') || c.includes('d1') || c.includes('d2')) {
    return 'texas_rugby_union_club';
  }
  return 'texas_rugby_union_club';
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
