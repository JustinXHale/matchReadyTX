import { csvRowToKickoffIso, parseScheduleCsv, type CsvMatchRow } from '@/domain/csvImport';
import {
  assignOfficial,
  confirmOfficialSlot,
  markUnavailableAndRelease,
} from '@/domain/crew';
import {
  withCrewBlockRemoved,
  withCrewRoleAdded,
} from '@/domain/crewSize';
import {
  applyLevelCrewDefaults,
  applyLevelCrewDefaultsIfStock,
  matchEligibleForCrewDefaultsReapply,
  type DefaultCrewByLevel,
} from '@/domain/crewDefaults';
import { defaultFees, demoGeocode } from '@/domain/economics';
import {
  applySheetFacts,
  applyT72Team,
  beginChangeProposed,
  cancelMatch,
  setTeamDetailsConfirmed as applyTeamDetailsConfirmed,
  enterT72,
  postponeMatch,
  releaseMatch,
} from '@/domain/matchTransitions';
import {
  applyContactRowsToTeams,
  linkTeamAdminsByEmail,
  type ContactRow,
} from '@/domain/contacts';
import { competitionForGender } from '@/domain/competitions';
import {
  isProfileComplete,
  syncDisplayName,
  syncHomeAddressLine,
} from '@/domain/profile';
import {
  type ArReportPayload,
  type CardReport,
  type CmoReportPayload,
  type MatchReport,
  type MoReportPayload,
  type ReportFormKind,
  syncPendingMatchReports,
} from '@/domain/reports';
import { matchFromFixtureRequest, newAppMatchId } from '@/domain/fixtureRequests';
import {
  coachFeedbackDocId,
  type CoachFeedback,
  type CoachFeedbackScaleKey,
  type CoachFeedbackScaleValue,
} from '@/domain/coachFeedback';
import type {
  AvailabilityRange,
  ChangeProposal,
  CrewAssignment,
  CrewSlot,
  FixtureRequest,
  GameRequest,
  Match,
  MatchGender,
  NotificationLogEntry,
  OrgSettings,
  RequestableSlot,
  Team,
  TeamLinkRequest,
  UserProfile,
} from '@/domain/types';
import {
  DEFAULT_COMPETITIONS,
  DEFAULT_MATCH_LEVELS,
  crewPeople,
  emptyAssignment,
  emptyCrew,
  hasRefereeLensRole,
  isCrewVisibleToTeams,
  newAssignmentId,
  newCmoId,
} from '@/domain/types';
import {
  emailMatchesTeamContacts,
  rolesAfterTeamLinkDenial,
} from '@/domain/teamLinkRequests';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callProposalWriteback,
  createChangeProposalInFirestore,
  defaultOrgId,
  saveMatchTeamConfirmation,
  updateChangeProposalInFirestore,
} from '@/services/orgData';

function isLiveDataMode(): boolean {
  if (!isFirebaseConfigured) return false;
  try {
    return sessionStorage.getItem('rs-data-mode') !== 'demo';
  } catch {
    return true;
  }
}

/** Urgent assigner → official alert shown atop Request → Pending. */
export interface OfficialAlert {
  id: string;
  userId: string; // uid or '*' for all officials
  title: string;
  body: string;
  matchId?: string;
  createdAt: string;
}

/** Legacy society coaching notes on an official (Raise Hand profile). */
export interface CoachingReportStub {
  id: string;
  officialId: string;
  title: string;
  summary: string;
  status: 'on_file' | 'missing';
  createdAt: string;
}

