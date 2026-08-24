import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  FormSelect,
  FormSelectOption,
  Title,
} from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '@/app/AppContext';
import { memberListName } from '@/domain/members';
import { hasRefereeLensRole } from '@/domain/types';
import { OfficialQuickLookPanel } from '@/features/scheduler/OfficialQuickLookPanel';
import './scheduler.css';

/**
 * Masthead official picker + global drawer (Scheduler lens only).
 * Mount once from MobileShell so it stays reachable on every scheduler page.
 */
export function OfficialQuickLookHost() {
  const { state } = useApp();
  const [selectedUid, setSelectedUid] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const officials = useMemo(
    () =>
      state.users
        .filter((u) => hasRefereeLensRole(u.roles))
        .sort((a, b) =>
          memberListName(a).localeCompare(memberListName(b), undefined, {
            sensitivity: 'base',
          }),
        ),
    [state.users],
  );

  const selected = officials.find((u) => u.uid === selectedUid);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  const pickOfficial = (uid: string) => {
    setSelectedUid(uid);
    if (uid) setDrawerOpen(true);
  };

  return (
    <>
      <div className="rs-masthead-official-pick">
        <FormSelect
          id="masthead-official-pick"
          className="rs-masthead-official-pick__select"
          value={selectedUid}
          onChange={(_, v) => pickOfficial(v)}
          aria-label="Official quick look — profile and availability"
        >
          <FormSelectOption value="" label="Official…" />
          {officials.map((u) => (
            <FormSelectOption
              key={u.uid}
              value={u.uid}
              label={memberListName(u)}
            />
          ))}
        </FormSelect>
      </div>

      {drawerOpen && selected && (
        <div className="rs-official-drawer" role="presentation">
          <button
            type="button"
            className="rs-official-drawer__backdrop"
            aria-label="Close official quick look"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="rs-official-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="official-drawer-title"
          >
            <header className="rs-official-drawer__head">
              <Title
                headingLevel="h2"
                id="official-drawer-title"
                size="lg"
                className="rs-official-drawer__title"
              >
                {memberListName(selected)}
              </Title>
              <Button
                variant="plain"
                className="rs-official-drawer__close"
                aria-label="Close"
                onClick={() => setDrawerOpen(false)}
              >
                <FontAwesomeIcon icon={faTimes} aria-hidden />
              </Button>
            </header>
            <div className="rs-official-drawer__body">
              <OfficialQuickLookPanel user={selected} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
