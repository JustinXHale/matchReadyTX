/**
 * Team Admin club-link requests: submit (auto-approve via Contacts) + review.
 */
import { google } from 'googleapis';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { enqueueMail } from './sendMail';

const CONTACTS_TAB_ALIASES = [
  'Contacts',
  'contacts',
  'teamContacts',
  'TeamContacts',
];

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message ?? '').trim();
    if (m) return m;
  }
  return 'Unknown error';
}

function sheetsClient(serviceAccountJson: string) {
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
  } catch {
    throw new HttpsError(
      'failed-precondition',
      'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.',
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function headerIndex(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) =>
    String(h ?? '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
  );
  for (const a of aliases) {
    const i = norm.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

function quoteSheetRange(tabName: string, cells: string): string {
  const needsQuote = /[^A-Za-z0-9_]/.test(tabName);
  const tab = needsQuote ? `'${tabName.replace(/'/g, "''")}'` : tabName;
  return `${tab}!${cells}`;
}

async function readContactsTab(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
): Promise<{ tabName: string; values: string[][] }> {
  let lastErr: unknown;
  for (const tabName of CONTACTS_TAB_ALIASES) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: quoteSheetRange(tabName, 'A:Z'),
        majorDimension: 'ROWS',
      });
      return { tabName, values: (res.data.values as string[][]) ?? [] };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        'Contacts tab not found. Add a tab named Contacts with team_name and email columns.',
      );
}

async function appendContactsRow(
  sheets: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  row: { teamName: string; email: string; phone?: string },
): Promise<void> {
  const { tabName, values } = await readContactsTab(sheets, spreadsheetId);
  if (!values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: quoteSheetRange(tabName, 'A1:E2'),
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['team_name', 'conference', 'name', 'email', 'phone'],
          [row.teamName, '', '', row.email, row.phone ?? ''],
        ],
      },
    });
    return;
  }

  const headers = values[0] ?? [];
  const teamIdx = headerIndex(headers, ['team_name', 'team', 'club']);
  const emailIdx = headerIndex(headers, ['email', 'e_mail', 'e-mail']);
  const phoneIdx = headerIndex(headers, ['phone', 'mobile', 'cell']);
  const nameIdx = headerIndex(headers, ['name', 'contact_name', 'person']);
  const confIdx = headerIndex(headers, ['conference', 'competition', 'league']);
  if (teamIdx < 0 || emailIdx < 0) {
    throw new HttpsError(
      'failed-precondition',
      'Contacts tab needs team_name and email columns.',
    );
  }

  const emailNorm = normEmail(row.email);
  const teamNorm = row.teamName.trim().toLowerCase();
  for (let i = 1; i < values.length; i++) {
    const t = String(values[i]?.[teamIdx] ?? '')
      .trim()
      .toLowerCase();
    const e = normEmail(String(values[i]?.[emailIdx] ?? ''));
    if (t === teamNorm && e === emailNorm) {
      return; // already present
    }
  }

  const width = Math.max(headers.length, 5);
  const line = Array.from({ length: width }, () => '');
  line[teamIdx] = row.teamName;
  line[emailIdx] = row.email;
  if (phoneIdx >= 0) line[phoneIdx] = row.phone ?? '';
  if (nameIdx >= 0) line[nameIdx] = '';
  if (confIdx >= 0) line[confIdx] = '';

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: quoteSheetRange(tabName, 'A:Z'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [line] },
  });
}

/** Firestore rejects `undefined` — copy only string contact fields. */
function sanitizeContactPeople(
  raw: unknown,
): Array<{ email: string; name?: string; phone?: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ email: string; name?: string; phone?: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const email = normEmail(String(rec.email ?? ''));
    if (!email) continue;
    const person: { email: string; name?: string; phone?: string } = { email };
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const phone = typeof rec.phone === 'string' ? rec.phone.trim() : '';
    if (name) person.name = name;
    if (phone) person.phone = phone;
    out.push(person);
  }
  return out;
}

type Role = 'assigner' | 'teamAdmin' | 'official' | 'cmo' | 'fan';

