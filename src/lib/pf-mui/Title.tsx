import { Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const sizeMap: Record<string, 'h1' | 'h2' | 'h3' | 'subtitle1' | 'subtitle2' | 'body2'> = {
  '4xl': 'h1',
  '3xl': 'h1',
  '2xl': 'h1',
  xl: 'h1',
  lg: 'h2',
  md: 'h3',
  sm: 'subtitle1',
  xs: 'body2',
};

export function Title({
  headingLevel = 'h2',
  size = 'lg',
  children,
  className,
  id,
}: {
  headingLevel?: Heading;
  size?: keyof typeof sizeMap | string;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  const classes = [
    'pf-v6-c-title',
    `pf-m-${headingLevel}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Typography
      component={headingLevel}
      variant={sizeMap[size] ?? 'h6'}
      className={classes}
      id={id}
    >
      {children}
    </Typography>
  );
}
