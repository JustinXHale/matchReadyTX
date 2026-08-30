import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const RATE_MAX = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

type Role =
  | 'assigner'
  | 'teamAdmin'
  | 'official'
  | 'cmo'
  | 'fan'
  | 'reportAnalytics'
  | 'judicial';

function asRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Role => typeof r === 'string');
}

export async function runSetJudicialRole(
  callerUid: string,
  orgId: string,
  targetUid: string,
  grant: boolean,
): Promise<{ ok: true; uid: string; grant: boolean }> {
  const db = getFirestore();
  if (!targetUid || targetUid.startsWith('u_')) {
    throw new HttpsError('invalid-argument', 'A live member uid is required.');
  }

  const callerSnap = await db.doc(`orgs/${orgId}/members/${callerUid}`).get();
  if (!callerSnap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this org.');
  }
  const callerRoles = asRoles(callerSnap.data()?.roles);
  if (!callerRoles.includes('assigner') && !callerRoles.includes('judicial')) {
    throw new HttpsError(
      'permission-denied',
      'Only Scheduler or Judicial officers can grant Judicial access.',
    );
  }

  const rateRef = db.doc(
    `orgs/${orgId}/adminRateLimits/${callerUid}_setJudicialRole`,
  );
  const rateSnap = await rateRef.get();
  const now = Date.now();
  const prev = Array.isArray(rateSnap.data()?.at)
    ? (rateSnap.data()?.at as unknown[]).filter(
        (v): v is number => typeof v === 'number',
      )
    : [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new HttpsError(
      'resource-exhausted',
      'Too many Judicial grant changes. Try again later.',
    );
  }

  const memberRef = db.doc(`orgs/${orgId}/members/${targetUid}`);
  const userRef = db.doc(`users/${targetUid}`);
  const [memberSnap, userSnap] = await Promise.all([
    memberRef.get(),
    userRef.get(),
  ]);
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'That person is not in this society.');
  }

  const memberRoles = asRoles(memberSnap.data()?.roles);
  const userRoles = asRoles(userSnap.data()?.roles);
  const nextMember = grant
    ? [...new Set([...memberRoles, 'judicial' as const])]
    : memberRoles.filter((r) => r !== 'judicial');
  let nextUser = grant
    ? [...new Set([...userRoles, 'judicial' as const])]
    : userRoles.filter((r) => r !== 'judicial');
  if (grant) {
    nextUser = nextUser.filter((r) => r !== 'fan');
  }

  const batch = db.batch();
  batch.set(
    memberRef,
    { roles: nextMember, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  if (userSnap.exists) {
    batch.set(
      userRef,
      { roles: nextUser, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  batch.set(rateRef, { at: [...recent, now] }, { merge: true });
  await batch.commit();

  logger.info('setJudicialRole', {
    orgId,
    targetUid,
    grant,
    by: callerUid,
  });
  return { ok: true, uid: targetUid, grant };
}

export const setJudicialRole = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const orgId =
    String(request.data?.orgId ?? '').trim() ||
    process.env.DEFAULT_ORG_ID ||
    'lonestar';
  const targetUid = String(request.data?.uid ?? '').trim();
  const grant = request.data?.grant === true;
  if (typeof request.data?.grant !== 'boolean') {
    throw new HttpsError('invalid-argument', 'grant must be true or false.');
  }
  return runSetJudicialRole(request.auth.uid, orgId, targetUid, grant);
});
