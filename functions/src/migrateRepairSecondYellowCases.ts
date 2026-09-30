/**
 * One-time repair: card reports / judicial cases where a 2nd yellow was nested
 * on a single yellow (receivedAnotherCard / secondOffense or free-text) without
 * a proper second yellow case + auto red.
 *
 * For recoverable nested secondOffense with color second_yellow_red:
 *   - Keep yellow case for the primary card
 *   - Ensure a second yellow-shaped case exists (from second summary) OR rely on
 *     regenerating cases via casesFromCardReport semantics after splitting
 *   - Prefer re-running casesFromCardReport after synthesizing a second yellow
 *     CardIncident on the stored card report, then rewriting judicial cases for
 *     that reportId.
 *
 * Usage:
 *   cd functions && npm run build && node lib/migrateRepairSecondYellowCases.js
 *   cd functions && npm run build && node lib/migrateRepairSecondYellowCases.js --write
 */

import { type Firestore } from '@google-cloud/firestore';
import { requireCliFirestore } from './cliFirebaseAuth';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const orgIdx = args.indexOf('--org');
const ORG_ID =
  (orgIdx >= 0 ? args[orgIdx + 1] : undefined) ||
  process.env.DEFAULT_ORG_ID ||
  'lonestar';
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'matchreadytx';

type CardIncident = Record<string, unknown>;

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function newIncidentId(): string {
  return `ci_repair_${Math.random().toString(36).slice(2, 9)}`;
}

function looksLikeSecondYellowText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('2nd yellow') ||
    t.includes('second yellow') ||
    t.includes('2nd yellow - red') ||
    (t.includes('second card') && t.includes('red'))
  );
}

/**
 * Minimal port of domain casesFromCardReport for Admin SDK (no Vite aliases).
 */