function rolesAfterDenial(
  roles: Role[],
  teamIds: string[],
  remainingPending: number,
): { roles: Role[]; teamIds: string[] } {
  if (teamIds.length > 0 || remainingPending > 0) {
    return { roles, teamIds };
  }
  let next = roles.filter((r) => r !== 'teamAdmin');
  const hasWorking = next.some(
    (r) => r === 'official' || r === 'cmo' || r === 'assigner',
  );
  if (!hasWorking) next = ['fan'];
  return { roles: next, teamIds: [] };
}

async function loadMemberRoles(
  db: Firestore,
  orgId: string,
  uid: string,
): Promise<{ roles: Role[]; teamIds: string[] }> {
  const member = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  const roles = Array.isArray(member.data()?.roles)
    ? (member.data()!.roles as Role[])
    : [];
  const teamIds = Array.isArray(member.data()?.teamIds)
    ? (member.data()!.teamIds as string[])
    : [];
  return { roles, teamIds };
}

async function canReviewTeamLink(
  db: Firestore,
  orgId: string,
  reviewerUid: string,
  teamId: string,
): Promise<boolean> {
  const { roles, teamIds } = await loadMemberRoles(db, orgId, reviewerUid);
  if (roles.includes('assigner')) return true;
  return roles.includes('teamAdmin') && teamIds.includes(teamId);
}

async function notifyReviewers(opts: {
  db: Firestore;
  orgId: string;
  teamId: string;
  teamName: string;
  requesterName: string;
  requesterEmail: string;
}): Promise<void> {
  const { db, orgId, teamId, teamName, requesterName, requesterEmail } = opts;
  const members = await db.collection(`orgs/${orgId}/members`).get();
  const uids = new Set<string>();
  for (const doc of members.docs) {
    const roles = Array.isArray(doc.data().roles)
      ? (doc.data().roles as string[])
      : [];
    const teamIds = Array.isArray(doc.data().teamIds)
      ? (doc.data().teamIds as string[])
      : [];
    if (roles.includes('assigner')) uids.add(doc.id);
    if (roles.includes('teamAdmin') && teamIds.includes(teamId)) {
      uids.add(doc.id);
    }
  }

  const subject = `Team Admin request: ${teamName}`;
  const body = `${requesterName} (${requesterEmail}) asked to manage ${teamName}. Review in Scheduler → Queues or Team Admin.`;

  for (const uid of uids) {
    const user = await db.doc(`users/${uid}`).get();
    const email = String(user.data()?.email ?? '').trim();
    if (!email) continue;
    try {
      await enqueueMail(db, {
        to: email,
        subject,
        text: body,
        uid,
        event: 'team_link_request',
      });
    } catch (err) {
      logger.warn('team link notify failed', { uid, err });
    }
  }
}

