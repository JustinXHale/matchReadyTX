/** Parse Schedule / Contacts sheet rows into sync payloads. */

export type ScheduleRow = {
  match_id: string;
  date: string;
  kickoff_time: string;
  location: string;
  home_team: string;
  away_team: string;
  competition?: string;
  level?: string;
  gender?: string;
  notes?: string;
  status?: string;
};

export type ContactRow = {
  team_name: string;
  email: string;
  phone?: string;
};

export type LocationRow = {
  abbreviation: string;
  gender?: string;
  venue_name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Map 2D values (header row + data) to objects keyed by normalized header. */
export function rowsFromValues(values: string[][]): Record<string, string>[] {
  if (!values.length) return [];
  const headers = values[0]!.map((h) => normHeader(String(h ?? '')));
  return values.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = String(cols[i] ?? '').trim();
    });
    return obj;
  });
}

export function parseScheduleRows(values: string[][]): ScheduleRow[] {
  if (!values.length) return [];
  const headers = values[0]!.map((h) => normHeader(String(h ?? '')));

  const alias = (names: string[]): string | null => {
    for (const n of names) {
      if (headers.includes(n)) return n;
    }
    return null;
  };

  const col = {
    match_id: alias(['match_id', 'matchid', 'id']),
    date: alias(['date', 'match_date', 'kickoff_date']),
    kickoff_time: alias([
      'kickoff_time',
      'kick_off_time',
      'kickoff',
      'kick_off',
      'time',
      'start_time',
    ]),
    location: alias(['location', 'venue', 'field']),
    home_team: alias(['home_team', 'home', 'home_club']),
    away_team: alias(['away_team', 'away', 'away_club']),
    competition: alias(['competition', 'comp']),
    level: alias(['level', 'tier', 'division']),
    gender: alias(['gender', 'side']),
    notes: alias(['notes', 'note', 'comments']),
    status: alias(['status', 'state']),
  };

  for (const key of [
    'match_id',
    'date',
    'location',
    'home_team',
    'away_team',
  ] as const) {
    if (!col[key]) {
      throw new Error(`Schedule sheet missing column: ${key}`);
    }
  }

  return rowsFromValues(values)
    .filter((row) => row[col.match_id!] || row.match_id)
    .map((row) => {
      const get = (key: keyof typeof col) => {
        const h = col[key];
        return h ? (row[h] ?? '').trim() : '';
      };
      return {
        match_id: get('match_id'),
        date: get('date'),
        kickoff_time: get('kickoff_time'),
        location: get('location'),
        home_team: get('home_team'),
        away_team: get('away_team'),
        competition: get('competition') || undefined,
        level: get('level') || undefined,
        gender: get('gender') || undefined,
        notes: get('notes') || undefined,
        status: get('status') || undefined,
      };
    })
    .filter((row) => row.match_id);
}

export function parseContactRows(values: string[][]): ContactRow[] {
  if (!values.length) return [];
  const headers = values[0]!.map((h) => normHeader(String(h ?? '')));
  if (!headers.includes('team_name') || !headers.includes('email')) return [];
  return rowsFromValues(values)
    .filter((r) => r.team_name && r.email)
    .map((r) => ({
      team_name: r.team_name!,
      email: r.email!.toLowerCase(),
      phone: r.phone || undefined,
    }));
}

export function parseLocationRows(values: string[][]): LocationRow[] {
  if (!values.length) return [];
  const headers = values[0]!.map((h) => normHeader(String(h ?? '')));
  const abbrKey = headers.includes('abbreviation')
    ? 'abbreviation'
    : headers.includes('location')
      ? 'location'
      : null;
  if (!abbrKey) return [];
  return rowsFromValues(values)
    .filter((r) => r[abbrKey])
    .map((r) => ({
      abbreviation: (r[abbrKey] ?? '').toUpperCase(),
      gender: r.gender || undefined,
      venue_name: r.venue_name || r.name || r.location_name || undefined,
      address: r.address || r.venue_address || undefined,
      lat: r.lat ? Number(r.lat) : undefined,
      lng: r.lng ? Number(r.lng) : undefined,
    }));
}

