import { describe, expect, it } from 'vitest';
import {
  isTournamentMatchLevel,
  isValidScheduleUrl,
  normalizeScheduleUrl,
  validateScheduleUrlInput,
} from './matchScheduleUrl';

describe('matchScheduleUrl', () => {
  it('detects tournament match levels', () => {
    expect(isTournamentMatchLevel('Tourney')).toBe(true);
    expect(isTournamentMatchLevel('7s')).toBe(true);
    expect(isTournamentMatchLevel('Spring Tournament')).toBe(true);
    expect(isTournamentMatchLevel('D1')).toBe(false);
    expect(isTournamentMatchLevel(undefined)).toBe(false);
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
