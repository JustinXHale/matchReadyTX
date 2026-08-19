import type { Match, RequestableSlot } from './types';
import {
  CREW_SLOTS,
  emptyAssignment,
  emptyCmoContact,
  emptyCrew,
  crewPeople,
  REQUESTABLE_SLOTS,
} from './types';

/** Default crew roles for a competition level (assigner-configured per org). */
export type LevelCrewDefaults = {
  roles: RequestableSlot[];
};

export type DefaultCrewByLevel = Record<string, LevelCrewDefaults>;

/** Sensible defaults when the assigner has not configured a level yet. */
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

/** Union org levels with sheet-derived levels (stable order). */
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

/** Build crew blocks + rolesNeeded from a role list. */
export function matchFromCrewRoles(
  roles: RequestableSlot[],
): Pick<Match, 'crew' | 'rolesNeeded' | 'cmo'> {
  const normalized = normalizeRoles(roles);
  const crew = emptyCrew();
  for (const slot of CREW_SLOTS) {
    crew[slot] = normalized.includes(slot) ? [emptyAssignment(slot)] : [];
  }
  const cmo = normalized.includes('cmo') ? [emptyCmoContact()] : undefined;
  return {
    crew,
    rolesNeeded: normalized,
    cmo,
  };
}

export function matchHasCrewAssignments(match: Match): boolean {
  if ((match.cmo ?? []).some((c) => Boolean(c.userId))) return true;
  return CREW_SLOTS.some((s) => crewPeople(match.crew[s]).length > 0);
}

/** True when MO and AR slots have no assignees — safe to re-apply level defaults. */
export function matchEligibleForCrewDefaultsReapply(match: Match): boolean {
  if (match.status === 'cancelled' || match.status === 'postponed') {
    return false;
  }
  const moAssigned = crewPeople(match.crew.mo).length > 0;
  const arAssigned =
    crewPeople(match.crew.ar1).length > 0 ||
    crewPeople(match.crew.ar2).length > 0;
  return !moAssigned && !arAssigned;
}

/** True when crew is still the stock single-MO setup from sheet sync. */
export function hasStockCrewSetup(match: Match): boolean {
  if (matchHasCrewAssignments(match)) return false;
  const roles = match.rolesNeeded;
  if (roles && roles.length > 1) return false;
  if ((match.cmo ?? []).length > 0) return false;
  for (const slot of CREW_SLOTS) {
    if (slot === 'mo') continue;
    if ((match.crew[slot] ?? []).length > 0) return false;
  }
  return true;
}

/** Apply org defaults for this match level (draft / release paths). */
export function applyLevelCrewDefaults(
  match: Match,
  configured?: DefaultCrewByLevel | null,
): Match {
  const defs = resolveCrewDefaultsForLevel(match.level, configured);
  const built = matchFromCrewRoles(defs.roles);
  return {
    ...match,
    crew: built.crew,
    rolesNeeded: built.rolesNeeded,
    cmo: built.cmo,
  };
}

export function applyLevelCrewDefaultsIfStock(
  match: Match,
  configured?: DefaultCrewByLevel | null,
): Match {
  if (!hasStockCrewSetup(match)) return match;
  return applyLevelCrewDefaults(match, configured);
}
