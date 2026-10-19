/**
 * Card report reopen request + privileged unlock (Scheduler / Judicial).
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

async function memberRoles(
  db: Firestore,
  orgId: string,
  uid: string,
): Promise<Role[]> {
  const snap = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this org.');
  }
  return asRoles(snap.data()?.roles);
}

function assertSchedulerOrJudicial(roles: Role[]): void {
  if (!roles.includes('assigner') && !roles.includes('judicial')) {
    throw new HttpsError(
      'permission-denied',
      'Only Scheduler or Judicial can perform this action.',
    );
  }
}

function displayName(data: Record<string, unknown> | undefined): string {
  const name = String(data?.displayName ?? data?.name ?? '').trim();
  return name || 'Member';
}

export async function runRequestCardReportReopen(input: {
  db: Firestore;
  orgId: string;
  uid: string;
  reportId: string;
  requestReason: string;
}): Promise<{ ok: true; requestId: string }> {
  const { db, orgId, uid } = input;
  const reportId = String(input.reportId ?? '').trim();
  const requestReason = String(input.requestReason ?? '').trim();
  if (!reportId) {
    throw new HttpsError('invalid-argument', 'reportId is required.');
  }
  if (!requestReason) {
    throw new HttpsError(
      'invalid-argument',
      'Please explain why you need to reopen this report.',
    );
  }
  if (requestReason.length > 2000) {
    throw new HttpsError('invalid-argument', 'Reason is too long.');
  }

  const reportRef = db.doc(`orgs/${orgId}/cardReports/${reportId}`);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    throw new HttpsError('not-found', 'Card report not found.');
  }
  const report = reportSnap.data() ?? {};
  if (report.officialId !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Only the filing Match Official can request a reopen.',
    );
  }
  if (report.status !== 'submitted') {
    throw new HttpsError(
      'failed-precondition',
      'Only a submitted card report can be reopened.',
    );
  }
  if (report.editUnlockedAt) {
    throw new HttpsError(
      'failed-precondition',
      'This report is already unlocked for editing.',
    );
  }

  const pending = await db
    .collection(`orgs/${orgId}/cardReportReopenRequests`)
    .where('reportId', '==', reportId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!pending.empty) {
    throw new HttpsError(
      'already-exists',
      'A reopen request is already pending for this report.',
    );
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const memberSnap = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  const requesterName =
    displayName(userSnap.data() as Record<string, unknown> | undefined) ||
    displayName(memberSnap.data() as Record<string, unknown> | undefined);
  const requesterEmail = String(
    userSnap.data()?.email ?? memberSnap.data()?.email ?? '',
  ).trim();

  const matchId = String(report.matchId ?? '').trim();
  let matchLabel = matchId;
  if (matchId) {
    const matchSnap = await db.doc(`orgs/${orgId}/matches/${matchId}`).get();
    if (matchSnap.exists) {
      const m = matchSnap.data() ?? {};
      const home = String(m.homeTeamName ?? '').trim();
      const away = String(m.awayTeamName ?? '').trim();
      if (home && away) matchLabel = `${home} vs ${away}`;
    }
  }

  const reqRef = db.collection(`orgs/${orgId}/cardReportReopenRequests`).doc();
  const now = new Date().toISOString();
  await reqRef.set({
    orgId,
    id: reqRef.id,
    matchId,
    reportId,
    requesterUserId: uid,
    requesterName,
    requesterEmail,
    matchLabel,
    requestReason,
    status: 'pending',
    createdAt: now,
  });

  return { ok: true, requestId: reqRef.id };
}

export async function runReviewCardReportReopen(input: {
  db: Firestore;
  orgId: string;
  requestId: string;
  reviewerUid: string;
  decision: string;
  denyReason?: string;
}): Promise<{ ok: true }> {
  const { db, orgId, requestId, reviewerUid } = input;
  const decision = String(input.decision ?? '').trim();
  if (decision !== 'approve' && decision !== 'deny') {
    throw new HttpsError(
      'invalid-argument',
      'decision must be approve or deny.',
    );
  }

  const roles = await memberRoles(db, orgId, reviewerUid);
  assertSchedulerOrJudicial(roles);

  const denyReason = String(input.denyReason ?? '').trim();
  if (decision === 'deny' && !denyReason) {
    throw new HttpsError('invalid-argument', 'A deny reason is required.');
  }
  if (denyReason.length > 2000) {
    throw new HttpsError('invalid-argument', 'Reason is too long.');
  }

  const reqRef = db.doc(
    `orgs/${orgId}/cardReportReopenRequests/${requestId}`,
  );
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError('not-found', 'Reopen request not found.');
  }
  const req = reqSnap.data() ?? {};
  if (req.status !== 'pending') {
    throw new HttpsError(
      'failed-precondition',
      'This request has already been reviewed.',
    );
  }

  const reviewerSnap = await db
    .doc(`orgs/${orgId}/members/${reviewerUid}`)
    .get();
  const reviewerName = displayName(
    reviewerSnap.data() as Record<string, unknown> | undefined,
  );
  const now = new Date().toISOString();

  try {
    if (decision === 'approve') {
      const reportId = String(req.reportId ?? '').trim();
      const reportRef = db.doc(`orgs/${orgId}/cardReports/${reportId}`);
      const reportSnap = await reportRef.get();
      if (!reportSnap.exists) {
        throw new HttpsError('not-found', 'Card report not found.');
      }
      await db.runTransaction(async (tx) => {
        tx.set(
          reportRef,
          {
            editUnlockedAt: now,
            editUnlockedByUid: reviewerUid,
            editUnlockedByName: reviewerName,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.set(
          reqRef,
          {
            status: 'approved',
            reviewedAt: now,
            reviewedByUserId: reviewerUid,
            reviewedByName: reviewerName,
          },
          { merge: true },
        );
      });
      return { ok: true };
    }

    await reqRef.set(
      {
        status: 'denied',
        reviewedAt: now,
        reviewedByUserId: reviewerUid,
        reviewedByName: reviewerName,
        denyReason,
      },
      { merge: true },
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('reviewCardReportReopen failed', {
      orgId,
      requestId,
      decision,
      message: errorMessage(err),
    });
    throw new HttpsError(
      'internal',
      errorMessage(err) || 'Failed to review reopen request.',
    );
  }
}

export async function runUnlockCardReportForEdit(input: {
  db: Firestore;
  orgId: string;
  reportId: string;
  reviewerUid: string;
}): Promise<{ ok: true }> {
  const { db, orgId, reviewerUid } = input;
  const reportId = String(input.reportId ?? '').trim();
  if (!reportId) {
    throw new HttpsError('invalid-argument', 'reportId is required.');
  }

  const roles = await memberRoles(db, orgId, reviewerUid);
  assertSchedulerOrJudicial(roles);

  const reportRef = db.doc(`orgs/${orgId}/cardReports/${reportId}`);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    throw new HttpsError('not-found', 'Card report not found.');
  }
  const report = reportSnap.data() ?? {};
  if (report.status !== 'submitted') {
    throw new HttpsError(
      'failed-precondition',
      'Only a submitted card report can be unlocked.',
    );
  }
  if (report.editUnlockedAt) {
    return { ok: true };
  }

  const reviewerSnap = await db
    .doc(`orgs/${orgId}/members/${reviewerUid}`)
    .get();
  const reviewerName = displayName(
    reviewerSnap.data() as Record<string, unknown> | undefined,
  );
  const now = new Date().toISOString();

  await reportRef.set(
    {
      editUnlockedAt: now,
      editUnlockedByUid: reviewerUid,
      editUnlockedByName: reviewerName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Auto-close any pending reopen request for this report.
  const pending = await db
    .collection(`orgs/${orgId}/cardReportReopenRequests`)
    .where('reportId', '==', reportId)
    .where('status', '==', 'pending')
    .get();
  const batch = db.batch();
  for (const doc of pending.docs) {
    batch.set(
      doc.ref,
      {
        status: 'approved',
        reviewedAt: now,
        reviewedByUserId: reviewerUid,
        reviewedByName: reviewerName,
      },
      { merge: true },
    );
  }
  if (!pending.empty) await batch.commit();

  return { ok: true };
}
