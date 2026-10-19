import {
  buildResetMatchReport,
  cardReportDocId,
  MATCH_REPORT_SOURCE_OUTSIDE,
  type ArReportPayload,
  type CardReport,
  type CmoReportPayload,
  type MatchReport,
  type MoReportPayload,
  type ReportAssigneeSlot,
  type ReportFormKind,
} from '@/domain/reports';
import type { OutsideCoachingSession } from '@/domain/outsideCoaching';
import type { Match } from '@/domain/types';
import { demoStore } from '@/services/demoStore';
import {
  createOrJoinOutsideSessionInFirestore,
  defaultOrgId,
  deleteMatchReportInFirestore,
  ensureOutsideCmoInFirestore,
  ensureOutsidePerformanceInFirestore,
  ensurePendingMatchReportInFirestore,
  deleteCardReportInFirestore,
  loadJudicialCasesForReport,
  saveCardReportInFirestore,
  saveCardReportWithCasesInFirestore,
  saveMatchReportInFirestore,
} from '@/services/orgData';
import {
  casesFromCardReport,
  mergeJudicialCasesFromCardReport,
} from '@/domain/judicial';

export async function ensureMatchReportReady(
  matchId: string,
  userId: string,
): Promise<void> {
  const s = demoStore.getState();
  const match = s.matches.find((m) => m.id === matchId);
  if (!match) return;
  const { slotForUserOnMatch } = await import('@/domain/reports');
  const slot = slotForUserOnMatch(match, userId);
  if (!slot || slot === 'cmo') return;
  await ensureMatchReportReadyForAssignee(matchId, userId, slot);
}

export async function ensureMatchReportReadyForAssignee(
  matchId: string,
  userId: string,
  slot: ReportAssigneeSlot,
): Promise<void> {
  if (slot === 'cmo') return;
  const s = demoStore.getState();
  const match = s.matches.find((m) => m.id === matchId);
  if (!match) return;
  const report = await ensurePendingMatchReportInFirestore(defaultOrgId(), match, {
    userId,
    slot,
  });
  demoStore.upsertMatchReportLocal(report);
}

export async function ensureCmoReportReady(
  matchId: string,
  cmoUserId: string,
  subjectOfficialId: string,
): Promise<void> {
  const s = demoStore.getState();
  const match = s.matches.find((m) => m.id === matchId);
  if (!match) return;
  const report = await ensurePendingMatchReportInFirestore(
    defaultOrgId(),
    match,
    { userId: cmoUserId, slot: 'cmo', subjectOfficialId },
  );
  demoStore.upsertMatchReportLocal(report);
}

export async function persistSubmittedMatchReport(
  reportId: string,
  formKind: ReportFormKind,
  payload: MoReportPayload | ArReportPayload,
): Promise<void> {
  const before = demoStore.getState().matchReports.find((r) => r.id === reportId);
  if (!before || before.slot === 'cmo') {
    throw new Error('Match report not found.');
  }
  const isOutside = before.source === MATCH_REPORT_SOURCE_OUTSIDE;
  const match = demoStore.getState().matches.find((m) => m.id === before.matchId);
  if (!match && !isOutside) throw new Error('Match not found.');

  let fsRow = before;
  if (before.status !== 'submitted') {
    if (isOutside && before.outsideSessionId) {
      const session = demoStore
        .getState()
        .outsideCoachingSessions.find((s) => s.id === before.outsideSessionId);
      if (!session) throw new Error('Outside coaching session not found.');
      fsRow = await ensureOutsidePerformanceInFirestore(
        defaultOrgId(),
        session,
        before.officialId,
      );
    } else if (match) {
      fsRow = await ensurePendingMatchReportInFirestore(defaultOrgId(), match, {
        userId: before.officialId,
        slot: before.slot as ReportAssigneeSlot,
      });
    }
  }

  demoStore.submitMatchReport(before.id, formKind, payload);
  const submittedAt =
    before.submittedAt ?? fsRow.submittedAt ?? new Date().toISOString();
  const updated = {
    ...before,
    ...fsRow,
    id: fsRow.id,
    formKind,
    status: 'submitted' as const,
    submittedAt,
    ...(formKind === 'ar_basic'
      ? { arPayload: payload as ArReportPayload }
      : { moPayload: payload as MoReportPayload }),
  };
  demoStore.upsertMatchReportLocal(updated);
  await saveMatchReportInFirestore(defaultOrgId(), updated);
}

