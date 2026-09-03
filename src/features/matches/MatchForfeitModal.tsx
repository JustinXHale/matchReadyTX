import { useEffect, useState } from 'react';
import {
  Button,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextInput,
  Title,
} from '@patternfly/react-core';
import type { Match } from '@/domain/types';

export type ForfeitSide = 'home' | 'away';

type Props = {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: {
    forfeitTeamId: string;
    homeScore: number;
    awayScore: number;
  }) => void;
};

function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function MatchForfeitModal({ match, isOpen, onClose, onSave }: Props) {
  const [side, setSide] = useState<ForfeitSide | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const homeForfeited = match.forfeitTeamId === match.homeTeamId;
    const awayForfeited = match.forfeitTeamId === match.awayTeamId;
    setSide(homeForfeited ? 'home' : awayForfeited ? 'away' : null);
    setHomeScore(
      match.homeScore != null && Number.isFinite(match.homeScore)
        ? String(match.homeScore)
        : '',
    );
    setAwayScore(
      match.awayScore != null && Number.isFinite(match.awayScore)
        ? String(match.awayScore)
        : '',
    );
    setError('');
  }, [
    isOpen,
    match.awayScore,
    match.awayTeamId,
    match.forfeitTeamId,
    match.homeScore,
    match.homeTeamId,
  ]);

  const save = () => {
    if (!side) {
      setError('Select which team forfeited.');
      return;
    }
    const home = parseScore(homeScore);
    const away = parseScore(awayScore);
    if (home == null || away == null) {
      setError('Enter a valid final score for both teams (whole numbers, 0 or more).');
      return;
    }
    const forfeitTeamId =
      side === 'home' ? match.homeTeamId : match.awayTeamId;
    onSave({ forfeitTeamId, homeScore: home, awayScore: away });
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="match-forfeit-title"
    >
      <ModalHeader>
        <Title headingLevel="h2" id="match-forfeit-title" size="lg">
          Record forfeit
        </Title>
      </ModalHeader>
      <ModalBody>
        <p className="rs-modal-lede">
          Choose the forfeiting team and enter the final score. The result counts
          in standings unless this match is marked as a played forfeit scrimmage.
        </p>
        <FormGroup label="Forfeiting team" fieldId="forfeit-team">
          <div
            id="forfeit-team"
            className="rs-slot-picker"
            role="radiogroup"
            aria-label="Forfeiting team"
          >
            <button
              type="button"
              role="radio"
              aria-checked={side === 'home'}
              className={`rs-filter-chip${
                side === 'home' ? ' rs-filter-chip--selected' : ''
              }`}
              onClick={() => {
                setSide('home');
                setError('');
              }}
            >
              {match.homeTeamName}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={side === 'away'}
              className={`rs-filter-chip${
                side === 'away' ? ' rs-filter-chip--selected' : ''
              }`}
              onClick={() => {
                setSide('away');
                setError('');
              }}
            >
              {match.awayTeamName}
            </button>
          </div>
        </FormGroup>
        <FormGroup label="Final score" fieldId="forfeit-score">
          <div className="rs-forfeit-score">
            <label className="rs-forfeit-score__field" htmlFor="forfeit-home-score">
              <span>{match.homeTeamName}</span>
              <TextInput
                id="forfeit-home-score"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={homeScore}
                aria-label={`${match.homeTeamName} score`}
                onChange={(_e, v) => {
                  setHomeScore(v);
                  setError('');
                }}
              />
            </label>
            <span className="rs-forfeit-score__sep" aria-hidden>
              –
            </span>
            <label className="rs-forfeit-score__field" htmlFor="forfeit-away-score">
              <span>{match.awayTeamName}</span>
              <TextInput
                id="forfeit-away-score"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={awayScore}
                aria-label={`${match.awayTeamName} score`}
                onChange={(_e, v) => {
                  setAwayScore(v);
                  setError('');
                }}
              />
            </label>
          </div>
        </FormGroup>
        {error ? (
          <p className="rs-detail-note rs-detail-note--error" role="alert">
            {error}
          </p>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          Save forfeit
        </Button>
      </ModalFooter>
    </Modal>
  );
}
