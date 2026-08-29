import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { enqueueMail } from './sendMail';

const CREW_SLOTS = ['mo', 'ar1', 'ar2', 'no4'] as const;
type CrewSlot = (typeof CREW_SLOTS)[number];
type RequestableSlot = CrewSlot | 'cmo';

const MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON =
  'Match assignment has been fulfilled';

type CrewRow = Record<string, unknown>;

type GameRequestRow = {
  id: string;
  userId: string;
  preferredSlots: RequestableSlot[];
};

function slotList(crew: Record<string, unknown>, slot: CrewSlot): CrewRow[] {
  const raw = crew[slot];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is CrewRow => Boolean(x) && typeof x === 'object');
  }
  if (raw && typeof raw === 'object') return [raw as CrewRow];
  return [];
}

function crewPeople(list: CrewRow[]): CrewRow[] {
  return list.filter((a) => Boolean(a.userId));
}

function emptyCrewBlocks(list: CrewRow[]): CrewRow[] {
  return list.filter((a) => !a.userId);
}

function normalizeRequestableSlots(
  slots: unknown,
  legacy?: unknown,
): RequestableSlot[] {
  const out: RequestableSlot[] = [];
  const seen = new Set<RequestableSlot>();
  const add = (slot: unknown) => {
    if (
      slot !== 'mo' &&
      slot !== 'ar1' &&
      slot !== 'ar2' &&
      slot !== 'no4' &&
      slot !== 'cmo'
    ) {
      return;
    }
    if (seen.has(slot)) return;
    seen.add(slot);
    out.push(slot);
  };
  if (Array.isArray(slots)) {
    for (const slot of slots) add(slot);
  }
  add(legacy);
  return out;
}

function openRequestSlots(
  crew: Record<string, unknown>,
  cmo: unknown,
  status: string,
): RequestableSlot[] {
  const open: RequestableSlot[] = [];
  for (const slot of CREW_SLOTS) {
    if (emptyCrewBlocks(slotList(crew, slot)).length > 0) {
      open.push(slot);
    }
  }
  if (
    status !== 'draft' &&
    status !== 'cancelled' &&
    Array.isArray(cmo) &&
    cmo.some((c) => c && typeof c === 'object' && !(c as CrewRow).userId)
  ) {
    open.push('cmo');
  }
  return open;
}

function isMatchFilled(
  crew: Record<string, unknown>,
  cmo: unknown,
  status: string,
): boolean {
  return openRequestSlots(crew, cmo, status).length === 0;
}

function preferredSlotIsFilled(
  crew: Record<string, unknown>,
  cmo: unknown,
  slot: RequestableSlot,
): boolean {
  if (slot === 'cmo') {
    if (!Array.isArray(cmo) || cmo.length === 0) return true;
    return cmo.every(
      (c) => c && typeof c === 'object' && Boolean((c as CrewRow).userId),
    );
  }
  const blocks = slotList(crew, slot);
  if (blocks.length === 0) return true;
  return emptyCrewBlocks(blocks).length === 0;
}

function isPendingRequestActive(
  matchData: Record<string, unknown>,
  request: GameRequestRow,
  nowMs = Date.now(),
): boolean {
  const kickoffAt = String(matchData.kickoffAt ?? '');
  if (!kickoffAt || new Date(kickoffAt).getTime() <= nowMs) return false;
  const status = String(matchData.status ?? '');
  if (status === 'cancelled' || status === 'postponed') return false;
  const crew =
    matchData.crew && typeof matchData.crew === 'object'
      ? (matchData.crew as Record<string, unknown>)
      : {};
  if (isMatchFilled(crew, matchData.cmo, status)) return false;
  const prefs = request.preferredSlots;
  if (prefs.length > 0) {
    const anyStillOpen = prefs.some(
      (s) => !preferredSlotIsFilled(crew, matchData.cmo, s),
    );
    if (!anyStillOpen) return false;
  }
  return true;
}

function raiseHandsToFulfill(
  matchData: Record<string, unknown>,
  requests: GameRequestRow[],
  confirmedUserId: string,
): { approveIds: string[]; declineIds: string[] } {
  const approveIds: string[] = [];
  const declineIds: string[] = [];
  for (const req of requests) {
    if (req.userId === confirmedUserId) {
      approveIds.push(req.id);
      continue;
    }
    if (!isPendingRequestActive(matchData, req)) {
      declineIds.push(req.id);
    }
  }
  return { approveIds, declineIds };
}

/** Close stale raise-hands after an official confirms their crew slot. */
export async function fulfillRaiseHandsOnAssignmentConfirm(opts: {
  db: Firestore;
  orgId: string;
  matchId: string;
  confirmedUserId: string;
  matchData: Record<string, unknown>;
}): Promise<void> {
  const { db, orgId, matchId, confirmedUserId, matchData } = opts;
  const requestsSnap = await db
    .collection(`orgs/${orgId}/matches/${matchId}/gameRequests`)
    .where('status', '==', 'pending')
    .get();
  if (requestsSnap.empty) return;

  const pending: GameRequestRow[] = requestsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: String(data.userId ?? ''),
      preferredSlots: normalizeRequestableSlots(
        data.preferredSlots,
        data.preferredSlot,
      ),
    };
  });

  const { approveIds, declineIds } = raiseHandsToFulfill(
    matchData,
    pending,
    confirmedUserId,
  );
  if (approveIds.length === 0 && declineIds.length === 0) return;

  const at = new Date().toISOString();
  const batch = db.batch();
  const notifyUserIds: string[] = [];

  for (const requestId of approveIds) {
    batch.update(
      db.doc(`orgs/${orgId}/matches/${matchId}/gameRequests/${requestId}`),
      { status: 'approved', updatedAt: at },
    );
  }
  for (const requestId of declineIds) {
    batch.update(
      db.doc(`orgs/${orgId}/matches/${matchId}/gameRequests/${requestId}`),
      {
        status: 'declined',
        declineReason: MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON,
        updatedAt: at,
      },
    );
    const req = pending.find((r) => r.id === requestId);
    if (req?.userId) notifyUserIds.push(req.userId);
  }

  await batch.commit();

  const subject = 'Game request declined';
  const body = MATCH_ASSIGNMENT_FULFILLED_DECLINE_REASON;
  for (const uid of [...new Set(notifyUserIds)]) {
    try {
      const userSnap = await db.doc(`users/${uid}`).get();
      const email = String(userSnap.data()?.email ?? '').trim();
      if (!email) continue;
      await enqueueMail(opts.db, {
        to: email,
        subject,
        text: body,
        uid,
        event: 'game_request_declined',
      });
    } catch (err) {
      logger.warn('raise-hand fulfillment notify failed', { uid, err });
    }
  }

  logger.info('raise-hand fulfillment on confirm', {
    orgId,
    matchId,
    approved: approveIds.length,
    declined: declineIds.length,
  });
}
