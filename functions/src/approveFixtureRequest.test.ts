import { describe, expect, it } from 'vitest';
import {
  resolveScheduleLocationForWrite,
  sheetTeamLabelForWrite,
} from './approveFixtureRequest';

describe('approveFixtureRequest sheet labels', () => {
  it('prefers team abbreviation over full name for Schedule columns', () => {
    expect(
      sheetTeamLabelForWrite(
        { abbreviation: 'UDC', name: 'University of Dallas' },
        'University of Dallas',
      ),
    ).toBe('UDC');
    expect(
      sheetTeamLabelForWrite(
        { abbreviation: 'TAMUCC', name: 'Texas A&M - Corpus Christi' },
        'Texas A&M - Corpus Christi',
      ),
    ).toBe('TAMUCC');
    expect(sheetTeamLabelForWrite(null, 'Some Club')).toBe('Some Club');
  });

  it('uses home abbreviation for location when venue is a field name', () => {
    const locationsRows = [
      ['abbreviation', 'competition', 'venue_name', 'address'],
      ['UDC', 'Lonestar Men', 'Tom Braniff', 'Irving, TX'],
    ];
    expect(
      resolveScheduleLocationForWrite({
        venueName: 'Tom Braniff',
        homeTeamAbbr: 'UDC',
        locationsRows,
      }),
    ).toBe('UDC');
  });

  it('matches location abbreviation directly when typed', () => {
    expect(
      resolveScheduleLocationForWrite({
        venueName: 'SHSU',
        homeTeamAbbr: 'SHSU',
        locationsRows: [
          ['abbreviation', 'venue_name'],
          ['SHSU', 'Huntsville'],
        ],
      }),
    ).toBe('SHSU');
  });
});
