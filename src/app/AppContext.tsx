import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import type { AppState } from '@/services/demoStore';
import { demoStore } from '@/services/demoStore';
import { isDemoMode, isFirebaseConfigured } from '@/services/firebase';
import { signOutFirebase, subscribeAuth, completeRedirectSignIn } from '@/services/auth';
import { ensureFirebaseUser, loadFirebaseProfile } from '@/services/userProfile';
import {
  defaultOrgId,
  subscribeCoachFeedback,
  subscribeLiveOrg,
} from '@/services/orgData';
import { subscribeOrgRoster } from '@/services/orgMembers';
import {
  defaultOrgId as availOrgId,
  subscribeUsersAvailability,
} from '@/services/availability';
import { hasRefereeLensRole, type UserProfile } from '@/domain/types';
import {
  shouldShowPendingFanBrowse,
  shouldShowTeamAdminLens,
} from '@/domain/teamLinkRequests';
import { withDemoPrefix } from '@/app/demoPaths';

/** Header role switcher — Referee/CMO combined (Q-R6 locked). Team Admin = club lens. */
export type RoleView = 'referee' | 'teamAdmin' | 'scheduler' | 'fan';

/** Seed showcase vs Firebase + Firestore. Independent of Auth when on `/demo`. */
export type DataMode = 'demo' | 'live';

const ROLE_VIEW_KEY = 'rs-role-view';
const DATA_MODE_KEY = 'rs-data-mode';
const ROLE_VIEWS: RoleView[] = ['referee', 'teamAdmin', 'scheduler', 'fan'];

export const ROLE_VIEW_LABELS: Record<RoleView, string> = {
  referee: 'Referee/CMO',
  teamAdmin: 'Team Admin',
  scheduler: 'Scheduler',
  fan: 'Fan',
};

/** Lenses the user may enter from their domain roles. Scheduler = assigner only. */
export function lensesForUser(user: UserProfile | null): RoleView[] {
  if (!user) return [];
  const out: RoleView[] = [];
  if (hasRefereeLensRole(user.roles)) out.push('referee');
  if (shouldShowTeamAdminLens(user)) out.push('teamAdmin');
  if (user.roles.includes('assigner')) out.push('scheduler');
  if (user.roles.includes('fan') || shouldShowPendingFanBrowse(user)) {
    out.push('fan');
  }
  return out;
}

export function userHasLens(user: UserProfile | null, view: RoleView): boolean {
  return lensesForUser(user).includes(view);
}

