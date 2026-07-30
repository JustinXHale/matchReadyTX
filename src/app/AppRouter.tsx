import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  AppProvider,
  ROLE_HOME,
  useApp,
} from '@/app/AppContext';
import { MobileShell } from '@/app/MobileShell';
import { RequireAuth, RequireProfileIncomplete } from '@/app/guards';
import {
  isDemoPath,
  stripDemoPrefix,
  withDemoPrefix,
} from '@/app/demoPaths';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { AboutPage } from '@/features/about/AboutPage';
import { GlobalLayout } from '@/features/global/GlobalLayout';
import { GlobalSchedulePage } from '@/features/global/GlobalSchedulePage';
import { GlobalStandingsPage } from '@/features/global/GlobalStandingsPage';
import { GlobalTeamsPage } from '@/features/global/GlobalTeamsPage';
import { GlobalTeamDetailPage } from '@/features/global/GlobalTeamDetailPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { AvailabilityPage } from '@/features/availability/AvailabilityPage';
import { RefereeLayout } from '@/features/referee/RefereeLayout';
import { AppointmentsPage } from '@/features/referee/appointments/AppointmentsPage';
import { PendingRequestsPage } from '@/features/referee/request/PendingRequestsPage';
import { GlobalRequestPage } from '@/features/referee/request/GlobalRequestPage';
import { MatchReportsPage } from '@/features/referee/reports/MatchReportsPage';
import { CardReportsPage } from '@/features/referee/reports/CardReportsPage';
import { CoachingReportsPage } from '@/features/referee/reports/CoachingReportsPage';
import { MatchReportFlowPage } from '@/features/referee/reports/MatchReportFlowPage';
import {
  CmoReportViewPage,
  MatchReportViewPage,
} from '@/features/referee/reports/MatchReportViewPage';
import { CmoReportPage } from '@/features/referee/reports/CmoReportPage';
import { CardReportPage } from '@/features/referee/reports/CardReportPage';
import { TeamAdminHomePage } from '@/features/teamAdmin/TeamAdminHomePage';
import { TeamAdminLayout } from '@/features/teamAdmin/TeamAdminLayout';
import { TeamAdminReportPage } from '@/features/teamAdmin/TeamAdminReportPage';
import { CoachFeedbackFormPage } from '@/features/teamAdmin/CoachFeedbackFormPage';
import { RequestFixturePage } from '@/features/teamAdmin/RequestFixturePage';
import {
  SchedulerIndexRedirect,
  SchedulerLayout,
} from '@/features/scheduler/SchedulerLayout';
import { SchedulerQueuesPage } from '@/features/scheduler/queues/SchedulerQueuesPage';
import { SchedulerSchedulePage } from '@/features/scheduler/schedule/SchedulerSchedulePage';
import { SchedulerUploadPage } from '@/features/scheduler/upload/SchedulerUploadPage';
import { SchedulerFeedbackPage } from '@/features/scheduler/feedback/SchedulerFeedbackPage';
import { SchedulerFeedbackDetailPage } from '@/features/scheduler/feedback/SchedulerFeedbackDetailPage';
import { MatchDetailPage } from '@/features/matches/MatchDetailPage';
import { MembersPage } from '@/features/members/MembersPage';
import { MemberDetailPage } from '@/features/members/MemberDetailPage';

/** Demo-aware absolute redirect (prefixes `/demo` while in the showcase). */
function AppNavigate({
  to,
  replace = false,
}: {
  to: string;
  replace?: boolean;
}) {
  const { dataMode } = useApp();
  const target = dataMode === 'demo' ? withDemoPrefix(to) : to;
  return <Navigate to={target} replace={replace} />;
}

/** Send `/` (and unknown paths) to the home for the active role lens. */
function RoleHomeRedirect() {
  const { currentUser, roleView, dataMode, hasFirebaseSession } = useApp();
  if (dataMode === 'demo' && currentUser) {
    return <Navigate to={withDemoPrefix(ROLE_HOME[roleView])} replace />;
  }
  if (!hasFirebaseSession && !currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[roleView]} replace />;
}

function DemoHomeRedirect() {
  const { roleView, currentUser, enterDemoShowcase, isDemoMode } = useApp();

  useEffect(() => {
    if (!isDemoMode) return;
    if (!currentUser?.uid.startsWith('u_')) {
      enterDemoShowcase();
    }
  }, [isDemoMode, currentUser?.uid, enterDemoShowcase]);

  if (!isDemoMode) return <Navigate to="/login" replace />;
  const home = ROLE_HOME[roleView] ?? ROLE_HOME.referee;
  return <Navigate to={withDemoPrefix(home)} replace />;
}

