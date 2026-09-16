import {
  complianceHoldCardLabel,
  complianceHoldContactLine,
} from '@/domain/complianceHold';
import type { ComplianceHold } from '@/domain/types';

type Props = {
  hold: ComplianceHold;
  eventTitle?: string;
  /** Date + fixture, e.g. Saturday, Sept. 16, 2027 Home v Away */
  fixtureLine?: string;
  /** `card` = list row; `detail` = match detail page */
  variant?: 'card' | 'detail';
};

export function ComplianceHoldOverlay({
  hold,
  eventTitle,
  fixtureLine,
  variant = 'card',
}: Props) {
  const contact = complianceHoldContactLine(hold);
  const contactName = hold.lockedByName.trim() || 'Assigner';

  return (
    <div
      className={`rs-compliance-hold-overlay rs-compliance-hold-overlay--${variant}`}
      role="status"
      aria-live="polite"
    >
      <div className="rs-compliance-hold-overlay__content">
        {eventTitle?.trim() ? (
          <p className="rs-compliance-hold-overlay__event">{eventTitle.trim()}</p>
        ) : null}
        <p className="rs-compliance-hold-overlay__headline">
          {complianceHoldCardLabel()}
        </p>
        {variant === 'detail' ? (
          <p className="rs-compliance-hold-overlay__message">{hold.message}</p>
        ) : null}
        <p className="rs-compliance-hold-overlay__contact">
          Contact {contactName}
          {contact ? (
            <>
              <span className="rs-compliance-hold-overlay__contact-sep" aria-hidden>
                ·
              </span>
              {contact}
            </>
          ) : null}
        </p>
        {fixtureLine?.trim() ? (
          <p className="rs-compliance-hold-overlay__fixture">{fixtureLine.trim()}</p>
        ) : null}
      </div>
    </div>
  );
}
