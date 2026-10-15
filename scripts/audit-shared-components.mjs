#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });
}

const scheduleFeeds = [
  'src/features/global/GlobalSchedulePage.tsx',
  'src/features/global/GlobalTeamDetailPage.tsx',
  'src/features/members/SchedulerTeamDetailPage.tsx',
  'src/features/referee/appointments/AppointmentsPage.tsx',
  'src/features/referee/request/GlobalRequestPage.tsx',
  'src/features/referee/request/PendingRequestsPage.tsx',
  'src/features/scheduler/schedule/SchedulerSchedulePage.tsx',
  'src/features/teamAdmin/TeamAdminMatchRow.tsx',
];

const failures = [];
for (const relative of scheduleFeeds) {
  const source = readFileSync(join(ROOT, relative), 'utf8');
  if (!source.includes('MatchSummaryCard')) {
    failures.push(`${relative}: schedule feed must use MatchSummaryCard`);
  }
  if (source.includes('MatchListRow')) {
    failures.push(`${relative}: schedule feed must not use compact MatchListRow`);
  }
  if (
    source.includes("from '@/components/RefereeCard'") &&
    source.includes('MatchSummaryCard')
  ) {
    failures.push(`${relative}: import the shared MatchSummaryCard API`);
  }
}

const matchSummaryConsumers = [];
for (const absolute of sourceFiles(join(ROOT, 'src'))) {
  const source = readFileSync(absolute, 'utf8');
  if (!source.includes('<MatchSummaryCard')) continue;
  const relative = absolute.slice(ROOT.length + 1);
  matchSummaryConsumers.push(relative);
  if (!source.includes("from '@/components/MatchSummaryCard'")) {
    failures.push(`${relative}: import MatchSummaryCard from its canonical shared API`);
  }
  if (source.includes("from '@/components/RefereeCard'")) {
    failures.push(`${relative}: must not import the persona-specific implementation`);
  }
}

const sharedCardContracts = [
  {
    file: 'src/components/RefereeCard.tsx',
    includes: [
      'className="rs-match-summary-card"',
      'aria-label="Game type"',
      'aria-label="Assignment status"',
      'const homeScore = scored',
      'const awayScore = scored',
      'matchTeamConfirmationState',
      'TeamConfirmationChip',
      'hidePrimaryStatus',
      'emphasizeOfficialNeeded',
      "data-card-emphasis={officialNeededEmphasis ? 'official-needed' : undefined}",
      "data-match-inactive={inactiveMatch ? 'true' : undefined}",
      't.palette.outlineVariant',
    ],
  },
  {
    file: 'src/ui/MatchListRow.tsx',
    includes: [
      'rs-list-row__chips--identity',
      'rs-list-row__team-confirmation',
      'matchTeamConfirmationState',
      'aria-label="Game type"',
      'aria-label="Match status"',
    ],
  },
  {
    file: 'src/features/scheduler/schedule/SchedulerSchedulePage.tsx',
    includes: [
      "rolesNeededForMatch(m).includes('mo')",
      'crewPeople(m.crew.mo).length === 0',
      'emphasizeOfficialNeeded={needsOpenMo}',
    ],
  },
  {
    file: 'src/features/scheduler/queues/FixtureRequestQueue.tsx',
    includes: ['rs-list-row__chips--identity', 'rs-list-row__top-banner'],
  },
  {
    file: 'src/styles/shell/list-row.css',
    includes: [
      '--rs-card-outline: var(--rs-color-surface-border)',
      'border-bottom: 1px solid var(--rs-card-outline)',
      'border-top: 1px solid var(--rs-card-outline)',
      'border-left: 1px solid var(--rs-card-outline)',
    ],
  },
  {
    file: 'src/styles/shell/layout.css',
    includes: [
      'border: 1px solid var(--rs-color-surface-border) !important',
      'background: var(--rs-content-surface) !important',
    ],
  },
  {
    file: 'src/features/global/GlobalSchedulePage.tsx',
    includes: [
      'ScheduleMatchListWithPast',
      'rowEnd={',
      "setSortDir(sortDir === 'asc' ? 'desc' : 'asc')",
    ],
    excludes: ['GlobalScheduleSubNav', 'Date ascending', 'Date descending'],
  },
  {
    file: 'src/features/global/GlobalStandingsPage.tsx',
    includes: ['rowEnd={', 'All teams', 'By tier'],
  },
  {
    file: 'src/features/referee/reports/CoachingReportsPage.tsx',
    includes: ["const showingCmo = isCmoLens", "const showingMine = !isCmoLens"],
    excludes: ['CoachingSubNav'],
  },
  {
    file: 'src/features/referee/appointments/AppointmentsPage.tsx',
    includes: [
      'MatchActionPrompt',
      'primaryLabel="Accept"',
      'secondaryLabel="Decline"',
      'hidePrimaryStatus={awaitingResponse}',
      'Decline appointment?',
      'callMatchSelfService',
    ],
  },
  {
    file: 'src/features/teamAdmin/TeamAdminHomePage.tsx',
    includes: ['role="tablist"', 'role="tab"', 'hideLevels'],
    excludes: ['setLevelFilter'],
  },
  {
    file: 'src/ui/ReportAttributionFooter.tsx',
    includes: [
      'rs-report-attribution__rating',
      'rs-report-attribution__position',
      'rs-report-attribution__name',
    ],
  },
  {
    file: 'src/features/referee/appointments/crewLines.ts',
    includes: ['compactCrewPersonName', 'compactCrewPersonName(view.userName)', 'compactCrewPersonName(a.userName)'],
  },
  ...[
    'src/features/scheduler/feedback/SchedulerFeedbackPage.tsx',
    'src/features/insights/InsightsCmoReportsPage.tsx',
    'src/features/insights/InsightsCoachFeedbackPage.tsx',
  ].map((file) => ({
    file,
    includes: ['ReportAttributionFooter', 'footer={attribution}'],
    excludes: ['trailing={trailing}'],
  })),
];

for (const contract of sharedCardContracts) {
  const source = readFileSync(join(ROOT, contract.file), 'utf8');
  for (const expected of contract.includes) {
    if (!source.includes(expected)) {
      failures.push(`${contract.file}: missing shared card contract: ${expected}`);
    }
  }
  for (const forbidden of contract.excludes ?? []) {
    if (source.includes(forbidden)) {
      failures.push(`${contract.file}: forbidden inconsistent pattern: ${forbidden}`);
    }
  }
}

const filterOwners = [
  'src/features/referee/request/GlobalRequestPage.tsx',
  'src/features/scheduler/schedule/SchedulerSchedulePage.tsx',
];
for (const relative of filterOwners) {
  const source = readFileSync(join(ROOT, relative), 'utf8');
  if (!source.includes('MatchFilterSummary')) {
    failures.push(`${relative}: date + filter trigger must use MatchFilterSummary`);
  }
  if (source.includes('className="rs-filter-summary"')) {
    failures.push(`${relative}: duplicated filter-summary markup`);
  }
}

if (failures.length > 0) {
  console.error('audit:components FAILED');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `audit:components OK — ${matchSummaryConsumers.length} shared-card consumers, ${scheduleFeeds.length} schedule feeds, ${filterOwners.length} filter bars, and ${sharedCardContracts.length} card contracts use shared primitives`,
);
