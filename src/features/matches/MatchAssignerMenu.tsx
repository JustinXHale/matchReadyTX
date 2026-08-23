import { useRef, useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import type { Match } from '@/domain/types';

export type AssignerMenuAction =
  | 'alert_coverage'
  | 'cancel'
  | 'postpone'
  | 'reactivate';

type Props = {
  match: Match;
  canAlertCoverage: boolean;
  coverageAlertLabel: string;
  onAction: (action: AssignerMenuAction) => void;
};

export function MatchAssignerMenu({
  match,
  canAlertCoverage,
  coverageAlertLabel,
  onAction,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isTerminal =
    match.status === 'cancelled' || match.status === 'postponed';
  const hasItems =
    canAlertCoverage || isTerminal || !isTerminal;

  if (!hasItems) return null;

  const closeAnd = (action: AssignerMenuAction) => {
    setIsOpen(false);
    onAction(action);
  };

  return (
    <Dropdown
      className="rs-detail__assigner-menu"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ placement: 'bottom-end' }}
      toggle={{
        toggleRef,
        toggleNode: (
          <MenuToggle
            ref={toggleRef}
            variant="plain"
            aria-label="Match actions"
            isExpanded={isOpen}
            className="rs-detail__assigner-menu-toggle"
            onClick={() => setIsOpen((open) => !open)}
          >
            <EllipsisVIcon aria-hidden />
          </MenuToggle>
        ),
      }}
    >
      <DropdownList>
        {canAlertCoverage && (
          <DropdownItem onClick={() => closeAnd('alert_coverage')}>
            {coverageAlertLabel}
          </DropdownItem>
        )}
        {isTerminal ? (
          <DropdownItem onClick={() => closeAnd('reactivate')}>
            Reactivate match
          </DropdownItem>
        ) : (
          <>
            <DropdownItem onClick={() => closeAnd('postpone')}>
              Postpone match
            </DropdownItem>
            <DropdownItem
              className="rs-detail__assigner-menu-danger"
              onClick={() => closeAnd('cancel')}
            >
              Cancel match
            </DropdownItem>
          </>
        )}
      </DropdownList>
    </Dropdown>
  );
}
