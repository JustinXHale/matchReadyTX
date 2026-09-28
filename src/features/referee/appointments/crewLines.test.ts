import { describe, expect, it } from 'vitest';
import {
  appointmentMySlot,
  crewColumnLines,
} from '@/features/referee/appointments/crewLines';
import type { Match } from '@/domain/types';
import { emptyCrew } from '@/domain/types';

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    orgId: 'lonestar',
    title: 'Test',
    kickoffAt: '2026-09-25T20:30:00-05:00',
    gender: 'men',
    level: 'Tier 4',
    matchType: '2nd Side',
    status: 'released',
    homeTeamId: 'h',
    awayTeamId: 'a',
    crew: emptyCrew(),
    rolesNeeded: ['mo', 'cmo'],
    ...overrides,
  };
}

describe('appointmentMySlot', () => {
  it('returns CMO when the user is only assigned as CMO', () => {
    const match = baseMatch({
      crew: {
        ...emptyCrew(),
        mo: [
          {
            id: 'ca_mo',
            slot: 'mo',
            userId: 'other',
            userName: 'Wian',
            status: 'confirmed',
            history: [],
          },
        ],
      },
      cmo: [{ id: 'cmo_1', userId: 'me', userName: 'Justin' }],
    });
    expect(appointmentMySlot(match, 'me')).toBe('cmo');
  });

  it('returns fee slot when the user is MO', () => {
    const match = baseMatch({
      crew: {
        ...emptyCrew(),
        mo: [
          {
            id: 'ca_mo',
            slot: 'mo',
            userId: 'me',
            userName: 'Justin',
            status: 'confirmed',
            history: [],
          },
        ],
      },
    });
    expect(appointmentMySlot(match, 'me')).toBe('mo');
  });
});

describe('crewColumnLines', () => {
  it('shows MO and CMO lines for a 2nd Side match', () => {
    const match = baseMatch({
      crew: {
        ...emptyCrew(),
        mo: [
          {
            id: 'ca_mo',
            slot: 'mo',
            userId: 'ref1',
            userName: 'Wian Engelbrecht',
            status: 'confirmed',
            history: [],
          },
        ],
      },
      cmo: [{ id: 'cmo_1', userId: 'cmo1', userName: 'Justin X. Hale' }],
    });
    const lines = crewColumnLines(match, { highlightUserId: 'cmo1' });
    expect(lines.map((l) => `${l.slotLabel} ${l.value}`)).toEqual([
      'MO Wian Engelbrecht',
      'CMO Justin X. Hale',
    ]);
    expect(lines.find((l) => l.slotLabel === 'CMO')?.isMine).toBe(true);
  });
});
