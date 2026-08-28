import {
  FIVE_POINT_CHOICES,
  FIVE_POINT_LABELS,
  FIVE_POINT_VALUES,
  SCALE_NA,
  SCALE_NA_LABEL,
  SCALE_NA_SHORT,
  type FivePointChoice,
  type FivePointValue,
} from '@/domain/fivePointScale';

type Props = {
  name: string;
  value: FivePointChoice | undefined;
  onChange?: (next: FivePointChoice) => void;
  ariaLabel: string;
  /** Scheduler / submitted views — no inputs. */
  readOnly?: boolean;
  /** Default true (coach feedback / CMO competency). Linear 1–5 scales omit N/A. */
  includeNa?: boolean;
  /** Override card captions (e.g. temperature 1 = Friendly). */
  labels?: Partial<Record<FivePointValue, string>>;
};

function optionCopy(
  choice: FivePointChoice,
  labels?: Partial<Record<FivePointValue, string>>,
): { n: string; label: string } {
  if (choice === SCALE_NA) {
    return { n: SCALE_NA_SHORT, label: SCALE_NA_LABEL };
  }
  const custom = labels?.[choice];
  return {
    n: String(choice),
    label: custom !== undefined ? custom : FIVE_POINT_LABELS[choice],
  };
}

/** Number cards (1–5 + optional N/A) used on coach feedback and CMO reports. */
export function ScaleRatingCards({
  name,
  value,
  onChange,
  ariaLabel,
  readOnly = false,
  includeNa = true,
  labels,
}: Props) {
  const choices = includeNa ? FIVE_POINT_CHOICES : FIVE_POINT_VALUES;
  const wide = labels != null;

  return (
    <div
      className="rs-coach-fb-radios"
      role={readOnly ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
    >
      {choices.map((choice) => {
        const selected = value === choice;
        const { n, label } = optionCopy(choice, labels);
        const inputId = `${name}-${choice}`;
        const className = [
          'rs-coach-fb-radio',
          selected ? 'rs-coach-fb-radio--selected' : '',
          choice === SCALE_NA ? 'rs-coach-fb-radio--na' : '',
          wide ? 'rs-coach-fb-radio--labeled' : '',
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
              {label ? (
                <span className="rs-coach-fb-radio__label">{label}</span>
              ) : null}
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
            {label ? (
              <span className="rs-coach-fb-radio__label">{label}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
