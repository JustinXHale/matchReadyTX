import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured } from '@/services/firebase';
import {
  type CoachFeedback,
  type CoachFeedbackEdit,
  type CoachFeedbackScaleKey,
  type CoachFeedbackScaleValue,
  type CoachFeedbackStatus,
  COACH_FEEDBACK_SCALE_KEYS,
  normalizeScaleValue,
} from '@/domain/coachFeedback';
import {
  applyLevelCrewDefaultsIfStock,
  applyLevelCrewDefaults,
  matchEligibleForCrewDefaultsReapply,
} from '@/domain/crewDefaults';
import {
  normalizeRequestableSlots,
} from '@/domain/requests';
import { releaseMatch } from '@/domain/matchTransitions';
import {
  type CardReport,
  type CardIncident,
  type CmoReportPayload,
  type CompetitionUnion,
  type MatchReport,
  type MatchReportStatus,
  type MoReportPayload,
  type ArReportPayload,
  type ReportAssigneeSlot,
  type ReportFormKind,
  matchReportDocId,
  buildPendingReport,
} from '@/domain/reports';
import {
  emptyCrew,
  ensureDefaultMoBlock,
  crewPeople,
  newAssignmentId,
  newCmoId,
  type ChangeProposal,
  type CrewAssignment,
  type CmoContact,
  type FixtureRequest,
  type GameRequest,
  type Match,
  type MatchGender,
  type OrgSettings,
  type Team,
  type TeamContactPerson,
  type TeamLinkRequest,
  type RequestableSlot,
} from '@/domain/types';

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
    title:
      typeof data.title === 'string' && data.title.trim()
        ? data.title.trim()
        : undefined,
    matchType:
      typeof data.matchType === 'string' && data.matchType.trim()
        ? data.matchType.trim()
        : undefined,
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

function parseTeamContactPeople(raw: unknown): TeamContactPerson[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const people: TeamContactPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const email = typeof rec.email === 'string' ? rec.email.trim() : '';
    if (!email) continue;
    people.push({
      email,
      name:
        typeof rec.name === 'string' && rec.name.trim()
          ? rec.name.trim()
          : undefined,
      phone:
        typeof rec.phone === 'string' && rec.phone.trim()
          ? rec.phone.trim()
          : undefined,
    });
  }
  return people.length ? people : undefined;
}

export function teamFromFirestore(
  id: string,
  data: Record<string, unknown>,
): Team {
  return {
    id,
    name: String(data.name ?? id),
    competition:
      typeof data.competition === 'string' && data.competition.trim()
        ? data.competition.trim()
        : undefined,
    abbreviation:
      typeof data.abbreviation === 'string' && data.abbreviation.trim()
        ? data.abbreviation.trim()
        : undefined,
    gender: data.gender === 'women' ? 'women' : data.gender === 'men' ? 'men' : undefined,
    address:
      typeof data.address === 'string' && data.address.trim()
        ? data.address.trim()
        : undefined,
    contactEmails: Array.isArray(data.contactEmails)
      ? (data.contactEmails as string[])
      : [],
    contactPhones: Array.isArray(data.contactPhones)
      ? (data.contactPhones as string[])
      : undefined,
    contactPeople: parseTeamContactPeople(data.contactPeople),
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
    defaultCrewByLevel:
      data.defaultCrewByLevel && typeof data.defaultCrewByLevel === 'object'
        ? (data.defaultCrewByLevel as OrgSettings['defaultCrewByLevel'])
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
  teamLinkRequests: TeamLinkRequest[];
  proposals?: ChangeProposal[];
  gameRequests?: GameRequest[];
};

function parseCoachFeedbackScales(
  raw: unknown,
): Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>> =
    {};
  for (const key of COACH_FEEDBACK_SCALE_KEYS) {
    const v = normalizeScaleValue(obj[key]);
    if (v != null) out[key] = v;
  }
  return out;
}

function parseCoachFeedbackEdits(raw: unknown): CoachFeedbackEdit[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachFeedbackEdit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const action = row.action;
    if (action !== 'save' && action !== 'submit' && action !== 'decline') {
      continue;
    }
    if (typeof row.at !== 'string' || typeof row.byUserId !== 'string') {
      continue;
    }
    out.push({
      at: row.at,
      byUserId: row.byUserId,
      byName: typeof row.byName === 'string' ? row.byName : '',
      action,
    });
  }
  return out;
}

function parseCoachFeedbackStatus(raw: unknown): CoachFeedbackStatus {
  if (raw === 'draft' || raw === 'declined' || raw === 'submitted') return raw;
  return 'submitted';
}

