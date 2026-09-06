/**
 * One-time migration:
 * 1. Set isTournament on legacy tournament-style matches (level Tourney/7s/etc.).
 * 2. Rekey host coach feedback to crew-scoped docs grouped by match title.
 *
 * Usage (from repo root):
 *   cd functions && npm run build && node lib/migrateTournamentCoachFeedback.js
 *   cd functions && npm run build && node lib/migrateTournamentCoachFeedback.js --write
 *
 * Options:
 *   --write     Apply changes (default is dry-run)
 *   --org ID    Org id (default: lonestar or DEFAULT_ORG_ID env)
 *
 * Auth — service account required (Admin SDK bypasses security rules):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   npm run migrate:tournament-feedback
 *
 * `firebase login` is for deploy/CLI only; it cannot run this migration.
 */

import { FieldValue, type Firestore } from '@google-cloud/firestore';
import { requireCliFirestore } from './cliFirebaseAuth';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const orgIdx = args.indexOf('--org');
const ORG_ID =
  (orgIdx >= 0 ? args[orgIdx + 1] : undefined) ||
  process.env.DEFAULT_ORG_ID ||
  'lonestar';
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'matchreadytx';

let db: Firestore;

type MatchRow = {
  id: string;
  title?: string;
  level?: string;
  isTournament?: boolean;
  homeTeamId?: string;
};

type FeedbackRow = {
  id: string;
  matchId: string;
  reportingTeamId: string;
  feedbackScope?: string;
  status?: string;
  updatedAt?: string;
  submittedAt?: string;
  data: Record<string, unknown>;
};

function legacyTournamentMatch(match: MatchRow): boolean {
  if (match.isTournament === true) return true;
  const level = (match.level ?? '').trim().toLowerCase();
  return (
    level === 'tourney' ||
    level === '7s' ||
    level.includes('tournament') ||
    level.includes('tourney')
  );
}

function tournamentGroupKey(match: MatchRow): string {
  const title = match.title?.trim();
  if (!title) return match.id;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return slug || match.id;
}

function crewDocId(match: MatchRow, reportingTeamId: string): string {
  return `${tournamentGroupKey(match)}_${reportingTeamId}`;
}

function statusRank(status: string | undefined): number {
  if (status === 'submitted') return 3;
  if (status === 'draft') return 2;
  if (status === 'declined') return 1;
  return 0;
}

function pickBestFeedback(rows: FeedbackRow[]): FeedbackRow {
  return [...rows].sort((a, b) => {
    const rank = statusRank(b.status) - statusRank(a.status);
    if (rank !== 0) return rank;
    const bTime = new Date(b.updatedAt ?? b.submittedAt ?? 0).getTime();
    const aTime = new Date(a.updatedAt ?? a.submittedAt ?? 0).getTime();
    return bTime - aTime;
  })[0]!;
}

async function loadMatches(orgId: string): Promise<Map<string, MatchRow>> {
  const snap = await db.collection('orgs').doc(orgId).collection('matches').get();
  const map = new Map<string, MatchRow>();
  for (const doc of snap.docs) {
    const d = doc.data();
    map.set(doc.id, {
      id: doc.id,
      title: typeof d.title === 'string' ? d.title : undefined,
      level: typeof d.level === 'string' ? d.level : undefined,
      isTournament: d.isTournament === true,
      homeTeamId: typeof d.homeTeamId === 'string' ? d.homeTeamId : undefined,
    });
  }
  return map;
}

async function loadCoachFeedback(orgId: string): Promise<FeedbackRow[]> {
  const snap = await db
    .collection('orgs')
    .doc(orgId)
    .collection('coachFeedback')
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      matchId: String(d.matchId ?? ''),
      reportingTeamId: String(d.reportingTeamId ?? ''),
      feedbackScope:
        typeof d.feedbackScope === 'string' ? d.feedbackScope : undefined,
      status: typeof d.status === 'string' ? d.status : undefined,
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
      submittedAt: typeof d.submittedAt === 'string' ? d.submittedAt : undefined,
      data: d,
    };
  });
}

