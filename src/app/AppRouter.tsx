import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import {
  AppProvider,
  ROLE_HOME,
  useApp,
} from '@/app/AppContext';
import { MobileShell } from '@/app/MobileShell';
import { RequireAuth, RequireProfileIncomplete, RequireMembersAccess, RequireInsightsAccess } from '@/app/guards';
import {
  isDemoPath,
  stripDemoPrefix,
  withDemoPrefix,
} from '@/app/demoPaths';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/auth/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
);
const AboutPage = lazy(() =>
  import('@/features/about/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const AboutLayout = lazy(() =>
  import('@/features/about/AboutLayout').then((m) => ({
    default: m.AboutLayout,
  })),
);
const AboutResourcesPage = lazy(() =>
  import('@/features/about/AboutResourcesPage').then((m) => ({
    default: m.AboutResourcesPage,
  })),
);
const GlobalLayout = lazy(() =>
  import('@/features/global/GlobalLayout').then((m) => ({
    default: m.GlobalLayout,
  })),
);
const GlobalSchedulePage = lazy(() =>
  import('@/features/global/GlobalSchedulePage').then((m) => ({
    default: m.GlobalSchedulePage,
  })),
);
const GlobalStandingsPage = lazy(() =>
  import('@/features/global/GlobalStandingsPage').then((m) => ({
    default: m.GlobalStandingsPage,
  })),
);
const GlobalTeamsPage = lazy(() =>
  import('@/features/global/GlobalTeamsPage').then((m) => ({
    default: m.GlobalTeamsPage,
  })),
);
const GlobalTeamDetailPage = lazy(() =>
  import('@/features/global/GlobalTeamDetailPage').then((m) => ({
    default: m.GlobalTeamDetailPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  })),
);
const AvailabilityPage = lazy(() =>
  import('@/features/availability/AvailabilityPage').then((m) => ({
    default: m.AvailabilityPage,
  })),
);
const RefereeLayout = lazy(() =>
  import('@/features/referee/RefereeLayout').then((m) => ({
    default: m.RefereeLayout,
  })),
);
const RefereeAppointmentsLayout = lazy(() =>
  import('@/features/referee/appointments/RefereeAppointmentsLayout').then(
    (m) => ({
      default: m.RefereeAppointmentsLayout,
    }),
  ),
);
const AppointmentsPage = lazy(() =>
  import('@/features/referee/appointments/AppointmentsPage').then((m) => ({
    default: m.AppointmentsPage,
  })),
);
const PendingRequestsPage = lazy(() =>
  import('@/features/referee/request/PendingRequestsPage').then((m) => ({
    default: m.PendingRequestsPage,
  })),
);
const GlobalRequestPage = lazy(() =>
  import('@/features/referee/request/GlobalRequestPage').then((m) => ({
    default: m.GlobalRequestPage,
  })),
);
const MatchReportsPage = lazy(() =>
  import('@/features/referee/reports/MatchReportsPage').then((m) => ({
    default: m.MatchReportsPage,
  })),
);
const CardReportsPage = lazy(() =>
  import('@/features/referee/reports/CardReportsPage').then((m) => ({
    default: m.CardReportsPage,
  })),
);
const CoachingReportsPage = lazy(() =>
  import('@/features/referee/reports/CoachingReportsPage').then((m) => ({
    default: m.CoachingReportsPage,
  })),
);
const MatchReportFlowPage = lazy(() =>
  import('@/features/referee/reports/MatchReportFlowPage').then((m) => ({
    default: m.MatchReportFlowPage,
  })),
);
const MatchReportViewPage = lazy(() =>
  import('@/features/referee/reports/MatchReportViewPage').then((m) => ({
    default: m.MatchReportViewPage,
  })),
);
const CmoReportViewPage = lazy(() =>
  import('@/features/referee/reports/MatchReportViewPage').then((m) => ({
    default: m.CmoReportViewPage,
  })),
);
const CmoReportPage = lazy(() =>
  import('@/features/referee/reports/CmoReportPage').then((m) => ({
    default: m.CmoReportPage,
  })),
);
const CardReportPage = lazy(() =>
  import('@/features/referee/reports/CardReportPage').then((m) => ({
    default: m.CardReportPage,
  })),
);
const TeamAdminHomePage = lazy(() =>
  import('@/features/teamAdmin/TeamAdminHomePage').then((m) => ({
    default: m.TeamAdminHomePage,
  })),
);
const TeamAdminLayout = lazy(() =>
  import('@/features/teamAdmin/TeamAdminLayout').then((m) => ({
    default: m.TeamAdminLayout,
  })),
);
const TeamAdminReportPage = lazy(() =>
  import('@/features/teamAdmin/TeamAdminReportPage').then((m) => ({
    default: m.TeamAdminReportPage,
  })),
);
const CoachFeedbackFormPage = lazy(() =>
  import('@/features/teamAdmin/CoachFeedbackFormPage').then((m) => ({
    default: m.CoachFeedbackFormPage,
  })),
);
const RequestFixturePage = lazy(() =>
  import('@/features/teamAdmin/RequestFixturePage').then((m) => ({
    default: m.RequestFixturePage,
  })),
);
const SchedulerLayout = lazy(() =>
  import('@/features/scheduler/SchedulerLayout').then((m) => ({
    default: m.SchedulerLayout,
  })),
);
const SchedulerIndexRedirect = lazy(() =>
  import('@/features/scheduler/SchedulerLayout').then((m) => ({
    default: m.SchedulerIndexRedirect,
  })),
);
const SchedulerCrewDefaultsPage = lazy(() =>
  import('@/features/scheduler/queues/SchedulerCrewDefaultsPage').then((m) => ({
    default: m.SchedulerCrewDefaultsPage,
  })),
);
const SchedulerQueuesLayout = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesLayout').then((m) => ({
    default: m.SchedulerQueuesLayout,
  })),
);
const SchedulerQueuesWorkLayout = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesWorkLayout').then((m) => ({
    default: m.SchedulerQueuesWorkLayout,
  })),
);
const SchedulerQueuesCoveragePage = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesCoveragePage').then((m) => ({
    default: m.SchedulerQueuesCoveragePage,
  })),
);
const SchedulerQueuesChangesPage = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesChangesPage').then((m) => ({
    default: m.SchedulerQueuesChangesPage,
  })),
);
const SchedulerQueuesNotificationsPage = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesNotificationsPage').then(
    (m) => ({
      default: m.SchedulerQueuesNotificationsPage,
    }),
  ),
);
const SchedulerQueuesRequestsLayout = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesRequestsLayout').then(
    (m) => ({
      default: m.SchedulerQueuesRequestsLayout,
    }),
  ),
);
const SchedulerQueuesFixtureRequestsPage = lazy(() =>
  import('@/features/scheduler/queues/SchedulerQueuesFixtureRequestsPage').then(
    (m) => ({
      default: m.SchedulerQueuesFixtureRequestsPage,
    }),
  ),
);
const SchedulerQueuesTeamLinkRequestsPage = lazy(() =>
  import(
    '@/features/scheduler/queues/SchedulerQueuesTeamLinkRequestsPage'
  ).then((m) => ({
    default: m.SchedulerQueuesTeamLinkRequestsPage,
  })),
);
const SchedulerQueuesRaiseHandRequestsPage = lazy(() =>
  import(
    '@/features/scheduler/queues/SchedulerQueuesRaiseHandRequestsPage'
  ).then((m) => ({
    default: m.SchedulerQueuesRaiseHandRequestsPage,
  })),
);
const SchedulerSchedulePage = lazy(() =>
  import('@/features/scheduler/schedule/SchedulerSchedulePage').then((m) => ({
    default: m.SchedulerSchedulePage,
  })),
);
const SchedulerUploadPage = lazy(() =>
  import('@/features/scheduler/upload/SchedulerUploadPage').then((m) => ({
    default: m.SchedulerUploadPage,
  })),
);
const SchedulerFeedbackPage = lazy(() =>
  import('@/features/scheduler/feedback/SchedulerFeedbackPage').then((m) => ({
    default: m.SchedulerFeedbackPage,
  })),
);
const SchedulerFeedbackDetailPage = lazy(() =>
  import('@/features/scheduler/feedback/SchedulerFeedbackDetailPage').then(
    (m) => ({ default: m.SchedulerFeedbackDetailPage }),
  ),
);
const InsightsLayout = lazy(() =>
  import('@/features/insights/InsightsLayout').then((m) => ({
    default: m.InsightsLayout,
  })),
);
const InsightsReportsLayout = lazy(() =>
  import('@/features/insights/InsightsReportsLayout').then((m) => ({
    default: m.InsightsReportsLayout,
  })),
);
const InsightsOfficialsPage = lazy(() =>
  import('@/features/insights/InsightsOfficialsPage').then((m) => ({
    default: m.InsightsOfficialsPage,
  })),
);
const InsightsOverviewPage = lazy(() =>
  import('@/features/insights/InsightsOverviewPage').then((m) => ({
    default: m.InsightsOverviewPage,
  })),
);
const InsightsCoachFeedbackPage = lazy(() =>
  import('@/features/insights/InsightsCoachFeedbackPage').then((m) => ({
    default: m.InsightsCoachFeedbackPage,
  })),
);
const InsightsCmoReportsPage = lazy(() =>
  import('@/features/insights/InsightsCmoReportsPage').then((m) => ({
    default: m.InsightsCmoReportsPage,
  })),
);
const MatchDetailPage = lazy(() =>
  import('@/features/matches/MatchDetailPage').then((m) => ({
    default: m.MatchDetailPage,
  })),
);
const MembersPage = lazy(() =>
  import('@/features/members/MembersPage').then((m) => ({
    default: m.MembersPage,
  })),
);
const MembersLayout = lazy(() =>
  import('@/features/members/MembersLayout').then((m) => ({
    default: m.MembersLayout,
  })),
);
const MemberDetailPage = lazy(() =>
  import('@/features/members/MemberDetailPage').then((m) => ({
    default: m.MemberDetailPage,
  })),
);
const MemberCmoReportPage = lazy(() =>
  import('@/features/members/OfficialPublicReports').then((m) => ({
    default: m.MemberCmoReportPage,
  })),
);
const MemberTeamFeedbackPage = lazy(() =>
  import('@/features/members/OfficialPublicReports').then((m) => ({
    default: m.MemberTeamFeedbackPage,
  })),
);
const SchedulerTeamsPage = lazy(() =>
  import('@/features/members/SchedulerTeamsPage').then((m) => ({
    default: m.SchedulerTeamsPage,
  })),
);
const SchedulerTeamDetailPage = lazy(() =>
  import('@/features/members/SchedulerTeamDetailPage').then((m) => ({
    default: m.SchedulerTeamDetailPage,
  })),
);

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

