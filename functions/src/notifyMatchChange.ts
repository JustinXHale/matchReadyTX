/**
 * Match change notifications — email crew and teams when match details change.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { matchAppUrl } from './appLinks';
import { enqueueMail } from './sendMail';
import { effectiveContactEmailFromUserData } from './contactEmail';
import {
  matchChangeEmailBody,
  type MatchChangeDetails,
  type MatchChangeType,
  type MatchEmailFacts,
} from './emailTemplates';

type MatchData = Omit<MatchEmailFacts, 'id'> & {
  id?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  crew?: Record<string, unknown>;
  cmo?: unknown[];
};

const CREW_SLOTS = ['mo', 'ar1', 'ar2', 'no4'] as const;
const OUTSIDE_APPOINTMENT_USER_ID = '__outside_appointment__';

function isOutsideAppointmentUserId(userId: string): boolean {
  return userId === OUTSIDE_APPOINTMENT_USER_ID;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Extract assigned crew userIds from match.crew structure. */
export function extractCrewUserIds(
  crew: Record<string, unknown> | undefined,
): string[] {
  if (!crew) return [];
  const userIds: string[] = [];

  for (const slot of CREW_SLOTS) {
    const slotData = crew[slot];
    const assignments = Array.isArray(slotData)
      ? slotData
      : slotData
        ? [slotData]
        : [];
    for (const assignment of assignments) {
      const row = asRecord(assignment);
      const userId = String(row?.userId ?? '').trim();
      if (userId && !isOutsideAppointmentUserId(userId)) {
        userIds.push(userId);
      }
    }
  }

  return [...new Set(userIds)];
}

/** Extract CMO userIds from match.cmo array. */
export function extractCmoUserIds(cmo: unknown[] | undefined): string[] {
  if (!Array.isArray(cmo)) return [];
  const userIds: string[] = [];

  for (const contact of cmo) {
    const row = asRecord(contact);
    const userId = String(row?.userId ?? '').trim();
    if (userId && !isOutsideAppointmentUserId(userId)) {
      userIds.push(userId);
    }
  }

  return [...new Set(userIds)];
}

function collectTeamEmails(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const emails = new Set<string>();
  const add = (raw: unknown) => {
    const e = String(raw ?? '').trim();
    if (e.includes('@')) emails.add(e);
  };
  if (Array.isArray(data.contactEmails)) {
    for (const e of data.contactEmails) add(e);
  }
  if (Array.isArray(data.contactPeople)) {
    for (const person of data.contactPeople) {
      const row = asRecord(person);
      if (row) add(row.email);
    }
  }
  return [...emails];
}

export function changesFromProposal(proposal: Record<string, unknown>): {
  changeType: MatchChangeType;
  changes: MatchChangeDetails;
} | null {
  const kickoffAt = String(proposal.kickoffAt ?? '').trim();
  const previousKickoffAt = String(proposal.previousKickoffAt ?? '').trim();
  const venueName = String(proposal.venueName ?? '').trim();
  const previousVenueName = String(proposal.previousVenueName ?? '').trim();
  const venueAddress = String(proposal.venueAddress ?? '').trim();
  const previousVenueAddress = String(
    proposal.previousVenueAddress ?? '',
  ).trim();

  const timeChanged = Boolean(
    kickoffAt && previousKickoffAt && kickoffAt !== previousKickoffAt,
  );
  const venueChanged = Boolean(
    (venueName && previousVenueName && venueName !== previousVenueName) ||
      (venueAddress &&
        previousVenueAddress &&
        venueAddress !== previousVenueAddress),
  );

  if (!timeChanged && !venueChanged) return null;

  const changes: MatchChangeDetails = {};
  if (timeChanged) {
    changes.oldKickoffAt = previousKickoffAt;
    changes.newKickoffAt = kickoffAt;
  }
  if (venueChanged) {
    if (previousVenueName || venueName) {
      changes.oldVenueName = previousVenueName || undefined;
      changes.newVenueName = venueName || undefined;
    }
    if (previousVenueAddress || venueAddress) {
      changes.oldVenueAddress = previousVenueAddress || undefined;
      changes.newVenueAddress = venueAddress || undefined;
    }
  }

  const changeType: MatchChangeType =
    timeChanged && venueChanged ? 'details' : timeChanged ? 'time' : 'venue';
  return { changeType, changes };
}

