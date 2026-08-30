import { CARD_LAW_LABELS } from '@/domain/cardLaws';
import { CARD_CONFERENCE_LABELS } from '@/domain/reports';
import {
  displayCasePlayer,
  JUDICIAL_CASE_STATUS_LABELS,
  type JudicialCase,
} from '@/domain/judicial';

function csvCell(value: string | number | undefined | null): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function lawLabels(c: JudicialCase): string {
  return c.lawIds.map((id) => CARD_LAW_LABELS[id]).join('; ');
}

const CSV_HEADERS = [
  'match_date',
  'conference',
  'team',
  'player_first',
  'player_last',
  'player_display',
  'jersey',
  'color',
  'status',
  'laws',
  'offense_summary',
  'official',
  'match_id',
  'case_id',
  'sanction_matches',
  'sanction_note',
  'ruled_at',
  'ruled_by',
] as const;

export function judicialCasesToCsv(cases: JudicialCase[]): string {
  const rows = cases.map((c) =>
    [
      c.matchDate?.slice(0, 10) ?? '',
      c.conference ? CARD_CONFERENCE_LABELS[c.conference] : '',
      c.teamName,
      c.playerFirstName,
      c.playerLastName,
      displayCasePlayer(c),
      c.playerJersey ?? '',
      c.color,
      JUDICIAL_CASE_STATUS_LABELS[c.status],
      lawLabels(c),
      c.offenseSummary,
      c.officialName ?? '',
      c.matchId,
      c.id,
      c.sanctionMatches ?? '',
      c.sanctionNote ?? '',
      c.ruledAt ?? '',
      c.ruledByName ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function downloadJudicialCasesCsv(
  cases: JudicialCase[],
  filename = 'judicial-cases.csv',
): void {
  const csv = judicialCasesToCsv(cases);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
