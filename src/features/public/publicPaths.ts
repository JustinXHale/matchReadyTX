/** Routes reachable without signing in (OAuth homepage, privacy policy, login). */
export const PUBLIC_PATHS = ['/', '/login', '/privacy'] as const;

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}
