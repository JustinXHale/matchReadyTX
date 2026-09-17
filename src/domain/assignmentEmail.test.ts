import { describe, expect, it } from 'vitest';
import {
  assignmentEmailNotifyLine,
  markAssignmentEmailSent,
} from '@/domain/assignmentEmail';
import { assignOfficial } from '@/domain/crew';
import { emptyCrew, type Match } from '@/domain/types';

function testMatch(): Match {
  return {
    id: 'm1',
    sheetRowKey: 'row-1',
    status: 'crew_pending',
    kickoffAt: '2026-09-19T16:00:00.000Z',
    venueName: 'Field',
    venueAddress: '1 Main',
    homeTeamId: 't1',
    awayTeamId: 't2',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'Tier 2',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
  };
}

describe('assignmentEmail', () => {
  it('marks assignment email metadata on the crew row', () => {
    let m = testMatch();
    m = assignOfficial(m, 'mo', { uid: 'r1', displayName: 'Ref' });
    const next = markAssignmentEmailSent(m, 'mo', 'r1', 'assignment');
    const row = next.crew.mo.find((a) => a.userId === 'r1');
    expect(row?.assignmentNotifiedAt).toBeTruthy();
    expect(row?.assignmentNotifyEvent).toBe('assignment');
  });

  it('formats notified vs re-notified lines', () => {
    const at = '2026-09-17T15:30:00.000Z';
    expect(
      assignmentEmailNotifyLine(
        { assignmentNotifiedAt: at, assignmentNotifyEvent: 'assignment' },
        'America/Chicago',
      ),
    ).toMatch(/^Notified:/);
    expect(
      assignmentEmailNotifyLine(
        { assignmentNotifiedAt: at, assignmentNotifyEvent: 'assignment_resend' },
        'America/Chicago',
      ),
    ).toMatch(/^Re-notified:/);
  });
});
