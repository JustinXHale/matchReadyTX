import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { persistTheme, type ThemeMode } from '@/app/theme';

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    document.documentElement.classList.contains('pf-v6-theme-dark')
      ? 'dark'
      : 'light',
  );

  const toggle = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className={['rs-theme-toggle', className].filter(Boolean).join(' ')}
      onClick={toggle}
      aria-label={
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      }
    >
      <FontAwesomeIcon
        icon={theme === 'dark' ? faSun : faMoon}
        aria-hidden
      />
    </button>
  );
}
