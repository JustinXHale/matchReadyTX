import type { Firestore } from 'firebase-admin/firestore';

type Row = Record<string, unknown>;

/** Tournament reports describe the event, not a single game's final score. */
export function submittedMatchScore(report: Row): {
  homeScore: number;
  awayScore: number;
} | undefined {
  if (report.slot !== 'mo' || report.status !== 'submitted') return undefined;
  const payload = report.moPayload as Row | undefined;
  if (!payload || payload.tournamentMatch) return undefined;
  const homeScore = payload.homePoints;
  const awayScore = payload.awayPoints;
  if (
    typeof homeScore !== 'number' || !Number.isFinite(homeScore) || homeScore < 0 ||
    typeof awayScore !== 'number' || !Number.isFinite(awayScore) || awayScore < 0
  ) return undefined;
  return { homeScore, awayScore };
}

/** Shared by the write trigger and the dry-run/backfill CLI. */
export async function syncMatchReportScore(
  db: Firestore,
  orgId: string,
  matchId: string,
  { write = true, onlyMissing = false } = {},
): Promise<{ homeScore: number; awayScore: number } | undefined> {
  const org = db.collection('orgs').doc(orgId);
  const matchRef = org.collection('matches').doc(matchId);
  return db.runTransaction(async (tx) => {
    // Read current reports instead of event data: retries and out-of-order
    // deliveries must not restore an older version of a submitted score.
    const match = await tx.get(matchRef);
    if (!match.exists) return undefined;
    const data = match.data()!;
    if (data.forfeitTeamId || data.isTournament) return undefined;
    if (onlyMissing && data.homeScore != null && data.awayScore != null) {
      return undefined;
    }
    const reports = await tx.get(
      org.collection('matchReports').where('matchId', '==', matchId),
    );
    const candidates = reports.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Row & { id: string }))
      .filter((report) => submittedMatchScore(report) != null)
      .sort((a, b) =>
        String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')) ||
        a.id.localeCompare(b.id),
      );
    const score = candidates[0] && submittedMatchScore(candidates[0]);
    if (!score || (data.homeScore === score.homeScore && data.awayScore === score.awayScore)) {
      return undefined;
    }
    if (write) tx.update(matchRef, score);
    return score;
  });
}
