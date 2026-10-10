import {
  Button as MuiButton,
  CircularProgress,
  type ButtonProps as MuiButtonProps,
} from '@mui/material';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export type PfButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'plain'
  | 'control';

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'color'
> & {
  variant?: PfButtonVariant;
  isDisabled?: boolean;
  isAriaDisabled?: boolean;
  isInline?: boolean;
  isBlock?: boolean;
  isDanger?: boolean;
  isLoading?: boolean;
  size?: 'default' | 'sm' | 'lg' | string;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end' | 'left' | 'right';
  ouiaId?: string;
  component?: MuiButtonProps['component'];
  to?: string;
  children?: ReactNode;
};

function mapVariant(
  variant: PfButtonVariant | undefined,
  isDanger?: boolean,
): Pick<MuiButtonProps, 'variant' | 'color'> {
  if (isDanger || variant === 'danger') {
    return {
      variant: variant === 'link' || variant === 'plain' ? 'text' : 'contained',
      color: 'error',
    };
  }
  switch (variant) {
    case 'secondary':
    case 'tertiary':
    case 'control':
      return { variant: 'outlined', color: 'primary' };
    case 'warning':
      return { variant: 'contained', color: 'warning' };
    case 'link':
    case 'plain':
      return { variant: 'text', color: 'primary' };
    case 'primary':
    default:
      return { variant: 'contained', color: 'primary' };
  }
}

/** Legacy PatternFly classes so existing brand CSS keeps matching. */
function pfButtonClasses(
  variant: PfButtonVariant | undefined,
  isDanger: boolean | undefined,
  isAriaDisabled: boolean | undefined,
  className: string | undefined,
): string {
  const mod =
    isDanger || variant === 'danger'
      ? 'pf-m-danger'
      : variant === 'secondary' || variant === 'tertiary' || variant === 'control'
        ? 'pf-m-secondary'
        : variant === 'link'
          ? 'pf-m-link'
          : variant === 'plain'
            ? 'pf-m-plain'
            : variant === 'warning'
              ? 'pf-m-warning'
              : 'pf-m-primary';
  return [
    'pf-v6-c-button',
    mod,
    isAriaDisabled ? 'pf-m-aria-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      isDisabled,
      isAriaDisabled,
      disabled,
      isBlock,
      isDanger,
      isLoading,
      size,
      icon,
      iconPosition = 'start',
      children,
      className,
      ouiaId,
      type = 'button',
      isInline: _isInline,
      ...rest
    },
    ref,
  ) {
    void _isInline;
    const mapped = mapVariant(variant, isDanger);
    const startIcon = isLoading ? (
      <CircularProgress color="inherit" size={18} />
    ) : icon && (iconPosition === 'start' || iconPosition === 'left') ? (
      icon
    ) : undefined;
    const endIcon =
      !isLoading &&
      icon &&
      (iconPosition === 'end' || iconPosition === 'right')
        ? icon
        : undefined;

    return (
      <MuiButton
        ref={ref}
        type={type}
        variant={mapped.variant}
        color={mapped.color}
        disabled={Boolean(isDisabled ?? disabled) || Boolean(isLoading)}
        aria-disabled={isAriaDisabled || undefined}
        startIcon={startIcon}
        endIcon={endIcon}
        fullWidth={isBlock}
        className={pfButtonClasses(variant, isDanger, isAriaDisabled, className)}
        data-ouia-component-id={ouiaId}
        size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium'}
        sx={{
          minHeight: 48,
          ...(variant === 'plain' ? { minWidth: 48, padding: 1 } : null),
        }}
        {...(rest as MuiButtonProps)}
      >
        {children}
      </MuiButton>
    );
  },
);
