import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createMatchReadyTheme } from '@/theme/m3Theme';
import { readStoredScheme, type ColorScheme } from '@/app/theme';

function schemeFromDocument(): ColorScheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('pf-v6-theme-dark')
    ? 'dark'
    : 'light';
}

/**
 * Syncs MUI createTheme with the existing MatchReadyTX light/dark toggle
 * (`pf-v6-theme-dark` on <html>).
 */
export function MuiThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorScheme>(
    () => schemeFromDocument() || readStoredScheme(),
  );

  useEffect(() => {
    setMode(schemeFromDocument());
    const root = document.documentElement;
    const obs = new MutationObserver(() => setMode(schemeFromDocument()));
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const theme = useMemo(() => createMatchReadyTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
