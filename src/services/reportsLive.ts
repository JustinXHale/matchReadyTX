import type {
  ArReportPayload,
  CardReport,
  CmoReportPayload,
  MoReportPayload,
  ReportFormKind,
} from '@/domain/reports';
import { resolveCmoReportForUserOnMatch } from '@/domain/reports';
import { demoStore } from '@/services/demoStore';
import {
  defaultOrgId,
  ensurePendingMatchReportInFirestore,
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
  const existing = s.matchReports.find(
    (r) => r.matchId === matchId && r.officialId === userId,
  );
  if (existing) return;
  const { slotForUserOnMatch } = await import('@/domain/reports');
  const slot = slotForUserOnMatch(match, userId);
  if (!slot) return;
  const report = await ensurePendingMatchReportInFirestore(
    defaultOrgId(),
    match,
    { userId, slot },
  );
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
  const existing = resolveCmoReportForUserOnMatch(
    s.matchReports,
    match,
    cmoUserId,
    subjectOfficialId,
  );
  if (existing) return;
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
  demoStore.submitMatchReport(reportId, formKind, payload);
  const updated = demoStore
    .getState()
    .matchReports.find((r) => r.id === reportId);
  if (!updated) return;
  await saveMatchReportInFirestore(defaultOrgId(), updated);
}

export async function persistSubmittedCmoReport(
  reportId: string,
  payload: CmoReportPayload,
  subjectOfficialId: string,
): Promise<void> {
  demoStore.submitCmoReport(reportId, payload, subjectOfficialId);
  const updated = demoStore
    .getState()
    .matchReports.find((r) => r.id === reportId);
  if (!updated) return;
  await saveMatchReportInFirestore(defaultOrgId(), updated);
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
