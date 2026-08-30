import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DisciplineTrendBucket } from '@/domain/cardLaws';
import {
  judicialCasesQuery,
  rugbySeasonDateRange,
  type JudicialCaseStatus,
} from '@/domain/judicial';
import type { CardConference } from '@/domain/reports';

export type ConferenceFilter = CardConference | 'all';
export type ColorFilter = 'all' | 'yellow' | 'red';
export type StatusFilter = JudicialCaseStatus | 'all';
export type BucketFilter = DisciplineTrendBucket | 'all';

export function parseConferenceParam(raw: string | null): ConferenceFilter {
  if (raw === 'lonestar_men' || raw === 'lonestar_women') return raw;
  return 'all';
}

export function parseColorParam(raw: string | null): ColorFilter {
  if (raw === 'yellow' || raw === 'red') return raw;
  return 'all';
}

export function parseStatusParam(raw: string | null): StatusFilter {
  if (
    raw === 'recorded' ||
    raw === 'pending' ||
    raw === 'upheld' ||
    raw === 'dismissed' ||
    raw === 'reduced' ||
    raw === 'summary_judgment'
  ) {
    return raw;
  }
  return 'all';
}

export function parseBucketParam(raw: string | null): BucketFilter {
  if (
    raw === 'dangerous_tackles' ||
    raw === 'repeated_infringements' ||
    raw === 'physical_foul_play' ||
    raw === 'cynical_professional' ||
    raw === 'other_technical'
  ) {
    return raw;
  }
  return 'all';
}

/** Dashboard: conference + season dates (shared with caseload drill-down). */
export function useJudicialSeasonParams() {
  const [params, setParams] = useSearchParams();
  const season = useMemo(() => rugbySeasonDateRange(), []);
  const conference = parseConferenceParam(params.get('conference'));
  const from = params.get('from') || season.from;
  const to = params.get('to') || season.to;

  const patch = useCallback(
    (next: { conference?: ConferenceFilter; from?: string; to?: string }) => {
      const sp = new URLSearchParams(params);
      if (next.conference != null) {
        if (next.conference === 'all') sp.delete('conference');
        else sp.set('conference', next.conference);
      }
      if (next.from != null) {
        if (!next.from || next.from === season.from) sp.delete('from');
        else sp.set('from', next.from);
      }
      if (next.to != null) {
        if (!next.to || next.to === season.to) sp.delete('to');
        else sp.set('to', next.to);
      }
      setParams(sp, { replace: true });
    },
    [params, season.from, season.to, setParams],
  );

  const withSeason = (extra: Record<string, string | undefined> = {}) =>
    judicialCasesQuery({
      conference,
      from,
      to,
      ...extra,
    });

  return { conference, from, to, patch, withSeason, season };
}
