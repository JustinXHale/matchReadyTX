import { useState } from 'react';
import {
  Badge,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  type MenuToggleElement,
} from '@patternfly/react-core';

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
  const togglePlaceholder = placeholder ?? 'All';

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value?: string | number,
  ) => {
    if (value == null || value === '') return;
    const key = String(value);
    onChange(
      selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key],
    );
  };

  return (
    <label className="rs-filter-field rs-filter-field--select">
      <span className="rs-filter-field__label">{label}</span>
      <Select
        aria-label={ariaLabel ?? label}
        role="menu"
        selected={selected}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={onSelect}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen((open) => !open)}
            isExpanded={isOpen}
            className="rs-multi-filter-toggle"
          >
            <span className="rs-multi-filter-toggle__text">
              {selected.length > 0
                ? `${selected.length} selected`
                : togglePlaceholder}
            </span>
            {selected.length > 0 ? (
              <Badge isRead className="rs-multi-filter-toggle__badge">
                {selected.length}
              </Badge>
            ) : null}
          </MenuToggle>
        )}
      >
      <SelectList>
        {options.map((opt) => (
          <SelectOption
            key={opt.value}
            value={opt.value}
            hasCheckbox
            isSelected={selected.includes(opt.value)}
          >
            {opt.label}
          </SelectOption>
        ))}
      </SelectList>
      </Select>
    </label>
  );
}
