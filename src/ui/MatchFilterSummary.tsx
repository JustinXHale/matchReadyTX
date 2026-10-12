import { Button } from '@patternfly/react-core';
import { RsDateField } from '@/ui/RsDateField';

export function MatchFilterSummary({
  ariaLabel,
  dateValue,
  availableDates,
  onDateChange,
  activeFilterCount,
  onOpenFilters,
}: {
  ariaLabel: string;
  dateValue: string | null;
  availableDates: string[];
  onDateChange: (next: string | null) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}) {
  return (
    <div className="rs-filter-summary" role="group" aria-label={ariaLabel}>
      <label className="rs-filter-field rs-filter-field--date">
        <span className="rs-filter-field__label">Date</span>
        <RsDateField
          className="rs-filter-date"
          value={dateValue ?? ''}
          aria-label="Filter by date"
          availableDates={availableDates}
          onChange={onDateChange}
        />
      </label>
      <Button variant="secondary" onClick={onOpenFilters}>
        Filters
        {activeFilterCount > 0 ? (
          <span
            className="rs-filter-count"
            aria-label={`${activeFilterCount} active`}
          >
            {activeFilterCount}
          </span>
        ) : null}
      </Button>
    </div>
  );
}
