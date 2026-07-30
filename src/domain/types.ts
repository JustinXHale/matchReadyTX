/** Domain types for MatchReadyTX — see docs/IMPLEMENTATION_SPEC.md */

export type Role = 'assigner' | 'teamAdmin' | 'official' | 'cmo' | 'fan';

export type CrewSlot = 'mo' | 'ar1' | 'ar2' | 'no4';

/** Positions an official can raise their hand for (includes CMO). */
export type RequestableSlot = CrewSlot | 'cmo';

export type MatchStatus =
  | 'draft'
  | 'pending_team_review'
  | 'change_proposed'
  | 'team_confirmed'
  | 'crew_pending'
  | 'mo_confirmed'
  | 'crew_confirmed'
  | 't72_team_pending'
  | 't72_officials_pending'
  | 'locked_confirmed'
  | 'needs_reconfirmation'
  | 'needs_reassignment'
  | 'cancelled'
  | 'postponed';

export type CrewSlotStatus =
  | 'empty'
  | 'pending_internal'
  | 'official'
  | 'confirmed'
  | 'held'
  | 'declined'
  | 'released';

export type ProposalStatus =
  | 'pending'
  | 'rejected_by_other_team'
  | 'approved'
  | 'withdrawn';

export type GameRequestStatus = 'pending' | 'approved' | 'declined';

export type HistoryAction =
  | 'assigned'
  | 'confirmed'
  | 'unavailable_on_change'
  | 'declined'
  | 'released'
  | 'reassigned'
  | 'assigned_via_request'
  | 't72_no';

export interface HistoryEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: HistoryAction;
  reason?: string;
}

export interface CrewAssignment {
  /** Stable id for confirm / remove / email (e.g. ca_…). */
  id: string;
  slot: CrewSlot;
  userId?: string;
  userName?: string;
  status: CrewSlotStatus;
  confirmedAt?: string;
  history: HistoryEntry[];
}

export type CmoContact = {
  /** Stable id for empty-block remove / fill targeting. */
  id?: string;
  userId?: string;
  userName?: string;
};

export interface FeeTable {
  mo: number;
  ar1: number;
  ar2: number;
  no4: number;
  /** Optional CMO stipend when the match includes a CMO role. */
  cmo?: number;
}

export interface Match {
  id: string;
  sheetRowKey: string;
  status: MatchStatus;
  kickoffAt: string;
  venueName: string;
  venueAddress: string;
  venueLat?: number;
  venueLng?: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  competition?: string;
  /** Competition level — defaults from org.matchLevels (e.g. D1, D2, D3) */
  level: string;
  /** Side / gender division */
  gender: MatchGender;
  notes?: string;
  /** Coaching Match Officials — contact/presence; not fee crew slots. */
  cmo?: CmoContact[];
  /**
   * Role types this match uses (fees + raise-hand options).
   * Defaults to MO only when omitted; assigner adds AR / No.4 / CMO.
   */
  rolesNeeded?: RequestableSlot[];
  flightProvided: boolean;
  housingProvided: boolean;
  feeOverride?: Partial<FeeTable>;
  homeConfirmedAt?: string;
  awayConfirmedAt?: string;
  t72TeamHome?: 'yes' | 'no';
  t72TeamAway?: 'yes' | 'no';
  releasedAt?: string;
  cancelledAt?: string;
  postponedAt?: string;
  /** 0..N people per role (tournaments may assign several MOs, ARs, etc.). */
  crew: Record<CrewSlot, CrewAssignment[]>;
  /** Final score when reported (from match report). */
  homeScore?: number;
  awayScore?: number;
}

export type MatchGender = 'men' | 'women';

export const DEFAULT_MATCH_LEVELS = [
  'D1',
  'D2',
  'D3',
  'Exhibition',
  'Tourney',
] as const;

export const DEFAULT_COMPETITIONS = [
  'Lonestar Women',
  'Lonestar Men',
] as const;

export interface ChangeProposal {
  id: string;
  matchId: string;
  proposedByTeamId: string;
  proposedByUserId?: string;
  proposedByName?: string;
  kickoffAt?: string;
  venueName?: string;
  venueAddress?: string;
  /** Snapshot of schedule facts when the proposal was created (compare UI). */
  previousKickoffAt?: string;
  previousVenueName?: string;
  previousVenueAddress?: string;
  status: ProposalStatus;
  otherTeamAcceptedAt?: string;
  otherTeamAcceptedByUserId?: string;
  otherTeamAcceptedByName?: string;
  otherTeamDeniedAt?: string;
  otherTeamDeniedByUserId?: string;
  otherTeamDeniedByName?: string;
  /** Required when the other team denies. */
  denyReason?: string;
  assignerAckAt?: string;
  assignerAckByUserId?: string;
  assignerAckByName?: string;
  createdAt: string;
}

