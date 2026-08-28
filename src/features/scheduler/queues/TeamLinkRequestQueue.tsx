import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import type { TeamLinkRequest } from '@/domain/types';

export function TeamLinkRequestQueue({
  requests,
  busyId,
  onApprove,
  onDeny,
}: {
  requests: TeamLinkRequest[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onDeny: (id: string, reason?: string) => void;
}) {
  const [denyId, setDenyId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (requests.length === 0) {
    return (
      <p className="rs-match-card__meta">No pending Team Admin link requests.</p>
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
            Wants to manage <strong>{r.teamName}</strong>
          </p>
          {denyId === r.id ? (
            <div className="rs-stack">
              <label className="rs-match-card__meta" htmlFor={`deny-tlr-${r.id}`}>
                Reason (optional)
              </label>
              <input
                id={`deny-tlr-${r.id}`}
                className="rs-onboard__input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="rs-actions rs-actions--inline">
                <Button
                  variant="danger"
                  className="rs-btn--danger"
                  isDisabled={busyId === r.id}
                  isLoading={busyId === r.id}
                  onClick={() => {
                    onDeny(r.id, reason.trim() || undefined);
                    setDenyId(null);
                    setReason('');
                  }}
                >
                  Confirm deny
                </Button>
                <Button
                  variant="link"
                  onClick={() => {
                    setDenyId(null);
                    setReason('');
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
