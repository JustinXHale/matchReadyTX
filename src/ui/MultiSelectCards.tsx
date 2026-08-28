type Props<T extends string> = {
  name: string;
  options: readonly T[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  ariaLabel: string;
  readOnly?: boolean;
};

/** Tappable cards — select multiple options (e.g. breakdown rewards). */
export function MultiSelectCards<T extends string>({
  name,
  options,
  selected,
  onChange,
  ariaLabel,
  readOnly = false,
}: Props<T>) {
  const toggle = (opt: T, next: boolean) => {
    if (readOnly) return;
    onChange(
      next
        ? selected.includes(opt)
          ? [...selected]
          : [...selected, opt]
        : selected.filter((x) => x !== opt),
    );
  };

  return (
    <div
      className="rs-coach-fb-radios rs-toggle-cards"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isOn = selected.includes(opt);
        const inputId = `${name}-${opt.replace(/\s+/g, '-')}`;
        const className = [
          'rs-coach-fb-radio',
          'rs-coach-fb-radio--labeled',
          isOn ? 'rs-coach-fb-radio--selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        if (readOnly) {
          return (
            <div
              key={opt}
              className={className}
              aria-current={isOn ? 'true' : undefined}
            >
              <span className="rs-coach-fb-radio__label">{opt}</span>
            </div>
          );
        }

        return (
          <label key={opt} htmlFor={inputId} className={className}>
            <input
              id={inputId}
              type="checkbox"
              name={name}
              checked={isOn}
              onChange={(e) => toggle(opt, e.target.checked)}
            />
            <span className="rs-coach-fb-radio__label">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
