import { useState } from 'react';
import {
  Button,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  approvalSlotsForRaiseHand,
  gameRequestPreferredSlots,
} from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  type GameRequest,
  type RequestableSlot,
} from '@/domain/types';

function formatPreferredSlots(request: GameRequest): string {
  const slots = gameRequestPreferredSlots(request);
  if (slots.length === 0) return 'Position TBD';
  return slots.map((s) => REQUESTABLE_SLOT_LABELS[s]).join(' · ');
}

export function useRaiseHandRequestModals(
  onApprove: (id: string, slot?: RequestableSlot) => void,
  onDecline: (id: string, reason?: string) => void,
) {
  const { state } = useApp();
  const [declineTarget, setDeclineTarget] = useState<GameRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<GameRequest | null>(null);
  const [approveSlot, setApproveSlot] = useState<RequestableSlot | ''>('');

  const closeDecline = () => {
    setDeclineTarget(null);
    setDeclineReason('');
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveSlot('');
  };

  const startApprove = (request: GameRequest) => {
    const match = state.matches.find((m) => m.id === request.matchId);
    if (!match) return;
    const slots = approvalSlotsForRaiseHand(match, request);
    if (slots.length === 0) {
      window.alert('No open slots match this request anymore.');
      return;
    }
    if (slots.length === 1) {
      onApprove(request.id, slots[0]);
      return;
    }
    setApproveTarget(request);
    setApproveSlot(slots[0] ?? '');
  };

  const startDecline = (request: GameRequest) => {
    setDeclineReason('');
    setDeclineTarget(request);
  };

  const modals = (
    <>
      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(declineTarget)}
        onClose={closeDecline}
        aria-labelledby="decline-request-title"
        aria-describedby="decline-request-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="decline-request-title" size="lg">
            Decline request?
          </Title>
        </ModalHeader>
        <ModalBody>
          {declineTarget && (
            <>
              <p id="decline-request-desc" className="rs-modal-lede">
                Decline{' '}
                <strong>{declineTarget.userName}</strong>
                {gameRequestPreferredSlots(declineTarget).length > 0
                  ? ` for ${formatPreferredSlots(declineTarget)}`
                  : ''}
                ? You can leave an optional reason for the official.
              </p>
              <FormGroup label="Reason (optional)" fieldId="decline-reason">
                <TextArea
                  id="decline-reason"
                  value={declineReason}
                  onChange={(_, v) => setDeclineReason(v)}
                  rows={3}
                  resizeOrientation="vertical"
                  aria-label="Decline reason"
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeDecline}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (!declineTarget) return;
              const reason = declineReason.trim();
              onDecline(declineTarget.id, reason || undefined);
              closeDecline();
            }}
          >
            Decline
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(approveTarget)}
        onClose={closeApprove}
        aria-labelledby="approve-request-title"
        aria-describedby="approve-request-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="approve-request-title" size="lg">
            Approve request
          </Title>
        </ModalHeader>
        <ModalBody>
          {approveTarget && (
            <>
              <p id="approve-request-desc" className="rs-modal-lede">
                Place <strong>{approveTarget.userName}</strong> on this match.
                Choose the crew slot to fill.
              </p>
              <FormGroup label="Slot" fieldId="approve-slot">
                <div
                  className="rs-filter-chips"
                  role="radiogroup"
                  aria-label="Crew slot"
                >
                  {approvalSlotsForRaiseHand(
                    state.matches.find((m) => m.id === approveTarget.matchId)!,
                    approveTarget,
                  ).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={`rs-filter-chip${
                        approveSlot === slot ? ' rs-filter-chip--selected' : ''
                      }`}
                      aria-pressed={approveSlot === slot}
                      onClick={() => setApproveSlot(slot)}
                    >
                      {REQUESTABLE_SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeApprove}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            isDisabled={!approveSlot}
            onClick={() => {
              if (!approveTarget || !approveSlot) return;
              onApprove(approveTarget.id, approveSlot);
              closeApprove();
            }}
          >
            Approve
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );

  return { startApprove, startDecline, modals };
}
