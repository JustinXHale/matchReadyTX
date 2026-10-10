import { Box, Paper } from '@mui/material';
import { forwardRef, type CSSProperties, type ReactNode } from 'react';

export const Panel = forwardRef<
  HTMLDivElement,
  {
    children?: ReactNode;
    className?: string;
    variant?: string;
    style?: CSSProperties;
  }
>(function Panel({ children, className, variant, style }, ref) {
  void variant;
  return (
    <Paper
      ref={ref}
      className={className}
      elevation={1}
      style={style}
      sx={{
        border: 1,
        borderColor: 'outlineVariant',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {children}
    </Paper>
  );
});

export function PanelMain({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Box className={className} style={style}>
      {children}
    </Box>
  );
}

export function PanelMainBody({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Box className={className} style={style} sx={{ p: 1.5 }}>
      {children}
    </Box>
  );
}
