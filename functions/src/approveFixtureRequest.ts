import { google } from 'googleapis';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { emptyCrew, sanitizeMatchId } from './sheetParse';

type FixtureSide = 'home' | 'away';

export type FixtureRequestDoc = {
  status: string;
  requesterUserId: string;
  requesterName: string;
  requesterTeamId: string;
  side: FixtureSide;
  opponentTeamId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  venueName: string;
  venueAddress: string;
  competition?: string | null;
  level: string;
  gender: string;
  notes?: string | null;
  flightProvided?: boolean;
  housingProvided?: boolean;
};

function sheetsClient(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function chicagoDateParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new HttpsError('invalid-argument', 'Invalid kickoffAt on request.');
  }
  // Format in America/Chicago for Sheet columns
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = dateFmt.format(d); // YYYY-MM-DD
  const time = timeFmt.format(d); // HH:MM
  return { date, time };
}

function newAppMatchIds(now = new Date()): {
  matchId: string;
  sheetRowKey: string;
} {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const short = Math.random().toString(36).slice(2, 8).toUpperCase();
  const key = `APP-${y}${m}${d}-${short}`;
  return { matchId: sanitizeMatchId(key), sheetRowKey: key };
}

function headerIndex(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) =>
    String(h ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
  );
  for (const a of aliases) {
    const i = norm.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
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

async function appendScheduleRow(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  row: {
    matchId: string;
    date: string;
    time: string;
    location: string;
    homeTeam: string;
    awayTeam: string;
    competition?: string;
    level: string;
    gender: string;
    notes?: string;
  },
): Promise<void> {
  const values = await readTab(sheets, spreadsheetId, 'Schedule');
  if (!values.length) {
    throw new HttpsError(
      'failed-precondition',
      'Schedule tab missing or empty — cannot append fixture.',
    );
  }
  const headers = values[0] ?? [];
  const width = Math.max(headers.length, 10);
  const line = Array.from({ length: width }, () => '');

  const set = (aliases: string[], value: string) => {
    const i = headerIndex(headers, aliases);
    if (i >= 0) line[i] = value;
  };

  set(['match_id', 'matchid', 'id'], row.matchId);
  set(['date'], row.date);
  set(['kickoff_time', 'time', 'kickoff'], row.time);
  set(['location'], row.location);
  set(['home_team', 'home'], row.homeTeam);
  set(['away_team', 'away'], row.awayTeam);
  set(['competition'], row.competition ?? '');
  set(['level'], row.level);
  set(['gender'], row.gender);
  set(['notes'], row.notes ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Schedule!A:Z',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [line] },
  });
}

async function upsertLocationsRow(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  venueName: string,
  venueAddress: string,
  gender: string,
): Promise<void> {
  const values = await readTab(sheets, spreadsheetId, 'Locations');
  if (!values.length) {
    // Create header + first row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Locations!A1:D2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['abbreviation', 'gender', 'venue_name', 'address'],
          [venueName, gender, venueName, venueAddress],
        ],
      },
    });
    return;
  }

  const headers = values[0] ?? [];
  const abbrIdx = headerIndex(headers, ['abbreviation', 'location']);
  const genderIdx = headerIndex(headers, ['gender']);
  const nameIdx = headerIndex(headers, ['venue_name', 'name']);
  const addrIdx = headerIndex(headers, ['address']);
  if (abbrIdx < 0) {
    logger.warn('Locations tab missing abbreviation column — skip upsert');
    return;
  }

  const normAbbr = venueName.trim().toLowerCase();
  let existingRow = -1;
  for (let i = 1; i < values.length; i++) {
    const abbr = String(values[i]?.[abbrIdx] ?? '')
      .trim()
      .toLowerCase();
    if (abbr === normAbbr) {
      existingRow = i;
      break;
    }
  }

  const width = Math.max(headers.length, 4);
  const line = Array.from({ length: width }, () => '');
  if (existingRow >= 0) {
    const prev = values[existingRow] ?? [];
    for (let i = 0; i < width; i++) line[i] = String(prev[i] ?? '');
  }
  line[abbrIdx] = venueName;
  if (genderIdx >= 0) line[genderIdx] = gender;
  if (nameIdx >= 0) line[nameIdx] = venueName;
  if (addrIdx >= 0) line[addrIdx] = venueAddress;

  if (existingRow >= 0) {
    const rowNum = existingRow + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Locations!A${rowNum}:Z${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [line] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Locations!A:Z',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [line] },
    });
  }
}

