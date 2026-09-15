import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { matchAppUrl } from './appLinks';

const CREW_SLOTS = ['mo', 'ar1', 'ar2', 'no4'] as const;
type CrewSlot = (typeof CREW_SLOTS)[number];
type RequestableSlot = CrewSlot | 'cmo';

export type CalendarPositionPreset =
  | 'referee'
  | 'assistant_referee'
  | 'tmo_cmo'
  | 'fourth_official'
  | 'other';

export type CalendarMatchType = 'xvs' | '10s' | '7s' | 'tournament' | 'other';

export type CalendarMatchStatus = 'upcoming' | 'completed' | 'cancelled';

export type MatchReadyAssignmentDto = {
  externalId: string;
  orgId: string;
  matchId: string;
  kickoffAt: string;
  timezone?: string;
  home?: string;
  away?: string;
  title?: string;
  location: string;
  position: string;
  positionPreset: CalendarPositionPreset;
  matchType: CalendarMatchType;
  competition?: string;
  expectedPay?: number;
  payCurrency?: string;
  status: CalendarMatchStatus;
  matchReadyStatus: string;
  matchReadyUrl?: string;
};

export type SyncMatchReadyAssignmentsResult = {
  syncedAt: string;
  assignments: MatchReadyAssignmentDto[];
};

type FeeTable = {
  mo: number;
  ar1: number;
  ar2: number;
  no4: number;
  cmo?: number;
};

type OrgContext = {
  timezone?: string;
  defaultFees: FeeTable;
};

type CrewRow = Record<string, unknown>;

const RATE_WINDOW_MS = 30_000;
const RATE_MAX = 3;

const POSITION_BY_SLOT: Record<
  RequestableSlot,
  { label: string; preset: CalendarPositionPreset }
> = {
  mo: { label: 'Referee', preset: 'referee' },
  ar1: { label: 'Assistant Referee', preset: 'assistant_referee' },
  ar2: { label: 'Assistant Referee', preset: 'assistant_referee' },
  no4: { label: '4th Official', preset: 'fourth_official' },
  cmo: { label: 'TMO / CMO', preset: 'tmo_cmo' },
};

function slotList(crew: Record<string, unknown>, slot: CrewSlot): CrewRow[] {
  const raw = crew[slot];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is CrewRow => Boolean(x) && typeof x === 'object');
  }
  if (raw && typeof raw === 'object') return [raw as CrewRow];
  return [];
}

function asFeeTable(value: unknown): FeeTable {
  const data =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    mo: typeof data.mo === 'number' ? data.mo : 0,
    ar1: typeof data.ar1 === 'number' ? data.ar1 : 0,
    ar2: typeof data.ar2 === 'number' ? data.ar2 : 0,
    no4: typeof data.no4 === 'number' ? data.no4 : 0,
    cmo: typeof data.cmo === 'number' ? data.cmo : undefined,
  };
}

export function feeForSlot(
  match: Record<string, unknown>,
  org: OrgContext,
  slot: RequestableSlot,
): number {
  const override =
    match.feeOverride && typeof match.feeOverride === 'object'
      ? (match.feeOverride as Record<string, unknown>)
      : {};
  if (slot === 'cmo') {
    const cmo =
      typeof override.cmo === 'number' ? override.cmo : org.defaultFees.cmo;
    return cmo ?? 0;
  }
  const slotFee = override[slot];
  if (typeof slotFee === 'number') return slotFee;
  return org.defaultFees[slot];
}

export function formatMatchLocation(
  venueName: unknown,
  venueAddress: unknown,
): string {
  const name = String(venueName ?? '').trim();
  const address = String(venueAddress ?? '').trim();
  if (name && address && name !== address) return `${name}, ${address}`;
  return name || address || 'TBD';
}

export function inferCalendarMatchType(
  match: Record<string, unknown>,
): CalendarMatchType {
  if (match.isTournament === true) return 'tournament';
  const raw = String(match.matchType ?? '').trim().toLowerCase();
  if (raw.includes('7s') || raw === '7') return '7s';
  if (raw.includes('10s') || raw === '10') return '10s';
  return 'xvs';
}

export function inferCalendarStatus(
  match: Record<string, unknown>,
  kickoffAt: string,
  now = Date.now(),
): CalendarMatchStatus {
  const workflow = String(match.status ?? '').trim();
  if (
    workflow === 'cancelled' ||
    workflow === 'postponed' ||
    Boolean(match.cancelledAt) ||
    Boolean(match.postponedAt) ||
    Boolean(match.releasedAt)
  ) {
    return 'cancelled';
  }
  const kickoffMs = Date.parse(kickoffAt);
  if (!Number.isNaN(kickoffMs) && kickoffMs < now) return 'completed';
  return 'upcoming';
}

