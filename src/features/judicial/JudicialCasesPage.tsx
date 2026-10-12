import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  CARD_CONFERENCE_LABELS,
} from '@/domain/reports';
import {
  DISCIPLINE_TREND_BUCKETS,
  DISCIPLINE_TREND_LABELS,
} from '@/domain/cardLaws';
import {
  displayCasePlayer,
  JUDICIAL_CASE_STATUS_LABELS,
  filterJudicialCases,
  rugbySeasonDateRange,
  type JudicialCaseStatus,
} from '@/domain/judicial';
import { downloadJudicialCasesCsv } from '@/domain/judicialExport';
import {
  parseBucketParam,
  parseColorParam,
  parseConferenceParam,
  parseStatusParam,
} from '@/features/judicial/judicialFilters';
import { RsDateField } from '@/ui/RsDateField';
import { FilterDialog } from '@/ui/FilterDialog';

type AdvancedCaseFilters = {
  color: ReturnType<typeof parseColorParam>;
  status: ReturnType<typeof parseStatusParam>;
  school: string;
  bucket: ReturnType<typeof parseBucketParam>;
  official: string;
  player: string;
};

export function JudicialCasesPage() {
  const { state } = useApp();
  const casesHref = useAppHref('/judicial/cases');
  const [params, setParams] = useSearchParams();
  const season = rugbySeasonDateRange();

  const conference = parseConferenceParam(params.get('conference'));
  const from = params.get('from') || season.from;
  const to = params.get('to') || season.to;
  const color = parseColorParam(params.get('color'));
  const status = parseStatusParam(params.get('status'));
  const school = params.get('school') || 'all';
  const bucket = parseBucketParam(params.get('bucket'));
  const official = params.get('official') || 'all';
  const player = params.get('player') || '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedCaseFilters>(() => ({
    color,
    status,
    school,
    bucket,
    official,
    player,
  }));

  const setParam = (key: string, value: string) => {
    const sp = new URLSearchParams(params);
    if (!value || value === 'all') sp.delete(key);
    else if (
      (key === 'from' && value === season.from) ||
      (key === 'to' && value === season.to)
    ) {
      sp.delete(key);
    } else {
      sp.set(key, value);
    }
    setParams(sp, { replace: true });
  };

  const schools = useMemo(() => {
    const names = new Set(
      state.judicialCases.map((c) => c.teamName).filter(Boolean),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [state.judicialCases]);

  const officials = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of state.judicialCases) {
      if (c.officialId) map.set(c.officialId, c.officialName || c.officialId);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [state.judicialCases]);

  const rows = useMemo(() => {
    return [...filterJudicialCases(state.judicialCases, {
      conference,
      from,
      to,
      color,
      status,
      school,
      bucket,
      officialId: official,
      player,
    })].sort((a, b) => {
      const aPend = a.status === 'pending' ? 0 : 1;
      const bPend = b.status === 'pending' ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      const aRed = a.color === 'yellow' ? 1 : 0;
      const bRed = b.color === 'yellow' ? 1 : 0;
      if (aRed !== bRed) return aRed - bRed;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    state.judicialCases,
    conference,
    from,
    to,
    color,
    status,
    school,
    bucket,
    official,
    player,
  ]);
  const advancedCount = [
    color !== 'all',
    status !== 'all',
    school !== 'all',
    bucket !== 'all',
    official !== 'all',
    Boolean(player),
  ].filter(Boolean).length;
  const dateRangeError = from && to && from > to
    ? 'From date must be on or before To date.'
    : null;

  const openFilters = () => {
    setDraft({ color, status, school, bucket, official, player });
    setFiltersOpen(true);
  };

  const applyAdvancedFilters = () => {
    const sp = new URLSearchParams(params);
    const patchAdvanced = (key: string, value: string) => {
      if (!value || value === 'all') sp.delete(key);
      else sp.set(key, value);
    };
    patchAdvanced('color', draft.color);
    patchAdvanced('status', draft.status);
    patchAdvanced('school', draft.school);
    patchAdvanced('bucket', draft.bucket);
    patchAdvanced('official', draft.official);
    patchAdvanced('player', draft.player.trim());
    setParams(sp, { replace: true });
    setFiltersOpen(false);
  };

  return (
    <div className="rs-stack">
      <div className="rs-page-title-row">
        <Title headingLevel="h1" size="lg">
          Cases
        </Title>
        <Button
          variant="secondary"
          onClick={() => downloadJudicialCasesCsv(rows)}
          isDisabled={rows.length === 0}
          aria-describedby={rows.length === 0 ? 'cases-export-help' : undefined}
        >
          Export CSV
        </Button>
      </div>
      <p className="rs-match-card__meta">
        Pending reds first. Comments and rulings are confidential to Judicial
        and Scheduler. {rows.length} matching{' '}
        {rows.length === 1 ? 'case' : 'cases'}.
      </p>
      {rows.length === 0 ? (
        <span id="cases-export-help" className="rs-sr-only">
          Export is unavailable because no cases match the applied filters.
        </span>
      ) : null}
      <div className="rs-filter-bar rs-judicial-cases__filters">
        <div className="rs-filter-bar__row rs-judicial-cases__filter-row">
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Conference</span>
            <FormSelect
              value={conference}
              onChange={(_e, v) => setParam('conference', v)}
              aria-label="Conference"
            >
              <FormSelectOption value="all" label="All" />
              <FormSelectOption
                value="lonestar_men"
                label={CARD_CONFERENCE_LABELS.lonestar_men}
              />
              <FormSelectOption
                value="lonestar_women"
                label={CARD_CONFERENCE_LABELS.lonestar_women}
              />
            </FormSelect>
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">From</span>
            <RsDateField
              value={from}
              aria-label="From date"
              onChange={(next) => setParam('from', next ?? '')}
            />
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">To</span>
            <RsDateField
              value={to}
              aria-label="To date"
              onChange={(next) => setParam('to', next ?? '')}
            />
          </label>
          <Button variant="secondary" onClick={openFilters}>
            Filters
            {advancedCount > 0 ? (
              <span
                className="rs-filter-count"
                aria-label={`${advancedCount} active`}
              >
                {advancedCount}
              </span>
            ) : null}
          </Button>
        </div>
        {dateRangeError ? (
          <p className="rs-field-error" role="alert">
            {dateRangeError}
          </p>
        ) : null}
      </div>

      <FilterDialog
        id="judicial-case-filters"
        open={filtersOpen}
        onCancel={() => setFiltersOpen(false)}
        onClear={() =>
          setDraft({
            color: 'all',
            status: 'all',
            school: 'all',
            bucket: 'all',
            official: 'all',
            player: '',
          })
        }
        onApply={applyAdvancedFilters}
      >
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">Color</span>
          <FormSelect
            value={draft.color}
            onChange={(_e, v) =>
              setDraft((current) => ({
                ...current,
                color: parseColorParam(v),
              }))
            }
            aria-label="Card color"
          >
            <FormSelectOption value="all" label="All" />
            <FormSelectOption value="yellow" label="Yellow" />
            <FormSelectOption value="red" label="Red" />
          </FormSelect>
        </label>
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">Status</span>
          <FormSelect
            value={draft.status}
            onChange={(_e, v) =>
              setDraft((current) => ({
                ...current,
                status: parseStatusParam(v),
              }))
            }
            aria-label="Status"
          >
            <FormSelectOption value="all" label="All" />
            {(Object.keys(JUDICIAL_CASE_STATUS_LABELS) as JudicialCaseStatus[]).map(
              (key) => (
                <FormSelectOption
                  key={key}
                  value={key}
                  label={JUDICIAL_CASE_STATUS_LABELS[key]}
                />
              ),
            )}
          </FormSelect>
        </label>
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">Player</span>
          <TextInput
            value={draft.player}
            onChange={(_e, value) =>
              setDraft((current) => ({ ...current, player: value }))
            }
            aria-label="Player name"
            placeholder="Search by name"
          />
        </label>
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">School</span>
          <FormSelect
            value={draft.school}
            onChange={(_e, value) =>
              setDraft((current) => ({ ...current, school: value }))
            }
            aria-label="School"
          >
            <FormSelectOption value="all" label="All schools" />
            {schools.map((name) => (
              <FormSelectOption key={name} value={name} label={name} />
            ))}
          </FormSelect>
        </label>
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">Infraction</span>
          <FormSelect
            value={draft.bucket}
            onChange={(_e, value) =>
              setDraft((current) => ({
                ...current,
                bucket: parseBucketParam(value),
              }))
            }
            aria-label="Infraction type"
          >
            <FormSelectOption value="all" label="All" />
            {DISCIPLINE_TREND_BUCKETS.map((key) => (
              <FormSelectOption
                key={key}
                value={key}
                label={DISCIPLINE_TREND_LABELS[key]}
              />
            ))}
          </FormSelect>
        </label>
        <label className="rs-filter-field">
          <span className="rs-filter-field__label">Match official</span>
          <FormSelect
            value={draft.official}
            onChange={(_e, value) =>
              setDraft((current) => ({ ...current, official: value }))
            }
            aria-label="Match official"
          >
            <FormSelectOption value="all" label="All officials" />
            {officials.map(([id, name]) => (
              <FormSelectOption key={id} value={id} label={name} />
            ))}
          </FormSelect>
        </label>
      </FilterDialog>
      {rows.length === 0 ? (
        <p className="rs-match-card__meta">No cases match these filters.</p>
      ) : (
        <ul className="rs-stack">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to={`${casesHref}/${c.id}`} className="rs-list-row">
                <span>
                  <strong>{displayCasePlayer(c)}</strong>
                  <span className="rs-match-card__meta">
                    {' '}
                    · {c.teamName}
                    {c.playerJersey ? ` · #${c.playerJersey}` : ''}
                    {c.officialName ? ` · ${c.officialName}` : ''}
                    {c.matchDate ? ` · ${c.matchDate}` : ''}
                    {' · '}
                    {c.color === 'yellow'
                      ? 'Yellow'
                      : c.color === 'second_yellow_red'
                        ? '2nd Yellow–Red'
                        : 'Red'}{' '}
                    · {JUDICIAL_CASE_STATUS_LABELS[c.status]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
