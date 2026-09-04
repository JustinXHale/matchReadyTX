import { useMemo } from 'react';

export type RsFilterSelectOption = {
  value: string;
  label: string;
};

export function RsFilterSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  options: RsFilterSelectOption[];
  className?: string;
}) {
  const selectSizer = useMemo(() => {
    let longest = placeholder;
    for (const opt of options) {
      if (opt.label.length > longest.length) longest = opt.label;
    }
    return longest;
  }, [options, placeholder]);

  return (
    <label
      className={`rs-filter-field rs-filter-field--select${className ? ` ${className}` : ''}`}
    >
      <span className="rs-filter-field__label">{label}</span>
      <span className="rs-filter-select-wrap">
        <select
          className="rs-filter-select"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label={label}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="rs-filter-select-sizer" aria-hidden>
          {selectSizer}
        </span>
      </span>
    </label>
  );
}
