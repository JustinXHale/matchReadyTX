/**
 * Public web origin for deep links in outbound email.
 * Prefer VITE_APP_ORIGIN in production (e.g. https://matchreadytx.app).
 * Falls back to the current tab origin when composing from the client.
 */
export function appOrigin(): string {
  const fromEnv = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/** Absolute URL to a match detail page (auth may still be required). */
export function matchAppUrl(matchId: string): string {
  const origin = appOrigin();
  const path = `/matches/${encodeURIComponent(matchId)}`;
  return origin ? `${origin}${path}` : path;
}

/**
 * Safe in-app path for post-login redirect (`?next=`).
 * Only same-origin relative paths; rejects protocol-relative / external URLs.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  if (path.includes('://')) return null;
  return path;
}
