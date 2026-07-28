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
} from '@patternfly/react-core';
import type { FixtureRequest } from '@/domain/types';

export function FixtureRequestQueue({
  requests,
  onApprove,
  onDecline,
  busyId,
}: {
  requests: FixtureRequest[];
  onApprove: (id: string) => void;
  onDecline: (id: string, reason?: string) => void;
  busyId?: string | null;
}) {
  const [declineTarget, setDeclineTarget] = useState<FixtureRequest | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState('');

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending fixture requests.</p>
    );
  }

  return (
    <>
      <ul className="rs-list rs-queue-list">
        {requests.map((r) => {
          const when = new Date(r.kickoffAt).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          const busy = busyId === r.id;
          return (
            <li key={r.id} className="rs-queue-card">
              <div className="rs-queue-card__body">
                <strong>
                  {r.homeTeamName} vs {r.awayTeamName}
                </strong>
                <p className="rs-match-card__meta">
                  {when} · {r.venueName}
                </p>
                <p className="rs-match-card__meta">{r.venueAddress}</p>
                <p className="rs-match-card__meta">
                  {r.level}
                  {r.competition ? ` · ${r.competition}` : ''} · {r.gender}
                  {r.flightProvided ? ' · Flight' : ''}
                  {r.housingProvided ? ' · Housing' : ''}
                </p>
                <p className="rs-match-card__meta">
                  Requested by {r.requesterName} (
                  {r.side === 'home' ? 'home' : 'away'})
                </p>
                {r.notes?.trim() && (
                  <p className="rs-match-card__meta">Notes: {r.notes}</p>
                )}
              </div>
              <div className="rs-queue-card__actions">
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={busy}
                  isLoading={busy}
                  onClick={() => onApprove(r.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={busy}
                  onClick={() => {
                    setDeclineTarget(r);
                    setDeclineReason('');
                  }}
                >
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        variant={ModalVariant.small}
        isOpen={declineTarget != null}
        onClose={() => setDeclineTarget(null)}
        aria-labelledby="decline-fixture-title"
      >
        <ModalHeader>
          <h2 id="decline-fixture-title">Decline fixture request</h2>
        </ModalHeader>
        <ModalBody>
          <FormGroup label="Reason (optional)" fieldId="decline-fixture-reason">
            <TextArea
              id="decline-fixture-reason"
              value={declineReason}
              onChange={(_e, v) => setDeclineReason(v)}
              rows={3}
              aria-label="Decline reason"
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setDeclineTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!declineTarget) return;
              onDecline(declineTarget.id, declineReason.trim() || undefined);
              setDeclineTarget(null);
            }}
          >
            Decline
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
