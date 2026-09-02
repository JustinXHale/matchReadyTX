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
  title?: string;
  /** Short format label from Schedule (e.g. 2nd Side) — not tier or event title. */
  match_type?: string;
};

export type ContactRow = {
  team_name: string;
  email: string;
  phone?: string;
  /** Person / club-contact name from the Name column. */
  name?: string;
  /** Conference / competition from Contacts (e.g. Lonestar Men). */
  conference?: string;
};

export type LocationRow = {
  abbreviation: string;
  gender?: string;
  /** Conference from the Competition column (e.g. Lonestar Men). */
  competition?: string;
  /** Full club name from the Name column (e.g. University of North Texas). */
  teamName?: string;
  venue_name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function cleanPhone(raw?: string): string | undefined {
  const s = (raw ?? '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();
  return s || undefined;
}

/** Real mailbox only — blank / phone-only Contacts rows are skipped. */
export function isUsableEmail(raw: string): boolean {
  const e = raw.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at <= 0) return false;
  const domain = e.slice(at + 1);
  return domain.includes('.') && !/\s/.test(e);
}

function softenName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\bst\.?\b/g, 'saint')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInstitution(soft: string): string {
  return soft
    .replace(/^(the\s+)?(university|univ)\s+of\s+/, '')
    .replace(/\b(university|univ|college)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keys used to join Contacts `team_name` to schedule / Locations clubs.
 * Handles full names vs abbreviations and "Texas State (TXST)".
 */
export function contactMatchKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const keys = new Set<string>();
  const add = (s: string) => {
    const soft = softenName(s);
    if (!soft) return;
    keys.add(soft);
    keys.add(soft.replace(/\s+/g, ''));
    const stripped = stripInstitution(soft);
    if (stripped && stripped !== soft) {
      keys.add(stripped);
      keys.add(stripped.replace(/\s+/g, ''));
    }
  };
  add(trimmed);
  const paren = trimmed.match(/^(.*)\(([^)]+)\)\s*$/);
  if (paren) {
    add(paren[1]!);
    add(paren[2]!);
  }
  return [...keys];
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
    match_id: alias([
      'match_id',
      'matchid',
      'id',
      'game_id',
      'game_code',
      'fixture_id',
    ]),
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
    away_team: alias([
      'away_team',
      'away',
      'away_club',
      'opponent',
      'opp',
      'visitor',
      'visiting_team',
    ]),
    competition: alias([
      'competition',
      'conference',
      'comp',
      'league',
      'conf',
    ]),
    level: alias(['level', 'tier', 'division', 'match_level', 'game_level']),
    gender: alias(['gender', 'side', 'sex']),
    notes: alias(['notes', 'note', 'comments']),
    status: alias(['status', 'state']),
    title: alias(['title', 'event', 'event_name', 'match_title']),
    match_type: alias([
      'match_type',
      'matchtype',
      'match_label',
      'label',
      'format',
      'squad',
    ]),
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
        title: get('title') || undefined,
        match_type: get('match_type') || undefined,
      };
    })
    .filter((row) => row.match_id);
}

export function parseContactRows(values: string[][]): ContactRow[] {
  if (!values.length) return [];
  const headers = values[0]!.map((h) => normHeader(String(h ?? '')));
  const alias = (names: string[]): string | null => {
    for (const n of names) {
      if (headers.includes(n)) return n;
    }
    return null;
  };

  const teamKey = alias(['team_name', 'team', 'club', 'club_name']);
  const emailKey = alias(['email', 'e_mail', 'e-mail']);
  if (!teamKey || !emailKey) return [];
  const phoneKey = alias(['phone', 'mobile', 'cell', 'phone_number']);
  const personKey = alias(['name', 'contact_name', 'contact', 'person']);
  const confKey = alias(['conference', 'competition', 'league', 'comp']);

  return rowsFromValues(values)
    .map((r) => {
      const team_name = (r[teamKey] ?? '').trim();
      const email = (r[emailKey] ?? '').trim().toLowerCase();
      return {
        team_name,
        email,
        phone: phoneKey ? cleanPhone(r[phoneKey]) : undefined,
        name: personKey ? (r[personKey] ?? '').trim() || undefined : undefined,
        conference: confKey
          ? (r[confKey] ?? '').trim() || undefined
          : undefined,
      };
    })
    .filter((r) => r.team_name && isUsableEmail(r.email));
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

  const composeAddress = (r: Record<string, string>): string => {
    const full = (r.full_address || r.fulladdress || '').trim();
    if (full) return full;
    const zip = r.zip_code || r.zip || r.zipcode || '';
    return [r.address, r.city, r.state, zip].filter(Boolean).join(', ');
  };

  return rowsFromValues(values)
    .filter((r) => r[abbrKey])
    .map((r) => {
      const fieldOrStreet = (r.address || r.venue_name || r.subvenue || '').trim();
      const mailing = composeAddress(r);
      const competition = (
        r.competition ||
        r.conference ||
        r.league ||
        r.comp ||
        ''
      ).trim();
      return {
        abbreviation: (r[abbrKey] ?? '').toUpperCase(),
        gender: r.gender || undefined,
        competition: competition || undefined,
        teamName: (r.name || r.team_name || r.full_name || '').trim() || undefined,
        venue_name: fieldOrStreet || undefined,
        address: mailing || fieldOrStreet || undefined,
        lat: r.lat ? Number(r.lat) : undefined,
        lng: r.lng ? Number(r.lng) : undefined,
      };
    });
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

/** Infer men/women from names like "Lonestar Women". */
export function genderFromCompetitionName(
  name?: string,
): 'men' | 'women' | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  if (/\bwomen\b|\bfemale\b/i.test(n)) return 'women';
  if (/\bmen\b|\bmale\b/i.test(n)) return 'men';
  return null;
}

