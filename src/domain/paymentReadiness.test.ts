import { describe, expect, it } from 'vitest';
import { defaultFees } from '@/domain/economics';
import { buildAssignmentPayableRows } from '@/domain/paymentReadiness';
import type { CardReport, MatchReport } from '@/domain/reports';
import {
  emptyAssignment,
  emptyCrew,
  type Match,
  type OrgSettings,
  type UserProfile,
} from '@/domain/types';

const org: OrgSettings = {
  id: 'org1',
  name: 'Test Org',
  timezone: 'America/Chicago',
  mileageRatePerMile: 0.5,
  mileageMinMiles: 10,
  defaultFees: defaultFees(),
  matchLevels: ['D1'],
  competitions: ['Test'],
};

function user(uid: string, displayName: string): UserProfile {
  return {
    uid,
    firstName: displayName,
    lastName: 'Test',
    displayName,
    email: `${uid}@test.com`,
    phone: '555-0100',
    smsOptIn: false,
    homeStreet: '1 Main',
    homeCity: 'Austin',
    homeRegion: 'TX',
    homePostalCode: '78701',
    homeAddress: '1 Main, Austin, TX 78701',
    roles: ['official'],
    teamIds: [],
    profileComplete: true,
  };
}

const users = [user('u_mo', 'MO Ref'), user('u_ar', 'AR Ref')];

function pastMatch(overrides?: Partial<Match>): Match {
  const kickoffAt = new Date(Date.now() - 86_400_000).toISOString();
  return {
    id: 'm1',
    sheetRowKey: 's1',
    status: 'locked_confirmed',
    kickoffAt,
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    homeTeamId: 't1',
    awayTeamId: 't2',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    competition: 'Test',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: [
        {
          ...emptyAssignment('mo'),
          userId: 'u_mo',
          userName: 'MO Ref',
          status: 'confirmed',
        },
      ],
      ar1: [
        {
          ...emptyAssignment('ar1'),
          userId: 'u_ar',
          userName: 'AR Ref',
          status: 'confirmed',
        },
      ],
    },
    ...overrides,
  };
}

function moReport(status: 'pending' | 'submitted', cards = { yellow: 0, red: 0 }): MatchReport {
  return {
    id: 'mr_mo',
    matchId: 'm1',
    officialId: 'u_mo',
    slot: 'mo',
    formKind: 'mo_quick',
    status,
    dueAt: new Date().toISOString(),
    kickoffAt: pastMatch().kickoffAt,
    moPayload:
      status === 'submitted'
        ? {
            homePoints: 10,
            awayPoints: 7,
            yellowCards: cards.yellow,
            redCards: cards.red,
          }
        : undefined,
  };
}

describe('paymentReadiness', () => {
  it('marks MO ready_to_pay when match report submitted even if card report pending', () => {
    const match = pastMatch();
    const matchReports = [moReport('submitted', { yellow: 1, red: 0 })];
    const cardReports: CardReport[] = [];

    const rows = buildAssignmentPayableRows(
      [match],
      users,
      matchReports,
      cardReports,
      [],
      org,
    );
    const mo = rows.find((r) => r.slot === 'mo');
    expect(mo?.readiness).toBe('ready_to_pay');
    expect(mo?.matchReportSubmitted).toBe(true);
    expect(mo?.cardReportRequired).toBe(true);
    expect(mo?.cardReportSubmitted).toBe(false);
  });

  it('keeps MO in reports_pending until match report is submitted', () => {
    const match = pastMatch();
    const rows = buildAssignmentPayableRows(
      [match],
      users,
      [moReport('pending')],
      [],
      [],
      org,
    );
    expect(rows.find((r) => r.slot === 'mo')?.readiness).toBe('reports_pending');
  });

  it('marks No.4 ready_to_pay after kickoff without a match report', () => {
    const match = pastMatch({
      crew: {
        ...emptyCrew(),
        no4: [
          {
            ...emptyAssignment('no4'),
            userId: 'u_ar',
            userName: 'No4',
            status: 'confirmed',
          },
        ],
      },
    });
    const rows = buildAssignmentPayableRows([match], users, [], [], [], org);
    expect(rows.find((r) => r.slot === 'no4')?.readiness).toBe('ready_to_pay');
  });
});
