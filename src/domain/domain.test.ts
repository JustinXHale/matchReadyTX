import { describe, expect, it } from 'vitest';
import {
  distanceMiles,
  formatDistanceMi,
  estimateMileagePay,
  feeForSlot,
  matchEconomicsForUser,
} from '@/domain/economics';
import { defaultFees } from '@/domain/economics';
import {
  applyContactRowsToTeams,
  linkTeamAdminsByEmail,
  parseContactsPaste,
} from '@/domain/contacts';
import {
  formatHomeAddress,
  guessNamesFromEmail,
  isProfileComplete,
  applyFanXorRoleToggle,
  validateProfilePhoto,
} from '@/domain/profile';
import {
  emailMatchesTeamContacts,
  rolesAfterTeamLinkDenial,
  shouldShowPendingFanBrowse,
  shouldShowTeamAdminLens,
  validateTeamLinkRequestBatch,
} from '@/domain/teamLinkRequests';
import {
  applySheetFacts,
  cancelMatch,
  confirmTeam,
  postponeMatch,
  reactivateMatch,
  releaseMatch,
} from '@/domain/matchTransitions';
import { assignOfficial, confirmOfficialSlot, markUnavailableAndRelease } from '@/domain/crew';
import { emptyCrew, crewBlocks, crewPeople, emptyCrewBlocks, emptyAssignment, hasInsightsAccessRole, isCrewVisibleToTeams, type Match, type OrgSettings, type Team, type UserProfile, type RequestableSlot } from '@/domain/types';
import {
  matchFromFixtureRequest,
  newAppMatchId,
} from '@/domain/fixtureRequests';
import { matchFromFirestore } from '@/services/orgData';
import {
  availableCrewRolesToAdd,
  withCrewRoleAdded,
} from '@/domain/crewSize';
import {
  canOfficialRequestMatch,
  isKickoffUpcoming,
  isMatchFilled,
  isMatchRequestable,
  isPendingRequestActive,
  matchNeedsCrewCoverage,
  MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON,
  normalizeRequestableSlots,
  openCrewAssignTargets,
  raiseHandsToFulfillOnAssignmentConfirm,
} from '@/domain/requests';
import { matchesNeedingOfficials } from '@/features/scheduler/queues/selectors';
import { parseScheduleCsv } from '@/domain/csvImport';
import {
  applyWeekdayPattern,
  availabilitySortRank,
  clearMonth,
  cycleDayState,
  dayAvailability,
  dayKeyInZone,
  kickoffAvailabilityStatus,
  matchesAvailabilityFilter,
  rangesOverlapKickoff,
  setDayState,
  zonedLocalToUtcIso,
} from '@/domain/availability';
import { matchesForUser, applyMatchScope } from '@/domain/visibility';
import { compareKickoffAsc, matchOnCalendarDate, sortByKickoffAsc, uniqueMatchCalendarDates } from '@/domain/divisionFilters';
import {
  generateMatchIcs,
  matchHasCalendarTime,
  matchIcsFilename,
  matchIcsSummary,
} from '@/domain/matchIcs';
import {
  fanFavoriteLabel,
  formatMemberCityState,
  officialEffectiveLevel,
  officialGradeLabel,
  officialMatchesLevelCap,
  rugbySeasonDayRange,
  assignmentGameCountsByOfficial,
  doubleBookedOfficialIdsForMatch,
  formatMemberJoinedAt,
  memberListName,
  memberMatchesTab,
  membersForTab,
  officialDoubleBookings,
  rolePillsForMember,
} from '@/domain/members';
import { defaultRoleView, lensesForUser } from '@/app/AppContext';
import { standingsByDivision } from '@/domain/standings';
import { scheduleTeamEntries, teamContactPeople, conferenceTeamOptions } from '@/domain/teams';
import { dedupeTeamsForPicker } from '@/domain/teamList';
import { crewColumnLines } from '@/features/referee/appointments/crewLines';

function baseMatch(): Match {
  return {
    id: 'm1',
    sheetRowKey: 's1',
    status: 'draft',
    kickoffAt: new Date('2027-08-01T19:00:00Z').toISOString(),
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    venueLat: 30.27,
    venueLng: -97.74,
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
  };
}

const org: OrgSettings = {
  id: 'o',
  name: 'Org',
  timezone: 'America/Chicago',
  mileageRatePerMile: 0.5,
  mileageMinMiles: 10,
  defaultFees: defaultFees(),
  matchLevels: ['D1', 'D2', 'D3', 'Exhibition'],
  competitions: ['Lone Star Men', 'Lone Star Women'],
};

describe('match transitions', () => {
  it('releases draft and confirms both teams', () => {
    let m = releaseMatch(baseMatch());
    expect(m.status).toBe('pending_team_review');
    m = confirmTeam(m, 'home');
    expect(m.homeConfirmedAt).toBeTruthy();
    m = confirmTeam(m, 'away');
    expect(m.status).toBe('team_confirmed');
  });

  it('reactivateMatch restores cancelled match from workflow state', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = cancelMatch(m);
    expect(m.status).toBe('cancelled');
    const back = reactivateMatch(m);
    expect(back.status).toBe('team_confirmed');
    expect(back.cancelledAt).toBeUndefined();
  });

  it('reactivateMatch from postponed returns to needs_reconfirmation', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = postponeMatch(m);
    expect(m.status).toBe('postponed');
    const back = reactivateMatch(m);
    expect(back.status).toBe('needs_reconfirmation');
    expect(back.postponedAt).toBeUndefined();
  });

  it('applySheetFacts updates facts without clearing confirmations', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref' });
    m = confirmOfficialSlot(m, 'mo');
    const beforeStatus = m.status;
    const next = applySheetFacts(m, {
      kickoffAt: '2026-09-06T14:00:00.000Z',
      venueName: 'New Field',
    });
    expect(next.kickoffAt).toBe('2026-09-06T14:00:00.000Z');
    expect(next.venueName).toBe('New Field');
    expect(next.status).toBe(beforeStatus);
    expect(next.homeConfirmedAt).toBe(m.homeConfirmedAt);
    expect(next.awayConfirmedAt).toBe(m.awayConfirmedAt);
    expect(crewPeople(next.crew.mo)[0]?.status).toBe('confirmed');
  });
});

