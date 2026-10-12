import { Alert as MuiAlert, AlertTitle } from '@mui/material';
import type { ReactNode } from 'react';

const variantMap = {
  default: 'info',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  custom: 'info',
} as const;

export function Alert({
  variant = 'default',
  title,
  children,
  isInline,
  isPlain,
  className,
  'aria-live': ariaLive,
}: {
  variant?: keyof typeof variantMap | string;
  title?: ReactNode;
  children?: ReactNode;
  isInline?: boolean;
  isPlain?: boolean;
  className?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
}) {
  const severity =
    variantMap[variant as keyof typeof variantMap] ?? 'info';
  return (
    <MuiAlert
      severity={severity}
      variant={isPlain || isInline ? 'standard' : 'filled'}
      className={className}
      aria-live={ariaLive}
      sx={{ alignItems: 'flex-start' }}
    >
      {title != null ? <AlertTitle>{title}</AlertTitle> : null}
      {children}
    </MuiAlert>
  );
}
