import { useMemo, useState } from 'react';
import { Button, TextInput, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { defaultFees } from '@/domain/economics';
import {
  feeInputFromTable,
  feeTableFromInput,
  matchesForFeeApply,
  type FeeDefaultsInput,
} from '@/domain/feeDefaults';
import type { MatchGender } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  applyFeeDefaultsToMatchesInFirestore,
  defaultOrgId,
  saveOrgCrewSettings,
} from '@/services/orgData';
import { RsDateField } from '@/ui/RsDateField';
import '@/features/scheduler/scheduler.css';

const FEE_SLOTS: { key: keyof FeeDefaultsInput; label: string }[] = [
  { key: 'mo', label: 'MO' },
  { key: 'ar', label: 'AR' },
  { key: 'no4', label: '#4' },
  { key: 'cmo', label: 'CMO' },
];

function parseFeeInput(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function FeeRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: FeeDefaultsInput;
  onChange: (patch: Partial<FeeDefaultsInput>) => void;
}) {
  return (
    <div className="rs-scheduler-fee-row-wrap">
      <span className="rs-match-card__meta">{label}</span>
      <div className="rs-filter-bar__row rs-scheduler-fee-row">
        {FEE_SLOTS.map(({ key, label: slotLabel }) => (
          <label key={key} className="rs-filter-field">
            <span className="rs-filter-field__label">{slotLabel}</span>
            <TextInput
              aria-label={`${label} ${slotLabel} fee`}
              type="number"
              step="1"
              value={String(values[key])}
              onChange={(_, v) =>
                onChange({ [key]: parseFeeInput(v, values[key]) })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function FeeDefaultsPanel({
  competitionFilter,
  genderFilter,
}: {
  competitionFilter: string | null;
  genderFilter: MatchGender | null;
}) {
  const { state, store, refresh } = useApp();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [league, setLeague] = useState<FeeDefaultsInput>(() =>
    feeInputFromTable(state.org.defaultFees ?? defaultFees()),
  );
  const [tourney, setTourney] = useState<FeeDefaultsInput>(() =>
    feeInputFromTable(
      state.org.defaultFeesTourney ??
        state.org.defaultFees ??
        defaultFees(),
    ),
  );
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const leagueTable = useMemo(() => feeTableFromInput(league), [league]);
  const tourneyTable = useMemo(() => feeTableFromInput(tourney), [tourney]);

  const savedLeague = feeInputFromTable(state.org.defaultFees ?? defaultFees());
  const savedTourney = feeInputFromTable(
    state.org.defaultFeesTourney ?? state.org.defaultFees ?? defaultFees(),
  );

  const dirty =
    JSON.stringify(league) !== JSON.stringify(savedLeague) ||
    JSON.stringify(tourney) !== JSON.stringify(savedTourney);

  const applyCount = useMemo(
    () =>
      matchesForFeeApply(state.matches, {
        periodStart,
        periodEnd,
        competition: competitionFilter,
        gender: genderFilter,
      }).length,
    [state.matches, periodStart, periodEnd, competitionFilter, genderFilter],
  );

  const save = async () => {
    setNote(null);
    setBusy('save');
    try {
      store.setOrgFeeDefaults(leagueTable, tourneyTable);
      if (isFirebaseConfigured) {
        await saveOrgCrewSettings(defaultOrgId(), {
          defaultFees: leagueTable,
          defaultFeesTourney: tourneyTable,
        });
      }
      setNote('Fee defaults saved for this society.');
      refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Failed to save fee defaults.');
    } finally {
      setBusy(null);
    }
  };

  const applyToRange = async () => {
    setNote(null);
    setBusy('apply');
    try {
      if (dirty) {
        store.setOrgFeeDefaults(leagueTable, tourneyTable);
        if (isFirebaseConfigured) {
          await saveOrgCrewSettings(defaultOrgId(), {
            defaultFees: leagueTable,
            defaultFeesTourney: tourneyTable,
          });
        }
      }
      const opts = {
        periodStart,
        periodEnd,
        league: leagueTable,
        tourney: tourneyTable,
        competition: competitionFilter,
        gender: genderFilter,
      };
      let n = 0;
      if (isFirebaseConfigured) {
        n = await applyFeeDefaultsToMatchesInFirestore(
          defaultOrgId(),
          state.matches,
          opts,
        );
      } else {
        n = store.applyFeeDefaultsToMatches(opts);
      }
      setNote(
        n > 0
          ? `Updated fees on ${n} match(es) in this range.`
          : 'No released matches in this range for the current filters.',
      );
      refresh();
    } catch (err) {
      setNote(
        err instanceof Error ? err.message : 'Failed to apply fees to matches.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rs-detail-card rs-stack" aria-label="Default match fees">
      <Title headingLevel="h2" size="lg">
        Default match fees
      </Title>
      <p className="rs-match-card__meta">
        Set society payout rates for league matches and tournament levels (Tourney,
        7s, etc.). Save stores defaults for new work. Apply writes fees to every
        match in the date range below — filtered by the competition and gender
        chips above when set.
      </p>

      <div className="rs-filter-bar">
        <div className="rs-filter-bar__row">
          <label className="rs-filter-field rs-filter-field--date">
            <span className="rs-filter-field__label">From</span>
            <RsDateField
              id="fee-default-from"
              aria-label="Fee apply from"
              value={periodStart}
              onChange={(v) => setPeriodStart(v ?? periodStart)}
            />
          </label>
          <label className="rs-filter-field rs-filter-field--date">
            <span className="rs-filter-field__label">To</span>
            <RsDateField
              id="fee-default-to"
              aria-label="Fee apply to"
              value={periodEnd}
              onChange={(v) => setPeriodEnd(v ?? periodEnd)}
            />
          </label>
        </div>
      </div>

      <FeeRow label="League / standard" values={league} onChange={(p) => setLeague((prev) => ({ ...prev, ...p }))} />
      <FeeRow label="Tournament" values={tourney} onChange={(p) => setTourney((prev) => ({ ...prev, ...p }))} />

      <div className="rs-actions">
        <Button
          variant="primary"
          isDisabled={!dirty || busy != null}
          isLoading={busy === 'save'}
          onClick={() => void save()}
        >
          Save fee defaults
        </Button>
        <Button
          variant="secondary"
          isDisabled={busy != null || applyCount === 0}
          isLoading={busy === 'apply'}
          onClick={() => void applyToRange()}
        >
          Apply to matches in range
          {applyCount > 0 ? ` (${applyCount})` : ''}
        </Button>
      </div>
      {note && (
        <p className="rs-match-card__meta" role="status">
          {note}
        </p>
      )}
    </section>
  );
}
