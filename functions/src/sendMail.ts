/**
 * Outbound email via Resend (Firestore `mail/{id}` queue).
 * Doc shape mirrors Trigger Email: { to, message: { subject, html?, text? } }
 */
import { Resend } from 'resend';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

export type MailMessage = {
  subject: string;
  html?: string;
  text?: string;
};

export type MailDoc = {
  to: string | string[];
  message: MailMessage;
  /** Optional audit / dedupe fields */
  uid?: string;
  event?: string;
  createdAt?: string;
  delivery?: {
    state: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    error?: string;
    messageId?: string;
    attempts?: number;
    updatedAt?: string;
  };
};

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((e) => String(e ?? '').trim())
    .filter((e) => e.includes('@'));
}

export async function sendViaResend(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ id: string }> {
  const resend = new Resend(opts.apiKey);
  const text = opts.text?.trim() || undefined;
  const html = opts.html?.trim() || undefined;
  const payload =
    html != null
      ? {
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          html,
          ...(text ? { text } : {}),
        }
      : {
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          text: text || opts.subject,
        };
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }
  if (!data?.id) {
    throw new Error('Resend returned no message id');
  }
  return { id: data.id };
}

/** Enqueue a mail doc for `processOutboundMail` (Admin SDK). */
export async function enqueueMail(
  db: Firestore,
  payload: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    uid?: string;
    event?: string;
  },
): Promise<string> {
  const recipients = normalizeRecipients(payload.to);
  if (recipients.length === 0) {
    throw new Error('No valid recipient email');
  }
  if (!payload.subject.trim()) {
    throw new Error('subject required');
  }
  const ref = await db.collection('mail').add({
    to: recipients.length === 1 ? recipients[0] : recipients,
    message: {
      subject: payload.subject.trim(),
      ...(payload.html ? { html: payload.html } : {}),
      ...(payload.text ? { text: payload.text } : {}),
    },
    ...(payload.uid ? { uid: payload.uid } : {}),
    ...(payload.event ? { event: payload.event } : {}),
    createdAt: new Date().toISOString(),
    delivery: {
      state: 'PENDING',
      attempts: 0,
      updatedAt: new Date().toISOString(),
    },
  } satisfies MailDoc);
  return ref.id;
}

/** Process one mail document: send + write delivery status. */
export async function processMailDocument(opts: {
  db: Firestore;
  mailId: string;
  data: MailDoc;
  apiKey: string;
  from: string;
}): Promise<void> {
  const { db, mailId, data, apiKey, from } = opts;
  const ref = db.doc(`mail/${mailId}`);

  if (data.delivery?.state === 'SUCCESS') {
    logger.info('mail already sent', { mailId });
    return;
  }

  const recipients = normalizeRecipients(data.to);
  const subject = String(data.message?.subject ?? '').trim();
  const html = data.message?.html;
  const text = data.message?.text;

  const attempts = (data.delivery?.attempts ?? 0) + 1;

  if (recipients.length === 0 || !subject) {
    await ref.set(
      {
        delivery: {
          state: 'ERROR',
          error: 'Invalid mail doc: need to + message.subject',
          attempts,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    return;
  }

  await ref.set(
    {
      delivery: {
        state: 'PROCESSING',
        attempts,
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true },
  );

  try {
    const result = await sendViaResend({
      apiKey,
      from,
      to: recipients,
      subject,
      html,
      text: text ?? (html ? undefined : subject),
    });
    await ref.set(
      {
        delivery: {
          state: 'SUCCESS',
          messageId: result.id,
          attempts,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    logger.info('mail sent', {
      mailId,
      to: recipients,
      messageId: result.id,
      event: data.event,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    await ref.set(
      {
        delivery: {
          state: 'ERROR',
          error: message,
          attempts,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    logger.error('mail send failed', { mailId, message });
    throw err;
  }
}