export async function persistSubmittedCmoReport(
  reportId: string,
  payload: CmoReportPayload,
  subjectOfficialId: string,
): Promise<void> {
  const before = demoStore.getState().matchReports.find((r) => r.id === reportId);
  if (!before || before.slot !== 'cmo') {
    throw new Error('Coaching report not found.');
  }
  const isOutside = before.source === MATCH_REPORT_SOURCE_OUTSIDE;
  const match = demoStore.getState().matches.find((m) => m.id === before.matchId);
  if (!match && !isOutside) throw new Error('Match not found.');

  let fsRow = before;
  if (isOutside && before.outsideSessionId) {
    const session = demoStore
      .getState()
      .outsideCoachingSessions.find((s) => s.id === before.outsideSessionId);
    if (!session) throw new Error('Outside coaching session not found.');
    fsRow = await ensureOutsideCmoInFirestore(
      defaultOrgId(),
      session,
      before.officialId,
    );
  } else if (match) {
    fsRow = await ensurePendingMatchReportInFirestore(defaultOrgId(), match, {
      userId: before.officialId,
      slot: 'cmo',
      subjectOfficialId,
    });
  }

  demoStore.submitCmoReport(before.id, payload, subjectOfficialId);
  const submittedAt = new Date().toISOString();
  const updated = {
    ...before,
    ...fsRow,
    id: fsRow.id,
    formKind: 'cmo' as const,
    status: 'submitted' as const,
    submittedAt: fsRow.submittedAt ?? submittedAt,
    subjectOfficialId,
    cmoPayload: payload,
  };
  demoStore.upsertMatchReportLocal(updated);
  await saveMatchReportInFirestore(defaultOrgId(), updated);
}

export async function createOrJoinOutsideSessionLive(input: {
  starterUid: string;
  refereeId: string;
  coachId: string;
  matchDate: string;
  homeTeamName: string;
  awayTeamName: string;
  division?: string;
}): Promise<OutsideCoachingSession> {
  const s = demoStore.getState();
  const session = await createOrJoinOutsideSessionInFirestore(
    defaultOrgId(),
    input,
    s.outsideCoachingSessions,
    s.matchReports,
  );
  demoStore.upsertOutsideSessionLocal(session);
  return session;
}

export function createOrJoinOutsideSessionDemo(input: {
  starterUid: string;
  refereeId: string;
  coachId: string;
  matchDate: string;
  homeTeamName: string;
  awayTeamName: string;
  division?: string;
}): OutsideCoachingSession {
  return demoStore.createOrJoinOutsideSession(input);
}

export async function ensureOutsidePerformanceReady(
  sessionId: string,
  uid: string,
): Promise<void> {
  const session = demoStore
    .getState()
    .outsideCoachingSessions.find((s) => s.id === sessionId);
  if (!session) return;
  const report = await ensureOutsidePerformanceInFirestore(
    defaultOrgId(),
    session,
    uid,
  );
  demoStore.upsertMatchReportLocal(report);
}

export function ensureOutsidePerformanceReadyDemo(
  sessionId: string,
  uid: string,
): void {
  const report = demoStore.ensureOutsidePerformanceLocal(sessionId, uid);
  if (report) demoStore.upsertMatchReportLocal(report);
}

export async function ensureOutsideCmoReady(
  sessionId: string,
  uid: string,
): Promise<void> {
  const session = demoStore
    .getState()
    .outsideCoachingSessions.find((s) => s.id === sessionId);
  if (!session) return;
  const report = await ensureOutsideCmoInFirestore(
    defaultOrgId(),
    session,
    uid,
  );
  demoStore.upsertMatchReportLocal(report);
}

