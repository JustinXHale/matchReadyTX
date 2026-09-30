/**
 * One-time migration: merge duplicate Lonestar Men/Women team docs that share
 * the same abbreviation (or soft school name) + gender.
 *
 * Gender is resolved from team id suffix → gender field → competition
 * ("women" before "men" so "Lonestar Women" never matches as men).
 *
 * Keeper preference: most match refs → most linked teamAdmins → oldest id.
 * Remaps match home/awayTeamId, member/user teamIds, judicial case teamIds,
 * then deletes loser team docs. Also repairs gender/competition on keepers.
 *
 * Usage:
 *   cd functions && npm run build && node lib/migrateMergeDuplicateTeams.js
 *   cd functions && npm run build && node lib/migrateMergeDuplicateTeams.js --write
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   npm run migrate:merge-duplicate-teams
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

type TeamDoc = {
  id: string;
  name: string;
  competition: string;
  abbreviation: string;
  gender?: string;
  createdAt?: string;
};

function isLonestarTeam(team: TeamDoc): boolean {
  const c = team.competition.trim().toLowerCase();
  if (c.includes('lonestar')) return true;
  return /_lonestar_(men|women)$/i.test(team.id);
}

function genderFromId(id: string): 'men' | 'women' | null {
  if (/_women$/i.test(id) || /_w_lonestar/i.test(id)) return 'women';
  if (/_men$/i.test(id) || /_m_lonestar/i.test(id)) return 'men';
  return null;
}

function genderFromCompetition(comp: string): 'men' | 'women' | null {
  const c = comp.trim().toLowerCase();
  // Check "women" before "men" — "women".includes("men") is true.
  if (/\bwomen\b/.test(c)) return 'women';
  if (/\bmen\b/.test(c)) return 'men';
  return null;
}

function genderFromField(raw?: string): 'men' | 'women' | null {
  const g = (raw ?? '').trim().toLowerCase();
  if (g === 'women' || g === 'w' || g === 'female') return 'women';
  if (g === 'men' || g === 'm' || g === 'male') return 'men';
  return null;
}

/** Prefer id suffix (stable) over mislabeled gender/competition fields. */
function resolveGender(team: TeamDoc): 'men' | 'women' | null {
  return (
    genderFromId(team.id) ??
    genderFromField(team.gender) ??
    genderFromCompetition(team.competition)
  );
}

function expectedCompetition(gender: 'men' | 'women'): string {
  return gender === 'women' ? 'Lonestar Women' : 'Lonestar Men';
}

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip gendered abbr suffixes like UNT(M) / UNT(W). */
function cleanAbbr(abbr: string): string {
  return abbr
    .trim()
    .toUpperCase()
    .replace(/\s*\([MW]\)\s*$/i, '')
    .replace(/[()]/g, '')
    .trim();
}

function softSchoolKey(name: string): string {
  // Keep "state" so Texas State ≠ University of Texas.
  return normKey(name)
    .replace(/\b(the|of|at|university|college)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identityKeys(team: TeamDoc, gender: 'men' | 'women'): string[] {
  const keys: string[] = [];
  const abbr = cleanAbbr(team.abbreviation);
  if (abbr) keys.push(`abbr:${abbr}|${gender}`);
  const soft = softSchoolKey(team.name);
  if (soft) keys.push(`name:${soft}|${gender}`);
  return keys;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const p = this.parent.get(id);
    if (p == null) {
      this.parent.set(id, id);
      return id;
    }
    if (p === id) return id;
    const root = this.find(p);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groups(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = out.get(root) ?? [];
      list.push(id);
      out.set(root, list);
    }
    return out;
  }
}

async function loadTeams(db: Firestore, orgId: string): Promise<TeamDoc[]> {
  const snap = await db.collection(`orgs/${orgId}/teams`).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name ?? '').trim(),
      competition: String(data.competition ?? '').trim(),
      abbreviation: String(data.abbreviation ?? '').trim(),
      gender: typeof data.gender === 'string' ? data.gender.trim() : undefined,
      createdAt:
        typeof data.createdAt === 'string' ? data.createdAt : undefined,
    };
  });
}