async function main(): Promise<void> {
  console.log(`Org: ${ORG_ID}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(WRITE ? 'MODE: WRITE' : 'MODE: dry-run (pass --write to apply)');

  db = requireCliFirestore(PROJECT_ID);

  const matches = await loadMatches(ORG_ID);
  const feedback = await loadCoachFeedback(ORG_ID);

  const matchTournamentUpdates: string[] = [];
  for (const match of matches.values()) {
    if (legacyTournamentMatch(match) && !match.isTournament) {
      matchTournamentUpdates.push(match.id);
    }
  }

  const tournamentMatches = new Map<string, MatchRow>();
  for (const match of matches.values()) {
    const flagged =
      match.isTournament === true || matchTournamentUpdates.includes(match.id);
    if (flagged) tournamentMatches.set(match.id, { ...match, isTournament: true });
  }

  const crewDocs = new Map<string, FeedbackRow>();
  for (const row of feedback) {
    if (row.feedbackScope === 'crew') {
      crewDocs.set(row.id, row);
    }
  }

  type GroupKey = string;
  const groups = new Map<GroupKey, FeedbackRow[]>();

  for (const row of feedback) {
    if (row.feedbackScope === 'crew') continue;
    const match = matches.get(row.matchId);
    if (!match || !legacyTournamentMatch(match)) continue;
    if (!match.homeTeamId || row.reportingTeamId !== match.homeTeamId) continue;

    const tournamentMatch: MatchRow = {
      ...match,
      isTournament: true,
    };
    const key = crewDocId(tournamentMatch, row.reportingTeamId);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const migrations: {
    newId: string;
    source: FeedbackRow;
    deleteIds: string[];
    tournamentTitle: string;
    tournamentGroupKey: string;
  }[] = [];

  for (const [newId, rows] of groups) {
    if (crewDocs.has(newId)) {
      console.log(`  skip ${newId} — crew doc already exists`);
      continue;
    }
    const source = pickBestFeedback(rows);
    const match = tournamentMatches.get(source.matchId) ?? matches.get(source.matchId);
    if (!match) continue;
    const tMatch = { ...match, isTournament: true };
    const groupKey = tournamentGroupKey(tMatch);
    const deleteIds = [
      ...new Set(
        rows.map((r) => r.id).filter((id) => id !== newId),
      ),
    ];
    if (source.feedbackScope === 'crew' && source.id === newId) continue;

    migrations.push({
      newId,
      source,
      deleteIds,
      tournamentTitle: tMatch.title?.trim() || 'Tournament',
      tournamentGroupKey: groupKey,
    });
  }

  console.log('\nMatches to flag isTournament:', matchTournamentUpdates.length);
  for (const id of matchTournamentUpdates.slice(0, 20)) {
    const m = matches.get(id);
    console.log(`  ${id} level=${m?.level ?? '?'} title=${m?.title ?? '(none)'}`);
  }
  if (matchTournamentUpdates.length > 20) {
    console.log(`  … and ${matchTournamentUpdates.length - 20} more`);
  }

  console.log('\nCoach feedback groups to migrate:', migrations.length);
  for (const m of migrations.slice(0, 30)) {
    console.log(
      `  ${m.source.id} → ${m.newId} (${m.source.status}, delete ${m.deleteIds.length} dupes)`,
    );
  }
  if (migrations.length > 30) {
    console.log(`  … and ${migrations.length - 30} more`);
  }

  if (!WRITE) {
    console.log('\nDry-run complete. Re-run with --write to apply.');
    return;
  }

  let batch = db.batch();
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  const bump = async () => {
    ops += 1;
    if (ops >= 450) await commit();
  };

  const now = new Date().toISOString();

  for (const matchId of matchTournamentUpdates) {
    const ref = db.collection('orgs').doc(ORG_ID).collection('matches').doc(matchId);
    batch.set(ref, { isTournament: true, updatedAt: now }, { merge: true });
    await bump();
  }

  for (const m of migrations) {
    const src = m.source.data;
    const sameDoc = m.source.id === m.newId;
    const {
      officialUserId: _omitUid,
      officialName: _omitName,
      ...srcRest
    } = src;
    const payload: Record<string, unknown> = {
      ...srcRest,
      id: m.newId,
      orgId: ORG_ID,
      feedbackScope: 'crew',
      slot: 'crew',
      tournamentGroupKey: m.tournamentGroupKey,
      tournamentTitle: m.tournamentTitle,
      publicOnProfile: false,
      updatedAt: now,
    };
    if (sameDoc) {
      payload.officialUserId = FieldValue.delete();
      payload.officialName = FieldValue.delete();
    }

    const newRef = db
      .collection('orgs')
      .doc(ORG_ID)
      .collection('coachFeedback')
      .doc(m.newId);
    batch.set(newRef, payload, { merge: sameDoc });
    await bump();

    for (const oldId of m.deleteIds) {
      if (oldId === m.newId) continue;
      const oldRef = db
        .collection('orgs')
        .doc(ORG_ID)
        .collection('coachFeedback')
        .doc(oldId);
      batch.delete(oldRef);
      await bump();
    }
  }

  await commit();
  console.log('\nMigration applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
