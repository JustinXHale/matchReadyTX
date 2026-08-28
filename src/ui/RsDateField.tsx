import { useMemo } from 'react';
import { DatePicker } from '@patternfly/react-core';
import { calendarDateKey } from '@/domain/divisionFilters';
import { IconDateInput } from '@/ui/IconDateInput';

export type RsDateFieldProps = {
  id?: string;
  value: string;
  onChange: (next: string | null) => void;
  'aria-label': string;
  buttonAriaLabel?: string;
  placeholder?: string;
  /**
   * When set, only these YYYY-MM-DD days are selectable (PatternFly calendar).
   * When omitted, uses the native date control (system picker on mobile).
   */
  availableDates?: string[];
  className?: string;
};

/**
 * App date field — native picker for free-form ranges; PatternFly calendar when
 * specific game days must be highlighted/disabled.
 */
export function RsDateField({
  id,
  value,
  onChange,
  'aria-label': ariaLabel,
  buttonAriaLabel = 'Open calendar',
  placeholder = 'YYYY-MM-DD',
  availableDates,
  className = '',
}: RsDateFieldProps) {
  if (availableDates == null) {
    return (
      <IconDateInput
        id={id}
        type="date"
        className={className}
        value={value}
        aria-label={ariaLabel}
        onChange={(_, next) => onChange(next || null)}
      />
    );
  }

  return (
    <RsDatePickerWithAllowlist
      id={id}
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      buttonAriaLabel={buttonAriaLabel}
      placeholder={placeholder}
      availableDates={availableDates}
      className={className}
    />
  );
}

function RsDatePickerWithAllowlist({
  id,
  value,
  onChange,
  'aria-label': ariaLabel,
  buttonAriaLabel,
  placeholder,
  availableDates,
  className,
}: Required<Pick<RsDateFieldProps, 'availableDates' | 'aria-label'>> &
  Pick<
    RsDateFieldProps,
    'id' | 'value' | 'onChange' | 'buttonAriaLabel' | 'placeholder' | 'className'
  >) {
  const availableSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  );

  const validators = useMemo(
    () => [
      (date: Date) =>
        availableSet.has(calendarDateKey(date)) ? '' : 'No games on this date.',
    ],
    [availableSet],
  );

  return (
    <DatePicker
      id={id}
      className={`rs-date-field${className ? ` ${className}` : ''}`}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      buttonAriaLabel={buttonAriaLabel}
      appendTo={() => document.body}
      validators={validators}
      onChange={(_, nextValue, date) => {
        if (!nextValue.trim()) {
          onChange(null);
          return;
        }
        if (!date || Number.isNaN(date.getTime())) return;
        const key = calendarDateKey(date);
        if (availableSet.size > 0 && !availableSet.has(key)) return;
        onChange(key);
      }}
    />
  );
}
