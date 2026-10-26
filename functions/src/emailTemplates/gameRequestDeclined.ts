/**
 * Raise-hand / game request auto-declined when the match assignment is filled.
 */
import type { EmailBody } from './shared';

export const MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON =
  'Match assignment has been fulfilled';

export function gameRequestDeclinedEmailBody(opts?: {
  reason?: string;
}): EmailBody {
  const reason =
    opts?.reason?.trim() || MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON;
  return {
    subject: 'Game request declined',
    text: reason,
    html: `<p>${reason}</p>`,
  };
}
