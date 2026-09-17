/**
 * Port of Match Calendar `getInsightsSummary` for server-side platform rollups.
 * Keep in sync with Match Calendar `src/features/insights/insightsSummary.ts`
 * and `matchCalendarFlightDistance.ts` with `src/features/matches/flightDistance.ts`.
 */

import {
  countFlightSegments,
  getTotalFlightMiles,
  type FlightInfoLike,
} from './matchCalendarFlightDistance';
import { getTotalFlightMinutes } from './matchCalendarTravelDuration';

export type CountRow = { label: string; count: number };
export type OrganizationRow = {
  organization: string;
  income: number;
  expenses: number;
  net: number;
};
export type TopExpenseRow = {
  category: string;
  label: string;
  outOfPocket: number;
};

export type InsightsSummary = {
  eventTypes: CountRow[];
  eventCount: number;
  positions: CountRow[];
  milesDriven: number;
  drivenTrips: number;
  milesFlown: number;
  flightSegments: number;
  flightMinutes: number;
  paid: number;
  expenses: number;
  net: number;
  topExpenses: TopExpenseRow[];
  organizations: OrganizationRow[];
};

type Expense = {
  category: string;
  amount: number;
  miles?: number;
  reimbursementStatus?: string;
  reimbursedAmount?: number;
};

type TravelSelfPaidInfo = {
  selfPaid?: boolean;
  amountPaid?: number;
  reimbursementStatus?: string;
  reimbursedAmount?: number;
};

type MatchLike = {
  id: string;
  status?: string;
  tournamentId?: string;
  matchType?: string;
  customMatchType?: string;
  position?: string;
  positionPreset?: string;
  customPosition?: string;
  competition?: string;
  payOwedBy?: string;
  payStatus?: string;
  paidAmount?: number;
  expectedPay?: number;
  expenses?: Expense[];
  flight?: FlightInfoLike;
  lodging?: TravelSelfPaidInfo;
  groundTravel?: TravelSelfPaidInfo;
};

type TournamentLike = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  expenses?: Expense[];
  settlement?: Partial<MatchLike>;
  matchDefaults?: { competition?: string; payOwedBy?: string };
  flight?: FlightInfoLike;
  lodging?: TravelSelfPaidInfo;
  groundTravel?: TravelSelfPaidInfo;
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  xvs: 'XVs',
  '10s': '10s',
  '7s': '7s',
  tournament: 'Tournament',
  other: 'Other',
};

const POSITION_LABELS: Record<string, string> = {
  referee: 'Referee',
  assistant_referee: 'Assistant Referee',
  tmo_cmo: 'TMO / CMO',
  fourth_official: '4th Official',
  other: 'Other',
};

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  miles_driven: 'Miles driven',
  miles_flown: 'Miles flown',
  gas: 'Gas',
  lodging: 'Lodging',
  food: 'Food',
  rental_car: 'Car rental',
  rideshare: 'Rideshare',
  parking: 'Parking',
  tolls: 'Tolls',
  airfare: 'Airfare',
  other: 'Other',
};

function resolveMatchTypeLabel(matchType?: string, customMatchType?: string): string {
  if (matchType === 'other') return customMatchType?.trim() || 'Other';
  return MATCH_TYPE_LABELS[matchType ?? ''] ?? matchType ?? 'Other';
}

function resolvePositionLabel(preset?: string, customPosition?: string): string {
  if (preset === 'other') return customPosition?.trim() || 'Other';
  if (preset) return POSITION_LABELS[preset] ?? preset;
  return 'Other';
}

function eventHasMilesDriven(event: MatchLike): boolean {
  return (event.expenses ?? []).some(
    (expense) =>
      expense.category === 'miles_driven' &&
      Number.isFinite(expense.miles) &&
      (expense.miles ?? 0) > 0,
  );
}

