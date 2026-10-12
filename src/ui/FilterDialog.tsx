import type { ReactNode } from 'react';
import { Button } from '@patternfly/react-core';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@/lib/pf-mui/Modal';

export function FilterDialog({
  id,
  title = 'Filters',
  open,
  onCancel,
  onClear,
  onApply,
  children,
}: {
  id: string;
  title?: string;
  open: boolean;
  onCancel: () => void;
  onClear: () => void;
  onApply: () => void;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      variant={ModalVariant.small}
      className="rs-filter-dialog"
      aria-labelledby={titleId}
    >
      <ModalHeader
        title={title}
        labelId={titleId}
        onClose={onCancel}
      />
      <ModalBody>
        <div className="rs-filter-dialog__fields">{children}</div>
      </ModalBody>
      <ModalFooter className="rs-filter-dialog__actions">
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Clear filters
        </Button>
        <Button variant="primary" onClick={onApply}>
          Apply
        </Button>
      </ModalFooter>
    </Modal>
  );
}
