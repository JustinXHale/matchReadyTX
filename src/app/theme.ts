const SCHEME_STORAGE_KEY = 'rs-theme';

export type ColorScheme = 'light' | 'dark';

export type ThemeMode = ColorScheme;

/** MatchReadyTX is high-contrast-first (PatternFly pf-v6-theme-high-contrast). */
export const HIGH_CONTRAST_ENABLED = true;

export function prefersSystemHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(forced-colors: active)').matches ||
    window.matchMedia('(prefers-contrast: more)').matches
  );
}

export function readStoredScheme(): ColorScheme {
  try {
    const v = localStorage.getItem(SCHEME_STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(scheme: ColorScheme, highContrast = HIGH_CONTRAST_ENABLED): void {
  const root = document.documentElement;
  root.classList.toggle('pf-v6-theme-dark', scheme === 'dark');
  root.classList.toggle('pf-v6-theme-high-contrast', highContrast);
  root.dataset.rsColorScheme = scheme;
  root.dataset.rsHighContrast = highContrast ? 'true' : 'false';
}

export function persistTheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
  } catch {
    /* ignore */
  }
  applyTheme(scheme);
}

export function initTheme(): ColorScheme {
  const scheme = readStoredScheme();
  applyTheme(scheme);
  return scheme;
}

/** Re-apply when OS contrast settings change (PatternFly handbook). */
export function watchSystemContrastPreferences(): void {
  if (typeof window === 'undefined') return;
  const reapply = () => applyTheme(readStoredScheme());
  window.matchMedia('(forced-colors: active)').addEventListener('change', reapply);
  window.matchMedia('(prefers-contrast: more)').addEventListener('change', reapply);
}

// Back-compat aliases
export function readStoredTheme(): ColorScheme {
  return readStoredScheme();
}
