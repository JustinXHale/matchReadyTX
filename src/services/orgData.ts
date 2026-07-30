import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured } from '@/services/firebase';
import {
  emptyCrew,
  ensureDefaultMoBlock,
  newAssignmentId,
  newCmoId,
  type CrewAssignment,
  type CmoContact,
  type FixtureRequest,
  type Match,
  type MatchGender,
  type OrgSettings,
  type Team,
} from '@/domain/types';
import { releaseMatch } from '@/domain/matchTransitions';

const DEFAULT_ORG =
  import.meta.env.VITE_DEFAULT_ORG_ID?.trim() || 'lonestar';

export function defaultOrgId(): string {
  return DEFAULT_ORG;
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured.');
  }
  return db;
}

function requireFunctions() {
  if (!isFirebaseConfigured || !functions) {
    throw new Error('Cloud Functions are not configured.');
  }
  return functions;
}

function normalizeAssignment(
  slot: CrewAssignment['slot'],
  raw: Record<string, unknown>,
): CrewAssignment {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newAssignmentId(),
    slot,
    status: (raw.status as CrewAssignment['status']) || 'empty',
    userId: typeof raw.userId === 'string' ? raw.userId : undefined,
    userName: typeof raw.userName === 'string' ? raw.userName : undefined,
    confirmedAt:
      typeof raw.confirmedAt === 'string' ? raw.confirmedAt : undefined,
    history: Array.isArray(raw.history)
      ? (raw.history as CrewAssignment['history'])
      : [],
  };
}

/** Accept legacy single object or array per slot. */
function normalizeCrew(raw: unknown): Match['crew'] {
  const base = emptyCrew();
  if (!raw || typeof raw !== 'object') return ensureDefaultMoBlock(base);
  const obj = raw as Record<string, unknown>;
  for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as const) {
    const c = obj[slot];
    if (!c) continue;
    if (Array.isArray(c)) {
      base[slot] = c
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
        .map((x) => normalizeAssignment(slot, x));
    } else if (typeof c === 'object') {
      base[slot] = [normalizeAssignment(slot, c as Record<string, unknown>)];
    }
  }
  return ensureDefaultMoBlock(base);
}

/** Accept legacy single CMO object or array. */
function normalizeCmo(raw: unknown): CmoContact[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const list = raw
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
      .map((x) => ({
        id: typeof x.id === 'string' && x.id ? x.id : newCmoId(),
        userId: typeof x.userId === 'string' ? x.userId : undefined,
        userName: typeof x.userName === 'string' ? x.userName : undefined,
      }));
    return list.length ? list : undefined;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return [
      {
        id: typeof o.id === 'string' && o.id ? o.id : newCmoId(),
        userId: typeof o.userId === 'string' ? o.userId : undefined,
        userName: typeof o.userName === 'string' ? o.userName : undefined,
      },
    ];
  }
  return undefined;
}

