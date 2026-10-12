import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from '@patternfly/react-core';

/** Subset of HTML date-like types that PatternFly TextInput accepts. */
type DateLikeType = 'date' | 'time' | 'datetime-local' | 'month';

export type IconDateInputProps = Omit<TextInputProps, 'type' | 'customIcon'> & {
  type?: DateLikeType;
};

/**
 * Shared native date/time field. The browser owns the single picker affordance,
 * avoiding a custom icon being rendered beside the platform icon.
 */
export const IconDateInput = forwardRef<HTMLInputElement, IconDateInputProps>(
  function IconDateInput({ type = 'date', className, ...rest }, ref) {
    return (
      <div className={`rs-icon-field${className ? ` ${className}` : ''}`}>
        <TextInput
          type={type}
          className="rs-icon-field__control"
          ref={ref}
          {...rest}
        />
      </div>
    );
  },
);
