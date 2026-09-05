import { matchEconomicsForUser } from '@/domain/economics';
import {
  moOfficialIdsOnMatch,
  needsCardReportNudge,
  syncPendingMatchReports,
  type CardReport,
  type MatchReport,
} from '@/domain/reports';
import type {
  Match,
  OfficialPayment,
  OrgSettings,
  RequestableSlot,
  UserProfile,
} from '@/domain/types';
import {
  crewPeople,
  officialPaymentDocId,
  REQUESTABLE_SLOT_LABELS,
} from '@/domain/types';

export type PaymentReadinessStatus =
  | 'not_played'
  | 'reports_pending'
  | 'ready_to_pay'
  | 'paid';

export interface AssignmentPayableRow {
  id: string;
  matchId: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  level: string;
  competition?: string;
  officialId: string;
  officialName: string;
  slot: RequestableSlot;
  payoutFee: number;
  mileagePay: number;
  matchReportSubmitted: boolean;
  cardReportSubmitted: boolean;
  cardReportRequired: boolean;
  readiness: PaymentReadinessStatus;
  payment?: OfficialPayment;
  defaultPaymentContact: string;
  /** Official home city + region — used for mileage context. */
  officialHomeCity: string;
}

function isPastKickoff(kickoffAt: string, now: number): boolean {
  return now >= new Date(kickoffAt).getTime();
}

function formatOfficialHomeCity(user: UserProfile | undefined): string {
  if (!user) return '';
  const city = user.homeCity?.trim();
  const region = user.homeRegion?.trim();
  if (city && region) return `${city}, ${region}`;
  return city || region || '';
}

function findMatchReport(
  reports: MatchReport[],
  matchId: string,
  officialId: string,
  slot: RequestableSlot,
  subjectOfficialId?: string,
): MatchReport | undefined {
  return reports.find((r) => {
    if (r.matchId !== matchId || r.officialId !== officialId || r.slot !== slot) {
      return false;
    }
    if (slot === 'cmo' && subjectOfficialId) {
      return r.subjectOfficialId === subjectOfficialId;
    }
    return true;
  });
}

function cmoReportsComplete(
  match: Match,
  cmoUserId: string,
  reports: MatchReport[],
): boolean {
  const moIds = moOfficialIdsOnMatch(match);
  if (moIds.length === 0) {
    const r = findMatchReport(reports, match.id, cmoUserId, 'cmo');
    return r?.status === 'submitted';
  }
  return moIds.every((moId) => {
    const r = findMatchReport(reports, match.id, cmoUserId, 'cmo', moId);
    return r?.status === 'submitted';
  });
}

function reportsCompleteForSlot(
  match: Match,
  officialId: string,
  slot: RequestableSlot,
  reports: MatchReport[],
  cardReports: CardReport[],
): { complete: boolean; cardRequired: boolean; cardSubmitted: boolean } {
  if (slot === 'cmo') {
    return {
      complete: cmoReportsComplete(match, officialId, reports),
      cardRequired: false,
      cardSubmitted: true,
    };
  }

  const matchReport = findMatchReport(reports, match.id, officialId, slot);
  const matchSubmitted = matchReport?.status === 'submitted';
  if (slot !== 'mo') {
    return {
      complete: matchSubmitted,
      cardRequired: false,
      cardSubmitted: true,
    };
  }

  const cardRequired = needsCardReportNudge(matchReport, cardReports);
  const cardSubmitted = cardRequired
    ? cardReports.some(
        (c) =>
          c.matchId === match.id &&
          c.officialId === officialId &&
          c.status === 'submitted',
      )
    : true;

  return {
    complete: matchSubmitted && cardSubmitted,
    cardRequired,
    cardSubmitted,
  };
}