/**
 * Approve a pending fixture request: append Sheet row, create match,
 * mark request approved.
 */
export async function runApproveFixtureRequest(opts: {
  db: Firestore;
  orgId: string;
  requestId: string;
  reviewedByUserId: string;
  serviceAccountJson: string;
}): Promise<{ ok: true; matchId: string; sheetRowKey: string }> {
  const { db, orgId, requestId, reviewedByUserId, serviceAccountJson } = opts;
  const reqRef = db.doc(`orgs/${orgId}/fixtureRequests/${requestId}`);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError('not-found', 'Fixture request not found.');
  }
  const req = reqSnap.data() as FixtureRequestDoc;
  if (req.status !== 'pending') {
    throw new HttpsError(
      'failed-precondition',
      `Request is already ${req.status}.`,
    );
  }

  const orgSnap = await db.doc(`orgs/${orgId}`).get();
  const sheetId = String(orgSnap.data()?.sheetId ?? '').trim();
  if (!sheetId) {
    throw new HttpsError(
      'failed-precondition',
      'No Sheet linked. Paste a Google Sheet link on Upload, then Sync.',
    );
  }

  const { matchId, sheetRowKey } = newAppMatchIds();
  const { date, time } = chicagoDateParts(req.kickoffAt);
  const sheets = sheetsClient(serviceAccountJson);
  const gender = req.gender === 'women' ? 'women' : 'men';

  try {
    await upsertLocationsRow(
      sheets,
      sheetId,
      req.venueName,
      req.venueAddress,
      gender,
    );
    await appendScheduleRow(sheets, sheetId, {
      matchId: sheetRowKey,
      date,
      time,
      location: req.venueName,
      homeTeam: req.homeTeamName,
      awayTeam: req.awayTeamName,
      competition: req.competition ?? undefined,
      level: req.level,
      gender,
      notes: req.notes ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Sheet write failed for fixture approve', err);
    throw new HttpsError(
      'internal',
      err instanceof Error
        ? `Sheet write failed: ${err.message}`
        : 'Sheet write failed. Ensure the service account is Editor on the workbook.',
    );
  }

  const at = new Date().toISOString();
  const matchRef = db.doc(`orgs/${orgId}/matches/${matchId}`);
  const matchDoc: Record<string, unknown> = {
    id: matchId,
    sheetRowKey,
    status: 'pending_team_review',
    kickoffAt: req.kickoffAt,
    venueName: req.venueName,
    venueAddress: req.venueAddress,
    homeTeamId: req.homeTeamId,
    awayTeamId: req.awayTeamId,
    homeTeamName: req.homeTeamName,
    awayTeamName: req.awayTeamName,
    competition: req.competition || null,
    level: req.level,
    gender,
    notes: req.notes || null,
    flightProvided: Boolean(req.flightProvided),
    housingProvided: Boolean(req.housingProvided),
    crew: emptyCrew(),
    rolesNeeded: ['mo'],
    releasedAt: at,
    homeConfirmedAt: req.side === 'home' ? at : null,
    awayConfirmedAt: req.side === 'away' ? at : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(matchRef, matchDoc);
  batch.update(reqRef, {
    status: 'approved',
    matchId,
    sheetRowKey,
    reviewedAt: at,
    reviewedByUserId,
    updatedAt: at,
  });
  await batch.commit();

  logger.info('approveFixtureRequest', { orgId, requestId, matchId });
  return { ok: true, matchId, sheetRowKey };
}
