import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import type { Match } from '@/domain/types';
import { MatchListRow } from '@/ui/MatchListRow';

export function ReleaseDraftPreviewModal({
  isOpen,
  title,
  drafts,
  releaseLabel,
  releaseBusy,
  onClose,
  onRelease,
}: {
  isOpen: boolean;
  title: string;
  drafts: Match[];
  releaseLabel: string;
  releaseBusy?: boolean;
  onClose: () => void;
  onRelease: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={ModalVariant.small}
      aria-labelledby="release-draft-preview-title"
    >
      <ModalHeader>
        <h2 id="release-draft-preview-title" className="pf-v6-title">
          {title}
        </h2>
      </ModalHeader>
      <ModalBody>
        {drafts.length === 0 ? (
          <p className="rs-match-card__meta">No draft matches in this set.</p>
        ) : (
          <>
            <p className="rs-match-card__meta">
              {drafts.length} game{drafts.length === 1 ? '' : 's'} will move to
              pending team review when you release.
            </p>
            <ul className="rs-list rs-upload-draft-preview__list">
              {drafts.map((m) => (
                <li key={m.id}>
                  <MatchListRow match={m} to={`/matches/${m.id}`} showTime />
                </li>
              ))}
            </ul>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose} isDisabled={releaseBusy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          isDisabled={drafts.length === 0 || releaseBusy}
          isLoading={releaseBusy}
          onClick={onRelease}
        >
          {releaseLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
