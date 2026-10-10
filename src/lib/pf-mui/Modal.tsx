import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import type { ReactNode } from 'react';

export const ModalVariant = {
  small: 'small',
  medium: 'medium',
  large: 'large',
  default: 'default',
} as const;

export type ModalVariantType =
  (typeof ModalVariant)[keyof typeof ModalVariant];

const widthMap: Record<string, number | string> = {
  small: 480,
  medium: 720,
  large: 960,
  default: 720,
};

export function Modal({
  isOpen,
  onClose,
  variant = 'default',
  children,
  className,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  variant?: ModalVariantType | string;
  children?: ReactNode;
  className?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={() => onClose?.()}
      className={className}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      fullWidth
      maxWidth={false}
      PaperProps={{
        className: 'pf-v6-c-modal-box',
        sx: {
          width: '100%',
          maxWidth: widthMap[variant] ?? 720,
          m: 2,
          borderRadius: 2,
        },
      }}
    >
      {children}
    </Dialog>
  );
}

export function ModalHeader({
  title,
  labelId,
  descriptionId,
  descriptor,
  children,
  onClose,
  className,
}: {
  title?: ReactNode;
  labelId?: string;
  descriptionId?: string;
  descriptor?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <DialogTitle
      id={labelId}
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1,
        pr: onClose ? 1 : 3,
      }}
    >
      <span>
        {title}
        {descriptor ? (
          <span id={descriptionId} style={{ display: 'block' }}>
            {descriptor}
          </span>
        ) : null}
        {children}
      </span>
      {onClose ? (
        <IconButton aria-label="Close" onClick={onClose} size="large">
          ×
        </IconButton>
      ) : null}
    </DialogTitle>
  );
}

export function ModalBody({
  children,
  className,
  id,
}: {
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <DialogContent
      id={id}
      className={['pf-v6-c-modal-box__body', className].filter(Boolean).join(' ')}
      dividers
    >
      {children}
    </DialogContent>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <DialogActions className={className} sx={{ px: 3, py: 2, gap: 1 }}>
      {children}
    </DialogActions>
  );
}
