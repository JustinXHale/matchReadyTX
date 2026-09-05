import {
  defaultInvoiceFees,
  invoiceFeeForSlot,
  matchEconomicsForUser,
} from '@/domain/economics';
import type {
  ConferenceInvoice,
  ConferenceInvoiceLine,
  FeeTable,
  Match,
  OrgSettings,
  RequestableSlot,
  UserProfile,
} from '@/domain/types';
import {
  crewPeople,
  REQUESTABLE_SLOT_LABELS,
  rolesNeededForMatch,
} from '@/domain/types';

function roleBlockCount(match: Match, slot: RequestableSlot): number {
  if (slot === 'cmo') {
    const n = (match.cmo ?? []).filter((c) => c.userId).length;
    return n > 0 ? n : (match.cmo ?? []).length || 1;
  }
  const n = crewPeople(match.crew[slot]).filter((a) => a.userId).length;
  return n > 0 ? n : crewPeople(match.crew[slot]).length || 1;
}

function positionLabel(slot: RequestableSlot, count: number): string {
  const name = REQUESTABLE_SLOT_LABELS[slot];
  if (slot === 'ar1' || slot === 'ar2') {
    return count > 1 ? `(${count}) Assistants` : `(1) Assistant`;
  }
  return count > 1 ? `(${count}) ${name}s` : `(1) ${name}`;
}

function matchInvoiceLabel(match: Match): string {
  const teams = `${match.homeTeamName} v ${match.awayTeamName}`;
  return `${teams} — ${match.level}`;
}

function sumMileageForSlot(
  match: Match,
  org: OrgSettings,
  users: UserProfile[],
  slot: RequestableSlot,
): number {
  let total = 0;
  if (slot === 'cmo') {
    for (const c of match.cmo ?? []) {
      if (!c.userId) continue;
      const user = users.find((u) => u.uid === c.userId);
      if (!user) continue;
      total += matchEconomicsForUser(match, org, user, 'cmo').mileagePay;
    }
    return Math.round(total * 100) / 100;
  }
  for (const a of crewPeople(match.crew[slot])) {
    if (!a.userId) continue;
    const user = users.find((u) => u.uid === a.userId);
    if (!user) continue;
    total += matchEconomicsForUser(match, org, user, slot).mileagePay;
  }
  return Math.round(total * 100) / 100;
}

export function buildInvoiceLinesForMatch(
  match: Match,
  org: OrgSettings,
  users: UserProfile[],
  invoiceRates: FeeTable,
): ConferenceInvoiceLine[] {
  const roles = rolesNeededForMatch(match);
  const lines: ConferenceInvoiceLine[] = [];

  const pushLine = (slot: RequestableSlot) => {
    const count = roleBlockCount(match, slot);
    if (count <= 0) return;
    const unitCost = invoiceFeeForSlot(match, org, slot, invoiceRates[slot]);
    const mileageAmount = sumMileageForSlot(match, org, users, slot);
    const lineSubtotal = Math.round((count * unitCost + mileageAmount) * 100) / 100;
    lines.push({
      matchId: match.id,
      kickoffAt: match.kickoffAt,
      matchLabel: matchInvoiceLabel(match),
      positionLabel: positionLabel(slot, count),
      slot,
      count,
      unitCost,
      mileageAmount,
      lineSubtotal,
    });
  };

  if (roles.includes('mo')) pushLine('mo');

  const hasAr1 = roles.includes('ar1');
  const hasAr2 = roles.includes('ar2');
  if (hasAr1 || hasAr2) {
    const c1 = hasAr1 ? roleBlockCount(match, 'ar1') : 0;
    const c2 = hasAr2 ? roleBlockCount(match, 'ar2') : 0;
    const arCount = c1 + c2;
    if (arCount > 0) {
      const rate1 = hasAr1 ? invoiceRates.ar1 : invoiceRates.ar2;
      const rate2 = hasAr2 ? invoiceRates.ar2 : invoiceRates.ar1;
      const unitCost =
        hasAr1 && hasAr2 && rate1 === rate2
          ? rate1
          : hasAr1
            ? rate1
            : rate2;
      const mileageAmount =
        (hasAr1 ? sumMileageForSlot(match, org, users, 'ar1') : 0) +
        (hasAr2 ? sumMileageForSlot(match, org, users, 'ar2') : 0);
      const lineSubtotal =
        Math.round((arCount * unitCost + mileageAmount) * 100) / 100;
      lines.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        matchLabel: matchInvoiceLabel(match),
        positionLabel: positionLabel('ar1', arCount),
        slot: 'ar1',
        count: arCount,
        unitCost,
        mileageAmount: Math.round(mileageAmount * 100) / 100,
        lineSubtotal,
      });
    }
  }

  if (roles.includes('no4')) pushLine('no4');
  if (roles.includes('cmo')) pushLine('cmo');

  return lines;
}

