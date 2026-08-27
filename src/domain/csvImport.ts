/** Parse CSV schedule rows (header required). */

export interface CsvMatchRow {
  match_id: string;
  date: string;
  kickoff_time: string;
  location: string;
  home_team: string;
  away_team: string;
  competition?: string;
  notes?: string;
  level?: string;
  gender?: string;
}

export function parseScheduleCsv(text: string): CsvMatchRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const required = [
    'match_id',
    'date',
    'kickoff_time',
    'location',
    'home_team',
    'away_team',
  ];
  for (const r of required) {
    if (idx(r) < 0) throw new Error(`CSV missing column: ${r}`);
  }
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const get = (name: string) => cols[idx(name)]?.trim() ?? '';
    return {
      match_id: get('match_id'),
      date: get('date'),
      kickoff_time: get('kickoff_time'),
      location: get('location'),
      home_team: get('home_team'),
      away_team: get('away_team'),
      competition: get('competition') || undefined,
      notes: get('notes') || undefined,
      level: get('level') || undefined,
      gender: get('gender') || undefined,
    };
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

import { chicagoWallTimeToUtcIso } from '@/domain/sheetTime';

/** Combine date + time into ISO using America/Chicago wall time from the sheet. */
export function csvRowToKickoffIso(row: CsvMatchRow): string {
  const d = row.date.includes('T') ? row.date.slice(0, 10) : row.date;
  const t = row.kickoff_time.length === 5 ? `${row.kickoff_time}:00` : row.kickoff_time;
  return chicagoWallTimeToUtcIso(d, t);
}
