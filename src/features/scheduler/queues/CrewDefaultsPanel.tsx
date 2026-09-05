import { useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  divisionFilterOptionsFromMatches,
  matchMatchesDivisionFilters,
} from '@/domain/divisionFilters';
import {
  resolveCrewDefaultsForLevel,
  matchEligibleForCrewDefaultsReapply,
  type DefaultCrewByLevel,
} from '@/domain/crewDefaults';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import {
  REQUESTABLE_SLOT_SHORT,
  type MatchGender,
  type RequestableSlot,
} from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  applyCrewDefaultsToStockMatchesInFirestore,
  defaultOrgId,
  saveOrgCrewSettings,
} from '@/services/orgData';

const ROLE_OPTIONS: RequestableSlot[] = ['mo', 'ar1', 'ar2', 'no4', 'cmo'];

function toggleRole(
  roles: RequestableSlot[],
  slot: RequestableSlot,
): RequestableSlot[] {
  if (slot === 'mo') return ['mo'];
  const set = new Set(roles);
  if (set.has(slot)) set.delete(slot);
  else set.add(slot);
  set.add('mo');
  return ROLE_OPTIONS.filter((r) => set.has(r));
}

export function CrewDefaultsPanel() {
  const { state, store, refresh } = useApp();
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [local, setLocal] = useState<DefaultCrewByLevel>(
    () => ({ ...(state.org.defaultCrewByLevel ?? {}) }),
  );
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches),
    [state.matches],
  );

  const narrowedMatches = useMemo(() => {
    return state.matches.filter((m) =>
      matchMatchesDivisionFilters(
        m,
        genderFilter,
        null,
        competitionFilter,
      ),
    );
  }, [state.matches, genderFilter, competitionFilter]);

  const levelOptions = useMemo(
    () => divisionFilterOptionsFromMatches(narrowedMatches).levels,
    [narrowedMatches],
  );

  /** Derive active level so filter narrowing never needs a syncing useEffect. */
  const currentLevel =
    levelFilter && levelOptions.includes(levelFilter)
      ? levelFilter
      : (levelOptions[0] ?? '');

  const displayOptions = useMemo(
    () => ({
      competitions: filterOptions.competitions,
      genders: filterOptions.genders,
      levels: levelOptions.length ? levelOptions : filterOptions.levels,
      formats: filterOptions.formats,
    }),
    [filterOptions, levelOptions],
  );

  const currentRoles = useMemo(() => {
    if (!currentLevel) return ['mo'] as RequestableSlot[];
    return resolveCrewDefaultsForLevel(currentLevel, local).roles;
  }, [currentLevel, local]);

  const stockMatchCount = useMemo(
    () => state.matches.filter((m) => matchEligibleForCrewDefaultsReapply(m)).length,
    [state.matches],
  );

  const dirty =
    JSON.stringify(local) !==
    JSON.stringify(state.org.defaultCrewByLevel ?? {});

  const setRolesForLevel = (level: string, roles: RequestableSlot[]) => {
    setLocal((prev) => ({
      ...prev,
      [level]: { roles },
    }));
  };

  const save = async () => {
    setNote(null);
    setBusy('save');
    try {
      store.setOrgCrewDefaults(local);
      if (isFirebaseConfigured) {
        await saveOrgCrewSettings(defaultOrgId(), {
          defaultCrewByLevel: local,
        });
      }
      setNote('Crew defaults saved.');
      refresh();
    } catch (err) {
      setNote(
        err instanceof Error ? err.message : 'Failed to save crew defaults.',
      );
    } finally {
      setBusy(null);
    }
  };

  const applyToStock = async () => {
    setNote(null);
    setBusy('apply');
    try {
      const defaults = dirty ? local : state.org.defaultCrewByLevel;
      if (dirty) {
        store.setOrgCrewDefaults(local);
        if (isFirebaseConfigured) {
          await saveOrgCrewSettings(defaultOrgId(), {
            defaultCrewByLevel: local,
          });
        }
      }
      let n = 0;
      if (isFirebaseConfigured) {
        n = await applyCrewDefaultsToStockMatchesInFirestore(
          defaultOrgId(),
          state.matches,
          defaults,
        );
      } else {
        n = store.applyCrewDefaultsToStockMatches(defaults);
      }
      setNote(
        n > 0
          ? `Applied defaults to ${n} match(es) with no MO or AR assigned.`
          : 'No matches without MO/AR to update.',
      );
      refresh();
    } catch (err) {
      setNote(
        err instanceof Error ? err.message : 'Failed to apply crew defaults.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (state.matches.length === 0) {
    return (
      <p className="rs-match-card__meta">
        Sync your Schedule sheet first — crew defaults are configured per level
        found in synced matches.
      </p>
    );
  }

  if (levelOptions.length === 0) {
    return (
      <p className="rs-match-card__meta">
        No levels in the current filter. Clear competition or gender chips, or
        sync matches with a level / tier column.
      </p>
    );
  }

  return (
    <div className="rs-stack">
      <p className="rs-match-card__meta">
        Set default official roles per level from your sheet. Save stores
        settings for future syncs and releases. Apply updates matches with no
        MO or AR assigned yet.
      </p>

      <GlobalDivisionFilters
        options={displayOptions}
        genderFilter={genderFilter}
        levelFilter={currentLevel || levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        showSingleLevel
        stageSecondary={false}
        ariaLabel="Pick level and filter from synced schedule"
      />

      {currentLevel && (
        <section
          className="rs-detail-card"
          aria-label={`Default roles for ${currentLevel}`}
        >
          <div
            className="rs-filter-chips"
            role="group"
            aria-label={`Roles for ${currentLevel}`}
          >
            {ROLE_OPTIONS.map((slot) => {
              const selected = currentRoles.includes(slot);
              const disabled = slot === 'mo';
              return (
                <button
                  key={slot}
                  type="button"
                  className={`rs-filter-chip${
                    selected ? ' rs-filter-chip--selected' : ''
                  }`}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() =>
                    setRolesForLevel(
                      currentLevel,
                      toggleRole(currentRoles, slot),
                    )
                  }
                >
                  {REQUESTABLE_SLOT_SHORT[slot]}
                </button>
              );
            })}
          </div>
          <p className="rs-match-card__meta pf-v6-u-mt-sm">
            MO is always required. Pick a level chip above, then toggle roles
            for that tier.
          </p>
        </section>
      )}

      <div className="rs-actions">
        <Button
          variant="primary"
          isDisabled={!dirty || busy != null}
          isLoading={busy === 'save'}
          onClick={() => void save()}
        >
          Save crew defaults
        </Button>
        <Button
          variant="secondary"
          isDisabled={busy != null || stockMatchCount === 0}
          isLoading={busy === 'apply'}
          onClick={() => void applyToStock()}
        >
          Apply to unassigned MO/AR
          {stockMatchCount > 0 ? ` (${stockMatchCount})` : ''}
        </Button>
      </div>
      {note && (
        <p className="rs-match-card__meta" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