describe('crew visibility gate', () => {
  it('MO confirm sets mo_confirmed; unavailable auto-releases', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref' });
    expect(crewPeople(m.crew.mo)[0]?.status).toBe('official');
    m = confirmOfficialSlot(m, 'mo');
    expect(['mo_confirmed', 'crew_confirmed']).toContain(m.status);
    expect(crewPeople(m.crew.mo)[0]?.status).toBe('confirmed');
    expect(isCrewVisibleToTeams(m)).toBe(true);
    m = markUnavailableAndRelease(m, 'mo', 'conflict');
    expect(crewPeople(m.crew.mo)).toHaveLength(0);
    expect(emptyCrewBlocks(m.crew.mo).length).toBeGreaterThan(0);
    expect(
      m.crew.mo.some((a) => a.history.some((h) => h.action === 'declined')),
    ).toBe(true);
    expect(m.status).toBe('needs_reassignment');
    expect(isCrewVisibleToTeams(m)).toBe(false);
  });

  it('adds multiple empty MO blocks via Add role', () => {
    let m = releaseMatch(baseMatch());
    expect(crewBlocks(m.crew.mo).length).toBeGreaterThanOrEqual(1);
    m = withCrewRoleAdded(m, 'mo');
    m = withCrewRoleAdded(m, 'mo');
    m = withCrewRoleAdded(m, 'mo');
    m = withCrewRoleAdded(m, 'mo');
    expect(emptyCrewBlocks(m.crew.mo).length).toBeGreaterThanOrEqual(5);
    expect(availableCrewRolesToAdd(m)).toContain('mo');
  });

  it('assign fills first empty stub; raise-hand open until all filled', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = withCrewRoleAdded(m, 'mo');
    m = withCrewRoleAdded(m, 'mo');
    const openBefore = emptyCrewBlocks(m.crew.mo).length;
    expect(openBefore).toBeGreaterThanOrEqual(3);
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref One' });
    expect(emptyCrewBlocks(m.crew.mo).length).toBe(openBefore - 1);
    expect(isMatchFilled(m)).toBe(false);
    expect(canOfficialRequestMatch(m, 'u_other', [])).toBe(true);
  });

  it('matchNeedsCrewCoverage ignores CMO-only gaps', () => {
    let m = releaseMatch(baseMatch());
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref One' });
    m = {
      ...m,
      cmo: [{ id: 'cmo_1' }],
      rolesNeeded: ['mo', 'cmo'],
    };
    expect(matchNeedsCrewCoverage(m)).toBe(false);
    m = withCrewRoleAdded(m, 'mo');
    expect(matchNeedsCrewCoverage(m)).toBe(true);
    m = assignOfficial(m, 'mo', {
      uid: 'r2',
      displayName: 'Ref Two',
    });
    expect(matchNeedsCrewCoverage(m)).toBe(false);
  });

  it('openCrewAssignTargets lists empty fee-crew blocks', () => {
    let m = releaseMatch(baseMatch());
    m = {
      ...m,
      rolesNeeded: ['mo', 'ar1'],
      crew: {
        ...m.crew,
        ar1: [emptyAssignment('ar1')],
      },
    };
    const targets = openCrewAssignTargets(m);
    expect(targets.map((t) => t.slot)).toEqual(['mo', 'ar1']);
    expect(targets.every((t) => t.assignmentId)).toBe(true);
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref One' });
    expect(openCrewAssignTargets(m).map((t) => t.slot)).toEqual(['ar1']);
  });

  it('matchesNeedingOfficials includes partial crew, not only zero MO', () => {
    let m = releaseMatch(baseMatch());
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref One' });
    m = assignOfficial(m, 'mo', { uid: 'r2', displayName: 'Ref Two' });
    m = withCrewRoleAdded(m, 'mo');
    m = withCrewRoleAdded(m, 'mo');
    expect(matchesNeedingOfficials([m]).map((x) => x.id)).toEqual([m.id]);
    m = assignOfficial(m, 'mo', { uid: 'r3', displayName: 'Ref Three' });
    m = assignOfficial(m, 'mo', { uid: 'r4', displayName: 'Ref Four' });
    expect(matchesNeedingOfficials([m])).toHaveLength(0);
  });

  it('teams see crew when any MO is confirmed', () => {
    let m = releaseMatch(baseMatch());
    m = confirmTeam(confirmTeam(m, 'home'), 'away');
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref One' });
    m = assignOfficial(m, 'mo', { uid: 'r2', displayName: 'Ref Two' });
    expect(isCrewVisibleToTeams(m)).toBe(false);
    const firstId = crewPeople(m.crew.mo)[0]!.id;
    m = confirmOfficialSlot(m, 'mo', firstId);
    expect(isCrewVisibleToTeams(m)).toBe(true);
    expect(crewPeople(m.crew.mo).some((a) => a.status === 'official')).toBe(
      true,
    );
  });

  it('normalizes legacy single crew objects from Firestore', () => {
    const m = matchFromFirestore('m_legacy', {
      sheetRowKey: 's1',
      status: 'crew_pending',
      kickoffAt: new Date().toISOString(),
      venueName: 'Field',
      venueAddress: 'Austin',
      homeTeamId: 'h',
      awayTeamId: 'a',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      level: 'D1',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      crew: {
        mo: {
          slot: 'mo',
          userId: 'r1',
          userName: 'Ref',
          status: 'confirmed',
          history: [],
        },
        ar1: { slot: 'ar1', status: 'empty', history: [] },
        ar2: { slot: 'ar2', status: 'empty', history: [] },
        no4: { slot: 'no4', status: 'empty', history: [] },
      },
      cmo: { userId: 'c1', userName: 'Coach' },
    });
    expect(Array.isArray(m.crew.mo)).toBe(true);
    expect(crewPeople(m.crew.mo)[0]?.userId).toBe('r1');
    expect(m.crew.mo[0]?.id).toBeTruthy();
    expect(Array.isArray(m.cmo)).toBe(true);
    expect(m.cmo?.[0]?.userId).toBe('c1');
  });

  it('reads optional match title from Firestore', () => {
    const m = matchFromFirestore('m_title', {
      sheetRowKey: 's1',
      status: 'crew_pending',
      kickoffAt: new Date().toISOString(),
      venueName: 'Field',
      venueAddress: 'Austin',
      homeTeamId: 'h',
      awayTeamId: 'a',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      title: '  Conference final  ',
      level: 'D1',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      crew: {},
    });
    expect(m.title).toBe('Conference final');
  });

  it('reads optional match type from Firestore', () => {
    const m = matchFromFirestore('m_type', {
      sheetRowKey: 's1',
      status: 'crew_pending',
      kickoffAt: new Date().toISOString(),
      venueName: 'Field',
      venueAddress: 'Austin',
      homeTeamId: 'h',
      awayTeamId: 'a',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      matchType: '  2nd Side  ',
      level: 'Tier 1',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      crew: {},
    });
    expect(m.matchType).toBe('2nd Side');
  });

  it('reads optional tournament schedule URL from Firestore', () => {
    const url =
      'https://drive.google.com/file/d/10FoWp82ciP3yyXMdnhky3BI4JQ6-wgvC/view?usp=drive_link';
    const m = matchFromFirestore('T3090502', {
      sheetRowKey: 'T3090502',
      status: 'crew_pending',
      kickoffAt: new Date().toISOString(),
      venueName: 'Field',
      venueAddress: 'Austin',
      homeTeamId: 'h',
      awayTeamId: 'a',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      scheduleUrl: `  ${url}  `,
      level: 'Tourney',
      gender: 'men',
      flightProvided: false,
      housingProvided: false,
      crew: {},
    });
    expect(m.scheduleUrl).toBe(url);
  });

  it('filters matches by local calendar date', () => {
    const d = new Date();
    d.setHours(15, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const match = { kickoffAt: d.toISOString() } as Match;
    expect(matchOnCalendarDate(match, null)).toBe(true);
    expect(matchOnCalendarDate(match, `${yyyy}-${mm}-${dd}`)).toBe(true);
    expect(matchOnCalendarDate(match, '1999-01-01')).toBe(false);
    expect(uniqueMatchCalendarDates([match])).toEqual([`${yyyy}-${mm}-${dd}`]);
    expect(uniqueMatchCalendarDates([match, match])).toEqual([
      `${yyyy}-${mm}-${dd}`,
    ]);
  });

  it('sorts matches by kickoff ascending', () => {
    const later = { kickoffAt: '2026-10-31T18:00:00.000Z' };
    const earlier = { kickoffAt: '2026-10-02T18:00:00.000Z' };
    expect(compareKickoffAsc(earlier, later)).toBeLessThan(0);
    expect(sortByKickoffAsc([later, earlier]).map((m) => m.kickoffAt)).toEqual([
      earlier.kickoffAt,
      later.kickoffAt,
    ]);
  });
});

