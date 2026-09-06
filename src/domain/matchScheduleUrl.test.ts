import { describe, expect, it } from 'vitest';
import {
  isTournamentMatch,
  isValidScheduleUrl,
  normalizeScheduleUrl,
  validateScheduleUrlInput,
} from './matchScheduleUrl';
import type { Match } from './types';

function match(partial: Partial<Match>): Match {
  return {
    id: 'm1',
    sheetRowKey: 'm1',
    status: 'locked_confirmed',
    kickoffAt: '2026-09-01T14:00:00.000Z',
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
    crew: { mo: [], ar1: [], ar2: [], no4: [] },
    ...partial,
  };
}

describe('matchScheduleUrl', () => {
  it('detects tournament events from isTournament flag', () => {
    expect(isTournamentMatch({ isTournament: true })).toBe(true);
    expect(isTournamentMatch(match({ level: 'Tourney' }))).toBe(false);
    expect(isTournamentMatch(match({}))).toBe(false);
  });

  it('normalizes empty input to undefined', () => {
    expect(normalizeScheduleUrl('')).toBeUndefined();
    expect(normalizeScheduleUrl('   ')).toBeUndefined();
    expect(normalizeScheduleUrl(undefined)).toBeUndefined();
  });

  it('accepts https Drive links', () => {
    const url =
      'https://drive.google.com/file/d/10FoWp82ciP3yyXMdnhky3BI4JQ6-wgvC/view?usp=drive_link';
    expect(isValidScheduleUrl(url)).toBe(true);
    expect(validateScheduleUrlInput(url)).toEqual({ ok: true, value: url });
  });

  it('rejects non-https URLs', () => {
    expect(isValidScheduleUrl('http://example.com/x')).toBe(false);
    expect(validateScheduleUrlInput('http://example.com/x')).toEqual({
      ok: false,
      error: 'Schedule link must be a valid https URL (500 characters or fewer).',
    });
  });

  it('allows clearing the link', () => {
    expect(validateScheduleUrlInput('')).toEqual({ ok: true, value: undefined });
  });
});
