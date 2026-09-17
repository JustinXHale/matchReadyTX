/**
 * Port of Match Calendar `flightDistance.ts` for server-side platform rollups.
 * Keep airportRegistry.json in sync via Match Calendar `npm run build:airports`.
 */

import airportRegistry from './airportRegistry.json';

type AirportCoords = {
  lat: number;
  lon: number;
};

export type FlightSegmentLike = {
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureAt?: unknown;
  arrivalAt?: unknown;
  confirmation?: string;
};

export type FlightInfoLike = {
  segments?: FlightSegmentLike[];
  notes?: string;
  selfPaid?: boolean;
  amountPaid?: number;
  reimbursementStatus?: string;
  reimbursedAmount?: number;
};

const EARTH_RADIUS_MILES = 3958.8;
const registry = airportRegistry as Record<string, AirportCoords>;

export function normalizeAirportCode(raw?: string): string | null {
  const trimmed = raw?.trim().toUpperCase();
  if (!trimmed) return null;

  if (/^[A-Z]{3}$/.test(trimmed)) {
    return trimmed;
  }

  const prefixMatch = trimmed.match(/^([A-Z]{3})(?:\s*[-–/]\s*.*)?$/);
  return prefixMatch?.[1] ?? null;
}

function lookupAirport(code: string): AirportCoords | null {
  return registry[code] ?? null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceBetweenAirports(
  departureCode: string,
  arrivalCode: string,
): number | null {
  const departure = lookupAirport(departureCode);
  const arrival = lookupAirport(arrivalCode);
  if (!departure || !arrival) return null;

  const dLat = toRadians(arrival.lat - departure.lat);
  const dLon = toRadians(arrival.lon - departure.lon);
  const lat1 = toRadians(departure.lat);
  const lat2 = toRadians(arrival.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_MILES * c);
}

function getFlightSegments(flight?: FlightInfoLike): FlightSegmentLike[] {
  return flight?.segments?.length ? flight.segments : [];
}

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

export function countFlightSegments(flight?: FlightInfoLike): number {
  if (!flight) return 0;

  return getFlightSegments(flight).filter(hasFlightSegmentData).length;
}

function getSegmentFlightMiles(segment: FlightSegmentLike): number | null {
  const departureCode = normalizeAirportCode(segment.departureAirport);
  const arrivalCode = normalizeAirportCode(segment.arrivalAirport);
  if (!departureCode || !arrivalCode) return null;

  return distanceBetweenAirports(departureCode, arrivalCode);
}

export function getTotalFlightMiles(flight?: FlightInfoLike): number | null {
  if (!flight) return null;

  let total = 0;
  let hasLeg = false;

  for (const segment of getFlightSegments(flight)) {
    const miles = getSegmentFlightMiles(segment);
    if (miles == null) continue;
    total += miles;
    hasLeg = true;
  }

  return hasLeg ? total : null;
}