describe('match ICS', () => {
  it('builds a one-event calendar with UTC times and location', () => {
    const match = baseMatch();
    match.kickoffAt = '2027-08-01T19:00:00.000Z';
    match.venueName = 'House Park';
    match.venueAddress = '1300 Lamar Blvd, Austin, TX';
    const ics = generateMatchIcs(match, {
      url: 'https://matchreadytx.web.app/matches/m1',
      now: '2026-08-21T12:00:00.000Z',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20270801T190000Z');
    expect(ics).toContain('DTEND:20270801T210000Z');
    expect(ics).toContain('SUMMARY:Home vs Away');
    expect(ics).toContain('LOCATION:House Park\\, 1300 Lamar Blvd\\, Austin\\, TX');
    expect(ics).toContain('URL:https://matchreadytx.web.app/matches/m1');
    expect(ics).toContain('UID:m1@matchreadytx');
    expect(matchIcsSummary({ ...match, title: ' Conference final ' })).toBe(
      'Conference final',
    );
    expect(matchIcsFilename(match)).toBe('home-vs-away.ics');
    expect(matchHasCalendarTime(match)).toBe(true);
    expect(matchHasCalendarTime({ kickoffAt: 'nope' })).toBe(false);
  });
});

describe('economics', () => {
  it('computes mileage with min and flight suppression', () => {
    const d = distanceMiles(
      { lat: 30.27, lng: -97.74 },
      { lat: 29.76, lng: -95.37 },
    );
    expect(d).toBeGreaterThan(100);
    expect(estimateMileagePay(5, org, false)).toBe(0);
    expect(estimateMileagePay(20, org, false)).toBe(10);
    expect(estimateMileagePay(20, org, true)).toBe(0);
    const m = baseMatch();
    expect(feeForSlot(m, org, 'mo')).toBe(80);
  });

  it('distance and mileage differ by official home location', () => {
    const m = baseMatch(); // Austin venue
    const austinOfficial = {
      uid: 'a',
      firstName: 'Austin',
      lastName: 'Ref',
      displayName: 'Austin Ref',
      email: 'a@x.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '1 Congress Ave',
      homeCity: 'Austin',
      homeRegion: 'TX',
      homePostalCode: '78701',
      homeAddress: '1 Congress Ave, Austin, TX 78701',
      homeLat: 30.2672,
      homeLng: -97.7431,
      roles: ['official' as const],
      teamIds: [],
      profileComplete: true,
    };
    const houstonOfficial = {
      ...austinOfficial,
      uid: 'h',
      homeStreet: '1001 Fannin St',
      homeCity: 'Houston',
      homeRegion: 'TX',
      homePostalCode: '77002',
      homeAddress: '1001 Fannin St, Houston, TX 77002',
      homeLat: 29.7604,
      homeLng: -95.3698,
    };
    const near = matchEconomicsForUser(m, org, austinOfficial, 'mo');
    const far = matchEconomicsForUser(m, org, houstonOfficial, 'mo');
    expect(near.distanceMiles).toBeLessThan(5);
    expect(far.distanceMiles!).toBeGreaterThan(100);
    expect(far.mileagePay).toBeGreaterThan(near.mileagePay);
    expect(formatDistanceMi(undefined)).toBe('Distance unknown');
    expect(formatDistanceMi(3.2)).toBe('3.2 mi');
    expect(formatDistanceMi(142.4)).toBe('142 mi');
  });
});

describe('contacts', () => {
  it('parses paste and links team admins by email', () => {
    const rows = parseContactsPaste(
      'Austin RFC, austin-admin@example.com\nDallas RFC, dallas@x.com',
    );
    expect(rows).toHaveLength(2);
    const teams = applyContactRowsToTeams(
      [
        {
          id: 'team_austin',
          name: 'Austin RFC',
          contactEmails: [],
        },
      ],
      rows,
      () => 'team_new',
    );
    expect(teams.find((t) => t.id === 'team_austin')?.contactEmails).toContain(
      'austin-admin@example.com',
    );
    expect(teams.some((t) => t.name === 'Dallas RFC')).toBe(true);

    const users = linkTeamAdminsByEmail(
      [
        {
          uid: 'u1',
          firstName: 'A',
          lastName: 'B',
          displayName: 'A B',
          email: 'austin-admin@example.com',
          phone: '1',
          smsOptIn: false,
          homeStreet: '1',
          homeCity: 'A',
          homeRegion: 'TX',
          homePostalCode: '1',
          homeAddress: '1',
          roles: ['teamAdmin'],
          teamIds: [],
          profileComplete: true,
          birthday: '1990-01-01',
        },
      ],
      teams,
    );
    expect(users[0]!.teamIds).toContain('team_austin');
  });

  it('skips paste rows with no email', () => {
    const rows = parseContactsPaste(
      'Austin RFC, austin-admin@example.com\nBaylor University, , (253) 686-6170',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('austin-admin@example.com');
  });

  it('merges named Contacts people with email-only fallbacks', () => {
    const people = teamContactPeople({
      id: 't1',
      name: 'Rice University',
      contactEmails: ['lms21@rice.edu', 'extra@rice.edu'],
      contactPeople: [
        { name: 'Luke Sullivan', email: 'lms21@rice.edu', phone: '914-267-7543' },
      ],
    });
    expect(people).toEqual([
      {
        name: 'Luke Sullivan',
        email: 'lms21@rice.edu',
        phone: '914-267-7543',
      },
      { email: 'extra@rice.edu' },
    ]);
  });
});

describe('profile helpers', () => {
  it('guesses names from email local-part', () => {
    expect(guessNamesFromEmail('jane.doe@example.com')).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(guessNamesFromEmail('riley@example.com')).toEqual({
      firstName: 'Riley',
      lastName: '',
    });
  });

  it('formats full home address including unit', () => {
    expect(
      formatHomeAddress({
        homeStreet: '2200 S Lamar Blvd',
        homeUnit: 'Apt 3B',
        homeCity: 'Austin',
        homeRegion: 'TX',
        homePostalCode: '78704',
      }),
    ).toBe('2200 S Lamar Blvd, Apt 3B, Austin, TX 78704');
  });

  it('gates profileComplete by role — address/kit only for Referee/CMO', () => {
    const teamAdmin = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '1',
      homeStreet: '',
      homeCity: '',
      homeRegion: '',
      homePostalCode: '',
      homeAddress: '',
      birthday: '1990-01-01',
      roles: ['teamAdmin' as const],
    };
    expect(isProfileComplete(teamAdmin)).toBe(true);
    expect(isProfileComplete({ ...teamAdmin, birthday: '' })).toBe(true);
    expect(isProfileComplete({ ...teamAdmin, phone: '' })).toBe(false);
    expect(isProfileComplete({ ...teamAdmin, roles: ['official'] })).toBe(
      false,
    );
    expect(
      isProfileComplete({
        firstName: 'Fan',
        lastName: 'User',
        email: 'fan@b.com',
        phone: '',
        homeStreet: '',
        homeCity: '',
        homeRegion: '',
        homePostalCode: '',
        homeAddress: '',
        roles: ['fan'],
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        firstName: 'Fan',
        lastName: '',
        email: 'fan@b.com',
        phone: '',
        homeStreet: '',
        homeCity: '',
        homeRegion: '',
        homePostalCode: '',
        homeAddress: '',
        roles: ['fan'],
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        ...teamAdmin,
        roles: ['official', 'cmo'],
        homeStreet: '1 Main St',
        homeCity: 'Austin',
        homeRegion: 'TX',
        homePostalCode: '78701',
        homeAddress: '1 Main St, Austin, TX 78701',
        refereeingSince: '2018',
        jerseySize: 'M',
        shortsSize: 'M',
      }),
    ).toBe(true);
    expect(
      isProfileComplete({
        ...teamAdmin,
        roles: ['cmo'],
        homeStreet: '1 Main St',
        homeCity: 'Austin',
        homeRegion: 'TX',
        homePostalCode: '78701',
        refereeingSince: '2018',
        jerseySize: 'M',
        shortsSize: 'M',
      }),
    ).toBe(true);
  });

  it('rejects oversized or wrong-type profile photos', () => {
    const ok = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });
    expect(validateProfilePhoto(ok).ok).toBe(true);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'b.png', {
      type: 'image/png',
    });
    expect(validateProfilePhoto(big).ok).toBe(false);
    const gif = new File([new Uint8Array(10)], 'c.gif', { type: 'image/gif' });
    expect(validateProfilePhoto(gif).ok).toBe(false);
  });

  it('applyFanXorRoleToggle keeps Fan exclusive from working roles', () => {
    expect(
      applyFanXorRoleToggle(
        {
          roleOfficial: true,
          roleTeamAdmin: false,
          roleCmo: false,
          roleFan: false,
        },
        'fan',
        true,
      ),
    ).toEqual({
      roleOfficial: false,
      roleTeamAdmin: false,
      roleCmo: false,
      roleFan: true,
    });
    expect(
      applyFanXorRoleToggle(
        {
          roleOfficial: false,
          roleTeamAdmin: false,
          roleCmo: false,
          roleFan: true,
        },
        'official',
        true,
      ).roleFan,
    ).toBe(false);
  });
});

describe('hasInsightsAccessRole', () => {
  it('grants Insights to assigner, CMO, and delegated reportAnalytics', () => {
    expect(hasInsightsAccessRole(['cmo'])).toBe(true);
    expect(hasInsightsAccessRole(['official', 'cmo'])).toBe(true);
    expect(hasInsightsAccessRole(['assigner'])).toBe(true);
    expect(hasInsightsAccessRole(['reportAnalytics'])).toBe(true);
    expect(hasInsightsAccessRole(['official'])).toBe(false);
    expect(hasInsightsAccessRole(['teamAdmin'])).toBe(false);
    expect(hasInsightsAccessRole(['fan'])).toBe(false);
  });
});

describe('game requests', () => {
  it('allows request on released open matches only', () => {
    const draft = baseMatch();
    expect(isMatchRequestable(draft)).toBe(false);
    const released = releaseMatch(draft);
    expect(isMatchRequestable(released)).toBe(true);
    expect(canOfficialRequestMatch(released, 'u1', [])).toBe(true);
    expect(
      canOfficialRequestMatch(released, 'u1', [
        {
          id: 'r1',
          matchId: released.id,
          userId: 'u1',
          userName: 'U',
          status: 'pending',
          createdAt: new Date().toISOString(),
          preferredSlots: ['mo'],
        },
      ]),
    ).toBe(false);
  });

  it('hides past and filled matches from request surfaces', () => {
    const released = releaseMatch(baseMatch());
    const past = {
      ...released,
      kickoffAt: new Date(Date.now() - 60_000).toISOString(),
    };
    expect(isKickoffUpcoming(past)).toBe(false);
    expect(canOfficialRequestMatch(past, 'u1', [])).toBe(false);

    const filled = {
      ...released,
      rolesNeeded: ['mo', 'ar1', 'ar2', 'no4', 'cmo'] as Match['rolesNeeded'],
      crew: {
        mo: [
          {
            id: 'ca_mo',
            slot: 'mo' as const,
            userId: 'r2',
            userName: 'Other',
            status: 'official' as const,
            history: [],
          },
        ],
        ar1: [
          {
            id: 'ca_ar1',
            slot: 'ar1' as const,
            userId: 'r3',
            userName: 'A1',
            status: 'official' as const,
            history: [],
          },
        ],
        ar2: [
          {
            id: 'ca_ar2',
            slot: 'ar2' as const,
            userId: 'r4',
            userName: 'A2',
            status: 'official' as const,
            history: [],
          },
        ],
        no4: [
          {
            id: 'ca_no4',
            slot: 'no4' as const,
            userId: 'r5',
            userName: 'N4',
            status: 'official' as const,
            history: [],
          },
        ],
      },
      cmo: [{ userId: 'r6', userName: 'CMO' }],
    };
    expect(canOfficialRequestMatch(filled, 'u1', [])).toBe(false);

    const pendingReq = {
      id: 'r1',
      matchId: released.id,
      userId: 'u1',
      userName: 'U',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      preferredSlots: ['mo'] as RequestableSlot[],
    };
    expect(isPendingRequestActive(released, pendingReq)).toBe(true);
    expect(isPendingRequestActive(past, pendingReq)).toBe(false);
    expect(
      isPendingRequestActive(
        {
          ...released,
          crew: {
            ...released.crew,
            mo: [
              {
                id: 'ca_taken',
                slot: 'mo',
                userId: 'r2',
                userName: 'Taken',
                status: 'official',
                history: [],
              },
            ],
          },
        },
        pendingReq,
      ),
    ).toBe(false);
  });

  it('normalizeRequestableSlots merges legacy preferredSlot', () => {
    expect(normalizeRequestableSlots(['ar1'], 'mo')).toEqual(['ar1', 'mo']);
  });

  it('isPendingRequestActive stays until all preferred slots fill', () => {
    let m = releaseMatch(baseMatch());
    m = withCrewRoleAdded(m, 'ar1');
    m = withCrewRoleAdded(m, 'ar2');
    const request = {
      id: 'gr1',
      matchId: m.id,
      userId: 'u1',
      userName: 'U',
      preferredSlots: ['mo', 'ar1', 'ar2'] as RequestableSlot[],
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    expect(isPendingRequestActive(m, request)).toBe(true);
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'MO' });
    expect(isPendingRequestActive(m, request)).toBe(true);
    m = assignOfficial(m, 'ar1', { uid: 'r2', displayName: 'AR1' });
    m = assignOfficial(m, 'ar2', { uid: 'r3', displayName: 'AR2' });
    expect(isPendingRequestActive(m, request)).toBe(false);
  });

  it('raiseHandsToFulfillOnAssignmentConfirm approves confirmer and declines stale MO requests', () => {
    let m = releaseMatch(baseMatch());
    m = withCrewRoleAdded(m, 'ar1');
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'MO' });
    const requests = [
      {
        id: 'gr_confirmer',
        matchId: m.id,
        userId: 'r1',
        userName: 'MO',
        preferredSlots: ['mo'] as RequestableSlot[],
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'gr_other_mo',
        matchId: m.id,
        userId: 'r2',
        userName: 'Other',
        preferredSlots: ['mo'] as RequestableSlot[],
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'gr_other_ar',
        matchId: m.id,
        userId: 'r3',
        userName: 'AR volunteer',
        preferredSlots: ['ar1'] as RequestableSlot[],
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
    ];
    m = confirmOfficialSlot(m, 'mo');
    const actions = raiseHandsToFulfillOnAssignmentConfirm(m, requests, 'r1');
    expect(actions.approveIds).toEqual(['gr_confirmer']);
    expect(actions.declineIds).toEqual(['gr_other_mo']);
    expect(MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON).toBe(
      'Match assignment has been fulfilled',
    );
  });
});