export interface GameRequest {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  preferredSlot?: RequestableSlot; // required when submitting a raise-hand request
  note?: string;
  status: GameRequestStatus;
  createdAt: string;
  declineReason?: string;
}

/** Per-team request to become Team Admin for a club side. */
export type TeamLinkRequestStatus = 'pending' | 'approved' | 'denied';

export interface TeamLinkRequest {
  id: string;
  orgId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  teamId: string;
  teamName: string;
  status: TeamLinkRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  denyReason?: string;
  autoApproved?: boolean;
}

/** Team Admin request for a new fixture (not official raise-hand). */
export type FixtureRequestStatus = 'pending' | 'approved' | 'declined';

export interface FixtureRequest {
  id: string;
  orgId: string;
  requesterUserId: string;
  requesterName: string;
  requesterTeamId: string;
  /** Requester's side on the fixture. */
  side: 'home' | 'away';
  opponentTeamId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  venueName: string;
  venueAddress: string;
  competition?: string;
  level: string;
  gender: MatchGender;
  notes?: string;
  flightProvided: boolean;
  housingProvided: boolean;
  status: FixtureRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  declineReason?: string;
  /** Set when approved — Firestore / sheet match id. */
  matchId?: string;
  sheetRowKey?: string;
}

export interface AvailabilityRange {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  kind: 'available' | 'blocked';
}

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  /** Nickname / preferred name — used in displayName when set. */
  preferredName?: string;
  /** Derived join of first (or preferred) + last for crews / history UI. */
  displayName: string;
  email: string;
  phone: string;
  /** Explicit Yes/No — required; SMS only when true */
  smsOptIn: boolean | null;
  /** Street line (number + street). */
  homeStreet: string;
  /** Apt / suite / unit — optional. */
  homeUnit?: string;
  homeCity: string;
  /** State / region (e.g. TX). */
  homeRegion: string;
  homePostalCode: string;
  /**
   * Full mailing line composed from structured fields (geocode / display).
   * Prefer structured fields as source of truth.
   */
  homeAddress: string;
  homeLat?: number;
  homeLng?: number;
  roles: Role[];
  teamIds: string[];
  /**
   * Favorite club for Fan lens schedule filters. Empty / omit = general society fan
   * (or free-text via fanTeamOther). At most one id — single selection in UI.
   * Not the same as teamIds (Team Admin club ownership).
   */
  fanTeamIds?: string[];
  /** When the fan picks “Other” instead of a listed club. */
  fanTeamOther?: string;
  profileComplete: boolean;
  /** Org membership join time (ISO), from orgs/.../members/{uid}.joinedAt. */
  joinedAt?: string;
  /** Society referee grade (e.g. 5). Optional — officials may choose “I don’t know”. */
  refereeLevel?: number;
  /**
   * CMO/society-assessed grade — true level independent of self-reported refereeLevel.
   * Officials see this read-only on Profile; Schedulers can set it on member detail.
   */
  assessedLevel?: number;
  /**
   * Competitions this user may manage as assigner. Omit/empty = all org competitions.
   * Used for future delegate scoping; sole assigners leave unset.
   */
  competitionAccess?: string[];
  /** Year started refereeing, e.g. "2018" (officials / CMOs). */
  refereeingSince?: string;
  /** ISO date of birth. */
  birthday?: string;
  /** Kit size — jersey (e.g. M, L). */
  jerseySize?: string;
  /** Kit size — shorts (e.g. M, L). */
  shortsSize?: string;
  /** Optional profile photo (demo: data URL; prod: Storage URL). */
  photoUrl?: string;
}

/** Common apparel sizes for jersey / shorts. */
export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type ApparelSize = (typeof APPAREL_SIZES)[number];

/** Roles that unlock the Referee/CMO app lens (Q-R6). */
export function hasRefereeLensRole(roles: Role[]): boolean {
  return roles.includes('official') || roles.includes('cmo');
}

export function displayNameFromParts(
  firstName: string,
  lastName: string,
): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export interface OrgSettings {
  id: string;
  name: string;
  timezone: string;
  mileageRatePerMile: number;
  mileageMinMiles: number;
  defaultFees: FeeTable;
  /** Admin-managed level options; defaults D1/D2/D3/Exhibition/Tourney */
  matchLevels: string[];
  /** Admin-managed competition list (e.g. Lonestar Women / Lonestar Men). */
  competitions: string[];
  sheetId?: string;
  sheetSyncedAt?: string;
  /** Last failed auto/manual Sheet sync or write-back (cleared on success). */
  sheetSyncError?: string;
}

