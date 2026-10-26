import { isOutsideAppointmentUserId } from '@/domain/placeholderAssignment';
import {
  CREW_SLOT_LABELS,
  REQUESTABLE_SLOT_LABELS,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import {
  markAssignmentEmailSent,
  type AssignmentEmailEvent,
} from '@/domain/assignmentEmail';
import { allActiveAssignments } from '@/domain/crew';
import {
  assignmentEmailBody,
  unassignmentEmailBody,
  type AssignmentCrewMate,
} from '@/domain/emailTemplates';
import { defaultOrgId, saveMatchCrewAssignment } from '@/services/orgData';
import { callNotifyUser } from '@/services/notify';
import { isFirebaseConfigured } from '@/services/firebase';

function roleLabel(slot: RequestableSlot): string {
  return slot === 'cmo'
    ? REQUESTABLE_SLOT_LABELS.cmo
    : CREW_SLOT_LABELS[slot];
}

/** Other named crew (excluding the email recipient). */
function otherAssignees(
  match: Match,
  excludeUserId: string,
): AssignmentCrewMate[] {
  const out: AssignmentCrewMate[] = [];
  for (const { slot, assignment } of allActiveAssignments(match)) {
    if (
      !assignment.userId ||
      assignment.userId === excludeUserId ||
      isOutsideAppointmentUserId(assignment.userId)
    ) {
      continue;
    }
    if (!assignment.userName?.trim()) continue;
    out.push({ role: CREW_SLOT_LABELS[slot], name: assignment.userName.trim() });
  }
  for (const c of match.cmo ?? []) {
    if (!c.userId || c.userId === excludeUserId) continue;
    if (!c.userName?.trim()) continue;
    out.push({ role: REQUESTABLE_SLOT_LABELS.cmo, name: c.userName.trim() });
  }
  return out;
}

function canNotify(userId: string): boolean {
  return (
    isFirebaseConfigured &&
    !userId.startsWith('u_') &&
    !isOutsideAppointmentUserId(userId)
  );
}

/** Send (or resend) the assignment confirmation email — no Firestore write. */
export async function sendCrewAssignmentEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
  /** Tag for mail audit; default assignment / assignment_resend. */
  event?: string;
}): Promise<void> {
  const { match, slot, userId } = opts;
  if (!canNotify(userId)) return;

  const email = assignmentEmailBody({
    match,
    roleLabel: roleLabel(slot),
    otherCrew: otherAssignees(match, userId),
  });

  await callNotifyUser({
    uid: userId,
    subject: email.subject,
    body: email.text,
    event: opts.event ?? 'assignment',
    html: email.html,
  });
}

async function recordAssignmentEmailSent(
  match: Match,
  slot: RequestableSlot,
  userId: string,
  event: AssignmentEmailEvent,
): Promise<Match> {
  const next = markAssignmentEmailSent(match, slot, userId, event);
  await saveMatchCrewAssignment(defaultOrgId(), next);
  return next;
}

/** After local assignCrew / assignCmo: persist to Firestore and email the official (live only). */
export async function persistCrewAssignmentAndEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
}): Promise<Match | void> {
  if (!isFirebaseConfigured) return;

  const { match, slot, userId } = opts;
  await saveMatchCrewAssignment(defaultOrgId(), match);
  await sendCrewAssignmentEmail({ match, slot, userId, event: 'assignment' });
  return recordAssignmentEmailSent(match, slot, userId, 'assignment');
}

/** Resend assignment confirmation only (Scheduler). */
export async function resendCrewAssignmentEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
}): Promise<Match | void> {
  if (!isFirebaseConfigured) return;
  const { match, slot, userId } = opts;
  await sendCrewAssignmentEmail({
    match,
    slot,
    userId,
    event: 'assignment_resend',
  });
  return recordAssignmentEmailSent(match, slot, userId, 'assignment_resend');
}

/**
 * Persist crew after clear/unassign and email the person who was removed (live only).
 * Pass userId/slot from *before* the local clear.
 */
export async function persistCrewUnassignmentAndEmail(opts: {
  match: Match;
  slot: RequestableSlot;
  userId: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;

  const { match, slot, userId } = opts;
  await saveMatchCrewAssignment(defaultOrgId(), match);
  if (!canNotify(userId)) return;

  const email = unassignmentEmailBody({
    match,
    roleLabel: roleLabel(slot),
  });

  await callNotifyUser({
    uid: userId,
    subject: email.subject,
    body: email.text,
    event: 'unassignment',
    html: email.html,
  });
}
