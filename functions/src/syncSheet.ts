import { google } from 'googleapis';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import {
  buildCrewFieldsForLevel,
  hasStockCrewInFirestore,
  mergeMatchLevels,
  type DefaultCrewByLevel,
} from './crewDefaults';
import {
  competitionForGender,
  contactMatchKeys,
  genderFromCompetitionName,
  lookupLocation,
  normalizeGender,
  parseContactRows,
  parseLocationRows,
  parseScheduleRows,
  rowToKickoffIso,
  sanitizeMatchId,
  slugTeamId,
  teamIdFromAbbrevAndCompetition,
  type ContactRow,
  type LocationRow,
} from './sheetParse';

export type SyncSheetResult = {
  ok: true;
  orgId: string;
  sheetId: string;
  matched: number;
  upserted: number;
  cancelled: number;
  removed: number;
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

async function readFirstTab(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  tabNames: string[],
): Promise<string[][]> {
  for (const tabName of tabNames) {
    const values = await readTab(sheets, spreadsheetId, tabName);
    if (values.length > 0) return values;
  }
  return [];
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

type TeamShape = {
  id: string;
  name: string;
  competition?: string;
  abbreviation?: string;
  gender?: 'men' | 'women';
  address?: string;
  contactEmails: Set<string>;
  contactPhones: Set<string>;
  contactPeople: Map<string, { name?: string; phone?: string }>;
};

function attachContact(team: TeamShape, c: ContactRow) {
  team.contactEmails.add(c.email);
  if (c.phone) team.contactPhones.add(c.phone);
  const prev = team.contactPeople.get(c.email);
  team.contactPeople.set(c.email, {
    name: c.name?.trim() || prev?.name,
    phone: c.phone || prev?.phone,
  });
}

function addContactIndexKey(
  index: Map<string, string[]>,
  raw: string | undefined,
  id: string,
) {
  for (const key of contactMatchKeys(raw ?? '')) {
    const list = index.get(key) ?? [];
    if (!list.includes(id)) list.push(id);
    index.set(key, list);
  }
}

function buildContactTeamIndex(
  teamsById: Map<string, TeamShape>,
  locations: LocationRow[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const team of teamsById.values()) {
    addContactIndexKey(index, team.name, team.id);
    addContactIndexKey(index, team.abbreviation, team.id);
  }
  for (const loc of locations) {
    const locAbbr = (loc.abbreviation ?? '').trim().toUpperCase();
    const locComp = (loc.competition ?? '').trim().toLowerCase();
    for (const team of teamsById.values()) {
      const teamAbbr = (team.abbreviation ?? '').trim().toUpperCase();
      const teamComp = (team.competition ?? '').trim().toLowerCase();
      const abbrMatch = Boolean(locAbbr && teamAbbr && locAbbr === teamAbbr);
      const sameComp =
        !locComp || !teamComp || locComp === teamComp;
      if (abbrMatch && sameComp) {
        addContactIndexKey(index, loc.teamName, team.id);
        addContactIndexKey(index, loc.abbreviation, team.id);
      }
    }
  }
  return index;
}

function teamIdsForContact(
  index: Map<string, string[]>,
  teamsById: Map<string, TeamShape>,
  contact: ContactRow,
): string[] {
  const ids = new Set<string>();
  for (const key of contactMatchKeys(contact.team_name)) {
    for (const id of index.get(key) ?? []) ids.add(id);
  }
  let list = [...ids];
  const conf = (contact.conference ?? '').trim().toLowerCase();
  if (list.length > 1 && conf) {
    const narrowed = list.filter((id) => {
      const t = teamsById.get(id);
      return (t?.competition ?? '').trim().toLowerCase() === conf;
    });
    if (narrowed.length) list = narrowed;
  }
  return list;
}

function rosterTeamKey(abbreviation: string, competition: string): string {
  return `${abbreviation.trim().toUpperCase()}|${competition.trim().toLowerCase()}`;
}

/** Map legacy team doc ids to Locations-sync ids (abbreviation + competition). */
function buildTeamIdRemap(
  existingTeamDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  teamsById: Map<string, TeamShape>,
): Map<string, string> {
  const newIdByKey = new Map<string, string>();
  for (const [id, team] of teamsById) {
    const abbr = (team.abbreviation ?? '').trim().toUpperCase();
    const comp = (team.competition ?? '').trim();
    if (abbr && comp) newIdByKey.set(rosterTeamKey(abbr, comp), id);
  }
  const remap = new Map<string, string>();
  for (const doc of existingTeamDocs) {
    const data = doc.data();
    if (!data) continue;
    const oldId = doc.id;
    if (teamsById.has(oldId)) {
      remap.set(oldId, oldId);
      continue;
    }
    const abbr = String(data.abbreviation ?? data.name ?? '')
      .trim()
      .toUpperCase();
    const comp = String(data.competition ?? '').trim();
    if (!abbr || !comp) continue;
    const newId = newIdByKey.get(rosterTeamKey(abbr, comp));
    if (newId) remap.set(oldId, newId);
  }
  return remap;
}

function genderForRow(row: { competition?: string; gender?: string }): 'men' | 'women' {
  if (row.gender?.trim()) return normalizeGender(row.gender);
  return genderFromCompetitionName(row.competition) ?? 'men';
}

function normNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function resolvedCompetition(row: {
  competition?: string;
  gender?: string;
}): string {
  return row.competition?.trim() || competitionForGender(genderForRow(row));
}

function buildTeamIdResolver(rows: ReturnType<typeof parseScheduleRows>) {
  const compsByName = new Map<string, Set<string>>();
  for (const row of rows) {
    const comp = resolvedCompetition(row);
    for (const name of [row.home_team, row.away_team]) {
      const key = normNameKey(name);
      if (!key) continue;
      const set = compsByName.get(key) ?? new Set<string>();
      set.add(comp);
      compsByName.set(key, set);
    }
  }

  const splitNames = new Set<string>();
  for (const [nameKey, comps] of compsByName) {
    if (comps.size > 1) splitNames.add(nameKey);
  }

  return (teamName: string, row: { competition?: string; gender?: string }) => {
    const key = normNameKey(teamName);
    if (!key) return slugTeamId('unknown');
    if (splitNames.has(key)) {
      const comp = resolvedCompetition(row);
      return teamIdFromAbbrevAndCompetition(teamName, comp);
    }
    return slugTeamId(teamName);
  };
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

  const scheduleValues = await readFirstTab(sheets, sheetId, [
    'Schedule',
    'schedule',
  ]);
  if (!scheduleValues.length) {
    throw new Error(
      'No Schedule tab (or empty). Add a tab named “Schedule” with the required columns.',
    );
  }

  const rows = parseScheduleRows(scheduleValues);
  const contacts = parseContactRows(
    await readFirstTab(sheets, sheetId, [
      'Contacts',
      'contacts',
      'teamContacts',
      'TeamContacts',
    ]),
  );
  const locations = parseLocationRows(
    await readFirstTab(sheets, sheetId, ['Locations', 'locations']),
  );
  const resolveTeamId = buildTeamIdResolver(rows);

  const orgSnap = await db.doc(`orgs/${orgId}`).get();
  const orgData = orgSnap.data() ?? {};
  const defaultCrewByLevel = (orgData.defaultCrewByLevel ??
    undefined) as DefaultCrewByLevel | undefined;
  const existingMatchLevels = Array.isArray(orgData.matchLevels)
    ? (orgData.matchLevels as string[])
    : [];
  const sheetLevels = rows
    .map((r) => (r.level ?? '').trim())
    .filter(Boolean);
  const mergedMatchLevels = mergeMatchLevels(existingMatchLevels, sheetLevels);

  const teamsById = new Map<string, TeamShape>();
  const getOrCreateTeam = (
    id: string,
    name: string,
    competition?: string,
    extra?: { abbreviation?: string; gender?: 'men' | 'women' },
  ) => {
    const existing = teamsById.get(id);
    if (existing) {
      if (!existing.abbreviation && extra?.abbreviation) {
        existing.abbreviation = extra.abbreviation;
      }
      if (!existing.gender && extra?.gender) existing.gender = extra.gender;
      return existing;
    }
    const next: TeamShape = {
      id,
      name,
      competition,
      abbreviation: extra?.abbreviation,
      gender: extra?.gender,
      contactEmails: new Set<string>(),
      contactPhones: new Set<string>(),
      contactPeople: new Map(),
    };
    teamsById.set(id, next);
    return next;
  };

  for (const loc of locations) {
    const abbr = (loc.abbreviation ?? '').trim().toUpperCase();
    if (!abbr) continue;
    const gender = loc.gender?.trim()
      ? normalizeGender(loc.gender)
      : genderFromCompetitionName(loc.competition) ?? 'men';
    const competition =
      loc.competition?.trim() || competitionForGender(gender);
    const id = teamIdFromAbbrevAndCompetition(abbr, competition);
    const team = getOrCreateTeam(
      id,
      loc.teamName?.trim() || abbr,
      competition,
      { abbreviation: abbr, gender },
    );
    if (loc.address) team.address = loc.address;
  }

  for (const row of rows) {
    const comp = resolvedCompetition(row);
    const gender = genderForRow(row);
    for (const teamName of [row.home_team, row.away_team]) {
      const id = resolveTeamId(teamName, row);
      getOrCreateTeam(id, teamName, comp, {
        abbreviation: teamName.trim().toUpperCase(),
        gender,
      });
    }
  }
  for (const team of teamsById.values()) {
    const loc = lookupLocation(
      locations,
      team.abbreviation || team.name,
      team.gender ?? 'men',
      team.competition,
    );
    if (loc?.teamName) team.name = loc.teamName;
    if (loc?.address) team.address = loc.address;
    if (loc?.competition) team.competition = loc.competition;
    if (!team.gender && loc) {
      const fromLoc =
        loc.gender?.trim()
          ? normalizeGender(loc.gender)
          : genderFromCompetitionName(loc.competition);
      if (fromLoc) team.gender = fromLoc;
    }
    if (!team.abbreviation && loc?.abbreviation) {
      team.abbreviation = loc.abbreviation;
    }
  }

  const contactIndex = buildContactTeamIndex(teamsById, locations);
  for (const c of contacts) {
    const ids = teamIdsForContact(contactIndex, teamsById, c);
    if (ids.length === 1) {
      const team = teamsById.get(ids[0]!);
      if (team) attachContact(team, c);
      continue;
    }
    if (ids.length === 0) {
      const id = slugTeamId(
        c.conference ? `${c.team_name} ${c.conference}` : c.team_name,
      );
      const team = getOrCreateTeam(id, c.team_name, c.conference);
      attachContact(team, c);
      addContactIndexKey(contactIndex, c.team_name, team.id);
      continue;
    }
    logger.warn('Skipped ambiguous contact team link', {
      orgId,
      teamName: c.team_name,
      conference: c.conference,
      candidateIds: ids,
    });
  }

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
  for (const team of teamsById.values()) {
    const emails = [...team.contactEmails];
    const phones = [...team.contactPhones];
    const people = [...team.contactPeople.entries()].map(([email, p]) => ({
      email,
      ...(p.name ? { name: p.name } : {}),
      ...(p.phone ? { phone: p.phone } : {}),
    }));
    setDoc(db.doc(`orgs/${orgId}/teams/${team.id}`), {
      id: team.id,
      name: team.name,
      competition: team.competition ?? null,
      ...(team.abbreviation ? { abbreviation: team.abbreviation } : {}),
      ...(team.gender ? { gender: team.gender } : {}),
      ...(team.address ? { address: team.address } : {}),
      contactEmails: emails,
      ...(phones.length ? { contactPhones: phones } : {}),
      contactPeople: people,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (batchOps >= 400) await flushBatch();
  }

  let upserted = 0;
  let cancelled = 0;
  let removed = 0;

  const syncedIds = new Set<string>();
  const syncedKeys = new Set<string>();
  for (const row of rows) {
    syncedIds.add(sanitizeMatchId(row.match_id));
    syncedKeys.add(row.match_id.trim());
  }

  for (const row of rows) {
    const matchId = sanitizeMatchId(row.match_id);
    const ref = db.doc(`orgs/${orgId}/matches/${matchId}`);
    const snap = await ref.get();
    const existing = snap.data();

    const gender = genderForRow(row);
    const competition = resolvedCompetition(row);
    const loc = lookupLocation(locations, row.location, gender, competition);
    const venueName = loc?.venue_name || row.location || 'TBD';
    const venueAddress = loc?.address || row.location || '';
    const kickoffAt = rowToKickoffIso(row);
    const homeTeamId = resolveTeamId(row.home_team, row);
    const awayTeamId = resolveTeamId(row.away_team, row);
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
    const sheetTitle = (row.title ?? '').trim();

    if (!snap.exists) {
      const status = sheetCancelled ? 'cancelled' : 'draft';
      const crewFields = buildCrewFieldsForLevel(level, defaultCrewByLevel);
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
          ...(sheetTitle ? { title: sheetTitle } : {}),
          flightProvided: false,
          housingProvided: false,
          ...crewFields,
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
        title: sheetTitle ? sheetTitle : FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (loc?.lat != null) patch.venueLat = loc.lat;
      if (loc?.lng != null) patch.venueLng = loc.lng;

      if (
        existing?.status === 'draft' &&
        !sheetCancelled &&
        (hasStockCrewInFirestore(existing) || String(existing.level ?? '') !== level)
      ) {
        const crewFields = buildCrewFieldsForLevel(level, defaultCrewByLevel);
        patch.crew = crewFields.crew;
        patch.rolesNeeded = crewFields.rolesNeeded;
        if (crewFields.cmo) patch.cmo = crewFields.cmo;
        else patch.cmo = FieldValue.delete();
      }

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

  const existingMatches = await db.collection(`orgs/${orgId}/matches`).get();
  for (const docSnap of existingMatches.docs) {
    const data = docSnap.data();
    const sheetRowKey = String(data.sheetRowKey ?? '').trim();
    const tracked = sheetRowKey.length > 0 || syncedIds.has(docSnap.id);
    if (!tracked) continue;
    const inSheet =
      syncedIds.has(docSnap.id) ||
      (sheetRowKey.length > 0 && syncedKeys.has(sheetRowKey));
    if (inSheet) continue;

    const proposals = await docSnap.ref.collection('proposals').get();
    for (const p of proposals.docs) {
      batch.delete(p.ref);
      batchOps += 1;
      if (batchOps >= 400) await flushBatch();
    }
    batch.delete(docSnap.ref);
    batchOps += 1;
    removed += 1;
    if (batchOps >= 400) await flushBatch();
  }

  const sheetSyncedAt = new Date().toISOString();
  setDoc(db.doc(`orgs/${orgId}`), {
    sheetId,
    sheetSyncedAt,
    sheetSyncError: FieldValue.delete(),
    ...(mergedMatchLevels.length > 0 ? { matchLevels: mergedMatchLevels } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await flushBatch();

  const remainingMatches = await db.collection(`orgs/${orgId}/matches`).get();
  const keepTeamIds = new Set(teamsById.keys());
  for (const docSnap of remainingMatches.docs) {
    const data = docSnap.data();
    const home = String(data.homeTeamId ?? '').trim();
    const away = String(data.awayTeamId ?? '').trim();
    if (home) keepTeamIds.add(home);
    if (away) keepTeamIds.add(away);
  }
  const existingTeams = await db.collection(`orgs/${orgId}/teams`).get();
  const teamIdRemap = buildTeamIdRemap(existingTeams.docs, teamsById);
  if (teamIdRemap.size > 0) {
    const membersSnap = await db.collection(`orgs/${orgId}/members`).get();
    for (const doc of membersSnap.docs) {
      const raw = doc.data().teamIds;
      if (!Array.isArray(raw)) continue;
      const teamIds = raw.map(String);
      const next = [
        ...new Set(teamIds.map((id) => teamIdRemap.get(id) ?? id).filter(Boolean)),
      ];
      if (next.join('|') === teamIds.join('|')) continue;
      batch.update(doc.ref, {
        teamIds: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchOps += 1;
      batch.set(
        db.doc(`users/${doc.id}`),
        { teamIds: next, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      batchOps += 1;
      if (batchOps >= 400) await flushBatch();
    }
  }
  let teamsRemoved = 0;
  for (const docSnap of existingTeams.docs) {
    if (keepTeamIds.has(docSnap.id)) continue;
    batch.delete(docSnap.ref);
    batchOps += 1;
    teamsRemoved += 1;
    if (batchOps >= 400) await flushBatch();
  }
  await flushBatch();

  logger.info('Sheet sync complete', {
    orgId,
    sheetId,
    matched: rows.length,
    upserted,
    cancelled,
    removed,
    teams: teamsById.size,
    teamsRemoved,
  });

  return {
    ok: true,
    orgId,
    sheetId,
    matched: rows.length,
    upserted,
    cancelled,
    removed,
    teams: teamsById.size,
    sheetSyncedAt,
  };
}
