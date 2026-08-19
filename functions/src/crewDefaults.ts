/** Server-side crew defaults (mirrors src/domain/crewDefaults.ts). */

export type RequestableSlot = 'mo' | 'ar1' | 'ar2' | 'no4' | 'cmo';
export type CrewSlot = 'mo' | 'ar1' | 'ar2' | 'no4';

export type LevelCrewDefaults = { roles: RequestableSlot[] };
export type DefaultCrewByLevel = Record<string, LevelCrewDefaults>;

const REQUESTABLE_SLOTS: RequestableSlot[] = [
  'mo',
  'ar1',
  'ar2',
  'no4',
  'cmo',
];

export function fallbackCrewDefaultsForLevel(level: string): LevelCrewDefaults {
  const l = level.trim().toLowerCase();
  if (
    l === '7s' ||
    l.includes('tourney') ||
    l.includes('tournament') ||
    l === 'tourney'
  ) {
    return { roles: ['mo', 'ar1', 'ar2', 'no4', 'cmo'] };
  }
  if (l.includes('tier 3') || l === 'd3' || l.includes('exhibition')) {
    return { roles: ['mo'] };
  }
  if (l.includes('tier 2') || l === 'd2') {
    return { roles: ['mo', 'ar1', 'ar2'] };
  }
  return { roles: ['mo', 'ar1', 'ar2'] };
}

export function resolveCrewDefaultsForLevel(
  level: string,
  configured?: DefaultCrewByLevel | null,
): LevelCrewDefaults {
  const key = level.trim();
  const custom = configured?.[key];
  if (custom?.roles?.length) return custom;
  return fallbackCrewDefaultsForLevel(key);
}

export function mergeMatchLevels(
  orgLevels: string[],
  sheetLevels: string[],
): string[] {
  const out = [...orgLevels];
  for (const raw of sheetLevels) {
    const level = raw.trim();
    if (!level || out.includes(level)) continue;
    out.push(level);
  }
  return out;
}

function newAssignmentId(): string {
  return `ca_${Math.random().toString(36).slice(2, 10)}`;
}

function newCmoId(): string {
  return `cmo_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRoles(roles: RequestableSlot[]): RequestableSlot[] {
  const seen = new Set<RequestableSlot>();
  const out: RequestableSlot[] = [];
  for (const r of roles) {
    if (!REQUESTABLE_SLOTS.includes(r) || seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  if (!out.includes('mo')) out.unshift('mo');
  return out;
}

export function crewPayloadFromRoles(roles: RequestableSlot[]): {
  crew: Record<string, unknown>;
  rolesNeeded: RequestableSlot[];
  cmo?: { id: string }[];
} {
  const normalized = normalizeRoles(roles);
  const crew: Record<string, unknown> = {};
  for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as CrewSlot[]) {
    crew[slot] = normalized.includes(slot)
      ? [
          {
            id: newAssignmentId(),
            slot,
            status: 'empty',
            history: [],
          },
        ]
      : [];
  }
  const cmo = normalized.includes('cmo')
    ? [{ id: newCmoId() }]
    : undefined;
  return { crew, rolesNeeded: normalized, ...(cmo ? { cmo } : {}) };
}

export function buildCrewFieldsForLevel(
  level: string,
  configured?: DefaultCrewByLevel | null,
): ReturnType<typeof crewPayloadFromRoles> {
  const defs = resolveCrewDefaultsForLevel(level, configured);
  return crewPayloadFromRoles(defs.roles);
}

/** Draft matches still on the default single-MO setup from legacy sync. */
export function hasStockCrewInFirestore(
  data: Record<string, unknown> | undefined,
): boolean {
  if (!data) return true;
  const roles = data.rolesNeeded;
  if (Array.isArray(roles) && roles.length > 1) return false;
  if (data.cmo) return false;
  const crew = data.crew;
  if (!crew || typeof crew !== 'object') return true;
  const obj = crew as Record<string, unknown>;
  for (const slot of ['ar1', 'ar2', 'no4'] as CrewSlot[]) {
    const c = obj[slot];
    if (Array.isArray(c) && c.length > 0) return false;
    if (c && typeof c === 'object' && !Array.isArray(c)) return false;
  }
  const mo = obj.mo;
  if (Array.isArray(mo)) {
    if (mo.some((a) => a && typeof a === 'object' && (a as { userId?: string }).userId)) {
      return false;
    }
  } else if (mo && typeof mo === 'object') {
    if ((mo as { userId?: string }).userId) return false;
  }
  return true;
}