function collectAssignments(match: Match): {
  userId: string;
  userName: string;
  slot: RequestableSlot;
}[] {
  const out: { userId: string; userName: string; slot: RequestableSlot }[] = [];
  for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as const) {
    for (const a of crewPeople(match.crew[slot])) {
      if (a.userId) {
        out.push({
          userId: a.userId,
          userName: a.userName ?? 'Official',
          slot,
        });
      }
    }
  }
  for (const c of match.cmo ?? []) {
    if (c.userId) {
      out.push({
        userId: c.userId,
        userName: c.userName ?? 'CMO',
        slot: 'cmo',
      });
    }
  }
  return out;
}

export function buildAssignmentPayableRows(
  matches: Match[],
  users: UserProfile[],
  matchReports: MatchReport[],
  cardReports: CardReport[],
  payments: OfficialPayment[],
  org: OrgSettings,
  opts?: {
    periodStart?: string;
    periodEnd?: string;
    now?: number;
  },
): AssignmentPayableRow[] {
  const now = opts?.now ?? Date.now();
  const startMs = opts?.periodStart
    ? new Date(opts.periodStart).getTime()
    : null;
  const endMs = opts?.periodEnd
    ? new Date(opts.periodEnd).getTime() + 86_400_000 - 1
    : null;

  const syncedReports = syncPendingMatchReports(matches, matchReports, now);
  const userById = new Map(users.map((u) => [u.uid, u]));
  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const rows: AssignmentPayableRow[] = [];

  for (const match of matches) {
    if (match.status === 'cancelled' || match.status === 'draft') continue;

    const kickoffMs = new Date(match.kickoffAt).getTime();
    if (startMs != null && kickoffMs < startMs) continue;
    if (endMs != null && kickoffMs > endMs) continue;

    for (const a of collectAssignments(match)) {
      const user = userById.get(a.userId);
      const slot = a.slot;
      const economics = user
        ? matchEconomicsForUser(
            match,
            org,
            user,
            slot === 'cmo' ? 'cmo' : slot,
          )
        : { fee: 0, mileagePay: 0 };

      const id = officialPaymentDocId(match.id, a.userId, slot);
      const payment = paymentById.get(id);
      const reportStatus = reportsCompleteForSlot(
        match,
        a.userId,
        slot,
        syncedReports,
        cardReports,
      );

      let readiness: PaymentReadinessStatus;
      if (payment?.status === 'paid') {
        readiness = 'paid';
      } else if (!isPastKickoff(match.kickoffAt, now)) {
        readiness = 'not_played';
      } else if (reportStatus.complete) {
        readiness = 'ready_to_pay';
      } else {
        readiness = 'reports_pending';
      }

      const matchReport = findMatchReport(
        syncedReports,
        match.id,
        a.userId,
        slot,
      );

      rows.push({
        id,
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        level: match.level,
        competition: match.competition,
        officialId: a.userId,
        officialName: user?.displayName ?? a.userName,
        slot,
        payoutFee: economics.fee,
        mileagePay: economics.mileagePay,
        matchReportSubmitted: matchReport?.status === 'submitted',
        cardReportSubmitted: reportStatus.cardSubmitted,
        cardReportRequired: reportStatus.cardRequired,
        readiness,
        payment,
        defaultPaymentContact: user?.email?.trim() || user?.phone?.trim() || '',
        officialHomeCity: formatOfficialHomeCity(user),
      });
    }
  }

  return rows.sort(
    (a, b) =>
      new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime() ||
      a.officialName.localeCompare(b.officialName),
  );
}

export function formatPayableMatchLabel(row: AssignmentPayableRow): string {
  return `${row.homeTeamName} v ${row.awayTeamName} — ${row.level}`;
}

export function readinessLabel(status: PaymentReadinessStatus): string {
  const map: Record<PaymentReadinessStatus, string> = {
    not_played: 'Not played',
    reports_pending: 'Reports pending',
    ready_to_pay: 'Ready to pay',
    paid: 'Paid',
  };
  return map[status];
}

export function slotLabel(slot: RequestableSlot): string {
  return REQUESTABLE_SLOT_LABELS[slot];
}
