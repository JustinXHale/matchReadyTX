import { useEffect, useId, useRef, useState } from 'react';

export type RsMultiFilterOption = {
  value: string;
  label: string;
};

export function RsMultiFilterSelect({
  label,
  selected,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  options: RsMultiFilterOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const togglePlaceholder = placeholder ?? 'All';

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => setIsOpen(false);
  }, []);

  const toggleSelection = (key: string) => {
    onChange(
      selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key],
    );
  };

  return (
    <div
      ref={rootRef}
      className="rs-filter-field rs-filter-field--select rs-multi-filter"
    >
      <span className="rs-filter-field__label">{label}</span>
      <button
        type="button"
        className="rs-multi-filter-toggle"
        aria-label={ariaLabel ?? label}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="rs-multi-filter-toggle__text">
          {selected.length > 0
            ? `${selected.length} selected`
            : togglePlaceholder}
        </span>
        {selected.length > 0 ? (
          <span className="rs-multi-filter-toggle__badge" aria-hidden>
            {selected.length}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div
          id={listboxId}
          className="rs-multi-filter-menu"
          role="listbox"
          aria-label={ariaLabel ?? label}
          aria-multiselectable="true"
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label key={opt.value} className="rs-multi-filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelection(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
