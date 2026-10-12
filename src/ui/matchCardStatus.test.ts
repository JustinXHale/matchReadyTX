import { describe, expect, it } from 'vitest';
import type { Match } from '@/domain/types';
import { emptyCrew } from '@/domain/types';
import { workflowMatchCardStatus } from '@/ui/matchCardStatus';

function match(status: Match['status']): Match {
  return {
    id: `m-${status}`,
    sheetRowKey: `m-${status}`,
    status,
    kickoffAt: '2026-10-12T16:00:00.000Z',
    venueName: 'Field',
    venueAddress: '100 Test Way, Austin, TX',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
  };
}

describe('workflowMatchCardStatus', () => {
  it('maps workflow states to shared semantic card tones', () => {
    expect(workflowMatchCardStatus(match('crew_confirmed'))).toEqual({
      tone: 'approved',
      label: 'Confirmed',
    });
    expect(workflowMatchCardStatus(match('mo_confirmed'))).toEqual({
      tone: 'approved',
      label: 'Confirmed',
    });
    expect(workflowMatchCardStatus(match('team_confirmed'))).toEqual({
      tone: 'approved',
      label: 'Confirmed',
    });
    expect(workflowMatchCardStatus(match('draft'))).toEqual({
      tone: 'pending',
      label: 'Draft',
    });
    expect(workflowMatchCardStatus(match('change_proposed'))).toEqual({
      tone: 'declined',
      label: 'Change Proposed',
    });
  });

  it('lets assignment conflicts override the stored workflow status', () => {
    expect(
      workflowMatchCardStatus(match('crew_confirmed'), {
        needsReassignment: true,
      }),
    ).toEqual({ tone: 'declined', label: 'Needs reassignment' });
  });
});
