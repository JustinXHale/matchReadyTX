// Run with: firebase emulators:exec --only firestore --project demo-card-reports \
//   'node scripts/test-card-report-rules.mjs'
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs,
  collection, query, where, writeBatch, terminate,
} from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
assert(host, 'FIRESTORE_EMULATOR_HOST is required; this test only runs against an emulator.');
const projectId = 'demo-card-reports';
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const apps = [];
const clients = [];

async function seed(path, fields) {
  const response = await fetch(`${base}/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  assert(response.ok, await response.text());
}
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo' }, uid);
  apps.push(app);
  const db = getFirestore(app);
  const [hostname, port] = host.split(':');
  connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid } });
  clients.push(db);
  return db;
}
const root = 'orgs/lonestar';
const report = { id: 'report-1', orgId: 'lonestar', officialId: 'mo',
  matchId: 'match-1', status: 'submitted', cards: [{ id: 'incident-1', color: 'red' }] };
const incident = { id: 'case-1', orgId: 'lonestar', reportId: report.id,
  incidentId: 'incident-1', matchId: 'match-1', status: 'pending' };

try {
  for (const [uid, role] of [['mo', 'official'], ['judge', 'judicial'], ['other', 'official']]) {
    await seed(`users/${uid}`, { profileComplete: { booleanValue: true } });
    await seed(`${root}/members/${uid}`, { roles: { arrayValue: { values: [{ stringValue: role }] } } });
  }
  const mo = client('mo');
  const judge = client('judge');
  const other = client('other');
  const batch = writeBatch(mo);
  batch.set(doc(mo, `${root}/cardReports/${report.id}`), report);
  batch.set(doc(mo, `${root}/judicialCases/${incident.id}`), incident);
  await batch.commit();
  assert.equal((await getDocs(query(collection(mo, `${root}/cardReports`), where('officialId', '==', 'mo')))).size, 1);
  assert.equal((await getDocs(collection(judge, `${root}/judicialCases`))).size, 1);
  assert.equal((await getDocs(collection(judge, `${root}/cardReports`))).size, 1);
  await assert.rejects(getDoc(doc(other, `${root}/cardReports/${report.id}`)), { code: 'permission-denied' });
  // A denied case must also prevent the associated report from being saved.
  const rejected = writeBatch(mo);
  rejected.set(doc(mo, `${root}/cardReports/report-2`), { ...report, id: 'report-2' });
  rejected.set(doc(mo, `${root}/judicialCases/case-2`), { ...incident, id: 'case-2', reportId: 'report-2', status: 'upheld' });
  await assert.rejects(rejected.commit(), { code: 'permission-denied' });
  assert.equal((await getDoc(doc(mo, `${root}/cardReports/report-2`))).exists(), false);
  console.log('PASS: MO submission, MO list, judicial report/case lists, access control, and atomic failure.');
} finally {
  await Promise.all(clients.map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
}