export function ensureOutsideCmoReadyDemo(
  sessionId: string,
  uid: string,
): void {
  const report = demoStore.ensureOutsideCmoLocal(sessionId, uid);
  if (report) demoStore.upsertMatchReportLocal(report);
}

export async function persistSchedulerDeleteMatchReport(
  reportId: string,
): Promise<void> {
  demoStore.removeMatchReportLocal(reportId);
  await deleteMatchReportInFirestore(defaultOrgId(), reportId);
}

export async function persistSchedulerDeleteCardReport(
  reportId: string,
): Promise<void> {
  demoStore.removeCardReportLocal(reportId);
  await deleteCardReportInFirestore(defaultOrgId(), reportId);
}

export async function persistSchedulerResetMatchReport(
  report: MatchReport,
  match: Match,
): Promise<void> {
  const reset = buildResetMatchReport(report, match);
  demoStore.resetMatchReportLocal(reset);
  await saveMatchReportInFirestore(defaultOrgId(), reset);
}

type CardReportPersistInput = Omit<
  CardReport,
  'id' | 'status' | 'submittedAt' | 'createdAt' | 'editUnlockedAt' | 'editUnlockedByUid' | 'editUnlockedByName'
> & {
  id?: string;
  createdAt?: string;
  submittedAt?: string;
};

/** Persist a draft card report (no judicial cases). */
export async function persistDraftCardReport(
  input: CardReportPersistInput,
): Promise<CardReport> {
  const now = new Date().toISOString();
  const existing = demoStore
    .getState()
    .cardReports.find(
      (c) =>
        c.id ===
          (input.id ?? cardReportDocId(input.matchId, input.officialId)) ||
        (c.matchId === input.matchId && c.officialId === input.officialId),
    );
  const report: CardReport = {
    ...input,
    id: input.id ?? cardReportDocId(input.matchId, input.officialId),
    status: existing?.status === 'submitted' ? 'submitted' : 'draft',
    submittedAt: existing?.submittedAt,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    // Keep unlock while editing a submitted report as draft-save.
    editUnlockedAt: existing?.editUnlockedAt,
    editUnlockedByUid: existing?.editUnlockedByUid,
    editUnlockedByName: existing?.editUnlockedByName,
  };
  await saveCardReportInFirestore(defaultOrgId(), report);
  demoStore.upsertCardReportLocal(report);
  return report;
}

export async function persistSubmittedCardReport(
  input: CardReportPersistInput,
): Promise<void> {
  const now = new Date().toISOString();
  const id = input.id ?? cardReportDocId(input.matchId, input.officialId);
  const existingLocal = demoStore
    .getState()
    .cardReports.find((c) => c.id === id);
  const report: CardReport = {
    ...input,
    id,
    status: 'submitted',
    submittedAt: existingLocal?.submittedAt ?? input.submittedAt ?? now,
    createdAt: existingLocal?.createdAt ?? input.createdAt ?? now,
    // Clear unlock on submit.
    editUnlockedAt: undefined,
    editUnlockedByUid: undefined,
    editUnlockedByName: undefined,
  };
  const orgId = defaultOrgId();
  let existingCases = demoStore
    .getState()
    .judicialCases.filter((c) => c.reportId === report.id);
  try {
    const fromFs = await loadJudicialCasesForReport(orgId, report.id);
    if (fromFs.length) existingCases = fromFs;
  } catch {
    // Demo / offline: fall back to local cases.
  }
  const merged =
    existingCases.length > 0
      ? mergeJudicialCasesFromCardReport(report, existingCases, now)
      : casesFromCardReport(report, now);
  await saveCardReportWithCasesInFirestore(orgId, report, merged);
  demoStore.upsertCardReportLocal(report);
  demoStore.applyLiveJudicialCases([
    ...demoStore.getState().judicialCases.filter((c) => c.reportId !== report.id),
    ...merged,
  ]);
}
