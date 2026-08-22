import { useMemo } from 'react';
import { Checkbox, FormGroup, TextArea } from '@patternfly/react-core';
import type { CrewAttendanceEntry } from '@/domain/reports';
import { REQUESTABLE_SLOT_SHORT } from '@/domain/types';

type Props = {
  crewAttendance: CrewAttendanceEntry[];
  onAttendanceChange: (next: CrewAttendanceEntry[]) => void;
  crewAbsenceNote: string;
  onAbsenceNoteChange: (next: string) => void;
  crewIssuesNote: string;
  onIssuesNoteChange: (next: string) => void;
  idPrefix?: string;
};

export function CrewAttendanceFields({
  crewAttendance,
  onAttendanceChange,
  crewAbsenceNote,
  onAbsenceNoteChange,
  crewIssuesNote,
  onIssuesNoteChange,
  idPrefix = 'attend',
}: Props) {
  const someoneAbsent = useMemo(
    () => crewAttendance.some((c) => !c.attended),
    [crewAttendance],
  );

  return (
    <div className="rs-team-score-card">
      <div className="rs-team-score-card__head">
        <strong>Referee team attendance</strong>
      </div>
      <p className="rs-scale-field__criteria">
        Assumed present by default. Uncheck anyone who did not attend.
      </p>
      {crewAttendance.length === 0 ? (
        <p className="rs-match-card__meta">No other crew listed on this match.</p>
      ) : (
        <ul className="rs-crew-attend">
          {crewAttendance.map((c) => (
            <li key={`${c.slot}-${c.userId}`}>
              <Checkbox
                id={`${idPrefix}-${c.slot}-${c.userId}`}
                label={`${REQUESTABLE_SLOT_SHORT[c.slot]} · ${c.userName}`}
                isChecked={c.attended}
                onChange={(_e, checked) =>
                  onAttendanceChange(
                    crewAttendance.map((row) =>
                      row.slot === c.slot && row.userId === c.userId
                        ? { ...row, attended: checked }
                        : row,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {someoneAbsent && (
        <FormGroup
          label="Who did not attend / what happened?"
          isRequired
          fieldId={`${idPrefix}-absent`}
        >
          <TextArea
            id={`${idPrefix}-absent`}
            value={crewAbsenceNote}
            onChange={(_e, v) => onAbsenceNoteChange(v)}
            rows={2}
            placeholder="e.g. AR2 no-show; covered by #4"
          />
        </FormGroup>
      )}
      <FormGroup
        label="Any issues with someone on the referee team?"
        fieldId={`${idPrefix}-issues`}
      >
        <p className="rs-scale-field__criteria">
          Optional — performance, communication, punctuality, or other concerns.
        </p>
        <TextArea
          id={`${idPrefix}-issues`}
          value={crewIssuesNote}
          onChange={(_e, v) => onIssuesNoteChange(v)}
          rows={2}
        />
      </FormGroup>
    </div>
  );
}

export function formatCrewAttendanceNote(
  crewAttendance: CrewAttendanceEntry[],
): string {
  return crewAttendance
    .map(
      (c) =>
        `${REQUESTABLE_SLOT_SHORT[c.slot]}: ${c.userName}${
          c.attended ? '' : ' (absent)'
        }`,
    )
    .join(' · ');
}