export interface Team {
  id: string;
  name: string;
  contactEmails: string[];
  contactPhones?: string[];
}

export interface NotificationLogEntry {
  id: string;
  at: string;
  channel: 'email' | 'sms';
  to: string;
  subject: string;
  body: string;
  event: string;
}

export const CREW_SLOTS: CrewSlot[] = ['mo', 'ar1', 'ar2', 'no4'];

export const CREW_SLOT_LABELS: Record<CrewSlot, string> = {
  mo: 'Match Official',
  ar1: 'Assistant Referee 1',
  ar2: 'Assistant Referee 2',
  no4: 'Number 4',
};

export const REQUESTABLE_SLOTS: RequestableSlot[] = [
  'mo',
  'ar1',
  'ar2',
  'no4',
  'cmo',
];

export const REQUESTABLE_SLOT_LABELS: Record<RequestableSlot, string> = {
  ...CREW_SLOT_LABELS,
  cmo: 'CMO',
};

/** Short labels for raise-hand chips and fee rows. */
export const REQUESTABLE_SLOT_SHORT: Record<RequestableSlot, string> = {
  mo: 'MO',
  ar1: 'AR1',
  ar2: 'AR2',
  no4: '#4',
  cmo: 'CMO',
};

export function isCrewSlot(slot: RequestableSlot): slot is CrewSlot {
  return slot !== 'cmo';
}

export function rolesNeededForMatch(match: Match): RequestableSlot[] {
  const seen = new Set<RequestableSlot>(
    match.rolesNeeded?.length ? match.rolesNeeded : ['mo'],
  );
  // Keep role types that have open or filled blocks.
  for (const slot of CREW_SLOTS) {
    if (crewBlocks(match.crew[slot]).length > 0) seen.add(slot);
  }
  if ((match.cmo ?? []).length > 0) seen.add('cmo');
  return REQUESTABLE_SLOTS.filter((r) => seen.has(r));
}

export function emptyAssignment(slot: CrewSlot): CrewAssignment {
  return {
    id: newAssignmentId(),
    slot,
    status: 'empty',
    history: [],
  };
}

/** Default crew: one open MO block. */
export function emptyCrew(): Record<CrewSlot, CrewAssignment[]> {
  return {
    mo: [emptyAssignment('mo')],
    ar1: [],
    ar2: [],
    no4: [],
  };
}

/** Open + filled blocks (capacity rows). Excludes released audit stubs. */
export function crewBlocks(
  list: CrewAssignment[] | undefined,
): CrewAssignment[] {
  if (!list?.length) return [];
  return list.filter(
    (a) => a.status === 'empty' || Boolean(a.userId),
  );
}

/** Assignees that currently hold a person. */
export function crewPeople(list: CrewAssignment[] | undefined): CrewAssignment[] {
  if (!list?.length) return [];
  return list.filter((a) => Boolean(a.userId));
}

/** Empty (unfilled) capacity blocks for a fee role. */
export function emptyCrewBlocks(
  list: CrewAssignment[] | undefined,
): CrewAssignment[] {
  return crewBlocks(list).filter((a) => !a.userId && a.status === 'empty');
}

export function newAssignmentId(): string {
  return `ca_${Math.random().toString(36).slice(2, 10)}`;
}