export function matchFromFirestore(
  id: string,
  data: Record<string, unknown>,
): Match {
  return {
    id,
    sheetRowKey: String(data.sheetRowKey ?? id),
    status: (data.status as Match['status']) || 'draft',
    kickoffAt: String(data.kickoffAt ?? ''),
    venueName: String(data.venueName ?? ''),
    venueAddress: String(data.venueAddress ?? ''),
    venueLat: typeof data.venueLat === 'number' ? data.venueLat : undefined,
    venueLng: typeof data.venueLng === 'number' ? data.venueLng : undefined,
    homeTeamId: String(data.homeTeamId ?? ''),
    awayTeamId: String(data.awayTeamId ?? ''),
    homeTeamName: String(data.homeTeamName ?? ''),
    awayTeamName: String(data.awayTeamName ?? ''),
    competition:
      typeof data.competition === 'string' ? data.competition : undefined,
    level: String(data.level ?? 'Tier 1'),
    gender: data.gender === 'women' ? 'women' : 'men',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    cmo: normalizeCmo(data.cmo),
    rolesNeeded: Array.isArray(data.rolesNeeded)
      ? (data.rolesNeeded as Match['rolesNeeded'])
      : undefined,
    flightProvided: Boolean(data.flightProvided),
    housingProvided: Boolean(data.housingProvided),
    feeOverride:
      data.feeOverride && typeof data.feeOverride === 'object'
        ? (data.feeOverride as Match['feeOverride'])
        : undefined,
    homeConfirmedAt:
      typeof data.homeConfirmedAt === 'string'
        ? data.homeConfirmedAt
        : undefined,
    awayConfirmedAt:
      typeof data.awayConfirmedAt === 'string'
        ? data.awayConfirmedAt
        : undefined,
    t72TeamHome:
      data.t72TeamHome === 'yes' || data.t72TeamHome === 'no'
        ? data.t72TeamHome
        : undefined,
    t72TeamAway:
      data.t72TeamAway === 'yes' || data.t72TeamAway === 'no'
        ? data.t72TeamAway
        : undefined,
    releasedAt:
      typeof data.releasedAt === 'string' ? data.releasedAt : undefined,
    cancelledAt:
      typeof data.cancelledAt === 'string' ? data.cancelledAt : undefined,
    postponedAt:
      typeof data.postponedAt === 'string' ? data.postponedAt : undefined,
    crew: normalizeCrew(data.crew),
    homeScore: typeof data.homeScore === 'number' ? data.homeScore : undefined,
    awayScore: typeof data.awayScore === 'number' ? data.awayScore : undefined,
  };
}

export function teamFromFirestore(
  id: string,
  data: Record<string, unknown>,
): Team {
  return {
    id,
    name: String(data.name ?? id),
    contactEmails: Array.isArray(data.contactEmails)
      ? (data.contactEmails as string[])
      : [],
    contactPhones: Array.isArray(data.contactPhones)
      ? (data.contactPhones as string[])
      : undefined,
  };
}

export function orgPatchFromFirestore(
  id: string,
  data: Record<string, unknown>,
): Partial<OrgSettings> & { id: string } {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : undefined,
    timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
    mileageRatePerMile:
      typeof data.mileageRatePerMile === 'number'
        ? data.mileageRatePerMile
        : undefined,
    mileageMinMiles:
      typeof data.mileageMinMiles === 'number'
        ? data.mileageMinMiles
        : undefined,
    defaultFees:
      data.defaultFees && typeof data.defaultFees === 'object'
        ? (data.defaultFees as OrgSettings['defaultFees'])
        : undefined,
    matchLevels: Array.isArray(data.matchLevels)
      ? (data.matchLevels as string[])
      : undefined,
    competitions: Array.isArray(data.competitions)
      ? (data.competitions as string[])
      : undefined,
    sheetId: typeof data.sheetId === 'string' ? data.sheetId : undefined,
    sheetSyncedAt:
      typeof data.sheetSyncedAt === 'string' ? data.sheetSyncedAt : undefined,
    sheetSyncError:
      typeof data.sheetSyncError === 'string'
        ? data.sheetSyncError
        : undefined,
  };
}

export type LiveOrgSnapshot = {
  org: Partial<OrgSettings> & { id: string };
  matches: Match[];
  teams: Team[];
  fixtureRequests: FixtureRequest[];
};

export function fixtureRequestFromFirestore(
  id: string,
  data: Record<string, unknown>,
): FixtureRequest {
  return {
    id,
    orgId: typeof data.orgId === 'string' ? data.orgId : '',
    requesterUserId: String(data.requesterUserId ?? ''),
    requesterName: String(data.requesterName ?? ''),
    requesterTeamId: String(data.requesterTeamId ?? ''),
    side: data.side === 'away' ? 'away' : 'home',
    opponentTeamId: String(data.opponentTeamId ?? ''),
    homeTeamId: String(data.homeTeamId ?? ''),
    awayTeamId: String(data.awayTeamId ?? ''),
    homeTeamName: String(data.homeTeamName ?? ''),
    awayTeamName: String(data.awayTeamName ?? ''),
    kickoffAt: String(data.kickoffAt ?? ''),
    venueName: String(data.venueName ?? ''),
    venueAddress: String(data.venueAddress ?? ''),
    competition:
      typeof data.competition === 'string' ? data.competition : undefined,
    level: String(data.level ?? ''),
    gender: data.gender === 'women' ? 'women' : 'men',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    flightProvided: Boolean(data.flightProvided),
    housingProvided: Boolean(data.housingProvided),
    status:
      data.status === 'approved' || data.status === 'declined'
        ? data.status
        : 'pending',
    createdAt: String(data.createdAt ?? ''),
    reviewedAt:
      typeof data.reviewedAt === 'string' ? data.reviewedAt : undefined,
    reviewedByUserId:
      typeof data.reviewedByUserId === 'string'
        ? data.reviewedByUserId
        : undefined,
    declineReason:
      typeof data.declineReason === 'string' ? data.declineReason : undefined,
    matchId: typeof data.matchId === 'string' ? data.matchId : undefined,
    sheetRowKey:
      typeof data.sheetRowKey === 'string' ? data.sheetRowKey : undefined,
  };
}

