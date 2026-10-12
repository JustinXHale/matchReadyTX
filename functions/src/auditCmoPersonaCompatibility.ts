/**
 * Read-only production audit for the split Referee and CMO personas.
 *
 * Finds members who have the CMO role without the official role, then reports
 * whether they appear in a fee-crew assignment or a non-CMO match report.
 * This script never writes to Firestore.
 *
 * Usage (from functions/):
 *   npm run audit:cmo-personas
 *   npm run audit:cmo-personas -- --org lonestar --project matchreadytx
 */

import { type DocumentData, type Firestore } from '@google-cloud/firestore';
import { requireCliFirestore } from './cliFirebaseAuth';

const args = process.argv.slice(2);

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const ORG_ID = option('--org') || process.env.DEFAULT_ORG_ID || 'lonestar';
const PROJECT_ID =
  option('--project') ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'matchreadytx';

const FEE_CREW_SLOTS = ['mo', 'ar1', 'ar2', 'no4'] as const;
type FeeCrewSlot = (typeof FEE_CREW_SLOTS)[number];

type Evidence = {
  kind: 'assignment' | 'report';
  matchId: string;
  slot: string;
  detail: string;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function assignmentRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(record);
  const row = record(value);
  return Object.keys(row).length > 0 ? [row] : [];
}

function displayName(data: DocumentData | undefined, uid: string): string {
  if (!data) return uid;
  if (typeof data.displayName === 'string' && data.displayName.trim()) {
    return data.displayName.trim();
  }
  const first = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const last = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  return `${first} ${last}`.trim() || uid;
}

async function loadNames(
  db: Firestore,
  uids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (uids.length === 0) return names;
  const refs = uids.map((uid) => db.collection('users').doc(uid));
  const snapshots = await db.getAll(...refs);
  for (const snapshot of snapshots) {
    names.set(snapshot.id, displayName(snapshot.data(), snapshot.id));
  }
  return names;
}

async function main(): Promise<void> {
  const db = requireCliFirestore(PROJECT_ID);
  const org = db.collection('orgs').doc(ORG_ID);
  const [membersSnapshot, matchesSnapshot, reportsSnapshot] = await Promise.all([
    org.collection('members').get(),
    org.collection('matches').get(),
    org.collection('matchReports').get(),
  ]);

  const cmoOnly = new Set<string>();
  let cmoCount = 0;
  for (const member of membersSnapshot.docs) {
    const roles = stringArray(member.data().roles);
    if (!roles.includes('cmo')) continue;
    cmoCount += 1;
    if (!roles.includes('official')) cmoOnly.add(member.id);
  }

  const evidenceByUid = new Map<string, Evidence[]>();
  const addEvidence = (uid: string, evidence: Evidence) => {
    if (!cmoOnly.has(uid)) return;
    const existing = evidenceByUid.get(uid) ?? [];
    existing.push(evidence);
    evidenceByUid.set(uid, existing);
  };

  for (const match of matchesSnapshot.docs) {
    const data = match.data();
    const crew = record(data.crew);
    const kickoff =
      typeof data.kickoffAt === 'string' ? ` · ${data.kickoffAt}` : '';
    for (const slot of FEE_CREW_SLOTS) {
      for (const row of assignmentRows(crew[slot])) {
        const uid = typeof row.userId === 'string' ? row.userId : '';
        if (!uid) continue;
        const status = typeof row.status === 'string' ? row.status : 'assigned';
        addEvidence(uid, {
          kind: 'assignment',
          matchId: match.id,
          slot,
          detail: `${status}${kickoff}`,
        });
      }
    }
  }

  for (const report of reportsSnapshot.docs) {
    const data = report.data();
    const uid = typeof data.officialId === 'string' ? data.officialId : '';
    const slot = typeof data.slot === 'string' ? data.slot : '';
    if (!uid || slot === 'cmo' || !FEE_CREW_SLOTS.includes(slot as FeeCrewSlot)) {
      continue;
    }
    const matchId = typeof data.matchId === 'string' ? data.matchId : 'unknown';
    const status = typeof data.status === 'string' ? data.status : 'unknown';
    addEvidence(uid, {
      kind: 'report',
      matchId,
      slot,
      detail: `${status} · report ${report.id}`,
    });
  }

  const names = await loadNames(db, [...cmoOnly]);
  const riskyUids = [...cmoOnly].filter(
    (uid) => (evidenceByUid.get(uid)?.length ?? 0) > 0,
  );

  console.log(`CMO persona compatibility audit (read-only)`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Organization: ${ORG_ID}`);
  console.log(`Members scanned: ${membersSnapshot.size}`);
  console.log(`CMO members: ${cmoCount}`);
  console.log(`CMO-only members: ${cmoOnly.size}`);
  console.log(`CMO-only members with referee-role evidence: ${riskyUids.length}`);

  if (riskyUids.length === 0) {
    console.log('\nPASS: No current CMO-only member has a fee-crew assignment or non-CMO report.');
    return;
  }

  console.log('\nREVIEW REQUIRED:');
  for (const uid of riskyUids.sort((a, b) =>
    (names.get(a) ?? a).localeCompare(names.get(b) ?? b),
  )) {
    console.log(`\n${names.get(uid) ?? uid} (${uid})`);
    for (const evidence of evidenceByUid.get(uid) ?? []) {
      console.log(
        `  - ${evidence.kind}: ${evidence.slot.toUpperCase()} · match ${evidence.matchId} · ${evidence.detail}`,
      );
    }
  }

  console.log(
    '\nThese members need the official role or a routing compatibility fix before deployment.',
  );
  process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'CMO persona audit failed.',
  );
  process.exitCode = 1;
});
