import type {
  CrewSlot,
  FeeTable,
  Match,
  OrgSettings,
  RequestableSlot,
  UserProfile,
} from './types';
import { crewBlocks, rolesNeededForMatch } from './types';

const EARTH_RADIUS_MILES = 3958.8;

/** Haversine distance in miles */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function feeForSlot(
  match: Match,
  org: OrgSettings,
  slot: CrewSlot | 'cmo',
): number {
  if (slot === 'cmo') {
    return match.feeOverride?.cmo ?? org.defaultFees.cmo ?? 0;
  }
  return match.feeOverride?.[slot] ?? org.defaultFees[slot];
}

/** Block count (open + filled) for fee budgeting; at least 1 when role is needed. */
function roleBlockCount(match: Match, slot: RequestableSlot): number {
  if (slot === 'cmo') {
    const n = (match.cmo ?? []).length;
    return n > 0 ? n : 1;
  }
  const n = crewBlocks(match.crew[slot]).length;
  return n > 0 ? n : 1;
}

/** Fee row parts for roles this match uses (count × rate when multiple people). */
export function matchFeeBreakdown(
  match: Match,
  org: OrgSettings,
): { label: string; amount: number }[] {
  const roles = rolesNeededForMatch(match);
  const has = (s: RequestableSlot) => roles.includes(s);
  const parts: { label: string; amount: number }[] = [];

  const pushRole = (slot: RequestableSlot, short: string) => {
    const rate = feeForSlot(match, org, slot);
    const count = roleBlockCount(match, slot);
    parts.push({
      label: count > 1 ? `${short} ×${count}` : short,
      amount: rate * count,
    });
  };

  if (has('mo')) pushRole('mo', 'MO');

  const hasAr1 = has('ar1');
  const hasAr2 = has('ar2');
  if (hasAr1 || hasAr2) {
    const a1 = hasAr1 ? feeForSlot(match, org, 'ar1') : null;
    const a2 = hasAr2 ? feeForSlot(match, org, 'ar2') : null;
    const c1 = hasAr1 ? roleBlockCount(match, 'ar1') : 0;
    const c2 = hasAr2 ? roleBlockCount(match, 'ar2') : 0;
    // Collapse equal AR rates only when each role has at most one block.
    if (
      a1 != null &&
      a2 != null &&
      a1 === a2 &&
      c1 <= 1 &&
      c2 <= 1
    ) {
      const units = c1 + c2;
      parts.push({
        label: units > 1 ? `AR ×${units}` : 'AR',
        amount: a1 * units,
      });
    } else {
      if (a1 != null) {
        parts.push({
          label: c1 > 1 ? `AR1 ×${c1}` : 'AR1',
          amount: a1 * c1,
        });
      }
      if (a2 != null) {
        parts.push({
          label: c2 > 1 ? `AR2 ×${c2}` : 'AR2',
          amount: a2 * c2,
        });
      }
    }
  }

  if (has('no4')) pushRole('no4', '#4');
  if (has('cmo')) pushRole('cmo', 'CMO');
  return parts;
}

export function estimateMileagePay(
  distance: number | undefined,
  org: OrgSettings,
  flightProvided: boolean,
): number {
  if (flightProvided) return 0;
  if (distance === undefined || Number.isNaN(distance)) return 0;
  if (distance < org.mileageMinMiles) return 0;
  return Math.round(distance * org.mileageRatePerMile * 100) / 100;
}

export function matchEconomicsForUser(
  match: Match,
  org: OrgSettings,
  user: UserProfile,
  slot: CrewSlot = 'mo',
): {
  fee: number;
  /** One-way home → venue (haversine until Google Distance Matrix). */
  distanceMiles?: number;
  /** Round-trip estimate (2 × one-way) — used for mileage pay / assigner budgeting. */
  roundTripMiles?: number;
  mileagePay: number;
  flightProvided: boolean;
  housingProvided: boolean;
} {
  let dist: number | undefined;
  if (
    user.homeLat != null &&
    user.homeLng != null &&
    match.venueLat != null &&
    match.venueLng != null
  ) {
    dist = Math.round(
      distanceMiles(
        { lat: user.homeLat, lng: user.homeLng },
        { lat: match.venueLat, lng: match.venueLng },
      ) * 10,
    ) / 10;
  }
  const roundTrip =
    dist != null ? Math.round(dist * 2 * 10) / 10 : undefined;
  return {
    fee: feeForSlot(match, org, slot),
    distanceMiles: dist,
    roundTripMiles: roundTrip,
    mileagePay: estimateMileagePay(roundTrip, org, match.flightProvided),
    flightProvided: match.flightProvided,
    housingProvided: match.housingProvided,
  };
}

export function defaultFees(): FeeTable {
  return { mo: 80, ar1: 40, ar2: 40, no4: 30, cmo: 50 };
}

/** Short label for assigner UI (miles; typically round-trip for pay). */
export function formatDistanceMi(miles: number | undefined): string {
  if (miles == null || Number.isNaN(miles)) return 'Distance unknown';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Rough demo geocode for known TX cities */
export function demoGeocode(address: string): { lat: number; lng: number } {
  const a = address.toLowerCase();
  if (a.includes('austin')) return { lat: 30.2672, lng: -97.7431 };
  if (a.includes('dallas')) return { lat: 32.7767, lng: -96.797 };
  if (a.includes('houston')) return { lat: 29.7604, lng: -95.3698 };
  if (a.includes('san antonio')) return { lat: 29.4241, lng: -98.4936 };
  return { lat: 30.2672, lng: -97.7431 };
}
