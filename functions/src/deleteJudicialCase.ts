/**
 * Assigner or Judicial: permanently delete a judicial case + comments.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

type Role =
  | 'assigner'
  | 'teamAdmin'
  | 'official'
  | 'cmo'
  | 'fan'
  | 'reportAnalytics'
  | 'judicial'
  | 'treasurer';

function asRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Role => typeof r === 'string');
}

export async function runDeleteJudicialCase(input: {
  db: Firestore;
  orgId: string;
  caseId: string;
  callerUid: string;
}): Promise<{ ok: true }> {
  const { db, orgId, callerUid } = input;
  const caseId = String(input.caseId ?? '').trim();
  if (!caseId) {
    throw new HttpsError('invalid-argument', 'caseId is required.');
  }

  const memberSnap = await db.doc(`orgs/${orgId}/members/${callerUid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this org.');
  }
  const roles = asRoles(memberSnap.data()?.roles);
  if (!roles.includes('assigner') && !roles.includes('judicial')) {
    throw new HttpsError(
      'permission-denied',
      'Only Scheduler or Judicial can delete a case.',
    );
  }

  const caseRef = db.doc(`orgs/${orgId}/judicialCases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) {
    throw new HttpsError('not-found', 'Case not found.');
  }

  const commentsSnap = await caseRef.collection('comments').get();
  const batch = db.batch();
  for (const doc of commentsSnap.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(caseRef);
  await batch.commit();

  logger.info('deleteJudicialCase', {
    orgId,
    caseId,
    by: callerUid,
    commentsRemoved: commentsSnap.size,
  });
  return { ok: true };
}
