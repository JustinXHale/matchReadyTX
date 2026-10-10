import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function EmptyState({
  titleText,
  headingLevel = 'h3',
  children,
  className,
}: {
  titleText?: ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Box
      className={className}
      role="status"
      sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'outlineVariant',
        borderRadius: 2,
      }}
    >
      <Stack spacing={1} alignItems="center">
        {titleText != null ? (
          <Typography component={headingLevel} variant="h6" fontWeight={700}>
            {titleText}
          </Typography>
        ) : null}
        {children}
      </Stack>
    </Box>
  );
}

export function EmptyStateBody({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Typography
      className={className}
      variant="body2"
      color="text.secondary"
      component="div"
    >
      {children}
    </Typography>
  );
}
