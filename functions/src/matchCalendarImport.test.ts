import { describe, expect, it } from 'vitest';
import {
  confirmedAssignmentForUser,
  feeForSlot,
  formatMatchLocation,
  inferCalendarMatchType,
  inferCalendarStatus,
  mapMatchToAssignmentDto,
} from './matchCalendarImport';

const org = {
  timezone: 'America/Chicago',
  defaultFees: { mo: 100, ar1: 75, ar2: 75, no4: 50, cmo: 60 },
};

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    kickoffAt: '2026-10-15T19:00:00.000Z',
    venueName: 'Central Park',
    venueAddress: 'Austin, TX',
    homeTeamName: 'Austin Huns',
    awayTeamName: 'Dallas RFC',
    status: 'locked_confirmed',
    crew: {
      mo: [
        {
          id: 'ca_1',
          userId: 'user-1',
          status: 'confirmed',
        },
      ],
      ar1: [],
      ar2: [],
      no4: [],
    },
    ...overrides,
  };
}

describe('matchCalendarImport mapping', () => {
  it('includes only confirmed crew assignments', () => {
    expect(
      confirmedAssignmentForUser(
        baseMatch({
          crew: {
            mo: [{ userId: 'user-1', status: 'official' }],
            ar1: [],
            ar2: [],
            no4: [],
          },
        }),
        'user-1',
      ),
    ).toBeNull();

    expect(confirmedAssignmentForUser(baseMatch(), 'user-1')).toEqual({
      slot: 'mo',
    });
  });

  it('maps confirmed MO assignment to calendar DTO', () => {
    const dto = mapMatchToAssignmentDto(
      'lonestar',
      'match-42',
      baseMatch({ competition: 'Lonestar Men' }),
      'user-1',
      org,
      Date.parse('2026-10-01T00:00:00.000Z'),
    );

    expect(dto).toMatchObject({
      externalId: 'lonestar:match-42',
      orgId: 'lonestar',
      matchId: 'match-42',
      home: 'Austin Huns',
      away: 'Dallas RFC',
      location: 'Central Park, Austin, TX',
      position: 'Referee',
      positionPreset: 'referee',
      matchType: 'xvs',
      competition: 'Lonestar Men',
      expectedPay: 100,
      payCurrency: 'USD',
      status: 'upcoming',
      timezone: 'America/Chicago',
    });
  });

  it('marks past kickoffs completed and cancelled workflow as cancelled', () => {
    expect(
      inferCalendarStatus(
        baseMatch(),
        '2025-01-01T12:00:00.000Z',
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe('completed');

    expect(
      inferCalendarStatus(
        baseMatch({ status: 'cancelled', cancelledAt: '2026-01-01' }),
        '2026-10-15T19:00:00.000Z',
      ),
    ).toBe('cancelled');
  });

  it('does not treat releasedAt as cancelled (published to officials)', () => {
    const released = baseMatch({
      releasedAt: '2026-09-01T12:00:00.000Z',
      status: 'locked_confirmed',
    });
    expect(
      inferCalendarStatus(
        released,
        '2026-10-15T19:00:00.000Z',
        Date.parse('2026-10-01T00:00:00.000Z'),
      ),
    ).toBe('upcoming');
    expect(mapMatchToAssignmentDto('lonestar', 'm1', released, 'user-1', org)).not.toBeNull();
  });

  it('skips cancelled and postponed matches entirely', () => {
    expect(
      mapMatchToAssignmentDto(
        'lonestar',
        'm1',
        baseMatch({ status: 'cancelled', cancelledAt: '2026-09-01' }),
        'user-1',
        org,
      ),
    ).toBeNull();
    expect(
      mapMatchToAssignmentDto(
        'lonestar',
        'm1',
        baseMatch({ status: 'postponed', postponedAt: '2026-09-01' }),
        'user-1',
        org,
      ),
    ).toBeNull();
  });

  it('formats location and infers match types', () => {
    expect(formatMatchLocation('Field 1', 'Field 1')).toBe('Field 1');
    expect(inferCalendarMatchType({ isTournament: true })).toBe('tournament');
    expect(inferCalendarMatchType({ matchType: '7s' })).toBe('7s');
  });

  it('uses fee overrides when present', () => {
    expect(
      feeForSlot(
        baseMatch({ feeOverride: { mo: 125 } }),
        org,
        'mo',
      ),
    ).toBe(125);
  });
});
