import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  clearPromotionsFeedCache,
  getPromotionsDb,
  getPromotionsFirebaseApp,
  parsePromotionsFeed,
  promotionsFeedAppId,
  type PromotionItem,
} from './promotionsFeed';

export type PromotionDraft = PromotionItem & {
  active: boolean;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
  targetMode: 'global' | 'apps';
  targetAppIds: string[];
};

export type PromotionsManagerData = {
  drafts: PromotionDraft[];
  publishedItems: PromotionItem[];
  paused: boolean;
  rotationMs: number;
};

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function promotionsAuth() {
  return getAuth(getPromotionsFirebaseApp());
}

export function subscribePromotionsAdminAuth(
  listener: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(promotionsAuth(), listener);
}

export async function signInPromotionsAdmin(): Promise<User> {
  const auth = promotionsAuth();
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutPromotionsAdmin(): Promise<void> {
  await signOut(promotionsAuth());
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalText(value: unknown): string | undefined {
  const result = text(value).trim();
  return result || undefined;
}

function timestampInput(value: unknown): string | undefined {
  if (!(value instanceof Timestamp)) return undefined;
  const date = value.toDate();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function parseDraft(id: string, value: unknown): PromotionDraft {
  const data = objectValue(value);
  const target = objectValue(data.target);
  const mode = target.mode === 'global' ? 'global' : 'apps';
  const appIds = Array.isArray(target.appIds)
    ? target.appIds.filter((item): item is string => typeof item === 'string')
    : [promotionsFeedAppId];

  return {
    id,
    title: text(data.title, 'Untitled promotion'),
    destinationUrl: text(data.destinationUrl),
    backgroundColor: text(data.backgroundColor, '#000000'),
    primaryTextColor: text(data.primaryTextColor, '#CEAA6F'),
    secondaryTextColor: text(data.secondaryTextColor, '#FFFFFF'),
    accentColor: text(data.accentColor, '#CEAA6F'),
    ...(optionalText(data.subtitle) ? { subtitle: optionalText(data.subtitle) } : {}),
    ...(optionalText(data.priceDisplay)
      ? { priceDisplay: optionalText(data.priceDisplay) }
      : {}),
    ...(optionalText(data.priceQualifier)
      ? { priceQualifier: optionalText(data.priceQualifier) }
      : {}),
    ...(optionalText(data.imageUrl) ? { imageUrl: optionalText(data.imageUrl) } : {}),
    ...(optionalText(data.brandLabel)
      ? { brandLabel: optionalText(data.brandLabel) }
      : {}),
    active: data.active !== false,
    sortOrder:
      typeof data.sortOrder === 'number' && Number.isFinite(data.sortOrder)
        ? data.sortOrder
        : 0,
    ...(timestampInput(data.startsAt) ? { startsAt: timestampInput(data.startsAt) } : {}),
    ...(timestampInput(data.endsAt) ? { endsAt: timestampInput(data.endsAt) } : {}),
    targetMode: mode,
    targetAppIds: appIds.length > 0 ? appIds : [promotionsFeedAppId],
  };
}

function optionalTimestamp(value: string | undefined): Timestamp | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

function draftDocument(draft: PromotionDraft) {
  return {
    title: draft.title.trim(),
    subtitle: draft.subtitle?.trim() || '',
    priceDisplay: draft.priceDisplay?.trim() || '',
    priceQualifier: draft.priceQualifier?.trim() || '',
    destinationUrl: draft.destinationUrl.trim(),
    backgroundColor: draft.backgroundColor,
    primaryTextColor: draft.primaryTextColor,
    secondaryTextColor: draft.secondaryTextColor,
    accentColor: draft.accentColor,
    imageUrl: draft.imageUrl?.trim() || '',
    brandLabel: draft.brandLabel?.trim() || '',
    active: draft.active,
    sortOrder: draft.sortOrder,
    startsAt: optionalTimestamp(draft.startsAt),
    endsAt: optionalTimestamp(draft.endsAt),
    target: {
      mode: draft.targetMode,
      appIds: draft.targetMode === 'global' ? [] : draft.targetAppIds,
    },
    updatedAt: serverTimestamp(),
  };
}

export function newPromotionDraft(sortOrder = 0): PromotionDraft {
  return {
    id: `promotion-${Date.now()}`,
    title: 'New promotion',
    destinationUrl: 'https://',
    backgroundColor: '#000000',
    primaryTextColor: '#CEAA6F',
    secondaryTextColor: '#FFFFFF',
    accentColor: '#CEAA6F',
    active: true,
    sortOrder,
    targetMode: 'apps',
    targetAppIds: [promotionsFeedAppId],
  };
}

function uniqueCopyId(sourceId: string, existingIds: Set<string>): string {
  const base = `${sourceId}-copy`;
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function duplicatePromotionDraft(
  source: PromotionDraft,
  existing: PromotionDraft[],
): PromotionDraft {
  return {
    ...source,
    id: uniqueCopyId(source.id, new Set(existing.map((item) => item.id))),
    title: `${source.title} copy`,
    sortOrder: Math.max(-1, ...existing.map((item) => item.sortOrder)) + 1,
  };
}

export function derivePublishedItems(
  drafts: PromotionDraft[],
  appId: string,
  now = new Date(),
): PromotionItem[] {
  return drafts
    .filter((draft) => {
      if (!draft.active) return false;
      if (
        draft.targetMode === 'apps' &&
        !draft.targetAppIds.includes(appId)
      ) {
        return false;
      }
      if (draft.startsAt && new Date(draft.startsAt) > now) return false;
      if (draft.endsAt && new Date(draft.endsAt) <= now) return false;
      return true;
    })
    .sort((first, second) => first.sortOrder - second.sortOrder)
    .map(({ active: _active, sortOrder: _sortOrder, startsAt: _startsAt, endsAt: _endsAt, targetMode: _targetMode, targetAppIds: _targetAppIds, ...item }) => item);
}

export async function loadPromotionsManagerData(): Promise<PromotionsManagerData> {
  const db = getPromotionsDb();
  const [draftSnapshot, feedSnapshot] = await Promise.all([
    getDocs(collection(db, 'adminPromotions')),
    getDoc(doc(db, 'publicFeeds', promotionsFeedAppId)),
  ]);
  const drafts = draftSnapshot.docs
    .map((snapshot) => parseDraft(snapshot.id, snapshot.data()))
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const feed = feedSnapshot.exists()
    ? parsePromotionsFeed(feedSnapshot.data())
    : null;
  return {
    drafts,
    publishedItems: feed?.items || [],
    paused: feed?.paused || false,
    rotationMs: feed?.rotationMs || 7000,
  };
}

export async function savePromotionDraft(draft: PromotionDraft): Promise<void> {
  await setDoc(
    doc(getPromotionsDb(), 'adminPromotions', draft.id),
    draftDocument(draft),
  );
}

export async function removePromotionDraft(id: string): Promise<void> {
  await deleteDoc(doc(getPromotionsDb(), 'adminPromotions', id));
}

export async function importPublishedPromotions(
  items: PromotionItem[],
): Promise<PromotionDraft[]> {
  const drafts = items.map((item, index) => ({
    ...item,
    active: true,
    sortOrder: index,
    targetMode: 'apps' as const,
    targetAppIds: [promotionsFeedAppId],
  }));
  const batch = writeBatch(getPromotionsDb());
  for (const draft of drafts) {
    batch.set(
      doc(getPromotionsDb(), 'adminPromotions', draft.id),
      draftDocument(draft),
    );
  }
  await batch.commit();
  return drafts;
}

export async function saveDraftOrder(drafts: PromotionDraft[]): Promise<void> {
  const batch = writeBatch(getPromotionsDb());
  drafts.forEach((draft, index) => {
    batch.update(doc(getPromotionsDb(), 'adminPromotions', draft.id), {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function publishPromotionsFeed(
  drafts: PromotionDraft[],
  options: { paused: boolean; rotationMs: number },
): Promise<void> {
  const items = derivePublishedItems(drafts, promotionsFeedAppId);
  await setDoc(doc(getPromotionsDb(), 'publicFeeds', promotionsFeedAppId), {
    updatedAt: serverTimestamp(),
    paused: options.paused,
    rotationMs: Math.min(60_000, Math.max(3000, options.rotationMs)),
    items,
  });
  clearPromotionsFeedCache();
}
