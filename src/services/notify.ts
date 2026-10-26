import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '@/services/firebase';

function requireFunctions() {
  if (!isFirebaseConfigured || !functions) {
    throw new Error('Cloud Functions are not configured.');
  }
  return functions;
}

/** Queue an email to users/{uid} via Cloud Function → Resend. */
export async function callNotifyUser(input: {
  uid: string;
  subject: string;
  body: string;
  event?: string;
  html?: string;
}): Promise<{ ok: true; mailId: string }> {
  const fn = httpsCallable(requireFunctions(), 'notifyUser');
  const result = await fn({
    uid: input.uid,
    subject: input.subject,
    body: input.body,
    event: input.event ?? 'notify',
    html: input.html,
  });
  return result.data as { ok: true; mailId: string };
}

/** Confirm match change acknowledgment (crew or team). */
export async function callConfirmMatchChange(input: {
  matchId: string;
  confirmationType: 'crew' | 'home' | 'away';
  orgId?: string;
}): Promise<{ ok: true; confirmedAt: string }> {
  const fn = httpsCallable(requireFunctions(), 'confirmMatchChange');
  const result = await fn({
    orgId: input.orgId,
    matchId: input.matchId,
    confirmationType: input.confirmationType,
  });
  return result.data as { ok: true; confirmedAt: string };
}

/** Assigner: email crew + teams about a match change (time/venue/status). */
export async function callNotifyMatchChange(input: {
  matchId: string;
  changeType: 'time' | 'venue' | 'status' | 'details';
  changes?: {
    oldKickoffAt?: string;
    newKickoffAt?: string;
    oldVenueName?: string;
    newVenueName?: string;
    oldVenueAddress?: string;
    newVenueAddress?: string;
    newStatus?: string;
  };
  orgId?: string;
}): Promise<{
  emailsSent: number;
  crewEmails: number;
  teamEmails: number;
  warnings: string[];
}> {
  const fn = httpsCallable(requireFunctions(), 'notifyMatchChangeCallable');
  const result = await fn({
    orgId: input.orgId,
    matchId: input.matchId,
    changeType: input.changeType,
    changes: input.changes ?? {},
  });
  return result.data as {
    emailsSent: number;
    crewEmails: number;
    teamEmails: number;
    warnings: string[];
  };
}
