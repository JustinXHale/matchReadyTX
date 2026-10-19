import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Modal,
  ModalHeader,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  buildResetMatchReport,
  isCardReportLocked,
  type CardReport,
  type MatchReport,
} from '@/domain/reports';
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

type Props = (
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
    }
) & {
  /** Desktop kebab vs mobile sticky bar + bottom sheet (events pattern). */
  presentation?: 'icon' | 'bottom-bar';
};

type MenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  run: () => void;
};

/** Scheduler / Judicial report controls, colocated with the report itself. */
export function ReportAdminMenu(props: Props) {
  const presentation = props.presentation ?? 'icon';
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
      setError(callableErrorMessage(err, 'Could not unlock card report.'));
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

  const items: MenuItem[] = [
    ...(props.kind === 'match'
      ? [
          {
            id: 'reset',
            label: 'Reset report',
            run: () => void resetMatchReport(),
          },
        ]
      : []),
    ...(canUnlock
      ? [
          {
            id: 'unlock',
            label: 'Unlock for edit',
            run: () => void unlockCardReport(),
          },
        ]
      : []),
    {
      id: 'delete',
      label: 'Delete report',
      danger: true,
      run: () => void deleteReport(),
    },
  ];

  const sheetId = `report-actions-sheet-${props.kind}-${props.report.id}`;
  const titleId = `${sheetId}-title`;

  if (presentation === 'bottom-bar') {
    return (
      <div className="rs-report-admin rs-report-admin--bottom-bar">
        <button
          ref={toggleRef}
          type="button"
          className="rs-report-admin__bar-toggle"
          aria-label="Report actions"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? sheetId : undefined}
          aria-disabled={busy}
          disabled={busy}
          onClick={() => setIsOpen(true)}
        >
          <span className="rs-report-admin__bar-toggle-content">
            <EllipsisVIcon aria-hidden />
            <span>Report actions</span>
          </span>
        </button>

        <Modal
          className="rs-match-actions-sheet"
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          aria-labelledby={titleId}
        >
          <ModalHeader
            title="Report actions"
            labelId={titleId}
            onClose={() => setIsOpen(false)}
          />
          <div
            id={sheetId}
            className="rs-match-actions-sheet__actions"
            role="group"
            aria-label="Report actions"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rs-match-actions-sheet__action${
                  item.danger ? ' rs-match-actions-sheet__action--danger' : ''
                }`}
                disabled={busy}
                onClick={item.run}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Modal>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
      </div>
    );
  }

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
          {items.map((item) => (
            <DropdownItem
              key={item.id}
              className={item.danger ? 'rs-report-admin__danger' : undefined}
              onClick={item.run}
            >
              {item.label}
            </DropdownItem>
          ))}
        </DropdownList>
      </Dropdown>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
    </div>
  );
}