describe('csv + availability', () => {
  it('parses schedule csv', () => {
    const rows = parseScheduleCsv(
      'match_id,date,kickoff_time,location,home_team,away_team,level,gender\n1,2026-08-01,14:00,Austin,A,B,D2,women',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].home_team).toBe('A');
    expect(rows[0].level).toBe('D2');
    expect(rows[0].gender).toBe('women');
  });

  const tz = 'America/Chicago';

  it('detects availability overlap (kickoff in window)', () => {
    const startAt = zonedLocalToUtcIso('2026-08-01', '12:00', tz);
    const endAt = zonedLocalToUtcIso('2026-08-01', '18:00', tz);
    const kick = zonedLocalToUtcIso('2026-08-01', '15:00', tz);
    expect(
      rangesOverlapKickoff(
        [
          {
            id: '1',
            userId: 'u',
            startAt,
            endAt,
            kind: 'available',
          },
        ],
        kick,
        120,
        tz,
        'u',
      ),
    ).toBe(true);
  });

  it('dayKeyInZone + setDayState cycle', () => {
    let ranges: ReturnType<typeof setDayState> = [];
    const idSeq = { n: 0 };
    const nextId = () => `id_${++idSeq.n}`;

    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).state).toBe(
      'unmarked',
    );

    ranges = cycleDayState(
      ranges,
      'u',
      '2026-08-01',
      tz,
      { startHm: '08:00', endHm: '17:00' },
      nextId,
    );
    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).state).toBe(
      'available',
    );
    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).windows[0]?.endHm).toBe(
      '17:00',
    );

    ranges = cycleDayState(ranges, 'u', '2026-08-01', tz, undefined, nextId);
    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).state).toBe(
      'blocked',
    );

    ranges = cycleDayState(ranges, 'u', '2026-08-01', tz, undefined, nextId);
    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).state).toBe(
      'unmarked',
    );
  });

  it('applyWeekdayPattern preserves blocked and replaces available', () => {
    const nextId = (() => {
      let n = 0;
      return () => `p_${++n}`;
    })();
    let ranges = setDayState(
      [],
      'u',
      '2026-08-01', // Saturday
      tz,
      { state: 'blocked' },
      nextId,
    );
    ranges = setDayState(
      ranges,
      'u',
      '2026-08-02', // Sunday
      tz,
      {
        state: 'available',
        windows: [{ startHm: '09:00', endHm: '12:00' }],
      },
      nextId,
    );
    ranges = applyWeekdayPattern(
      ranges,
      'u',
      {
        fromDayKey: '2026-08-01',
        toDayKey: '2026-08-02',
        weekdays: [0, 6], // Sun, Sat
        mode: 'available',
        startHm: '08:00',
        endHm: '20:00',
        timeZone: tz,
      },
      nextId,
    );
    expect(dayAvailability(ranges, 'u', '2026-08-01', tz).state).toBe(
      'blocked',
    );
    const sun = dayAvailability(ranges, 'u', '2026-08-02', tz);
    expect(sun.state).toBe('available');
    expect(sun.windows[0]?.startHm).toBe('08:00');
    expect(sun.windows[0]?.endHm).toBe('20:00');
  });

  it('applyWeekdayPattern can block weekdays', () => {
    const nextId = (() => {
      let n = 0;
      return () => `b_${++n}`;
    })();
    let ranges = setDayState(
      [],
      'u',
      '2026-08-07', // Friday
      tz,
      {
        state: 'available',
        windows: [{ startHm: '07:00', endHm: '21:00' }],
      },
      nextId,
    );
    ranges = applyWeekdayPattern(
      ranges,
      'u',
      {
        fromDayKey: '2026-08-01',
        toDayKey: '2026-08-14',
        weekdays: [5],
        mode: 'blocked',
        timeZone: tz,
      },
      nextId,
    );
    expect(dayAvailability(ranges, 'u', '2026-08-07', tz).state).toBe(
      'blocked',
    );
  });

  it('supports multiple available windows on one day', () => {
    const nextId = (() => {
      let n = 0;
      return () => `m_${++n}`;
    })();
    const ranges = setDayState(
      [],
      'u',
      '2026-08-01',
      tz,
      {
        state: 'available',
        windows: [
          { startHm: '07:00', endHm: '10:00' },
          { startHm: '11:00', endHm: '16:00' },
        ],
      },
      nextId,
    );
    const day = dayAvailability(ranges, 'u', '2026-08-01', tz);
    expect(day.windows).toHaveLength(2);
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '08:30', tz),
        tz,
      ),
    ).toBe('available');
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '10:30', tz),
        tz,
      ),
    ).toBe('outside_window');
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '12:00', tz),
        tz,
      ),
    ).toBe('available');
  });

  it('clearMonth removes only that month', () => {
    const nextId = (() => {
      let n = 0;
      return () => `c_${++n}`;
    })();
    let ranges = setDayState(
      [],
      'u',
      '2026-08-15',
      tz,
      {
        state: 'available',
        windows: [{ startHm: '08:00', endHm: '20:00' }],
      },
      nextId,
    );
    ranges = setDayState(
      ranges,
      'u',
      '2026-09-01',
      tz,
      {
        state: 'available',
        windows: [{ startHm: '08:00', endHm: '20:00' }],
      },
      nextId,
    );
    ranges = clearMonth(ranges, 'u', 2026, 8, tz);
    expect(dayAvailability(ranges, 'u', '2026-08-15', tz).state).toBe(
      'unmarked',
    );
    expect(dayAvailability(ranges, 'u', '2026-09-01', tz).state).toBe(
      'available',
    );
  });

  it('kickoffAvailabilityStatus: blocked / outside / available / unset', () => {
    const nextId = (() => {
      let n = 0;
      return () => `k_${++n}`;
    })();
    expect(
      kickoffAvailabilityStatus([], 'u', zonedLocalToUtcIso('2026-08-01', '15:00', tz), tz),
    ).toBe('unset');

    let ranges = setDayState(
      [],
      'u',
      '2026-08-01',
      tz,
      {
        state: 'available',
        windows: [{ startHm: '08:00', endHm: '17:00' }],
      },
      nextId,
    );
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '15:00', tz),
        tz,
      ),
    ).toBe('available');
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '19:00', tz),
        tz,
      ),
    ).toBe('outside_window');

    ranges = setDayState(
      ranges,
      'u',
      '2026-08-01',
      tz,
      { state: 'blocked' },
      nextId,
    );
    expect(
      kickoffAvailabilityStatus(
        ranges,
        'u',
        zonedLocalToUtcIso('2026-08-01', '15:00', tz),
        tz,
      ),
    ).toBe('blocked');
  });

  it('matchesAvailabilityFilter buckets not-available vs not-set', () => {
    expect(matchesAvailabilityFilter('available', 'all')).toBe(true);
    expect(matchesAvailabilityFilter('available', 'available')).toBe(true);
    expect(matchesAvailabilityFilter('blocked', 'available')).toBe(false);
    expect(matchesAvailabilityFilter('blocked', 'unavailable')).toBe(true);
    expect(matchesAvailabilityFilter('outside_window', 'unavailable')).toBe(
      true,
    );
    expect(matchesAvailabilityFilter('unset', 'unavailable')).toBe(false);
    expect(matchesAvailabilityFilter('unset', 'unset')).toBe(true);
    expect(
      matchesAvailabilityFilter('available', 'requested', {
        hasPendingRequest: true,
      }),
    ).toBe(true);
    expect(
      matchesAvailabilityFilter('available', 'requested', {
        hasPendingRequest: false,
      }),
    ).toBe(false);
  });

  it('availabilitySortRank orders available first', () => {
    expect(availabilitySortRank('available')).toBeLessThan(
      availabilitySortRank('outside_window'),
    );
    expect(availabilitySortRank('outside_window')).toBeLessThan(
      availabilitySortRank('unset'),
    );
    expect(availabilitySortRank('unset')).toBeLessThan(
      availabilitySortRank('blocked'),
    );
  });

  it('dayKeyInZone is stable for Chicago afternoon', () => {
    const iso = zonedLocalToUtcIso('2026-08-01', '15:00', tz);
    expect(dayKeyInZone(iso, tz)).toBe('2026-08-01');
  });
});

