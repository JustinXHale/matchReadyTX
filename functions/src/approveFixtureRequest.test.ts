import { describe, expect, it } from 'vitest';
import {
  areMatchSidesDistinct,
  isResolvableTeamDocId,
  OTHER_OPPONENT_TEAM_ID,
  resolveScheduleLocationForWrite,
  sheetTeamLabelForWrite,
} from './approveFixtureRequest';

describe('approveFixtureRequest sheet labels', () => {
  it('skips Firestore team lookup for Other opponent sentinel', () => {
    expect(isResolvableTeamDocId('__other__')).toBe(false);
    expect(isResolvableTeamDocId('tamucc')).toBe(true);
    expect(isResolvableTeamDocId('')).toBe(false);
  });

  it('allows both Other… sides when typed names differ', () => {
    expect(
      areMatchSidesDistinct(
        OTHER_OPPONENT_TEAM_ID,
        OTHER_OPPONENT_TEAM_ID,
        'Lonestar 01',
        'Great Planes 01',
      ),
    ).toBe(true);
    expect(
      areMatchSidesDistinct(
        OTHER_OPPONENT_TEAM_ID,
        OTHER_OPPONENT_TEAM_ID,
        'Lonestar 01',
        'lonestar 01',
      ),
    ).toBe(false);
    expect(areMatchSidesDistinct('team_a', 'team_a', 'A', 'B')).toBe(false);
    expect(areMatchSidesDistinct('team_a', 'team_b', 'A', 'B')).toBe(true);
  });

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
