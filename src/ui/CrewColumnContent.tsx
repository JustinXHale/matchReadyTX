import { Link } from 'react-router-dom';
import type { CrewColumnLine } from '@/features/referee/appointments/crewLines';
import { backState, type BackNav } from '@/nav/backNav';

function lineClassName(line: CrewColumnLine, base: string): string {
  const classes = [base];
  if (line.doubleBooked) classes.push(`${base}--overlap`);
  if (line.confirmed) classes.push(`${base}--confirmed`);
  return classes.join(' ');
}

function CrewLineValue({ line }: { line: CrewColumnLine }) {
  return (
    <span className="rs-appt-crew__content">
      {line.confirmed ? (
        <span className="rs-appt-crew__check" aria-hidden>
          ✓
        </span>
      ) : null}
      <span className="rs-appt-crew__slot">{line.slotLabel}</span>{' '}
      {line.value}
      {line.doubleBooked ? (
        <span className="rs-sr-only"> (double-booked)</span>
      ) : null}
      {line.confirmed ? (
        <span className="rs-sr-only"> (confirmed)</span>
      ) : null}
    </span>
  );
}

function CrewColumnLineBody({ line }: { line: CrewColumnLine }) {
  if (line.isMine) {
    const classes = ['rs-appt-crew__line', 'rs-appt-crew__mine'];
    if (line.doubleBooked) classes.push('rs-appt-crew__line--overlap');
    if (line.confirmed) classes.push('rs-appt-crew__line--confirmed');
    return (
      <span className={classes.join(' ')}>
        <CrewLineValue line={line} />
      </span>
    );
  }
  return (
    <p className={lineClassName(line, 'rs-appt-crew__line')}>
      <CrewLineValue line={line} />
    </p>
  );
}

/** Shared crew column lines — read-only, assignable open slots, or link-wrapped. */
export function CrewColumnContent({
  lines,
  onAssignOpen,
  matchTo,
  back,
}: {
  lines: CrewColumnLine[];
  /** When set, open lines render as assign buttons instead of plain text. */
  onAssignOpen?: (target: NonNullable<CrewColumnLine['assignTarget']>) => void;
  /** When set without onAssignOpen, the whole column links to the match. */
  matchTo?: string;
  back?: BackNav;
}) {
  const linkState = back ? backState(back) : undefined;

  if (matchTo && !onAssignOpen) {
    return (
      <Link
        to={matchTo}
        state={linkState}
        className="rs-appt-crew rs-appt-crew-hit"
        aria-label="Open match crew"
        onClick={(e) => e.stopPropagation()}
      >
        {lines.map((line) => (
          <CrewColumnLineBody key={line.id} line={line} />
        ))}
      </Link>
    );
  }

  return (
    <div className="rs-appt-crew">
      {lines.map((line) => {
        if (line.assignTarget && onAssignOpen) {
          return (
            <button
              key={line.id}
              type="button"
              className="rs-appt-crew__line rs-appt-crew__assign"
              aria-label={`Assign ${line.slotLabel}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAssignOpen(line.assignTarget!);
              }}
            >
              <span className="rs-appt-crew__slot">{line.slotLabel}</span> Open
            </button>
          );
        }
        if (matchTo) {
          return (
            <Link
              key={line.id}
              to={matchTo}
              state={linkState}
              className={lineClassName(line, 'rs-appt-crew__line') + ' rs-appt-crew-hit'}
              onClick={(e) => e.stopPropagation()}
            >
              <CrewLineValue line={line} />
            </Link>
          );
        }
        return <CrewColumnLineBody key={line.id} line={line} />;
      })}
    </div>
  );
}
