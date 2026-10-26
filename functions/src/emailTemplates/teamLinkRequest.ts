/**
 * Notify assigners / existing Team Admins that someone requested Team Admin for a club.
 */
import type { EmailBody } from './shared';

export function teamLinkRequestEmailBody(opts: {
  teamName: string;
  requesterName: string;
  requesterEmail: string;
  reviewUrl: string;
}): EmailBody {
  const { teamName, requesterName, requesterEmail, reviewUrl } = opts;
  const subject = `Team Admin request: ${teamName}`;
  const text = [
    `${requesterName} (${requesterEmail}) asked to manage ${teamName}.`,
    '',
    `Review and approve or deny: ${reviewUrl}`,
    '',
    `If you are not signed in, log in first — you'll be taken to Team links afterward.`,
  ].join('\n');
  const html = `<p><strong>${requesterName}</strong> (<a href="mailto:${requesterEmail}">${requesterEmail}</a>) asked to manage <strong>${teamName}</strong>.</p>
<p><a href="${reviewUrl}">Review Team Admin requests</a> — approve or deny in Scheduler → Requests → Team links.</p>
<p style="color:#666;font-size:13px;">If you are not signed in, you'll be asked to log in first, then taken to Team links.</p>`;

  return { subject, text, html };
}
