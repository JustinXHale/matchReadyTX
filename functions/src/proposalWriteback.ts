/**
 * Update an existing Schedule row after a change proposal is accepted.
 */
import { google } from 'googleapis';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

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

function chicagoDateParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new HttpsError('invalid-argument', 'Invalid kickoffAt.');
  }
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
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}

export type ProposalWritebackInput = {
  db: Firestore;
  orgId: string;
  matchId: string;
  serviceAccountJson: string;
  /** Optional overrides (from accepted proposal). */
  kickoffAt?: string;
  venueName?: string;
  venueAddress?: string;
};

export type ProposalWritebackResult = {
  ok: true;
  matchId: string;
  sheetRowKey: string;
  updatedAt: string;
};

/**
 * Merge accepted proposal facts onto Firestore match + Schedule Sheet row.
 */
export async function runProposalWriteback(
  opts: ProposalWritebackInput,
): Promise<ProposalWritebackResult> {
  const { db, orgId, matchId, serviceAccountJson } = opts;

  const orgSnap = await db.doc(`orgs/${orgId}`).get();
  if (!orgSnap.exists) {
    throw new HttpsError('not-found', 'Org not found.');
  }
  const sheetId = String(orgSnap.data()?.sheetId ?? '').trim();
  if (!sheetId) {
    throw new HttpsError(
      'failed-precondition',
      'No Sheet linked. Connect a Google Sheet on Org / Upload first.',
    );
  }

  const matchRef = db.doc(`orgs/${orgId}/matches/${matchId}`);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }
  const match = matchSnap.data() as Record<string, unknown>;
  const sheetRowKey = String(
    match.sheetRowKey ?? match.sheet_row_key ?? matchId,
  ).trim();
  if (!sheetRowKey) {
    throw new HttpsError(
      'failed-precondition',
      'Match has no sheetRowKey — cannot write back to Schedule.',
    );
  }

  const kickoffAt = String(opts.kickoffAt ?? match.kickoffAt ?? '').trim();
  const venueName = String(opts.venueName ?? match.venueName ?? '').trim();
  const venueAddress = String(
    opts.venueAddress ?? match.venueAddress ?? '',
  ).trim();
  const homeTeam = String(match.homeTeamName ?? '').trim();
  const awayTeam = String(match.awayTeamName ?? '').trim();
  const level = String(match.level ?? '').trim();
  const gender = String(match.gender ?? '').trim();
  const competition = String(match.competition ?? '').trim();
  const notes = String(match.notes ?? '').trim();

  if (!kickoffAt || !venueName) {
    throw new HttpsError(
      'invalid-argument',
      'kickoffAt and venueName are required for write-back.',
    );
  }

  const { date, time } = chicagoDateParts(kickoffAt);
  const sheets = sheetsClient(serviceAccountJson);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Schedule!A:Z',
    majorDimension: 'ROWS',
  });
  const values = (res.data.values as string[][]) ?? [];
  if (values.length < 2) {
    throw new HttpsError(
      'failed-precondition',
      'Schedule tab missing or empty.',
    );
  }

  const headers = values[0] ?? [];
  const idIdx = headerIndex(headers, ['match_id', 'matchid', 'id']);
  if (idIdx < 0) {
    throw new HttpsError(
      'failed-precondition',
      'Schedule tab needs a match_id column.',
    );
  }

  const keyNorm = sheetRowKey.toLowerCase();
  let rowIndex = -1; // 0-based in values[]
  for (let i = 1; i < values.length; i++) {
    const cell = String(values[i]?.[idIdx] ?? '')
      .trim()
      .toLowerCase();
    if (cell === keyNorm || cell === matchId.toLowerCase()) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex < 0) {
    throw new HttpsError(
      'not-found',
      `No Schedule row for match_id ${sheetRowKey}.`,
    );
  }

  const width = Math.max(headers.length, values[rowIndex]?.length ?? 0, 10);
  const line = Array.from({ length: width }, (_, c) =>
    String(values[rowIndex]?.[c] ?? ''),
  );

  const set = (aliases: string[], value: string) => {
    const i = headerIndex(headers, aliases);
    if (i >= 0) line[i] = value;
  };

  set(['match_id', 'matchid', 'id'], sheetRowKey);
  set(['date', 'match_date', 'kickoff_date'], date);
  set(
    ['kickoff_time', 'kick_off_time', 'kickoff', 'kick_off', 'time', 'start_time'],
    time,
  );
  set(['location', 'venue', 'field'], venueName);
  if (homeTeam) set(['home_team', 'home', 'home_club'], homeTeam);
  if (awayTeam) set(['away_team', 'away', 'away_club'], awayTeam);
  if (competition) set(['competition', 'comp'], competition);
  if (level) set(['level', 'tier', 'division'], level);
  if (gender) set(['gender', 'side'], gender);
  if (notes) set(['notes', 'note', 'comments'], notes);

  const sheetRow1Based = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Schedule!A${sheetRow1Based}:Z${sheetRow1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [line] },
  });

  const updatedAt = new Date().toISOString();
  await matchRef.set(
    {
      kickoffAt,
      venueName,
      venueAddress,
      updatedAt,
      sheetSyncedAt: updatedAt,
    },
    { merge: true },
  );
  await db.doc(`orgs/${orgId}`).set(
    {
      sheetSyncedAt: updatedAt,
      sheetSyncError: FieldValue.delete(),
      updatedAt,
    },
    { merge: true },
  );

  logger.info('proposalWriteback updated Sheet + match', {
    orgId,
    matchId,
    sheetRowKey,
  });

  return { ok: true, matchId, sheetRowKey, updatedAt };
}
