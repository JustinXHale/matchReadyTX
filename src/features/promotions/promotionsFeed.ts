import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import { doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';

const PROMOTIONS_FIREBASE_APP_NAME = 'promotions';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 45 * 60 * 1000;
const DEFAULT_ROTATION_MS = 7000;
const MIN_ROTATION_MS = 3000;
const MAX_ROTATION_MS = 60_000;
const MAX_FEED_ITEMS = 25;

export type PromotionItem = {
  id: string;
  title: string;
  subtitle?: string;
  priceDisplay?: string;
  priceQualifier?: string;
  destinationUrl: string;
  backgroundColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  accentColor: string;
  imageUrl?: string;
  brandLabel?: string;
};

export type PromotionsFeed = {
  paused: boolean;
  rotationMs: number;
  items: PromotionItem[];
};

type PromotionsCache = {
  cachedAt: number;
  feed: PromotionsFeed | null;
};

const promotionsFirebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_PROMOTIONS_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_PROMOTIONS_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_PROMOTIONS_FIREBASE_PROJECT_ID?.trim(),
  storageBucket:
    import.meta.env.VITE_PROMOTIONS_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId:
    import.meta.env.VITE_PROMOTIONS_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_PROMOTIONS_FIREBASE_APP_ID?.trim(),
};

const configuredFeedAppId =
  import.meta.env.VITE_PROMOTIONS_FEED_APP_ID?.trim() || 'matchreadytx';

export const promotionsFeedAppId = /^[A-Za-z0-9_-]+$/.test(
  configuredFeedAppId,
)
  ? configuredFeedAppId
  : 'matchreadytx';

export const isPromotionsConfigured = Boolean(
  import.meta.env.VITE_PROMOTIONS_ENABLED !== 'false' &&
    promotionsFirebaseConfig.apiKey &&
    promotionsFirebaseConfig.projectId &&
    promotionsFirebaseConfig.appId,
);

const cacheKey = `matchreadytx:promotions:${promotionsFeedAppId}:v${CACHE_VERSION}`;

let promotionsApp: FirebaseApp | null = null;
let promotionsDb: Firestore | null = null;
let memoryCache: PromotionsCache | null | undefined;
let inFlight: Promise<PromotionsFeed | null> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result ? result.slice(0, maxLength) : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  const source = boundedString(value, 2048);
  if (!source) return undefined;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeHexColor(value: unknown): string | undefined {
  const source = boundedString(value, 7);
  return source && /^#[0-9A-Fa-f]{6}$/.test(source)
    ? source.toUpperCase()
    : undefined;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return (
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  );
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function accessibleForeground(
  candidate: string,
  background: string,
  minimumRatio: number,
): string {
  if (contrastRatio(candidate, background) >= minimumRatio) return candidate;
  return contrastRatio('#000000', background) >=
    contrastRatio('#FFFFFF', background)
    ? '#000000'
    : '#FFFFFF';
}

function parsePromotionItem(value: unknown): PromotionItem | null {
  if (!isRecord(value)) return null;

  const id = boundedString(value.id, 100);
  const title = boundedString(value.title, 160);
  const destinationUrl = safeHttpsUrl(value.destinationUrl);
  if (!id || !title || !destinationUrl) return null;

  const subtitle = boundedString(value.subtitle, 200);
  const priceDisplay = boundedString(value.priceDisplay, 32);
  const priceQualifier = boundedString(value.priceQualifier, 32);
  const imageUrl = safeHttpsUrl(value.imageUrl);
  const brandLabel = boundedString(value.brandLabel, 100);
  const backgroundColor = safeHexColor(value.backgroundColor) || '#111111';
  const primaryTextColor = accessibleForeground(
    safeHexColor(value.primaryTextColor) || '#FFFFFF',
    backgroundColor,
    4.5,
  );
  const secondaryTextColor = accessibleForeground(
    safeHexColor(value.secondaryTextColor) || '#E5E7EB',
    backgroundColor,
    4.5,
  );
  const accentColor = accessibleForeground(
    safeHexColor(value.accentColor) || primaryTextColor,
    backgroundColor,
    4.5,
  );

  return {
    id,
    title,
    destinationUrl,
    backgroundColor,
    primaryTextColor,
    secondaryTextColor,
    accentColor,
    ...(subtitle ? { subtitle } : {}),
    ...(priceDisplay ? { priceDisplay } : {}),
    ...(priceQualifier ? { priceQualifier } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(brandLabel ? { brandLabel } : {}),
  };
}

/** Parse and constrain the public document before it reaches CSS or navigation. */
export function parsePromotionsFeed(value: unknown): PromotionsFeed | null {
  if (!isRecord(value)) return null;

  const rawRotation =
    typeof value.rotationMs === 'number' && Number.isFinite(value.rotationMs)
      ? Math.round(value.rotationMs)
      : DEFAULT_ROTATION_MS;
  const rotationMs = Math.min(
    MAX_ROTATION_MS,
    Math.max(MIN_ROTATION_MS, rawRotation),
  );
  const items = Array.isArray(value.items)
    ? value.items
        .slice(0, MAX_FEED_ITEMS)
        .map(parsePromotionItem)
        .filter((item): item is PromotionItem => item !== null)
    : [];

  return {
    paused: value.paused === true,
    rotationMs,
    items,
  };
}

function readCache(): PromotionsCache | null {
  if (memoryCache !== undefined) return memoryCache;
  memoryCache = null;
  if (typeof window === 'undefined') return memoryCache;

  try {
    const source = window.localStorage.getItem(cacheKey);
    if (!source) return memoryCache;
    const parsed: unknown = JSON.parse(source);
    if (!isRecord(parsed) || parsed.version !== CACHE_VERSION) return memoryCache;
    if (typeof parsed.cachedAt !== 'number' || !Number.isFinite(parsed.cachedAt)) {
      return memoryCache;
    }
    const feed = parsed.feed === null ? null : parsePromotionsFeed(parsed.feed);
    if (parsed.feed !== null && feed === null) return memoryCache;
    memoryCache = { cachedAt: parsed.cachedAt, feed };
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory cache still works.
  }
  return memoryCache;
}

function writeCache(feed: PromotionsFeed | null): void {
  const next = { cachedAt: Date.now(), feed };
  memoryCache = next;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({ version: CACHE_VERSION, ...next }),
    );
  } catch {
    // Promotions are optional; a blocked or full localStorage must not affect the app.
  }
}

