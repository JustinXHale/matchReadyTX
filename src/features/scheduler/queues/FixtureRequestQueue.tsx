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
import { displayCompetitionLabel } from '@/domain/competitions';
import { useApp } from '@/app/AppContext';
import {
  formatMatchCardWeekday,
  formatMatchKickoffTime,
  orgTimeZone,
} from '@/domain/matchTime';
import { genderLabel, type FixtureRequest } from '@/domain/types';
import { MatchActionPrompt } from '@/ui/MatchActionPrompt';

function dayOrdinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (k >= 11 && k <= 13) return `${day}th`;
  if (j === 1) return `${day}st`;
  if (j === 2) return `${day}nd`;
  if (j === 3) return `${day}rd`;
  return `${day}th`;
}

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
  const { state } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
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
      <ul className="rs-list">
        {requests.map((r) => {
          const busy = busyId === r.id;
          const requesterTeamName =
            state.teams.find((team) => team.id === r.requesterTeamId)?.name ??
            (r.side === 'home' ? r.homeTeamName : r.awayTeamName);
          const kickoff = new Date(r.kickoffAt);
          const month = kickoff.toLocaleDateString(undefined, {
            month: 'short',
            timeZone,
          });
          const dayNum = Number(
            kickoff.toLocaleDateString(undefined, {
              day: 'numeric',
              timeZone,
            }),
          );
          const weekday = formatMatchCardWeekday(r.kickoffAt, timeZone);
          const time = formatMatchKickoffTime(r.kickoffAt, timeZone);
          return (
            <li key={r.id} className="rs-list-row rs-fixture-request-card">
              <div className="rs-list-row__top-banner">
                <MatchActionPrompt
                  message={`Fixture request: ${r.requesterName} (${requesterTeamName})`}
                  primaryLabel="Approve"
                  onPrimary={() => onApprove(r.id)}
                  primaryDisabled={busy}
                  secondaryLabel="Decline"
                  onSecondary={() => {
                    setDeclineTarget(r);
                    setDeclineReason('');
                  }}
                  secondaryDisabled={busy}
                  tone="attention"
                  ariaLabel={`Fixture request ${r.homeTeamName} versus ${r.awayTeamName}`}
                />
              </div>
              <div className="rs-list-row__main">
                <div className="rs-list-row__main-inner">
                <div className="rs-list-row__date" aria-hidden>
                  <span className="rs-list-row__month">{month}</span>
                  <span className="rs-list-row__day">{dayOrdinal(dayNum)}</span>
                  <span className="rs-list-row__weekday">{weekday}</span>
                </div>
                <div className="rs-list-row__body">
                  <div
                    className="rs-list-row__chips rs-list-row__chips--identity"
                    aria-label="Game type"
                  >
                    <span className="rs-pill rs-pill--ink rs-list-row__chip">
                      {genderLabel(r.gender)}
                    </span>
                    <span className="rs-pill rs-pill--ink rs-list-row__chip">
                      {r.level}
                    </span>
                    {r.competition ? (
                      <span className="rs-pill rs-pill--quiet rs-list-row__chip">
                        {displayCompetitionLabel(r.competition)}
                      </span>
                    ) : null}
                    {r.flightProvided ? (
                      <span className="rs-pill rs-pill--quiet rs-list-row__chip">
                        Flight
                      </span>
                    ) : null}
                    {r.housingProvided ? (
                      <span className="rs-pill rs-pill--quiet rs-list-row__chip">
                        Lodging
                      </span>
                    ) : null}
                  </div>
                  <div className="rs-list-row__datetime-location">
                    <p className="rs-list-row__time">{time}</p>
                    <span className="rs-list-row__meta-separator" aria-hidden>
                      |
                    </span>
                    <p className="rs-list-row__venue">{r.venueName}</p>
                  </div>
                  {r.venueAddress ? (
                    <p className="rs-list-row__event-title">{r.venueAddress}</p>
                  ) : null}
                  <div className="rs-list-row__teams">
                    <span className="rs-list-row__name">
                      <span className="rs-list-row__ha" aria-hidden>
                        (H)
                      </span>
                      {r.homeTeamName}
                    </span>
                    <span className="rs-list-row__name">
                      <span className="rs-list-row__ha" aria-hidden>
                        (A)
                      </span>
                      {r.awayTeamName}
                    </span>
                  </div>
                  <div className="rs-list-row__meta">
                    <span className="rs-list-row__hint">
                      Requested for {requesterTeamName} (
                      {r.side === 'home' ? 'home' : 'away'}) by{' '}
                      {r.requesterName}
                    </span>
                    {r.notes?.trim() ? (
                      <span className="rs-list-row__hint">Notes: {r.notes}</span>
                    ) : null}
                  </div>
                </div>
                </div>
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
