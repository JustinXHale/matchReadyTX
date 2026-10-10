import { useRef, useState } from 'react';
import {
  Alert,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useApp } from '@/app/AppContext';
import { buildResetMatchReport, type CardReport, type MatchReport } from '@/domain/reports';
import type { Match } from '@/domain/types';
import {
  persistSchedulerDeleteCardReport,
  persistSchedulerDeleteMatchReport,
  persistSchedulerResetMatchReport,
} from '@/services/reportsLive';

type Props =
  | {
      kind: 'match';
      report: MatchReport;
      match: Match;
      onFinished: () => void;
    }
  | {
      kind: 'card';
      report: CardReport;
      onFinished: () => void;
    };

/** Scheduler-only destructive report controls, colocated with the report itself. */
export function ReportAdminMenu(props: Props) {
  const { store, dataMode } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);

  const resetMatchReport = async () => {
    if (props.kind !== 'match') return;
    if (
      !window.confirm(
        'Reset this report? Its submitted answers will be cleared and it will become due again.',
      )
    ) {
      return;
    }
    setIsOpen(false);
    setError('');
    setBusy(true);
    try {
      if (dataMode === 'live') {
        await persistSchedulerResetMatchReport(props.report, props.match);
      } else {
        store.resetMatchReportLocal(
          buildResetMatchReport(props.report, props.match),
        );
      }
      props.onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset report.');
    } finally {
      setBusy(false);
    }
  };

  const deleteReport = async () => {
    if (!window.confirm('Delete this report? This action cannot be undone.')) {
      return;
    }
    setIsOpen(false);
    setError('');
    setBusy(true);
    try {
      if (props.kind === 'match') {
        if (dataMode === 'live') {
          await persistSchedulerDeleteMatchReport(props.report.id);
        } else {
          store.removeMatchReportLocal(props.report.id);
        }
      } else if (dataMode === 'live') {
        await persistSchedulerDeleteCardReport(props.report.id);
      } else {
        store.removeCardReportLocal(props.report.id);
      }
      props.onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-report-admin">
      <Dropdown
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        popperProps={{ placement: 'bottom-end' }}
        toggle={{
          toggleRef,
          toggleNode: (
            <MenuToggle
              ref={toggleRef}
              variant="plain"
              aria-label="Report actions"
              aria-disabled={busy}
              isExpanded={isOpen}
              className="rs-report-admin__toggle"
              onClick={() => {
                if (!busy) setIsOpen((open) => !open);
              }}
            >
              <EllipsisVIcon aria-hidden />
            </MenuToggle>
          ),
        }}
      >
        <DropdownList aria-label="Report actions">
          {props.kind === 'match' && (
            <DropdownItem onClick={() => void resetMatchReport()}>
              Reset report
            </DropdownItem>
          )}
          <DropdownItem
            className="rs-report-admin__danger"
            onClick={() => void deleteReport()}
          >
            Delete report
          </DropdownItem>
        </DropdownList>
      </Dropdown>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
    </div>
  );
}
