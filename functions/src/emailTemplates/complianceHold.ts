/**
 * Compliance hold placed or removed on a match.
 */
import type { EmailBody } from './shared';

export function complianceHoldEmailBody(opts: {
  locked: boolean;
  fixture: string;
  when: string;
  venueName: string;
  societyName: string;
  message: string;
}): EmailBody {
  const { locked, fixture, when, venueName, societyName, message } = opts;

  if (locked) {
    const text = `This match (${when} at ${venueName}) has been placed on hold by ${societyName} until teams are compliant.\n\n${message}`;
    return {
      subject: `Match on hold: ${fixture}`,
      text,
      html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
    };
  }

  const text = `The compliance hold has been removed for ${fixture} (${when} at ${venueName}) by ${societyName}.`;
  return {
    subject: `Match hold removed: ${fixture}`,
    text,
    html: `<p>${text}</p>`,
  };
}
