import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useApp, useAppHref } from '@/app/AppContext';
import { buildResetMatchReport, type CardReport, type MatchReport } from '@/domain/reports';
import type { Match } from '@/domain/types';
import {
  persistSchedulerDeleteCardReport,
  persistSchedulerDeleteMatchReport,
  persistSchedulerResetMatchReport,
} from '@/services/reportsLive';
import {
  callUnlockCardReportForEdit,
  callableErrorMessage,
} from '@/services/orgData';
import { useAppFeedback } from '@/app/feedback/feedbackContext';
import { isCardReportLocked } from '@/domain/reports';

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

/** Scheduler / Judicial report controls, colocated with the report itself. */
export function ReportAdminMenu(props: Props) {
  const { store, dataMode, currentUser } = useApp();
  const { confirm } = useAppFeedback();
  const navigate = useNavigate();
  const editHref = useAppHref(
    props.kind === 'card'
      ? `/referee/reports/match/${props.report.matchId}/cards`
      : '/',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const canUnlock =
    props.kind === 'card' &&
    isCardReportLocked(props.report) &&
    Boolean(
      currentUser?.roles.includes('assigner') ||
        currentUser?.roles.includes('judicial'),
    );

  const resetMatchReport = async () => {
    if (props.kind !== 'match') return;
    const confirmed = await confirm({
      title: 'Reset report?',
      message:
        'Its submitted answers will be cleared and the report will become due again.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!confirmed) return;
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

  const unlockCardReport = async () => {
    if (props.kind !== 'card' || !currentUser) return;
    const confirmed = await confirm({
      title: 'Unlock for edit?',
      message:
        'The Match Official (and Scheduler/Judicial) can edit this submitted card report until it is submitted again.',
      confirmLabel: 'Unlock',
    });
    if (!confirmed) return;
    setIsOpen(false);
    setError('');
    setBusy(true);
    try {
      if (dataMode === 'live') {
        await callUnlockCardReportForEdit({ reportId: props.report.id });
      } else {
        store.unlockCardReportForEdit(
          props.report.id,
          currentUser.uid,
          currentUser.displayName || 'Reviewer',
        );
      }
      navigate(editHref, { replace: true });
    } catch (err) {
      setError(
        callableErrorMessage(err, 'Could not unlock card report.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteReport = async () => {
    const confirmed = await confirm({
      title: 'Delete report?',
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
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
          {canUnlock && (
            <DropdownItem onClick={() => void unlockCardReport()}>
              Unlock for edit
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