/** Public showcase: seed data, tour persona — not Firebase Auth. */
function DemoShowcaseLayout() {
  const { isDemoMode, enterDemoShowcase, dataMode, currentUser } = useApp();
  const location = useLocation();
  const onboarding = stripDemoPrefix(location.pathname).startsWith(
    '/onboarding',
  );

  useEffect(() => {
    if (!isDemoMode) return;
    if (onboarding) {
      if (dataMode !== 'demo' || currentUser?.uid !== 'u_new') {
        enterDemoShowcase({ onboarding: true });
      }
      return;
    }
    if (
      dataMode !== 'demo' ||
      !currentUser?.uid.startsWith('u_') ||
      currentUser.uid === 'u_new'
    ) {
      enterDemoShowcase();
    }
  }, [
    isDemoMode,
    dataMode,
    currentUser?.uid,
    enterDemoShowcase,
    onboarding,
  ]);

  if (!isDemoMode) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * When showcase mode is on and an in-app link omits `/demo`, bounce into the
 * prefixed tree so seed browsing stays on the showcase.
 */
function DemoPrefixSync({ children }: { children?: ReactNode }) {
  const { dataMode, isDemoMode } = useApp();
  const location = useLocation();

  if (
    isDemoMode &&
    dataMode === 'demo' &&
    !isDemoPath(location.pathname) &&
    location.pathname !== '/login'
  ) {
    return (
      <Navigate
        to={`${withDemoPrefix(location.pathname)}${location.search}${location.hash}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

function DemoOnboardingPage() {
  const { isDemoMode } = useApp();
  if (!isDemoMode) return <Navigate to="/login" replace />;
  return <OnboardingPage />;
}

function RootRedirect() {
  const location = useLocation();
  const { dataMode, isDemoMode, hasFirebaseSession, currentUser, roleView } =
    useApp();

  if (isDemoMode && dataMode === 'demo' && currentUser) {
    return (
      <Navigate
        to={withDemoPrefix(ROLE_HOME[roleView]) + location.search}
        replace
      />
    );
  }

  if (!hasFirebaseSession && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[roleView]} replace />;
}

/**
 * Shared feature routes (relative paths).
 * Mount under `/demo` (showcase) and under live `RequireAuth`.
 */
function FeatureRoutes() {
  return (
    <>
      <Route path="about" element={<AboutPage />} />
      <Route path="referee" element={<RefereeLayout />}>
        <Route
          index
          element={<AppNavigate to="/referee/appointments" replace />}
        />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="request">
          <Route
            index
            element={<AppNavigate to="/referee/request/pending" replace />}
          />
          <Route path="pending" element={<PendingRequestsPage />} />
          <Route path="global" element={<GlobalRequestPage />} />
        </Route>
        <Route path="reports">
          <Route
            index
            element={<AppNavigate to="/referee/reports/match" replace />}
          />
          <Route path="match" element={<MatchReportsPage />} />
          <Route path="cards" element={<CardReportsPage />} />
          <Route
            path="match/:matchId/view"
            element={<MatchReportViewPage />}
          />
          <Route path="match/:matchId" element={<MatchReportFlowPage />} />
          <Route path="match/:matchId/cards" element={<CardReportPage />} />
          <Route path="coaching" element={<CoachingReportsPage />} />
          <Route path="coaching/cmo" element={<CoachingReportsPage />} />
          <Route path="coaching/mine" element={<CoachingReportsPage />} />
          <Route
            path="coaching/:matchId/view"
            element={<CmoReportViewPage />}
          />
          <Route path="coaching/:matchId" element={<CmoReportPage />} />
        </Route>
      </Route>
      <Route path="global" element={<GlobalLayout />}>
        <Route
          index
          element={<AppNavigate to="/global/schedule/upcoming" replace />}
        />
        <Route
          path="schedule"
          element={<AppNavigate to="/global/schedule/upcoming" replace />}
        />
        <Route path="schedule/:pane" element={<GlobalSchedulePage />} />
        <Route path="standings" element={<GlobalStandingsPage />} />
        <Route path="teams">
          <Route index element={<GlobalTeamsPage />} />
          <Route path=":teamId" element={<GlobalTeamDetailPage />} />
        </Route>
      </Route>
      <Route path="members">
        <Route index element={<MembersPage />} />
        <Route path=":userId" element={<MemberDetailPage />} />
      </Route>
      <Route
        path="availability"
        element={<AppNavigate to="/referee/availability" replace />}
      />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="team-admin" element={<TeamAdminLayout />}>
        <Route index element={<TeamAdminHomePage />} />
        <Route path="report" element={<TeamAdminReportPage />} />
        <Route path="report/:matchId" element={<CoachFeedbackFormPage />} />
        <Route path="request-fixture" element={<RequestFixturePage />} />
      </Route>
      <Route path="coach" element={<AppNavigate to="/team-admin" replace />} />
      <Route path="scheduler" element={<SchedulerLayout />}>
        <Route index element={<SchedulerIndexRedirect />} />
        <Route path="queues" element={<SchedulerQueuesPage />} />
        <Route path="schedule" element={<SchedulerSchedulePage />} />
        <Route path="feedback" element={<SchedulerFeedbackPage />} />
        <Route
          path="feedback/:feedbackId"
          element={<SchedulerFeedbackDetailPage />}
        />
        <Route path="upload" element={<SchedulerUploadPage />} />
        <Route
          path="org"
          element={<AppNavigate to="/scheduler/upload" replace />}
        />
      </Route>
      <Route path="matches/:id" element={<MatchDetailPage />} />
      <Route
        path="assigner"
        element={<AppNavigate to="/scheduler/upload" replace />}
      />
      <Route
        path="requests"
        element={<AppNavigate to="/scheduler/queues" replace />}
      />
      <Route path="matches" element={<RoleHomeRedirect />} />
      <Route path="settings" element={<AppNavigate to="/profile" replace />} />
    </>
  );
}

export function AppRouter() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <DemoPrefixSync>
                <MobileShell />
              </DemoPrefixSync>
            }
          >
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireProfileIncomplete />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            <Route path="/demo" element={<DemoShowcaseLayout />}>
              <Route index element={<DemoHomeRedirect />} />
              <Route path="onboarding" element={<DemoOnboardingPage />} />
              {FeatureRoutes()}
              <Route path="*" element={<DemoHomeRedirect />} />
            </Route>

            <Route element={<RequireAuth />}>{FeatureRoutes()}</Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
