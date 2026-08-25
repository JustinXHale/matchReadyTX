import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Button, FormSelect, FormSelectOption, Title } from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '@/app/AppContext';
import { memberListName } from '@/domain/members';
import { hasRefereeLensRole } from '@/domain/types';
import type { BackNav } from '@/nav/backNav';
import { OfficialQuickLookPanel } from '@/features/scheduler/OfficialQuickLookPanel';
import './scheduler.css';

type OpenOptions = {
  matchBack?: BackNav;
};

type OfficialQuickLookContextValue = {
  openOfficial: (uid: string, options?: OpenOptions) => void;
  pickFromHeader: (uid: string) => void;
  headerPickValue: string;
};

const OfficialQuickLookContext = createContext<
  OfficialQuickLookContextValue | undefined
>(undefined);

export function useOfficialQuickLook(): OfficialQuickLookContextValue {
  const ctx = useContext(OfficialQuickLookContext);
  if (!ctx) {
    throw new Error('useOfficialQuickLook requires OfficialQuickLookProvider');
  }
  return ctx;
}

/** Optional hook — safe when provider is absent (e.g. tests). */
export function useOfficialQuickLookOptional():
  OfficialQuickLookContextValue | null {
  return useContext(OfficialQuickLookContext) ?? null;
}

export function OfficialQuickLookProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const [selectedUid, setSelectedUid] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matchBack, setMatchBack] = useState<BackNav | undefined>();

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

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedUid('');
    setMatchBack(undefined);
  }, []);

  const pickFromHeader = useCallback(
    (uid: string) => {
      if (uid) {
        setSelectedUid(uid);
        setMatchBack(undefined);
        setDrawerOpen(true);
      } else {
        closeDrawer();
      }
    },
    [closeDrawer],
  );

  const openOfficial = useCallback(
    (uid: string, options?: OpenOptions) => {
      setSelectedUid(uid);
      setMatchBack(options?.matchBack);
      setDrawerOpen(true);
    },
    [],
  );

  const headerPickValue = drawerOpen && selectedUid ? selectedUid : '';

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <OfficialQuickLookContext.Provider
      value={{ openOfficial, pickFromHeader, headerPickValue }}
    >
      {children}
      {drawerOpen && selected && (
        <div className="rs-official-drawer" role="presentation">
          <button
            type="button"
            className="rs-official-drawer__backdrop"
            aria-label="Close official quick look"
            onClick={closeDrawer}
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
                onClick={closeDrawer}
              >
                <FontAwesomeIcon icon={faTimes} aria-hidden />
              </Button>
            </header>
            <div className="rs-official-drawer__body">
              <OfficialQuickLookPanel
                user={selected}
                matchBack={matchBack}
                onNavigate={closeDrawer}
              />
            </div>
          </aside>
        </div>
      )}
    </OfficialQuickLookContext.Provider>
  );
}

/** Masthead official picker (Scheduler lens). */
export function OfficialQuickLookPicker() {
  const { state } = useApp();
  const { pickFromHeader, headerPickValue } = useOfficialQuickLook();

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

  return (
    <div className="rs-masthead-official-pick">
      <FormSelect
        id="masthead-official-pick"
        className="rs-masthead-official-pick__select"
        value={headerPickValue}
        onChange={(_, v) => pickFromHeader(v)}
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
  );
}
