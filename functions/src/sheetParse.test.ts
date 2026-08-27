import { describe, expect, it } from 'vitest';
import {
  contactMatchKeys,
  parseContactRows,
  rowToKickoffIso,
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
