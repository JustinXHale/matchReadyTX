import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@patternfly/react-core/dist/styles/base.css';
import '@/styles/tokens.css';
import { AppRouter } from '@/app/AppRouter';

document.documentElement.classList.add('rs-theme');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
