import { google } from 'googleapis';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import {
  competitionForGender,
  emptyCrew,
  lookupLocation,
  normalizeGender,
  parseContactRows,
  parseLocationRows,
  parseScheduleRows,
  rowToKickoffIso,
  sanitizeMatchId,
  slugTeamId,
} from './sheetParse';

export type SyncSheetResult = {
  ok: true;
  orgId: string;
  sheetId: string;
  matched: number;
  upserted: number;
  cancelled: number;
  teams: number;
  sheetSyncedAt: string;
};

function sheetsClient(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readTab(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  tabName: string,
): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A:Z`,
      majorDimension: 'ROWS',
    });
    return (res.data.values as string[][]) ?? [];
  } catch (err) {
    logger.warn(`Tab ${tabName} not readable`, { err });
    return [];
  }
}

function sheetFactsChanged(
  existing: DocumentData | undefined,
  next: {
    kickoffAt: string;
    venueName: string;
    venueAddress: string;
    homeTeamName: string;
    awayTeamName: string;
  },
): boolean {
  if (!existing) return false;
  return (
    existing.kickoffAt !== next.kickoffAt ||
    existing.venueName !== next.venueName ||
    existing.venueAddress !== next.venueAddress ||
    existing.homeTeamName !== next.homeTeamName ||
    existing.awayTeamName !== next.awayTeamName
  );
}

/** Firestore rejects `undefined` — omit those keys. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/**
 * Pull Schedule (+ optional Contacts / Locations) into Firestore.
 * Preserves workflow fields (status, crew, confirmations) on existing matches;
 * updates Sheet facts and marks needs_reconfirmation when facts change post-draft.
 */
export async function runSheetSync(opts: {
  db: Firestore;
  orgId: string;
  sheetId: string;
  serviceAccountJson: string;
}): Promise<SyncSheetResult> {
  const { db, orgId, sheetId, serviceAccountJson } = opts;
  const sheets = sheetsClient(serviceAccountJson);

  const scheduleValues = await readTab(sheets, sheetId, 'Schedule');
  if (!scheduleValues.length) {
    throw new Error(
      'No Schedule tab (or empty). Add a tab named “Schedule” with the required columns.',
    );
  }

  const rows = parseScheduleRows(scheduleValues);
  const contacts = parseContactRows(await readTab(sheets, sheetId, 'Contacts'));
  const locations = parseLocationRows(
    await readTab(sheets, sheetId, 'Locations'),
  );

  const teamNames = new Set<string>();
  for (const row of rows) {
    if (row.home_team) teamNames.add(row.home_team);
    if (row.away_team) teamNames.add(row.away_team);
  }
  for (const c of contacts) teamNames.add(c.team_name);

  let batch = db.batch();
  let batchOps = 0;
  const flushBatch = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };
  const setDoc = (
    ref: DocumentReference,
    data: Record<string, unknown>,
    merge = true,
  ) => {
    batch.set(ref, stripUndefined(data), { merge });
    batchOps += 1;
  };

  // Teams
  for (const name of teamNames) {
    const id = slugTeamId(name);
    const emails = contacts
      .filter((c) => c.team_name === name)
      .map((c) => c.email);
    const phones = contacts
      .filter((c) => c.team_name === name && c.phone)
      .map((c) => c.phone!);
    setDoc(db.doc(`orgs/${orgId}/teams/${id}`), {
      id,
      name,
      contactEmails: emails,
      ...(phones.length ? { contactPhones: phones } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (batchOps >= 400) await flushBatch();
  }

  let upserted = 0;
  let cancelled = 0;

  for (const row of rows) {
    const matchId = sanitizeMatchId(row.match_id);
    const ref = db.doc(`orgs/${orgId}/matches/${matchId}`);
    const snap = await ref.get();
    const existing = snap.data();

    const gender = normalizeGender(row.gender);
    const loc = lookupLocation(locations, row.location, gender);
    const venueName = loc?.venue_name || row.location || 'TBD';
    const venueAddress = loc?.address || row.location || '';
    const kickoffAt = rowToKickoffIso(row);
    const homeTeamId = slugTeamId(row.home_team);
    const awayTeamId = slugTeamId(row.away_team);
    const competition =
      row.competition || competitionForGender(gender);
    const level = row.level || 'Tier 1';
    const sheetCancelled =
      (row.status ?? '').toUpperCase() === 'CANCELLED' ||
      (row.status ?? '').toUpperCase() === 'CANCELED';

    const facts = {
      kickoffAt,
      venueName,
      venueAddress,
      homeTeamName: row.home_team,
      awayTeamName: row.away_team,
    };

    if (!snap.exists) {
      const status = sheetCancelled ? 'cancelled' : 'draft';
      setDoc(
        ref,
        {
          id: matchId,
          sheetRowKey: row.match_id,
          status,
          ...facts,
          ...(typeof loc?.lat === 'number' ? { venueLat: loc.lat } : {}),
          ...(typeof loc?.lng === 'number' ? { venueLng: loc.lng } : {}),
          homeTeamId,
          awayTeamId,
          competition,
          level,
          gender,
          notes: row.notes || null,
          flightProvided: false,
          housingProvided: false,
          crew: emptyCrew(),
          ...(sheetCancelled
            ? { cancelledAt: new Date().toISOString() }
            : {}),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        false,
      );
      upserted += 1;
      if (sheetCancelled) cancelled += 1;
    } else {
      const patch: Record<string, unknown> = {
        sheetRowKey: row.match_id,
        ...facts,
        homeTeamId,
        awayTeamId,
        competition,
        level,
        gender,
        notes: row.notes || null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (loc?.lat != null) patch.venueLat = loc.lat;
      if (loc?.lng != null) patch.venueLng = loc.lng;

      if (sheetCancelled && existing?.status !== 'cancelled') {
        patch.status = 'cancelled';
        patch.cancelledAt = new Date().toISOString();
        cancelled += 1;
      } else if (
        !sheetCancelled &&
        sheetFactsChanged(existing, facts) &&
        existing?.status &&
        existing.status !== 'draft' &&
        existing.status !== 'cancelled'
      ) {
        patch.status = 'needs_reconfirmation';
        patch.homeConfirmedAt = FieldValue.delete();
        patch.awayConfirmedAt = FieldValue.delete();
      }

      setDoc(ref, patch, true);
      upserted += 1;
    }

    if (batchOps >= 400) await flushBatch();
  }

  const sheetSyncedAt = new Date().toISOString();
  setDoc(db.doc(`orgs/${orgId}`), {
    sheetId,
    sheetSyncedAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await flushBatch();

  logger.info('Sheet sync complete', {
    orgId,
    sheetId,
    matched: rows.length,
    upserted,
    cancelled,
    teams: teamNames.size,
  });

  return {
    ok: true,
    orgId,
    sheetId,
    matched: rows.length,
    upserted,
    cancelled,
    teams: teamNames.size,
    sheetSyncedAt,
  };
}
