import { useMemo, useState } from 'react';
import {
  Button,
  FormGroup,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { parseGoogleSheetId } from '@/domain/sheetLink';
import { formatDueBadge } from '@/features/referee/reports/dueCounts';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callSyncSheet,
  defaultOrgId,
  releaseDraftMatchesInFirestore,
  saveOrgSheetId,
} from '@/services/orgData';

function callableErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as {
      message?: string;
      code?: string;
      details?: unknown;
    };
    const code = typeof o.code === 'string' ? o.code : '';
    const msg =
      typeof o.message === 'string' && o.message.length > 0
        ? o.message
        : '';
    if (code.includes('permission-denied') || /permission/i.test(msg)) {
      return (
        msg ||
        'Permission denied. Share the Sheet with the service account (Viewer) and try again.'
      );
    }
    if (code.includes('failed-precondition') || /sheetId|Sheet/i.test(msg)) {
      return (
        msg ||
        'Sheet is not ready. Check the link, then Sync schedule again.'
      );
    }
    if (code.includes('unauthenticated')) {
      return 'Sign in again, then retry sync.';
    }
    if (msg) return msg;
  }
  return err instanceof Error ? err.message : 'Sync failed. Try again.';
}

/**
 * Scheduler Upload — ordered for the real workflow:
 * 1) Connect Sheet + sync schedule
 * 2) Release drafts to teams
 */
export function SchedulerUploadPage() {
  const { state, store, refresh } = useApp();
  const linkedId = state.org.sheetId;
  const [sheetLink, setSheetLink] = useState(linkedId ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'sync' | 'release' | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const parsedId = useMemo(
    () => parseGoogleSheetId(sheetLink),
    [sheetLink],
  );

  const draftCount = useMemo(
    () => state.matches.filter((m) => m.status === 'draft').length,
    [state.matches],
  );

  const draftInRange = useMemo(() => {
    if (!from || !to) return 0;
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return state.matches.filter((m) => {
      if (m.status !== 'draft') return false;
      const t = new Date(m.kickoffAt).getTime();
      return t >= start && t <= end;
    }).length;
  }, [state.matches, from, to]);

  const syncSchedule = async () => {
    const id = parsedId ?? linkedId ?? null;
    if (!id) {
      setLinkError('Paste your Google Sheet link first (Share → Copy link).');
      return;
    }
    setLinkError(null);
    setSyncNote(null);

    if (!isFirebaseConfigured) {
      store.updateOrgFees({ sheetId: id });
      store.syncFromSheet();
      setSyncNote('Demo sync only (Firebase not configured).');
      refresh();
      return;
    }

    setBusy('sync');
    try {
      await saveOrgSheetId(defaultOrgId(), id);
      store.updateOrgFees({ sheetId: id });
      const result = await callSyncSheet({
        orgId: defaultOrgId(),
        sheetId: id,
      });
      setSyncNote(
        `Synced ${result.matched} row(s) → ${result.upserted} match(es), ${result.teams} team(s).`,
      );
      store.updateOrgFees({
        sheetId: id,
        sheetSyncedAt: result.sheetSyncedAt,
        sheetSyncError: undefined,
      });
      refresh();
    } catch (err) {
      setLinkError(callableErrorMessage(err));
      store.updateOrgFees({
        sheetSyncError: callableErrorMessage(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const release = async (opts: {
    all?: boolean;
    from?: string;
    to?: string;
  }) => {
    setSyncNote(null);
    if (!isFirebaseConfigured) {
      store.releaseMatches(opts);
      setSyncNote('Released drafts (demo store).');
      refresh();
      return;
    }
    setBusy('release');
    try {
      const n = await releaseDraftMatchesInFirestore(
        defaultOrgId(),
        state.matches,
        opts,
      );
      setSyncNote(
        n > 0
          ? `Released ${n} draft match(es) to teams.`
          : 'No draft matches to release.',
      );
      refresh();
    } catch (err) {
      setLinkError(callableErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Upload
      </Title>
      <p className="rs-match-card__meta">
        Pull your season from Google Sheets into the app, then open games for
        team confirmation.
      </p>
      {syncNote && (
        <p className="rs-match-card__meta" role="status">
          {syncNote}
        </p>
      )}

      <section className="rs-detail-card" aria-labelledby="upload-step-1">
        <h3 id="upload-step-1" className="rs-detail-section__label">
          1 · Connect & sync schedule
        </h3>
        <p className="rs-match-card__meta">
          In Google Sheets open your workbook → <strong>Share</strong> →{' '}
          <strong>Copy link</strong>. Paste that link here (not “Publish to
          web”). Share the Sheet with the sync service account (Viewer) — see{' '}
          <code>docs/SHEET_SYNC.md</code>. Then sync to pull Schedule (and
          Contacts / Locations when present) into Firestore.
        </p>
        <FormGroup label="Sheet link" fieldId="upload-sheet-link">
          <TextInput
            id="upload-sheet-link"
            value={sheetLink}
            onChange={(_, v) => {
              setSheetLink(v);
              if (linkError) setLinkError(null);
            }}
            aria-label="Google Sheet link"
            placeholder="https://docs.google.com/spreadsheets/d/…"
          />
        </FormGroup>
        {linkedId && (
          <p className="rs-match-card__meta">
            Connected: <code>{linkedId}</code>
          </p>
        )}
        <div className="rs-actions">
          <Button
            variant="primary"
            onClick={() => void syncSchedule()}
            isDisabled={busy != null}
            isLoading={busy === 'sync'}
          >
            Sync schedule
          </Button>
        </div>
        <p className="rs-match-card__meta">
          Last sync:{' '}
          {state.org.sheetSyncedAt
            ? new Date(state.org.sheetSyncedAt).toLocaleString()
            : 'Never'}
        </p>
        {state.org.sheetSyncError && !linkError && (
          <p className="rs-match-card__meta" role="alert">
            Last sync failed: {state.org.sheetSyncError}. Fix the Sheet link /
            sharing, then tap Sync schedule again.
          </p>
        )}
        {linkError && (
          <p className="rs-match-card__meta" role="alert">
            {linkError}
          </p>
        )}
      </section>

      <section className="rs-detail-card" aria-labelledby="upload-step-2">
        <h3 id="upload-step-2" className="rs-detail-section__label">
          2 · Release to teams
        </h3>
        <p className="rs-match-card__meta">
          Synced games start as drafts. Release them so Team Admins can confirm
          or propose changes.
        </p>
        <div className="rs-actions">
          <Button
            variant="secondary"
            isDisabled={busy != null || draftCount === 0}
            isLoading={busy === 'release'}
            onClick={() => void release({ all: true })}
          >
            Release all drafts
            {draftCount > 0 && (
              <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
                {formatDueBadge(draftCount)}
              </span>
            )}
          </Button>
        </div>
        <p className="rs-match-card__meta pf-v6-u-mt-sm">
          Or release a date range:
        </p>
        <FormGroup label="From" fieldId="release-from">
          <TextInput
            id="release-from"
            type="date"
            value={from}
            onChange={(_, v) => setFrom(v)}
          />
        </FormGroup>
        <FormGroup label="To" fieldId="release-to">
          <TextInput
            id="release-to"
            type="date"
            value={to}
            onChange={(_, v) => setTo(v)}
          />
        </FormGroup>
        <div className="rs-actions">
          <Button
            variant="link"
            isInline
            isDisabled={!from || !to || busy != null || draftInRange === 0}
            onClick={() => void release({ from, to })}
          >
            Release this range
            {from && to && draftInRange > 0 && (
              <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
                {formatDueBadge(draftInRange)}
              </span>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