/** Detect schedule edits from assigner write-back (previous vs next facts). */
export function changesFromScheduleUpdate(input: {
  previousKickoffAt: string;
  previousVenueName: string;
  previousVenueAddress: string;
  kickoffAt: string;
  venueName: string;
  venueAddress: string;
}): {
  changeType: MatchChangeType;
  changes: MatchChangeDetails;
} | null {
  const previousKickoffAt = input.previousKickoffAt.trim();
  const kickoffAt = input.kickoffAt.trim();
  const previousVenueName = input.previousVenueName.trim();
  const venueName = input.venueName.trim();
  const previousVenueAddress = input.previousVenueAddress.trim();
  const venueAddress = input.venueAddress.trim();

  const timeChanged = Boolean(
    kickoffAt && previousKickoffAt && kickoffAt !== previousKickoffAt,
  );
  const venueChanged =
    venueName !== previousVenueName || venueAddress !== previousVenueAddress;

  if (!timeChanged && !venueChanged) return null;

  const changes: MatchChangeDetails = {};
  if (timeChanged) {
    changes.oldKickoffAt = previousKickoffAt;
    changes.newKickoffAt = kickoffAt;
  }
  if (venueChanged) {
    if (previousVenueName || venueName) {
      changes.oldVenueName = previousVenueName || undefined;
      changes.newVenueName = venueName || undefined;
    }
    if (previousVenueAddress || venueAddress) {
      changes.oldVenueAddress = previousVenueAddress || undefined;
      changes.newVenueAddress = venueAddress || undefined;
    }
  }

  const changeType: MatchChangeType =
    timeChanged && venueChanged ? 'details' : timeChanged ? 'time' : 'venue';
  return { changeType, changes };
}

/** Fetch team contact emails. */
async function getTeamContactEmails(
  db: Firestore,
  orgId: string,
  teamId: string,
): Promise<string[]> {
  if (!teamId) return [];
  const teamSnap = await db.doc(`orgs/${orgId}/teams/${teamId}`).get();
  if (!teamSnap.exists) return [];
  return collectTeamEmails(teamSnap.data() as Record<string, unknown>);
}

export type NotifyMatchChangeInput = {
  db: Firestore;
  orgId: string;
  matchId: string;
  changeType: MatchChangeType;
  matchData: MatchData;
  changes: MatchChangeDetails;
};

export type NotifyMatchChangeResult = {
  emailsSent: number;
  crewEmails: number;
  teamEmails: number;
  warnings: string[];
};

/**
 * Send match change notification emails to all assigned crew and team contacts.
 */
export async function notifyMatchChange(
  opts: NotifyMatchChangeInput,
): Promise<NotifyMatchChangeResult> {
  const { db, orgId, matchId, changeType, matchData, changes } = opts;

  const warnings: string[] = [];
  let crewEmailCount = 0;
  let teamEmailCount = 0;
  const matchUrl = matchAppUrl(matchId);
  const matchFacts: MatchEmailFacts = {
    ...matchData,
    id: matchId,
    // Prefer announced status (cancel notifies before crew is cleared on save).
    ...(changes.newStatus ? { status: changes.newStatus } : {}),
  };

  const crewUserIds = extractCrewUserIds(matchData.crew);
  const cmoUserIds = extractCmoUserIds(matchData.cmo);
  const allCrewIds = [...new Set([...crewUserIds, ...cmoUserIds])];

  logger.info('notifyMatchChange start', {
    orgId,
    matchId,
    changeType,
    crewCount: allCrewIds.length,
  });

  for (const uid of allCrewIds) {
    try {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (!userSnap.exists) {
        warnings.push(`Crew user ${uid} not found`);
        continue;
      }

      const email = effectiveContactEmailFromUserData(
        userSnap.data() as Record<string, unknown>,
      );
      if (!email) {
        warnings.push(`Crew user ${uid} has no contact email`);
        continue;
      }

      const emailContent = matchChangeEmailBody({
        changeType,
        match: matchFacts,
        changes,
        recipientType: 'crew',
        matchUrl,
      });

      await enqueueMail(db, {
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        uid,
        event: `match_change_${changeType}`,
      });

      crewEmailCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to send crew notification', { uid, message });
      warnings.push(`Failed to email crew ${uid}: ${message}`);
    }
  }

  const homeEmails = await getTeamContactEmails(
    db,
    orgId,
    String(matchData.homeTeamId ?? ''),
  );
  if (homeEmails.length === 0) {
    warnings.push(
      `Home team ${matchData.homeTeamName} has no contact emails`,
    );
  }

  const awayEmails = await getTeamContactEmails(
    db,
    orgId,
    String(matchData.awayTeamId ?? ''),
  );
  if (awayEmails.length === 0) {
    warnings.push(
      `Away team ${matchData.awayTeamName} has no contact emails`,
    );
  }

  const teamEmails = [...new Set([...homeEmails, ...awayEmails])];
  for (const email of teamEmails) {
    try {
      const emailContent = matchChangeEmailBody({
        changeType,
        match: matchFacts,
        changes,
        recipientType: 'team',
        matchUrl,
      });

      await enqueueMail(db, {
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        event: `match_change_${changeType}_team`,
      });

      teamEmailCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to send team notification', { email, message });
      warnings.push(`Failed to email team ${email}: ${message}`);
    }
  }

  const totalEmails = crewEmailCount + teamEmailCount;

  logger.info('notifyMatchChange complete', {
    orgId,
    matchId,
    changeType,
    emailsSent: totalEmails,
    crewEmails: crewEmailCount,
    teamEmails: teamEmailCount,
    warnings: warnings.length,
  });

  return {
    emailsSent: totalEmails,
    crewEmails: crewEmailCount,
    teamEmails: teamEmailCount,
    warnings,
  };
}
