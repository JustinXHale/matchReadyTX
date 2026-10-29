import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/theme-high-contrast.css';
import '@/styles/shell/index.css';
import '@/features/promotions/promotions.css';
import { AppRouter } from '@/app/AppRouter';
import { initTheme, watchSystemContrastPreferences } from '@/app/theme';
import { MuiThemeProvider } from '@/theme/MuiThemeProvider';
import { AppFeedbackProvider } from '@/app/feedback/AppFeedback';

document.documentElement.classList.add('rs-theme');
initTheme();
watchSystemContrastPreferences();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MuiThemeProvider>
      <AppFeedbackProvider>
        <AppRouter />
      </AppFeedbackProvider>
    </MuiThemeProvider>
  </StrictMode>,
);
