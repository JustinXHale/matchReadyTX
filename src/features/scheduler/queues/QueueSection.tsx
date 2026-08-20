import { Title } from '@patternfly/react-core';
import type { ReactNode } from 'react';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';

export function QueueSection({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rs-queue-section" aria-labelledby={id}>
      <Title
        headingLevel="h3"
        size="md"
        id={id}
        className="rs-queue-section__title"
      >
        {title}
        {count > 0 && (
          <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
            {formatDueBadge(count)}
          </span>
        )}
      </Title>
      {children}
    </section>
  );
}
