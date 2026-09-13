/**
 * Repair missing event scores from existing submitted MO reports.
 * Requires GOOGLE_APPLICATION_CREDENTIALS; dry-run by default.
 * node functions/lib/backfillMatchReportScores.js --match APP-... [--write]
 * Omit --match to check all matches in --org (default lonestar).
 */
import { requireCliFirestore } from './cliFirebaseAuth';
import { syncMatchReportScore } from './matchReportScores';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    const value = args[index + 1];
    if (!value || value.startsWith('--') || value.includes('/')) {
      throw new Error(`Invalid ${name}`);
    }
    return value;
  };
  const orgId = option('--org', 'lonestar');
  const matchId = option('--match', '');
  const write = args.includes('--write');
  const db = requireCliFirestore(process.env.GCLOUD_PROJECT || 'matchreadytx');
  const ids = matchId ? [matchId] : (
    await db.collection('orgs').doc(orgId).collection('matches').get()
  ).docs.map((doc) => doc.id);
  let count = 0;
  for (const id of ids) {
    const score = await syncMatchReportScore(db, orgId, id, { write, onlyMissing: true });
    if (!score) continue;
    count++;
    console.log(`${write ? 'Updated' : 'Would update'} ${id}: ${score.homeScore}–${score.awayScore}`);
  }
  console.log(`${count} ${write ? 'updated' : 'proposed updates'} (${ids.length} matches checked).`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