function InsightsGradeRedirect() {
  const { level = '' } = useParams();
  return (
    <AppNavigate
      to={`/insights/officials?grade=${encodeURIComponent(level)}`}
      replace
    />
  );
}

/** Old `/members` URLs now live under About. */
function LegacyMembersRedirect() {
  const { '*': rest } = useParams();
  const suffix = rest ? `/${rest}` : '';
  return <AppNavigate to={`/about/members${suffix}`} replace />;
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

  if (!currentUser.profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to={ROLE_HOME[roleView]} replace />;
}

/**
 * Shared feature routes (relative paths).
 * Mount under `/demo` (showcase) and under live `RequireAuth`.
 */
function FeatureRoutes() {
  return (
    <>
      <Route path="about" element={<AboutLayout />}>
        <Route index element={<AboutPage />} />
        <Route element={<RequireMembersAccess />}>
          <Route path="resources" element={<AboutResourcesPage />} />
          <Route path="members" element={<MembersLayout />}>
            <Route index element={<MembersPage />} />
            <Route path="teams" element={<SchedulerTeamsPage />} />
            <Route path="teams/:teamId" element={<SchedulerTeamDetailPage />} />
            <Route
              path=":userId/cmo/:reportId"
              element={<MemberCmoReportPage />}
            />
            <Route
              path=":userId/feedback/:feedbackId"
              element={<MemberTeamFeedbackPage />}
            />
            <Route path=":userId" element={<MemberDetailPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="referee" element={<RefereeLayout />}>
        <Route
          index
          element={<AppNavigate to="/referee/appointments" replace />}
        />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="appointments" element={<RefereeAppointmentsLayout />}>
          <Route index element={<AppointmentsPage />} />
          <Route path="requested" element={<PendingRequestsPage />} />
          <Route path="open" element={<GlobalRequestPage />} />
        </Route>
        <Route path="request">
          <Route
            index
            element={
              <AppNavigate to="/referee/appointments/requested" replace />
            }
          />
          <Route
            path="pending"
            element={
              <AppNavigate to="/referee/appointments/requested" replace />
            }
          />
          <Route
            path="global"
            element={<AppNavigate to="/referee/appointments/open" replace />}
          />
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
      <Route element={<RequireInsightsAccess />}>
        <Route element={<InsightsLayout />}>
          <Route path="insights" element={<InsightsOverviewPage />} />
          <Route path="insights/officials" element={<InsightsOfficialsPage />} />
          <Route
            path="insights/grade/:level"
            element={<InsightsGradeRedirect />}
          />
          <Route element={<InsightsReportsLayout />}>
            <Route
              path="insights/reports"
              element={<AppNavigate to="/insights/reports/cmo" replace />}
            />
            <Route
              path="insights/reports/cmo"
              element={<InsightsCmoReportsPage />}
            />
            <Route
              path="insights/reports/coach-feedback"
              element={<InsightsCoachFeedbackPage />}
            />
            <Route
              path="insights/reports/coach-feedback/:feedbackId"
              element={<SchedulerFeedbackDetailPage />}
            />
          </Route>
          <Route
            path="insights/coach-feedback"
            element={
              <AppNavigate to="/insights/reports/coach-feedback" replace />
            }
          />
          <Route
            path="insights/coach-feedback/:feedbackId"
            element={<SchedulerFeedbackDetailPage />}
          />
          <Route
            path="insights/cmo-reports"
            element={<AppNavigate to="/insights/reports/cmo" replace />}
          />
        </Route>
      </Route>
      <Route
        path="members/*"
        element={<LegacyMembersRedirect />}
      />
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
        <Route path="queues" element={<SchedulerQueuesLayout />}>
          <Route
            index
            element={<AppNavigate to="/scheduler/queues/changes" replace />}
          />
          <Route element={<SchedulerQueuesWorkLayout />}>
            <Route path="coverage" element={<SchedulerQueuesCoveragePage />} />
            <Route path="changes" element={<SchedulerQueuesChangesPage />} />
            <Route
              path="notifications"
              element={<SchedulerQueuesNotificationsPage />}
            />
          </Route>
          <Route path="requests" element={<SchedulerQueuesRequestsLayout />}>
            <Route
              index
              element={
                <AppNavigate
                  to="/scheduler/queues/requests/raise-hand"
                  replace
                />
              }
            />
            <Route
              path="fixtures"
              element={<SchedulerQueuesFixtureRequestsPage />}
            />
            <Route
              path="team-links"
              element={<SchedulerQueuesTeamLinkRequestsPage />}
            />
            <Route
              path="raise-hand"
              element={<SchedulerQueuesRaiseHandRequestsPage />}
            />
          </Route>
          <Route path="crew" element={<SchedulerCrewDefaultsPage />} />
        </Route>
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
        element={<AppNavigate to="/scheduler/queues/requests/raise-hand" replace />}
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
        <Suspense fallback={<div className="rs-stack">Loading...</div>}>
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
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