export function clearPromotionsFeedCache(): void {
  memoryCache = undefined;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(cacheKey);
  } catch {
    // Cache invalidation is best-effort in privacy modes.
  }
}

function cacheIsFresh(cache: PromotionsCache | null, now = Date.now()): boolean {
  return Boolean(
    cache && now >= cache.cachedAt && now - cache.cachedAt < CACHE_TTL_MS,
  );
}

export function getFreshCachedPromotionsFeed(): PromotionsFeed | null {
  const cached = readCache();
  return cacheIsFresh(cached) ? cached?.feed || null : null;
}

export function isPromotionsCacheStale(): boolean {
  return !cacheIsFresh(readCache());
}

export function getPromotionsFirebaseApp(): FirebaseApp {
  if (!isPromotionsConfigured) {
    throw new Error(
      'Promotions Firebase is not configured. Check VITE_PROMOTIONS_FIREBASE_*.',
    );
  }
  if (promotionsApp) return promotionsApp;
  promotionsApp =
    getApps().find(
      (candidate) => candidate.name === PROMOTIONS_FIREBASE_APP_NAME,
    ) || initializeApp(promotionsFirebaseConfig, PROMOTIONS_FIREBASE_APP_NAME);
  return promotionsApp;
}

export function getPromotionsDb(): Firestore {
  if (promotionsDb) return promotionsDb;
  promotionsDb = getFirestore(getPromotionsFirebaseApp());
  return promotionsDb;
}

/** At most one feed read is in flight for the process, including React Strict Mode. */
export function loadPromotionsFeed(
  options: { force?: boolean } = {},
): Promise<PromotionsFeed | null> {
  if (!isPromotionsConfigured) return Promise.resolve(null);

  const cached = readCache();
  if (!options.force && cacheIsFresh(cached)) {
    return Promise.resolve(cached?.feed || null);
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const snapshot = await getDoc(
        doc(getPromotionsDb(), 'publicFeeds', promotionsFeedAppId),
      );
      const feed = snapshot.exists()
        ? parsePromotionsFeed(snapshot.data())
        : null;
      writeCache(feed);
      return feed;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
