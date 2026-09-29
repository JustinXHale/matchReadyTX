import { describe, expect, it } from 'vitest';
import {
  assignCmoContact,
  collectAssignmentHistory,
  confirmCmoContact,
  markCmoUnavailableAndRelease,
} from '@/domain/crew';
import {
  assignmentForUser,
  effectiveCmoStatus,
  emptyCrew,
  type Match,
} from '@/domain/types';
import {
  isAppointmentPendingAccept,
  crewColumnLines,
} from '@/features/referee/appointments/crewLines';

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sheetRowKey: 's1',
    status: 'team_confirmed',
    kickoffAt: '2026-09-25T20:30:00-05:00',
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    homeConfirmedAt: '2026-09-20T12:00:00Z',
    awayConfirmedAt: '2026-09-20T13:00:00Z',
    crew: emptyCrew(),
    rolesNeeded: ['mo', 'cmo'],
    ...overrides,
  };
}

describe('CMO assignment confirmation', () => {
  it('assigns CMO as official (pending accept) when both teams confirmed', () => {
    const m = assignCmoContact(baseMatch(), {
      uid: 'cmo1',
      displayName: 'Jon Savage',
    });
    const cmo = m.cmo?.[0];
    expect(cmo?.status).toBe('official');
    expect(cmo?.history?.some((h) => h.action === 'assigned')).toBe(true);
    expect(isAppointmentPendingAccept(m, 'cmo1')).toBe(true);
    expect(collectAssignmentHistory(m).some((r) => r.slot === 'cmo')).toBe(
      true,
    );
  });

  it('assigns CMO as pending_internal before both teams confirm', () => {
    const m = assignCmoContact(
      baseMatch({
        homeConfirmedAt: undefined,
        awayConfirmedAt: undefined,
        status: 'pending_team_review',
      }),
      { uid: 'cmo1', displayName: 'Jon' },
    );
    expect(m.cmo?.[0]?.status).toBe('pending_internal');
    expect(isAppointmentPendingAccept(m, 'cmo1')).toBe(true);
  });

  it('confirm moves CMO out of pending accept', () => {
    let m = assignCmoContact(baseMatch(), {
      uid: 'cmo1',
      displayName: 'Jon',
    });
    m = confirmCmoContact(m, m.cmo?.[0]?.id);
    expect(m.cmo?.[0]?.status).toBe('confirmed');
    expect(isAppointmentPendingAccept(m, 'cmo1')).toBe(false);
    expect(
      collectAssignmentHistory(m).some((r) => r.entry.action === 'confirmed'),
    ).toBe(true);
  });

  it('decline clears the person and keeps history on the block', () => {
    let m = assignCmoContact(baseMatch(), {
      uid: 'cmo1',
      displayName: 'Jon',
    });
    const id = m.cmo?.[0]?.id;
    m = markCmoUnavailableAndRelease(m, 'Conflict', 'declined', id);
    expect(m.cmo?.[0]?.userId).toBeUndefined();
    expect(m.cmo?.[0]?.status).toBe('empty');
    expect(
      m.cmo?.[0]?.history?.some((h) => h.action === 'declined'),
    ).toBe(true);
  });

  it('legacy named CMO without status is treated as confirmed', () => {
    const m = baseMatch({
      cmo: [{ id: 'cmo_1', userId: 'cmo1', userName: 'Legacy' }],
    });
    expect(effectiveCmoStatus(m.cmo![0]!)).toBe('confirmed');
    expect(isAppointmentPendingAccept(m, 'cmo1')).toBe(false);
    const hit = assignmentForUser(m, 'cmo1');
    expect(hit?.slot).toBe('cmo');
    expect(hit?.assignment?.status).toBe('confirmed');
  });

  it('crew column shows Pending for unconfirmed CMO', () => {
    const m = assignCmoContact(baseMatch(), {
      uid: 'cmo1',
      displayName: 'Jon Savage',
    });
    const lines = crewColumnLines(m);
    expect(lines.find((l) => l.slotLabel === 'CMO')?.value).toBe('Pending');
  });
});