interface AppContextValue {
  state: AppState;
  currentUser: UserProfile | null;
  /** Kill switch from VITE_DEMO_MODE — showcase routes/CTAs enabled. */
  isDemoMode: boolean;
  /** Active data source: seed showcase vs live Firebase org. */
  dataMode: DataMode;
  /** True when browsing the seed showcase (`dataMode === 'demo'`). */
  isDemoShowcase: boolean;
  /** Firebase Auth session present (may still be viewing demo). */
  hasFirebaseSession: boolean;
  /** Last profile bootstrap failure (permission / network) — shown on login. */
  authBootstrapError: string | null;
  /** Cached live profile while Auth is signed in (used when returning from demo). */
  liveProfile: UserProfile | null;
  enterDemoShowcase: (opts?: { onboarding?: boolean }) => void;
  enterLive: () => boolean;
  refreshLiveProfile: () => Promise<void>;
  setDataMode: (mode: DataMode) => void;
  refresh: () => void;
  /** Sign in and flush React state before navigation (avoids auth guard bounce). */
  signInAs: (uid: string) => void;
  /** Sign out Firebase + leave live session. Does not block `/demo`. */
  signOut: () => void;
  store: typeof demoStore;
  hasAssignerRole: boolean;
  hasOfficialRole: boolean;
  hasTeamAdminRole: boolean;
  /** True when the user has 2+ lenses — masthead switcher is shown. */
  canSwitchRoleView: boolean;
  /** Lenses available for the current user (Scheduler only if assigner). */
  availableLenses: RoleView[];
  roleView: RoleView;
  setRoleView: (view: RoleView) => void;
  /** Referee/CMO lens (combined official + coaching-match-official tools). */
  isRefereeView: boolean;
  /** Team Admin club lens. */
  isTeamAdminView: boolean;
  /** @deprecated Use isTeamAdminView */
  isCoachView: boolean;
  isSchedulerView: boolean;
  /** Alias: scheduler lens (assigner control center). */
  isAssignerView: boolean;
  /** Alias: referee/cmo lens (legacy official tools). */
  isOfficialView: boolean;
  /** Fan browse lens (Global schedule). */
  isFanView: boolean;
  /** Firebase Auth first callback finished (avoid login bounce on refresh). */
  authReady: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function migrateLegacyRoleView(v: string | null): RoleView | null {
  if (!v) return null;
  if (v === 'assigner') return 'scheduler';
  if (v === 'official' || v === 'cmo') return 'referee';
  if (v === 'coach') return 'teamAdmin';
  if (ROLE_VIEWS.includes(v as RoleView)) return v as RoleView;
  return null;
}

function readStoredRoleView(): RoleView | null {
  try {
    const stored =
      localStorage.getItem(ROLE_VIEW_KEY) ??
      sessionStorage.getItem(ROLE_VIEW_KEY);
    return migrateLegacyRoleView(stored);
  } catch {
    return null;
  }
}

function persistRoleView(view: RoleView): void {
  try {
    localStorage.setItem(ROLE_VIEW_KEY, view);
    sessionStorage.setItem(ROLE_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

/** Prefer stored lens when allowed; otherwise domain default. */
export function resolveRoleView(user: UserProfile | null): RoleView {
  if (!user) return 'referee';
  const allowed = lensesForUser(user);
  if (allowed.length === 0) return defaultRoleView(user);
  const stored = readStoredRoleView();
  if (stored && allowed.includes(stored)) return stored;
  return defaultRoleView(user);
}

function readStoredDataMode(): DataMode {
  try {
    const v = sessionStorage.getItem(DATA_MODE_KEY);
    if (v === 'demo' || v === 'live') return v;
  } catch {
    /* ignore */
  }
  return 'live';
}

function persistDataMode(mode: DataMode): void {
  try {
    sessionStorage.setItem(DATA_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function defaultRoleView(user: UserProfile | null): RoleView {
  if (!user) return 'referee';
  // Day-to-day home: Referee/CMO first, then linked Team Admin, then Scheduler.
  // Pending Team Admin (no clubs yet) browses as Fan.
  if (hasRefereeLensRole(user.roles)) return 'referee';
  if (shouldShowTeamAdminLens(user)) return 'teamAdmin';
  if (user.roles.includes('assigner')) return 'scheduler';
  if (user.roles.includes('fan') || shouldShowPendingFanBrowse(user)) {
    return 'fan';
  }
  return 'referee';
}

/** Home path for the active role lens (also used by shell role switch). */
export const ROLE_HOME: Record<RoleView, string> = {
  referee: '/referee/appointments',
  teamAdmin: '/team-admin',
  scheduler: '/scheduler',
  fan: '/global/schedule/upcoming',
};

function pickTourPersonaUid(): string {
  const users = demoStore.getState().users;
  const dual =
    users.find(
      (u) =>
        u.roles.includes('official') &&
        u.roles.includes('assigner') &&
        u.roles.includes('teamAdmin'),
    ) ??
    users.find(
      (u) => u.roles.includes('official') && u.roles.includes('assigner'),
    ) ??
    users.find((u) => u.roles.includes('official')) ??
    users.find((u) => u.uid !== 'u_new') ??
    users[0];
  return dual?.uid ?? 'u_assigner';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(demoStore.getState());
  const [roleView, setRoleViewState] = useState<RoleView>(
    () => readStoredRoleView() ?? 'referee',
  );
  const [dataMode, setDataModeState] = useState<DataMode>(() => {
    if (!isDemoMode) return 'live';
    return readStoredDataMode();
  });
  const [liveProfile, setLiveProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(() => !isFirebaseConfigured);
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(
    null,
  );
  const dataModeRef = useRef(dataMode);
  dataModeRef.current = dataMode;

  useEffect(() => demoStore.subscribe(() => setState(demoStore.getState())), []);

  const setDataMode = useCallback((mode: DataMode) => {
    if (mode === 'demo' && !isDemoMode) return;
    setDataModeState(mode);
    persistDataMode(mode);
  }, []);

  const enterDemoShowcase = useCallback(
    (opts?: { onboarding?: boolean }) => {
      if (!isDemoMode) return;
      flushSync(() => {
        demoStore.resetToSeed();
        demoStore.ensureDemoTourPersona();
        if (opts?.onboarding) {
          demoStore.resetOnboardingDemoUser();
          demoStore.signInAs('u_new');
        } else {
          demoStore.signInAs(pickTourPersonaUid());
        }
        setState(demoStore.getState());
        setDataModeState('demo');
        persistDataMode('demo');
      });
    },
    [],
  );

  const enterLive = useCallback((): boolean => {
    const profile = liveProfile;
    if (!profile) return false;
    flushSync(() => {
      demoStore.prepareForLiveSync();
      demoStore.upsertAndSignIn(profile);
      setState(demoStore.getState());
      setDataModeState('live');
      persistDataMode('live');
    });
    return true;
  }, [liveProfile]);

  /** Real Auth whenever Firebase is configured — independent of showcase mode. */
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;

    // Finish mobile redirect sign-in before relying on auth state alone.
    void completeRedirectSignIn().catch((err) => {
      console.error('Redirect sign-in failed', err);
      if (!cancelled) {
        setAuthBootstrapError(
          err instanceof Error ? err.message : 'Sign-in redirect failed.',
        );
      }
    });

    const unsub = subscribeAuth(async (fbUser) => {
      if (cancelled) return;
      try {
        if (!fbUser) {
          setLiveProfile(null);
          // Leave demo showcase alone; only clear a live Firebase session in the store.
          if (dataModeRef.current === 'live') {
            const uid = demoStore.getState().currentUserId;
            if (uid && !uid.startsWith('u_')) {
              flushSync(() => {
                demoStore.signOut();
                setState(demoStore.getState());
              });
            }
          }
          return;
        }
        const profile = await ensureFirebaseUser(fbUser);
        if (cancelled) return;
        setAuthBootstrapError(null);
        setLiveProfile(profile);
        if (dataModeRef.current === 'live') {
          flushSync(() => {
            demoStore.upsertAndSignIn(profile);
            setState(demoStore.getState());
          });
        }
      } catch (err) {
        console.error('Firebase profile bootstrap failed', err);
        if (cancelled) return;
        setLiveProfile(null);
        setAuthBootstrapError(
          err instanceof Error
            ? err.message
            : 'Could not finish signing in. Check your connection and try again.',
        );
        if (dataModeRef.current === 'live') {
          flushSync(() => {
            demoStore.signOut();
            setState(demoStore.getState());
          });
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  /** Firestore org schedule — live mode + real Firebase uid + completed profile. */
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (dataMode !== 'live') return;
    const uid = state.currentUserId;
    if (!uid || uid.startsWith('u_')) return;
    const me = state.users.find((u) => u.uid === uid);
    if (!me?.profileComplete) return;

    const unsubOrg = subscribeLiveOrg(
      defaultOrgId(),
      (snap) => {
        if (dataModeRef.current !== 'live') return;
        demoStore.applyLiveOrgSnapshot(snap);
        setState(demoStore.getState());
      },
      (err) => console.error('Live org subscription failed', err),
    );
    const unsubRoster = subscribeOrgRoster(
      defaultOrgId(),
      (users) => {
        if (dataModeRef.current !== 'live') return;
        demoStore.applyLiveRoster(users);
        setState(demoStore.getState());
      },
      (err) => console.error('Org roster subscription failed', err),
    );
    return () => {
      unsubOrg();
      unsubRoster();
    };
  }, [
    state.currentUserId,
    dataMode,
    state.users.find((u) => u.uid === state.currentUserId)?.profileComplete,
  ]);

  const refreshLiveProfile = useCallback(async () => {
    const uid =
      liveProfile?.uid ?? demoStore.getState().currentUserId ?? '';
    if (!uid || uid.startsWith('u_')) return;
    try {
      const profile = await loadFirebaseProfile(uid);
      if (!profile) return;
      setLiveProfile(profile);
      if (dataModeRef.current === 'live') {
        flushSync(() => {
          demoStore.upsertAndSignIn(profile);
          setState(demoStore.getState());
        });
      }
    } catch (err) {
      console.error('refreshLiveProfile failed', err);
    }
  }, [liveProfile?.uid]);

  /** Coach feedback — assigner sees all; Team Admins see club-owned reports. */
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (dataMode !== 'live') return;
    const uid = state.currentUserId;
    if (!uid || uid.startsWith('u_')) return;
    const me = state.users.find((u) => u.uid === uid);
    if (!me) return;
    const isAssigner = me.roles.includes('assigner');
    const canRead =
      isAssigner || me.roles.includes('teamAdmin');
    if (!canRead) return;

    const unsub = subscribeCoachFeedback(
      defaultOrgId(),
      { isAssigner, teamIds: me.teamIds },
      (feedback) => {
        if (dataModeRef.current !== 'live') return;
        demoStore.applyLiveCoachFeedback(feedback);
        setState(demoStore.getState());
      },
      (err) => console.error('Coach feedback subscription failed', err),
    );
    return () => unsub();
  }, [
    dataMode,
    state.currentUserId,
    state.users.find((u) => u.uid === state.currentUserId)?.roles.join(','),
    state.users
      .find((u) => u.uid === state.currentUserId)
      ?.teamIds.join(','),
  ]);

  /**
   * Availability ranges from Firestore.
   * Current user always; assigners also subscribe the full roster for picker hints.
   */
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (dataMode !== 'live') return;
    const uid = state.currentUserId;
    if (!uid || uid.startsWith('u_')) return;

    const me = state.users.find((u) => u.uid === uid);
    const isAssigner = Boolean(me?.roles.includes('assigner'));
    const uids = isAssigner
      ? state.users.map((u) => u.uid).filter((id) => !id.startsWith('u_'))
      : [uid];
    const unique = [...new Set(uids.includes(uid) ? uids : [uid, ...uids])];

    const unsub = subscribeUsersAvailability(
      availOrgId(),
      unique,
      (ranges) => {
        if (dataModeRef.current !== 'live') return;
        demoStore.applyLiveAvailability(unique, ranges);
        setState(demoStore.getState());
      },
      (err) => console.error('Availability subscription failed', err),
    );
    return () => unsub();
  }, [
    dataMode,
    state.currentUserId,
    state.users
      .map((u) => u.uid)
      .filter((id) => !id.startsWith('u_'))
      .sort()
      .join(','),
    state.users.find((u) => u.uid === state.currentUserId)?.roles.includes(
      'assigner',
    ),
  ]);

  const refresh = useCallback(() => setState(demoStore.getState()), []);

  const signInAs = useCallback((uid: string) => {
    flushSync(() => {
      demoStore.signInAs(uid);
      setState(demoStore.getState());
    });
  }, []);

  const signOut = useCallback(() => {
    void (async () => {
      if (isFirebaseConfigured) {
        try {
          await signOutFirebase();
        } catch (err) {
          console.error('Firebase sign-out failed', err);
        }
      }
      setLiveProfile(null);
      flushSync(() => {
        if (dataModeRef.current === 'live') {
          demoStore.signOut();
          setState(demoStore.getState());
        }
      });
    })();
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.uid === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  );

  const hasFirebaseSession = liveProfile != null;
  const isDemoShowcase = dataMode === 'demo';

  const hasAssignerRole = Boolean(currentUser?.roles.includes('assigner'));
  const hasOfficialRole = Boolean(
    currentUser && hasRefereeLensRole(currentUser.roles),
  );
  const hasTeamAdminRole = shouldShowTeamAdminLens(currentUser);
  const availableLenses = useMemo(
    () => lensesForUser(currentUser),
    [currentUser],
  );
  const canSwitchRoleView = availableLenses.length >= 2;

  const setRoleView = useCallback((view: RoleView) => {
    setRoleViewState(view);
    persistRoleView(view);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const safe = resolveRoleView(currentUser);
    setRoleViewState(safe);
    persistRoleView(safe);
  }, [
    currentUser?.uid,
    currentUser?.roles.join(','),
    currentUser?.teamIds?.join(','),
  ]);

  const isRefereeView = roleView === 'referee';
  const isTeamAdminView = roleView === 'teamAdmin';
  const isCoachView = isTeamAdminView;
  const isSchedulerView = roleView === 'scheduler';
  const isAssignerView = isSchedulerView;
  const isOfficialView = isRefereeView;
  const isFanView = roleView === 'fan';

  const value = useMemo(
    () => ({
      state,
      currentUser,
      isDemoMode,
      dataMode,
      isDemoShowcase,
      hasFirebaseSession,
      authBootstrapError,
      liveProfile,
      enterDemoShowcase,
      enterLive,
      refreshLiveProfile,
      setDataMode,
      refresh,
      signInAs,
      signOut,
      store: demoStore,
      hasAssignerRole,
      hasOfficialRole,
      hasTeamAdminRole,
      canSwitchRoleView,
      availableLenses,
      roleView,
      setRoleView,
      isRefereeView,
      isTeamAdminView,
      isCoachView,
      isSchedulerView,
      isAssignerView,
      isOfficialView,
      isFanView,
      authReady,
    }),
    [
      state,
      currentUser,
      dataMode,
      isDemoShowcase,
      hasFirebaseSession,
      authBootstrapError,
      liveProfile,
      enterDemoShowcase,
      enterLive,
      refreshLiveProfile,
      setDataMode,
      refresh,
      signInAs,
      signOut,
      hasAssignerRole,
      hasOfficialRole,
      hasTeamAdminRole,
      canSwitchRoleView,
      availableLenses,
      roleView,
      setRoleView,
      isRefereeView,
      isTeamAdminView,
      isCoachView,
      isSchedulerView,
      isAssignerView,
      isOfficialView,
      isFanView,
      authReady,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/** Logical app path → current mode (`/demo/...` when showcasing). */
export function useAppHref(path: string): string {
  const { dataMode } = useApp();
  return dataMode === 'demo' ? withDemoPrefix(path) : path;
}
