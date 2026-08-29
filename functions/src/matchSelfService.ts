import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { fulfillRaiseHandsOnAssignmentConfirm } from './raiseHandFulfillment';

const CREW_SLOTS = ['mo', 'ar1', 'ar2', 'no4'] as const;
type CrewSlot = (typeof CREW_SLOTS)[number];

export const MATCH_SELF_SERVICE_ACTIONS = [
  'confirm',
  'decline',
  't72_official_yes',
  't72_official_no',
  't72_team_yes',
  't72_team_no',
] as const;

export type MatchSelfServiceAction =
  (typeof MATCH_SELF_SERVICE_ACTIONS)[number];

type CrewRow = Record<string, unknown>;

function isCrewSlot(value: string): value is CrewSlot {
  return (CREW_SLOTS as readonly string[]).includes(value);
}

function slotList(crew: Record<string, unknown>, slot: CrewSlot): CrewRow[] {
  const raw = crew[slot];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is CrewRow => Boolean(x) && typeof x === 'object');
  }
  if (raw && typeof raw === 'object') return [raw as CrewRow];
  return [];
}

function cloneCrew(raw: unknown): Record<CrewSlot, CrewRow[]> {
  const src =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = {
    mo: slotList(src, 'mo').map((row) => ({ ...row })),
    ar1: slotList(src, 'ar1').map((row) => ({ ...row })),
    ar2: slotList(src, 'ar2').map((row) => ({ ...row })),
    no4: slotList(src, 'no4').map((row) => ({ ...row })),
  };
  return out;
}

function crewPeople(list: CrewRow[]): CrewRow[] {
  return list.filter((a) => Boolean(a.userId));
}

function allPeopleConfirmed(crew: Record<CrewSlot, CrewRow[]>): boolean {
  return CREW_SLOTS.every((slot) =>
    crewPeople(crew[slot]).every((a) => a.status === 'confirmed'),
  );
}

function appendHistory(
  row: CrewRow,
  entry: Record<string, unknown>,
): CrewRow {
  const history = Array.isArray(row.history) ? [...row.history] : [];
  history.push(entry);
  return { ...row, history };
}

function findOwnAssignment(
  crew: Record<CrewSlot, CrewRow[]>,
  uid: string,
  slot?: CrewSlot,
  assignmentId?: string,
): { slot: CrewSlot; index: number } | null {
  const slots = slot ? [slot] : [...CREW_SLOTS];
  for (const s of slots) {
    const list = crew[s];
    for (let i = 0; i < list.length; i++) {
      const row = list[i]!;
      if (String(row.userId ?? '') !== uid) continue;
      if (assignmentId && String(row.id ?? '') !== assignmentId) continue;
      return { slot: s, index: i };
    }
  }
  return null;
}

function confirmRow(row: CrewRow, uid: string, at: string): CrewRow {
  return appendHistory(
    {
      ...row,
      status: 'confirmed',
      confirmedAt: at,
    },
    {
      at,
      userId: uid,
      userName: String(row.userName ?? ''),
      action: 'confirmed',
    },
  );
}

function clearRow(
  row: CrewRow,
  uid: string,
  at: string,
  action: 'declined' | 't72_no',
  reason?: string,
): CrewRow {
  return appendHistory(
    {
      ...row,
      userId: null,
      userName: null,
      status: 'empty',
      confirmedAt: null,
    },
    {
      at,
      userId: uid,
      userName: String(row.userName ?? ''),
      action,
      ...(reason ? { reason } : {}),
    },
  );
}

async function assertMember(
  db: Firestore,
  orgId: string,
  uid: string,
): Promise<Record<string, unknown>> {
  const snap = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this org.');
  }
  return (snap.data() ?? {}) as Record<string, unknown>;
}

/**
 * Official confirm/decline and T-72 answers. Admin SDK write — clients cannot
 * patch `crew` on the match doc.
 */
