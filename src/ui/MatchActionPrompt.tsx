import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export type MatchActionPromptTone = 'attention' | 'complete' | 'neutral';

type PromptAction = {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  disabled?: boolean;
};

type MatchActionPromptProps = {
  message: ReactNode;
  /** Primary action — link (`to`) and/or button (`onClick`). */
  primaryLabel: string;
  primaryTo?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  tertiaryDisabled?: boolean;
  tone?: MatchActionPromptTone;
  ariaLabel?: string;
};

/**
 * Full-width decision prompt for a match card. Keeping the question and its
 * actions together preserves context while every action retains a 48px target.
 */
export function MatchActionPrompt({
  message,
  primaryLabel,
  primaryTo,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  tertiaryLabel,
  onTertiary,
  tertiaryDisabled = false,
  tone = 'neutral',
  ariaLabel = 'Match action',
}: MatchActionPromptProps) {
  const primaryVariant =
    tone === 'attention' ? 'contained' : ('outlined' as const);

  const actions: PromptAction[] = [
    {
      label: primaryLabel,
      to: primaryTo,
      onClick: onPrimary,
      variant: primaryVariant,
      disabled: primaryDisabled,
    },
  ];
  if (secondaryLabel && onSecondary) {
    actions.push({
      label: secondaryLabel,
      onClick: onSecondary,
      variant: 'outlined',
      color: 'error',
      disabled: secondaryDisabled,
    });
  }
  if (tertiaryLabel && onTertiary) {
    actions.push({
      label: tertiaryLabel,
      onClick: onTertiary,
      variant: 'text',
      color: 'inherit',
      disabled: tertiaryDisabled,
    });
  }

  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        minHeight: 48,
        // Brand chrome stays ink/on-surface; yellow/brown is reserved for
        // status chips and overlap highlights, not prompt copy.
        color: 'text.primary',
      }}
    >
      <Typography component="p" variant="body2" fontWeight={700} sx={{ m: 0 }}>
        {message}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {actions.map((action) =>
          action.to && !action.onClick ? (
            <Button
              key={action.label}
              component={RouterLink}
              to={action.to}
              variant={action.variant}
              color={action.color}
              size="small"
              disabled={action.disabled}
              sx={{ minHeight: 48, minWidth: 48 }}
            >
              {action.label}
            </Button>
          ) : (
            <Button
              key={action.label}
              type="button"
              variant={action.variant}
              color={action.color}
              size="small"
              disabled={action.disabled}
              onClick={action.onClick}
              sx={{ minHeight: 48, minWidth: 48 }}
            >
              {action.label}
            </Button>
          ),
        )}
      </Stack>
    </Box>
  );
}