export function newCmoId(): string {
  return `cmo_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyCmoContact(): CmoContact {
  return { id: newCmoId() };
}

/** Ensure MO has at least one open/filled block when the match uses MO. */
export function ensureDefaultMoBlock(
  crew: Record<CrewSlot, CrewAssignment[]>,
): Record<CrewSlot, CrewAssignment[]> {
  if (crewBlocks(crew.mo).length > 0) return crew;
  return { ...crew, mo: [emptyAssignment('mo')] };
}

/** Find which fee/CMO role a user holds on this match (first hit). */
export function assignmentForUser(
  match: Match,
  userId: string,
): { slot: RequestableSlot; assignment?: CrewAssignment } | null {
  for (const slot of CREW_SLOTS) {
    const a = match.crew[slot]?.find((x) => x.userId === userId);
    if (a) return { slot, assignment: a };
  }
  if ((match.cmo ?? []).some((c) => c.userId === userId)) {
    return { slot: 'cmo' };
  }
  return null;
}

/** Teams see crew when any MO has confirmed. */
export function isCrewVisibleToTeams(match: Match): boolean {
  return crewPeople(match.crew.mo).some((a) => a.status === 'confirmed');
}

export function bothTeamsConfirmed(match: Match): boolean {
  return Boolean(match.homeConfirmedAt && match.awayConfirmedAt);
}

/** Named crew slots that still need at least one official to confirm. */
export function assignedCrewStillPending(match: Match): boolean {
  return CREW_SLOTS.some((slot) =>
    crewPeople(match.crew[slot]).some((a) => {
      if (
        a.status === 'empty' ||
        a.status === 'declined' ||
        a.status === 'released'
      ) {
        return false;
      }
      return a.status !== 'confirmed';
    }),
  );
}

/**
 * True when home + away details are confirmed and every assigned official
 * has confirmed (no open change / reconfirm state). At least one MO confirmed.
 */
export function allPartiesConfirmed(match: Match): boolean {
  if (
    match.status === 'change_proposed' ||
    match.status === 'needs_reconfirmation'
  ) {
    return false;
  }
  if (!bothTeamsConfirmed(match)) return false;
  if (!isCrewVisibleToTeams(match)) return false;
  if (assignedCrewStillPending(match)) return false;
  return true;
}

export type TeamAdminListStatus = {
  /** Card / pill emphasis. */
  tone: 'urgent' | 'warn' | 'none';
  /** Pill label; null means show crew column instead. */
  label: string | null;
  /** Still in the “needs attention” bucket (not fully settled). */
  actionNeeded: boolean;
};

/**
 * Team Admin list trailing status.
 * Red: change proposed or teams still need to confirm.
 * Yellow: both teams confirmed, waiting on referee crew.
 */
export function teamAdminListStatus(
  match: Match,
  hasPendingProposal = false,
): TeamAdminListStatus {
  if (hasPendingProposal) {
    return {
      tone: 'urgent',
      label: 'Change Proposed',
      actionNeeded: true,
    };
  }
  if (
    match.status === 'needs_reconfirmation' ||
    match.status === 'change_proposed' ||
    !bothTeamsConfirmed(match)
  ) {
    return { tone: 'urgent', label: 'Needs confirm', actionNeeded: true };
  }
  if (!allPartiesConfirmed(match)) {
    return {
      tone: 'warn',
      label: 'Waiting on Referee Confirmation',
      actionNeeded: true,
    };
  }
  return { tone: 'none', label: null, actionNeeded: false };
}

/**
 * Team-facing crew shape before MO unlock — roles + status, never names.
 * Single MO-only match → "Single referee"; otherwise lists needed slots.
 */
export function teamFacingCrewShapeLabel(match: Match): string {
  const roles = rolesNeededForMatch(match);
  if (roles.length === 1 && roles[0] === 'mo') {
    return 'Single referee';
  }
  return `Crew · ${roles.map((r) => REQUESTABLE_SLOT_SHORT[r]).join(' · ')}`;
}

/** Aggregate fill for a role with 0..N people (team-facing, no names). */
export function teamFacingCrewRoleFill(list: CrewAssignment[]): {
  fill: string;
  status: string;
} {
  const people = crewPeople(list);
  if (people.length === 0) return { fill: 'Open', status: 'Open' };
  if (people.every((a) => a.status === 'confirmed')) {
    return {
      fill: people.length === 1 ? 'Confirmed' : `${people.length} confirmed`,
      status: 'Confirmed',
    };
  }
  if (people.some((a) => a.status === 'held')) {
    return {
      fill: people.length === 1 ? 'Assigned' : `${people.length} assigned`,
      status: 'Needs reconfirm',
    };
  }
  if (people.some((a) => a.status === 'official')) {
    return {
      fill: people.length === 1 ? 'Assigned' : `${people.length} assigned`,
      status: 'Awaiting confirmation',
    };
  }
  return {
    fill: people.length === 1 ? 'Assigned' : `${people.length} assigned`,
    status: 'Not notified yet',
  };
}

/** @deprecated Prefer teamFacingCrewRoleFill for multi-person roles. */
export function teamFacingCrewSlotFill(assignment: CrewAssignment): {
  fill: string;
  status: string;
} {
  return teamFacingCrewRoleFill(assignment.userId ? [assignment] : []);
}

export function teamFacingCmoFill(match: Match): {
  fill: string;
  status: string;
} {
  const n = (match.cmo ?? []).filter((c) => c.userId).length;
  if (n === 0) return { fill: 'Open', status: 'Open' };
  return {
    fill: n === 1 ? 'Assigned' : `${n} assigned`,
    status: 'Assigned',
  };
}

export function crewSlotStatusLabel(status: CrewSlotStatus): string {
  const map: Record<CrewSlotStatus, string> = {
    empty: 'Open',
    pending_internal: 'Pending (not notified)',
    official: 'Assigned — confirm',
    confirmed: 'Confirmed',
    held: 'Held — reconfirm',
    declined: 'Declined',
    released: 'Released',
  };
  return map[status];
}

export function genderLabel(gender: MatchGender): string {
  return gender === 'men' ? 'Men' : 'Women';
}
