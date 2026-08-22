import {
  FIVE_POINT_CHOICES,
  FIVE_POINT_LABELS,
  SCALE_NA,
  SCALE_NA_LABEL,
  SCALE_NA_SHORT,
  type FivePointChoice,
} from '@/domain/fivePointScale';

type Props = {
  name: string;
  value: FivePointChoice | undefined;
  onChange?: (next: FivePointChoice) => void;
  ariaLabel: string;
  /** Scheduler / submitted views — no inputs. */
  readOnly?: boolean;
};

function optionCopy(choice: FivePointChoice): { n: string; label: string } {
  if (choice === SCALE_NA) {
    return { n: SCALE_NA_SHORT, label: SCALE_NA_LABEL };
  }
  return { n: String(choice), label: FIVE_POINT_LABELS[choice] };
}

/** Number cards (1–5 + N/A) used on coach feedback and CMO reports. */
export function ScaleRatingCards({
  name,
  value,
  onChange,
  ariaLabel,
  readOnly = false,
}: Props) {
  return (
    <div
      className="rs-coach-fb-radios"
      role={readOnly ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
    >
      {FIVE_POINT_CHOICES.map((choice) => {
        const selected = value === choice;
        const { n, label } = optionCopy(choice);
        const inputId = `${name}-${choice}`;
        const className = [
          'rs-coach-fb-radio',
          selected ? 'rs-coach-fb-radio--selected' : '',
          choice === SCALE_NA ? 'rs-coach-fb-radio--na' : '',
        ]
          .filter(Boolean)
          .join(' ');

        if (readOnly) {
          return (
            <div
              key={String(choice)}
              className={className}
              aria-current={selected ? 'true' : undefined}
            >
              <span className="rs-coach-fb-radio__n" aria-hidden>
                {n}
              </span>
              <span className="rs-coach-fb-radio__label">{label}</span>
            </div>
          );
        }

        return (
          <label key={String(choice)} htmlFor={inputId} className={className}>
            <input
              id={inputId}
              type="radio"
              name={name}
              value={String(choice)}
              checked={selected}
              onChange={() => onChange?.(choice)}
            />
            <span className="rs-coach-fb-radio__n" aria-hidden>
              {n}
            </span>
            <span className="rs-coach-fb-radio__label">{label}</span>
          </label>
        );
      })}
    </div>
  );
}