function counts(labels: string[]): CountRow[] {
  const result = new Map<string, number>();
  for (const label of labels) result.set(label, (result.get(label) ?? 0) + 1);
  return [...result]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sumExpenses(match: MatchLike): number {
  return (match.expenses ?? []).reduce((total, expense) => total + expense.amount, 0);
}

function sumReimbursed(expense: Expense): number {
  if (expense.reimbursementStatus !== 'reimbursed') return 0;
  return expense.reimbursedAmount ?? expense.amount;
}

function expenseOutOfPocket(expense: Expense): number {
  return expense.amount - sumReimbursed(expense);
}

type TravelCostEntry = {
  source: 'flight' | 'lodging' | 'groundTravel';
  amount: number;
  reimbursedAmount: number;
  outOfPocket: number;
};

function travelEntry(
  source: TravelCostEntry['source'],
  info?: TravelSelfPaidInfo,
): TravelCostEntry | null {
  if (!info?.selfPaid || info.amountPaid == null) return null;
  const reimbursedAmount =
    info.reimbursementStatus === 'reimbursed'
      ? info.reimbursedAmount ?? info.amountPaid
      : 0;
  return {
    source,
    amount: info.amountPaid,
    reimbursedAmount,
    outOfPocket: info.amountPaid - reimbursedAmount,
  };
}

function getTravelCostEntries(match: MatchLike): TravelCostEntry[] {
  return [
    travelEntry('flight', match.flight),
    travelEntry('lodging', match.lodging),
    travelEntry('groundTravel', match.groundTravel),
  ].filter((entry): entry is TravelCostEntry => entry != null);
}

function travelExpenseCategory(source: TravelCostEntry['source']): string {
  if (source === 'flight') return 'airfare';
  if (source === 'lodging') return 'lodging';
  return 'rental_car';
}

function travelCostAlreadyInExpenses(
  entry: TravelCostEntry,
  expenses: Expense[],
): boolean {
  const category = travelExpenseCategory(entry.source);
  return expenses.some(
    (expense) =>
      expense.category === category &&
      Math.abs(expense.amount - entry.amount) < 0.005,
  );
}

function getMatchFinanceTotals(match: MatchLike) {
  const expenseLineTotal = sumExpenses(match);
  const expenses = match.expenses ?? [];
  const travelEntries = getTravelCostEntries(match);
  const travelNotDuplicatedInExpenses = travelEntries
    .filter((entry) => !travelCostAlreadyInExpenses(entry, expenses))
    .reduce((total, entry) => total + entry.amount, 0);

  let reimbursedTotal = 0;
  for (const expense of expenses) {
    reimbursedTotal += sumReimbursed(expense);
  }
  reimbursedTotal += travelEntries
    .filter((entry) => !travelCostAlreadyInExpenses(entry, expenses))
    .reduce((total, entry) => total + entry.reimbursedAmount, 0);

  const expenseOutOfPocketTotal = expenses.reduce(
    (total, expense) => total + expenseOutOfPocket(expense),
    0,
  );
  const travelOutOfPocketNotDuplicated = travelEntries
    .filter((entry) => !travelCostAlreadyInExpenses(entry, expenses))
    .reduce((total, entry) => total + entry.outOfPocket, 0);

  return {
    combinedExpenseTotal: expenseLineTotal + travelNotDuplicatedInExpenses,
    reimbursedTotal,
    outOfPocketTotal: expenseOutOfPocketTotal + travelOutOfPocketNotDuplicated,
  };
}

function getSettlementPaidTotal(match: MatchLike): number {
  const fee =
    match.payStatus === 'paid'
      ? match.paidAmount ?? match.expectedPay ?? 0
      : 0;
  return fee + getMatchFinanceTotals(match).reimbursedTotal;
}

function getCategoryRollup(matches: MatchLike[]): TopExpenseRow[] {
  const totals = new Map<string, { amount: number; outOfPocket: number }>();

  for (const match of matches) {
    const expenses = match.expenses ?? [];
    for (const expense of expenses) {
      const current = totals.get(expense.category) ?? { amount: 0, outOfPocket: 0 };
      current.amount += expense.amount;
      current.outOfPocket += expenseOutOfPocket(expense);
      totals.set(expense.category, current);
    }

    for (const entry of getTravelCostEntries(match)) {
      if (travelCostAlreadyInExpenses(entry, expenses)) continue;
      const category = travelExpenseCategory(entry.source);
      const current = totals.get(category) ?? { amount: 0, outOfPocket: 0 };
      current.amount += entry.amount;
      current.outOfPocket += entry.outOfPocket;
      totals.set(category, current);
    }
  }

  return [...totals.entries()]
    .filter(([, values]) => values.amount > 0)
    .map(([category, values]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category] ?? category,
      outOfPocket: values.outOfPocket,
    }));
}

function tournamentEvent(tournament: TournamentLike): MatchLike {
  return {
    id: tournament.id,
    status: 'upcoming',
    matchType: 'tournament',
    position: '',
    competition: tournament.matchDefaults?.competition,
    payOwedBy: tournament.matchDefaults?.payOwedBy,
    expenses: tournament.expenses,
    flight: tournament.flight,
    lodging: tournament.lodging,
    groundTravel: tournament.groundTravel,
    ...tournament.settlement,
  };
}