export function normalizeGender(raw?: string): 'men' | 'women' {
  const g = (raw ?? '').trim().toLowerCase();
  if (
    g.startsWith('w') ||
    g.includes('women') ||
    g === 'f' ||
    g === 'female'
  ) {
    return 'women';
  }
  return 'men';
}

export function competitionForGender(gender: 'men' | 'women'): string {
  return gender === 'women' ? 'Lonestar Women' : 'Lonestar Men';
}

/** Normalize a Sheets date cell to YYYY-MM-DD. */
export function normalizeDatePart(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO date or datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Sheets serial day number (e.g. 45920)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      // Excel/Sheets epoch 1899-12-30
      const ms = Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
      const d = new Date(ms);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = mdy[1]!.padStart(2, '0');
    const dd = mdy[2]!.padStart(2, '0');
    return `${mdy[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Normalize a Sheets time cell to HH:MM:SS (24h).
 * Empty → default 15:00:00 (common kickoff placeholder).
 */
export function normalizeTimePart(raw: string): string {
  const s = raw.trim();
  if (!s) return '15:00:00';

  // Sheets serial fraction of a day (0–1) or datetime serial with fraction
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const frac = n >= 1 ? n % 1 : n;
    if (frac >= 0 && frac < 1) {
      const totalSec = Math.round(frac * 86400);
      const hh = Math.floor(totalSec / 3600) % 24;
      const mm = Math.floor((totalSec % 3600) / 60);
      const ss = totalSec % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
  }

  // 2:00 PM / 2:00:00 PM
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hh = Number(ampm[1]);
    const mm = ampm[2]!;
    const ss = ampm[3] ?? '00';
    const mer = ampm[4]!.toUpperCase();
    if (mer === 'PM' && hh < 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}:${ss}`;
  }

  // 14:00 or 14:00:00
  const hms = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    return `${hms[1]!.padStart(2, '0')}:${hms[2]}:${hms[3] ?? '00'}`;
  }

  // ISO datetime — take time part
  const isoT = s.match(/T(\d{2}:\d{2}(?::\d{2})?)/);
  if (isoT) {
    const t = isoT[1]!;
    return t.length === 5 ? `${t}:00` : t;
  }

  return '15:00:00';
}

/** Combine date + time into ISO (America/Chicago approx −06:00). */
export function rowToKickoffIso(row: ScheduleRow): string {
  const d = normalizeDatePart(row.date);
  if (!d) {
    throw new Error(
      `Invalid date for ${row.match_id}: "${row.date}" (time: "${row.kickoff_time}")`,
    );
  }
  const t = normalizeTimePart(row.kickoff_time);
  const iso = new Date(`${d}T${t}-06:00`);
  if (Number.isNaN(iso.getTime())) {
    throw new Error(
      `Invalid date/time for ${row.match_id}: date="${row.date}" time="${row.kickoff_time}" → ${d}T${t}`,
    );
  }
  return iso.toISOString();
}

export function slugTeamId(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s ? `t_${s}` : `t_unknown`;
}

export function sanitizeMatchId(id: string): string {
  return id.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export function emptyCrew(): Record<
  string,
  { slot: string; status: string; history: unknown[] }
> {
  return {
    mo: { slot: 'mo', status: 'empty', history: [] },
    ar1: { slot: 'ar1', status: 'empty', history: [] },
    ar2: { slot: 'ar2', status: 'empty', history: [] },
    no4: { slot: 'no4', status: 'empty', history: [] },
  };
}

export function lookupLocation(
  locations: LocationRow[],
  abbreviation: string,
  gender: 'men' | 'women',
): LocationRow | undefined {
  const abbr = abbreviation.trim().toUpperCase();
  if (!abbr) return undefined;
  const gendered = locations.find(
    (l) =>
      l.abbreviation === abbr &&
      l.gender &&
      normalizeGender(l.gender) === gender,
  );
  if (gendered) return gendered;
  return locations.find((l) => l.abbreviation === abbr && !l.gender);
}
