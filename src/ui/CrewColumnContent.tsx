import { Link } from 'react-router-dom';
import type { CrewColumnLine } from '@/features/referee/appointments/crewLines';
import { backState, type BackNav } from '@/nav/backNav';

function CrewColumnLineBody({ line }: { line: CrewColumnLine }) {
  if (line.isMine) {
    return (
      <span className="rs-pill rs-appt-crew__mine">
        {line.slotLabel} {line.value}
      </span>
    );
  }
  return (
    <p className="rs-appt-crew__line">
      <span className="rs-appt-crew__slot">{line.slotLabel}</span> {line.value}
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
              className="rs-appt-crew__line rs-appt-crew-hit"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="rs-appt-crew__slot">{line.slotLabel}</span>{' '}
              {line.value}
            </Link>
          );
        }
        return <CrewColumnLineBody key={line.id} line={line} />;
      })}
    </div>
  );
}