export async function runMatchSelfService(opts: {
  db: Firestore;
  orgId: string;
  uid: string;
  matchId: string;
  action: MatchSelfServiceAction;
  slot?: string;
  assignmentId?: string;
  side?: string;
  reason?: string;
}): Promise<{ ok: true; status: string }> {
  const { db, orgId, uid, matchId, action } = opts;
  const member = await assertMember(db, orgId, uid);
  const roles = Array.isArray(member.roles) ? member.roles.map(String) : [];
  const teamIds = Array.isArray(member.teamIds)
    ? member.teamIds.map(String)
    : [];

  const matchRef = db.doc(`orgs/${orgId}/matches/${matchId}`);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }
  const data = matchSnap.data() ?? {};
  const at = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: at };

  if (action === 't72_team_yes' || action === 't72_team_no') {
    if (!roles.includes('teamAdmin')) {
      throw new HttpsError(
        'permission-denied',
        'Only a Team Admin for this match can answer T-72.',
      );
    }
    const side = opts.side === 'away' ? 'away' : opts.side === 'home' ? 'home' : '';
    if (!side) {
      throw new HttpsError('invalid-argument', 'side must be home or away.');
    }
    const teamId =
      side === 'home'
        ? String(data.homeTeamId ?? '')
        : String(data.awayTeamId ?? '');
    if (!teamId || !teamIds.includes(teamId)) {
      throw new HttpsError(
        'permission-denied',
        'You are not a Team Admin for that side.',
      );
    }
    const answer = action === 't72_team_yes' ? 'yes' : 'no';
    if (side === 'home') patch.t72TeamHome = answer;
    else patch.t72TeamAway = answer;
    if (answer === 'no') {
      patch.status = 'cancelled';
      patch.cancelledAt = at;
    } else {
      const other =
        side === 'home' ? data.t72TeamAway : data.t72TeamHome;
      patch.status =
        other === 'yes' ? 't72_officials_pending' : 't72_team_pending';
    }
    await matchRef.set(patch, { merge: true });
    logger.info('matchSelfService team T-72', { orgId, matchId, uid, action });
    return { ok: true, status: String(patch.status) };
  }

  const slotRaw = String(opts.slot ?? '').trim();
  const slot = isCrewSlot(slotRaw) ? slotRaw : undefined;
  const assignmentId = String(opts.assignmentId ?? '').trim() || undefined;
  const crew = cloneCrew(data.crew);
  const found = findOwnAssignment(crew, uid, slot, assignmentId);
  if (!found) {
    throw new HttpsError(
      'permission-denied',
      'You are not assigned to that crew slot.',
    );
  }

  let status = String(data.status ?? '');
  const row = crew[found.slot][found.index]!;

  if (action === 'confirm') {
    crew[found.slot][found.index] = confirmRow(row, uid, at);
    if (found.slot === 'mo') status = 'mo_confirmed';
    if (
      allPeopleConfirmed(crew) &&
      ['mo_confirmed', 'crew_confirmed', 't72_team_pending', 't72_officials_pending', 'locked_confirmed'].includes(
        status,
      )
    ) {
      status = 'crew_confirmed';
    }
  } else if (action === 'decline' || action === 't72_official_no') {
    const reason = String(opts.reason ?? '').trim().slice(0, 500);
    crew[found.slot][found.index] = clearRow(
      row,
      uid,
      at,
      action === 't72_official_no' ? 't72_no' : 'declined',
      reason || undefined,
    );
    if (crewPeople(crew.mo).length === 0) status = 'needs_reassignment';
  } else if (action === 't72_official_yes') {
    const stillAssigned = CREW_SLOTS.filter(
      (s) => crewPeople(crew[s]).length > 0,
    );
    const othersConfirmed = stillAssigned.every((s) =>
      crewPeople(crew[s]).every(
        (a) => a.status === 'confirmed' || (s === found.slot && a.userId === uid),
      ),
    );
    if (status === 't72_officials_pending' && othersConfirmed) {
      status = 'locked_confirmed';
    }
  } else {
    throw new HttpsError('invalid-argument', 'Unknown action.');
  }

  patch.crew = crew;
  patch.status = status;
  await matchRef.set(patch, { merge: true });

  if (action === 'confirm') {
    await fulfillRaiseHandsOnAssignmentConfirm({
      db,
      orgId,
      matchId,
      confirmedUserId: uid,
      matchData: { ...data, crew, status },
    });
  }

  logger.info('matchSelfService official', { orgId, matchId, uid, action });
  return { ok: true, status };
}
