/**
 * Port of Match Calendar `travelDuration.ts` for server-side platform rollups.
 */

import type { FlightInfoLike, FlightSegmentLike } from './matchCalendarFlightDistance';

export const DRIVING_SPEED_MPH = 65;

function hasFlightSegmentData(segment: FlightSegmentLike): boolean {
  return Boolean(
    segment.airline ||
      segment.flightNumber ||
      segment.departureAirport ||
      segment.arrivalAirport ||
      segment.departureAt ||
      segment.arrivalAt ||
      segment.confirmation,
  );
}

function getFlightSegments(flight?: FlightInfoLike): FlightSegmentLike[] {
  return flight?.segments?.length ? flight.segments : [];
}

function parseSegmentDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function getSegmentFlightMinutes(segment: FlightSegmentLike): number | null {
  const departureAt = parseSegmentDate(segment.departureAt);
  const arrivalAt = parseSegmentDate(segment.arrivalAt);
  if (!departureAt || !arrivalAt) return null;

  const minutes = Math.round(
    (arrivalAt.getTime() - departureAt.getTime()) / 60_000,
  );
  return minutes > 0 ? minutes : null;
}

export function getTotalFlightMinutes(flight?: FlightInfoLike): number | null {
  if (!flight) return null;

  let total = 0;
  let hasLeg = false;

  for (const segment of getFlightSegments(flight)) {
    if (!hasFlightSegmentData(segment)) continue;
    const minutes = getSegmentFlightMinutes(segment);
    if (minutes == null) continue;
    total += minutes;
    hasLeg = true;
  }

  return hasLeg ? total : null;
}
