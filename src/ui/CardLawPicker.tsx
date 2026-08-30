import { useMemo, useRef, useState } from 'react';
import {
  Checkbox,
  MenuContainer,
  MenuToggle,
  Panel,
  PanelMain,
  PanelMainBody,
} from '@patternfly/react-core';
import {
  CARD_LAW_IDS,
  CARD_LAW_LABELS,
  type CardLawId,
} from '@/domain/cardLaws';

export function CardLawPicker({
  id,
  selected,
  onToggle,
  ariaLabel = 'Laws infringed',
}: {
  id: string;
  selected: CardLawId[];
  onToggle: (lawId: CardLawId, on: boolean) => void;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleLabel = useMemo(() => {
    if (selected.length === 0) return 'Select law(s)';
    if (selected.length === 1) {
      const label = CARD_LAW_LABELS[selected[0]!];
      const short = label.split(':')[0] ?? label;
      return short.length > 28 ? `${short.slice(0, 25)}…` : short;
    }
    return `${selected.length} laws selected`;
  }, [selected]);

  const menu = (
    <Panel ref={menuRef} variant="raised" className="rs-card-law-picker__panel">
      <PanelMain>
        <PanelMainBody className="rs-card-law-picker__body">
          {CARD_LAW_IDS.map((lawId) => (
            <Checkbox
              key={`${id}-${lawId}`}
              id={`${id}-${lawId}`}
              label={CARD_LAW_LABELS[lawId]}
              isChecked={selected.includes(lawId)}
              onChange={(_e, v) => onToggle(lawId, v)}
            />
          ))}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  );

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      onOpenChangeKeys={['Escape']}
      menu={menu}
      menuRef={menuRef}
      toggle={
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOpen((v) => !v)}
          isExpanded={isOpen}
          aria-label={ariaLabel}
          className="rs-card-law-picker__toggle"
        >
          {toggleLabel}
        </MenuToggle>
      }
      toggleRef={toggleRef}
    />
  );
}