export function buildInvoiceLines(
  matches: Match[],
  org: OrgSettings,
  users: UserProfile[],
  opts: {
    periodStart: string;
    periodEnd: string;
    billToCompetition: string;
    invoiceRates: FeeTable;
  },
): ConferenceInvoiceLine[] {
  const startMs = new Date(opts.periodStart).getTime();
  const endMs = new Date(opts.periodEnd).getTime() + 86_400_000 - 1;

  const lines: ConferenceInvoiceLine[] = [];
  for (const match of matches) {
    if (match.status === 'cancelled' || match.status === 'draft') continue;
    if ((match.competition ?? '') !== opts.billToCompetition) continue;
    const kickoffMs = new Date(match.kickoffAt).getTime();
    if (kickoffMs < startMs || kickoffMs > endMs) continue;
    if (kickoffMs > Date.now()) continue;
    lines.push(
      ...buildInvoiceLinesForMatch(match, org, users, opts.invoiceRates),
    );
  }

  return lines.sort(
    (a, b) =>
      new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime() ||
      a.matchId.localeCompare(b.matchId),
  );
}

export function invoiceSubtotal(lines: ConferenceInvoiceLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.lineSubtotal, 0) * 100) / 100;
}

export function invoiceSurchargeAmount(
  subtotal: number,
  surchargePercent: number,
): number {
  return Math.round(subtotal * (surchargePercent / 100) * 100) / 100;
}

export function invoiceGrandTotal(
  lines: ConferenceInvoiceLine[],
  surchargePercent: number,
  discountAmount: number,
): number {
  const sub = invoiceSubtotal(lines);
  const surcharge = invoiceSurchargeAmount(sub, surchargePercent);
  return Math.round((sub + surcharge - discountAmount) * 100) / 100;
}

export function matchSubtotals(
  lines: ConferenceInvoiceLine[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.matchId, (map.get(line.matchId) ?? 0) + line.lineSubtotal);
  }
  return map;
}

export function defaultInvoiceNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function defaultDueDate(daysFromNow = 30, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export function createDraftInvoice(
  org: OrgSettings,
  matches: Match[],
  users: UserProfile[],
  opts: {
    periodStart: string;
    periodEnd: string;
    billToCompetition: string;
    billToEmail: string;
    invoiceRates?: FeeTable;
    surchargePercent?: number;
    discountAmount?: number;
    dueDate?: string;
    invoiceNumber?: string;
    id: string;
  },
): ConferenceInvoice {
  const invoiceRates = opts.invoiceRates ?? defaultInvoiceFees(org);
  const lineItems = buildInvoiceLines(matches, org, users, {
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    billToCompetition: opts.billToCompetition,
    invoiceRates,
  });
  const now = new Date().toISOString();
  return {
    id: opts.id,
    invoiceNumber: opts.invoiceNumber ?? defaultInvoiceNumber(),
    issueDate: now.slice(0, 10),
    dueDate: opts.dueDate ?? defaultDueDate(),
    billToCompetition: opts.billToCompetition,
    billToEmail: opts.billToEmail,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    status: 'draft',
    defaultInvoiceRates: invoiceRates,
    surchargePercent: opts.surchargePercent ?? 0,
    discountAmount: opts.discountAmount ?? 0,
    lineItems,
    createdAt: now,
    updatedAt: now,
  };
}

export function recalcLineSubtotal(line: ConferenceInvoiceLine): ConferenceInvoiceLine {
  return {
    ...line,
    lineSubtotal:
      Math.round((line.count * line.unitCost + line.mileageAmount) * 100) / 100,
  };
}

export function refreshInvoiceTotals(invoice: ConferenceInvoice): ConferenceInvoice {
  const lineItems = invoice.lineItems.map(recalcLineSubtotal);
  return { ...invoice, lineItems, updatedAt: new Date().toISOString() };
}

export type InvoicePrintGroup = {
  matchId: string;
  kickoffAt: string;
  matchLabel: string;
  lines: ConferenceInvoiceLine[];
  matchSubtotal: number;
};

export function groupInvoiceLinesForPrint(
  lines: ConferenceInvoiceLine[],
): InvoicePrintGroup[] {
  const subs = matchSubtotals(lines);
  const order: string[] = [];
  const byMatch = new Map<string, ConferenceInvoiceLine[]>();
  for (const line of lines) {
    if (!byMatch.has(line.matchId)) {
      order.push(line.matchId);
      byMatch.set(line.matchId, []);
    }
    byMatch.get(line.matchId)!.push(line);
  }
  return order.map((matchId) => {
    const groupLines = byMatch.get(matchId)!;
    return {
      matchId,
      kickoffAt: groupLines[0]!.kickoffAt,
      matchLabel: groupLines[0]!.matchLabel,
      lines: groupLines,
      matchSubtotal: subs.get(matchId) ?? 0,
    };
  });
}
