import type { CrewAssignment } from '@/domain/types';

/** Sentinel user id for assigner-filled slots with no society official. */
export const OUTSIDE_APPOINTMENT_USER_ID = '__outside_appointment__';

export const OUTSIDE_APPOINTMENT_LABEL = 'Outside appointment';

export function isOutsideAppointmentUserId(
  userId: string | undefined | null,
): boolean {
  return userId === OUTSIDE_APPOINTMENT_USER_ID;
}

export function isPlaceholderCrewAssignment(
  assignment: CrewAssignment | undefined,
): boolean {
  return isOutsideAppointmentUserId(assignment?.userId);
}
