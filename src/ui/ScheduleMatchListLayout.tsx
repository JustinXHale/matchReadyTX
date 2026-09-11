import { Title } from '@patternfly/react-core';
import type { ReactNode } from 'react';
import type { MatchMonthGroup } from '@/domain/matchTime';

type KickoffMatchRef = { id: string; kickoffAt: string };

export function MatchMonthSections<T extends KickoffMatchRef>({
  groups,
  renderMatchRow,
}: {
  groups: MatchMonthGroup<T>[];
  renderMatchRow: (match: T) => ReactNode;
}) {
  return groups.map((group) => (
    <section key={group.key} className="rs-month-section">
      <Title headingLevel="h3" size="md" className="rs-month-heading">
        {group.label}
      </Title>
      <ul className="rs-list">{group.matches.map((m) => renderMatchRow(m))}</ul>
    </section>
  ));
}

export function PastScheduleMatchesDisclosure<T extends KickoffMatchRef>({
  groups,
  count,
  renderMatchRow,
}: {
  groups: MatchMonthGroup<T>[];
  count: number;
  renderMatchRow: (match: T) => ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details className="rs-detail-tools rs-schedule-past">
      <summary>Past games ({count})</summary>
      <div className="rs-schedule-past__body">
        <MatchMonthSections groups={groups} renderMatchRow={renderMatchRow} />
      </div>
    </details>
  );
}

export function SchedulePastOnlyHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="rs-match-card__meta rs-schedule-past-hint">
      No upcoming games match these filters. Expand past games above.
    </p>
  );
}

export function ScheduleMatchListWithPast<T extends KickoffMatchRef>({
  upcomingByMonth,
  pastByMonth,
  pastCount,
  showPastCollapsed,
  renderMatchRow,
}: {
  upcomingByMonth: MatchMonthGroup<T>[];
  pastByMonth: MatchMonthGroup<T>[];
  pastCount: number;
  showPastCollapsed: boolean;
  renderMatchRow: (match: T) => ReactNode;
}) {
  return (
    <>
      {showPastCollapsed ? (
        <PastScheduleMatchesDisclosure
          groups={pastByMonth}
          count={pastCount}
          renderMatchRow={renderMatchRow}
        />
      ) : null}
      <SchedulePastOnlyHint
        show={showPastCollapsed && upcomingByMonth.length === 0}
      />
      <MatchMonthSections groups={upcomingByMonth} renderMatchRow={renderMatchRow} />
    </>
  );
}
