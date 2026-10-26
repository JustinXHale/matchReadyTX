/**
 * Client-composed email bodies (notifyUser → mail queue).
 * Server-composed templates: functions/src/emailTemplates/
 */
export {
  assignmentEmailBody,
  unassignmentEmailBody,
  type AssignmentCrewMate,
  type EmailBody,
} from './assignment';
export { complianceHoldEmailBody } from './complianceHold';
