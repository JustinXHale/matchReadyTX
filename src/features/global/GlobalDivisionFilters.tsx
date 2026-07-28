import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';

/** Shared Men/Women + level chips for Global Schedule / Standings / Teams. */
export function GlobalDivisionFilters({
  levels,
  genderFilter,
  levelFilter,
  onGenderChange,
  onLevelChange,
  ariaLabel = 'Filter by division',
}: {
  levels: string[];
  genderFilter: MatchGender | null;
  levelFilter: string | null;
  onGenderChange: (next: MatchGender | null) => void;
  onLevelChange: (next: string | null) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="rs-filter-chips" role="group" aria-label={ariaLabel}>
      {(['men', 'women'] as MatchGender[]).map((g) => (
        <button
          key={g}
          type="button"
          className={`rs-filter-chip${genderFilter === g ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={genderFilter === g}
          onClick={() => onGenderChange(genderFilter === g ? null : g)}
        >
          {genderLabel(g)}
        </button>
      ))}
      <span className="rs-filter-sep" aria-hidden>
        |
      </span>
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          className={`rs-filter-chip${levelFilter === level ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={levelFilter === level}
          onClick={() => onLevelChange(levelFilter === level ? null : level)}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
