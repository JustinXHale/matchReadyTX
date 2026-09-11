import type {
  MatchDivisionSelection,
  MatchEventType,
  MatchFormatChoice,
  MatchSideChoice,
} from '@/domain/matchDivision';
import {
  matchEventTypeLabel,
  matchFormatChoiceLabel,
  matchSideChoiceLabel,
} from '@/domain/matchDivision';
import { genderLabel, type MatchGender } from '@/domain/types';

type ChipGroupProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel?: (value: T) => string;
  disabled?: boolean;
  onChange: (value: T) => void;
};

function ChipGroup<T extends string>({
  label,
  value,
  options,
  optionLabel = (v) => v,
  disabled = false,
  onChange,
}: ChipGroupProps<T>) {
  return (
    <div
      className={`rs-match-division__row${disabled ? ' rs-match-division__row--disabled' : ''}`}
    >
      <span className="rs-match-division__label">{label}</span>
      <div
        className="rs-slot-picker"
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            className={`rs-filter-chip${
              value === option ? ' rs-filter-chip--selected' : ''
            }`}
            onClick={() => onChange(option)}
          >
            {optionLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

type OptionalSideGroupProps = {
  value: MatchSideChoice | null;
  onChange: (value: MatchSideChoice | null) => void;
};

function OptionalSideGroup({ value, onChange }: OptionalSideGroupProps) {
  const options: MatchSideChoice[] = ['1st', '2nd', '3rd'];
  return (
    <div className="rs-match-division__row">
      <span className="rs-match-division__label">Side</span>
      <div
        className="rs-slot-picker"
        role="group"
        aria-label="Side match (optional)"
      >
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={`rs-filter-chip${
                selected ? ' rs-filter-chip--selected' : ''
              }`}
              onClick={() => onChange(selected ? null : option)}
            >
              {matchSideChoiceLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MatchDivisionPickersProps = {
  division: MatchDivisionSelection;
  tierOptions: string[];
  onChange: (next: MatchDivisionSelection) => void;
};

export function MatchDivisionPickers({
  division,
  tierOptions,
  onChange,
}: MatchDivisionPickersProps) {
  const patch = (partial: Partial<MatchDivisionSelection>) =>
    onChange({ ...division, ...partial });

  const eventTypes: MatchEventType[] = ['league', 'exhibition', 'tournament'];
  const formats: MatchFormatChoice[] = ['xvs', '10s', '7s'];

  return (
    <div className="rs-match-division" aria-label="Match division">
      <ChipGroup<MatchGender>
        label="Gender"
        value={division.gender}
        options={['men', 'women'] as const}
        optionLabel={genderLabel}
        onChange={(gender) => patch({ gender })}
      />
      <ChipGroup
        label="Tier"
        value={division.tier}
        options={tierOptions}
        disabled={division.eventType !== 'league'}
        onChange={(tier) => patch({ tier, eventType: 'league' })}
      />
      <ChipGroup<MatchEventType>
        label="Event"
        value={division.eventType}
        options={eventTypes}
        optionLabel={matchEventTypeLabel}
        onChange={(eventType) => patch({ eventType })}
      />
      <ChipGroup<MatchFormatChoice>
        label="Format"
        value={division.format}
        options={formats}
        optionLabel={matchFormatChoiceLabel}
        onChange={(format) => patch({ format })}
      />
      <OptionalSideGroup
        value={division.side}
        onChange={(side) => patch({ side })}
      />
    </div>
  );
}
