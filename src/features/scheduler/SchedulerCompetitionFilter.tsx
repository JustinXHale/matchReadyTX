import { useEffect, useMemo, useState } from 'react';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  competitionsForUser,
  filterMatchesByCompetition,
} from '@/domain/competitions';
import type { Match } from '@/domain/types';

const COMPETITION_KEY = 'rs-scheduler-competition';
/** Sentinel: show every competition the user can access. */
export const COMPETITION_ALL = '__all__';

function readStoredCompetition(): string | null {
  try {
    return sessionStorage.getItem(COMPETITION_KEY);
  } catch {
    return null;
  }
}

function writeStoredCompetition(value: string): void {
  try {
    sessionStorage.setItem(COMPETITION_KEY, value);
  } catch {
    /* ignore */
  }
}

/**
 * Shared competition scope for Scheduler Schedule + Queues.
 * Supports All competitions or a single competition. Control shows when the
 * user has at least one competition (All + individuals).
 */
export function useSchedulerCompetition() {
  const { currentUser, state } = useApp();
  const options = useMemo(
    () => competitionsForUser(state.org, currentUser),
    [state.org, currentUser],
  );

  const [selected, setSelectedState] = useState<string>(() => {
    const stored = readStoredCompetition();
    return stored ?? COMPETITION_ALL;
  });

  useEffect(() => {
    if (options.length === 0) {
      setSelectedState(COMPETITION_ALL);
      writeStoredCompetition(COMPETITION_ALL);
      return;
    }
    const stored = readStoredCompetition();
    const next =
      stored === COMPETITION_ALL || (stored && options.includes(stored))
        ? stored!
        : COMPETITION_ALL;
    setSelectedState(next);
    writeStoredCompetition(next);
  }, [options.join('|')]);

  const setSelected = (value: string) => {
    setSelectedState(value);
    writeStoredCompetition(value);
  };

  const showControl = options.length >= 1;
  const activeCompetition =
    selected === COMPETITION_ALL || !options.includes(selected)
      ? null
      : selected;

  const filterMatches = (matches: Match[]) =>
    filterMatchesByCompetition(matches, activeCompetition);

  return {
    options,
    selected:
      selected === COMPETITION_ALL || options.includes(selected)
        ? selected
        : COMPETITION_ALL,
    setSelected,
    showControl,
    filterMatches,
    activeCompetition,
  };
}

export function SchedulerCompetitionFilter({
  options,
  selected,
  setSelected,
  showControl,
}: {
  options: string[];
  selected: string;
  setSelected: (v: string) => void;
  showControl: boolean;
}) {
  if (!showControl) return null;
  return (
    <div className="rs-competition-filter">
      <FormSelect
        id="scheduler-competition"
        value={selected}
        onChange={(_, v) => setSelected(v)}
        aria-label="Competition"
        ouiaId="SchedulerCompetition"
      >
        <FormSelectOption value={COMPETITION_ALL} label="All competitions" />
        {options.map((c) => (
          <FormSelectOption key={c} value={c} label={c} />
        ))}
      </FormSelect>
    </div>
  );
}
