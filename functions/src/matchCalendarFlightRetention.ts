import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';

const EXPIRATION_COLLECTION = 'matchCalendarFlightExpirations';

type RecordKind = 'matches' | 'tournaments';

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate.call(value);
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date
        : undefined;
    }
  }
  return undefined;
}

function expirationId(
  uid: string,
  kind: RecordKind,
  recordId: string,
  segmentId: string,
): string {
  return Buffer.from(`${uid}/${kind}/${recordId}/${segmentId}`).toString(
    'base64url',
  );
}

function importedSegments(data: DocumentData | undefined) {
  const segments = data?.flight?.segments;
  if (!Array.isArray(segments)) return [];
  return segments.filter((segment) =>
    segment &&
    typeof segment === 'object' &&
    typeof segment.id === 'string' &&
    segment.providerImport?.provider === 'aerodatabox' &&
    asDate(segment.providerImport?.expiresAt),
  );
}

export async function syncMatchCalendarFlightExpirations(
  db: Firestore,
  input: {
    uid: string;
    kind: RecordKind;
    recordId: string;
    data: DocumentData | undefined;
  },
): Promise<void> {
  const segments = importedSegments(input.data);
  if (segments.length === 0) return;

  const batch = db.batch();
  for (const segment of segments) {
    const expiresAt = asDate(segment.providerImport.expiresAt)!;
    const ref = db.collection(EXPIRATION_COLLECTION).doc(
      expirationId(input.uid, input.kind, input.recordId, segment.id),
    );
    batch.set(ref, {
      recordPath: `users/${input.uid}/${input.kind}/${input.recordId}`,
      segmentId: segment.id,
      expiresAt: Timestamp.fromDate(expiresAt),
    });
  }
  await batch.commit();
}

function removeProviderFields(segment: Record<string, unknown>) {
  const providerImport = segment.providerImport as
    | { lookupFlightNumber?: unknown }
    | undefined;
  const lookupFlightNumber =
    typeof providerImport?.lookupFlightNumber === 'string'
      ? providerImport.lookupFlightNumber
      : undefined;
  const {
    airline: _airline,
    departureAirport: _departureAirport,
    departureGate: _departureGate,
    arrivalAirport: _arrivalAirport,
    departureAt: _departureAt,
    arrivalAt: _arrivalAt,
    providerImport: _providerImport,
    ...retained
  } = segment;
  void _airline;
  void _departureAirport;
  void _departureGate;
  void _arrivalAirport;
  void _departureAt;
  void _arrivalAt;
  void _providerImport;
  return {
    ...retained,
    ...(lookupFlightNumber ? { flightNumber: lookupFlightNumber } : {}),
  };
}

export async function purgeExpiredMatchCalendarFlightData(
  db: Firestore,
  now = new Date(),
): Promise<number> {
  const snapshot = await db
    .collection(EXPIRATION_COLLECTION)
    .where('expiresAt', '<=', Timestamp.fromDate(now))
    .limit(200)
    .get();

  let purged = 0;
  for (const expiration of snapshot.docs) {
    await db.runTransaction(async (transaction) => {
      const expirationRef = expiration.ref;
      const recordPath = expiration.data().recordPath;
      const segmentId = expiration.data().segmentId;
      if (typeof recordPath !== 'string' || typeof segmentId !== 'string') {
        transaction.delete(expirationRef);
        return;
      }

      const recordRef = db.doc(recordPath);
      const record = await transaction.get(recordRef);
      if (!record.exists) {
        transaction.delete(expirationRef);
        return;
      }

      const data = record.data();
      const segments = data?.flight?.segments;
      if (!Array.isArray(segments)) {
        transaction.delete(expirationRef);
        return;
      }

      let changed = false;
      const nextSegments = segments.map((segment) => {
        if (!segment || typeof segment !== 'object' || segment.id !== segmentId) {
          return segment;
        }
        const expiresAt = asDate(segment.providerImport?.expiresAt);
        if (
          segment.providerImport?.provider !== 'aerodatabox' ||
          !expiresAt ||
          expiresAt.getTime() > now.getTime()
        ) {
          return segment;
        }
        changed = true;
        return removeProviderFields(segment as Record<string, unknown>);
      });

      if (changed) {
        transaction.update(recordRef, {
          'flight.segments': nextSegments,
          updatedAt: Timestamp.fromDate(now),
        });
        purged += 1;
      }
      transaction.delete(expirationRef);
    });
  }

  return purged;
}
