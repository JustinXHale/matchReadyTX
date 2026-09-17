import { gameRequestPreferredSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  type GameRequest,
  type Match,
  type RaiseHandInterestRecord,
  type RequestableSlot,
} from '@/domain/types';

export function raiseHandInterestFromRequest(
  request: GameRequest,
  resolvedAt?: string,
): RaiseHandInterestRecord {
  return {
    requestId: request.id,
    userId: request.userId,
    userName: request.userName,
    preferredSlots: gameRequestPreferredSlots(request),
    note: request.note,
    status: request.status,
    requestedAt: request.createdAt,
    resolvedAt:
      request.status === 'pending'
        ? undefined
        : (resolvedAt ?? new Date().toISOString()),
    declineReason: request.declineReason,
  };
}

/** Merge one raise-hand row onto the match audit list. */
export function syncRaiseHandInterestOnMatch(
  match: Match,
  request: GameRequest,
  resolvedAt?: string,
): Match {
  const record = raiseHandInterestFromRequest(request, resolvedAt);
  const existing = match.raiseHandInterest ?? [];
  const idx = existing.findIndex((r) => r.requestId === record.requestId);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = { ...next[idx], ...record };
    return { ...match, raiseHandInterest: next };
  }
  return { ...match, raiseHandInterest: [...existing, record] };
}

export function applyRaiseHandInterestBatch(
  match: Match,
  requests: GameRequest[],
  resolvedAt?: string,
): Match {
  return requests.reduce(
    (m, req) => syncRaiseHandInterestOnMatch(m, req, resolvedAt),
    match,
  );
}

export function updateRaiseHandInterestContent(
  match: Match,
  requestId: string,
  preferredSlots: RequestableSlot[],
  note?: string,
): Match {
  const list = match.raiseHandInterest ?? [];
  if (list.length === 0) return match;
  return {
    ...match,
    raiseHandInterest: list.map((r) =>
      r.requestId === requestId
        ? {
            ...r,
            preferredSlots,
            note: note?.trim() || undefined,
          }
        : r,
    ),
  };
}

export function sortedRaiseHandInterest(
  match: Match,
): RaiseHandInterestRecord[] {
  return [...(match.raiseHandInterest ?? [])].sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
}

export function formatRaiseHandInterestSlots(
  record: RaiseHandInterestRecord,
): string {
  if (record.preferredSlots.length === 0) return 'TBD';
  return record.preferredSlots
    .map((s) => REQUESTABLE_SLOT_SHORT[s])
    .join(', ');
}

export function raiseHandInterestStatusLabel(
  record: RaiseHandInterestRecord,
): string {
  if (record.status === 'approved') return 'Approved';
  if (record.status === 'declined') return 'Declined';
  return 'Pending';
}
