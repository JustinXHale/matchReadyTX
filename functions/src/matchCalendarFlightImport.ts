import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';

type AeroDateTime = {
  utc?: unknown;
  local?: unknown;
};

type AeroAirport = {
  iata?: unknown;
  icao?: unknown;
  name?: unknown;
  timeZone?: unknown;
};

type AeroMovement = {
  airport?: AeroAirport;
  scheduledTime?: AeroDateTime;
  revisedTime?: AeroDateTime;
  gate?: unknown;
};

type AeroFlight = {
  number?: unknown;
  status?: unknown;
  airline?: { name?: unknown };
  departure?: AeroMovement;
  arrival?: AeroMovement;
};

export async function isMatchCalendarFlightImportAllowed(
  db: Firestore,
  uid: string,
): Promise<boolean> {
  const access = await db.doc(`matchCalendarFeatureAccess/${uid}`).get();
  return access.data()?.flightImportEnabled === true;
}

export async function assertMatchCalendarFlightImportAllowed(
  db: Firestore,
  uid: string,
): Promise<void> {
  if (!(await isMatchCalendarFlightImportAllowed(db, uid))) {
    throw new HttpsError(
      'permission-denied',
      'Flight import is not enabled for this account.',
    );
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeMovement(raw: AeroMovement | undefined) {
  const airportCode = text(raw?.airport?.iata) ?? text(raw?.airport?.icao);
  const airportName = text(raw?.airport?.name) ?? 'Unknown airport';
  const scheduledUtc = text(raw?.scheduledTime?.utc);
  const scheduledLocal = text(raw?.scheduledTime?.local);
  const revisedUtc = text(raw?.revisedTime?.utc);
  const revisedLocal = text(raw?.revisedTime?.local);
  const timeZone = text(raw?.airport?.timeZone);
  const gate = text(raw?.gate);

  return {
    ...(airportCode ? { airportCode } : {}),
    airportName,
    ...(scheduledUtc ? { scheduledUtc } : {}),
    ...(scheduledLocal ? { scheduledLocal } : {}),
    ...(revisedUtc ? { revisedUtc } : {}),
    ...(revisedLocal ? { revisedLocal } : {}),
    ...(timeZone ? { timeZone } : {}),
    ...(gate ? { gate } : {}),
  };
}

function normalizeFlight(raw: AeroFlight, index: number) {
  const number = text(raw.number) ?? 'Unknown flight';
  const departure = normalizeMovement(raw.departure);
  const arrival = normalizeMovement(raw.arrival);
  const idParts = [
    number,
    departure.scheduledUtc,
    departure.airportCode,
    arrival.airportCode,
    String(index),
  ];

  return {
    id: idParts.filter(Boolean).join('-'),
    number,
    status: text(raw.status) ?? 'Unknown',
    ...(text(raw.airline?.name) ? { airline: text(raw.airline?.name) } : {}),
    departure,
    arrival,
  };
}

export async function searchAeroDataBoxFlights(input: {
  apiKey: string;
  flightNumber: string;
  departureDate: string;
  departureAirport: string;
}) {
  const flightNumber = input.flightNumber.replace(/\s+/g, '').toUpperCase();
  const departureAirport = input.departureAirport.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(flightNumber)) {
    throw new HttpsError('invalid-argument', 'Enter a valid flight number.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.departureDate)) {
    throw new HttpsError('invalid-argument', 'Enter a valid departure date.');
  }
  if (!/^[A-Z]{3}$/.test(departureAirport)) {
    throw new HttpsError(
      'invalid-argument',
      'Enter a valid three-letter departing airport code.',
    );
  }
  const parsedDate = new Date(`${input.departureDate}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== input.departureDate
  ) {
    throw new HttpsError('invalid-argument', 'Enter a valid departure date.');
  }

  const url = new URL(
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}/${input.departureDate}`,
  );
  url.searchParams.set('dateLocalRole', 'Departure');
  url.searchParams.set('withAircraftImage', 'false');
  url.searchParams.set('withLocation', 'false');
  url.searchParams.set('withFlightPlan', 'false');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-rapidapi-key': input.apiKey,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpsError('unavailable', 'The flight data service is unavailable.');
  }

  if (response.status === 204 || response.status === 404) {
    return { flights: [] };
  }
  if (response.status === 429) {
    throw new HttpsError('resource-exhausted', 'Flight lookup quota exceeded.');
  }
  if (response.status === 400) {
    throw new HttpsError('invalid-argument', 'The flight lookup was not accepted.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpsError(
      'failed-precondition',
      'The flight data service is not configured correctly.',
    );
  }
  if (!response.ok) {
    throw new HttpsError('unavailable', 'The flight data service returned an error.');
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new HttpsError('data-loss', 'The flight data response was invalid.');
  }

  const flights = body
    .map((flight, index) =>
      normalizeFlight((flight ?? {}) as AeroFlight, index),
    )
    .filter(
      (flight) => flight.departure.airportCode?.toUpperCase() === departureAirport,
    );

  return { flights };
}
