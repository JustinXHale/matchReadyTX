import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import type { CardReportReopenRequest } from '@/domain/types';
import { validateDenyReason } from '@/domain/cardReportReopen';

export function CardReportReopenQueue({
  requests,
  busyId,
  onApprove,
  onDeny,
}: {
  requests: CardReportReopenRequest[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onDeny: (id: string, reason: string) => void;
}) {
  const [denyId, setDenyId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [denyError, setDenyError] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending card report reopen requests.</p>
    );
  }

  return (
    <ul className="rs-list">
      {requests.map((r) => (
        <li key={r.id} className="rs-detail-card">
          <p className="rs-detail-note">
            <strong>{r.requesterName}</strong> ({r.requesterEmail})
          </p>
          <p className="rs-match-card__meta">
            Reopen card report for <strong>{r.matchLabel || r.matchId}</strong>
          </p>
          <p className="rs-match-card__meta">{r.requestReason}</p>
          {denyId === r.id ? (
            <div className="rs-stack">
              <label className="rs-match-card__meta" htmlFor={`deny-crr-${r.id}`}>
                Reason (required)
              </label>
              <input
                id={`deny-crr-${r.id}`}
                className="rs-onboard__input"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setDenyError(null);
                }}
              />
              {denyError && (
                <p className="rs-match-card__meta" role="alert">
                  {denyError}
                </p>
              )}
              <div className="rs-actions rs-actions--inline">
                <Button
                  variant="danger"
                  className="rs-btn--danger"
                  isDisabled={busyId === r.id}
                  isLoading={busyId === r.id}
                  onClick={() => {
                    const err = validateDenyReason(reason);
                    if (err) {
                      setDenyError(err);
                      return;
                    }
                    onDeny(r.id, reason.trim());
                    setDenyId(null);
                    setReason('');
                    setDenyError(null);
                  }}
                >
                  Confirm deny
                </Button>
                <Button
                  variant="link"
                  onClick={() => {
                    setDenyId(null);
                    setReason('');
                    setDenyError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rs-actions rs-actions--inline">
              <Button
                variant="primary"
                isDisabled={busyId === r.id}
                isLoading={busyId === r.id}
                onClick={() => onApprove(r.id)}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                className="rs-btn--danger"
                isDisabled={busyId === r.id}
                onClick={() => setDenyId(r.id)}
              >
                Deny
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