function normalizeGender(
  raw: string | undefined,
  fallback: MatchGender,
): MatchGender {
  if (!raw) return fallback;
  const g = raw.trim().toLowerCase();
  if (g === 'women' || g === 'womens' || g === 'w' || g === 'female') return 'women';
  if (g === 'men' || g === 'mens' || g === 'm' || g === 'male') return 'men';
  return fallback;
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function withHome(
  street: string,
  city: string,
  region: string,
  postal: string,
  unit?: string,
): Pick<
  UserProfile,
  | 'homeStreet'
  | 'homeUnit'
  | 'homeCity'
  | 'homeRegion'
  | 'homePostalCode'
  | 'homeAddress'
> {
  const parts = {
    homeStreet: street,
    homeUnit: unit,
    homeCity: city,
    homeRegion: region,
    homePostalCode: postal,
    homeAddress: '',
  };
  return syncHomeAddressLine(parts);
}

function seedUsers(): UserProfile[] {
  return [
    {
      uid: 'u_assigner',
      firstName: 'Alex',
      lastName: 'Assigner',
      displayName: 'Alex Assigner',
      email: 'assigner@example.com',
      phone: '+15551110001',
      smsOptIn: true,
      ...withHome('1200 Barton Springs Rd', 'Austin', 'TX', '78704'),
      homeLat: 30.2672,
      homeLng: -97.7431,
      // One demo persona covers Scheduler, Referee/CMO, and Team Admin lenses
      // with multiple club sides (1sts + 2nds).
      roles: ['assigner', 'official', 'teamAdmin'],
      teamIds: ['team_austin', 'team_austin_2nds'],
      profileComplete: true,
      birthday: '1988-04-12',
      refereeLevel: 4,
      assessedLevel: 4,
      refereeingSince: '2015',
      jerseySize: 'L',
      shortsSize: 'L',
    },
    {
      uid: 'u_home',
      firstName: 'Austin',
      lastName: 'Admin',
      displayName: 'Austin Admin',
      email: 'austin-admin@example.com',
      phone: '+15551110002',
      smsOptIn: false,
      ...withHome('500 W 2nd St', 'Austin', 'TX', '78701', 'Suite 200'),
      homeLat: 30.2672,
      homeLng: -97.7431,
      roles: ['teamAdmin'],
      teamIds: ['team_austin', 'team_austin_2nds'],
      profileComplete: true,
      birthday: '1985-09-02',
    },
    {
      uid: 'u_away',
      firstName: 'Dallas',
      lastName: 'Admin',
      displayName: 'Dallas Admin',
      email: 'dallas-admin@example.com',
      phone: '+15551110003',
      smsOptIn: true,
      ...withHome('1700 Pacific Ave', 'Dallas', 'TX', '75201'),
      homeLat: 32.7767,
      homeLng: -96.797,
      roles: ['teamAdmin'],
      teamIds: ['team_dallas'],
      profileComplete: true,
      birthday: '1990-01-20',
    },
    {
      uid: 'u_ref1',
      firstName: 'Riley',
      lastName: 'Official',
      displayName: 'Riley Official',
      email: 'riley@example.com',
      phone: '+15551110004',
      smsOptIn: true,
      ...withHome('2200 S Lamar Blvd', 'Austin', 'TX', '78704', 'Apt 3B'),
      homeLat: 30.2672,
      homeLng: -97.7431,
      roles: ['official'],
      teamIds: [],
      profileComplete: true,
      birthday: '1992-07-08',
      refereeLevel: 5,
      assessedLevel: 4,
      refereeingSince: '2018',
      jerseySize: 'M',
      shortsSize: 'M',
    },
    {
      // Second official stays in the roster for assign demos; not a separate role.
      uid: 'u_ref2',
      firstName: 'Casey',
      lastName: 'Official',
      displayName: 'Casey Official',
      email: 'casey@example.com',
      phone: '+15551110005',
      smsOptIn: false,
      ...withHome('1001 Fannin St', 'Houston', 'TX', '77002'),
      homeLat: 29.7604,
      homeLng: -95.3698,
      roles: ['official', 'cmo'],
      teamIds: [],
      profileComplete: true,
      birthday: '1995-11-30',
      refereeLevel: 3,
      refereeingSince: '2020',
      jerseySize: 'L',
      shortsSize: 'M',
    },
    incompleteOnboardingDemoUser(),
  ];
}

/** Fresh persona for walking the onboarding wizard in demo mode. */
export function incompleteOnboardingDemoUser(): UserProfile {
  return {
    uid: 'u_new',
    firstName: '',
    lastName: '',
    displayName: '',
    email: 'jamie.new@example.com',
    phone: '',
    smsOptIn: null,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles: [],
    teamIds: [],
    profileComplete: false,
  };
}

function seedTeams(): Team[] {
  return [
    {
      id: 'team_austin',
      name: 'Austin Rugby Football Club',
      abbreviation: 'AUS',
      gender: 'men',
      address: 'Westlake Fields, Austin, TX',
      contactEmails: ['austin-admin@example.com', 'assigner@example.com'],
      contactPhones: ['+15551110002'],
    },
    {
      id: 'team_austin_2nds',
      name: 'Austin Rugby Football Club 2nds',
      abbreviation: 'AUS 2',
      gender: 'men',
      address: 'Westlake Fields, Austin, TX',
      contactEmails: ['austin-admin@example.com', 'assigner@example.com'],
      contactPhones: ['+15551110002'],
    },
    {
      id: 'team_dallas',
      name: 'Dallas Rugby Football Club',
      abbreviation: 'DAL',
      gender: 'men',
      address: 'Dallas Rugby Grounds, Dallas, TX',
      contactEmails: ['dallas-admin@example.com'],
      contactPhones: ['+15551110003'],
    },
    {
      id: 'team_houston',
      name: 'Houston Athletic Rugby Club',
      abbreviation: 'HOU',
      gender: 'men',
      address: 'Memorial Park, Houston, TX',
      contactEmails: ['houston@example.com'],
      contactPhones: ['+15551110006'],
    },
  ];
}

function seedMatches(): Match[] {
  const austin = demoGeocode('Austin, TX');
  const dallas = demoGeocode('Dallas, TX');
  const houston = demoGeocode('Houston, TX');

  const kickAt = (daysFromNow: number, hour: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const released = new Date().toISOString();

  type Person =
    | 'alex'
    | 'riley'
    | 'casey'
    | 'none'
    | 'pending-alex'
    | 'pending-riley'
    | 'pending-casey';

  const roster = {
    alex: { userId: 'u_assigner', userName: 'Alex Assigner' },
    riley: { userId: 'u_ref1', userName: 'Riley Official' },
    casey: { userId: 'u_ref2', userName: 'Casey Official' },
  } as const;

  const slotPerson = (
    slot: CrewSlot,
    who: Person,
  ): CrewAssignment[] => {
    if (who === 'none') return [];
    const person =
      who === 'pending-alex' || who === 'alex'
        ? roster.alex
        : who === 'pending-riley' || who === 'riley'
          ? roster.riley
          : roster.casey;
    const pending =
      who === 'pending-alex' ||
      who === 'pending-riley' ||
      who === 'pending-casey';
    return [
      {
        id: newAssignmentId(),
        slot,
        ...person,
        status: pending ? 'official' : 'confirmed',
        confirmedAt: pending ? undefined : released,
        history: [],
      },
    ];
  };

  const buildCrew = (parts: {
    mo: Person;
    ar1: Person;
    ar2: Person;
    no4?: Person;
  }): Match['crew'] => ({
    mo: slotPerson('mo', parts.mo),
    ar1: slotPerson('ar1', parts.ar1),
    ar2: slotPerson('ar2', parts.ar2),
    no4: slotPerson('no4', parts.no4 ?? 'none'),
  });

  const fixtures: Array<{
    id: string;
    days: number;
    hour: number;
    venueName: string;
    venueAddress: string;
    lat: number;
    lng: number;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    level: string;
    gender: MatchGender;
    crew: { mo: Person; ar1: Person; ar2: Person; no4?: Person };
    status?: Match['status'];
  }> = [
    {
      id: 'm_a01',
      days: 2,
      hour: 11,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Dallas RFC',
      level: 'D1',
      gender: 'men',
      crew: { mo: 'alex', ar1: 'riley', ar2: 'casey' },
    },
    {
      id: 'm_a02',
      days: 2,
      hour: 14,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_houston',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Houston Athletic',
      level: 'D2',
      gender: 'women',
      crew: { mo: 'alex', ar1: 'pending-riley', ar2: 'none' },
    },
    {
      id: 'm_a02b',
      days: 3,
      hour: 15,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
      homeTeamId: 'team_houston',
      awayTeamId: 'team_austin',
      homeTeamName: 'Houston Athletic',
      awayTeamName: 'Austin RFC',
      level: 'D1',
      gender: 'men',
      // Alex as MO — assigned, not yet accepted
      crew: { mo: 'pending-alex', ar1: 'riley', ar2: 'none' },
    },
    {
      id: 'm_a03',
      days: 5,
      hour: 13,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
      homeTeamId: 'team_dallas',
      awayTeamId: 'team_austin',
      homeTeamName: 'Dallas RFC',
      awayTeamName: 'Austin RFC',
      level: 'D1',
      gender: 'men',
      // Alex as AR1
      crew: { mo: 'riley', ar1: 'alex', ar2: 'casey' },
    },
    {
      id: 'm_a04',
      days: 7,
      hour: 10,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
      homeTeamId: 'team_houston',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Houston Athletic',
      awayTeamName: 'Dallas RFC',
      level: 'D3',
      gender: 'men',
      // Alex as AR2
      crew: { mo: 'riley', ar1: 'casey', ar2: 'alex' },
    },
    {
      id: 'm_a05',
      days: 9,
      hour: 15,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Dallas RFC',
      level: 'D2',
      gender: 'women',
      // Alex as No.4
      crew: { mo: 'riley', ar1: 'casey', ar2: 'none', no4: 'alex' },
    },
    {
      id: 'm_a06',
      days: 12,
      hour: 12,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
      homeTeamId: 'team_dallas',
      awayTeamId: 'team_houston',
      homeTeamName: 'Dallas RFC',
      awayTeamName: 'Houston Athletic',
      level: 'D1',
      gender: 'men',
      crew: { mo: 'alex', ar1: 'pending-riley', ar2: 'pending-casey' },
    },
    {
      id: 'm_a07',
      days: 14,
      hour: 16,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_houston',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Houston Athletic',
      level: 'D1',
      gender: 'men',
      // Alex as AR1 — pending accept
      crew: { mo: 'riley', ar1: 'pending-alex', ar2: 'casey' },
    },
    {
      id: 'm_a08',
      days: 18,
      hour: 11,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
      homeTeamId: 'team_houston',
      awayTeamId: 'team_austin',
      homeTeamName: 'Houston Athletic',
      awayTeamName: 'Austin RFC',
      level: 'D2',
      gender: 'women',
      // Alex as AR2 — pending
      crew: { mo: 'casey', ar1: 'riley', ar2: 'pending-alex' },
    },
    {
      id: 'm_a09',
      days: 21,
      hour: 14,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
      homeTeamId: 'team_dallas',
      awayTeamId: 'team_austin',
      homeTeamName: 'Dallas RFC',
      awayTeamName: 'Austin RFC',
      level: 'D3',
      gender: 'men',
      // Alex as No.4 — pending
      crew: { mo: 'riley', ar1: 'casey', ar2: 'none', no4: 'pending-alex' },
    },
    {
      id: 'm_a10',
      days: 28,
      hour: 13,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Dallas RFC',
      level: 'D1',
      gender: 'women',
      crew: { mo: 'alex', ar1: 'none', ar2: 'none' },
    },
    {
      id: 'm_a11',
      days: 35,
      hour: 10,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
      homeTeamId: 'team_houston',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Houston Athletic',
      awayTeamName: 'Dallas RFC',
      level: 'D2',
      gender: 'men',
      // Alex as AR1
      crew: { mo: 'casey', ar1: 'alex', ar2: 'riley' },
      status: 'mo_confirmed',
    },
    {
      id: 'm_a12',
      days: 42,
      hour: 15,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
      homeTeamId: 'team_dallas',
      awayTeamId: 'team_houston',
      homeTeamName: 'Dallas RFC',
      awayTeamName: 'Houston Athletic',
      level: 'D1',
      gender: 'men',
      // Alex as No.4
      crew: { mo: 'riley', ar1: 'pending-casey', ar2: 'none', no4: 'alex' },
      status: 'crew_confirmed',
    },
  ];

  const appointments: Match[] = fixtures.map((f, i) => ({
    id: f.id,
    sheetRowKey: `sheet-${f.id}`,
    status: f.status ?? 'crew_pending',
    kickoffAt: kickAt(f.days, f.hour),
    venueName: f.venueName,
    venueAddress: f.venueAddress,
    venueLat: f.lat,
    venueLng: f.lng,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeTeamName: f.homeTeamName,
    awayTeamName: f.awayTeamName,
    competition: 'Club',
    level: f.level,
    gender: f.gender,
    notes:
      i === 0
        ? 'Arrive 45 minutes early. Parking lot B is reserved for officials.'
        : i === 2
          ? 'Water station at midfield; trainer on site.'
          : undefined,
    flightProvided: false,
    housingProvided: false,
    homeConfirmedAt: released,
    awayConfirmedAt: released,
    releasedAt: released,
    crew: buildCrew(f.crew),
    cmo:
      i % 3 === 0
        ? [{ userId: 'u_assigner', userName: 'Alex Assigner' }]
        : i % 3 === 1
          ? [{ userId: 'u_ref1', userName: 'Riley Official' }]
          : undefined,
  }));

  const extras: Match[] = [
    {
      id: 'm_1',
      sheetRowKey: 'sheet-1',
      status: 'draft',
      kickoffAt: kickAt(5, 14),
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      venueLat: austin.lat,
      venueLng: austin.lng,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Dallas RFC',
      competition: 'Club',
      level: 'D1',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      crew: emptyCrew(),
    },
  ];

  // Open games for Referee → Request → Global (raise-hand).
  const openPairs: Array<[string, string, string, string]> = [
    ['team_austin', 'Austin RFC', 'team_dallas', 'Dallas RFC'],
    ['team_dallas', 'Dallas RFC', 'team_houston', 'Houston Athletic'],
    ['team_houston', 'Houston Athletic', 'team_austin', 'Austin RFC'],
  ];
  const openVenues = [
    { name: 'Westlake Fields', address: 'Austin, TX', ...austin },
    { name: 'Dallas Rugby Grounds', address: 'Dallas, TX', ...dallas },
    { name: 'Memorial Park', address: 'Houston, TX', ...houston },
  ];

  const openGames: Match[] = Array.from({ length: 12 }, (_, i) => {
    const pair = openPairs[i % openPairs.length];
    const venue = openVenues[i % openVenues.length];
    const id = `m_g${String(i + 1).padStart(2, '0')}`;
    const rolesNeeded =
      i % 4 === 0
        ? (['mo', 'ar1', 'ar2', 'no4', 'cmo'] as const)
        : i % 4 === 1
          ? (['mo', 'ar1', 'ar2', 'cmo'] as const)
          : i % 4 === 2
            ? (['mo', 'no4'] as const)
            : (['mo', 'ar1', 'ar2', 'no4'] as const);
    return {
      id,
      sheetRowKey: `sheet-${id}`,
      status: 'team_confirmed' as const,
      kickoffAt: kickAt(3 + i * 2, 10 + (i % 5)),
      venueName: venue.name,
      venueAddress: venue.address,
      venueLat: venue.lat,
      venueLng: venue.lng,
      homeTeamId: pair[0],
      homeTeamName: pair[1],
      awayTeamId: pair[2],
      awayTeamName: pair[3],
      competition: 'Club',
      level: (['D1', 'D2', 'D3'] as const)[i % 3],
      gender: i % 2 === 0 ? 'men' : 'women',
      flightProvided: i % 4 === 0,
      housingProvided: i % 5 === 0,
      homeConfirmedAt: released,
      awayConfirmedAt: released,
      releasedAt: released,
      rolesNeeded: [...rolesNeeded],
      crew: emptyCrew(),
    };
  });

  // Team confirmation pending — examples where one side has not confirmed.
  const awaitingTeamConfirm: Match[] = [
    {
      id: 'm_tc01',
      sheetRowKey: 'sheet-m_tc01',
      status: 'pending_team_review',
      kickoffAt: kickAt(6, 13),
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      venueLat: austin.lat,
      venueLng: austin.lng,
      homeTeamId: 'team_austin',
      homeTeamName: 'Austin RFC',
      awayTeamId: 'team_dallas',
      awayTeamName: 'Dallas RFC',
      competition: 'Club',
      level: 'D1',
      gender: 'men',
      notes: 'Parking lot B for officials. Water at midfield.',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: undefined,
      awayConfirmedAt: undefined,
      releasedAt: released,
      rolesNeeded: ['mo', 'ar1', 'ar2', 'no4', 'cmo'],
      crew: emptyCrew(),
    },
    {
      id: 'm_tc02',
      sheetRowKey: 'sheet-m_tc02',
      status: 'pending_team_review',
      kickoffAt: kickAt(8, 15),
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      venueLat: dallas.lat,
      venueLng: dallas.lng,
      homeTeamId: 'team_dallas',
      homeTeamName: 'Dallas RFC',
      awayTeamId: 'team_houston',
      awayTeamName: 'Houston Athletic',
      competition: 'Club',
      level: 'D2',
      gender: 'women',
      notes: 'Home team still needs to confirm venue.',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: undefined,
      awayConfirmedAt: released,
      releasedAt: released,
      rolesNeeded: ['mo', 'ar1', 'ar2'],
      crew: emptyCrew(),
    },
    {
      id: 'm_tc03',
      sheetRowKey: 'sheet-m_tc03',
      status: 'pending_team_review',
      kickoffAt: kickAt(10, 11),
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      venueLat: houston.lat,
      venueLng: houston.lng,
      homeTeamId: 'team_houston',
      homeTeamName: 'Houston Athletic',
      awayTeamId: 'team_austin',
      awayTeamName: 'Austin RFC',
      competition: 'Club',
      level: 'D3',
      gender: 'men',
      notes: 'Neither team has confirmed yet.',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: undefined,
      awayConfirmedAt: undefined,
      releasedAt: released,
      rolesNeeded: ['mo', 'no4'],
      crew: emptyCrew(),
    },
  ];

  // Second side (2nds) — same club admin, separate team section.
  const secondsSide: Match[] = [
    {
      id: 'm_2nds01',
      sheetRowKey: 'sheet-m_2nds01',
      status: 'pending_team_review',
      kickoffAt: kickAt(4, 12),
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      venueLat: austin.lat,
      venueLng: austin.lng,
      homeTeamId: 'team_austin_2nds',
      homeTeamName: 'Austin RFC 2nds',
      awayTeamId: 'team_dallas',
      awayTeamName: 'Dallas RFC',
      competition: 'Club',
      level: 'D3',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: undefined,
      awayConfirmedAt: released,
      releasedAt: released,
      rolesNeeded: ['mo', 'ar1', 'ar2'],
      crew: emptyCrew(),
    },
    {
      id: 'm_2nds02',
      sheetRowKey: 'sheet-m_2nds02',
      status: 'crew_pending',
      kickoffAt: kickAt(11, 14),
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      venueLat: houston.lat,
      venueLng: houston.lng,
      homeTeamId: 'team_houston',
      homeTeamName: 'Houston Athletic',
      awayTeamId: 'team_austin_2nds',
      awayTeamName: 'Austin RFC 2nds',
      competition: 'Club',
      level: 'D3',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: released,
      awayConfirmedAt: released,
      releasedAt: released,
      rolesNeeded: ['mo', 'ar1', 'ar2'],
      crew: emptyCrew(),
    },
  ];

  // Matches Alex has already requested (Pending tab) — not shown as open Global.
  const pendingGames: Match[] = Array.from({ length: 12 }, (_, i) => {
    const pair = openPairs[(i + 1) % openPairs.length];
    const venue = openVenues[(i + 2) % openVenues.length];
    const id = `m_r${String(i + 1).padStart(2, '0')}`;
    return {
      id,
      sheetRowKey: `sheet-${id}`,
      status: 'team_confirmed' as const,
      kickoffAt: kickAt(4 + i * 2, 11 + (i % 4)),
      venueName: venue.name,
      venueAddress: venue.address,
      venueLat: venue.lat,
      venueLng: venue.lng,
      homeTeamId: pair[0],
      homeTeamName: pair[1],
      awayTeamId: pair[2],
      awayTeamName: pair[3],
      competition: 'Club',
      level: (['D1', 'D2', 'D3'] as const)[i % 3],
      gender: i % 2 === 0 ? 'women' : 'men',
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: released,
      awayConfirmedAt: released,
      releasedAt: released,
      crew: emptyCrew(),
    };
  });

  // Past results for Global → Standings (W/L/T · PF/PA/PD by division × gender).
  const resultSpecs: Array<{
    id: string;
    daysAgo: number;
    homeTeamId: string;
    homeTeamName: string;
    awayTeamId: string;
    awayTeamName: string;
    level: string;
    gender: MatchGender;
    homeScore: number;
    awayScore: number;
    venueName: string;
    venueAddress: string;
    lat: number;
    lng: number;
  }> = [
    {
      id: 'm_res01',
      daysAgo: 21,
      homeTeamId: 'team_austin',
      homeTeamName: 'Austin RFC',
      awayTeamId: 'team_dallas',
      awayTeamName: 'Dallas RFC',
      level: 'D1',
      gender: 'men',
      homeScore: 28,
      awayScore: 17,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
    },
    {
      id: 'm_res02',
      daysAgo: 14,
      homeTeamId: 'team_houston',
      homeTeamName: 'Houston Athletic',
      awayTeamId: 'team_austin',
      awayTeamName: 'Austin RFC',
      level: 'D1',
      gender: 'men',
      homeScore: 21,
      awayScore: 24,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
    },
    {
      id: 'm_res03',
      daysAgo: 7,
      homeTeamId: 'team_dallas',
      homeTeamName: 'Dallas RFC',
      awayTeamId: 'team_houston',
      awayTeamName: 'Houston Athletic',
      level: 'D1',
      gender: 'men',
      homeScore: 14,
      awayScore: 14,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
    },
    {
      id: 'm_res04',
      daysAgo: 18,
      homeTeamId: 'team_austin',
      homeTeamName: 'Austin RFC',
      awayTeamId: 'team_houston',
      awayTeamName: 'Houston Athletic',
      level: 'D2',
      gender: 'women',
      homeScore: 19,
      awayScore: 12,
      venueName: 'Westlake Fields',
      venueAddress: 'Austin, TX',
      lat: austin.lat,
      lng: austin.lng,
    },
    {
      id: 'm_res05',
      daysAgo: 11,
      homeTeamId: 'team_dallas',
      homeTeamName: 'Dallas RFC',
      awayTeamId: 'team_austin',
      awayTeamName: 'Austin RFC',
      level: 'D2',
      gender: 'women',
      homeScore: 10,
      awayScore: 22,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
    },
    {
      id: 'm_res06',
      daysAgo: 4,
      homeTeamId: 'team_houston',
      homeTeamName: 'Houston Athletic',
      awayTeamId: 'team_dallas',
      awayTeamName: 'Dallas RFC',
      level: 'D2',
      gender: 'women',
      homeScore: 15,
      awayScore: 8,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
    },
    {
      id: 'm_res07',
      daysAgo: 16,
      homeTeamId: 'team_houston',
      homeTeamName: 'Houston Athletic',
      awayTeamId: 'team_dallas',
      awayTeamName: 'Dallas RFC',
      level: 'D2',
      gender: 'men',
      homeScore: 33,
      awayScore: 12,
      venueName: 'Memorial Park',
      venueAddress: 'Houston, TX',
      lat: houston.lat,
      lng: houston.lng,
    },
    {
      id: 'm_res08',
      daysAgo: 9,
      homeTeamId: 'team_dallas',
      homeTeamName: 'Dallas RFC',
      awayTeamId: 'team_houston',
      awayTeamName: 'Houston Athletic',
      level: 'D2',
      gender: 'men',
      homeScore: 17,
      awayScore: 20,
      venueName: 'Dallas Rugby Grounds',
      venueAddress: 'Dallas, TX',
      lat: dallas.lat,
      lng: dallas.lng,
    },
  ];

  // Past kickoffs for T+90 report demos (varied MO / AR / CMO for Alex).
  const resultCrews: Array<{
    crew: { mo: Person; ar1: Person; ar2: Person; no4?: Person };
    cmo?: { userId: string; userName: string }[];
  }> = [
    {
      // m_res01 — Alex MO, no CMO → Quick/Performance chooser
      crew: { mo: 'alex', ar1: 'riley', ar2: 'casey' },
    },
    {
      // m_res02 — Alex MO + CMO → Performance only
      crew: { mo: 'alex', ar1: 'riley', ar2: 'casey' },
      cmo: [{ userId: 'u_ref1', userName: 'Riley Official' }],
    },
    {
      // m_res03 — Alex AR1
      crew: { mo: 'riley', ar1: 'alex', ar2: 'casey' },
    },
    {
      // m_res04 — Alex AR2
      crew: { mo: 'riley', ar1: 'casey', ar2: 'alex' },
    },
    {
      // m_res05 — Alex CMO
      crew: { mo: 'riley', ar1: 'casey', ar2: 'none' },
      cmo: [{ userId: 'u_assigner', userName: 'Alex Assigner' }],
    },
    {
      // m_res06 — Alex No.4 (no match report)
      crew: { mo: 'riley', ar1: 'casey', ar2: 'none', no4: 'alex' },
    },
    {
      // m_res07 — Alex MO + self as CMO edge (Performance)
      crew: { mo: 'alex', ar1: 'riley', ar2: 'casey' },
      cmo: [{ userId: 'u_assigner', userName: 'Alex Assigner' }],
    },
    {
      // m_res08 — Alex AR1, Riley CMO
      crew: { mo: 'casey', ar1: 'alex', ar2: 'riley' },
      cmo: [{ userId: 'u_ref1', userName: 'Riley Official' }],
    },
  ];

  const results: Match[] = resultSpecs.map((r, i) => {
    const meta = resultCrews[i] ?? {
      crew: { mo: 'riley' as Person, ar1: 'casey' as Person, ar2: 'alex' as Person },
    };
    return {
      id: r.id,
      sheetRowKey: `sheet-${r.id}`,
      status: 'locked_confirmed' as const,
      kickoffAt: kickAt(-r.daysAgo, 14),
      venueName: r.venueName,
      venueAddress: r.venueAddress,
      venueLat: r.lat,
      venueLng: r.lng,
      homeTeamId: r.homeTeamId,
      awayTeamId: r.awayTeamId,
      homeTeamName: r.homeTeamName,
      awayTeamName: r.awayTeamName,
      competition: 'Club',
      level: r.level,
      gender: r.gender,
      flightProvided: false,
      housingProvided: false,
      homeConfirmedAt: released,
      awayConfirmedAt: released,
      releasedAt: released,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      crew: buildCrew(meta.crew),
      cmo: meta.cmo,
    };
  });

  const all: Match[] = [
    ...extras,
    ...appointments,
    ...awaitingTeamConfirm,
    ...secondsSide,
    ...openGames,
    ...pendingGames,
    ...results,
  ];

  const demoTitles: Record<string, string> = {
    m_a01: 'Season opener',
    m_a02: 'Conference play',
    m_a02b: 'Rivalry weekend',
    m_a03: 'Homecoming',
    m_a04: 'Derby day',
    m_a08: 'Tourney final',
    m_g01: 'Midseason',
    m_g02: 'Conference play',
    m_tc01: 'Team review',
    m_res01: 'Playoff',
    m_res02: 'Conference final',
  };

  return all.map((m) => ({
    ...m,
    competition: competitionForGender(m.gender),
    title: demoTitles[m.id],
    level:
      m.id === 'm_a08' || m.id === 'm_res03' ? 'Tourney' : m.level,
  }));
}


export interface AppState {
  org: OrgSettings;
  users: UserProfile[];
  teams: Team[];
  matches: Match[];
  proposals: ChangeProposal[];
  requests: GameRequest[];
  /** Team Admin requests for new fixtures (not raise-hand). */
  fixtureRequests: FixtureRequest[];
  /** Pending / resolved Team Admin club-link requests. */
  teamLinkRequests: TeamLinkRequest[];
  /** Team Admin referee feedback (scheduler-confidential). */
  coachFeedback: CoachFeedback[];
  availability: AvailabilityRange[];
  notifications: NotificationLogEntry[];
  officialAlerts: OfficialAlert[];
  matchReports: MatchReport[];
  cardReports: CardReport[];
  /** Society coaching file notes (not CMO post-match forms). */
  coachingReports: CoachingReportStub[];
  currentUserId: string | null;
}

type Listener = () => void;

function seedOfficialAlerts(): OfficialAlert[] {
  return [
    {
      id: 'alert_1',
      userId: '*',
      title: 'Urgent: coverage needed Saturday',
      body: 'Assigner needs confirmation on an open AR slot this weekend.',
      matchId: 'm_g01',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'alert_2',
      userId: '*',
      title: 'Urgent: last-minute open MO',
      body: 'A Match Official dropped — raise your hand if available.',
      matchId: 'm_g03',
      createdAt: new Date().toISOString(),
    },
  ];
}

function seedGameRequests(matches: Match[]): GameRequest[] {
  // Open Global games only — not past results (m_res*), which also start with "m_r".
  const pendingIds = matches
    .filter((m) => /^m_g\d/.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 5);
  const slots: Array<'mo' | 'ar1' | 'ar2' | 'no4'> = ['mo', 'ar1', 'ar2', 'no4'];
  const now = Date.now();

  // Pending tab is waiting-only — seed open requests (not approved/denied history).
  const requesters = [
    { userId: 'u_ref1', userName: 'Riley Official' },
    { userId: 'u_ref2', userName: 'Casey Official' },
    { userId: 'u_assigner', userName: 'Alex Assigner' },
  ] as const;

  return pendingIds.map((m, i) => {
    const created = new Date(now - (i + 1) * 36 * 60 * 60 * 1000).toISOString();
    const who = requesters[i % requesters.length];
    return {
      id: `gr_${m.id}`,
      matchId: m.id,
      userId: who.userId,
      userName: who.userName,
      preferredSlot: slots[i % slots.length],
      status: 'pending' as const,
      createdAt: created,
    };
  });
}

function seedFixtureRequests(): FixtureRequest[] {
  const kick = new Date();
  kick.setDate(kick.getDate() + 21);
  kick.setHours(14, 0, 0, 0);
  return [
    {
      id: 'fr_demo_1',
      orgId: 'demo-org',
      requesterUserId: 'u_home',
      requesterName: 'Austin Admin',
      requesterTeamId: 'team_austin',
      side: 'home',
      opponentTeamId: 'team_dallas',
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
      homeTeamName: 'Austin RFC',
      awayTeamName: 'Dallas RFC',
      kickoffAt: kick.toISOString(),
      venueName: 'Austin Rugby Complex',
      venueAddress: '1001 Academy Dr, Austin, TX',
      competition: 'Lonestar Men',
      level: 'D1',
      gender: 'men',
      notes: 'Friendly — demo fixture request',
      flightProvided: false,
      housingProvided: true,
      status: 'pending',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function seedCoachFeedback(matches: Match[]): CoachFeedback[] {
  const byId = (id: string) => matches.find((x) => x.id === id);

  const base = (
    match: Match,
    reportingTeamId: string,
    opts: {
      status: CoachFeedback['status'];
      scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>;
      daysAgo: number;
      submitter: {
        uid: string;
        name: string;
        email: string;
        phone: string;
        clubRole: string;
      };
      commentsOnScores?: string;
      areasDoneWell?: string;
      areasToImprove?: string;
      otherFeedback?: string;
      otherCrewFeedback?: string;
      videoLink?: string;
      videoNotes?: string;
      contactAboutReport?: boolean;
      edits?: CoachFeedback['edits'];
    },
  ): CoachFeedback | null => {
    const mo = crewPeople(match.crew.mo).find((a) => a.userId && a.userName);
    if (!mo?.userId || !mo.userName) return null;
    const reportingTeamName =
      reportingTeamId === match.homeTeamId
        ? match.homeTeamName
        : match.awayTeamName;
    const at = new Date(
      Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000,
    ).toISOString();
    const lastEdit = opts.edits?.[opts.edits.length - 1];
    const firstSubmit = opts.edits?.find((e) => e.action === 'submit');
    return {
      id: coachFeedbackDocId(match.id, reportingTeamId),
      orgId: 'demo-org',
      matchId: match.id,
      slot: 'mo',
      officialUserId: mo.userId,
      officialName: mo.userName,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      kickoffAt: match.kickoffAt,
      competition: match.competition,
      level: match.level,
      score: `${match.homeScore ?? 0}–${match.awayScore ?? 0}`,
      scales: opts.scales,
      commentsOnScores: opts.commentsOnScores,
      areasDoneWell: opts.areasDoneWell,
      areasToImprove: opts.areasToImprove,
      otherFeedback: opts.otherFeedback,
      otherCrewFeedback: opts.otherCrewFeedback,
      videoLink: opts.videoLink,
      videoNotes: opts.videoNotes,
      submitterUserId: opts.submitter.uid,
      submitterName: opts.submitter.name,
      submitterEmail: opts.submitter.email,
      submitterPhone: opts.submitter.phone,
      clubRole: opts.submitter.clubRole,
      contactAboutReport: opts.contactAboutReport === true,
      reportingTeamId,
      reportingTeamName,
      status: opts.status,
      submittedAt:
        opts.status === 'submitted' ? (firstSubmit?.at ?? at) : undefined,
      edits: opts.edits ?? [
        {
          at,
          byUserId: opts.submitter.uid,
          byName: opts.submitter.name,
          action:
            opts.status === 'declined'
              ? 'decline'
              : opts.status === 'draft'
                ? 'save'
                : 'submit',
        },
      ],
      createdAt: opts.edits?.[0]?.at ?? at,
      updatedAt: lastEdit?.at ?? at,
    };
  };

  const austin = {
    uid: 'u_home',
    name: 'Austin Admin',
    email: 'austin-admin@example.com',
    phone: '+15551110002',
    clubRole: 'Head Coach',
  };
  const dallas = {
    uid: 'u_away',
    name: 'Dallas Admin',
    email: 'dallas-admin@example.com',
    phone: '+15551110003',
    clubRole: 'Captain',
  };

  const out: CoachFeedback[] = [];
  const push = (row: CoachFeedback | null) => {
    if (row) out.push(row);
  };

  const m01 = byId('m_res01');
  const m02 = byId('m_res02');
  const m04 = byId('m_res04');
  const m05 = byId('m_res05');

  // Austin home — submitted (with a later edit that added video)
  if (m01) {
    const first = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const edited = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    push(
      base(m01, 'team_austin', {
        status: 'submitted',
        daysAgo: 5,
        submitter: austin,
        scales: {
          breakdown: 4,
          scrum: 3,
          lineout: 4,
          safety: 4,
          communication: 3,
          professionalism: 4,
          overall: 4,
        },
        commentsOnScores: 'Solid day overall; scrum resets were a touch slow.',
        areasDoneWell: 'Communication with captains and player management.',
        areasToImprove: 'Faster reset at scrum; clearer advantage calls.',
        otherCrewFeedback: 'ARs were well positioned.',
        videoLink: 'https://example.com/demo/austin-dallas-m-res01',
        videoNotes: 'Scrum reset around 34:20; late advantage at 61:05.',
        contactAboutReport: true,
        edits: [
          {
            at: first,
            byUserId: austin.uid,
            byName: austin.name,
            action: 'submit',
          },
          {
            at: edited,
            byUserId: austin.uid,
            byName: austin.name,
            action: 'save',
          },
        ],
      }),
    );
    // Dallas away — also submitted (both sides can report)
    push(
      base(m01, 'team_dallas', {
        status: 'submitted',
        daysAgo: 4,
        submitter: dallas,
        scales: {
          breakdown: 3,
          scrum: 4,
          lineout: 3,
          safety: 5,
          communication: 4,
          professionalism: 4,
          overall: 4,
        },
        areasDoneWell: 'Strong foul-play management; game felt safe.',
        areasToImprove: 'A few late advantage calls at midfield.',
        contactAboutReport: false,
      }),
    );
  }

  // Austin away — draft in progress (partial ratings)
  if (m02) {
    push(
      base(m02, 'team_austin', {
        status: 'draft',
        daysAgo: 1,
        submitter: austin,
        scales: {
          breakdown: 3,
          scrum: 3,
          overall: 3,
        },
        commentsOnScores: 'Still filling this in after the trip home.',
      }),
    );
  }

  // Austin home — declined (clears Needs feedback)
  if (m04) {
    push(
      base(m04, 'team_austin', {
        status: 'declined',
        daysAgo: 3,
        submitter: austin,
        scales: {},
      }),
    );
  }

  // Dallas home on m_res05 — declined; Austin away left open (Needs feedback)
  if (m05) {
    push(
      base(m05, 'team_dallas', {
        status: 'declined',
        daysAgo: 2,
        submitter: dallas,
        scales: {},
      }),
    );
  }

  // m_res05 Austin away intentionally unseeded → Needs feedback in Team Admin demo
  return out;
}

function seedMatchReports(matches: Match[]): MatchReport[] {
  const existing: MatchReport[] = [];
  const nowIso = new Date().toISOString();

  // Alex (demo user) submitted MO Performance — viewable under Submitted.
  const alexMo = matches.find(
    (m) => m.id === 'm_res01' && crewPeople(m.crew.mo).some((a) => a.userId === 'u_assigner'),
  );
  const alexMoUid = alexMo
    ? crewPeople(alexMo.crew.mo).find((a) => a.userId === 'u_assigner')?.userId
    : undefined;
  if (alexMo && alexMoUid) {
    existing.push({
      id: 'mr_seed_alex_mo',
      matchId: alexMo.id,
      officialId: alexMoUid,
      slot: 'mo',
      formKind: 'mo_performance',
      status: 'submitted',
      dueAt: new Date(
        new Date(alexMo.kickoffAt).getTime() + 90 * 60 * 1000,
      ).toISOString(),
      kickoffAt: alexMo.kickoffAt,
      submittedAt: nowIso,
      moPayload: {
        refereeName: 'Alex Assigner',
        matchDate: alexMo.kickoffAt.slice(0, 10),
        format: '15s',
        division: 'Men’s D1',
        homeTeamName: alexMo.homeTeamName,
        awayTeamName: alexMo.awayTeamName,
        homePoints: alexMo.homeScore ?? 28,
        awayPoints: alexMo.awayScore ?? 17,
        homeYellowCards: 1,
        homeRedCards: 0,
        awayYellowCards: 1,
        awayRedCards: 0,
        yellowCards: 2,
        redCards: 0,
        gameTemperature: 3,
        controlAndFlow: 4,
        todayIPerformed: 'Steady communication; good advantage use.',
        decidedAndWhy: 'Held a late penalty advantage that led to a try.',
        breakdownRewards: ['Tackler Not Rolling'],
        setPieceChallenge: 'Scrum resets early; managed without cards.',
        advantageUse: 4,
        nonCardProblems: 'One sideline dispute — resolved with captains.',
        otherCommentsOrLink: '',
        crewAttendance: [
          {
            slot: 'mo',
            userId: 'u_assigner',
            userName: 'Alex Assigner',
            attended: true,
          },
          {
            slot: 'ar1',
            userId: 'u_ref1',
            userName: 'Riley Official',
            attended: true,
          },
          {
            slot: 'ar2',
            userId: 'u_ref2',
            userName: 'Casey Official',
            attended: true,
          },
        ],
        crewIssuesNote: 'None — demo Scheduler-only note.',
        lightFeedback: 'Solid outing; card report filed for both yellows.',
      },
    });
  }

  // Riley MO submitted (cards noted, no card report) — card-nudge demo for Riley.
  const rileyMo = matches.find(
    (m) =>
      m.id === 'm_res04' &&
      crewPeople(m.crew.mo).some((a) => a.userId === 'u_ref1'),
  );
  const rileyMoUid = rileyMo
    ? crewPeople(rileyMo.crew.mo).find((a) => a.userId === 'u_ref1')?.userId
    : undefined;
  if (rileyMo && rileyMoUid) {
    existing.push({
      id: 'mr_seed_riley_mo',
      matchId: rileyMo.id,
      officialId: rileyMoUid,
      slot: 'mo',
      formKind: 'mo_quick',
      status: 'submitted',
      dueAt: new Date(
        new Date(rileyMo.kickoffAt).getTime() + 90 * 60 * 1000,
      ).toISOString(),
      kickoffAt: rileyMo.kickoffAt,
      submittedAt: nowIso,
      moPayload: {
        homePoints: rileyMo.homeScore ?? 19,
        awayPoints: rileyMo.awayScore ?? 12,
        yellowCards: 2,
        redCards: 0,
        lightFeedback: 'Two yellows; card report still needed from MO.',
      },
    });
  }

  // Alex CMO submitted — viewable under Coaching Reports → Submitted (filed by Alex).
  const alexCmo = matches.find(
    (m) =>
      m.id === 'm_res05' &&
      (m.cmo ?? []).some((c) => c.userId === 'u_assigner'),
  );
  const alexCmoUid = alexCmo
    ? (alexCmo.cmo ?? []).find((c) => c.userId === 'u_assigner')?.userId
    : undefined;
  if (alexCmo && alexCmoUid) {
    existing.push({
      id: 'mr_seed_alex_cmo',
      matchId: alexCmo.id,
      officialId: alexCmoUid,
      slot: 'cmo',
      formKind: 'cmo',
      status: 'submitted',
      dueAt: new Date(
        new Date(alexCmo.kickoffAt).getTime() + 90 * 60 * 1000,
      ).toISOString(),
      deadlineAt: new Date(
        new Date(alexCmo.kickoffAt).getTime() + 48 * 60 * 60 * 1000,
      ).toISOString(),
      kickoffAt: alexCmo.kickoffAt,
      submittedAt: nowIso,
      cmoPayload: {
        scales: {
          scrum: 4,
          breakdown: 3,
          gameControl: 4,
          communication: 5,
          positioning: 4,
          lineout: 3,
          bigDecisions: 4,
        },
        comments: {
          scrum: 'Managed resets calmly.',
          communication: 'Clear with captains throughout.',
        },
        overallComment:
          'Strong control game. Continue scanning early at the breakdown.',
        assessedRating: 8,
      },
    });
  }

  // Riley CMO on Alex-as-MO match — Alex sees this under My Coaching Reports.
  const aboutAlex = matches.find(
    (m) =>
      m.id === 'm_res02' &&
      crewPeople(m.crew.mo).some((a) => a.userId === 'u_assigner') &&
      (m.cmo ?? []).some((c) => c.userId === 'u_ref1'),
  );
  const aboutAlexCmoUid = aboutAlex
    ? (aboutAlex.cmo ?? []).find((c) => c.userId === 'u_ref1')?.userId
    : undefined;
  if (aboutAlex && aboutAlexCmoUid) {
    existing.push({
      id: 'mr_seed_riley_cmo_on_alex',
      matchId: aboutAlex.id,
      officialId: aboutAlexCmoUid,
      slot: 'cmo',
      formKind: 'cmo',
      status: 'submitted',
      dueAt: new Date(
        new Date(aboutAlex.kickoffAt).getTime() + 90 * 60 * 1000,
      ).toISOString(),
      deadlineAt: new Date(
        new Date(aboutAlex.kickoffAt).getTime() + 48 * 60 * 60 * 1000,
      ).toISOString(),
      kickoffAt: aboutAlex.kickoffAt,
      submittedAt: nowIso,
      cmoPayload: {
        scales: {
          scrum: 3,
          breakdown: 4,
          gameControl: 4,
          communication: 4,
          positioning: 3,
          lineout: 4,
          bigDecisions: 5,
        },
        comments: {
          bigDecisions: 'Held a late advantage that led to a try.',
          positioning: 'Work midfield depth in the second half.',
        },
        overallComment:
          'Solid outing as MO. Keep scanning early at the breakdown.',
        assessedRating: 7,
      },
    });
  }

  return syncPendingMatchReports(matches, existing, Date.now(), () => id('mr'));
}

function seedCardReports(matches: Match[]): CardReport[] {
  const alexMo = matches.find(
    (m) => m.id === 'm_res01' && crewPeople(m.crew.mo).some((a) => a.userId === 'u_assigner'),
  );
  if (!alexMo) return [];
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'card_seed_alex',
      matchId: alexMo.id,
      officialId: 'u_assigner',
      status: 'submitted',
      competitionUnion: 'texas_rugby_union_club',
      officialName: 'Alex Assigner',
      officialEmail: 'assigner@example.com',
      officialPhone: '+15551110001',
      matchDate: alexMo.kickoffAt.slice(0, 10),
      cards: [
        {
          id: 'ci_seed_1',
          color: 'yellow',
          playerName: 'Jordan Hale',
          teamId: alexMo.homeTeamId,
          teamName: alexMo.homeTeamName,
          minute: '34',
          reason: 'Repeated offside at the breakdown.',
        },
        {
          id: 'ci_seed_2',
          color: 'yellow',
          playerName: 'Sam Ortiz',
          teamId: alexMo.awayTeamId,
          teamName: alexMo.awayTeamName,
          minute: '61',
          reason: 'High tackle — reckless but not dangerous.',
        },
      ],
      additionalInfoPrivate:
        'Away captain disputed the second yellow briefly; no further action needed. (Scheduler only)',
      submittedAt: nowIso,
      createdAt: nowIso,
    },
  ];
}

function seedCoachingReports(): CoachingReportStub[] {
  const now = Date.now();
  return [
    {
      id: 'cr_1',
      officialId: 'u_assigner',
      title: 'Q2 coaching review',
      summary: 'Placeholder coaching note from society CMO.',
      status: 'on_file',
      createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr_alex_mid',
      officialId: 'u_assigner',
      title: 'D1 midseason check-in',
      summary: 'Consistent foul consistency across halves; keep working fitness.',
      status: 'on_file',
      createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr_3',
      officialId: 'u_ref1',
      title: 'Positioning clinic follow-up',
      summary: 'Strong advantage calls; work on AR communication.',
      status: 'on_file',
      createdAt: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr_4',
      officialId: 'u_ref1',
      title: 'D1 midseason check-in',
      summary: 'Consistent foul consistency across halves.',
      status: 'on_file',
      createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cr_5',
      officialId: 'u_ref2',
      title: 'AR1 development note',
      summary: 'Flag mechanics improving; keep scanning early.',
      status: 'on_file',
      createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

/** Demo rows so Scheduler → Queues is not empty for reassignment / T-72 / proposals. */
function seedAssignerQueueDemos(matches: Match[]): {
  matches: Match[];
  proposals: ChangeProposal[];
} {
  const source = matches.find((m) => m.id === 'm_tc01');
  const next = matches.map((m) => {
    if (m.id === 'm_a06') return { ...m, status: 'needs_reassignment' as const };
    if (m.id === 'm_a07') return { ...m, status: 't72_team_pending' as const };
    if (m.id === 'm_tc01') return beginChangeProposed(m);
    return m;
  });
  // Dallas proposes; Austin (home) must accept. Assigner ack is awareness only.
  const proposals: ChangeProposal[] = source
    ? [
        {
          id: 'prop_ack_demo',
          matchId: source.id,
          proposedByTeamId: source.awayTeamId,
          proposedByUserId: 'u_away',
          proposedByName: 'Dallas Admin',
          previousKickoffAt: source.kickoffAt,
          previousVenueName: source.venueName,
          previousVenueAddress: source.venueAddress,
          kickoffAt: (() => {
            const d = new Date(source.kickoffAt);
            d.setHours(d.getHours() + 2);
            return d.toISOString();
          })(),
          venueName: 'Westlake Fields',
          venueAddress: 'Austin, TX',
          status: 'pending',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ]
    : [];
  return { matches: next, proposals };
}

/** Sample ranges so assigner overlap hints work for Riley. */
function seedDemoAvailability(): AvailabilityRange[] {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  end.setHours(20, 0, 0, 0);
  return [
    {
      id: 'av_riley_demo',
      userId: 'u_ref1',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      kind: 'available',
    },
  ];
}

/** Queue/demo schedule data must not appear in live Firebase sessions. */
function emptyLiveQueueState(): Pick<
  AppState,
  | 'teams'
  | 'matches'
  | 'proposals'
  | 'requests'
  | 'fixtureRequests'
  | 'teamLinkRequests'
  | 'coachFeedback'
  | 'availability'
  | 'notifications'
  | 'officialAlerts'
  | 'matchReports'
  | 'cardReports'
  | 'coachingReports'
> {
  return {
    teams: [],
    matches: [],
    proposals: [],
    requests: [],
    fixtureRequests: [],
    teamLinkRequests: [],
    coachFeedback: [],
    availability: [],
    notifications: [],
    officialAlerts: [],
    matchReports: [],
    cardReports: [],
    coachingReports: [],
  };
}

function createInitialState(): AppState {
  const seeded = seedAssignerQueueDemos(seedMatches());
  const live = isLiveDataMode();
  const queueState = live
    ? emptyLiveQueueState()
    : {
        teams: seedTeams(),
        matches: seeded.matches,
        proposals: seeded.proposals,
        requests: seedGameRequests(seeded.matches),
        fixtureRequests: seedFixtureRequests(),
        teamLinkRequests: [],
        coachFeedback: seedCoachFeedback(seeded.matches),
        availability: seedDemoAvailability(),
        notifications: [
          {
            id: 'n_seed_1',
            at: new Date().toISOString(),
            channel: 'email' as const,
            to: 'assigner@demo.local',
            subject: 'Raise-hand approved (demo)',
            body: 'Sample notification so Scheduler → Queues → Notifications is not empty.',
            event: 'demo_seed',
          },
        ],
        officialAlerts: seedOfficialAlerts(),
        matchReports: seedMatchReports(seeded.matches),
        cardReports: seedCardReports(seeded.matches),
        coachingReports: seedCoachingReports(),
      };
  return {
    org: {
      id: live ? defaultOrgId() : 'demo-org',
      name: 'Demo Rugby Society',
      timezone: 'America/Chicago',
      mileageRatePerMile: 0.67,
      mileageMinMiles: 0,
      defaultFees: defaultFees(),
      matchLevels: [...DEFAULT_MATCH_LEVELS],
      competitions: [...DEFAULT_COMPETITIONS],
      sheetId: live ? undefined : 'demo-sheet',
      sheetSyncedAt: live ? undefined : new Date().toISOString(),
    },
    users: seedUsers(),
    ...queueState,
    currentUserId: null,
  };
}

class DemoStore {
  private state: AppState = createInitialState();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): AppState {
    return this.state;
  }

  /** Re-derive pending T+90 report rows from current matches. */
  syncMatchReports(now = Date.now()): void {
    this.set((s) => ({
      ...s,
      matchReports: syncPendingMatchReports(
        s.matches,
        s.matchReports,
        now,
        () => id('mr'),
      ),
    }));
  }

  private set(partial: Partial<AppState> | ((s: AppState) => AppState)): void {
    this.state =
      typeof partial === 'function' ? partial(this.state) : { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  submitMatchReport(
    reportId: string,
    formKind: ReportFormKind,
    payload: MoReportPayload | ArReportPayload,
  ): void {
    const report = this.state.matchReports.find((r) => r.id === reportId);
    if (!report || report.status === 'submitted') return;
    if (report.slot === 'cmo') return;
    if (formKind === 'cmo') return;

    const nowIso = new Date().toISOString();
    this.set((s) => {
      let matches = s.matches;
      if (
        report.slot === 'mo' &&
        (formKind === 'mo_quick' || formKind === 'mo_performance')
      ) {
        const mo = payload as MoReportPayload;
        matches = s.matches.map((m) =>
          m.id === report.matchId
            ? { ...m, homeScore: mo.homePoints, awayScore: mo.awayPoints }
            : m,
        );
      }
      return {
        ...s,
        matches,
        matchReports: s.matchReports.map((r) => {
          if (r.id !== reportId) return r;
          if (formKind === 'ar_basic') {
            return {
              ...r,
              formKind,
              status: 'submitted' as const,
              submittedAt: nowIso,
              arPayload: payload as ArReportPayload,
            };
          }
          return {
            ...r,
            formKind,
            status: 'submitted' as const,
            submittedAt: nowIso,
            moPayload: payload as MoReportPayload,
          };
        }),
      };
    });
  }

  submitCmoReport(reportId: string, payload: CmoReportPayload): void {
    const report = this.state.matchReports.find((r) => r.id === reportId);
    if (!report || report.slot !== 'cmo' || report.status === 'submitted') {
      return;
    }
    const nowIso = new Date().toISOString();
    this.set((s) => ({
      ...s,
      matchReports: s.matchReports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              formKind: 'cmo' as const,
              status: 'submitted' as const,
              submittedAt: nowIso,
              cmoPayload: payload,
            }
          : r,
      ),
    }));
  }

  submitCardReport(
    input: Omit<CardReport, 'id' | 'status' | 'submittedAt' | 'createdAt'> & {
      id?: string;
    },
  ): CardReport {
    const nowIso = new Date().toISOString();
    const report: CardReport = {
      id: input.id ?? id('card'),
      matchId: input.matchId,
      officialId: input.officialId,
      status: 'submitted',
      competitionUnion: input.competitionUnion,
      officialName: input.officialName,
      officialEmail: input.officialEmail,
      officialPhone: input.officialPhone,
      matchDate: input.matchDate,
      cards: input.cards,
      additionalInfoPrivate: input.additionalInfoPrivate,
      submittedAt: nowIso,
      createdAt: nowIso,
    };
    this.set((s) => ({
      ...s,
      cardReports: [
        ...s.cardReports.filter(
          (c) =>
            !(
              c.matchId === report.matchId &&
              c.officialId === report.officialId &&
              c.status === 'draft'
            ),
        ),
        report,
      ],
    }));
    return report;
  }

  private notify(
    event: string,
    toUserId: string,
    subject: string,
    body: string,
  ): void {
    const user = this.state.users.find((u) => u.uid === toUserId);
    if (!user) return;
    const entries: NotificationLogEntry[] = [
      {
        id: id('n'),
        at: new Date().toISOString(),
        channel: 'email',
        to: user.email,
        subject,
        body,
        event,
      },
    ];
    if (user.smsOptIn === true && user.phone) {
      entries.push({
        id: id('n'),
        at: new Date().toISOString(),
        channel: 'sms',
        to: user.phone,
        subject,
        body,
        event,
      });
    }
    this.set((s) => ({
      ...s,
      notifications: [...entries, ...s.notifications].slice(0, 100),
    }));
  }

  /**
   * Assigner broadcasts (or re-sends) an urgent coverage alert for a match.
   * Officials see it on Request → Global; also logged to notifications.
   */
  sendCoverageAlert(matchId: string): void {
    const match = this.state.matches.find((m) => m.id === matchId);
    if (!match) return;
    const when = new Date(match.kickoffAt).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const title = `Coverage needed: ${match.homeTeamName} vs ${match.awayTeamName}`;
    const body = `Assigner needs officials for ${when} at ${match.venueName}. Raise your hand if available.`;
    const alert: OfficialAlert = {
      id: id('alert'),
      userId: '*',
      title,
      body,
      matchId,
      createdAt: new Date().toISOString(),
    };
    this.set((s) => ({
      ...s,
      officialAlerts: [alert, ...s.officialAlerts].slice(0, 50),
    }));
    for (const u of this.state.users) {
      if (!hasRefereeLensRole(u.roles)) continue;
      this.notify('coverage_alert', u.uid, title, body);
    }
  }

  signInAs(uid: string): void {
    this.set({ currentUserId: uid });
  }

  signOut(): void {
    this.set({ currentUserId: null });
  }

  /**
   * Full seed restore for the `/demo` showcase after live Firestore overlays
   * have replaced fixtures. Does not sign anyone in.
   */
  resetToSeed(): void {
    this.state = createInitialState();
    this.listeners.forEach((l) => l());
  }

  /** Upsert a Firebase user into the in-memory roster and sign them in. */
  upsertAndSignIn(user: UserProfile): void {
    this.set((s) => {
      const idx = s.users.findIndex((u) => u.uid === user.uid);
      const users =
        idx >= 0
          ? s.users.map((u, i) => (i === idx ? { ...u, ...user } : u))
          : [...s.users, user];
      return { ...s, users, currentUserId: user.uid };
    });
  }

  /** Drop demo queue rows before subscribing to Firestore (live mode). */
  prepareForLiveSync(): void {
    this.set((s) => ({
      ...s,
      ...emptyLiveQueueState(),
      org: { ...s.org, id: defaultOrgId() },
    }));
  }

  /**
   * Replace org schedule cache with Firestore live data (real Sheet sync).
   * Clears demo fixtures when a signed-in Firebase user is connected.
   */
  applyLiveOrgSnapshot(snap: {
    org: Partial<OrgSettings> & { id: string };
    matches: Match[];
    teams: Team[];
    fixtureRequests?: FixtureRequest[];
    teamLinkRequests?: TeamLinkRequest[];
    proposals?: ChangeProposal[];
    gameRequests?: GameRequest[];
  }): void {
    this.set((s) => ({
      ...s,
      org: {
        ...s.org,
        ...Object.fromEntries(
          Object.entries(snap.org).filter(([, v]) => v !== undefined),
        ),
        id: snap.org.id || s.org.id,
      } as OrgSettings,
      matches: snap.matches,
      teams: snap.teams.length > 0 ? snap.teams : s.teams,
      proposals:
        snap.proposals !== undefined ? snap.proposals : s.proposals,
      requests:
        snap.gameRequests !== undefined ? snap.gameRequests : s.requests,
      fixtureRequests: snap.fixtureRequests ?? [],
      teamLinkRequests: snap.teamLinkRequests ?? [],
      // Cleared until subscribeCoachFeedback fills (role-scoped).
      coachFeedback: [],
      matchReports: [],
      cardReports: [],
      coachingReports: [],
      officialAlerts: [],
      notifications: [],
    }));
  }

  applyLiveCoachFeedback(coachFeedback: CoachFeedback[]): void {
    this.set((s) => ({ ...s, coachFeedback }));
  }

  /** Replace in-memory roster with live org members (keeps currentUser if missing). */
  applyLiveRoster(users: UserProfile[]): void {
    this.set((s) => {
      const current = s.users.find((u) => u.uid === s.currentUserId);
      let next = [...users];
      if (
        current &&
        !next.some((u) => u.uid === current.uid)
      ) {
        next = [...next, current];
      }
      // Prefer fresher profile fields for the signed-in user when both exist.
      if (current) {
        next = next.map((u) =>
          u.uid === current.uid ? { ...u, ...current, roles: u.roles.length ? u.roles : current.roles } : u,
        );
      }
      return { ...s, users: next };
    });
  }

  removeUserLocally(uid: string): void {
    this.set((s) => ({
      ...s,
      users: s.users.filter((u) => u.uid !== uid),
      currentUserId: s.currentUserId === uid ? null : s.currentUserId,
    }));
  }

  /**
   * Keep Alex as the all-lens demo tour account (Scheduler + Referee + Team Admin).
   * Safe to call when entering the `/demo` showcase so HMR or older seeds don't strand the tour.
   */
  ensureDemoTourPersona(): void {
    const tourTeamIds = ['team_austin', 'team_austin_2nds'];
    this.set((s) => {
      let teams = s.teams;
      if (!teams.some((t) => t.id === 'team_austin_2nds')) {
        teams = [
          ...teams,
          {
            id: 'team_austin_2nds',
            name: 'Austin Rugby Football Club 2nds',
            abbreviation: 'AUS 2',
            gender: 'men',
            address: 'Westlake Fields, Austin, TX',
            contactEmails: ['austin-admin@example.com', 'assigner@example.com'],
            contactPhones: ['+15551110002'],
          },
        ];
      }
      teams = teams.map((t) => {
        if (t.id !== 'team_austin' && t.id !== 'team_austin_2nds') return t;
        if (t.contactEmails.includes('assigner@example.com')) return t;
        return {
          ...t,
          contactEmails: [...t.contactEmails, 'assigner@example.com'],
        };
      });

      let matches = s.matches;
      if (!matches.some((m) => m.id === 'm_2nds01')) {
        const austin = demoGeocode('Austin, TX');
        const houston = demoGeocode('Houston, TX');
        const kickAt = (daysFromNow: number, hour: number): string => {
          const d = new Date();
          d.setDate(d.getDate() + daysFromNow);
          d.setHours(hour, 0, 0, 0);
          return d.toISOString();
        };
        const released = new Date().toISOString();
        matches = [
          ...matches,
          {
            id: 'm_2nds01',
            sheetRowKey: 'sheet-m_2nds01',
            status: 'pending_team_review',
            kickoffAt: kickAt(4, 12),
            venueName: 'Westlake Fields',
            venueAddress: 'Austin, TX',
            venueLat: austin.lat,
            venueLng: austin.lng,
            homeTeamId: 'team_austin_2nds',
            homeTeamName: 'Austin RFC 2nds',
            awayTeamId: 'team_dallas',
            awayTeamName: 'Dallas RFC',
            competition: 'Club',
            level: 'D3',
            gender: 'men',
            flightProvided: false,
            housingProvided: false,
            homeConfirmedAt: undefined,
            awayConfirmedAt: released,
            releasedAt: released,
            rolesNeeded: ['mo', 'ar1', 'ar2'],
            crew: emptyCrew(),
          },
          {
            id: 'm_2nds02',
            sheetRowKey: 'sheet-m_2nds02',
            status: 'crew_pending',
            kickoffAt: kickAt(11, 14),
            venueName: 'Memorial Park',
            venueAddress: 'Houston, TX',
            venueLat: houston.lat,
            venueLng: houston.lng,
            homeTeamId: 'team_houston',
            homeTeamName: 'Houston Athletic',
            awayTeamId: 'team_austin_2nds',
            awayTeamName: 'Austin RFC 2nds',
            competition: 'Club',
            level: 'D3',
            gender: 'men',
            flightProvided: false,
            housingProvided: false,
            homeConfirmedAt: released,
            awayConfirmedAt: released,
            releasedAt: released,
            rolesNeeded: ['mo', 'ar1', 'ar2'],
            crew: emptyCrew(),
          },
        ];
      }

      return {
        ...s,
        teams,
        matches,
        users: s.users.map((u) => {
          if (u.uid !== 'u_assigner' && u.uid !== 'u_home') return u;
          const roles = new Set(u.roles);
          if (u.uid === 'u_assigner') {
            roles.add('assigner');
            roles.add('official');
          }
          roles.add('teamAdmin');
          const teamIds = [...new Set([...u.teamIds, ...tourTeamIds])];
          return { ...u, roles: [...roles], teamIds };
        }),
      };
    });
  }

  /** Reset the new-user demo persona so onboarding can be walked again. */
  resetOnboardingDemoUser(): void {
    const fresh = incompleteOnboardingDemoUser();
    this.set((s) => ({
      ...s,
      users: s.users.map((u) => (u.uid === fresh.uid ? fresh : u)),
    }));
  }

  updateProfile(uid: string, patch: Partial<UserProfile>): void {
    this.set((s) => ({
      ...s,
      users: s.users.map((u) => {
        if (u.uid !== uid) return u;
        const prevAddress = u.homeAddress;
        let next = { ...u, ...patch };
        if (
          next.firstName !== undefined ||
          next.lastName !== undefined ||
          next.preferredName !== undefined ||
          patch.firstName !== undefined ||
          patch.lastName !== undefined ||
          patch.preferredName !== undefined
        ) {
          next = syncDisplayName(next);
        }
        const addressFieldsTouched =
          patch.homeStreet !== undefined ||
          patch.homeUnit !== undefined ||
          patch.homeCity !== undefined ||
          patch.homeRegion !== undefined ||
          patch.homePostalCode !== undefined;
        if (addressFieldsTouched) {
          next = syncHomeAddressLine(next);
        }
        const addressChanged =
          Boolean(next.homeAddress?.trim()) &&
          next.homeAddress.trim() !== (prevAddress ?? '').trim();
        if (
          next.homeAddress?.trim() &&
          (addressChanged || next.homeLat == null || next.homeLng == null)
        ) {
          // Demo: city stub geocode. Production: Google Address Validation / Places.
          const g = demoGeocode(next.homeAddress);
          next.homeLat = g.lat;
          next.homeLng = g.lng;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'photoUrl') &&
          !patch.photoUrl
        ) {
          delete next.photoUrl;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'homeUnit') &&
          !next.homeUnit?.trim()
        ) {
          delete next.homeUnit;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'refereeLevel') &&
          (patch.refereeLevel == null || Number.isNaN(patch.refereeLevel as number))
        ) {
          delete next.refereeLevel;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'assessedLevel') &&
          (patch.assessedLevel == null ||
            Number.isNaN(patch.assessedLevel as number))
        ) {
          delete next.assessedLevel;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'requestedAssessedLevel') &&
          (patch.requestedAssessedLevel == null ||
            Number.isNaN(patch.requestedAssessedLevel as number))
        ) {
          delete next.requestedAssessedLevel;
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, 'fanTeamOther') &&
          !next.fanTeamOther?.trim()
        ) {
          delete next.fanTeamOther;
        }
        next.profileComplete = isProfileComplete(next);
        return next;
      }),
    }));
    if (patch.email !== undefined || patch.roles !== undefined) {
      this.relinkTeamAdmins();
    }
  }

  /** Ensure teamAdmin users pick up teamIds from Team.contactEmails. */
  relinkTeamAdmins(): void {
    this.set((s) => ({
      ...s,
      users: linkTeamAdminsByEmail(s.users, s.teams),
    }));
  }

  /** Demo Contacts-tab ingest (team_name, email, phone?). */
  ingestContactsRows(rows: ContactRow[]): void {
    this.set((s) => {
      const teams = applyContactRowsToTeams(s.teams, rows, () => id('team'));
      return {
        ...s,
        teams,
        users: linkTeamAdminsByEmail(s.users, teams),
      };
    });
  }

  updateTeamContacts(
    teamId: string,
    contactEmails: string[],
    contactPhones?: string[],
  ): void {
    this.set((s) => {
      const teams = s.teams.map((t) => {
        if (t.id !== teamId) return t;
        const emails = [
          ...new Set(
            contactEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
          ),
        ];
        const phones = contactPhones
          ?.map((p) => p.trim())
          .filter(Boolean);
        return {
          ...t,
          contactEmails: emails,
          contactPhones: phones?.length ? phones : undefined,
        };
      });
      return {
        ...s,
        teams,
        users: linkTeamAdminsByEmail(s.users, teams),
      };
    });
  }

  syncFromSheet(): void {
    this.set((s) => ({
      ...s,
      org: { ...s.org, sheetSyncedAt: new Date().toISOString() },
    }));
    this.relinkTeamAdmins();
    const assigner = this.state.users.find((u) => u.roles.includes('assigner'));
    if (assigner) {
      this.notify('sheet_sync', assigner.uid, 'Sheet synced', 'Schedule cache refreshed from Sheet.');
    }
  }

  importCsv(text: string): number {
    const rows = parseScheduleCsv(text);
    this.ingestCsvRows(rows);
    return rows.length;
  }

  private ingestCsvRows(rows: CsvMatchRow[]): void {
    this.set((s) => {
      const teams = [...s.teams];
      const ensureTeam = (name: string): string => {
        const existing = teams.find(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) return existing.id;
        const t = { id: id('team'), name, contactEmails: [] as string[] };
        teams.push(t);
        return t.id;
      };
      const matches = [...s.matches];
      for (const row of rows) {
        const homeTeamId = ensureTeam(row.home_team);
        const awayTeamId = ensureTeam(row.away_team);
        const geo = demoGeocode(row.location);
        const existing = matches.findIndex((m) => m.sheetRowKey === row.match_id);
        const base: Match = {
          id: existing >= 0 ? matches[existing].id : id('m'),
          sheetRowKey: row.match_id,
          status: existing >= 0 ? matches[existing].status : 'draft',
          kickoffAt: csvRowToKickoffIso(row),
          venueName: row.location,
          venueAddress: row.location,
          venueLat: geo.lat,
          venueLng: geo.lng,
          homeTeamId,
          awayTeamId,
          homeTeamName: row.home_team,
          awayTeamName: row.away_team,
          competition: row.competition,
          notes: row.notes,
          level:
            row.level ||
            (existing >= 0 ? matches[existing].level : s.org.matchLevels[0] || 'D1'),
          gender: normalizeGender(
            row.gender,
            existing >= 0 ? matches[existing].gender : 'men',
          ),
          flightProvided: existing >= 0 ? matches[existing].flightProvided : false,
          housingProvided: existing >= 0 ? matches[existing].housingProvided : false,
          crew: existing >= 0 ? matches[existing].crew : emptyCrew(),
          homeConfirmedAt: existing >= 0 ? matches[existing].homeConfirmedAt : undefined,
          awayConfirmedAt: existing >= 0 ? matches[existing].awayConfirmedAt : undefined,
          feeOverride: existing >= 0 ? matches[existing].feeOverride : undefined,
        };
        if (existing >= 0) {
          matches[existing] = {
            ...applySheetFacts(matches[existing], {
              kickoffAt: base.kickoffAt,
              venueName: base.venueName,
              venueAddress: base.venueAddress,
            }),
            level: base.level,
            gender: base.gender,
            competition: base.competition ?? matches[existing].competition,
          };
        } else {
          matches.push(base);
        }
      }
      return {
        ...s,
        teams,
        matches,
        org: { ...s.org, sheetSyncedAt: new Date().toISOString() },
      };
    });
  }

  releaseMatches(opts: { all?: boolean; from?: string; to?: string }): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.status !== 'draft') return m;
        if (!opts.all && opts.from && opts.to) {
          const t = new Date(m.kickoffAt).getTime();
          if (t < new Date(opts.from).getTime() || t > new Date(opts.to).getTime()) {
            return m;
          }
        }
        let released = applyLevelCrewDefaultsIfStock(
          m,
          s.org.defaultCrewByLevel,
        );
        released = releaseMatch(released);
        const homeAdmins = s.users.filter(
          (u) => u.roles.includes('teamAdmin') && u.teamIds.includes(m.homeTeamId),
        );
        const awayAdmins = s.users.filter(
          (u) => u.roles.includes('teamAdmin') && u.teamIds.includes(m.awayTeamId),
        );
        queueMicrotask(() => {
          for (const a of [...homeAdmins, ...awayAdmins]) {
            this.notify(
              'schedule_released',
              a.uid,
              'Match ready for confirmation',
              `${m.homeTeamName} vs ${m.awayTeamName} — confirm date, time, and location.`,
            );
          }
        });
        return released;
      }),
    }));
  }

  confirmMatchTeam(matchId: string, side: 'home' | 'away'): void {
    this.setTeamDetailsConfirmed(matchId, side, true);
  }

  /** MO / assigner can mark details confirmed after offline email, or clear it. */
  setTeamDetailsConfirmed(
    matchId: string,
    side: 'home' | 'away',
    confirmed: boolean,
  ): void {
    let persisted: Match | null = null;
    this.set((s) => {
      const matches = s.matches.map((m) => {
        if (m.id !== matchId) return m;
        const next = applyTeamDetailsConfirmed(m, side, confirmed);
        persisted = next;
        if (
          confirmed &&
          (next.status === 'team_confirmed' || next.status === 'crew_pending')
        ) {
          const assigner = s.users.find((u) => u.roles.includes('assigner'));
          if (assigner && crewPeople(next.crew.mo).length === 0) {
            queueMicrotask(() =>
              this.notify(
                'needs_officials',
                assigner.uid,
                'Match needs officials',
                `${next.homeTeamName} vs ${next.awayTeamName} is confirmed by both teams.`,
              ),
            );
          }
          for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as CrewSlot[]) {
            for (const c of crewPeople(next.crew[slot])) {
              if (c.status === 'official' && c.userId) {
                queueMicrotask(() =>
                  this.notify(
                    'assignment_official',
                    c.userId!,
                    'You have an official assignment',
                    `Confirm details for ${next.homeTeamName} vs ${next.awayTeamName}.`,
                  ),
                );
              }
            }
          }
        }
        return next;
      });
      return { ...s, matches };
    });
    if (isLiveDataMode() && persisted) {
      void saveMatchTeamConfirmation(defaultOrgId(), persisted).catch((err) =>
        console.error('saveMatchTeamConfirmation failed', err),
      );
    }
  }

  proposeChange(
    matchId: string,
    teamId: string,
    fields: { kickoffAt?: string; venueName?: string; venueAddress?: string },
    userId?: string,
  ): void {
    const match = this.state.matches.find((m) => m.id === matchId);
    if (!match) return;
    const user = userId
      ? this.state.users.find((u) => u.uid === userId)
      : undefined;
    const proposal: ChangeProposal = {
      id: id('p'),
      matchId,
      proposedByTeamId: teamId,
      proposedByUserId: userId,
      proposedByName: user?.displayName,
      ...fields,
      previousKickoffAt: match.kickoffAt,
      previousVenueName: match.venueName,
      previousVenueAddress: match.venueAddress,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.set((s) => ({
      ...s,
      proposals: [proposal, ...s.proposals],
      matches: s.matches.map((m) =>
        m.id === matchId ? beginChangeProposed(m) : m,
      ),
    }));
    if (isLiveDataMode()) {
      void createChangeProposalInFirestore(defaultOrgId(), proposal).catch(
        (err) => console.error('createChangeProposalInFirestore failed', err),
      );
    }
    const otherTeamId =
      teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    for (const u of this.state.users) {
      if (u.roles.includes('teamAdmin') && u.teamIds.includes(otherTeamId)) {
        this.notify('change_proposed', u.uid, 'Change proposed', 'Accept or deny the proposed schedule change.');
      }
      if (u.roles.includes('assigner')) {
        this.notify('change_proposed', u.uid, 'Acknowledge change proposal', 'A team proposed a schedule change.');
      }
    }
  }

  acceptProposalOtherTeam(proposalId: string, userId: string): void {
    const user = this.state.users.find((u) => u.uid === userId);
    const at = new Date().toISOString();
    const existing = this.state.proposals.find((x) => x.id === proposalId);
    this.set((s) => ({
      ...s,
      proposals: s.proposals.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              otherTeamAcceptedAt: at,
              otherTeamAcceptedByUserId: userId,
              otherTeamAcceptedByName: user?.displayName,
            }
          : p,
      ),
    }));
    if (isLiveDataMode() && existing) {
      void updateChangeProposalInFirestore(
        defaultOrgId(),
        existing.matchId,
        proposalId,
        {
          otherTeamAcceptedAt: at,
          otherTeamAcceptedByUserId: userId,
          otherTeamAcceptedByName: user?.displayName,
        },
      ).catch((err) =>
        console.error('updateChangeProposalInFirestore failed', err),
      );
    }
    this.tryCompleteProposal(proposalId);
  }

  denyProposalOtherTeam(
    proposalId: string,
    userId: string,
    reason: string,
  ): void {
    const trimmed = (reason ?? '').trim();
    if (!trimmed) return;
    const user = this.state.users.find((u) => u.uid === userId);
    const at = new Date().toISOString();
    const existing = this.state.proposals.find((x) => x.id === proposalId);
    if (!existing) return;
    // Allow deny while still pending (ignore if already resolved).
    if (existing.status !== 'pending') return;

    this.set((s) => ({
      ...s,
      proposals: s.proposals.map((x) =>
        x.id === proposalId
          ? {
              ...x,
              status: 'rejected_by_other_team' as const,
              otherTeamDeniedAt: at,
              otherTeamDeniedByUserId: userId,
              otherTeamDeniedByName: user?.displayName,
              denyReason: trimmed,
            }
          : x,
      ),
      matches: s.matches.map((m) => {
        if (m.id !== existing.matchId) return m;
        // Always leave change_proposed so list/detail stop showing that status.
        const nextStatus =
          m.homeConfirmedAt && m.awayConfirmedAt
            ? ('team_confirmed' as const)
            : ('pending_team_review' as const);
        return {
          ...m,
          status: nextStatus,
        };
      }),
    }));

    if (isLiveDataMode()) {
      void updateChangeProposalInFirestore(
        defaultOrgId(),
        existing.matchId,
        proposalId,
        {
          status: 'rejected_by_other_team',
          otherTeamDeniedAt: at,
          otherTeamDeniedByUserId: userId,
          otherTeamDeniedByName: user?.displayName,
          denyReason: trimmed,
        },
      ).catch((err) =>
        console.error('updateChangeProposalInFirestore failed', err),
      );
      const nextMatch = this.state.matches.find((m) => m.id === existing.matchId);
      if (nextMatch) {
        void saveMatchTeamConfirmation(defaultOrgId(), nextMatch).catch((err) =>
          console.error('saveMatchTeamConfirmation failed', err),
        );
      }
    }

    for (const u of this.state.users) {
      if (
        u.roles.includes('teamAdmin') &&
        u.teamIds.includes(existing.proposedByTeamId)
      ) {
        this.notify(
          'change_proposed',
          u.uid,
          'Change proposal denied',
          `${user?.displayName ?? 'Other team'}: ${trimmed}`,
        );
      }
    }
  }

  acknowledgeProposal(proposalId: string, userId?: string): void {
    const user = userId
      ? this.state.users.find((u) => u.uid === userId)
      : undefined;
    const existing = this.state.proposals.find((x) => x.id === proposalId);
    const at = new Date().toISOString();
    this.set((s) => ({
      ...s,
      proposals: s.proposals.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              assignerAckAt: at,
              assignerAckByUserId: userId,
              assignerAckByName: user?.displayName,
            }
          : p,
      ),
    }));
    if (isLiveDataMode() && existing) {
      void updateChangeProposalInFirestore(
        defaultOrgId(),
        existing.matchId,
        proposalId,
        {
          assignerAckAt: at,
          assignerAckByUserId: userId,
          assignerAckByName: user?.displayName,
        },
      ).catch((err) =>
        console.error('updateChangeProposalInFirestore failed', err),
      );
    }
    // If other team already accepted, apply local facts (idempotent) + Sheet write-back.
    this.tryCompleteProposal(proposalId);
    void this.writebackProposalToSheet(proposalId);
  }

  /**
   * When both other-team accept + assigner ack are done, push facts to Schedule SoR
   * via Admin SDK (live). Demo mode applies facts locally in tryCompleteProposal.
   */
  private async writebackProposalToSheet(proposalId: string): Promise<void> {
    const p = this.state.proposals.find((x) => x.id === proposalId);
    if (!p?.otherTeamAcceptedAt || !p.assignerAckAt) return;
    if (!isFirebaseConfigured) return;

    try {
      await callProposalWriteback({
        orgId: defaultOrgId(),
        matchId: p.matchId,
        proposalId: p.id,
        kickoffAt: p.kickoffAt,
        venueName: p.venueName,
        venueAddress: p.venueAddress,
      });
      let appliedMatch: Match | undefined;
      this.set((s) => ({
        ...s,
        proposals: s.proposals.map((x) =>
          x.id === proposalId ? { ...x, status: 'approved' as const } : x,
        ),
        matches: s.matches.map((m) => {
          if (m.id !== p.matchId) return m;
          appliedMatch = applySheetFacts(m, {
            kickoffAt: p.kickoffAt,
            venueName: p.venueName,
            venueAddress: p.venueAddress,
          });
          return appliedMatch!;
        }),
        org: {
          ...s.org,
          sheetSyncedAt: new Date().toISOString(),
          sheetSyncError: undefined,
        },
      }));
      if (appliedMatch) {
        this.notifyOfficialsReconfirmAfterProposal(appliedMatch, p);
        for (const u of this.state.users) {
          if (
            u.roles.includes('teamAdmin') &&
            u.teamIds.includes(p.proposedByTeamId)
          ) {
            this.notify(
              'change_proposed',
              u.uid,
              'Schedule change applied',
              'The assigner wrote the accepted change back to the Sheet.',
            );
          }
        }
      }
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Sheet write-back failed. Open Upload and sync, or retry acknowledge.';
      this.set((s) => ({
        ...s,
        org: { ...s.org, sheetSyncError: message },
      }));
    }
  }

  private notifyProposalOtherTeamAccepted(p: ChangeProposal): void {
    for (const u of this.state.users) {
      if (
        u.roles.includes('teamAdmin') &&
        u.teamIds.includes(p.proposedByTeamId)
      ) {
        this.notify(
          'change_proposed',
          u.uid,
          'Change proposal accepted',
          p.otherTeamAcceptedByName
            ? `Accepted by ${p.otherTeamAcceptedByName}. Awaiting assigner write-back.`
            : 'The other team accepted. Awaiting assigner write-back.',
        );
      }
      if (u.roles.includes('assigner') && !p.assignerAckAt) {
        this.notify(
          'change_proposed',
          u.uid,
          'Schedule change accepted',
          'Other team accepted a proposal — acknowledge when you’ve seen it to write back to the Sheet.',
        );
      }
    }
  }

  private notifyOfficialsReconfirmAfterProposal(
    match: Match,
    p: ChangeProposal,
  ): void {
    for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as CrewSlot[]) {
      for (const c of crewPeople(match.crew[slot])) {
        if (c.userId) {
          this.notify(
            'availability_check',
            c.userId,
            'Reconfirm your appointment',
            `${match.homeTeamName} vs ${match.awayTeamName} changed — confirm or decline the new details.`,
          );
        }
      }
    }
    for (const u of this.state.users) {
      if (
        u.roles.includes('teamAdmin') &&
        u.teamIds.includes(p.proposedByTeamId)
      ) {
        this.notify(
          'change_proposed',
          u.uid,
          'Change proposal accepted',
          p.otherTeamAcceptedByName
            ? `Accepted by ${p.otherTeamAcceptedByName}. Schedule updated.`
            : 'The other team accepted. Schedule updated.',
        );
      }
    }
  }

  /** Demo: apply facts when other team accepts. Live: defer until assigner write-back. */
  private tryCompleteProposal(proposalId: string): void {
    const p = this.state.proposals.find((x) => x.id === proposalId);
    if (!p || !p.otherTeamAcceptedAt || p.status === 'approved') {
      return;
    }
    if (p.status !== 'pending') {
      return;
    }

    if (isLiveDataMode()) {
      this.notifyProposalOtherTeamAccepted(p);
      if (p.assignerAckAt) {
        void this.writebackProposalToSheet(proposalId);
      }
      return;
    }

    this.set((s) => {
      const matches = s.matches.map((m) => {
        if (m.id !== p.matchId) return m;
        return applySheetFacts(m, {
          kickoffAt: p.kickoffAt,
          venueName: p.venueName,
          venueAddress: p.venueAddress,
        });
      });
      return {
        ...s,
        matches,
        proposals: s.proposals.map((x) =>
          x.id === proposalId ? { ...x, status: 'approved' } : x,
        ),
        org: { ...s.org, sheetSyncedAt: new Date().toISOString() },
      };
    });
    const match = this.state.matches.find((m) => m.id === p.matchId);
    if (match) {
      this.notifyOfficialsReconfirmAfterProposal(match, p);
      for (const u of this.state.users) {
        if (u.roles.includes('assigner') && !p.assignerAckAt) {
          this.notify(
            'change_proposed',
            u.uid,
            'Schedule change accepted',
            'Other team accepted a proposal — acknowledge when you’ve seen it to write back to the Sheet.',
          );
        }
      }
    }
    if (p.assignerAckAt) {
      void this.writebackProposalToSheet(proposalId);
    }
  }

  assignCrew(
    matchId: string,
    slot: CrewSlot,
    userId: string,
    viaRequest = false,
    assignmentId?: string,
  ): void {
    const user = this.state.users.find((u) => u.uid === userId);
    if (!user) return;
    let assignedMatch: Match | undefined;
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        assignedMatch = assignOfficial(m, slot, user, {
          viaRequest,
          internal: !(m.homeConfirmedAt && m.awayConfirmedAt),
          assignmentId,
        });
        return assignedMatch;
      }),
      requests: viaRequest
        ? s.requests.map((r) =>
            r.matchId === matchId && r.userId === userId && r.status === 'pending'
              ? { ...r, status: 'approved' }
              : r,
          )
        : s.requests,
    }));
    if (assignedMatch) {
      const role = slot.toUpperCase();
      const fixture = `${assignedMatch.homeTeamName} vs ${assignedMatch.awayTeamName}`;
      queueMicrotask(() =>
        this.notify(
          'assignment',
          userId,
          `Assigned: ${fixture}`,
          `You've been assigned as ${role} for ${fixture}.`,
        ),
      );
    }
  }

  /** Assigner clears one assignee (resets to empty block). */
  unassignCrew(matchId: string, slot: CrewSlot, assignmentId?: string): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        return markUnavailableAndRelease(
          m,
          slot,
          'Cleared by assigner',
          'released',
          assignmentId,
        );
      }),
    }));
  }

  assignCmo(matchId: string, userId: string, cmoId?: string): void {
    const user = this.state.users.find((u) => u.uid === userId);
    if (!user) return;
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        const existing = m.cmo ?? [];
        if (existing.some((c) => c.userId === user.uid)) return m;
        const emptyIdx = cmoId
          ? existing.findIndex((c) => c.id === cmoId && !c.userId)
          : existing.findIndex((c) => !c.userId);
        if (emptyIdx >= 0) {
          const next = existing.map((c, i) =>
            i === emptyIdx
              ? {
                  id: c.id ?? newCmoId(),
                  userId: user.uid,
                  userName: user.displayName,
                }
              : c,
          );
          return { ...m, cmo: next };
        }
        return {
          ...m,
          cmo: [
            ...existing,
            {
              id: cmoId ?? newCmoId(),
              userId: user.uid,
              userName: user.displayName,
            },
          ],
        };
      }),
    }));
  }

  clearCmo(matchId: string, userId?: string, cmoId?: string): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        const list = m.cmo ?? [];
        if (!list.length) return m;
        const next = list.map((c) => {
          const hit =
            (cmoId && c.id === cmoId) ||
            (userId && c.userId === userId);
          if (!hit) return c;
          return { id: c.id ?? newCmoId() };
        });
        return { ...m, cmo: next };
      }),
    }));
  }

  addCrewRole(matchId: string, role: RequestableSlot): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId ? withCrewRoleAdded(m, role) : m,
      ),
    }));
  }

  removeCrewRole(
    matchId: string,
    role: RequestableSlot,
    blockId?: string,
  ): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        if (blockId) return withCrewBlockRemoved(m, role, blockId);
        if (role === 'cmo') return { ...m, cmo: undefined };
        if (role === 'mo') {
          return {
            ...m,
            crew: {
              ...m.crew,
              mo: [emptyAssignment('mo')],
            },
          };
        }
        return { ...m, crew: { ...m.crew, [role]: [] } };
      }),
    }));
  }

  confirmCrewSlot(matchId: string, slot: CrewSlot, assignmentId?: string): void {
    this.set((s) => {
      const matches = s.matches.map((m) => {
        if (m.id !== matchId) return m;
        const next = confirmOfficialSlot(m, slot, assignmentId);
        if (
          slot === 'mo' &&
          isCrewVisibleToTeams(next) &&
          !isCrewVisibleToTeams(m)
        ) {
          for (const u of s.users) {
            if (
              u.roles.includes('teamAdmin') &&
              (u.teamIds.includes(m.homeTeamId) || u.teamIds.includes(m.awayTeamId))
            ) {
              queueMicrotask(() =>
                this.notify(
                  'crew_revealed',
                  u.uid,
                  'Officials assigned',
                  `Crew is now visible for ${m.homeTeamName} vs ${m.awayTeamName}.`,
                ),
              );
            }
          }
        }
        return next;
      });
      return { ...s, matches };
    });
  }

  officialUnavailable(
    matchId: string,
    slot: CrewSlot,
    reason: string,
    action:
      | 'unavailable_on_change'
      | 'declined'
      | 't72_no'
      | 'released' = 'declined',
    assignmentId?: string,
  ): void {
    this.set((s) => {
      const matches = s.matches.map((m) => {
        if (m.id !== matchId) return m;
        return markUnavailableAndRelease(m, slot, reason, action, assignmentId);
      });
      return { ...s, matches };
    });
    const match = this.state.matches.find((m) => m.id === matchId);
    const assigner = this.state.users.find((u) => u.roles.includes('assigner'));
    if (match && assigner) {
      this.notify(
        'official_unavailable',
        assigner.uid,
        'Official unavailable — auto-released',
        `Reason: ${reason}. Check assignment history for ${match.homeTeamName} vs ${match.awayTeamName}.`,
      );
      for (const u of this.state.users) {
        if (
          u.roles.includes('teamAdmin') &&
          (u.teamIds.includes(match.homeTeamId) || u.teamIds.includes(match.awayTeamId))
        ) {
          this.notify(
            'official_reassigning',
            u.uid,
            'Official being reassigned',
            'An official marked unavailable for this match.',
          );
        }
      }
    }
  }

  setMatchFlags(
    matchId: string,
    flags: Partial<
      Pick<
        Match,
        | 'flightProvided'
        | 'housingProvided'
        | 'feeOverride'
        | 'level'
        | 'gender'
        | 'notes'
        | 'cmo'
      >
    >,
  ): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => (m.id === matchId ? { ...m, ...flags } : m)),
    }));
  }

  setOrgMatchLevels(levels: string[]): void {
    const cleaned = levels.map((l) => l.trim()).filter(Boolean);
    this.set((s) => ({
      ...s,
      org: {
        ...s.org,
        matchLevels: cleaned.length ? cleaned : [...DEFAULT_MATCH_LEVELS],
      },
    }));
  }

  setOrgCrewDefaults(defaultCrewByLevel: DefaultCrewByLevel): void {
    this.set((s) => ({
      ...s,
      org: { ...s.org, defaultCrewByLevel },
    }));
  }

  applyCrewDefaultsToStockMatches(
    defaultCrewByLevel?: DefaultCrewByLevel,
  ): number {
    const configured =
      defaultCrewByLevel ?? this.state.org.defaultCrewByLevel;
    let count = 0;
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (!matchEligibleForCrewDefaultsReapply(m)) return m;
        count += 1;
        return applyLevelCrewDefaults(m, configured);
      }),
    }));
    return count;
  }

  setOrgCompetitions(competitions: string[]): void {
    const cleaned = competitions.map((c) => c.trim()).filter(Boolean);
    this.set((s) => ({
      ...s,
      org: {
        ...s.org,
        competitions: cleaned.length ? cleaned : [...DEFAULT_COMPETITIONS],
      },
    }));
  }

  updateOrgFees(patch: Partial<OrgSettings>): void {
    this.set((s) => ({ ...s, org: { ...s.org, ...patch } }));
  }

  addAvailability(range: Omit<AvailabilityRange, 'id'>): void {
    this.set((s) => ({
      ...s,
      availability: [...s.availability, { ...range, id: id('av') }],
    }));
  }

  removeAvailability(rangeId: string): void {
    this.set((s) => ({
      ...s,
      availability: s.availability.filter((r) => r.id !== rangeId),
    }));
  }

  /** Replace all availability rows for one user (calendar edits). */
  replaceUserAvailability(
    userId: string,
    ranges: AvailabilityRange[],
  ): void {
    this.set((s) => ({
      ...s,
      availability: [
        ...s.availability.filter((r) => r.userId !== userId),
        ...ranges.filter((r) => r.userId === userId),
      ],
    }));
  }

  /**
   * Merge live Firestore ranges for the given users into local state
   * (leaves other users' demo/local ranges alone).
   */
  applyLiveAvailability(
    userIds: string[],
    ranges: AvailabilityRange[],
  ): void {
    const ids = new Set(userIds);
    this.set((s) => ({
      ...s,
      availability: [
        ...s.availability.filter((r) => !ids.has(r.userId)),
        ...ranges.filter((r) => ids.has(r.userId)),
      ],
    }));
  }

  /** Allocate a stable-ish local id for new availability ranges. */
  nextAvailabilityId(): string {
    return id('av');
  }

  requestGame(
    matchId: string,
    userId: string,
    preferredSlot: RequestableSlot,
    note?: string,
  ): string | null {
    const user = this.state.users.find((u) => u.uid === userId);
    if (!user) return null;
    if (!preferredSlot) return null;
    const existing = this.state.requests.find(
      (r) => r.matchId === matchId && r.userId === userId && r.status === 'pending',
    );
    if (existing) return null;
    const req: GameRequest = {
      id: id('gr'),
      matchId,
      userId,
      userName: user.displayName,
      preferredSlot,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.set((s) => ({ ...s, requests: [req, ...s.requests] }));
    const assigner = this.state.users.find((u) => u.roles.includes('assigner'));
    if (assigner) {
      this.notify(
        'game_request',
        assigner.uid,
        'Game request',
        `${user.displayName} requested a match.`,
      );
    }
    return req.id;
  }

  /**
   * Team Admin submits a new-fixture request (pending assigner approval).
   * Returns the created request id, or null if validation fails.
   */
  submitFixtureRequest(input: {
    requesterUserId: string;
    requesterTeamId: string;
    side: 'home' | 'away';
    opponentTeamId: string;
    kickoffAt: string;
    venueName: string;
    venueAddress: string;
    competition?: string;
    level: string;
    gender: MatchGender;
    notes?: string;
    flightProvided: boolean;
    housingProvided: boolean;
  }): string | null {
    const user = this.state.users.find((u) => u.uid === input.requesterUserId);
    if (!user) return null;
    if (!user.teamIds.includes(input.requesterTeamId)) return null;
    if (input.requesterTeamId === input.opponentTeamId) return null;
    const myTeam = this.state.teams.find((t) => t.id === input.requesterTeamId);
    const opp = this.state.teams.find((t) => t.id === input.opponentTeamId);
    if (!myTeam || !opp) return null;
    if (!input.venueName.trim() || !input.venueAddress.trim()) return null;
    if (!input.kickoffAt || Number.isNaN(new Date(input.kickoffAt).getTime())) {
      return null;
    }
    if (!input.level.trim()) return null;

    const homeTeam = input.side === 'home' ? myTeam : opp;
    const awayTeam = input.side === 'home' ? opp : myTeam;
    const req: FixtureRequest = {
      id: id('fr'),
      orgId: this.state.org.id,
      requesterUserId: user.uid,
      requesterName: user.displayName,
      requesterTeamId: input.requesterTeamId,
      side: input.side,
      opponentTeamId: input.opponentTeamId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      kickoffAt: input.kickoffAt,
      venueName: input.venueName.trim(),
      venueAddress: input.venueAddress.trim(),
      competition: input.competition?.trim() || undefined,
      level: input.level.trim(),
      gender: input.gender,
      notes: input.notes?.trim() || undefined,
      flightProvided: input.flightProvided,
      housingProvided: input.housingProvided,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.set((s) => ({
      ...s,
      fixtureRequests: [req, ...s.fixtureRequests],
    }));
    const assigner = this.state.users.find((u) => u.roles.includes('assigner'));
    if (assigner) {
      this.notify(
        'fixture_request',
        assigner.uid,
        'New fixture request',
        `${user.displayName} requested ${req.homeTeamName} vs ${req.awayTeamName}.`,
      );
    }
    return req.id;
  }

  /**
   * Team Admin saves, submits, or declines referee (MO) feedback.
   * One document per (matchId, reportingTeamId). Returns feedback id or null.
   */
  saveCoachFeedback(feedback: CoachFeedback): string | null {
    const user = this.state.users.find((u) => u.uid === feedback.submitterUserId);
    if (!user || !user.roles.includes('teamAdmin')) return null;
    if (!user.teamIds.includes(feedback.reportingTeamId)) return null;
    if (
      feedback.reportingTeamId !== feedback.homeTeamId &&
      feedback.reportingTeamId !== feedback.awayTeamId
    ) {
      return null;
    }
    const match = this.state.matches.find((m) => m.id === feedback.matchId);
    if (!match) return null;
    const expectedId = coachFeedbackDocId(
      feedback.matchId,
      feedback.reportingTeamId,
    );
    if (feedback.id !== expectedId) return null;

    const existing = this.state.coachFeedback.find((f) => f.id === feedback.id);

    const next: CoachFeedback = {
      ...feedback,
      slot: 'mo',
      edits: feedback.edits ?? existing?.edits ?? [],
      createdAt: existing?.createdAt ?? feedback.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.set((s) => ({
      ...s,
      coachFeedback: existing
        ? s.coachFeedback.map((f) => (f.id === next.id ? next : f))
        : [next, ...s.coachFeedback],
    }));
    return next.id;
  }

  /** Optimistic upsert after a live Firestore write (before snapshot arrives). */
  upsertCoachFeedbackLocal(feedback: CoachFeedback): void {
    this.set((s) => {
      const existing = s.coachFeedback.find((f) => f.id === feedback.id);
      return {
        ...s,
        coachFeedback: existing
          ? s.coachFeedback.map((f) => (f.id === feedback.id ? feedback : f))
          : [feedback, ...s.coachFeedback],
      };
    });
  }

  /** Assigner declines a pending fixture request. */
  declineFixtureRequest(
    requestId: string,
    reviewedByUserId: string,
    reason?: string,
  ): void {
    const req = this.state.fixtureRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;
    const at = new Date().toISOString();
    this.set((s) => ({
      ...s,
      fixtureRequests: s.fixtureRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'declined' as const,
              declineReason: reason?.trim() || undefined,
              reviewedAt: at,
              reviewedByUserId,
            }
          : r,
      ),
    }));
    this.notify(
      'fixture_request_declined',
      req.requesterUserId,
      'Fixture request declined',
      reason?.trim() || 'The assigner declined your fixture request.',
    );
  }

  /**
   * Assigner approves a pending fixture request (demo: create match in memory).
   * Live mode should call the approveFixtureRequest Cloud Function instead.
   */
  approveFixtureRequest(
    requestId: string,
    reviewedByUserId: string,
  ): string | null {
    const req = this.state.fixtureRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return null;
    const { matchId, sheetRowKey } = newAppMatchId();
    const at = new Date().toISOString();
    const match = matchFromFixtureRequest(req, { matchId, sheetRowKey, at });
    this.set((s) => ({
      ...s,
      matches: [match, ...s.matches],
      fixtureRequests: s.fixtureRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'approved' as const,
              matchId,
              sheetRowKey,
              reviewedAt: at,
              reviewedByUserId,
            }
          : r,
      ),
    }));
    this.notify(
      'fixture_request_approved',
      req.requesterUserId,
      'Fixture request approved',
      `${match.homeTeamName} vs ${match.awayTeamName} is on the schedule.`,
    );
    const otherTeamId =
      req.side === 'home' ? req.awayTeamId : req.homeTeamId;
    for (const u of this.state.users) {
      if (
        u.uid === req.requesterUserId ||
        !u.roles.includes('teamAdmin') ||
        !u.teamIds.includes(otherTeamId)
      ) {
        continue;
      }
      this.notify(
        'fixture_request_approved',
        u.uid,
        'New match for confirmation',
        `${match.homeTeamName} vs ${match.awayTeamName} — please confirm.`,
      );
    }
    return matchId;
  }

  /**
   * Demo: request Team Admin for clubs. Auto-approves when email is on Contacts.
   */
  submitTeamLinkRequests(
    userId: string,
    teamIds: string[],
  ): { autoApproved: string[]; pending: string[] } {
    const user = this.state.users.find((u) => u.uid === userId);
    if (!user) return { autoApproved: [], pending: [] };
    const unique = [...new Set(teamIds.filter(Boolean))];
    const autoApproved: string[] = [];
    const pending: string[] = [];
    const now = new Date().toISOString();

    this.set((s) => {
      let users = s.users.map((u) => {
        if (u.uid !== userId) return u;
        const roles = u.roles.includes('teamAdmin')
          ? u.roles.filter((r) => r !== 'fan')
          : [...u.roles.filter((r) => r !== 'fan'), 'teamAdmin' as const];
        return { ...u, roles };
      });
      let teamLinkRequests = [...s.teamLinkRequests];
      let teams = [...s.teams];

      for (const teamId of unique) {
        const team = teams.find((t) => t.id === teamId);
        if (!team) continue;
        if (users.find((u) => u.uid === userId)?.teamIds.includes(teamId)) {
          autoApproved.push(teamId);
          continue;
        }
        if (
          teamLinkRequests.some(
            (r) =>
              r.requesterUserId === userId &&
              r.teamId === teamId &&
              r.status === 'pending',
          )
        ) {
          pending.push(teamId);
          continue;
        }

        const onContacts = emailMatchesTeamContacts(user.email, team);
        const req: TeamLinkRequest = {
          id: id('tlr'),
          orgId: s.org.id,
          requesterUserId: userId,
          requesterName: user.displayName,
          requesterEmail: user.email,
          teamId,
          teamName: team.name,
          status: onContacts ? 'approved' : 'pending',
          createdAt: now,
          reviewedAt: onContacts ? now : undefined,
          autoApproved: onContacts || undefined,
        };
        teamLinkRequests = [req, ...teamLinkRequests];

        if (onContacts) {
          users = users.map((u) =>
            u.uid === userId
              ? {
                  ...u,
                  teamIds: u.teamIds.includes(teamId)
                    ? u.teamIds
                    : [...u.teamIds, teamId],
                }
              : u,
          );
          teams = teams.map((t) => {
            if (t.id !== teamId) return t;
            const emails = t.contactEmails.map((e) => e.toLowerCase());
            if (emails.includes(user.email.trim().toLowerCase())) return t;
            return {
              ...t,
              contactEmails: [...t.contactEmails, user.email.trim()],
            };
          });
          autoApproved.push(teamId);
        } else {
          pending.push(teamId);
          const assigner = users.find((u) => u.roles.includes('assigner'));
          if (assigner) {
            // notify after set via side effect below
          }
        }
      }

      return { ...s, users, teams, teamLinkRequests };
    });

    for (const teamId of pending) {
      const team = this.state.teams.find((t) => t.id === teamId);
      for (const u of this.state.users) {
        const cares =
          u.roles.includes('assigner') ||
          (u.roles.includes('teamAdmin') && u.teamIds.includes(teamId));
        if (!cares) continue;
        this.notify(
          'team_link_request',
          u.uid,
          'Team Admin request',
          `${user.displayName} asked to manage ${team?.name ?? teamId}.`,
        );
      }
    }

    return { autoApproved, pending };
  }

  reviewTeamLinkRequest(
    requestId: string,
    reviewerUserId: string,
    decision: 'approve' | 'deny',
    denyReason?: string,
  ): void {
    const req = this.state.teamLinkRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;
    const reviewer = this.state.users.find((u) => u.uid === reviewerUserId);
    if (!reviewer) return;
    const canReview =
      reviewer.roles.includes('assigner') ||
      (reviewer.roles.includes('teamAdmin') &&
        reviewer.teamIds.includes(req.teamId));
    if (!canReview) return;

    const at = new Date().toISOString();

    if (decision === 'approve') {
      this.set((s) => {
        const users = s.users.map((u) => {
          if (u.uid !== req.requesterUserId) return u;
          const roles = u.roles.includes('teamAdmin')
            ? u.roles.filter((r) => r !== 'fan')
            : [...u.roles.filter((r) => r !== 'fan'), 'teamAdmin' as const];
          const teamIds = u.teamIds.includes(req.teamId)
            ? u.teamIds
            : [...u.teamIds, req.teamId];
          return { ...u, roles, teamIds };
        });
        const teams = s.teams.map((t) => {
          if (t.id !== req.teamId) return t;
          const e = req.requesterEmail.trim().toLowerCase();
          if (t.contactEmails.some((c) => c.toLowerCase() === e)) return t;
          return {
            ...t,
            contactEmails: [...t.contactEmails, req.requesterEmail.trim()],
          };
        });
        return {
          ...s,
          users,
          teams,
          teamLinkRequests: s.teamLinkRequests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: 'approved' as const,
                  reviewedAt: at,
                  reviewedByUserId: reviewerUserId,
                }
              : r,
          ),
        };
      });
      this.notify(
        'team_link_approved',
        req.requesterUserId,
        'Team Admin approved',
        `You can manage ${req.teamName}.`,
      );
      return;
    }

    this.set((s) => {
      const pendingLeft = s.teamLinkRequests.filter(
        (r) =>
          r.requesterUserId === req.requesterUserId &&
          r.id !== requestId &&
          r.status === 'pending',
      ).length;
      const users = s.users.map((u) => {
        if (u.uid !== req.requesterUserId) return u;
        const next = rolesAfterTeamLinkDenial(u, pendingLeft);
        return { ...u, roles: next.roles, teamIds: next.teamIds };
      });
      return {
        ...s,
        users,
        teamLinkRequests: s.teamLinkRequests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'denied' as const,
                reviewedAt: at,
                reviewedByUserId: reviewerUserId,
                denyReason: denyReason?.trim() || undefined,
              }
            : r,
        ),
      };
    });
    this.notify(
      'team_link_denied',
      req.requesterUserId,
      'Team Admin request denied',
      denyReason?.trim()
        ? `${req.teamName}: ${denyReason.trim()}`
        : `${req.teamName} was not approved.`,
    );
  }

  /** Replace fixture requests from live Firestore snapshot. */
  applyLiveFixtureRequests(fixtureRequests: FixtureRequest[]): void {
    this.set((s) => ({ ...s, fixtureRequests }));
  }

  /** Official withdraws a pending request, or dismisses a declined one. */
  withdrawRequest(requestId: string, userId: string): void {
    const req = this.state.requests.find((r) => r.id === requestId);
    if (!req) return;
    if (req.userId !== userId) return;
    if (req.status !== 'pending' && req.status !== 'declined') return;
    this.set((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== requestId),
    }));
  }

  declineRequest(requestId: string, reason?: string): void {
    const req = this.state.requests.find((r) => r.id === requestId);
    if (!req) return;
    this.set((s) => ({
      ...s,
      requests: s.requests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'declined', declineReason: reason }
          : r,
      ),
    }));
    this.notify(
      'game_request_declined',
      req.userId,
      'Game request declined',
      reason ?? 'The assigner declined your request.',
    );
  }

  approveRequest(
    requestId: string,
    slot?: RequestableSlot,
  ): void {
    const req = this.state.requests.find((r) => r.id === requestId);
    if (!req) return;
    const chosen = slot ?? req.preferredSlot;
    if (!chosen) return;
    if (chosen === 'cmo') {
      const user = this.state.users.find((u) => u.uid === req.userId);
      if (!user) return;
      this.set((s) => ({
        ...s,
        matches: s.matches.map((m) => {
          if (m.id !== req.matchId) return m;
          const existing = m.cmo ?? [];
          if (existing.some((c) => c.userId === user.uid)) return m;
          return {
            ...m,
            cmo: [
              ...existing,
              { userId: user.uid, userName: user.displayName },
            ],
          };
        }),
        requests: s.requests.map((r) =>
          r.id === requestId ? { ...r, status: 'approved' as const } : r,
        ),
      }));
      return;
    }
    this.assignCrew(req.matchId, chosen, req.userId, true);
  }

  startT72(matchId: string): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => (m.id === matchId ? enterT72(m) : m)),
    }));
  }

  answerT72Team(matchId: string, side: 'home' | 'away', answer: 'yes' | 'no'): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        return applyT72Team(m, side, answer);
      }),
    }));
  }

  answerT72Official(
    matchId: string,
    slot: CrewSlot,
    answer: 'yes' | 'no',
    reason?: string,
  ): void {
    if (answer === 'no') {
      this.officialUnavailable(matchId, slot, reason ?? 'T-72 decline', 't72_no');
      return;
    }
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        // If all assigned officials still present and we're in t72_officials_pending, lock
        const stillAssigned = (['mo', 'ar1', 'ar2', 'no4'] as CrewSlot[]).filter(
          (sl) => crewPeople(m.crew[sl]).length > 0,
        );
        if (
          m.status === 't72_officials_pending' &&
          stillAssigned.every(
            (sl) =>
              crewPeople(m.crew[sl]).every((a) => a.status === 'confirmed') ||
              sl === slot,
          )
        ) {
          return { ...m, status: 'locked_confirmed' };
        }
        return m;
      }),
    }));
  }

  cancelOrPostpone(matchId: string, kind: 'cancel' | 'postpone'): void {
    this.set((s) => ({
      ...s,
      matches: s.matches.map((m) => {
        if (m.id !== matchId) return m;
        return kind === 'cancel' ? cancelMatch(m) : postponeMatch(m);
      }),
    }));
  }
}

export const demoStore = new DemoStore();