export function coachFeedbackFromFirestore(
  id: string,
  data: Record<string, unknown>,
): CoachFeedback | null {
  if (typeof data.matchId !== 'string' || !data.matchId) return null;
  if (typeof data.submitterUserId !== 'string' || !data.submitterUserId) {
    return null;
  }
  if (typeof data.reportingTeamId !== 'string' || !data.reportingTeamId) {
    return null;
  }
  const status = parseCoachFeedbackStatus(data.status);
  const scales = parseCoachFeedbackScales(data.scales);
  return {
    id,
    orgId: typeof data.orgId === 'string' ? data.orgId : '',
    matchId: data.matchId,
    slot: 'mo',
    officialUserId: String(data.officialUserId ?? ''),
    officialName: String(data.officialName ?? ''),
    homeTeamId: String(data.homeTeamId ?? ''),
    homeTeamName: String(data.homeTeamName ?? ''),
    awayTeamId: String(data.awayTeamId ?? ''),
    awayTeamName: String(data.awayTeamName ?? ''),
    kickoffAt: String(data.kickoffAt ?? ''),
    competition:
      typeof data.competition === 'string' ? data.competition : undefined,
    level: String(data.level ?? ''),
    score: String(data.score ?? ''),
    scales,
    commentsOnScores:
      typeof data.commentsOnScores === 'string'
        ? data.commentsOnScores
        : undefined,
    areasDoneWell:
      typeof data.areasDoneWell === 'string' ? data.areasDoneWell : undefined,
    areasToImprove:
      typeof data.areasToImprove === 'string' ? data.areasToImprove : undefined,
    otherFeedback:
      typeof data.otherFeedback === 'string' ? data.otherFeedback : undefined,
    videoLink: typeof data.videoLink === 'string' ? data.videoLink : undefined,
    videoNotes:
      typeof data.videoNotes === 'string' ? data.videoNotes : undefined,
    otherCrewFeedback:
      typeof data.otherCrewFeedback === 'string'
        ? data.otherCrewFeedback
        : undefined,
    submitterUserId: data.submitterUserId,
    submitterName: String(data.submitterName ?? ''),
    submitterEmail: String(data.submitterEmail ?? ''),
    submitterPhone:
      typeof data.submitterPhone === 'string' ? data.submitterPhone : undefined,
    clubRole: String(data.clubRole ?? ''),
    contactAboutReport: data.contactAboutReport === true,
    reportingTeamId: data.reportingTeamId,
    reportingTeamName: String(data.reportingTeamName ?? ''),
    status,
    submittedAt:
      typeof data.submittedAt === 'string' ? data.submittedAt : undefined,
    edits: parseCoachFeedbackEdits(data.edits),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
}

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

export function proposalFromFirestore(
  id: string,
  matchId: string,
  data: Record<string, unknown>,
): ChangeProposal {
  const status =
    data.status === 'rejected_by_other_team' ||
    data.status === 'approved' ||
    data.status === 'withdrawn'
      ? data.status
      : 'pending';
  return {
    id,
    matchId: String(data.matchId ?? matchId),
    proposedByTeamId: String(data.proposedByTeamId ?? ''),
    proposedByUserId:
      typeof data.proposedByUserId === 'string'
        ? data.proposedByUserId
        : undefined,
    proposedByName:
      typeof data.proposedByName === 'string' ? data.proposedByName : undefined,
    kickoffAt:
      typeof data.kickoffAt === 'string' ? data.kickoffAt : undefined,
    venueName:
      typeof data.venueName === 'string' ? data.venueName : undefined,
    venueAddress:
      typeof data.venueAddress === 'string' ? data.venueAddress : undefined,
    previousKickoffAt:
      typeof data.previousKickoffAt === 'string'
        ? data.previousKickoffAt
        : undefined,
    previousVenueName:
      typeof data.previousVenueName === 'string'
        ? data.previousVenueName
        : undefined,
    previousVenueAddress:
      typeof data.previousVenueAddress === 'string'
        ? data.previousVenueAddress
        : undefined,
    status,
    otherTeamAcceptedAt:
      typeof data.otherTeamAcceptedAt === 'string'
        ? data.otherTeamAcceptedAt
        : undefined,
    otherTeamAcceptedByUserId:
      typeof data.otherTeamAcceptedByUserId === 'string'
        ? data.otherTeamAcceptedByUserId
        : undefined,
    otherTeamAcceptedByName:
      typeof data.otherTeamAcceptedByName === 'string'
        ? data.otherTeamAcceptedByName
        : undefined,
    otherTeamDeniedAt:
      typeof data.otherTeamDeniedAt === 'string'
        ? data.otherTeamDeniedAt
        : undefined,
    otherTeamDeniedByUserId:
      typeof data.otherTeamDeniedByUserId === 'string'
        ? data.otherTeamDeniedByUserId
        : undefined,
    otherTeamDeniedByName:
      typeof data.otherTeamDeniedByName === 'string'
        ? data.otherTeamDeniedByName
        : undefined,
    denyReason:
      typeof data.denyReason === 'string' ? data.denyReason : undefined,
    assignerAckAt:
      typeof data.assignerAckAt === 'string' ? data.assignerAckAt : undefined,
    assignerAckByUserId:
      typeof data.assignerAckByUserId === 'string'
        ? data.assignerAckByUserId
        : undefined,
    assignerAckByName:
      typeof data.assignerAckByName === 'string'
        ? data.assignerAckByName
        : undefined,
    createdAt: String(data.createdAt ?? ''),
  };
}

function proposalForFirestore(
  orgId: string,
  proposal: ChangeProposal,
): Record<string, unknown> {
  return stripUndefined({
    orgId,
    matchId: proposal.matchId,
    proposedByTeamId: proposal.proposedByTeamId,
    proposedByUserId: proposal.proposedByUserId ?? null,
    proposedByName: proposal.proposedByName ?? null,
    kickoffAt: proposal.kickoffAt ?? null,
    venueName: proposal.venueName ?? null,
    venueAddress: proposal.venueAddress ?? null,
    previousKickoffAt: proposal.previousKickoffAt ?? null,
    previousVenueName: proposal.previousVenueName ?? null,
    previousVenueAddress: proposal.previousVenueAddress ?? null,
    status: proposal.status,
    otherTeamAcceptedAt: proposal.otherTeamAcceptedAt ?? null,
    otherTeamAcceptedByUserId: proposal.otherTeamAcceptedByUserId ?? null,
    otherTeamAcceptedByName: proposal.otherTeamAcceptedByName ?? null,
    otherTeamDeniedAt: proposal.otherTeamDeniedAt ?? null,
    otherTeamDeniedByUserId: proposal.otherTeamDeniedByUserId ?? null,
    otherTeamDeniedByName: proposal.otherTeamDeniedByName ?? null,
    denyReason: proposal.denyReason ?? null,
    assignerAckAt: proposal.assignerAckAt ?? null,
    assignerAckByUserId: proposal.assignerAckByUserId ?? null,
    assignerAckByName: proposal.assignerAckByName ?? null,
    createdAt: proposal.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

export function gameRequestFromFirestore(
  id: string,
  matchId: string,
  data: Record<string, unknown>,
): GameRequest {
  const rawSlots = data.preferredSlots;
  const preferredSlotsFromArray = Array.isArray(rawSlots)
    ? rawSlots.filter(
        (s): s is RequestableSlot =>
          s === 'mo' ||
          s === 'ar1' ||
          s === 'ar2' ||
          s === 'no4' ||
          s === 'cmo',
      )
    : undefined;
  const preferredSlot = data.preferredSlot;
  const legacySlot =
    preferredSlot === 'mo' ||
    preferredSlot === 'ar1' ||
    preferredSlot === 'ar2' ||
    preferredSlot === 'no4' ||
    preferredSlot === 'cmo'
      ? preferredSlot
      : undefined;
  const preferredSlots = normalizeRequestableSlots(
    preferredSlotsFromArray,
    legacySlot,
  );
  return {
    id,
    matchId,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? ''),
    preferredSlots,
    preferredSlot: legacySlot,
    note: typeof data.note === 'string' ? data.note : undefined,
    status:
      data.status === 'approved' || data.status === 'declined'
        ? data.status
        : 'pending',
    createdAt: String(data.createdAt ?? ''),
    declineReason:
      typeof data.declineReason === 'string' ? data.declineReason : undefined,
  };
}

export function teamLinkRequestFromFirestore(
  id: string,
  data: Record<string, unknown>,
): TeamLinkRequest {
  return {
    id,
    orgId: typeof data.orgId === 'string' ? data.orgId : '',
    requesterUserId: String(data.requesterUserId ?? ''),
    requesterName: String(data.requesterName ?? ''),
    requesterEmail: String(data.requesterEmail ?? ''),
    teamId: String(data.teamId ?? ''),
    teamName: String(data.teamName ?? ''),
    status:
      data.status === 'approved' || data.status === 'denied'
        ? data.status
        : 'pending',
    createdAt: String(data.createdAt ?? ''),
    reviewedAt:
      typeof data.reviewedAt === 'string' ? data.reviewedAt : undefined,
    reviewedByUserId:
      typeof data.reviewedByUserId === 'string'
        ? data.reviewedByUserId
        : undefined,
    denyReason:
      typeof data.denyReason === 'string' ? data.denyReason : undefined,
    autoApproved: Boolean(data.autoApproved),
  };
}

export type LiveOrgSubscribeOpts = {
  viewerUid: string;
  /** Assigner may list all raise-hand requests in the org. */
  isAssigner: boolean;
};

/** Subscribe to org + matches + teams + fixture + team-link + coach feedback. */
export function subscribeLiveOrg(
  orgId: string,
  onData: (snap: LiveOrgSnapshot) => void,
  onError?: (err: Error) => void,
  opts?: LiveOrgSubscribeOpts,
): Unsubscribe {
  const database = requireDb();
  let org: Partial<OrgSettings> & { id: string } = { id: orgId };
  let matches: Match[] = [];
  let teams: Team[] = [];
  let fixtureRequests: FixtureRequest[] = [];
  let teamLinkRequests: TeamLinkRequest[] = [];
  let proposals: ChangeProposal[] = [];
  let gameRequests: GameRequest[] = [];
  let proposalsHydrated = false;
  let gameRequestsHydrated = false;

  const emit = () =>
    onData({
      org,
      matches,
      teams,
      fixtureRequests,
      teamLinkRequests,
      ...(proposalsHydrated ? { proposals } : {}),
      ...(gameRequestsHydrated ? { gameRequests } : {}),
    });

  const onSnapError =
    (label: string) => (err: Error) =>
      onError?.(
        new Error(`${label}: ${err.message}`, { cause: err }),
      );

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
      (err) => onSnapError('org')(err),
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
      (err) => onSnapError('matches')(err),
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
      (err) => onSnapError('teams')(err),
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
      (err) => onSnapError('fixtureRequests')(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(database, 'orgs', orgId, 'teamLinkRequests'),
      (snap) => {
        teamLinkRequests = snap.docs.map((d) =>
          teamLinkRequestFromFirestore(d.id, d.data() as Record<string, unknown>),
        );
        emit();
      },
      (err) => onSnapError('teamLinkRequests')(err),
    ),
  );

  // Collection-group queries must use a composite (orgId + status).
  // Single-field collection-group indexes live on the Single field tab and
  // take longer; Firebase rejected deploying them as composite indexes.
  const proposalsQuery = query(
    collectionGroup(database, 'proposals'),
    where('orgId', '==', orgId),
    where('status', 'in', ['pending', 'approved']),
  );

  unsubs.push(
    onSnapshot(
      proposalsQuery,
      (snap) => {
        proposals = snap.docs.map((d) => {
          const parts = d.ref.path.split('/');
          const matchId = parts[3] ?? '';
          return proposalFromFirestore(
            d.id,
            matchId,
            d.data() as Record<string, unknown>,
          );
        });
        proposalsHydrated = true;
        emit();
      },
      (err) => onSnapError('proposals')(err),
    ),
  );

  if (opts?.viewerUid) {
    const gameRequestsQuery = opts.isAssigner
      ? query(
          collectionGroup(database, 'gameRequests'),
          where('orgId', '==', orgId),
          where('status', '==', 'pending'),
        )
      : query(
          collectionGroup(database, 'gameRequests'),
          where('orgId', '==', orgId),
          where('userId', '==', opts.viewerUid),
        );

    unsubs.push(
      onSnapshot(
        gameRequestsQuery,
        (snap) => {
          gameRequests = snap.docs.map((d) => {
            const parts = d.ref.path.split('/');
            const matchId = parts[3] ?? '';
            return gameRequestFromFirestore(
              d.id,
              matchId,
              d.data() as Record<string, unknown>,
            );
          });
          gameRequestsHydrated = true;
          emit();
        },
        (err) => onSnapError('gameRequests')(err),
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

/** Teams roster for onboarding — readable before profileComplete (see firestore.rules). */
export function subscribeLiveTeams(
  orgId: string,
  onTeams: (teams: Team[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  return onSnapshot(
    collection(database, 'orgs', orgId, 'teams'),
    (snap) => {
      onTeams(
        snap.docs.map((d) =>
          teamFromFirestore(d.id, d.data() as Record<string, unknown>),
        ),
      );
    },
    (err) =>
      onError?.(new Error(`teams: ${err.message}`, { cause: err })),
  );
}

/**
 * Coach feedback is assigner-wide or club-owned (reportingTeamId in member teams).
 * Separate from org schedule so Team Admins do not get a full-collection query denial.
 */
export function subscribeCoachFeedback(
  orgId: string,
  opts: { isGlobal: boolean; teamIds: string[] },
  onData: (feedback: CoachFeedback[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  const col = collection(database, 'orgs', orgId, 'coachFeedback');

  if (opts.isGlobal) {
    return onSnapshot(
      col,
      (snap) => {
        const feedback = snap.docs
          .map((d) =>
            coachFeedbackFromFirestore(d.id, d.data() as Record<string, unknown>),
          )
          .filter((f): f is CoachFeedback => f != null);
        onData(feedback);
      },
      (err) => onError?.(err),
    );
  }

  const teamIds = [...new Set(opts.teamIds.filter(Boolean))].slice(0, 30);
  if (teamIds.length === 0) {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    query(col, where('reportingTeamId', 'in', teamIds)),
    (snap) => {
      const feedback = snap.docs
        .map((d) =>
          coachFeedbackFromFirestore(d.id, d.data() as Record<string, unknown>),
        )
        .filter((f): f is CoachFeedback => f != null);
      onData(feedback);
    },
    (err) => onError?.(err),
  );
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

/** Persist crew defaults and/or match levels (assigner write). */
export async function saveOrgCrewSettings(
  orgId: string,
  patch: Partial<Pick<OrgSettings, 'defaultCrewByLevel' | 'matchLevels'>>,
): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'orgs', orgId),
    { ...patch, updatedAt: new Date().toISOString() },
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

  const orgSnap = await getDoc(doc(database, 'orgs', orgId));
  const defaultCrewByLevel = orgSnap.data()?.defaultCrewByLevel as
    | OrgSettings['defaultCrewByLevel']
    | undefined;

  let batch = writeBatch(database);
  let ops = 0;
  let released = 0;

  for (const m of toRelease) {
    let next = applyLevelCrewDefaultsIfStock(m, defaultCrewByLevel);
    next = releaseMatch(next);
    const ref = doc(database, 'orgs', orgId, 'matches', m.id);
    const crewPatch = crewForFirestore(next.crew);
    batch.set(
      ref,
      stripUndefined({
        status: next.status,
        releasedAt: next.releasedAt ?? null,
        homeConfirmedAt: null,
        awayConfirmedAt: null,
        crew: crewPatch,
        rolesNeeded: next.rolesNeeded ?? null,
        cmo: next.cmo?.length
          ? next.cmo.map((c) => ({
              id: c.id,
              userId: c.userId ?? null,
              userName: c.userName ?? null,
            }))
          : null,
        updatedAt: new Date().toISOString(),
      }),
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

/** Re-apply org crew defaults to matches that still use stock MO-only setup. */
export async function applyCrewDefaultsToStockMatchesInFirestore(
  orgId: string,
  matches: Match[],
  defaultCrewByLevel: OrgSettings['defaultCrewByLevel'],
): Promise<number> {
  const database = requireDb();
  const toUpdate = matches.filter((m) => matchEligibleForCrewDefaultsReapply(m));
  if (toUpdate.length === 0) return 0;

  let batch = writeBatch(database);
  let ops = 0;
  let updated = 0;

  for (const m of toUpdate) {
    const next = applyLevelCrewDefaults(m, defaultCrewByLevel);
    const ref = doc(database, 'orgs', orgId, 'matches', m.id);
    batch.set(
      ref,
      stripUndefined({
        crew: crewForFirestore(next.crew),
        rolesNeeded: next.rolesNeeded ?? null,
        cmo: cmoForFirestore(next.cmo),
        updatedAt: new Date().toISOString(),
      }),
      { merge: true },
    );
    ops += 1;
    updated += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return updated;
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

/** Persist team confirmation timestamps + workflow status (live mode). */
export async function saveMatchTeamConfirmation(
  orgId: string,
  match: Pick<
    Match,
    'id' | 'status' | 'homeConfirmedAt' | 'awayConfirmedAt'
  >,
): Promise<void> {
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'matches', match.id),
    stripUndefined({
      status: match.status,
      homeConfirmedAt: match.homeConfirmedAt ?? null,
      awayConfirmedAt: match.awayConfirmedAt ?? null,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

/** Create a schedule-change proposal under the match. */
export async function createChangeProposalInFirestore(
  orgId: string,
  proposal: ChangeProposal,
): Promise<void> {
  await setDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      proposal.matchId,
      'proposals',
      proposal.id,
    ),
    proposalForFirestore(orgId, proposal),
  );
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'matches', proposal.matchId),
    {
      status: 'change_proposed',
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

/** Patch proposal fields (accept / deny / acknowledge). */
export async function updateChangeProposalInFirestore(
  orgId: string,
  matchId: string,
  proposalId: string,
  patch: Partial<ChangeProposal>,
): Promise<void> {
  const payload = stripUndefined({
    status: patch.status,
    otherTeamAcceptedAt: patch.otherTeamAcceptedAt ?? undefined,
    otherTeamAcceptedByUserId: patch.otherTeamAcceptedByUserId ?? undefined,
    otherTeamAcceptedByName: patch.otherTeamAcceptedByName ?? undefined,
    otherTeamDeniedAt: patch.otherTeamDeniedAt ?? undefined,
    otherTeamDeniedByUserId: patch.otherTeamDeniedByUserId ?? undefined,
    otherTeamDeniedByName: patch.otherTeamDeniedByName ?? undefined,
    denyReason: patch.denyReason ?? undefined,
    assignerAckAt: patch.assignerAckAt ?? undefined,
    assignerAckByUserId: patch.assignerAckByUserId ?? undefined,
    assignerAckByName: patch.assignerAckByName ?? undefined,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      matchId,
      'proposals',
      proposalId,
    ),
    payload,
  );
}

/** Apply accepted proposal facts to the parent match document. */
export async function saveMatchScheduleFacts(
  orgId: string,
  match: Pick<
    Match,
    'id' | 'status' | 'kickoffAt' | 'venueName' | 'venueAddress'
  >,
): Promise<void> {
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'matches', match.id),
    stripUndefined({
      status: match.status,
      kickoffAt: match.kickoffAt,
      venueName: match.venueName,
      venueAddress: match.venueAddress,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

/** Official raises hand for a match (pending assigner review). */
export async function createGameRequestInFirestore(
  orgId: string,
  matchId: string,
  req: GameRequest,
): Promise<void> {
  await setDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      matchId,
      'gameRequests',
      req.id,
    ),
    stripUndefined({
      orgId,
      matchId,
      userId: req.userId,
      userName: req.userName,
      preferredSlots: req.preferredSlots,
      preferredSlot: req.preferredSlots[0] ?? null,
      note: req.note?.trim() || null,
      status: 'pending',
      createdAt: req.createdAt,
      updatedAt: new Date().toISOString(),
    }),
  );
}

/** Assigner approves or declines a raise-hand request. */
export async function updateGameRequestInFirestore(
  orgId: string,
  matchId: string,
  requestId: string,
  patch: {
    status: 'approved' | 'declined';
    declineReason?: string;
  },
): Promise<void> {
  await updateDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      matchId,
      'gameRequests',
      requestId,
    ),
    stripUndefined({
      status: patch.status,
      declineReason: patch.declineReason?.trim() || null,
      updatedAt: new Date().toISOString(),
    }),
  );
}

/** Official updates roles / note on a pending raise-hand. */
export async function patchGameRequestContentInFirestore(
  orgId: string,
  matchId: string,
  requestId: string,
  patch: { preferredSlots: RequestableSlot[]; note?: string },
): Promise<void> {
  const slots = [...new Set(patch.preferredSlots)].filter(Boolean);
  await updateDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      matchId,
      'gameRequests',
      requestId,
    ),
    {
      preferredSlots: slots,
      preferredSlot: slots[0] ?? null,
      note: patch.note?.trim() || null,
      updatedAt: new Date().toISOString(),
    },
  );
}

/** Official withdraws their own pending raise-hand request. */
export async function deleteGameRequestInFirestore(
  orgId: string,
  matchId: string,
  requestId: string,
): Promise<void> {
  await deleteDoc(
    doc(
      requireDb(),
      'orgs',
      orgId,
      'matches',
      matchId,
      'gameRequests',
      requestId,
    ),
  );
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

export type SubmitTeamLinkResult = {
  ok: true;
  autoApproved: string[];
  pending: string[];
};

/** Request Team Admin access for clubs (auto-approve when on Contacts). */
export async function callSubmitTeamLinkRequests(input: {
  orgId?: string;
  teamIds: string[];
}): Promise<SubmitTeamLinkResult> {
  const fn = httpsCallable(requireFunctions(), 'submitTeamLinkRequests');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    teamIds: input.teamIds,
  });
  return result.data as SubmitTeamLinkResult;
}

/** Assigner or Team Admin reviews a club-link request. */
export async function callReviewTeamLinkRequest(input: {
  orgId?: string;
  requestId: string;
  decision: 'approve' | 'deny';
  denyReason?: string;
}): Promise<{ ok: true }> {
  const fn = httpsCallable(requireFunctions(), 'reviewTeamLinkRequest');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    requestId: input.requestId,
    decision: input.decision,
    denyReason: input.denyReason,
  });
  return result.data as { ok: true };
}

export type MatchSelfServiceAction =
  | 'confirm'
  | 'decline'
  | 't72_official_yes'
  | 't72_official_no'
  | 't72_team_yes'
  | 't72_team_no';

/** Official confirm/decline and T-72 — Cloud Function (Admin SDK crew write). */
export async function callMatchSelfService(input: {
  orgId?: string;
  matchId: string;
  action: MatchSelfServiceAction;
  slot?: string;
  assignmentId?: string;
  side?: 'home' | 'away';
  reason?: string;
}): Promise<{ ok: true; status: string }> {
  const fn = httpsCallable(requireFunctions(), 'matchSelfService');
  const result = await fn({
    orgId: input.orgId ?? DEFAULT_ORG,
    matchId: input.matchId,
    action: input.action,
    ...(input.slot ? { slot: input.slot } : {}),
    ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
    ...(input.side ? { side: input.side } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
  return result.data as { ok: true; status: string };
}

/** Create or update Team Admin referee feedback (author only). */
export async function saveCoachFeedbackInFirestore(
  orgId: string,
  feedback: CoachFeedback,
): Promise<void> {
  const payload = stripUndefined({
    id: feedback.id,
    orgId,
    matchId: feedback.matchId,
    slot: 'mo' as const,
    officialUserId: feedback.officialUserId,
    officialName: feedback.officialName,
    homeTeamId: feedback.homeTeamId,
    homeTeamName: feedback.homeTeamName,
    awayTeamId: feedback.awayTeamId,
    awayTeamName: feedback.awayTeamName,
    kickoffAt: feedback.kickoffAt,
    competition: feedback.competition ?? null,
    level: feedback.level,
    score: feedback.score,
    scales: feedback.scales,
    commentsOnScores: feedback.commentsOnScores ?? null,
    areasDoneWell: feedback.areasDoneWell ?? null,
    areasToImprove: feedback.areasToImprove ?? null,
    otherFeedback: feedback.otherFeedback ?? null,
    videoLink: feedback.videoLink ?? null,
    videoNotes: feedback.videoNotes ?? null,
    otherCrewFeedback: feedback.otherCrewFeedback ?? null,
    submitterUserId: feedback.submitterUserId,
    submitterName: feedback.submitterName,
    submitterEmail: feedback.submitterEmail,
    submitterPhone: feedback.submitterPhone ?? null,
    clubRole: feedback.clubRole,
    contactAboutReport: feedback.contactAboutReport === true,
    reportingTeamId: feedback.reportingTeamId,
    reportingTeamName: feedback.reportingTeamName,
    status: feedback.status,
    submittedAt: feedback.submittedAt ?? null,
    edits: feedback.edits,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  });
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'coachFeedback', feedback.id),
    payload,
  );
}

function parseReportAssigneeSlot(raw: unknown): ReportAssigneeSlot | null {
  if (raw === 'mo' || raw === 'ar1' || raw === 'ar2' || raw === 'cmo') return raw;
  return null;
}

function parseReportFormKind(raw: unknown): ReportFormKind | undefined {
  if (
    raw === 'mo_quick' ||
    raw === 'mo_performance' ||
    raw === 'ar_basic' ||
    raw === 'cmo'
  ) {
    return raw;
  }
  return undefined;
}

function parseMatchReportStatus(raw: unknown): MatchReportStatus {
  return raw === 'submitted' ? 'submitted' : 'pending';
}

function parseCardIncidents(raw: unknown): CardIncident[] {
  if (!Array.isArray(raw)) return [];
  const out: CardIncident[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const color = rec.color === 'yellow' || rec.color === 'red' ? rec.color : null;
    const playerName = typeof rec.playerName === 'string' ? rec.playerName : '';
    const teamId = typeof rec.teamId === 'string' ? rec.teamId : '';
    const teamName = typeof rec.teamName === 'string' ? rec.teamName : '';
    const reason = typeof rec.reason === 'string' ? rec.reason : '';
    if (!color || !playerName || !teamId) continue;
    out.push({
      id: typeof rec.id === 'string' ? rec.id : `card_${out.length}`,
      color,
      playerName,
      teamId,
      teamName,
      reason,
      minute: typeof rec.minute === 'string' ? rec.minute : undefined,
      additionalInfoPrivate:
        typeof rec.additionalInfoPrivate === 'string'
          ? rec.additionalInfoPrivate
          : undefined,
    });
  }
  return out;
}

export function matchReportFromFirestore(
  id: string,
  data: Record<string, unknown>,
): MatchReport | null {
  const matchId = typeof data.matchId === 'string' ? data.matchId : '';
  const officialId = typeof data.officialId === 'string' ? data.officialId : '';
  const slot = parseReportAssigneeSlot(data.slot);
  if (!matchId || !officialId || !slot) return null;
  const status = parseMatchReportStatus(data.status);
  const dueAt = typeof data.dueAt === 'string' ? data.dueAt : '';
  const kickoffAt = typeof data.kickoffAt === 'string' ? data.kickoffAt : '';
  if (!dueAt || !kickoffAt) return null;
  return {
    id,
    matchId,
    officialId,
    slot,
    formKind: parseReportFormKind(data.formKind),
    status,
    dueAt,
    deadlineAt:
      typeof data.deadlineAt === 'string' ? data.deadlineAt : undefined,
    kickoffAt,
    submittedAt:
      typeof data.submittedAt === 'string' ? data.submittedAt : undefined,
    subjectOfficialId:
      typeof data.subjectOfficialId === 'string'
        ? data.subjectOfficialId
        : undefined,
    moPayload:
      data.moPayload && typeof data.moPayload === 'object'
        ? (data.moPayload as MoReportPayload)
        : undefined,
    arPayload:
      data.arPayload && typeof data.arPayload === 'object'
        ? (data.arPayload as ArReportPayload)
        : undefined,
    cmoPayload:
      data.cmoPayload && typeof data.cmoPayload === 'object'
        ? (data.cmoPayload as CmoReportPayload)
        : undefined,
  };
}

export function cardReportFromFirestore(
  id: string,
  data: Record<string, unknown>,
): CardReport | null {
  const matchId = typeof data.matchId === 'string' ? data.matchId : '';
  const officialId = typeof data.officialId === 'string' ? data.officialId : '';
  if (!matchId || !officialId) return null;
  const unions: CompetitionUnion[] = [
    'rugby_texas_youth',
    'ncr_lonestar_college',
    'texas_rugby_union_club',
  ];
  const unionRaw = data.competitionUnion;
  const competitionUnion =
    typeof unionRaw === 'string' &&
    unions.includes(unionRaw as CompetitionUnion)
      ? (unionRaw as CompetitionUnion)
      : '';
  const status =
    data.status === 'draft' || data.status === 'submitted' ? data.status : 'submitted';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt : '';
  if (!createdAt) return null;
  return {
    id,
    matchId,
    officialId,
    status,
    competitionUnion,
    officialName: String(data.officialName ?? ''),
    officialEmail: String(data.officialEmail ?? ''),
    officialPhone: String(data.officialPhone ?? ''),
    matchDate: String(data.matchDate ?? ''),
    cards: parseCardIncidents(data.cards),
    additionalInfoPrivate:
      typeof data.additionalInfoPrivate === 'string'
        ? data.additionalInfoPrivate
        : undefined,
    submittedAt:
      typeof data.submittedAt === 'string' ? data.submittedAt : undefined,
    createdAt,
  };
}

function matchReportToFirestore(
  orgId: string,
  report: MatchReport,
): Record<string, unknown> {
  return stripUndefined({
    orgId,
    id: report.id,
    matchId: report.matchId,
    officialId: report.officialId,
    slot: report.slot,
    formKind: report.formKind ?? null,
    status: report.status,
    dueAt: report.dueAt,
    deadlineAt: report.deadlineAt ?? null,
    kickoffAt: report.kickoffAt,
    submittedAt: report.submittedAt ?? null,
    subjectOfficialId: report.subjectOfficialId ?? null,
    moPayload: report.moPayload ?? null,
    arPayload: report.arPayload ?? null,
    cmoPayload: report.cmoPayload ?? null,
    updatedAt: new Date().toISOString(),
    createdAt: report.submittedAt ?? new Date().toISOString(),
  });
}

function cardReportToFirestore(
  orgId: string,
  report: CardReport,
): Record<string, unknown> {
  return stripUndefined({
    orgId,
    id: report.id,
    matchId: report.matchId,
    officialId: report.officialId,
    status: report.status,
    competitionUnion: report.competitionUnion || null,
    officialName: report.officialName,
    officialEmail: report.officialEmail,
    officialPhone: report.officialPhone,
    matchDate: report.matchDate,
    cards: report.cards,
    additionalInfoPrivate: report.additionalInfoPrivate ?? null,
    submittedAt: report.submittedAt ?? null,
    createdAt: report.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

/** Subscribe to match reports (filer + CMO-about-me, or global for assigner/analytics). */
export function subscribeMatchReports(
  orgId: string,
  opts: { isGlobal: boolean; uid: string },
  onData: (reports: MatchReport[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  const col = collection(database, 'orgs', orgId, 'matchReports');

  if (opts.isGlobal) {
    return onSnapshot(
      col,
      (snap) => {
        const reports = snap.docs
          .map((d) =>
            matchReportFromFirestore(d.id, d.data() as Record<string, unknown>),
          )
          .filter((r): r is MatchReport => r != null);
        onData(reports);
      },
      (err) => onError?.(err),
    );
  }

  let filed: MatchReport[] = [];
  let received: MatchReport[] = [];

  const emit = () => {
    const byId = new Map<string, MatchReport>();
    for (const r of [...filed, ...received]) byId.set(r.id, r);
    onData([...byId.values()]);
  };

  const unsubFiled = onSnapshot(
    query(col, where('officialId', '==', opts.uid)),
    (snap) => {
      filed = snap.docs
        .map((d) =>
          matchReportFromFirestore(d.id, d.data() as Record<string, unknown>),
        )
        .filter((r): r is MatchReport => r != null);
      emit();
    },
    (err) => onError?.(err),
  );

  const unsubReceived = onSnapshot(
    query(col, where('subjectOfficialId', '==', opts.uid)),
    (snap) => {
      received = snap.docs
        .map((d) =>
          matchReportFromFirestore(d.id, d.data() as Record<string, unknown>),
        )
        .filter((r): r is MatchReport => r != null);
      emit();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubFiled();
    unsubReceived();
  };
}

export function subscribeCardReports(
  orgId: string,
  opts: { isGlobal: boolean; uid: string },
  onData: (reports: CardReport[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const database = requireDb();
  const col = collection(database, 'orgs', orgId, 'cardReports');

  if (opts.isGlobal) {
    return onSnapshot(
      col,
      (snap) => {
        const reports = snap.docs
          .map((d) =>
            cardReportFromFirestore(d.id, d.data() as Record<string, unknown>),
          )
          .filter((r): r is CardReport => r != null);
        onData(reports);
      },
      (err) => onError?.(err),
    );
  }

  return onSnapshot(
    query(col, where('officialId', '==', opts.uid)),
    (snap) => {
      const reports = snap.docs
        .map((d) =>
          cardReportFromFirestore(d.id, d.data() as Record<string, unknown>),
        )
        .filter((r): r is CardReport => r != null);
      onData(reports);
    },
    (err) => onError?.(err),
  );
}

export async function saveMatchReportInFirestore(
  orgId: string,
  report: MatchReport,
): Promise<void> {
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'matchReports', report.id),
    matchReportToFirestore(orgId, report),
  );
}

export async function saveCardReportInFirestore(
  orgId: string,
  report: CardReport,
): Promise<void> {
  await setDoc(
    doc(requireDb(), 'orgs', orgId, 'cardReports', report.id),
    cardReportToFirestore(orgId, report),
  );
}

/** Lazy-create a pending match report doc when the official opens the flow. */
export async function ensurePendingMatchReportInFirestore(
  orgId: string,
  match: Match,
  assignee: { userId: string; slot: ReportAssigneeSlot },
): Promise<MatchReport> {
  const id = matchReportDocId(match.id, assignee.userId, assignee.slot);
  const ref = doc(requireDb(), 'orgs', orgId, 'matchReports', id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const parsed = matchReportFromFirestore(
      id,
      snap.data() as Record<string, unknown>,
    );
    if (parsed) return parsed;
  }
  const pending = buildPendingReport(match, assignee, () => id);
  await setDoc(ref, matchReportToFirestore(orgId, pending));
  return pending;
}

/** MO user id on a match (first MO block with a user). */
export function moOfficialIdOnMatch(match: Match): string | undefined {
  for (const a of crewPeople(match.crew.mo)) {
    if (a.userId) return a.userId;
  }
  return undefined;
}