describe('matchesForUser visibility', () => {
  it('shows assigned officials draft pending_internal matches', () => {
    let m = baseMatch();
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref' }, { internal: true });
    expect(m.status).toBe('draft');
    expect(crewPeople(m.crew.mo)[0]?.status).toBe('pending_internal');
    const list = matchesForUser([m], {
      uid: 'r1',
      firstName: 'Ref',
      lastName: 'One',
      displayName: 'Ref One',
      email: 'r@x.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '1 Main',
      homeCity: 'Austin',
      homeRegion: 'TX',
      homePostalCode: '78701',
      homeAddress: '1 Main, Austin, TX 78701',
      roles: ['official'],
      teamIds: [],
      profileComplete: true,
    });
    expect(list).toHaveLength(1);
  });

  it('hides drafts from team admins until released', () => {
    const m = baseMatch();
    const list = matchesForUser([m], {
      uid: 't1',
      firstName: 'Team',
      lastName: 'Admin',
      displayName: 'Team Admin',
      email: 'a@x.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '',
      homeCity: '',
      homeRegion: '',
      homePostalCode: '',
      homeAddress: '',
      roles: ['teamAdmin'],
      teamIds: ['h'],
      profileComplete: true,
    });
    expect(list).toHaveLength(0);
    const released = releaseMatch(m);
    expect(
      matchesForUser([released], {
        uid: 't1',
        firstName: 'Team',
        lastName: 'Admin',
        displayName: 'Team Admin',
        email: 'a@x.com',
        phone: '1',
        smsOptIn: false,
        homeStreet: '',
        homeCity: '',
        homeRegion: '',
        homePostalCode: '',
        homeAddress: '',
        roles: ['teamAdmin'],
        teamIds: ['h'],
        profileComplete: true,
      }),
    ).toHaveLength(1);
  });

  it('shows fans only released matches (no drafts)', () => {
    const draft = baseMatch();
    const released = releaseMatch({ ...baseMatch(), id: 'm2' });
    const otherClub = releaseMatch({
      ...baseMatch(),
      id: 'm3',
      homeTeamId: 'x',
      awayTeamId: 'y',
    });
    const fan = {
      uid: 'f1',
      firstName: 'Fan',
      lastName: 'One',
      displayName: 'Fan One',
      email: 'f@x.com',
      phone: '',
      smsOptIn: false as const,
      homeStreet: '',
      homeCity: '',
      homeRegion: '',
      homePostalCode: '',
      homeAddress: '',
      roles: ['fan' as const],
      teamIds: [],
      fanTeamIds: ['h'],
      profileComplete: true,
    };
    expect(matchesForUser([draft, released], fan)).toEqual([released]);
    expect(matchesForUser([draft, released], fan, 'fan')).toEqual([released]);
    expect(applyMatchScope([released], fan, 'mine', 'fan')).toHaveLength(1);
    expect(
      applyMatchScope([released, otherClub], fan, 'mine', 'fan'),
    ).toHaveLength(1);
  });

  it('scopes officials to assigned and teams to club schedule', () => {
    const official = {
      uid: 'r1',
      firstName: 'Ref',
      lastName: 'One',
      displayName: 'Ref One',
      email: 'r@x.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '1 Main',
      homeCity: 'Austin',
      homeRegion: 'TX',
      homePostalCode: '78701',
      homeAddress: '1 Main, Austin, TX 78701',
      roles: ['official' as const],
      teamIds: [],
      profileComplete: true,
    };
    const teamAdmin = {
      uid: 't1',
      firstName: 'Team',
      lastName: 'Admin',
      displayName: 'Team Admin',
      email: 'a@x.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '',
      homeCity: '',
      homeRegion: '',
      homePostalCode: '',
      homeAddress: '',
      roles: ['teamAdmin' as const],
      teamIds: ['h'],
      profileComplete: true,
    };
    let assigned = releaseMatch(baseMatch());
    assigned = assignOfficial(assigned, 'mo', {
      uid: 'r1',
      displayName: 'Ref',
    });
    const other = {
      ...releaseMatch(baseMatch()),
      id: 'm2',
      homeTeamId: 'other',
      awayTeamId: 'x',
    };

    expect(
      applyMatchScope([assigned, other], official, 'mine', 'official'),
    ).toHaveLength(1);
    expect(
      applyMatchScope([assigned, other], official, 'all', 'official'),
    ).toHaveLength(2);
    expect(
      applyMatchScope([assigned, other], teamAdmin, 'mine', 'teamAdmin'),
    ).toEqual([assigned]);
    expect(
      applyMatchScope([assigned, other], teamAdmin, 'all', 'teamAdmin'),
    ).toHaveLength(2);
  });
});