function casesFromCardReportLocal(
  report: Record<string, unknown>,
  cards: CardIncident[],
  nowIso: string,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const reportId = String(report.id ?? '');
  const matchId = String(report.matchId ?? '');
  const conference = report.conference ?? '';
  const matchDate = report.matchDate ?? null;
  const officialId = report.officialId ?? null;
  const officialName = report.officialName ?? null;

  const pushFromCard = (card: CardIncident, second: boolean) => {
    const secondOffense = card.secondOffense as Record<string, unknown> | undefined;
    const color = second
      ? (secondOffense?.color ?? 'red')
      : (card.color ?? 'yellow');
    const lawIds = second
      ? (Array.isArray(secondOffense?.lawIds) ? secondOffense!.lawIds : [])
      : (Array.isArray(card.lawIds) ? card.lawIds : []);
    const summary = second
      ? String(secondOffense?.summary ?? '')
      : String(card.offenseSummary ?? card.reason ?? '');
    const first = String(card.playerFirstName ?? '').trim();
    const last = String(card.playerLastName ?? '').trim();
    const playerName =
      String(card.playerName ?? '').trim() ||
      `${first} ${last}`.trim() ||
      (card.playerJersey ? `#${card.playerJersey}` : '');
    const incidentId = String(card.id ?? '');
    const id = second ? `${incidentId}_2` : incidentId;
    const hearing = color === 'red' || color === 'second_yellow_red';
    out.push({
      id,
      reportId,
      incidentId,
      matchId,
      conference,
      color,
      playerFirstName: first,
      playerLastName: last,
      playerName,
      playerJersey: card.playerJersey ?? null,
      teamId: card.teamId ?? '',
      teamName: card.teamName ?? '',
      lawIds,
      offenseSummary: summary,
      matchDate,
      officialId,
      officialName,
      status: hearing ? 'pending' : 'recorded',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  };

  for (const card of cards) {
    pushFromCard(card, false);
    if (card.receivedAnotherCard && card.secondOffense) {
      pushFromCard(card, true);
    }
  }

  const yellows = cards.filter((c) => c.color === 'yellow');
  const seen = new Set<string>();
  for (let i = 0; i < yellows.length; i++) {
    for (let j = i + 1; j < yellows.length; j++) {
      const a = yellows[i]!;
      const b = yellows[j]!;
      const jerseyA = String(a.playerJersey ?? '').trim();
      const jerseyB = String(b.playerJersey ?? '').trim();
      const nameA = String(a.playerName ?? '')
        .trim()
        .toLowerCase();
      const nameB = String(b.playerName ?? '')
        .trim()
        .toLowerCase();
      const sameTeam =
        !a.teamId || !b.teamId || String(a.teamId) === String(b.teamId);
      const samePlayer =
        sameTeam &&
        ((jerseyA && jerseyB && jerseyA === jerseyB) ||
          (nameA && nameB && nameA === nameB));
      if (!samePlayer) continue;
      const ids = [String(a.id), String(b.id)].sort();
      const key = ids.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const already = out.some(
        (c) =>
          (c.incidentId === a.id || c.incidentId === b.id) &&
          (c.color === 'red' || c.color === 'second_yellow_red'),
      );
      if (already) continue;
      out.push({
        id: `${ids[0]}_${ids[1]}_syr`,
        reportId,
        incidentId: ids[1],
        matchId,
        conference,
        color: 'second_yellow_red',
        playerFirstName: a.playerFirstName ?? '',
        playerLastName: a.playerLastName ?? '',
        playerName: a.playerName ?? '',
        playerJersey: a.playerJersey ?? b.playerJersey ?? null,
        teamId: a.teamId ?? b.teamId ?? '',
        teamName: a.teamName ?? b.teamName ?? '',
        lawIds: [
          ...new Set([
            ...(Array.isArray(a.lawIds) ? a.lawIds : []),
            ...(Array.isArray(b.lawIds) ? b.lawIds : []),
          ]),
        ],
        offenseSummary:
          '2nd yellow — send-off. Automatic red from two yellow cards in this match.',
        matchDate,
        officialId,
        officialName,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        linkedCaseIds: ids,
        sourceCardIds: ids,
      });
    }
  }

  return out;
}

function splitNestedSecondIntoTwoYellows(cards: CardIncident[]): {
  cards: CardIncident[];
  changed: boolean;
  flagged: string[];
} {
  const flagged: string[] = [];
  let changed = false;
  const next: CardIncident[] = [];
  for (const card of cards) {
    const second = card.secondOffense as Record<string, unknown> | undefined;
    const nested =
      card.receivedAnotherCard === true &&
      second &&
      (second.color === 'second_yellow_red' || second.color === 'red');
    const freeText = looksLikeSecondYellowText(
      String(card.additionalInfoPrivate ?? card.offenseSummary ?? ''),
    );

    if (nested) {
      const secondYellow = omitUndefined({
        id: newIncidentId(),
        color: 'yellow',
        playerName: card.playerName,
        playerFirstName: card.playerFirstName,
        playerLastName: card.playerLastName,
        playerJersey: card.playerJersey,
        playerPosition: card.playerPosition,
        teamId: card.teamId,
        teamName: card.teamName,
        minute: second.approximateTime ?? '',
        reason: String(second.summary ?? ''),
        lawIds: Array.isArray(second.lawIds) ? second.lawIds : [],
        offenseSummary: String(second.summary ?? ''),
        receivedAnotherCard: false,
      });
      // Drop nested secondOffense entirely — Firestore rejects undefined values.
      const { secondOffense: _drop, ...rest } = card;
      next.push(
        omitUndefined({
          ...rest,
          receivedAnotherCard: false,
        }),
      );
      next.push(secondYellow);
      changed = true;
      continue;
    }

    if (freeText && card.color === 'yellow') {
      flagged.push(String(card.id));
    }
    next.push(card);
  }
  return { cards: next, changed, flagged };
}

async function main(): Promise<void> {
  const db = requireCliFirestore(PROJECT_ID);
  console.log(`Org ${ORG_ID} · ${WRITE ? 'WRITE' : 'DRY-RUN'}`);

  const reports = await db.collection(`orgs/${ORG_ID}/cardReports`).get();
  let repaired = 0;
  const manual: string[] = [];

  for (const doc of reports.docs) {
    const data = doc.data();
    if (data.status !== 'submitted') continue;
    const cards = Array.isArray(data.cards) ? (data.cards as CardIncident[]) : [];
    if (!cards.length) continue;

    const { cards: nextCards, changed, flagged } = splitNestedSecondIntoTwoYellows(
      cards,
    );
    for (const id of flagged) {
      manual.push(`${doc.id} / card ${id}`);
    }
    if (!changed) continue;

    repaired += 1;
    console.log(`Report ${doc.id}: split nested 2nd yellow → two yellows`);

    if (!WRITE) continue;

    const nowIso = new Date().toISOString();
    await doc.ref.set(
      {
        cards: nextCards,
        updatedAt: nowIso,
      },
      { merge: true },
    );

    const reportPayload = { ...data, id: doc.id, cards: nextCards };
    const cases = casesFromCardReportLocal(reportPayload, nextCards, nowIso);

    const existing = await db
      .collection(`orgs/${ORG_ID}/judicialCases`)
      .where('reportId', '==', doc.id)
      .get();
    let batch = db.batch();
    let ops = 0;
    for (const old of existing.docs) {
      batch.delete(old.ref);
      ops += 1;
    }
    for (const c of cases) {
      batch.set(
        db.doc(`orgs/${ORG_ID}/judicialCases/${String(c.id)}`),
        omitUndefined({
          ...c,
          orgId: ORG_ID,
          updatedAt: nowIso,
        }),
        { merge: true },
      );
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops) await batch.commit();
  }

  console.log(`\nReports repaired: ${repaired}`);
  if (manual.length) {
    console.log(
      `\nNeeds manual review (free-text second card, no structured secondOffense):`,
    );
    for (const row of manual) console.log(`  ${row}`);
  }
  if (!WRITE) console.log('\nDry-run only. Re-run with --write to apply.');
  else console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
