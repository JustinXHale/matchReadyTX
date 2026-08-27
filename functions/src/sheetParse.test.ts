import { describe, expect, it } from 'vitest';
import {
  contactMatchKeys,
  isVenueOnlyLocationCompetition,
  isVenueOnlyLocationRow,
  lookupLocation,
  parseContactRows,
  parseScheduleRows,
  rowToKickoffIso,
  type LocationRow,
} from './sheetParse';

describe('parseContactRows', () => {
  const headers = ['team_name', 'conference', 'name', 'email', 'phone'];

  it('keeps emailed people and skips blank-email rows', () => {
    const rows = parseContactRows([
      headers,
      ['Angelo State University', 'Lonestar Men', 'Nathan Balcazar', '', ''],
      [
        'Angelo State University',
        'Lonestar Men',
        'Nathan Balcazar',
        'nathanbalcazar35@gmail.com',
        '(432) 770-4853',
      ],
      ['Baylor University', 'Lonestar Men', 'Brayden Murdock', '', '(253) 686-6170'],
      [
        'Texas State (TXST)',
        'Lonestar Men',
        'Club email',
        'TXSTrugby@gmail.com',
        '',
      ],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email)).toEqual([
      'nathanbalcazar35@gmail.com',
      'txstrugby@gmail.com',
    ]);
    expect(rows[0]).toMatchObject({
      team_name: 'Angelo State University',
      conference: 'Lonestar Men',
      name: 'Nathan Balcazar',
      phone: '(432) 770-4853',
    });
    expect(rows[1]?.name).toBe('Club email');
  });

  it('strips unicode isolates from phone numbers', () => {
    const rows = parseContactRows([
      headers,
      [
        'Texas Christian University',
        'Lonestar Men',
        'Troy Panayotou',
        'T.A.PANAYOTOU@tcu.edu',
        '‭(650) 918-9574‬',
      ],
    ]);
    expect(rows[0]?.phone).toBe('(650) 918-9574');
    expect(rows[0]?.email).toBe('t.a.panayotou@tcu.edu');
  });
});

describe('contactMatchKeys', () => {
  it('joins full university names to abbreviations and parentheticals', () => {
    const contact = new Set(contactMatchKeys('Texas State (TXST)'));
    const schedule = new Set(contactMatchKeys('TXST'));
    const overlap = [...contact].filter((k) => schedule.has(k));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('treats St. Edward’s and Saint Edwards as the same club', () => {
    const a = new Set(contactMatchKeys("St. Edward's University"));
    const b = new Set(contactMatchKeys('Saint Edwards University'));
    expect([...a].some((k) => b.has(k))).toBe(true);
  });
});

describe('venue-only Locations rows', () => {
  it('detects VENUE competition (case-insensitive)', () => {
    expect(isVenueOnlyLocationCompetition('VENUE')).toBe(true);
    expect(isVenueOnlyLocationCompetition('venue')).toBe(true);
    expect(isVenueOnlyLocationCompetition('Venues')).toBe(true);
    expect(isVenueOnlyLocationCompetition('Lonestar Men')).toBe(false);
  });

  it('still resolves venue address for schedule location abbrev', () => {
    const locations: LocationRow[] = [
      {
        abbreviation: 'HUNS',
        competition: 'VENUE',
        teamName: 'Huns Rugby Ranch',
        address: '4107 Nixon Lane, Austin, TX',
      },
    ];
    const loc = lookupLocation(locations, 'Huns', 'men', 'Lonestar Men');
    expect(loc?.address).toContain('4107 Nixon Lane');
    expect(isVenueOnlyLocationRow(loc!)).toBe(true);
  });
});

describe('parseScheduleRows match_type', () => {
  it('reads optional match_type column', () => {
    const rows = parseScheduleRows([
      [
        'match_id',
        'date',
        'kickoff_time',
        'location',
        'home_team',
        'away_team',
        'level',
        'match_type',
        'title',
      ],
      [
        'T1091102',
        '2026-09-11',
        '19:00',
        'TXST',
        'TXST',
        'SHSU',
        'Tier 1',
        '2nd Side',
        '',
      ],
    ]);
    expect(rows[0]?.match_type).toBe('2nd Side');
    expect(rows[0]?.level).toBe('Tier 1');
  });
});

describe('rowToKickoffIso', () => {
  it('parses September wall time as CDT (not +1 hour)', () => {
    const iso = rowToKickoffIso({
      match_id: 'T1090501',
      date: '2026-09-05',
      kickoff_time: '9:00',
      location: 'TXST',
      home_team: 'TXST',
      away_team: 'TXST',
      competition: 'Lonestar Men',
    });
    const label = new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    expect(label).toMatch(/9:00\s*AM/i);
  });
});
