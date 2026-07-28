/** Location state for descriptive back navigation on detail screens. */
export type BackNav = {
  to: string;
  label: string;
  /** Optional router state to restore on the destination (nested back). */
  state?: unknown;
};

export function backState(back: BackNav): { back: BackNav } {
  return { back };
}

export function readBackNav(state: unknown): BackNav | null {
  if (!state || typeof state !== 'object') return null;
  const back = (state as { back?: unknown }).back;
  if (!back || typeof back !== 'object') return null;
  const { to, label, state: nested } = back as {
    to?: unknown;
    label?: unknown;
    state?: unknown;
  };
  if (typeof to !== 'string' || typeof label !== 'string') return null;
  if (!to.trim() || !label.trim()) return null;
  return nested !== undefined ? { to, label, state: nested } : { to, label };
}
