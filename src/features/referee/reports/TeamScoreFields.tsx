import { Checkbox, FormGroup, TextInput } from '@patternfly/react-core';
import type { MoReportPayload } from '@/domain/reports';

export const TOURNAMENT_MATCH_LABEL = 'This is a tournament match';
export const TOURNAMENT_MATCH_DESCRIPTION =
  'In tournaments you may work multiple games in a day. Check this to skip score and card counts.';

export function TournamentMatchCheckbox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      id={id}
      label={TOURNAMENT_MATCH_LABEL}
      description={TOURNAMENT_MATCH_DESCRIPTION}
      isChecked={checked}
      onChange={(_e, value) => onChange(value)}
    />
  );
}

export function TeamScoreCard({
  teamName,
  side,
  points,
  yellow,
  red,
  onPoints,
  onYellow,
  onRed,
  disabled = false,
  idPrefix = '',
}: {
  teamName: string;
  side: 'home' | 'away';
  points: string;
  yellow: string;
  red: string;
  onPoints: (v: string) => void;
  onYellow: (v: string) => void;
  onRed: (v: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const prefix = idPrefix || side;
  return (
    <div className="rs-team-score-card">
      <div className="rs-team-score-card__head">
        <span className="rs-pill rs-pill--ink">
          {side === 'home' ? 'Home' : 'Away'}
        </span>
        <strong>{teamName}</strong>
      </div>
      <div className="rs-form-grid-3">
        <FormGroup
          label="Points"
          isRequired={!disabled}
          fieldId={`${prefix}-pts`}
        >
          <TextInput
            id={`${prefix}-pts`}
            type="number"
            value={points}
            isDisabled={disabled}
            onChange={(_e, v) => onPoints(v)}
          />
        </FormGroup>
        <FormGroup label="YC" isRequired={!disabled} fieldId={`${prefix}-yc`}>
          <TextInput
            id={`${prefix}-yc`}
            type="number"
            min={0}
            value={yellow}
            isDisabled={disabled}
            onChange={(_e, v) => onYellow(v)}
          />
        </FormGroup>
        <FormGroup label="RC" isRequired={!disabled} fieldId={`${prefix}-rc`}>
          <TextInput
            id={`${prefix}-rc`}
            type="number"
            min={0}
            value={red}
            isDisabled={disabled}
            onChange={(_e, v) => onRed(v)}
          />
        </FormGroup>
      </div>
    </div>
  );
}

/** Zeroed score/card payload for tournament matches. */
export function tournamentMoScorePayload(): Pick<
  MoReportPayload,
  | 'homePoints'
  | 'awayPoints'
  | 'homeYellowCards'
  | 'homeRedCards'
  | 'awayYellowCards'
  | 'awayRedCards'
  | 'yellowCards'
  | 'redCards'
> {
  return {
    homePoints: 0,
    awayPoints: 0,
    homeYellowCards: 0,
    homeRedCards: 0,
    awayYellowCards: 0,
    awayRedCards: 0,
    yellowCards: 0,
    redCards: 0,
  };
}
