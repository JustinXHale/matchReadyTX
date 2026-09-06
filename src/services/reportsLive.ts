import {
  buildResetMatchReport,
  type ArReportPayload,
  type CardReport,
  type CmoReportPayload,
  type MatchReport,
  type MoReportPayload,
  type ReportAssigneeSlot,
  type ReportFormKind,
} from '@/domain/reports';
import type { Match } from '@/domain/types';
import { demoStore } from '@/services/demoStore';
import {
  defaultOrgId,
  deleteMatchReportInFirestore,
  ensurePendingMatchReportInFirestore,
  deleteCardReportInFirestore,
  saveCardReportInFirestore,
  saveJudicialCasesInFirestore,
  saveMatchReportInFirestore,
} from '@/services/orgData';
import { casesFromCardReport } from '@/domain/judicial';

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
  const match = demoStore.getState().matches.find((m) => m.id === before.matchId);
  if (!match) throw new Error('Match not found.');

  const fsRow =
    before.status === 'submitted'
      ? before
      : await ensurePendingMatchReportInFirestore(defaultOrgId(), match, {
          userId: before.officialId,
          slot: before.slot as ReportAssigneeSlot,
        });

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
  const match = demoStore.getState().matches.find((m) => m.id === before.matchId);
  if (!match) throw new Error('Match not found.');

  const fsRow = await ensurePendingMatchReportInFirestore(defaultOrgId(), match, {
    userId: before.officialId,
    slot: 'cmo',
    subjectOfficialId,
  });

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

export async function persistSubmittedCardReport(
  input: Omit<CardReport, 'id' | 'status' | 'submittedAt' | 'createdAt'> & {
    id?: string;
  },
): Promise<void> {
  const report = demoStore.submitCardReport(input);
  demoStore.upsertCardReportLocal(report);
  await saveCardReportInFirestore(defaultOrgId(), report);
  const cases = casesFromCardReport(report);
  if (cases.length > 0) {
    await saveJudicialCasesInFirestore(defaultOrgId(), cases);
  }
}
