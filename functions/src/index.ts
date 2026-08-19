/**
 * Cloud Functions entry — Sheet sync, notify, T-72, writeback, geocode.
 * Deploy with Firebase; secrets via Secret Manager.
 */
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { runSheetSync } from './syncSheet';
import { runApproveFixtureRequest } from './approveFixtureRequest';
import { runProposalWriteback } from './proposalWriteback';
import {
  runReviewTeamLinkRequest,
  runSubmitTeamLinkRequests,
} from './teamLinkRequests';
import {
  enqueueMail,
  processMailDocument,
  type MailDoc,
} from './sendMail';

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

const googleServiceAccountJson = defineSecret('GOOGLE_SERVICE_ACCOUNT_JSON');
const resendApiKey = defineSecret('RESEND_API_KEY');
const sheetWebhookSecret = defineSecret('SHEET_WEBHOOK_SECRET');
/** Verified sender, e.g. MatchReadyTX <noreply@yourdomain.com> */
const resendFromEmail = defineString('RESEND_FROM_EMAIL', {
  default: 'MatchReadyTX <onboarding@resend.dev>',
});

async function assertAssigner(uid: string, orgId: string): Promise<void> {
  const member = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  if (!member.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this org.');
  }
  const roles = member.data()?.roles;
  if (!Array.isArray(roles) || !roles.includes('assigner')) {
    throw new HttpsError(
      'permission-denied',
      'Only assigners can sync the schedule Sheet.',
    );
  }
}

/**
 * Assigner-triggered Sheet → Firestore sync.
 * Body: { orgId?: string, sheetId?: string }
 * Uses org.sheetId when sheetId omitted. Requires GOOGLE_SERVICE_ACCOUNT_JSON secret.
 */
