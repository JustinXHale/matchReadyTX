import { useMemo } from 'react';
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

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Cases
      </Title>
      <p className="rs-match-card__meta">
        Pending reds first. Comments and rulings are confidential to Judicial
        and Scheduler. {rows.length} matching{' '}
        {rows.length === 1 ? 'case' : 'cases'}.
      </p>
      <div className="rs-filter-bar__actions">
        <Button
          variant="secondary"
          onClick={() => downloadJudicialCasesCsv(rows)}
          isDisabled={rows.length === 0}
        >
          Export CSV
        </Button>
      </div>
      <div className="rs-filter-bar">
        <div className="rs-filter-bar__row">
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
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Color</span>
            <FormSelect
              value={color}
              onChange={(_e, v) => setParam('color', v)}
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
              value={status}
              onChange={(_e, v) => setParam('status', v)}
              aria-label="Status"
            >
              <FormSelectOption value="all" label="All" />
              {(Object.keys(JUDICIAL_CASE_STATUS_LABELS) as JudicialCaseStatus[]).map(
                (k) => (
                  <FormSelectOption
                    key={k}
                    value={k}
                    label={JUDICIAL_CASE_STATUS_LABELS[k]}
                  />
                ),
              )}
            </FormSelect>
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Player</span>
            <TextInput
              value={player}
              onChange={(_e, v) => setParam('player', v)}
              aria-label="Player name"
              placeholder="Search by name"
            />
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">School</span>
            <FormSelect
              value={school}
              onChange={(_e, v) => setParam('school', v)}
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
              value={bucket}
              onChange={(_e, v) => setParam('bucket', v)}
              aria-label="Infraction type"
            >
              <FormSelectOption value="all" label="All" />
              {DISCIPLINE_TREND_BUCKETS.map((k) => (
                <FormSelectOption
                  key={k}
                  value={k}
                  label={DISCIPLINE_TREND_LABELS[k]}
                />
              ))}
            </FormSelect>
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Match official</span>
            <FormSelect
              value={official}
              onChange={(_e, v) => setParam('official', v)}
              aria-label="Match official"
            >
              <FormSelectOption value="all" label="All officials" />
              {officials.map(([id, name]) => (
                <FormSelectOption key={id} value={id} label={name} />
              ))}
            </FormSelect>
          </label>
        </div>
      </div>
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
