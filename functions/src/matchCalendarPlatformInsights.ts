import { HttpsError } from 'firebase-functions/v2/https';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import {
  getInsightsSummary,
  mergeInsightsSummaries,
  type InsightsSummary,
} from './matchCalendarInsightsCore';

export type PlatformMember = {
  uid: string;
  displayName: string;
  email: string | null;
  authCreatedAt: string | null;
  calendarSeenAt: string | null;
  matchCount: number;
  tournamentCount: number;
};

export type PlatformInsightsResult = {
  generatedAt: string;
  memberCount: number;
  members: PlatformMember[];
  insights: InsightsSummary;
};

function parseAllowList(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export type PlatformAdminAllowList = {
  uids?: string;
  emails?: string;
};

export function assertMatchCalendarPlatformAdmin(
  uid: string,
  email: string | undefined,
  allowList: PlatformAdminAllowList = {},
): void {
  const allowedUids = parseAllowList(allowList.uids);
  const allowedEmails = parseAllowList(allowList.emails).map((value) =>
    value.toLowerCase(),
  );

  if (allowedUids.includes(uid)) return;
  if (email && allowedEmails.includes(email.toLowerCase())) return;

  throw new HttpsError('permission-denied', 'Not authorized.');
}

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadUserCalendarData(db: Firestore, uid: string) {
  const [matchesSnap, tournamentsSnap] = await Promise.all([
    db.collection(`users/${uid}/matches`).get(),
    db.collection(`users/${uid}/tournaments`).get(),
  ]);

  const matches = matchesSnap.docs.map((doc) => ({
    id: doc.id,
    ...asRecord(doc.data()),
  }));
  const tournaments = tournamentsSnap.docs.map((doc) => ({
    id: doc.id,
    title: String(asRecord(doc.data()).title ?? ''),
    startDate: String(asRecord(doc.data()).startDate ?? ''),
    endDate: String(asRecord(doc.data()).endDate ?? ''),
    ...asRecord(doc.data()),
  }));

  return { matches, tournaments };
}

async function listCalendarMemberUids(
  auth: Auth,
  db: Firestore,
): Promise<
  Array<{
    uid: string;
    displayName: string;
    email: string | null;
    authCreatedAt: string | null;
  }>
> {
  const members: Array<{
    uid: string;
    displayName: string;
    email: string | null;
    authCreatedAt: string | null;
  }> = [];

  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const uid = user.uid;
      const [settingsSnap, matchCountSnap, tournamentCountSnap] =
        await Promise.all([
          db.doc(`users/${uid}/matchCalendar/settings`).get(),
          db.collection(`users/${uid}/matches`).count().get(),
          db.collection(`users/${uid}/tournaments`).count().get(),
        ]);

      const matchCount = matchCountSnap.data().count;
      const tournamentCount = tournamentCountSnap.data().count;
      const hasCalendar =
        settingsSnap.exists || matchCount > 0 || tournamentCount > 0;
      if (!hasCalendar) continue;

      members.push({
        uid,
        displayName: user.displayName?.trim() || 'Member',
        email: user.email ?? null,
        authCreatedAt: user.metadata.creationTime
          ? new Date(user.metadata.creationTime).toISOString()
          : null,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  members.sort((a, b) => {
    const aTime = a.authCreatedAt ?? '';
    const bTime = b.authCreatedAt ?? '';
    return bTime.localeCompare(aTime);
  });

  return members;
}

export async function runGetMatchCalendarPlatformInsights(
  db: Firestore,
  auth: Auth,
  callerUid: string,
  callerEmail?: string,
  allowList: PlatformAdminAllowList = {},
): Promise<PlatformInsightsResult> {
  assertMatchCalendarPlatformAdmin(callerUid, callerEmail, allowList);

  const authMembers = await listCalendarMemberUids(auth, db);
  const members: PlatformMember[] = [];
  const summaries: InsightsSummary[] = [];

  for (const authMember of authMembers) {
    const [settingsSnap, data] = await Promise.all([
      db.doc(`users/${authMember.uid}/matchCalendar/settings`).get(),
      loadUserCalendarData(db, authMember.uid),
    ]);

    const settings = asRecord(settingsSnap.data());
    const calendarSeenAt =
      asIsoDate(settings.migratedFromLocalAt) ??
      asIsoDate(settings.updatedAt) ??
      asIsoDate(settingsSnap.updateTime);

    members.push({
      uid: authMember.uid,
      displayName: authMember.displayName,
      email: authMember.email,
      authCreatedAt: authMember.authCreatedAt,
      calendarSeenAt,
      matchCount: data.matches.length,
      tournamentCount: data.tournaments.length,
    });

    if (data.matches.length > 0 || data.tournaments.length > 0) {
      summaries.push(getInsightsSummary(data.matches, data.tournaments));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    memberCount: members.length,
    members,
    insights: summaries.length
      ? mergeInsightsSummaries(summaries)
      : getInsightsSummary([], []),
  };
}
