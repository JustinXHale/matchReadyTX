import { useCallback } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';

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

/** True when the browser history stack can pop within this SPA session. */
export function canPopAppHistory(): boolean {
  if (typeof window === 'undefined') return false;
  const idx = window.history.state?.idx;
  return typeof idx === 'number' && idx > 0;
}

export function appBackLabel(fromState: unknown, fallback: BackNav): string {
  if (canPopAppHistory()) return 'Back';
  const back = readBackNav(fromState) ?? fallback;
  return `Back to ${back.label}`;
}

export function goAppBack(
  navigate: NavigateFunction,
  options: { fallback: BackNav; fromState?: unknown },
): void {
  if (canPopAppHistory()) {
    navigate(-1);
    return;
  }
  const back = readBackNav(options.fromState) ?? options.fallback;
  navigate(
    back.to,
    back.state !== undefined ? { state: back.state } : undefined,
  );
}

/** History-first back with labeled fallback for deep links and refresh. */
export function useAppBack(fallback: BackNav) {
  const navigate = useNavigate();
  const location = useLocation();
  const backLabel = appBackLabel(location.state, fallback);
  const goBack = useCallback(() => {
    goAppBack(navigate, { fallback, fromState: location.state });
  }, [navigate, fallback, location.state]);
  return { goBack, backLabel };
}
