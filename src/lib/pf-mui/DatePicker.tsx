import { TextField } from '@mui/material';
import type { ChangeEvent } from 'react';

/**
 * PatternFly DatePicker stand-in: native date input + optional validators.
 * Calendar popover of PF is replaced by the platform date picker (better on mobile).
 */
export function DatePicker({
  id,
  value = '',
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  buttonAriaLabel,
  className,
  validators,
}: {
  id?: string;
  value?: string;
  onChange?: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | null,
    value: string,
    date?: Date,
  ) => void;
  placeholder?: string;
  'aria-label'?: string;
  buttonAriaLabel?: string;
  className?: string;
  appendTo?: () => HTMLElement;
  validators?: Array<(date: Date) => string>;
}) {
  void buttonAriaLabel;
  void placeholder;

  return (
    <TextField
      id={id}
      type="date"
      fullWidth
      size="small"
      className={['pf-v6-c-form-control', 'pf-v6-c-date-picker', className]
        .filter(Boolean)
        .join(' ')}
      value={value}
      aria-label={ariaLabel}
      InputLabelProps={{ shrink: true }}
      sx={{ minHeight: 48, '& .MuiInputBase-root': { minHeight: 48 } }}
      onChange={(e) => {
        const next = e.target.value;
        if (!next.trim()) {
          onChange?.(e, '', undefined);
          return;
        }
        const date = new Date(`${next}T12:00:00`);
        if (Number.isNaN(date.getTime())) {
          onChange?.(e, next, undefined);
          return;
        }
        if (validators?.length) {
          const msg = validators.map((v) => v(date)).find(Boolean);
          if (msg) return;
        }
        onChange?.(e, next, date);
      }}
    />
  );
}