describe('standings', () => {
  it('groups by gender and level with W L T PF PA PD', () => {
    const a = {
      ...baseMatch(),
      id: 'r1',
      status: 'locked_confirmed' as const,
      level: 'D1',
      gender: 'men' as const,
      homeTeamId: 'team_a',
      homeTeamName: 'Alpha',
      awayTeamId: 'team_b',
      awayTeamName: 'Beta',
      homeScore: 20,
      awayScore: 10,
    };
    const b = {
      ...baseMatch(),
      id: 'r2',
      status: 'locked_confirmed' as const,
      level: 'D1',
      gender: 'men' as const,
      homeTeamId: 'team_b',
      homeTeamName: 'Beta',
      awayTeamId: 'team_a',
      awayTeamName: 'Alpha',
      homeScore: 15,
      awayScore: 15,
    };
    const groups = standingsByDivision([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Men · D1');
    const alpha = groups[0].rows.find((r) => r.teamId === 'team_a')!;
    const beta = groups[0].rows.find((r) => r.teamId === 'team_b')!;
    expect(alpha).toMatchObject({ w: 1, l: 0, t: 1, pf: 35, pa: 25, pd: 10 });
    expect(beta).toMatchObject({ w: 0, l: 1, t: 1, pf: 25, pa: 35, pd: -10 });
    expect(groups[0].rows[0].teamId).toBe('team_a');
  });

  it('excludes played-forfeit matches from standings', () => {
    const counted = {
      ...baseMatch(),
      id: 'r1',
      status: 'locked_confirmed' as const,
      level: 'D1',
      gender: 'men' as const,
      homeTeamId: 'team_a',
      homeTeamName: 'Alpha',
      awayTeamId: 'team_b',
      awayTeamName: 'Beta',
      homeScore: 20,
      awayScore: 10,
    };
    const scrimmage = {
      ...counted,
      id: 'r2',
      playedForfeit: true,
      homeScore: 30,
      awayScore: 0,
    };
    const groups = standingsByDivision([counted, scrimmage]);
    expect(groups).toHaveLength(1);
    const alpha = groups[0].rows.find((r) => r.teamId === 'team_a')!;
    expect(alpha).toMatchObject({ played: 1, w: 1, pf: 20, pa: 10 });
  });
});

describe('fixtureRequests', () => {
  it('builds a released match with requester side pre-confirmed', () => {
    const { matchId, sheetRowKey } = newAppMatchId(
      new Date('2026-07-28T12:00:00Z'),
    );
    expect(sheetRowKey.startsWith('APP-20260728-')).toBe(true);
    const match = matchFromFixtureRequest(
      {
        id: 'fr1',
        orgId: 'org',
        requesterUserId: 'u1',
        requesterName: 'Admin',
        requesterTeamId: 'home',
        side: 'home',
        opponentTeamId: 'away',
        homeTeamId: 'home',
        awayTeamId: 'away',
        homeTeamName: 'Home RFC',
        awayTeamName: 'Away RFC',
        kickoffAt: '2026-08-01T20:00:00.000Z',
        venueName: 'Field',
        venueAddress: '1 Main St',
        level: 'D1',
        gender: 'men',
        flightProvided: false,
        housingProvided: false,
        status: 'pending',
        createdAt: '2026-07-28T12:00:00.000Z',
      },
      { matchId, sheetRowKey, at: '2026-07-28T12:00:00.000Z' },
    );
    expect(match.status).toBe('pending_team_review');
    expect(match.homeConfirmedAt).toBe('2026-07-28T12:00:00.000Z');
    expect(match.awayConfirmedAt).toBeUndefined();
    expect(match.sheetRowKey).toBe(sheetRowKey);
  });
});

describe('fan role helpers', () => {
  const fanUser = {
    uid: 'f1',
    firstName: 'Fan',
    lastName: 'One',
    displayName: 'Fan One',
    email: 'f@x.com',
    phone: '',
    smsOptIn: false as const,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles: ['fan' as const],
    teamIds: [],
    profileComplete: true,
  };

  it('role pills and members tab include Fan', () => {
    expect(rolePillsForMember(['fan'])).toEqual(['Fan']);
    expect(memberMatchesTab(fanUser, 'fans')).toBe(true);
    expect(memberMatchesTab(fanUser, 'referees')).toBe(false);
  });

  it('lensesForUser and defaultRoleView prefer working roles over Fan', () => {
    expect(lensesForUser(fanUser)).toEqual(['fan']);
    expect(defaultRoleView(fanUser)).toBe('fan');
    expect(
      lensesForUser({
        ...fanUser,
        roles: ['official', 'fan'],
      }),
    ).toEqual(['referee', 'fan']);
    expect(
      defaultRoleView({
        ...fanUser,
        roles: ['official', 'fan'],
      }),
    ).toBe('referee');
    expect(
      defaultRoleView({
        ...fanUser,
        roles: ['assigner', 'fan'],
      }),
    ).toBe('scheduler');
  });
});

describe('member directory helpers', () => {
  const base: UserProfile = {
    uid: 'u1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    preferredName: 'Addy',
    displayName: 'Ada Lovelace',
    email: 'ada@x.com',
    phone: '5125550100',
    smsOptIn: false,
    homeStreet: '1 Main',
    homeCity: 'Austin',
    homeRegion: 'TX',
    homePostalCode: '78701',
    homeAddress: '1 Main, Austin, TX 78701',
    roles: ['official'],
    teamIds: [],
    profileComplete: true,
    joinedAt: '2026-07-01T12:00:00.000Z',
  };

  it('memberListName prefers preferred + last, then first + last', () => {
    expect(memberListName(base)).toBe('Addy Lovelace');
    expect(
      memberListName({ ...base, preferredName: undefined }),
    ).toBe('Ada Lovelace');
    expect(
      memberListName({
        ...base,
        firstName: '',
        lastName: '',
        preferredName: undefined,
        displayName: 'Pending profile',
        email: '',
      }),
    ).toBe('Pending profile');
  });

  it('formatMemberCityState uses profile city and state', () => {
    expect(formatMemberCityState(base)).toBe('Austin, TX');
    expect(
      formatMemberCityState({ ...base, homeCity: '', homeRegion: '' }),
    ).toBeNull();
    expect(
      formatMemberCityState({ ...base, homeCity: 'Dallas', homeRegion: '' }),
    ).toBe('Dallas');
  });

  it('officialEffectiveLevel prefers assessed over self-reported', () => {
    expect(
      officialEffectiveLevel({ ...base, assessedLevel: 8, refereeLevel: 2 }),
    ).toBe(8);
    expect(
      officialEffectiveLevel({ ...base, assessedLevel: undefined, refereeLevel: 2 }),
    ).toBe(2);
    expect(
      officialEffectiveLevel({ ...base, assessedLevel: undefined, refereeLevel: undefined }),
    ).toBeNull();
  });

  it('officialGradeLabel and progressive level cap (1 is highest)', () => {
    expect(
      officialGradeLabel({ ...base, assessedLevel: 8, refereeLevel: 2 }),
    ).toBe('Assessed 8');
    expect(
      officialGradeLabel({
        ...base,
        assessedLevel: undefined,
        refereeLevel: 2,
      }),
    ).toBe('Self-assessed 2');
    expect(
      officialGradeLabel({
        ...base,
        assessedLevel: undefined,
        refereeLevel: undefined,
      }),
    ).toBe('Grade unknown');
    expect(officialMatchesLevelCap(8, null)).toBe(true);
    expect(officialMatchesLevelCap(null, null)).toBe(true);
    expect(officialMatchesLevelCap(null, 10)).toBe(false);
    expect(officialMatchesLevelCap(10, 10)).toBe(true);
    expect(officialMatchesLevelCap(9, 10)).toBe(true);
    expect(officialMatchesLevelCap(10, 9)).toBe(false);
    expect(officialMatchesLevelCap(1, 9)).toBe(true);
  });

  it('rugbySeasonDayRange starts in August', () => {
    const tz = 'America/Chicago';
    expect(
      rugbySeasonDayRange(tz, new Date('2026-08-27T12:00:00-05:00')),
    ).toEqual({ from: '2026-08-01', to: '2027-07-31' });
    expect(
      rugbySeasonDayRange(tz, new Date('2026-03-15T12:00:00-05:00')),
    ).toEqual({ from: '2025-08-01', to: '2026-07-31' });
  });

  it('assignmentGameCountsByOfficial splits upcoming vs total in range', () => {
    const tz = 'America/Chicago';
    const past = {
      ...baseMatch(),
      id: 'past',
      kickoffAt: '2026-09-01T18:00:00.000Z',
      crew: {
        ...emptyCrew(),
        mo: [{ ...emptyAssignment('mo'), userId: 'u1', status: 'confirmed' as const }],
      },
    };
    const future = {
      ...baseMatch(),
      id: 'future',
      kickoffAt: '2026-10-01T18:00:00.000Z',
      crew: {
        ...emptyCrew(),
        mo: [{ ...emptyAssignment('mo'), userId: 'u1', status: 'confirmed' as const }],
      },
    };
    const otherSeason = {
      ...baseMatch(),
      id: 'old',
      kickoffAt: '2025-09-01T18:00:00.000Z',
      crew: {
        ...emptyCrew(),
        mo: [{ ...emptyAssignment('mo'), userId: 'u1', status: 'confirmed' as const }],
      },
    };
    const counts = assignmentGameCountsByOfficial(
      [past, future, otherSeason],
      {
        timeZone: tz,
        fromDay: '2026-08-01',
        toDay: '2027-07-31',
        nowMs: new Date('2026-09-15T12:00:00.000Z').getTime(),
      },
    );
    expect(counts.get('u1')).toEqual({ upcoming: 1, total: 2 });
  });

  it('officialDoubleBookings detects same-day assignments', () => {
    const tz = 'America/Chicago';
    const nowMs = new Date('2026-09-01T12:00:00.000Z').getTime();
    let m1 = releaseMatch({ ...baseMatch(), id: 'm1', kickoffAt: '2026-09-15T18:00:00.000Z' });
    let m2 = releaseMatch({
      ...baseMatch(),
      id: 'm2',
      kickoffAt: '2026-09-15T22:00:00.000Z',
      homeTeamName: 'Bears',
      awayTeamName: 'Wolves',
    });
    let m3 = releaseMatch({
      ...baseMatch(),
      id: 'm3',
      kickoffAt: '2026-09-16T18:00:00.000Z',
    });
    m1 = assignOfficial(m1, 'mo', { uid: 'u1', displayName: 'Riley' });
    m2 = assignOfficial(m2, 'ar1', { uid: 'u1', displayName: 'Riley' });
    m3 = assignOfficial(m3, 'mo', { uid: 'u1', displayName: 'Riley' });
    const conflicts = officialDoubleBookings([m1, m2, m3], tz, { nowMs });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.userId).toBe('u1');
    expect(conflicts[0]?.dayKey).toBe('2026-09-15');
    expect(conflicts[0]?.matches.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(doubleBookedOfficialIdsForMatch([m1, m2, m3], m1, tz, { nowMs })).toEqual([
      'u1',
    ]);
  });

  it('membersForTab hides incomplete unless includeIncomplete', () => {
    const incomplete: UserProfile = {
      ...base,
      uid: 'u2',
      profileComplete: false,
      firstName: '',
      lastName: '',
      displayName: 'Pending profile',
    };
    const users = [base, incomplete];
    expect(membersForTab(users, 'referees')).toHaveLength(1);
    expect(
      membersForTab(users, 'referees', { includeIncomplete: true }),
    ).toHaveLength(2);
  });

  it('formatMemberJoinedAt formats ISO dates', () => {
    expect(formatMemberJoinedAt(undefined)).toBeNull();
    expect(formatMemberJoinedAt('not-a-date')).toBeNull();
    expect(formatMemberJoinedAt(base.joinedAt)).toMatch(/2026/);
  });

  it('fanFavoriteLabel resolves team name or other text', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Austin Blacks', contactEmails: [] },
    ];
    expect(
      fanFavoriteLabel(
        { ...base, roles: ['fan'], fanTeamIds: ['t1'] },
        teams,
      ),
    ).toBe('Austin Blacks');
    expect(
      fanFavoriteLabel(
        { ...base, roles: ['fan'], fanTeamOther: 'Visiting club' },
        teams,
      ),
    ).toBe('Visiting club');
    expect(fanFavoriteLabel({ ...base, roles: ['fan'] }, teams)).toBeNull();
  });
});