/** Locations-tab rows with Competition = VENUE are fields only — not clubs. */
export function isVenueOnlyLocationCompetition(competition?: string): boolean {
  const c = (competition ?? '').trim().toLowerCase();
  return c === 'venue' || c === 'venues';
}

export function isVenueOnlyLocationRow(loc: LocationRow): boolean {
  return isVenueOnlyLocationCompetition(loc.competition);
}

function locationGender(loc: LocationRow): 'men' | 'women' | null {
  if (loc.gender?.trim()) return normalizeGender(loc.gender);
  return genderFromCompetitionName(loc.competition);
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

function chicagoPartsAtUtc(utcMs: number): {
  y: number;
  mo: number;
  d: number;
  h: number;
  m: number;
  s: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    y: pick('year'),
    mo: pick('month'),
    d: pick('day'),
    h: pick('hour'),
    m: pick('minute'),
    s: pick('second'),
  };
}

/** Sheet kickoff columns are wall time in America/Chicago (CST/CDT). */
export function chicagoWallTimeToUtcIso(dateYmd: string, timeHms: string): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [hh, mm, ssRaw] = timeHms.split(':');
  const h = Number(hh);
  const m = Number(mm);
  const s = Number(ssRaw ?? 0);
  for (const offsetHours of [-6, -5]) {
    const utcMs = Date.UTC(y, mo - 1, d, h - offsetHours, m, s);
    const local = chicagoPartsAtUtc(utcMs);
    if (
      local.y === y &&
      local.mo === mo &&
      local.d === d &&
      local.h === h &&
      local.m === m &&
      local.s === s
    ) {
      return new Date(utcMs).toISOString();
    }
  }
  return new Date(`${dateYmd}T${timeHms}-06:00`).toISOString();
}

/** Combine date + time into ISO (America/Chicago local wall time). */
export function rowToKickoffIso(row: ScheduleRow): string {
  const d = normalizeDatePart(row.date);
  if (!d) {
    throw new Error(
      `Invalid date for ${row.match_id}: "${row.date}" (time: "${row.kickoff_time}")`,
    );
  }
  const t = normalizeTimePart(row.kickoff_time);
  const iso = new Date(chicagoWallTimeToUtcIso(d, t));
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

/** Stable id for a club row: schedule abbreviation + competition (men/women split). */
export function teamIdFromAbbrevAndCompetition(
  abbreviation: string,
  competition: string,
): string {
  return slugTeamId(`${abbreviation.trim()} ${competition.trim()}`);
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
  competition?: string,
): LocationRow | undefined {
  const abbr = abbreviation.trim().toUpperCase();
  if (!abbr) return undefined;
  const sameAbbr = locations.filter((l) => l.abbreviation === abbr);
  if (!sameAbbr.length) return undefined;

  const wantComp = (competition ?? '').trim().toLowerCase();
  if (wantComp) {
    const byComp = sameAbbr.find(
      (l) => (l.competition ?? '').trim().toLowerCase() === wantComp,
    );
    if (byComp) return byComp;
  }

  const byGender = sameAbbr.find((l) => locationGender(l) === gender);
  if (byGender) return byGender;

  const unspecified = sameAbbr.find((l) => !l.gender && !l.competition);
  if (unspecified) return unspecified;

  // Multiple gendered/conference rows: do not pick the first (UNT men vs women).
  if (sameAbbr.length === 1) return sameAbbr[0];
  return undefined;
}