async function matchRefCounts(
  db: Firestore,
  orgId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const snap = await db.collection(`orgs/${orgId}/matches`).get();
  for (const doc of snap.docs) {
    const data = doc.data();
    for (const key of ['homeTeamId', 'awayTeamId'] as const) {
      const id = String(data[key] ?? '').trim();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

async function adminCounts(
  db: Firestore,
  orgId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const snap = await db.collection(`orgs/${orgId}/members`).get();
  for (const doc of snap.docs) {
    const roles = doc.data().roles;
    const teamIds = doc.data().teamIds;
    if (!Array.isArray(roles) || !Array.isArray(teamIds)) continue;
    if (!roles.map(String).includes('teamAdmin')) continue;
    for (const raw of teamIds) {
      const id = String(raw ?? '').trim();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function pickKeeper(
  group: TeamDoc[],
  matchCounts: Map<string, number>,
  adminLinkCounts: Map<string, number>,
): TeamDoc {
  return [...group].sort((a, b) => {
    const mc = (matchCounts.get(b.id) ?? 0) - (matchCounts.get(a.id) ?? 0);
    if (mc !== 0) return mc;
    const ac =
      (adminLinkCounts.get(b.id) ?? 0) - (adminLinkCounts.get(a.id) ?? 0);
    if (ac !== 0) return ac;
    // Prefer canonical abbr+competition ids over slug / gendered-abbr variants.
    const score = (t: TeamDoc) => {
      let s = 0;
      if (/^t_[a-z0-9]+_lonestar_(men|women)$/i.test(t.id)) s += 2;
      if (t.abbreviation && !/\([MW]\)/i.test(t.abbreviation)) s += 1;
      return s;
    };
    const sc = score(b) - score(a);
    if (sc !== 0) return sc;
    return a.id.localeCompare(b.id);
  })[0]!;
}

async function main(): Promise<void> {
  const db = requireCliFirestore(PROJECT_ID);
  console.log(`Org ${ORG_ID} · ${WRITE ? 'WRITE' : 'DRY-RUN'}`);

  const teams = await loadTeams(db, ORG_ID);
  const matchCounts = await matchRefCounts(db, ORG_ID);
  const adminLinkCounts = await adminCounts(db, ORG_ID);
  const byId = new Map(teams.map((t) => [t.id, t]));

  const uf = new UnionFind();
  const keyOwner = new Map<string, string>();

  for (const t of teams) {
    if (!isLonestarTeam(t)) continue;
    const gender = resolveGender(t);
    if (!gender) continue;
    uf.add(t.id);
    for (const key of identityKeys(t, gender)) {
      const existing = keyOwner.get(key);
      if (existing) uf.union(existing, t.id);
      else keyOwner.set(key, t.id);
    }
  }

  const remaps: { from: string; to: string; key: string }[] = [];
  for (const [, ids] of uf.groups()) {
    if (ids.length < 2) continue;
    const group = ids.map((id) => byId.get(id)!).filter(Boolean);
    if (group.length < 2) continue;
    const gender = resolveGender(group[0]!)!;
    const keeper = pickKeeper(group, matchCounts, adminLinkCounts);
    const keyLabel = `lonestar_${gender}`;
    for (const loser of group) {
      if (loser.id === keeper.id) continue;
      remaps.push({ from: loser.id, to: keeper.id, key: keyLabel });
      console.log(
        `  ${loser.id} (${loser.name} / ${loser.abbreviation || '—'}) → ${keeper.id} (${keeper.name} / ${keeper.abbreviation || '—'}) [${keyLabel}] matches=${matchCounts.get(loser.id) ?? 0}`,
      );
    }
  }

  const metaFixes: { id: string; gender: 'men' | 'women'; competition: string }[] =
    [];
  for (const t of teams) {
    if (!isLonestarTeam(t)) continue;
    if (remaps.some((r) => r.from === t.id)) continue;
    const gender = resolveGender(t);
    if (!gender) continue;
    const wantComp = expectedCompetition(gender);
    const genderOk = genderFromField(t.gender) === gender;
    const compOk = t.competition.trim() === wantComp;
    if (genderOk && compOk) continue;
    metaFixes.push({ id: t.id, gender, competition: wantComp });
    console.log(
      `  meta ${t.id}: gender=${t.gender ?? '—'}→${gender} competition=${t.competition || '—'}→${wantComp}`,
    );
  }

  if (remaps.length === 0 && metaFixes.length === 0) {
    console.log('No Lonestar duplicate teams or metadata fixes found.');
    return;
  }

  console.log(
    `\n${remaps.length} team id remap(s), ${metaFixes.length} metadata fix(es).`,
  );
  if (!WRITE) {
    console.log('Dry-run only. Re-run with --write to apply.');
    return;
  }

  const remapMap = new Map(remaps.map((r) => [r.from, r.to]));
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  const matches = await db.collection(`orgs/${ORG_ID}/matches`).get();
  for (const doc of matches.docs) {
    const data = doc.data();
    const home = String(data.homeTeamId ?? '').trim();
    const away = String(data.awayTeamId ?? '').trim();
    const newHome = remapMap.get(home) ?? home;
    const newAway = remapMap.get(away) ?? away;
    if (newHome === home && newAway === away) continue;
    batch.update(doc.ref, {
      homeTeamId: newHome,
      awayTeamId: newAway,
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    if (ops >= 400) await flush();
  }

  const members = await db.collection(`orgs/${ORG_ID}/members`).get();
  for (const doc of members.docs) {
    const raw = doc.data().teamIds;
    if (!Array.isArray(raw)) continue;
    const teamIds = raw.map(String);
    const next = [
      ...new Set(teamIds.map((id) => remapMap.get(id) ?? id).filter(Boolean)),
    ];
    if (next.join('|') === teamIds.join('|')) continue;
    batch.update(doc.ref, {
      teamIds: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    batch.set(
      db.doc(`users/${doc.id}`),
      { teamIds: next, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    ops += 1;
    if (ops >= 400) await flush();
  }

  const cases = await db.collection(`orgs/${ORG_ID}/judicialCases`).get();
  for (const doc of cases.docs) {
    const teamId = String(doc.data().teamId ?? '').trim();
    const next = remapMap.get(teamId);
    if (!next || next === teamId) continue;
    const keeper = teams.find((t) => t.id === next);
    batch.update(doc.ref, {
      teamId: next,
      ...(keeper?.name ? { teamName: keeper.name } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    if (ops >= 400) await flush();
  }

  for (const fix of metaFixes) {
    batch.update(db.doc(`orgs/${ORG_ID}/teams/${fix.id}`), {
      gender: fix.gender,
      competition: fix.competition,
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    if (ops >= 400) await flush();
  }

  // Keepers that absorb a loser should also have correct gender/competition.
  for (const { to } of remaps) {
    const keeper = byId.get(to);
    if (!keeper) continue;
    const gender = resolveGender(keeper);
    if (!gender) continue;
    batch.update(db.doc(`orgs/${ORG_ID}/teams/${to}`), {
      gender,
      competition: expectedCompetition(gender),
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    if (ops >= 400) await flush();
  }

  for (const { from } of remaps) {
    batch.delete(db.doc(`orgs/${ORG_ID}/teams/${from}`));
    ops += 1;
    if (ops >= 400) await flush();
  }
  await flush();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
