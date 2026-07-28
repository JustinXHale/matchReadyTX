/** URL helpers for the standalone `/demo` showcase (seed data, not Firebase auth). */

export const DEMO_PREFIX = '/demo';

const AUTH_PATHS = new Set(['/login']);

export function isDemoPath(pathname: string): boolean {
  return pathname === DEMO_PREFIX || pathname.startsWith(`${DEMO_PREFIX}/`);
}

export function stripDemoPrefix(pathname: string): string {
  if (pathname === DEMO_PREFIX) return '/';
  if (pathname.startsWith(`${DEMO_PREFIX}/`)) {
    const rest = pathname.slice(DEMO_PREFIX.length);
    return rest.length > 0 ? rest : '/';
  }
  return pathname;
}

export function withDemoPrefix(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (isDemoPath(p)) return p;
  if (p === '/') return DEMO_PREFIX;
  return `${DEMO_PREFIX}${p}`;
}

/** Paths that should not be rewritten into `/demo` while showcase mode is on. */
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.has(pathname);
}
