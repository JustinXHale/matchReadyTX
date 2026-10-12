import { useRef, useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Modal,
  ModalHeader,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { isComplianceHeld } from '@/domain/complianceHold';
import type { Match } from '@/domain/types';

export type AssignerMenuAction =
  | 'edit_details'
  | 'change_status'
  | 'alert_coverage'
  | 'compliance_hold'
  | 'remove_compliance_hold'
  | 'cancel'
  | 'postpone'
  | 'forfeit'
  | 'clear_forfeit'
  | 'played_forfeit'
  | 'clear_played_forfeit'
  | 'reactivate';

type Props = {
  match: Match;
  canAlertCoverage: boolean;
  coverageAlertLabel: string;
  onAction: (action: AssignerMenuAction) => void;
  presentation?: 'icon' | 'bottom-bar';
};

export function MatchAssignerMenu({
  match,
  canAlertCoverage,
  coverageAlertLabel,
  onAction,
  presentation = 'icon',
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

  const items: {
    action: AssignerMenuAction;
    label: string;
    danger?: boolean;
  }[] = [
    { action: 'edit_details', label: 'Edit details' },
    ...(canAlertCoverage
      ? ([{ action: 'alert_coverage', label: coverageAlertLabel }] as const)
      : []),
    ...(isTerminal
      ? ([{ action: 'reactivate', label: 'Reactivate match' }] as const)
      : ([
          { action: 'change_status', label: 'Change match status…' },
          {
            action: isComplianceHeld(match)
              ? 'remove_compliance_hold'
              : 'compliance_hold',
            label: isComplianceHeld(match) ? 'Unlock match' : 'Lock match',
          },
          { action: 'cancel', label: 'Cancel match', danger: true },
        ] as const)),
  ];

  if (presentation === 'bottom-bar') {
    return (
      <div className="rs-detail__assigner-menu rs-detail__assigner-menu--bottom-bar">
        <button
          ref={toggleRef}
          type="button"
          className="rs-detail__assigner-menu-toggle rs-detail__assigner-menu-toggle--bottom-bar"
          aria-label="Match actions"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? 'match-actions-sheet' : undefined}
          onClick={() => setIsOpen(true)}
        >
          <span className="rs-detail__assigner-menu-toggle-content">
            <EllipsisVIcon aria-hidden />
            <span>Match actions</span>
          </span>
        </button>

        <Modal
          className="rs-match-actions-sheet"
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          aria-labelledby="match-actions-sheet-title"
        >
          <ModalHeader
            title="Match actions"
            labelId="match-actions-sheet-title"
            onClose={() => setIsOpen(false)}
          />
          <div
            id="match-actions-sheet"
            className="rs-match-actions-sheet__actions"
            role="group"
            aria-label="Match actions"
          >
            {items.map((item) => (
              <button
                key={item.action}
                type="button"
                className={`rs-match-actions-sheet__action${
                  item.danger ? ' rs-match-actions-sheet__action--danger' : ''
                }`}
                onClick={() => closeAnd(item.action)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <Dropdown
      className={`rs-detail__assigner-menu rs-detail__assigner-menu--${presentation}`}
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
            className={`rs-detail__assigner-menu-toggle rs-detail__assigner-menu-toggle--${presentation}`}
            onClick={() => setIsOpen((open) => !open)}
          >
            <EllipsisVIcon aria-hidden />
          </MenuToggle>
        ),
      }}
    >
      <DropdownList aria-label="Match actions">
        {items.map((item) => (
          <DropdownItem
            key={item.action}
            className={item.danger ? 'rs-detail__assigner-menu-danger' : undefined}
            onClick={() => closeAnd(item.action)}
          >
            {item.label}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
}
