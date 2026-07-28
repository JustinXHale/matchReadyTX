import { useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';

const CHART_SRC = '/assets/referee-levels.png';
const CHART_ALT =
  'Referee competencies by level — Level 10 (C4) through Level 6 (C1+), with focus areas for each grade';

type Props = {
  /** Extra class on the figure (e.g. profile spacing). */
  className?: string;
  caption?: string;
};

/** Thumbnail chart; tap/click opens a larger zoomable lightbox. */
export function RefereeLevelChart({ className, caption }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <figure className={`rs-onboard__level-chart ${className ?? ''}`.trim()}>
        <button
          type="button"
          className="rs-onboard__level-chart-hit"
          onClick={() => setOpen(true)}
          aria-label="Enlarge referee level chart"
        >
          <img
            src={CHART_SRC}
            alt={CHART_ALT}
            className="rs-onboard__level-chart-img"
          />
          <span className="rs-onboard__level-chart-zoom" aria-hidden>
            Tap to enlarge
          </span>
        </button>
        {caption ? (
          <figcaption className="rs-onboard__level-chart-cap">
            {caption}
          </figcaption>
        ) : null}
      </figure>

      <Modal
        variant={ModalVariant.large}
        isOpen={open}
        onClose={() => setOpen(false)}
        aria-label="Referee competencies by level"
      >
        <ModalHeader title="Referee competencies by level" />
        <ModalBody>
          <div className="rs-level-lightbox">
            <img
              src={CHART_SRC}
              alt={CHART_ALT}
              className="rs-level-lightbox__img"
            />
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}