export const syncSheet = onCall(
  {
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const orgId =
      String(request.data?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      'lonestar';
    await assertAssigner(request.auth.uid, orgId);

    const orgSnap = await db.doc(`orgs/${orgId}`).get();
    const sheetId =
      String(request.data?.sheetId ?? '').trim() ||
      String(orgSnap.data()?.sheetId ?? '').trim();
    if (!sheetId) {
      throw new HttpsError(
        'failed-precondition',
        'No Sheet linked. Paste a Google Sheet link on Upload, then Sync.',
      );
    }

    const sa = googleServiceAccountJson.value();
    if (!sa) {
      throw new HttpsError(
        'failed-precondition',
        'GOOGLE_SERVICE_ACCOUNT_JSON secret is not set. See docs/SHEET_SYNC.md.',
      );
    }

    try {
      return await runSheetSync({
        db,
        orgId,
        sheetId,
        serviceAccountJson: sa,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sheet sync failed';
      logger.error('syncSheet failed', { orgId, sheetId, message });
      await db.doc(`orgs/${orgId}`).set(
        {
          sheetSyncError: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      if (
        message.includes('permission') ||
        message.includes('The caller does not have permission')
      ) {
        throw new HttpsError(
          'permission-denied',
          'Service account cannot read this Sheet. Share the workbook with the service account email (Viewer).',
        );
      }
      throw new HttpsError('internal', message);
    }
  },
);

/**
 * Apps Script webhook: POST { orgId, rows? } → same ingest as syncSheet / sheetPoll.
 * Optional auth: SHEET_WEBHOOK_SECRET header x-webhook-secret.
 */
export const sheetWebhook = onRequest(
  {
    cors: true,
    secrets: [googleServiceAccountJson, sheetWebhookSecret],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const secret = sheetWebhookSecret.value();
    if (!secret || req.get('x-webhook-secret') !== secret) {
      res.status(401).send('Unauthorized');
      return;
    }
    const orgId =
      String(req.body?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      '';
    if (!orgId) {
      res.status(400).send('orgId required');
      return;
    }

    const orgSnap = await db.doc(`orgs/${orgId}`).get();
    const sheetId =
      String(orgSnap.data()?.sheetId ?? '').trim() ||
      process.env.SHEET_ID ||
      '';
    const sa = googleServiceAccountJson.value();
    if (!sheetId || !sa) {
      const message =
        'Webhook sync skipped — missing sheetId or service account.';
      logger.warn('sheetWebhook skipped', { orgId, sheetId: Boolean(sheetId) });
      await db.doc(`orgs/${orgId}`).set(
        {
          sheetSyncError: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      res.status(503).json({ ok: false, error: message });
      return;
    }

    logger.info('sheetWebhook sync', {
      orgId,
      rows: req.body?.rows?.length,
    });
    try {
      const result = await runSheetSync({
        db,
        orgId,
        sheetId,
        serviceAccountJson: sa,
      });
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sheet webhook sync failed';
      logger.error('sheetWebhook failed', { orgId, message });
      await db.doc(`orgs/${orgId}`).set(
        {
          sheetSyncError: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      res.status(500).json({ ok: false, error: message });
    }
  },
);

/** Poll fallback every 5 minutes — same ingest as syncSheet / sheetWebhook. */
export const sheetPoll = onSchedule(
  {
    schedule: 'every 5 minutes',
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async () => {
    const orgId = process.env.DEFAULT_ORG_ID || 'lonestar';
    const orgSnap = await db.doc(`orgs/${orgId}`).get();
    const sheetId =
      String(orgSnap.data()?.sheetId ?? '').trim() ||
      process.env.SHEET_ID ||
      '';
    const sa = googleServiceAccountJson.value();
    if (!sheetId || !sa) {
      logger.info('sheetPoll skipped — missing sheetId or service account');
      return;
    }
    try {
      await runSheetSync({ db, orgId, sheetId, serviceAccountJson: sa });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Scheduled Sheet sync failed';
      logger.error('sheetPoll failed', err);
      await db.doc(`orgs/${orgId}`).set(
        {
          sheetSyncError: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
  },
);

/** Hourly T-72 sweep */
export const t72Sweep = onSchedule('every 60 minutes', async () => {
  const orgId = process.env.DEFAULT_ORG_ID || 'lonestar';
  const now = Date.now();
  const horizon = now + 72 * 60 * 60 * 1000;
  const snap = await db
    .collection(`orgs/${orgId}/matches`)
    .where('status', 'in', [
      'mo_confirmed',
      'crew_confirmed',
      'locked_confirmed',
    ])
    .get();
  for (const doc of snap.docs) {
    const kickoff = new Date(doc.data().kickoffAt as string).getTime();
    if (kickoff > now && kickoff <= horizon) {
      await doc.ref.set({ status: 't72_team_pending' }, { merge: true });
      logger.info('Entered T-72', { matchId: doc.id });
    }
  }
});

/**
 * After other-team accept + assigner ack: write approved facts to Schedule + match.
 * Body: { orgId?, matchId, proposalId, kickoffAt?, venueName?, venueAddress? }
 */
export const proposalWriteback = onCall(
  {
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const orgId =
      String(request.data?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      'lonestar';
    const matchId = String(request.data?.matchId ?? '').trim();
    const proposalId = String(request.data?.proposalId ?? '').trim();
    if (!matchId || !proposalId) {
      throw new HttpsError(
        'invalid-argument',
        'matchId and proposalId are required.',
      );
    }
    await assertAssigner(request.auth.uid, orgId);

    const sa = googleServiceAccountJson.value();
    if (!sa) {
      throw new HttpsError(
        'failed-precondition',
        'GOOGLE_SERVICE_ACCOUNT_JSON secret is not set. See docs/SHEET_SYNC.md.',
      );
    }

    const kickoffAt = String(request.data?.kickoffAt ?? '').trim() || undefined;
    const venueName = String(request.data?.venueName ?? '').trim() || undefined;
    const venueAddress =
      String(request.data?.venueAddress ?? '').trim() || undefined;

    try {
      const result = await runProposalWriteback({
        db,
        orgId,
        matchId,
        proposalId,
        serviceAccountJson: sa,
        kickoffAt,
        venueName,
        venueAddress,
      });
      await db.doc(`orgs/${orgId}`).set(
        { sheetSyncError: FieldValue.delete() },
        { merge: true },
      );
      logger.info('proposalWriteback ok', { orgId, matchId, proposalId });
      return { ...result, proposalId };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message =
        err instanceof Error ? err.message : 'Proposal write-back failed';
      logger.error('proposalWriteback failed', {
        orgId,
        matchId,
        proposalId,
        message,
      });
      await db.doc(`orgs/${orgId}`).set(
        {
          sheetSyncError: `Write-back failed: ${message}`,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      if (
        message.includes('permission') ||
        message.includes('The caller does not have permission')
      ) {
        throw new HttpsError(
          'permission-denied',
          'Service account cannot edit this Sheet. Share the workbook as Editor with the service account email.',
        );
      }
      throw new HttpsError('internal', message);
    }
  },
);

/**
 * Assigner approves a Team Admin fixture request:
 * append Schedule (+ Locations) Sheet row, create match as pending_team_review.
 * Body: { orgId?, requestId }
 */
export const approveFixtureRequest = onCall(
  {
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const orgId =
      String(request.data?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      'lonestar';
    const requestId = String(request.data?.requestId ?? '').trim();
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'requestId required');
    }
    await assertAssigner(request.auth.uid, orgId);

    const sa = googleServiceAccountJson.value();
    if (!sa) {
      throw new HttpsError(
        'failed-precondition',
        'GOOGLE_SERVICE_ACCOUNT_JSON secret is not set',
      );
    }

    return runApproveFixtureRequest({
      db,
      orgId,
      requestId,
      reviewedByUserId: request.auth.uid,
      serviceAccountJson: sa,
    });
  },
);

/**
 * Onboarding / profile: request Team Admin access for one or more teams.
 * Auto-approves when email is already on Contacts for that team.
 * Body: { orgId?, teamIds: string[] }
 */
export const submitTeamLinkRequests = onCall(
  {
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const orgId =
      String(request.data?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      'lonestar';
    const raw = request.data?.teamIds;
    const teamIds = Array.isArray(raw)
      ? raw.map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];
    const sa = googleServiceAccountJson.value() || undefined;
    return runSubmitTeamLinkRequests({
      db,
      orgId,
      uid: request.auth.uid,
      teamIds,
      serviceAccountJson: sa,
    });
  },
);

/**
 * Assigner or current Team Admin for the club: approve / deny a link request.
 * Approve appends Contacts on the Sheet. Body: { orgId?, requestId, decision, denyReason? }
 */
export const reviewTeamLinkRequest = onCall(
  {
    secrets: [googleServiceAccountJson],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const orgId =
      String(request.data?.orgId ?? '').trim() ||
      process.env.DEFAULT_ORG_ID ||
      'lonestar';
    const requestId = String(request.data?.requestId ?? '').trim();
    const decision = String(request.data?.decision ?? '').trim();
    if (!requestId || (decision !== 'approve' && decision !== 'deny')) {
      throw new HttpsError(
        'invalid-argument',
        'requestId and decision (approve|deny) required',
      );
    }
    const sa = googleServiceAccountJson.value();
    if (!sa) {
      throw new HttpsError(
        'failed-precondition',
        'GOOGLE_SERVICE_ACCOUNT_JSON secret is not set',
      );
    }
    return runReviewTeamLinkRequest({
      db,
      orgId,
      requestId,
      reviewerUid: request.auth.uid,
      decision,
      denyReason: String(request.data?.denyReason ?? '').trim() || undefined,
      serviceAccountJson: sa,
    });
  },
);

/**
 * Queue transactional email for a user (Firestore `mail/` → processOutboundMail).
 * SMS is deferred — email only for now.
 * Body: { uid, subject, body, event?, html? }
 */
export const notifyUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const { uid, subject, body, event, html } = request.data as {
    uid: string;
    subject: string;
    body: string;
    event?: string;
    html?: string;
  };
  if (!uid || !String(subject ?? '').trim() || !String(body ?? '').trim()) {
    throw new HttpsError(
      'invalid-argument',
      'uid, subject, and body are required',
    );
  }
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists) throw new HttpsError('not-found', 'User not found');
  const data = user.data()!;
  const email = String(data.email ?? '').trim();
  if (!email) {
    throw new HttpsError('failed-precondition', 'User has no email');
  }

  // Only self-notify or assigner notifying an org member.
  const caller = request.auth.uid;
  if (caller !== uid) {
    await assertAssigner(caller, process.env.DEFAULT_ORG_ID || 'lonestar');
  }

  const mailId = await enqueueMail(db, {
    to: email,
    subject: String(subject).trim(),
    text: String(body),
    html: html ? String(html) : undefined,
    uid,
    event: event ? String(event) : 'notify',
  });
  logger.info('notifyUser queued', { mailId, to: email, event });
  return { ok: true, mailId, bodyPreview: String(body).slice(0, 80) };
});

/**
 * Firestore mail queue: write a doc under `mail/` (Admin SDK / Functions only)
 * and this trigger sends via Resend. See docs/EMAIL.md.
 */
export const processOutboundMail = onDocumentCreated(
  {
    document: 'mail/{mailId}',
    secrets: [resendApiKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const apiKey = resendApiKey.value();
    if (!apiKey) {
      logger.error('RESEND_API_KEY secret is not set');
      await snap.ref.set(
        {
          delivery: {
            state: 'ERROR',
            error: 'RESEND_API_KEY not configured',
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
      return;
    }
    await processMailDocument({
      db,
      mailId: event.params.mailId,
      data: snap.data() as MailDoc,
      apiKey,
      from: resendFromEmail.value(),
    });
  },
);

/**
 * Assigner smoke-test: queue an email to yourself.
 * Body: { subject?, body? }
 */
export const sendTestEmail = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const orgId = process.env.DEFAULT_ORG_ID || 'lonestar';
  await assertAssigner(request.auth.uid, orgId);

  const user = await db.doc(`users/${request.auth.uid}`).get();
  const email = String(user.data()?.email ?? '').trim();
  if (!email) {
    throw new HttpsError('failed-precondition', 'Your profile has no email');
  }

  const subject =
    String(request.data?.subject ?? '').trim() ||
    'MatchReadyTX test email';
  const body =
    String(request.data?.body ?? '').trim() ||
    'If you received this, outbound email from Cloud Functions is working.';

  const mailId = await enqueueMail(db, {
    to: email,
    subject,
    text: body,
    html: `<p>${body.replace(/</g, '&lt;')}</p>`,
    uid: request.auth.uid,
    event: 'test',
  });
  return { ok: true, mailId, to: email };
});

/**
 * Assigner-only: remove a member from the org and delete their Firebase Auth
 * account + users/{uid} profile (and availability ranges).
 * Body: { orgId?: string, uid: string }
 */
export const deleteOrgMemberAccount = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const orgId =
    String(request.data?.orgId ?? '').trim() ||
    process.env.DEFAULT_ORG_ID ||
    'lonestar';
  const targetUid = String(request.data?.uid ?? '').trim();
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'uid required');
  }
  if (targetUid === request.auth.uid) {
    throw new HttpsError(
      'failed-precondition',
      'You cannot delete your own account from here.',
    );
  }
  if (targetUid.startsWith('u_')) {
    throw new HttpsError('invalid-argument', 'Demo users cannot be deleted.');
  }

  await assertAssigner(request.auth.uid, orgId);

  const memberRef = db.doc(`orgs/${orgId}/members/${targetUid}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'That person is not in this society.');
  }

  // Drop availability ranges (best-effort).
  const ranges = await db
    .collection(`orgs/${orgId}/availability/${targetUid}/ranges`)
    .listDocuments();
  const batch = db.batch();
  for (const ref of ranges) batch.delete(ref);
  batch.delete(memberRef);
  batch.delete(db.doc(`users/${targetUid}`));
  await batch.commit();

  try {
    await auth.deleteUser(targetUid);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code !== 'auth/user-not-found') {
      logger.error('deleteOrgMemberAccount Auth delete failed', {
        targetUid,
        err,
      });
      throw new HttpsError(
        'internal',
        'Removed from society, but Auth delete failed. Try again or delete in Firebase Console.',
      );
    }
  }

  logger.info('deleteOrgMemberAccount', {
    orgId,
    targetUid,
    by: request.auth.uid,
  });
  return { ok: true, uid: targetUid };
});