export function getInsightsSummary(
  matches: MatchLike[],
  tournaments: TournamentLike[],
): InsightsSummary {
  const parents = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const parentEvents = tournaments.map(tournamentEvent);
  const financialEvents = [...matches, ...parentEvents];
  const activeMatches = matches.filter((match) => match.status !== 'cancelled');
  const activeParents = parentEvents.filter((match) => match.status !== 'cancelled');
  const eventTypes = counts([
    ...activeMatches
      .filter((match) => !match.tournamentId || !parents.has(match.tournamentId))
      .map((match) => resolveMatchTypeLabel(match.matchType, match.customMatchType)),
    ...activeParents.map(() => 'Tournament'),
  ]);
  const positions = counts(
    [...activeMatches, ...activeParents.filter(
      (parent) => !activeMatches.some((match) => match.tournamentId === parent.id),
    )].map((match) =>
      match.positionPreset
        ? resolvePositionLabel(match.positionPreset, match.customPosition)
        : (match.position ?? '').trim() || 'Other',
    ),
  );

  let milesDriven = 0;
  let drivenTrips = 0;
  let milesFlown = 0;
  let flightSegments = 0;
  let flightMinutes = 0;
  let paid = 0;
  let expenses = 0;
  const organizations = new Map<string, OrganizationRow>();
  for (const event of financialEvents) {
    for (const expense of event.expenses ?? []) {
      const miles = expense.miles ?? 0;
      if (!Number.isFinite(miles) || miles < 0) continue;
      if (expense.category === 'miles_driven') milesDriven += miles;
      if (expense.category === 'miles_flown') milesFlown += miles;
    }
    if (eventHasMilesDriven(event)) drivenTrips += 1;
    milesFlown += getTotalFlightMiles(event.flight) ?? 0;
    flightSegments += countFlightSegments(event.flight);
    flightMinutes += getTotalFlightMinutes(event.flight) ?? 0;
    const income = getSettlementPaidTotal(event);
    const costs = getMatchFinanceTotals(event).combinedExpenseTotal;
    paid += income;
    expenses += costs;
    const parent = event.tournamentId ? parents.get(event.tournamentId) : undefined;
    const organization =
      event.competition?.trim() ||
      parent?.matchDefaults?.competition?.trim() ||
      event.payOwedBy?.trim() ||
      parent?.matchDefaults?.payOwedBy?.trim() ||
      'Unassigned';
    const key = organization.toLocaleLowerCase();
    const row = organizations.get(key) ?? {
      organization,
      income: 0,
      expenses: 0,
      net: 0,
    };
    row.income += income;
    row.expenses += costs;
    row.net = row.income - row.expenses;
    organizations.set(key, row);
  }

  return {
    eventTypes,
    eventCount: eventTypes.reduce((sum, row) => sum + row.count, 0),
    positions,
    milesDriven,
    drivenTrips,
    milesFlown,
    flightSegments,
    flightMinutes,
    paid,
    expenses,
    net: paid - expenses,
    topExpenses: getCategoryRollup(financialEvents)
      .filter((row) => row.outOfPocket > 0)
      .sort(
        (a, b) =>
          b.outOfPocket - a.outOfPocket || a.label.localeCompare(b.label),
      )
      .slice(0, 5),
    organizations: [...organizations.values()].sort(
      (a, b) => b.net - a.net || a.organization.localeCompare(b.organization),
    ),
  };
}

function mergeCountRows(rows: CountRow[]): CountRow[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.label, (totals.get(row.label) ?? 0) + row.count);
  }
  return [...totals.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function mergeInsightsSummaries(
  summaries: InsightsSummary[],
): InsightsSummary {
  const merged: InsightsSummary = {
    eventTypes: [],
    eventCount: 0,
    positions: [],
    milesDriven: 0,
    drivenTrips: 0,
    milesFlown: 0,
    flightSegments: 0,
    flightMinutes: 0,
    paid: 0,
    expenses: 0,
    net: 0,
    topExpenses: [],
    organizations: [],
  };

  for (const summary of summaries) {
    merged.eventTypes.push(...summary.eventTypes);
    merged.positions.push(...summary.positions);
    merged.milesDriven += summary.milesDriven;
    merged.drivenTrips += summary.drivenTrips;
    merged.milesFlown += summary.milesFlown;
    merged.flightSegments += summary.flightSegments;
    merged.flightMinutes += summary.flightMinutes;
    merged.paid += summary.paid;
    merged.expenses += summary.expenses;
    merged.topExpenses.push(...summary.topExpenses);
    merged.organizations.push(...summary.organizations);
  }

  merged.eventTypes = mergeCountRows(merged.eventTypes);
  merged.eventCount = merged.eventTypes.reduce((sum, row) => sum + row.count, 0);
  merged.positions = mergeCountRows(merged.positions);
  merged.net = merged.paid - merged.expenses;

  const expenseTotals = new Map<string, TopExpenseRow>();
  for (const row of merged.topExpenses) {
    const current = expenseTotals.get(row.category) ?? {
      category: row.category,
      label: row.label,
      outOfPocket: 0,
    };
    current.outOfPocket += row.outOfPocket;
    expenseTotals.set(row.category, current);
  }
  merged.topExpenses = [...expenseTotals.values()]
    .filter((row) => row.outOfPocket > 0)
    .sort(
      (a, b) =>
        b.outOfPocket - a.outOfPocket || a.label.localeCompare(b.label),
    )
    .slice(0, 5);

  const orgTotals = new Map<string, OrganizationRow>();
  for (const row of merged.organizations) {
    const key = row.organization.toLocaleLowerCase();
    const current = orgTotals.get(key) ?? {
      organization: row.organization,
      income: 0,
      expenses: 0,
      net: 0,
    };
    current.income += row.income;
    current.expenses += row.expenses;
    current.net = current.income - current.expenses;
    orgTotals.set(key, current);
  }
  merged.organizations = [...orgTotals.values()].sort(
    (a, b) => b.net - a.net || a.organization.localeCompare(b.organization),
  );

  return merged;
}
