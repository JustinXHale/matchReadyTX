import { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faClock } from '@fortawesome/free-solid-svg-icons';
import { TextInput, type TextInputProps } from '@patternfly/react-core';

type DateLikeType = 'date' | 'time' | 'datetime-local' | 'month' | 'week';

export type IconDateInputProps = Omit<TextInputProps, 'type' | 'customIcon'> & {
  type?: DateLikeType;
};

/**
 * Date/time field with a leading calendar (or clock) icon — same idea as TO3’s
 * Date & Time row: explicit icon in the control, not the native picker glyph.
 */
export const IconDateInput = forwardRef<HTMLInputElement, IconDateInputProps>(
  function IconDateInput({ type = 'date', className, ...rest }, ref) {
    const icon = type === 'time' ? faClock : faCalendar;
    return (
      <div className={`rs-icon-field${className ? ` ${className}` : ''}`}>
        <span className="rs-icon-field__icon" aria-hidden>
          <FontAwesomeIcon icon={icon} />
        </span>
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