describe('teamLinkRequests', () => {
  const team: Team = {
    id: 'team_austin',
    name: 'Austin',
    contactEmails: ['coach@austin.edu'],
  };

  it('emailMatchesTeamContacts is case-insensitive', () => {
    expect(emailMatchesTeamContacts('Coach@Austin.edu', team)).toBe(true);
    expect(emailMatchesTeamContacts('other@x.com', team)).toBe(false);
  });

  it('validateTeamLinkRequestBatch caps batch size and rejects conference ids', () => {
    expect(validateTeamLinkRequestBatch(['team_a', 'team_b'])).toEqual({
      ok: true,
      value: ['team_a', 'team_b'],
    });
    expect(validateTeamLinkRequestBatch(['team_a', 'team_b', 'team_c'])).toEqual({
      ok: false,
      error: 'Select at most 2 clubs at a time.',
    });
    expect(validateTeamLinkRequestBatch(['conf:Lone Star Men'])).toEqual({
      ok: false,
      error: 'Select individual clubs, not a whole conference.',
    });
  });

  it('rolesAfterTeamLinkDenial strips TA only; Fan when no working roles', () => {
    expect(
      rolesAfterTeamLinkDenial(
        { roles: ['teamAdmin', 'official'], teamIds: [] },
        0,
      ),
    ).toEqual({ roles: ['official'], teamIds: [] });
    expect(
      rolesAfterTeamLinkDenial({ roles: ['teamAdmin'], teamIds: [] }, 0),
    ).toEqual({ roles: ['fan'], teamIds: [] });
    expect(
      rolesAfterTeamLinkDenial({ roles: ['teamAdmin'], teamIds: [] }, 1),
    ).toEqual({ roles: ['teamAdmin'], teamIds: [] });
  });

  it('pending Fan browse and Team Admin lens gates', () => {
    const pending: UserProfile = {
      uid: 'u1',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      email: 'a@b.com',
      phone: '1',
      smsOptIn: false,
      homeStreet: '',
      homeCity: '',
      homeRegion: '',
      homePostalCode: '',
      homeAddress: '',
      roles: ['teamAdmin'],
      teamIds: [],
      profileComplete: true,
    };
    expect(shouldShowTeamAdminLens(pending)).toBe(false);
    expect(shouldShowPendingFanBrowse(pending)).toBe(true);
    expect(
      shouldShowTeamAdminLens({ ...pending, teamIds: ['team_austin'] }),
    ).toBe(true);
    expect(
      shouldShowPendingFanBrowse({
        ...pending,
        roles: ['teamAdmin', 'official'],
      }),
    ).toBe(false);
  });
});

describe('coachFeedback', () => {
  it('builds deterministic doc ids and requires low-score comments', async () => {
    const {
      coachFeedbackDocId,
      normalizeScaleValue,
      scalesNeedComments,
      validateCoachFeedbackScales,
    } = await import('@/domain/coachFeedback');
    expect(coachFeedbackDocId('m1', 'team_a')).toBe('m1_team_a');
    expect(normalizeScaleValue('poor')).toBe(1);
    expect(normalizeScaleValue(5)).toBe(5);
    expect(
      scalesNeedComments({
        breakdown: 5,
        overall: 1,
      }),
    ).toBe(true);
    expect(
      scalesNeedComments({
        breakdown: 3,
        overall: 3,
      }),
    ).toBe(false);
    expect(
      validateCoachFeedbackScales({
        breakdown: 5,
        scrum: 3,
        lineout: 3,
        safety: 4,
        communication: 3,
        professionalism: 5,
        overall: 3,
      }),
    ).toBe(true);
    expect(validateCoachFeedbackScales({ overall: 3 })).toBe(false);
    expect(
      validateCoachFeedbackScales({
        breakdown: 'na',
        scrum: 3,
        lineout: 'na',
        safety: 4,
        communication: 3,
        professionalism: 5,
        overall: 3,
      }),
    ).toBe(true);
    expect(normalizeScaleValue('na')).toBe('na');
    expect(normalizeScaleValue('N/A')).toBe('na');
    expect(
      scalesNeedComments({
        breakdown: 'na',
        overall: 3,
      }),
    ).toBe(false);
  });

  it('averages rated criteria', async () => {
    const { coachFeedbackAverage, coachFeedbackAverageLabel } = await import(
      '@/domain/coachFeedback'
    );
    expect(
      coachFeedbackAverage({
        breakdown: 5,
        scrum: 3,
        lineout: 4,
        safety: 4,
        communication: 3,
        professionalism: 5,
        overall: 4,
      }),
    ).toBeCloseTo(4, 5);
    expect(coachFeedbackAverage({})).toBeNull();
    expect(
      coachFeedbackAverage({
        breakdown: 'na',
        scrum: 'na',
      }),
    ).toBeNull();
    expect(
      coachFeedbackAverage({
        breakdown: 4,
        scrum: 'na',
        lineout: 2,
      }),
    ).toBe(3);
    expect(coachFeedbackAverageLabel(3.6)).toBe(4);
  });
});

