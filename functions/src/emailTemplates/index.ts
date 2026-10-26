/**
 * Outbound email templates (subject / text / html) for Resend.
 *
 * Add new notification copy here as `*.ts` files and re-export from this barrel.
 * Prefer building HTML in code over Resend dashboard templates — see docs/EMAIL.md.
 *
 * Client-composed counterparts (assignment / compliance): src/domain/emailTemplates/
 */

export type { EmailBody, MatchEmailFacts } from './shared';
export {
  formatKickoffDateTime,
  mapsDirectionsUrl,
  matchFactsHtml,
  matchFactsText,
  matchLinkHtml,
} from './shared';

export type { MatchChangeDetails, MatchChangeType } from './matchChange';
export { matchChangeEmailBody } from './matchChange';

export type { AssignmentCrewMate } from './assignment';
export { assignmentEmailBody } from './assignment';
export { unassignmentEmailBody } from './unassignment';

export {
  gameRequestDeclinedEmailBody,
  MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON,
} from './gameRequestDeclined';

export { teamLinkRequestEmailBody } from './teamLinkRequest';
export { complianceHoldEmailBody } from './complianceHold';