async function grantTeam(opts: {
  db: Firestore;
  orgId: string;
  uid: string;
  teamId: string;
  teamName: string;
  email: string;
  phone?: string;
  serviceAccountJson?: string;
  writeSheet: boolean;
}): Promise<void> {
  const { db, orgId, uid, teamId, teamName, email, phone, writeSheet } = opts;
  const userRef = db.doc(`users/${uid}`);
  const memberRef = db.doc(`orgs/${orgId}/members/${uid}`);
  const teamRef = db.doc(`orgs/${orgId}/teams/${teamId}`);

  const [userSnap, memberSnap, teamSnap] = await Promise.all([
    userRef.get(),
    memberRef.get(),
    teamRef.get(),
  ]);

  const userRoles = Array.isArray(userSnap.data()?.roles)
    ? ([...userSnap.data()!.roles] as Role[])
    : [];
  if (!userRoles.includes('teamAdmin')) userRoles.push('teamAdmin');
  // Fan XOR: drop fan when granting working TA
  const roles = userRoles.filter((r) => r !== 'fan');

  const userTeamIds = Array.isArray(userSnap.data()?.teamIds)
    ? ([...userSnap.data()!.teamIds] as string[])
    : [];
  if (!userTeamIds.includes(teamId)) userTeamIds.push(teamId);

  const memberRoles = Array.isArray(memberSnap.data()?.roles)
    ? ([...memberSnap.data()!.roles] as Role[])
    : [...roles];
  if (!memberRoles.includes('teamAdmin')) memberRoles.push('teamAdmin');
  const memberTeamIds = Array.isArray(memberSnap.data()?.teamIds)
    ? ([...memberSnap.data()!.teamIds] as string[])
    : [];
  if (!memberTeamIds.includes(teamId)) memberTeamIds.push(teamId);

  const contactEmails = Array.isArray(teamSnap.data()?.contactEmails)
    ? (teamSnap.data()!.contactEmails as unknown[])
        .map((c) => normEmail(String(c ?? '')))
        .filter(Boolean)
    : [];
  const emailNorm = normEmail(email);
  if (emailNorm && !contactEmails.includes(emailNorm)) {
    contactEmails.push(emailNorm);
  }
  const contactPeople = sanitizeContactPeople(teamSnap.data()?.contactPeople);
  if (
    emailNorm &&
    !contactPeople.some((p) => normEmail(p.email) === emailNorm)
  ) {
    contactPeople.push({ email: emailNorm });
  }

  await userRef.set(
    { roles, teamIds: userTeamIds, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await memberRef.set(
    {
      roles: memberRoles.filter((r) => r !== 'fan'),
      teamIds: memberTeamIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await teamRef.set(
    { contactEmails, contactPeople, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  // Sheet write is best-effort. A prior approve may have linked the member in
  // Firestore and then thrown on Contacts append, leaving the request pending.
  if (writeSheet && opts.serviceAccountJson) {
    try {
      const orgSnap = await db.doc(`orgs/${orgId}`).get();
      const sheetId = String(orgSnap.data()?.sheetId ?? '').trim();
      if (sheetId && emailNorm) {
        const sheets = sheetsClient(opts.serviceAccountJson);
        await appendContactsRow(sheets, sheetId, {
          teamName,
          email: emailNorm,
          phone,
        });
      }
    } catch (err) {
      logger.error('Contacts sheet append failed after team grant', {
        orgId,
        uid,
        teamId,
        message: errorMessage(err),
        err,
      });
    }
  }
}

export async function runSubmitTeamLinkRequests(opts: {
  db: Firestore;
  orgId: string;
  uid: string;
  teamIds: string[];
  serviceAccountJson?: string;
}): Promise<{
  ok: true;
  autoApproved: string[];
  pending: string[];
}> {
  const { db, orgId, uid, teamIds } = opts;
  const unique = [...new Set(teamIds.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new HttpsError('invalid-argument', 'Select at least one team.');
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'User profile not found.');
  }
  const user = userSnap.data()!;
  const email = normEmail(String(user.email ?? ''));
  const name =
    String(user.displayName ?? '').trim() ||
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    email;
  const phone = String(user.phone ?? '').trim() || undefined;

  // Ensure teamAdmin role present (without Fan XOR conflict handled on grant)
  const roles = Array.isArray(user.roles) ? ([...user.roles] as Role[]) : [];
  if (!roles.includes('teamAdmin')) {
    roles.push('teamAdmin');
  }
  const withoutFan = roles.includes('teamAdmin')
    ? roles.filter((r) => r !== 'fan')
    : roles;
  await db.doc(`users/${uid}`).set(
    { roles: withoutFan, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  const memberExisting = await loadMemberRoles(db, orgId, uid);
  await db.doc(`orgs/${orgId}/members/${uid}`).set(
    {
      roles: withoutFan.includes('assigner')
        ? withoutFan
        : withoutFan.filter((r) => r !== 'assigner'),
      teamIds: memberExisting.teamIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const autoApproved: string[] = [];
  const pending: string[] = [];
  const now = new Date().toISOString();

  for (const teamId of unique) {
    const teamSnap = await db.doc(`orgs/${orgId}/teams/${teamId}`).get();
    if (!teamSnap.exists) {
      throw new HttpsError('not-found', `Team not found: ${teamId}`);
    }
    const teamName = String(teamSnap.data()?.name ?? teamId);
    const contacts = Array.isArray(teamSnap.data()?.contactEmails)
      ? (teamSnap.data()!.contactEmails as string[])
      : [];
    const onContacts =
      Boolean(email) &&
      contacts.some((c) => normEmail(String(c)) === email);

    // Skip if already linked
    const member = await loadMemberRoles(db, orgId, uid);
    if (member.teamIds.includes(teamId)) {
      autoApproved.push(teamId);
      continue;
    }

    // Skip duplicate pending
    const existing = await db
      .collection(`orgs/${orgId}/teamLinkRequests`)
      .where('requesterUserId', '==', uid)
      .where('teamId', '==', teamId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!existing.empty) {
      pending.push(teamId);
      continue;
    }

    const reqRef = db.collection(`orgs/${orgId}/teamLinkRequests`).doc();
    if (onContacts) {
      await reqRef.set({
        orgId,
        requesterUserId: uid,
        requesterName: name,
        requesterEmail: email,
        teamId,
        teamName,
        status: 'approved',
        createdAt: now,
        reviewedAt: now,
        autoApproved: true,
      });
      await grantTeam({
        db,
        orgId,
        uid,
        teamId,
        teamName,
        email,
        phone,
        writeSheet: false,
      });
      autoApproved.push(teamId);
    } else {
      await reqRef.set({
        orgId,
        requesterUserId: uid,
        requesterName: name,
        requesterEmail: email,
        teamId,
        teamName,
        status: 'pending',
        createdAt: now,
      });
      pending.push(teamId);
      await notifyReviewers({
        db,
        orgId,
        teamId,
        teamName,
        requesterName: name,
        requesterEmail: email,
      });
    }
  }

  return { ok: true, autoApproved, pending };
}

export async function runReviewTeamLinkRequest(opts: {
  db: Firestore;
  orgId: string;
  requestId: string;
  reviewerUid: string;
  decision: 'approve' | 'deny';
  denyReason?: string;
  serviceAccountJson: string;
}): Promise<{ ok: true }> {
  const {
    db,
    orgId,
    requestId,
    reviewerUid,
    decision,
    denyReason,
    serviceAccountJson,
  } = opts;

  try {
    const reqRef = db.doc(`orgs/${orgId}/teamLinkRequests/${requestId}`);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'Team link request not found.');
    }
    const req = reqSnap.data()!;
    if (req.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Request is already ${req.status}.`,
      );
    }

    const teamId = String(req.teamId ?? '');
    const allowed = await canReviewTeamLink(db, orgId, reviewerUid, teamId);
    if (!allowed) {
      throw new HttpsError(
        'permission-denied',
        'Only an assigner or a Team Admin for this club can review.',
      );
    }

    const at = new Date().toISOString();
    const uid = String(req.requesterUserId ?? '');

    if (decision === 'approve') {
      const email = normEmail(String(req.requesterEmail ?? ''));
      const teamName = String(req.teamName ?? teamId);
      const userSnap = await db.doc(`users/${uid}`).get();
      const phone = String(userSnap.data()?.phone ?? '').trim() || undefined;

      await grantTeam({
        db,
        orgId,
        uid,
        teamId,
        teamName,
        email,
        phone,
        serviceAccountJson,
        writeSheet: true,
      });
      await reqRef.set(
        {
          status: 'approved',
          reviewedAt: at,
          reviewedByUserId: reviewerUid,
        },
        { merge: true },
      );
      return { ok: true };
    }

    // Deny
    await reqRef.set(
      {
        status: 'denied',
        reviewedAt: at,
        reviewedByUserId: reviewerUid,
        denyReason: denyReason?.trim() || null,
      },
      { merge: true },
    );

    const pendingLeft = await db
      .collection(`orgs/${orgId}/teamLinkRequests`)
      .where('requesterUserId', '==', uid)
      .where('status', '==', 'pending')
      .get();

    const userSnap = await db.doc(`users/${uid}`).get();
    const memberSnap = await db.doc(`orgs/${orgId}/members/${uid}`).get();
    const roles = Array.isArray(userSnap.data()?.roles)
      ? (userSnap.data()!.roles as Role[])
      : [];
    const teamIds = Array.isArray(memberSnap.data()?.teamIds)
      ? (memberSnap.data()!.teamIds as string[])
      : Array.isArray(userSnap.data()?.teamIds)
        ? (userSnap.data()!.teamIds as string[])
        : [];

    const next = rolesAfterDenial(roles, teamIds, pendingLeft.size);
    await db.doc(`users/${uid}`).set(
      {
        roles: next.roles,
        teamIds: next.teamIds,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await db.doc(`orgs/${orgId}/members/${uid}`).set(
      {
        roles: next.roles,
        teamIds: next.teamIds,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('reviewTeamLinkRequest failed', {
      orgId,
      requestId,
      decision,
      message: errorMessage(err),
      err,
    });
    throw new HttpsError(
      'internal',
      errorMessage(err) || 'Failed to review Team Admin request.',
    );
  }
}
