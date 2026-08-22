/** Build number baked in at deploy. Local / unset is 0. */
export function appBuildLabel(): string {
  const raw = (import.meta.env.VITE_APP_BUILD ?? '').trim();
  const n = raw || '0';
  return n.startsWith('v') ? n : `v${n}`;
}
