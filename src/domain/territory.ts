import type { Match, Team, TerritoryCityMapping, UserProfile } from './types';
import { formatMatchKickoff } from './matchTime';

export type { TerritoryCityMapping };

/** Sheet row 1 column headers → display labels (e.g. SAN ANTONIO → San Antonio). */
export function formatMetroLabel(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse proximity tab columns A–E: row 1 = metro headers, rows 2+ = cities.
 * Ignores columns F+ (reference / legacy columns).
 */
export function parseProximityColumnsAE(
  values: string[][],
): TerritoryCityMapping[] {
  if (!values.length) return [];
  const header = values[0] ?? [];
  const metros: (string | null)[] = [];
  for (let col = 0; col < 5; col++) {
    const raw = String(header[col] ?? '').trim();
    if (!raw) {
      metros[col] = null;
      continue;
    }
    const lower = raw.toLowerCase();
    if (lower === 'metro' || lower === 'city' || lower === 'zip') {
      metros[col] = null;
      continue;
    }
    metros[col] = formatMetroLabel(raw);
  }
  if (!metros.some(Boolean)) return [];

  const out: TerritoryCityMapping[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    for (let col = 0; col < 5; col++) {
      const metro = metros[col];
      if (!metro) continue;
      const city = String(row[col] ?? '').trim();
      if (!city) continue;
      out.push({ metro, city });
    }
  }
  return out;
}

export function buildTerritoryLookup(
  rows: TerritoryCityMapping[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { metro, city } of rows) {
    const key = normalizeCityKey(city);
    if (key) map.set(key, metro);
  }
  return map;
}

export function uniqueMetros(rows: TerritoryCityMapping[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const { metro } of rows) {
    if (!seen.has(metro)) {
      seen.add(metro);
      list.push(metro);
    }
  }
  return list;
}

export function resolveTerritoryForCity(
  city: string | undefined | null,
  lookup: Map<string, string> | TerritoryCityMapping[],
): string | null {
  const map =
    lookup instanceof Map ? lookup : buildTerritoryLookup(lookup);
  const key = normalizeCityKey(city ?? '');
  if (!key) return null;
  return map.get(key) ?? null;
}

export function resolveOfficialTerritory(
  user: Pick<UserProfile, 'homeCity'>,
  lookup: Map<string, string> | TerritoryCityMapping[],
): string | null {
  return resolveTerritoryForCity(user.homeCity, lookup);
}

/** Best-effort city from a comma-separated US address line. */
export function cityFromAddressLine(address?: string | null): string | null {
  const a = String(address ?? '').trim();
  if (!a) return null;
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && /^(TX|Texas)$/i.test(parts[parts.length - 1]!)) {
    return parts[parts.length - 2] ?? null;
  }
  if (parts.length >= 2 && /^[A-Za-z]{2}$/.test(parts[parts.length - 1]!)) {
    return parts[parts.length - 2] ?? null;
  }
  return null;
}

export function resolveMatchTerritory(
  match: Pick<Match, 'venueAddress' | 'homeTeamId'>,
  teams: Team[],
  lookup: Map<string, string> | TerritoryCityMapping[],
): string | null {
  const fromVenue = resolveTerritoryForCity(
    cityFromAddressLine(match.venueAddress),
    lookup,
  );
  if (fromVenue) return fromVenue;
  const home = teams.find((t) => t.id === match.homeTeamId);
  return resolveTerritoryForCity(cityFromAddressLine(home?.address), lookup);
}

/** Short one-line context for the assign-official modal. */
export function formatAssignMatchBlurb(match: Match, timeZone: string): string {
  const when = formatMatchKickoff(match.kickoffAt, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const parts = [`${match.homeTeamName} vs ${match.awayTeamName}`, when];
  if (match.level?.trim()) parts.push(match.level.trim());
  const where =
    match.venueName?.trim() || match.venueAddress?.trim() || '';
  if (where) parts.push(where);
  return parts.join(' · ');
}

/** Demo / offline territory list (mirrors production proximity tab). */
export const DEMO_TERRITORY_CITIES: TerritoryCityMapping[] = [
  { metro: 'Austin', city: 'Austin' },
  { metro: 'Austin', city: 'Jonestown' },
  { metro: 'Austin', city: 'Leander' },
  { metro: 'Austin', city: 'Round Rock' },
  { metro: 'Dallas', city: 'Dallas' },
  { metro: 'Dallas', city: 'Denton' },
  { metro: 'Dallas', city: 'Flower Mound' },
  { metro: 'Dallas', city: 'Fort Worth' },
  { metro: 'Dallas', city: 'Keller' },
  { metro: 'Dallas', city: 'Longview' },
  { metro: 'Dallas', city: 'North Richlan Hills' },
  { metro: 'Dallas', city: 'Plano' },
  { metro: 'Dallas', city: 'Rockwall' },
  { metro: 'Dallas', city: 'Waco' },
  { metro: 'Dallas', city: 'Wylie' },
  { metro: 'Houston', city: 'Haj' },
  { metro: 'Houston', city: 'Houston' },
  { metro: 'Houston', city: 'Huntsville' },
  { metro: 'Houston', city: 'Katy' },
  { metro: 'Houston', city: 'Montgomery' },
  { metro: 'Houston', city: 'Pearland' },
  { metro: 'Houston', city: 'Rosenberg' },
  { metro: 'Houston', city: 'Spring' },
  { metro: 'Houston', city: 'The Woodlands' },
  { metro: 'San Antonio', city: 'Corpus Christi' },
  { metro: 'San Antonio', city: 'Schertz' },
  { metro: 'San Antonio', city: 'Seguin' },
  { metro: 'Oklahoma', city: 'Edmond' },
  { metro: 'Oklahoma', city: 'Norman' },
];
