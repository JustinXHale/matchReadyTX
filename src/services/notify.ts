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
