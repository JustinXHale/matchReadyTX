import { Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const sizeMap: Record<string, 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body2'> = {
  '4xl': 'h3',
  '3xl': 'h4',
  '2xl': 'h5',
  xl: 'h5',
  lg: 'h6',
  md: 'subtitle1',
  sm: 'subtitle2',
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
      fontWeight={700}
    >
      {children}
    </Typography>
  );
}