/** Subscribe to org + matches + teams + fixture requests. */
export function subscribeLiveOrg(
  orgId: string,
  onData: (snap: LiveOrgSnapshot) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  let org: Partial<OrgSettings> & { id: string } = { id: orgId };
  let matches: Match[] = [];
  let teams: Team[] = [];
  let fixtureRequests: FixtureRequest[] = [];

  const emit = () => onData({ org, matches, teams, fixtureRequests });

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(database, 'orgs', orgId),
      (snap) => {
        if (snap.exists()) {
          org = orgPatchFromFirestore(orgId, snap.data() as Record<string, unknown>);
        } else {
          org = { id: orgId };
        }
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(database, 'orgs', orgId, 'matches'),
      (snap) => {
        matches = snap.docs.map((d) =>
          matchFromFirestore(d.id, d.data() as Record<string, unknown>),
        );
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(database, 'orgs', orgId, 'teams'),
      (snap) => {
        teams = snap.docs.map((d) =>
          teamFromFirestore(d.id, d.data() as Record<string, unknown>),
        );
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(database, 'orgs', orgId, 'fixtureRequests'),
      (snap) => {
        fixtureRequests = snap.docs.map((d) =>
          fixtureRequestFromFirestore(d.id, d.data() as Record<string, unknown>),
        );
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export type SyncSheetResult = {
  ok: true;
  orgId: string;
  sheetId: string;
  matched: number;
  upserted: number;
  cancelled: number;
  teams: number;
  sheetSyncedAt: string;
};

/** Call Cloud Function syncSheet (assigner only). */
export async function callSyncSheet(input: {
  orgId?: string;
  sheetId?: string;
}): Promise<SyncSheetResult> {
  const fn = httpsCallable(requireFunctions(), 'syncSheet');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    sheetId: input.sheetId,
  });
  return result.data as SyncSheetResult;
}

export type ProposalWritebackResult = {
  ok: true;
  matchId: string;
  sheetRowKey: string;
  updatedAt: string;
  proposalId: string;
};

/** Write accepted proposal facts to Schedule Sheet + Firestore match. */
export async function callProposalWriteback(input: {
  orgId?: string;
  matchId: string;
  proposalId: string;
  kickoffAt?: string;
  venueName?: string;
  venueAddress?: string;
}): Promise<ProposalWritebackResult> {
  const fn = httpsCallable(requireFunctions(), 'proposalWriteback');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    matchId: input.matchId,
    proposalId: input.proposalId,
    kickoffAt: input.kickoffAt,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
  });
  return result.data as ProposalWritebackResult;
}

/** Persist sheetId on the org doc (assigner write). */
export async function saveOrgSheetId(
  orgId: string,
  sheetId: string,
): Promise<void> {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(requireDb(), 'orgs', orgId),
    { sheetId, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/** Release draft matches in Firestore (assigner). */
export async function releaseDraftMatchesInFirestore(
  orgId: string,
  matches: Match[],
  opts: { all?: boolean; from?: string; to?: string },
): Promise<number> {
  const database = requireDb();
  const toRelease = matches.filter((m) => {
    if (m.status !== 'draft') return false;
    if (opts.all) return true;
    if (opts.from && opts.to) {
      const t = new Date(m.kickoffAt).getTime();
      return (
        t >= new Date(opts.from).getTime() && t <= new Date(opts.to).getTime()
      );
    }
    return false;
  });

  if (toRelease.length === 0) return 0;

  let batch = writeBatch(database);
  let ops = 0;
  let released = 0;

  for (const m of toRelease) {
    const next = releaseMatch(m);
    const ref = doc(database, 'orgs', orgId, 'matches', m.id);
    batch.set(
      ref,
      {
        status: next.status,
        releasedAt: next.releasedAt ?? null,
        homeConfirmedAt: null,
        awayConfirmedAt: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    ops += 1;
    released += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return released;
}

/** Firestore rejects `undefined` — omit those keys (shallow). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

function assignmentForFirestore(a: CrewAssignment): Record<string, unknown> {
  return stripUndefined({
    id: a.id,
    slot: a.slot,
    status: a.status,
    history: Array.isArray(a.history) ? a.history : [],
    userId: a.userId ?? null,
    userName: a.userName ?? null,
    confirmedAt: a.confirmedAt ?? null,
  });
}

/** Serialize crew for Firestore (arrays; no `undefined`; empty optionals → null). */
function crewForFirestore(crew: Match['crew']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as const) {
    out[slot] = (crew[slot] ?? []).map(assignmentForFirestore);
  }
  return out;
}

function cmoForFirestore(cmo: Match['cmo']): unknown {
  if (!cmo?.length) return null;
  return cmo.map((c) =>
    stripUndefined({
      id: c.id ?? null,
      userId: c.userId ?? null,
      userName: c.userName ?? null,
    }),
  );
}

/** Persist crew + match status after an assigner assignment (live mode). */
export async function saveMatchCrewAssignment(
  orgId: string,
  match: Pick<Match, 'id' | 'crew' | 'status' | 'cmo' | 'rolesNeeded'>,
): Promise<void> {
  const { setDoc } = await import('firebase/firestore');
  const payload = stripUndefined({
    crew: crewForFirestore(match.crew),
    status: match.status,
    rolesNeeded: match.rolesNeeded ?? null,
    cmo: cmoForFirestore(match.cmo),
    updatedAt: new Date().toISOString(),
  });
  await setDoc(doc(requireDb(), 'orgs', orgId, 'matches', match.id), payload, {
    merge: true,
  });
}

/** Create a pending fixture request (team admin). */
export async function createFixtureRequestInFirestore(
  orgId: string,
  req: FixtureRequest,
): Promise<void> {
  const payload = stripUndefined({
    orgId,
    requesterUserId: req.requesterUserId,
    requesterName: req.requesterName,
    requesterTeamId: req.requesterTeamId,
    side: req.side,
    opponentTeamId: req.opponentTeamId,
    homeTeamId: req.homeTeamId,
    awayTeamId: req.awayTeamId,
    homeTeamName: req.homeTeamName,
    awayTeamName: req.awayTeamName,
    kickoffAt: req.kickoffAt,
    venueName: req.venueName,
    venueAddress: req.venueAddress,
    competition: req.competition ?? null,
    level: req.level,
    gender: req.gender as MatchGender,
    notes: req.notes ?? null,
    flightProvided: req.flightProvided,
    housingProvided: req.housingProvided,
    status: 'pending',
    createdAt: req.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'fixtureRequests', req.id),
    payload,
  );
}

/** Assigner declines a pending fixture request (client write). */
export async function declineFixtureRequestInFirestore(
  orgId: string,
  requestId: string,
  reviewedByUserId: string,
  reason?: string,
): Promise<void> {
  await updateDoc(
    doc(requireDb(), 'orgs', orgId, 'fixtureRequests', requestId),
    stripUndefined({
      status: 'declined',
      declineReason: reason?.trim() || null,
      reviewedAt: new Date().toISOString(),
      reviewedByUserId,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export type ApproveFixtureResult = {
  ok: true;
  matchId: string;
  sheetRowKey: string;
};

/** Assigner approves via Cloud Function (Sheet append + match create). */
export async function callApproveFixtureRequest(input: {
  orgId?: string;
  requestId: string;
}): Promise<ApproveFixtureResult> {
  const fn = httpsCallable(requireFunctions(), 'approveFixtureRequest');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    requestId: input.requestId,
  });
  return result.data as ApproveFixtureResult;
}