describe('pending match reports', () => {
  function pending(
    slot: 'mo' | 'cmo',
    id: string,
  ): import('@/domain/reports').MatchReport {
    return {
      id,
      matchId: 'm_res07',
      officialId: 'u_assigner',
      slot,
      status: 'pending',
      dueAt: new Date(Date.now() - 1000).toISOString(),
      kickoffAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
  }

  it('selects the CMO row when the same official also has an MO pending', async () => {
    const {
      pendingCrewReportForOfficial,
      pendingReportForOfficial,
    } = await import('@/domain/reports');
    const reports = [pending('mo', 'mr_mo'), pending('cmo', 'mr_cmo')];
    expect(
      pendingReportForOfficial(reports, 'm_res07', 'u_assigner')?.id,
    ).toBe('mr_mo');
    expect(
      pendingReportForOfficial(reports, 'm_res07', 'u_assigner', 'cmo')?.id,
    ).toBe('mr_cmo');
    expect(
      pendingCrewReportForOfficial(reports, 'm_res07', 'u_assigner')?.id,
    ).toBe('mr_mo');
  });

  it('still finds the crew report when the CMO pending is listed first', async () => {
    const { pendingCrewReportForOfficial, pendingReportForOfficial } =
      await import('@/domain/reports');
    const reports = [pending('cmo', 'mr_cmo'), pending('mo', 'mr_mo')];
    expect(
      pendingReportForOfficial(reports, 'm_res07', 'u_assigner', 'cmo')?.id,
    ).toBe('mr_cmo');
    expect(
      pendingCrewReportForOfficial(reports, 'm_res07', 'u_assigner')?.id,
    ).toBe('mr_mo');
  });
});

describe('parseAssessedRating', () => {
  it('accepts whole numbers 1–10 (10 lowest) and rejects out of range', async () => {
    const { parseAssessedRating } = await import('@/domain/reports');
    expect(parseAssessedRating('1')).toBe(1);
    expect(parseAssessedRating('10')).toBe(10);
    expect(parseAssessedRating(' 8 ')).toBe(8);
    expect(parseAssessedRating('')).toBeUndefined();
    expect(parseAssessedRating('0')).toBeUndefined();
    expect(parseAssessedRating('11')).toBeUndefined();
    expect(parseAssessedRating('8.5')).toBeUndefined();
    expect(parseAssessedRating('Level 8 - C2')).toBe(8);
    expect(parseAssessedRating('Level 10 - New Referee')).toBe(10);
    expect(parseAssessedRating('level 7')).toBe(7);
  });

  it('maps Google Form scale 0 to N/A', async () => {
    const { parseCmoFormScale } = await import('@/domain/reports');
    const { SCALE_NA } = await import('@/domain/fivePointScale');
    expect(parseCmoFormScale(0)).toBe(SCALE_NA);
    expect(parseCmoFormScale('0')).toBe(SCALE_NA);
    expect(parseCmoFormScale('4')).toBe(4);
    expect(parseCmoFormScale(3)).toBe(3);
  });

  it('parses Home (12) vs Away (7) team lines', async () => {
    const { parseLegacyTeamsText } = await import('@/domain/reports');
    expect(parseLegacyTeamsText("UT II's (19) vs OU II's (43)")).toEqual({
      homeTeamName: "UT II's",
      awayTeamName: "OU II's",
      homeScore: 19,
      awayScore: 43,
    });
    expect(parseLegacyTeamsText('Plano vs Austin')).toEqual({
      homeTeamName: 'Plano',
      awayTeamName: 'Austin',
    });
  });

  it('shows archive CMO reports without a live fixture', async () => {
    const {
      displayMatchForCmoReport,
      submittedCmoReportsAboutOfficial,
    } = await import('@/domain/reports');
    const report = {
      id: 'legacy_cmo_abc_cmo1_cmo',
      matchId: 'legacy_cmo_abc',
      officialId: 'cmo1',
      subjectOfficialId: 'ref1',
      slot: 'cmo' as const,
      status: 'submitted' as const,
      formKind: 'cmo' as const,
      source: 'legacy_form' as const,
      dueAt: '2025-10-05T17:00:00.000Z',
      kickoffAt: '2025-10-05T17:00:00.000Z',
      submittedAt: '2025-10-06T19:00:00.000Z',
      legacyFixture: {
        teamsText: 'Plano (12) vs Austin (52)',
        matchLevel: 'High School Varsity',
        homeTeamName: 'Plano',
        awayTeamName: 'Austin',
        homeScore: 12,
        awayScore: 52,
      },
    };
    expect(submittedCmoReportsAboutOfficial([report], [], 'ref1')).toEqual([
      report,
    ]);
    expect(submittedCmoReportsAboutOfficial([report], [], 'other')).toEqual([]);
    const display = displayMatchForCmoReport(report, []);
    expect(display?.homeTeamName).toBe('Plano');
    expect(display?.awayTeamName).toBe('Austin');
    expect(display?.homeScore).toBe(12);
    expect(display?.matchType).toBe('2025 archive');
    expect(displayMatchForCmoReport({ ...report, source: undefined, legacyFixture: undefined }, [])).toBeUndefined();
  });

  it('shows archive MO reports without a live fixture', async () => {
    const { displayMatchForArchivedReport } = await import('@/domain/reports');
    const report = {
      id: 'legacy_mo_abc_ref1_mo',
      matchId: 'legacy_mo_abc',
      officialId: 'ref1',
      slot: 'mo' as const,
      status: 'submitted' as const,
      formKind: 'mo_performance' as const,
      source: 'legacy_form' as const,
      dueAt: '2025-10-05T17:00:00.000Z',
      kickoffAt: '2025-10-05T17:00:00.000Z',
      submittedAt: '2025-10-06T19:00:00.000Z',
      legacyFixture: {
        teamsText: 'SMU (52) vs UT Dallas (13)',
        matchLevel: "Men's D3",
        homeTeamName: 'SMU',
        awayTeamName: 'UT Dallas',
        homeScore: 52,
        awayScore: 13,
      },
    };
    const display = displayMatchForArchivedReport(report, []);
    expect(display?.homeTeamName).toBe('SMU');
    expect(display?.awayTeamName).toBe('UT Dallas');
    expect(display?.crew.mo[0]?.userId).toBe('ref1');
  });

  it('treats N/A as a complete CMO scale rating', async () => {
    const { validateCmoScales, CMO_SCALE_KEYS } = await import(
      '@/domain/reports'
    );
    const allNa = Object.fromEntries(CMO_SCALE_KEYS.map((k) => [k, 'na' as const]));
    expect(validateCmoScales(allNa, CMO_SCALE_KEYS)).toBe(true);
    expect(validateCmoScales({ scrum: 4 }, CMO_SCALE_KEYS)).toBe(false);
  });

  it('averages CMO scale scores and skips N/A', async () => {
    const { cmoScaleAverage } = await import('@/domain/reports');
    expect(cmoScaleAverage(undefined)).toBeNull();
    expect(cmoScaleAverage({})).toBeNull();
    expect(cmoScaleAverage({ scrum: 'na', breakdown: 'na' })).toBeNull();
    expect(cmoScaleAverage({ scrum: 4, breakdown: 5, advantage: 'na' })).toBe(
      4.5,
    );
  });

  it('requires a complexity factor or Other text', async () => {
    const { cmoComplexityComplete } = await import('@/domain/reports');
    expect(cmoComplexityComplete([], '')).toBe(false);
    expect(cmoComplexityComplete(['rivalry/high stakes'], '')).toBe(true);
    expect(cmoComplexityComplete([], 'uncontested scrums')).toBe(true);
  });
});

describe('scheduleTeamEntries', () => {
  it('hides leftover abbreviation-only teams when conference-split clubs exist', () => {
    const matches: Match[] = [
      {
        ...baseMatch(),
        id: 'm1',
        status: 'team_confirmed',
        homeTeamId: 'baylor-lonestar-men',
        homeTeamName: 'BAYLOR',
        awayTeamId: 'asu-lonestar-men',
        awayTeamName: 'ASU',
        competition: 'Lonestar Men',
      },
    ];
    const teams: Team[] = [
      { id: 'baylor', name: 'BAYLOR', contactEmails: [] },
      {
        id: 'baylor-lonestar-men',
        name: 'BAYLOR University',
        abbreviation: 'BAYLOR',
        competition: 'Lonestar Men',
        contactEmails: [],
      },
      {
        id: 'asu-lonestar-men',
        name: 'Angelo State University',
        abbreviation: 'ASU',
        competition: 'Lonestar Men',
        contactEmails: [],
      },
    ];
    const ids = scheduleTeamEntries(matches, teams).map((e) => e.team.id);
    expect(ids).not.toContain('baylor');
    expect(ids).toContain('baylor-lonestar-men');
    expect(ids).toContain('asu-lonestar-men');
  });

  it('keeps a contacts-only club that has no conference-split sibling', () => {
    const teams: Team[] = [
      { id: 'new-club', name: 'New Club RFC', contactEmails: ['a@x.com'] },
    ];
    const ids = scheduleTeamEntries([], teams).map((e) => e.team.id);
    expect(ids).toContain('new-club');
  });
});

describe('dedupeTeamsForPicker', () => {
  it('collapses Lonestar / Lone Star competition aliases for the same club', () => {
    const teams = [
      {
        id: 't_letu_lonestar_men',
        name: 'LeTourneau University',
        abbreviation: 'LETU',
        competition: 'Lonestar Men',
      },
      {
        id: 't_letu_lone_star_men',
        name: 'LeTourneau University',
        abbreviation: 'LETU',
        competition: 'Lone Star Men',
      },
    ];
    const out = dedupeTeamsForPicker(teams);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('t_letu_lonestar_men');
  });

  it('keeps men and women sides separate', () => {
    const teams = [
      {
        id: 't_uh_lonestar_men',
        name: 'University of Houston',
        abbreviation: 'UH',
        competition: 'Lonestar Men',
      },
      {
        id: 't_uh_lonestar_women',
        name: 'University of Houston',
        abbreviation: 'UH',
        competition: 'Lonestar Women',
      },
    ];
    expect(dedupeTeamsForPicker(teams)).toHaveLength(2);
  });
});

describe('conferenceTeamOptions', () => {
  it('lists Locations-synced teams by competition, not schedule inference', () => {
    const teams: Team[] = [
      {
        id: 't_uh_lonestar_men',
        name: 'University of Houston',
        abbreviation: 'UH',
        competition: 'Lonestar Men',
        contactEmails: [],
      },
      {
        id: 't_uh_lonestar_women',
        name: 'University of Houston',
        abbreviation: 'UH',
        competition: 'Lonestar Women',
        contactEmails: [],
      },
      { id: 'guest', name: 'Guest RFC', contactEmails: [] },
    ];
    const options = conferenceTeamOptions(teams);
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.id)).toEqual([
      't_uh_lonestar_men',
      't_uh_lonestar_women',
    ]);
    expect(options[0]?.conference).toBe('Lone Star Men');
    expect(options[1]?.conference).toBe('Lone Star Women');
  });

  it('excludes VENUE-only Locations rows from team pickers', () => {
    const teams: Team[] = [
      {
        id: 't_huns_venue',
        name: 'Huns Rugby Ranch',
        abbreviation: 'HUNS',
        competition: 'VENUE',
        contactEmails: [],
      },
      {
        id: 't_uh_lonestar_men',
        name: 'University of Houston',
        abbreviation: 'UH',
        competition: 'Lonestar Men',
        contactEmails: [],
      },
    ];
    const options = conferenceTeamOptions(teams);
    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe('t_uh_lonestar_men');
  });
});

describe('crewColumnLines', () => {
  it('collapses three empty MO blocks to (3) MO Open', () => {
    const m = baseMatch();
    m.crew = {
      ...emptyCrew(),
      mo: [emptyAssignment('mo'), emptyAssignment('mo'), emptyAssignment('mo')],
    };
    const lines = crewColumnLines(m);
    const mo = lines.filter((l) => l.slotLabel.includes('MO'));
    expect(mo).toHaveLength(1);
    expect(mo[0]?.slotLabel).toBe('(3) MO');
    expect(mo[0]?.value).toBe('Open');
  });

  it('shows a filled MO name and remaining open spots', () => {
    const m = baseMatch();
    const filled = {
      ...emptyAssignment('mo'),
      userId: 'u1',
      userName: 'Jane Ref',
      status: 'confirmed' as const,
    };
    m.crew = {
      ...emptyCrew(),
      mo: [filled, emptyAssignment('mo'), emptyAssignment('mo')],
    };
    const lines = crewColumnLines(m);
    expect(lines.some((l) => l.value === 'Jane Ref')).toBe(true);
    expect(lines.some((l) => l.slotLabel === '(2) MO' && l.value === 'Open')).toBe(
      true,
    );
  });

  it('assignableOpen keeps pending lines and marks open slots for assign', () => {
    const m = baseMatch();
    const pending = {
      ...emptyAssignment('mo'),
      userId: 'u1',
      userName: 'Pat Ref',
      status: 'official' as const,
    };
    const openMo = emptyAssignment('mo');
    m.crew = {
      ...emptyCrew(),
      mo: [pending, openMo],
      ar1: [emptyAssignment('ar1')],
    };
    m.rolesNeeded = ['mo', 'ar1'];
    const lines = crewColumnLines(m, { assignableOpen: true });
    expect(lines.some((l) => l.slotLabel === 'MO' && l.value === 'Pending')).toBe(
      true,
    );
    expect(lines.some((l) => l.slotLabel === 'MO' && l.value === 'Open')).toBe(
      true,
    );
    expect(lines.some((l) => l.slotLabel === 'AR1' && l.assignTarget)).toBe(
      true,
    );
    const openMoLine = lines.find(
      (l) => l.slotLabel === 'MO' && l.value === 'Open',
    );
    expect(openMoLine?.assignTarget?.assignmentId).toBe(openMo.id);
  });
});

describe('demo raise-hand seed', () => {
  it('stacks multiple volunteers on Austin vs Dallas open game', async () => {
    const { demoStore, DEMO_CROWD_RAISE_HAND_MATCH_ID } = await import(
      '@/services/demoStore'
    );
    demoStore.resetToSeed();
    const state = demoStore.getState();
    const crowd = state.requests.filter(
      (r) =>
        r.matchId === DEMO_CROWD_RAISE_HAND_MATCH_ID && r.status === 'pending',
    );
    expect(crowd.length).toBe(6);
    expect(matchesNeedingOfficials(state.matches).some(
      (m) => m.id === DEMO_CROWD_RAISE_HAND_MATCH_ID,
    )).toBe(true);
  });
});