export function confirmedAssignmentForUser(
  match: Record<string, unknown>,
  uid: string,
): { slot: RequestableSlot } | null {
  const crew =
    match.crew && typeof match.crew === 'object'
      ? (match.crew as Record<string, unknown>)
      : {};
  for (const slot of CREW_SLOTS) {
    for (const row of slotList(crew, slot)) {
      if (String(row.userId ?? '') !== uid) continue;
      if (String(row.status ?? '') === 'confirmed') return { slot };
    }
  }
  const cmo = Array.isArray(match.cmo) ? match.cmo : [];
  if (
    cmo.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        String((entry as Record<string, unknown>).userId ?? '') === uid,
    )
  ) {
    return { slot: 'cmo' };
  }
  return null;
}

export function mapMatchToAssignmentDto(
  orgId: string,
  matchId: string,
  match: Record<string, unknown>,
  uid: string,
  org: OrgContext,
  now = Date.now(),
): MatchReadyAssignmentDto | null {
  const assignment = confirmedAssignmentForUser(match, uid);
  if (!assignment) return null;

  const kickoffAt = String(match.kickoffAt ?? '').trim();
  if (!kickoffAt) return null;

  const positionMeta = POSITION_BY_SLOT[assignment.slot];
  const expectedPay = feeForSlot(match, org, assignment.slot);

  return {
    externalId: `${orgId}:${matchId}`,
    orgId,
    matchId,
    kickoffAt,
    timezone: org.timezone,
    home: String(match.homeTeamName ?? '').trim() || undefined,
    away: String(match.awayTeamName ?? '').trim() || undefined,
    title: String(match.title ?? '').trim() || undefined,
    location: formatMatchLocation(match.venueName, match.venueAddress),
    position: positionMeta.label,
    positionPreset: positionMeta.preset,
    matchType: inferCalendarMatchType(match),
    competition: String(match.competition ?? '').trim() || undefined,
    expectedPay: expectedPay > 0 ? expectedPay : undefined,
    payCurrency: 'USD',
    status: inferCalendarStatus(match, kickoffAt, now),
    matchReadyStatus: String(match.status ?? '').trim() || 'unknown',
    matchReadyUrl: matchAppUrl(matchId),
  };
}

async function findUserOrgIds(db: Firestore, uid: string): Promise<string[]> {
  const orgsSnap = await db.collection('orgs').get();
  const orgIds: string[] = [];
  await Promise.all(
    orgsSnap.docs.map(async (orgDoc) => {
      const member = await db.doc(`orgs/${orgDoc.id}/members/${uid}`).get();
      if (member.exists) orgIds.push(orgDoc.id);
    }),
  );
  return orgIds;
}

async function assertRateLimit(db: Firestore, uid: string): Promise<void> {
  const rateRef = db.doc(`users/${uid}/matchCalendar/syncRate`);
  const rateSnap = await rateRef.get();
  const now = Date.now();
  const prev = Array.isArray(rateSnap.data()?.at)
    ? (rateSnap.data()?.at as unknown[]).filter(
        (v): v is number => typeof v === 'number',
      )
    : [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new HttpsError(
      'resource-exhausted',
      'MatchReady sync was called too recently. Try again in a moment.',
    );
  }
  await rateRef.set(
    { at: [...recent, now].slice(-RATE_MAX), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function runSyncMatchReadyAssignments(
  db: Firestore,
  uid: string,
): Promise<SyncMatchReadyAssignmentsResult> {
  await assertRateLimit(db, uid);

  const orgIds = await findUserOrgIds(db, uid);
  const syncedAt = new Date().toISOString();
  const now = Date.now();
  const assignments: MatchReadyAssignmentDto[] = [];

  for (const orgId of orgIds) {
    const orgSnap = await db.doc(`orgs/${orgId}`).get();
    const orgData = orgSnap.data() ?? {};
    const org: OrgContext = {
      timezone:
        typeof orgData.timezone === 'string' ? orgData.timezone : undefined,
      defaultFees: asFeeTable(orgData.defaultFees),
    };

    const matchesSnap = await db.collection(`orgs/${orgId}/matches`).get();
    for (const matchDoc of matchesSnap.docs) {
      const dto = mapMatchToAssignmentDto(
        orgId,
        matchDoc.id,
        matchDoc.data(),
        uid,
        org,
        now,
      );
      if (dto) assignments.push(dto);
    }
  }

  assignments.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  return { syncedAt, assignments };
}
