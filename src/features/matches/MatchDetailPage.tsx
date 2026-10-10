import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './match-detail.css';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Title,
  TextArea,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  TextInput,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  Alert,
} from '@patternfly/react-core';
import { MatchCrewReportStatusPanel } from '@/features/matches/MatchCrewReportStatusPanel';
import { CrewReportStatusPills } from '@/features/matches/CrewReportStatusPills';
import { canSeeMatchFees } from '@/domain/visibility';
import { roleHomeBack, useApp } from '@/app/AppContext';
import {
  applyMatchForfeitOutcome,
  cancelMatch,
  postponeMatch,
  reactivateMatch,
  statusLabel,
} from '@/domain/matchTransitions';
import {
  crewChipClass,
  crewStatusChipsForMatch,
  shouldShowCrewStatusChips,
} from '@/domain/crewChips';
import {
  matchFeeBreakdown,
} from '@/domain/economics';
import { formatAssignMatchBlurb } from '@/domain/territory';
import {
  applyMatchDivision,
  matchDivisionSummaryLabels,
  parseMatchDivision,
  tierOptionsFromOrgLevels,
  type MatchDivisionSelection,
} from '@/domain/matchDivision';
import { MatchDivisionPickers } from '@/features/matches/MatchDivisionPickers';
import {
  downloadMatchIcs,
  matchHasCalendarTime,
} from '@/domain/matchIcs';
import { assignmentEmailNotifyLine } from '@/domain/assignmentEmail';
import { effectiveContactEmail } from '@/domain/contactEmail';
import { mapsDirectionsUrl } from '@/services/maps';
import { matchAppUrl } from '@/services/appLinks';
import {
  CREW_SLOT_LABELS,
  CREW_SLOTS,
  REQUESTABLE_SLOT_LABELS,
  REQUESTABLE_SLOT_SHORT,
  assignmentForUser,
  cmoAsAssignment,
  crewBlocks,
  crewPeople,
  crewSlotStatusLabelForAssignment,
  genderLabel,
  hasRefereeLensRole,
  isCrewSlot,
  isCrewVisibleToTeams,
  rolesNeededForMatch,
  shouldShowAssignmentNotifyLine,
  teamFacingCmoFill,
  teamFacingCrewRoleFill,
  teamFacingCrewShapeLabel,
  type CrewAssignment,
  type CrewSlot,
  type FeeTable,
  type Match,
  type RequestableSlot,
  type Team,
  type UserProfile,
} from '@/domain/types';
import {
  collectAssignmentHistory,
  namedOfficialsNeedingAvailability,
} from '@/domain/crew';
import { availableCrewRolesToAdd } from '@/domain/crewSize';
import { isOutsideAppointmentUserId } from '@/domain/placeholderAssignment';
import { IconDateInput } from '@/ui/IconDateInput';
import {
  canOfficialRequestMatch,
  gameRequestPreferredSlots,
  isPendingRequestActive,
  openRequestSlots,
  pendingRequestForUser,
} from '@/domain/requests';
import { openGroupMailto, uniqueEmails } from '@/services/mailto';
import { persistCrewAssignmentAndEmail, persistCrewUnassignmentAndEmail, resendCrewAssignmentEmail } from '@/services/liveAssignment';
import {
  applyComplianceHold,
  defaultComplianceHoldMessage,
  complianceHoldFixtureLine,
  isComplianceHeld,
  shouldShowComplianceHoldUi,
} from '@/domain/complianceHold';
import { ComplianceHoldOverlay } from '@/ui/ComplianceHoldOverlay';
import { notifyComplianceHoldChange } from '@/services/complianceHoldNotify';
import { defaultOrgId, clearMatchForfeitInFirestore, createGameRequestInFirestore, patchGameRequestContentInFirestore, saveComplianceHoldInFirestore, saveMatchCrewAssignment, saveMatchDetailsInFirestore, saveMatchForfeitInFirestore, saveMatchPlayedForfeitInFirestore, saveMatchRaiseHandInterest, saveMatchWorkflowInFirestore, callMatchSelfService } from '@/services/orgData';
import {
  formatRaiseHandInterestSlots,
  raiseHandInterestStatusLabel,
  sortedRaiseHandInterest,
} from '@/domain/raiseHandInterest';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  isTournamentMatch,
  validateScheduleUrlInput,
} from '@/domain/matchScheduleUrl';
import { backState, useAppBack } from '@/nav/backNav';
import {
  formatTeamDisplayLabel,
  matchTeamDisplayNames,
  type TeamDisplayLabel,
} from '@/domain/matchCardFooter';
import {
  matchDetailHeaderReportLinks,
} from '@/features/referee/reports/reportLinks';
import { fulfillRaiseHandsOnAssignmentConfirm } from '@/features/scheduler/queues/raiseHandActions';
import { OfficialAssignPicker } from '@/features/matches/OfficialAssignPicker';
import {
  formatMatchKickoff,
  orgTimeZone,
} from '@/domain/matchTime';
import {
  MatchAssignerMenu,
  type AssignerMenuAction,
} from '@/features/matches/MatchAssignerMenu';
import { MatchForfeitModal } from '@/features/matches/MatchForfeitModal';
import { useContextualBackBar } from '@/app/shell/contextualBar';
import { useOfficialQuickLookOptional } from '@/features/scheduler/officialQuickLookContext';
import { isReportWindowOpen } from '@/domain/reports';

type CrewPickTarget = {
  slot: RequestableSlot;
  /** Filled official user id (profile quick look). */
  userId?: string;
  /** Fee-crew block id (empty or filled). */
  assignmentId?: string;
  /** CMO block id (empty or filled). */
  cmoId?: string;
  /** Filled CMO userId (contact / clear). */
  cmoUserId?: string;
};

type MatchDetailsDraft = {
  title: string;
  division: MatchDivisionSelection;
  fees: Partial<Record<RequestableSlot, string>>;
  flightProvided: boolean;
  housingProvided: boolean;
  notes: string;
  scheduleUrl: string;
};

type DetailsSaveState = 'idle' | 'saving' | 'error';

function buildMatchDetailsDraft(
  match: Match,
  tierOptions: string[],
  feeDefaults: FeeTable,
): MatchDetailsDraft {
  const fees: Partial<Record<RequestableSlot, string>> = {};
  for (const slot of rolesNeededForMatch(match)) {
    if (slot === 'cmo') {
      fees[slot] = String(match.feeOverride?.cmo ?? feeDefaults.cmo ?? 0);
    } else {
      fees[slot] = String(match.feeOverride?.[slot] ?? feeDefaults[slot]);
    }
  }
  return {
    title: match.title ?? '',
    division: parseMatchDivision(match, tierOptions),
    fees,
    flightProvided: match.flightProvided,
    housingProvided: match.housingProvided,
    notes: match.notes ?? '',
    scheduleUrl: match.scheduleUrl ?? '',
  };
}

function TeamDisplayName({ label }: { label: TeamDisplayLabel }) {
  return (
    <>
      {label.name}
      {label.abbreviation ? (
        <span className="rs-detail__team-abbr"> ({label.abbreviation})</span>
      ) : null}
    </>
  );
}

/** Team row confirm chip — Confirmed is green; Unconfirmed / Change Proposed stay red. */
function teamConfirmChip(
  _match: Match,
  sideConfirmed: boolean,
  hasPendingProposal = false,
): { label: string; tone: 'urgent' | 'ok' } {
  if (hasPendingProposal) {
    return { label: 'Change Proposed', tone: 'urgent' };
  }
  if (sideConfirmed) {
    return { label: 'Confirmed', tone: 'ok' };
  }
  return { label: 'Unconfirmed', tone: 'urgent' };
}

function formatActivityAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatProposalVenue(
  venueName?: string,
  venueAddress?: string,
): string | null {
  const text = [venueName, venueAddress].filter(Boolean).join(' · ');
  return text || null;
}

type PersonContact = {
  id: string;
  name: string;
  subtitle?: string;
  emails: string[];
  phones: string[];
};

type EmailScope = 'teams' | 'crew' | 'both';

function resolveTeamContact(
  teamId: string,
  teamName: string,
  teams: Team[],
  users: UserProfile[],
): PersonContact {
  const team = teams.find((t) => t.id === teamId);
  const admins = users.filter(
    (u) => u.roles.includes('teamAdmin') && u.teamIds.includes(teamId),
  );
  return {
    id: teamId,
    name: team?.name ?? teamName,
    subtitle: 'Team contact',
    emails: uniqueEmails([
      ...(team?.contactEmails ?? []),
      ...admins.map((a) => effectiveContactEmail(a)),
    ]),
    phones: uniqueEmails([
      ...(team?.contactPhones ?? []),
      ...admins.map((a) => a.phone),
    ]),
  };
}

function resolveCrewContact(
  slot: CrewSlot,
  userId: string | undefined,
  userName: string | undefined,
  users: UserProfile[],
): PersonContact | null {
  if (!userId) return null;
  const user = users.find((u) => u.uid === userId);
  return {
    id: userId,
    name: user?.displayName ?? userName ?? 'Official',
    subtitle: CREW_SLOT_LABELS[slot],
    emails: uniqueEmails(
      user ? [effectiveContactEmail(user)] : [],
    ),
    phones: uniqueEmails(user?.phone ? [user.phone] : []),
  };
}

/** Value for `<input type="datetime-local">` from an ISO timestamp. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveCmoContact(
  cmo: { userId?: string; userName?: string },
  users: UserProfile[],
): PersonContact | null {
  if (!cmo.userId) return null;
  const user = users.find((u) => u.uid === cmo.userId);
  return {
    id: cmo.userId,
    name: user?.displayName ?? cmo.userName ?? 'CMO',
    subtitle: 'Coaching Match Official',
    emails: uniqueEmails(
      user ? [effectiveContactEmail(user)] : [],
    ),
    phones: uniqueEmails(user?.phone ? [user.phone] : []),
  };
}

export function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    state,
    store,
    isAssignerView,
    isOfficialView,
    hasAssignerRole,
    roleView,
    dataMode,
  } = useApp();
  const officialQuickLook = useOfficialQuickLookOptional();
  const orgTz = orgTimeZone(state.org.timezone);
  const match = state.matches.find((m) => m.id === id);
  const teamsById = useMemo(
    () => new Map(state.teams.map((t) => [t.id, t])),
    [state.teams],
  );
  const teamNames = useMemo(
    () => (match ? matchTeamDisplayNames(match, teamsById) : null),
    [match, teamsById],
  );
  const homeBack = useMemo(() => roleHomeBack(roleView), [roleView]);
  const { goBack, backLabel } = useAppBack(homeBack);
  const [reason, setReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [declineMode, setDeclineMode] = useState<'decline' | 'withdraw'>(
    'decline',
  );
  const [personContact, setPersonContact] = useState<PersonContact | null>(null);
  const [showEmailMatch, setShowEmailMatch] = useState(false);
  const [emailScope, setEmailScope] = useState<EmailScope>('both');
  const [emailError, setEmailError] = useState('');
  const [proposeKickoff, setProposeKickoff] = useState('');
  const [proposeVenueName, setProposeVenueName] = useState('');
  const [proposeVenueAddress, setProposeVenueAddress] = useState('');
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showDenyProposal, setShowDenyProposal] = useState(false);
  const [denyProposalReason, setDenyProposalReason] = useState('');
  const [denyProposalId, setDenyProposalId] = useState<string | null>(null);
  const [denyProposalMode, setDenyProposalMode] = useState<'team' | 'assigner'>(
    'team',
  );
  const [denyRequireReconfirm, setDenyRequireReconfirm] = useState(true);
  const [pickTarget, setPickTarget] = useState<CrewPickTarget | null>(null);
  type ResendEmailState = 'idle' | 'sending' | 'sent' | 'error';
  const [resendEmailByKey, setResendEmailByKey] = useState<
    Record<string, ResendEmailState>
  >({});
  const [coverageAlertSent, setCoverageAlertSent] = useState(false);
  const [assignerConfirm, setAssignerConfirm] =
    useState<AssignerMenuAction | null>(null);
  const [showComplianceHoldModal, setShowComplianceHoldModal] = useState(false);
  const [complianceHoldDraft, setComplianceHoldDraft] = useState('');
  const [showMatchStatusActions, setShowMatchStatusActions] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<MatchDetailsDraft | null>(
    null,
  );
  const [detailsSaveState, setDetailsSaveState] =
    useState<DetailsSaveState>('idle');
  const [detailsSaveError, setDetailsSaveError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [showDiscardDetails, setShowDiscardDetails] = useState(false);
  const [crewManaging, setCrewManaging] = useState(false);
  const detailsInitialRef = useRef('');
  const [requestSelectedSlots, setRequestSelectedSlots] = useState<
    RequestableSlot[]
  >([]);
  const [requestNote, setRequestNote] = useState('');
  const [requestEditing, setRequestEditing] = useState(true);
  const [requestToast, setRequestToast] = useState(false);
  const [selfServiceBusy, setSelfServiceBusy] = useState(false);
  const [scheduleUrlError, setScheduleUrlError] = useState('');
  const requestSectionRef = useRef<HTMLElement | null>(null);
  const titleRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDetailsDraft(null);
    setDetailsSaveState('idle');
    setDetailsSaveError('');
    setScheduleUrlError('');
    setCrewManaging(false);
  }, [id]);

  const tierOptions = useMemo(
    () => tierOptionsFromOrgLevels(state.org.matchLevels),
    [state.org.matchLevels],
  );
  const divisionSummaryLabels = useMemo(
    () =>
      match ? matchDivisionSummaryLabels(match, tierOptions, genderLabel) : [],
    [match, tierOptions],
  );

  const persistSelfServiceIfLive = useCallback(
    async (input: Parameters<typeof callMatchSelfService>[0]) => {
      if (dataMode !== 'live' || !isFirebaseConfigured) return true;
      try {
        await callMatchSelfService({
          orgId: defaultOrgId(),
          ...input,
        });
        return true;
      } catch (err) {
        console.error('Failed to save match response', err);
        store.releaseLiveSnapshotGuard(`match:${input.matchId}`);
        window.alert(
          err instanceof Error
            ? `Updated locally, but save failed: ${err.message}`
            : 'Updated locally, but save failed.',
        );
        return false;
      }
    },
    [dataMode, store],
  );

  const officials = useMemo(
    () =>
      state.users
        .filter((u) => hasRefereeLensRole(u.roles))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [state.users],
  );

  const assignmentHistory = useMemo(
    () => (match ? collectAssignmentHistory(match) : []),
    [match],
  );
  const raiseHandInterest = useMemo(
    () => (match ? sortedRaiseHandInterest(match) : []),
    [match],
  );

  const teamEmails = useMemo(() => {
    if (!match) return [];
    return uniqueEmails([
      ...resolveTeamContact(
        match.homeTeamId,
        teamNames?.home.name ?? match.homeTeamName,
        state.teams,
        state.users,
      ).emails,
      ...resolveTeamContact(
        match.awayTeamId,
        teamNames?.away.name ?? match.awayTeamName,
        state.teams,
        state.users,
      ).emails,
    ]);
  }, [match, state.teams, state.users, teamNames]);

  const crewEmails = useMemo(() => {
    if (!match) return [];
    const slotEmails = CREW_SLOTS.flatMap((slot) =>
      crewPeople(match.crew[slot]).flatMap((a) => {
        const person = resolveCrewContact(
          slot,
          a.userId,
          a.userName,
          state.users,
        );
        return person?.emails ?? [];
      }),
    );
    const cmoEmails = (match.cmo ?? []).flatMap((c) => {
      const person = resolveCmoContact(c, state.users);
      return person?.emails ?? [];
    });
    return uniqueEmails([...slotEmails, ...cmoEmails]);
  }, [match, state.users]);

  const requestSlots = useMemo(
    () => (match ? openRequestSlots(match) : []),
    [match],
  );

  useEffect(() => {
    setProposeKickoff(match?.kickoffAt ? toDatetimeLocalValue(match.kickoffAt) : '');
    setProposeVenueName(match?.venueName ?? '');
    setProposeVenueAddress(match?.venueAddress ?? '');
    setShowProposeModal(false);
  }, [match?.id, match?.kickoffAt, match?.venueName, match?.venueAddress]);

  useEffect(() => {
    if (!match || !currentUser) return;
    const pending = pendingRequestForUser(
      state.requests,
      match.id,
      currentUser.uid,
    );
    const active =
      pending && isPendingRequestActive(match, pending) ? pending : undefined;
    if (active) {
      setRequestSelectedSlots(gameRequestPreferredSlots(active));
      setRequestNote(active.note ?? '');
      setRequestEditing(false);
    } else {
      setRequestSelectedSlots([]);
      setRequestNote('');
      setRequestEditing(true);
    }
  }, [match, currentUser, state.requests]);

  const highlightRequest = searchParams.get('request') === '1';
  const canRequestPreview = Boolean(
    match &&
      currentUser &&
      isOfficialView &&
      canOfficialRequestMatch(match, currentUser.uid, state.requests),
  );

  useEffect(() => {
    if (!canRequestPreview || !highlightRequest) return;
    const t = window.setTimeout(() => {
      requestSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
    return () => window.clearTimeout(t);
  }, [canRequestPreview, highlightRequest, match?.id]);

  useEffect(() => {
    if (!requestToast) return;
    const id = window.setTimeout(() => setRequestToast(false), 4000);
    return () => window.clearTimeout(id);
  }, [requestToast]);

  useEffect(() => {
    if (!detailsSaved) return;
    const id = window.setTimeout(() => setDetailsSaved(false), 4000);
    return () => window.clearTimeout(id);
  }, [detailsSaved]);

  const detailsDirty = Boolean(
    detailsDraft && JSON.stringify(detailsDraft) !== detailsInitialRef.current,
  );

  const closeDetailsEdit = useCallback(() => {
    setDetailsDraft(null);
    setDetailsSaveState('idle');
    setDetailsSaveError('');
    setScheduleUrlError('');
    setShowDiscardDetails(false);
  }, []);

  const requestCloseDetailsEdit = useCallback(() => {
    if (detailsDirty) {
      setShowDiscardDetails(true);
      return;
    }
    closeDetailsEdit();
  }, [closeDetailsEdit, detailsDirty]);

  const handleContextualBack = useCallback(() => {
    if (detailsDraft) {
      requestCloseDetailsEdit();
      return;
    }
    goBack();
  }, [detailsDraft, goBack, requestCloseDetailsEdit]);

  useContextualBackBar(
    detailsDraft ? 'Cancel editing' : backLabel,
    handleContextualBack,
  );

  useEffect(() => {
    if (!detailsDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [detailsDirty]);

  useEffect(() => {
    if (isAssignerView) return;
    setDetailsDraft(null);
    setCrewManaging(false);
  }, [isAssignerView]);

  if (!currentUser || !match) {
    return (
      <div className="rs-stack">
        <p>Match not found.</p>
      </div>
    );
  }

  const isAssigner = isAssignerView;
  const showCrewReportStatuses =
    isAssigner && !crewManaging && isReportWindowOpen(match.kickoffAt);
  const complianceHeld = isComplianceHeld(match);
  const showComplianceLockedView =
    complianceHeld && shouldShowComplianceHoldUi(roleView);
  const showTournamentSchedule = isTournamentMatch(match);
  const showMatchEconomics = canSeeMatchFees({
    hasAssignerRole,
    isAssignerView,
  });
  const isHomeAdmin =
    roleView === 'teamAdmin' &&
    currentUser.roles.includes('teamAdmin') &&
    currentUser.teamIds.includes(match.homeTeamId);
  const isAwayAdmin =
    roleView === 'teamAdmin' &&
    currentUser.roles.includes('teamAdmin') &&
    currentUser.teamIds.includes(match.awayTeamId);
  const myHit = assignmentForUser(match, currentUser.uid);
  const mySlot = myHit?.slot;
  const myAssignment = myHit?.assignment ?? null;
  const crewVisible =
    isAssigner || isOfficialView || isCrewVisibleToTeams(match);
  const pendingProposal = state.proposals.find(
    (p) => p.matchId === match.id && p.status === 'pending',
  );
  const assignerAckProposal = state.proposals.find(
    (p) =>
      p.matchId === match.id &&
      !p.assignerAckAt &&
      (p.status === 'pending' || p.status === 'approved'),
  );
  const deniedProposal = (() => {
    const latest = [...state.proposals]
      .filter((p) => p.matchId === match.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest?.status === 'rejected_by_other_team' ||
      latest?.status === 'withdrawn'
      ? latest
      : undefined;
  })();
  const acceptedProposal = (() => {
    const latest = [...state.proposals]
      .filter((p) => p.matchId === match.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest?.status === 'approved' ? latest : undefined;
  })();
  const proposalTeamName = (teamId: string) =>
    state.teams.find((t) => t.id === teamId)?.name ?? 'A team';
  const canProposeChange =
    (isHomeAdmin || isAwayAdmin) &&
    !pendingProposal &&
    !complianceHeld &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed' &&
    match.status !== 'draft' &&
    match.status !== 'change_proposed';
  const needsAvail =
    mySlot != null &&
    namedOfficialsNeedingAvailability(match).includes(mySlot as RequestableSlot);
  const isOfficial = isOfficialView;
  const pendingRequestRaw = pendingRequestForUser(
    state.requests,
    match.id,
    currentUser.uid,
  );
  const pendingRequest =
    pendingRequestRaw && isPendingRequestActive(match, pendingRequestRaw)
      ? pendingRequestRaw
      : undefined;
  const canRequest =
    isOfficial &&
    canOfficialRequestMatch(match, currentUser.uid, state.requests);
  const showRaiseHandCard =
    isOfficial &&
    !(match.cmo ?? []).some((c) => c.userId === currentUser.uid) &&
    !CREW_SLOTS.some((s) =>
      crewPeople(match.crew[s]).some((a) => a.userId === currentUser.uid),
    ) &&
    (Boolean(pendingRequest) || canRequest);
  const raiseHandLocked = Boolean(pendingRequest) && !requestEditing;
  const canSubmitRequest =
    showRaiseHandCard &&
    requestEditing &&
    requestSelectedSlots.length > 0 &&
    requestSelectedSlots.every((s) => requestSlots.includes(s));

  const needsOfficialConfirm =
    !complianceHeld &&
    isOfficialView &&
    Boolean(mySlot) &&
    (myAssignment?.status === 'official' ||
      myAssignment?.status === 'held' ||
      myAssignment?.status === 'pending_internal' ||
      needsAvail ||
      (match.status === 'needs_reconfirmation' &&
        myAssignment?.status !== 'confirmed'));

  const myTeamConfirmed =
    (isHomeAdmin && Boolean(match.homeConfirmedAt)) ||
    (isAwayAdmin && Boolean(match.awayConfirmedAt));
  const otherTeamName = isHomeAdmin
    ? (teamNames ? formatTeamDisplayLabel(teamNames.away) : match.awayTeamName)
    : isAwayAdmin
      ? (teamNames ? formatTeamDisplayLabel(teamNames.home) : match.homeTeamName)
      : null;
  const waitingOnOtherTeam =
    Boolean(myTeamConfirmed) &&
    ((isHomeAdmin && !match.awayConfirmedAt) ||
      (isAwayAdmin && !match.homeConfirmedAt));

  const feeParts =
    showMatchEconomics ? matchFeeBreakdown(match, state.org) : [];
  const showFees = feeParts.length > 0;
  const matchRoles = rolesNeededForMatch(match);
  const crewCoverage = matchRoles.reduce(
    (summary, slot) => {
      const blocks =
        slot === 'cmo' ? (match.cmo ?? []) : crewBlocks(match.crew[slot]);
      return {
        total: summary.total + Math.max(1, blocks.length),
        filled:
          summary.filled + blocks.filter((assignment) => assignment.userId).length,
      };
    },
    { filled: 0, total: 0 },
  );
  const canAlertCoverage =
    isAssigner &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed' &&
    (match.status === 'needs_reassignment' ||
      matchRoles.some((slot) =>
        slot === 'cmo'
          ? !(match.cmo ?? []).some((c) => c.userId)
          : crewPeople(match.crew[slot]).length === 0,
      ));
  const whereText =
    match.venueAddress?.trim() || match.venueName?.trim() || 'TBD';
  const whereMapsUrl = mapsDirectionsUrl({
    name: match.venueName,
    address: match.venueAddress?.trim() || undefined,
    lat: match.venueLat,
    lng: match.venueLng,
  });

  const beginDetailsEdit = () => {
    const draft = buildMatchDetailsDraft(
      match,
      tierOptions,
      state.org.defaultFees,
    );
    detailsInitialRef.current = JSON.stringify(draft);
    setDetailsDraft(draft);
    setDetailsSaveState('idle');
    setDetailsSaveError('');
    setScheduleUrlError('');
    setCrewManaging(false);
    window.requestAnimationFrame(() => {
      titleRowRef.current?.scrollIntoView({ block: 'start' });
    });
  };

  const saveDetails = async () => {
    if (!detailsDraft || detailsSaveState === 'saving') return;

    const validatedSchedule = validateScheduleUrlInput(
      detailsDraft.scheduleUrl,
    );
    if (!validatedSchedule.ok) {
      setScheduleUrlError(validatedSchedule.error);
      setDetailsSaveState('error');
      return;
    }

    const feeOverride = { ...(match.feeOverride ?? {}) };
    for (const slot of matchRoles) {
      const raw = detailsDraft.fees[slot]?.trim() ?? '';
      const amount = Number(raw);
      if (!raw || !Number.isFinite(amount) || amount < 0) {
        setDetailsSaveError(
          `Enter a valid non-negative fee for ${REQUESTABLE_SLOT_LABELS[slot]}.`,
        );
        setDetailsSaveState('error');
        return;
      }
      const defaultAmount =
        slot === 'cmo'
          ? (state.org.defaultFees.cmo ?? 0)
          : state.org.defaultFees[slot];
      if (amount === defaultAmount) delete feeOverride[slot];
      else feeOverride[slot] = amount;
    }

    const divisionFlags = applyMatchDivision(detailsDraft.division);
    const details = {
      ...divisionFlags,
      title: detailsDraft.title.trim() || undefined,
      feeOverride: Object.keys(feeOverride).length ? feeOverride : undefined,
      flightProvided: detailsDraft.flightProvided,
      housingProvided: detailsDraft.housingProvided,
      notes: detailsDraft.notes.trim() || undefined,
      scheduleUrl: validatedSchedule.value,
    };

    setDetailsSaveState('saving');
    setDetailsSaveError('');
    setScheduleUrlError('');
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await saveMatchDetailsInFirestore(defaultOrgId(), match.id, details);
      }
      store.setMatchFlags(match.id, details);
      detailsInitialRef.current = JSON.stringify(detailsDraft);
      setDetailsDraft(null);
      setDetailsSaveState('idle');
      setDetailsSaved(true);
    } catch (err) {
      console.error('saveMatchDetailsInFirestore failed', err);
      setDetailsSaveState('error');
      setDetailsSaveError(
        err instanceof Error
          ? `Could not save event details: ${err.message}`
          : 'Could not save event details. Try again.',
      );
    }
  };

  const openTeamContact = (side: 'home' | 'away') => {
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const teamName =
      side === 'home'
        ? (teamNames?.home.name ?? match.homeTeamName)
        : (teamNames?.away.name ?? match.awayTeamName);
    setPersonContact(
      resolveTeamContact(teamId, teamName, state.teams, state.users),
    );
  };

  const openCrewContact = (slot: CrewSlot, assignment: CrewAssignment) => {
    const person = resolveCrewContact(
      slot,
      assignment.userId,
      assignment.userName,
      state.users,
    );
    if (person) setPersonContact(person);
  };

  const openCmoContactRow = (cmo: { userId?: string; userName?: string }) => {
    const person = resolveCmoContact(cmo, state.users);
    if (person) setPersonContact(person);
  };

  const resendEmailKey = (
    slot: RequestableSlot,
    userId: string,
    blockId: string,
  ) => `${slot}:${userId}:${blockId}`;

  const openCrewPick = (target: CrewPickTarget) => {
    setPickTarget(target);
  };

  const onCrewRowActivate = (target: CrewPickTarget) => {
    if (isAssigner && crewManaging) {
      openCrewPick(target);
      return;
    }
    if (target.userId && officialQuickLook) {
      officialQuickLook.openOfficial(target.userId, {
        matchBack: { to: `/matches/${match.id}`, label: 'Match' },
      });
      return;
    }
    if (target.slot === 'cmo') {
      const cmo = (match.cmo ?? []).find((c) => c.userId === target.cmoUserId);
      if (cmo) openCmoContactRow(cmo);
      return;
    }
    const assignment = crewPeople(match.crew[target.slot as CrewSlot]).find(
      (a) => a.id === target.assignmentId,
    );
    if (assignment) openCrewContact(target.slot as CrewSlot, assignment);
  };

  const currentPickUserId = (() => {
    if (!pickTarget) return undefined;
    if (pickTarget.cmoUserId) return pickTarget.cmoUserId;
    if (pickTarget.assignmentId && pickTarget.slot !== 'cmo') {
      return crewPeople(match.crew[pickTarget.slot as CrewSlot]).find(
        (a) => a.id === pickTarget.assignmentId,
      )?.userId;
    }
    return undefined;
  })();

  const pickOfficial = (userId: string) => {
    if (!pickTarget) return;
    const { slot } = pickTarget;
    if (slot === 'cmo') {
      store.assignCmo(match.id, userId, pickTarget.cmoId);
    } else {
      store.assignCrew(match.id, slot, userId, false, pickTarget.assignmentId);
    }
    if (dataMode === 'live' && isFirebaseConfigured) {
      const next = store.getState().matches.find((m) => m.id === match.id);
      if (next) {
        void persistCrewAssignmentAndEmail({
          match: next,
          slot,
          userId,
        })
          .then((saved) => {
            if (saved) store.replaceMatch(saved);
          })
          .catch((err) => {
            console.error('Failed to save/email assignment', err);
            window.alert(
              err instanceof Error
                ? `Assigned locally, but email/save failed: ${err.message}`
                : 'Assigned locally, but email/save failed. Check the console.',
            );
          });
      }
    }
    setPickTarget(null);
  };

  const pickOutsideAppointment = () => {
    if (!pickTarget || !isCrewSlot(pickTarget.slot)) return;
    store.assignOutsideAppointment(
      match.id,
      pickTarget.slot,
      pickTarget.assignmentId,
    );
    if (dataMode === 'live' && isFirebaseConfigured) {
      const next = store.getState().matches.find((m) => m.id === match.id);
      if (next) {
        void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
          console.error('Failed to save outside appointment', err),
        );
      }
    }
    setPickTarget(null);
  };

  const resendAssignmentEmail = () => {
    if (!pickTarget || !currentPickUserId) return;
    const blockId = pickTarget.assignmentId ?? pickTarget.slot;
    void resendToOfficial(pickTarget.slot, currentPickUserId, blockId);
  };

  const resendToOfficial = (
    slot: RequestableSlot,
    userId: string,
    blockId: string,
  ) => {
    const key = resendEmailKey(slot, userId, blockId);
    if (dataMode === 'demo') {
      if (slot === 'cmo') return;
      setResendEmailByKey((prev) => ({ ...prev, [key]: 'sending' }));
      const next = store.resendAssignmentEmail(
        match.id,
        slot as CrewSlot,
        userId,
      );
      setResendEmailByKey((prev) => ({
        ...prev,
        [key]: next ? 'sent' : 'error',
      }));
      return;
    }
    if (dataMode !== 'live' || !isFirebaseConfigured) {
      window.alert('Resend email is only available in Live mode.');
      return;
    }
    setResendEmailByKey((prev) => ({ ...prev, [key]: 'sending' }));
    void resendCrewAssignmentEmail({
      match,
      slot,
      userId,
    })
      .then((next) => {
        if (next) store.replaceMatch(next);
        setResendEmailByKey((prev) => ({ ...prev, [key]: 'sent' }));
      })
      .catch((err) => {
        console.error('Failed to resend assignment email', err);
        setResendEmailByKey((prev) => ({ ...prev, [key]: 'error' }));
        window.alert(
          err instanceof Error
            ? `Could not resend email: ${err.message}`
            : 'Could not resend email. Check the console.',
        );
      });
  };

  /** Clear the named official but keep the open capacity block. */
  const clearOfficialFromBlock = (
    slot: RequestableSlot,
    opts: {
      assignmentId?: string;
      cmoId?: string;
      removedUserId?: string;
    },
  ) => {
    const { assignmentId, cmoId, removedUserId } = opts;
    if (slot === 'cmo') store.clearCmo(match.id, removedUserId, cmoId);
    else store.unassignCrew(match.id, slot, assignmentId);

    if (dataMode === 'live' && isFirebaseConfigured) {
      const next = store.getState().matches.find((m) => m.id === match.id);
      if (next && removedUserId) {
        void persistCrewUnassignmentAndEmail({
          match: next,
          slot,
          userId: removedUserId,
        }).catch((err) => {
          console.error('Failed to save/email unassignment', err);
          window.alert(
            err instanceof Error
              ? `Cleared locally, but email/save failed: ${err.message}`
              : 'Cleared locally, but email/save failed. Check the console.',
          );
        });
      } else if (next) {
        void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
          console.error('Failed to save crew clear', err),
        );
      }
    }
  };

  const clearPickSlot = () => {
    if (!pickTarget) return;
    const { slot, assignmentId, cmoUserId, cmoId } = pickTarget;
    const removedUserId =
      slot === 'cmo'
        ? cmoUserId
        : assignmentId
          ? crewPeople(match.crew[slot as CrewSlot]).find(
              (a) => a.id === assignmentId,
            )?.userId
          : undefined;

    clearOfficialFromBlock(slot, {
      assignmentId,
      cmoId,
      removedUserId,
    });
    setPickTarget(null);
  };

  const addableRoles = availableCrewRolesToAdd(match);

  /** × on a filled row clears the person; × on an empty row deletes the block. */
  const requestRemoveBlock = (
    role: RequestableSlot,
    blockId: string,
    hasPerson: boolean,
    personUserId?: string,
  ) => {
    if (hasPerson) {
      clearOfficialFromBlock(role, {
        assignmentId: role === 'cmo' ? undefined : blockId,
        cmoId: role === 'cmo' ? blockId : undefined,
        removedUserId: personUserId,
      });
      return;
    }
    store.removeCrewRole(match.id, role, blockId);
    if (dataMode === 'live' && isFirebaseConfigured) {
      const next = store.getState().matches.find((m) => m.id === match.id);
      if (next) {
        void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
          console.error('Failed to save removed crew block', err),
        );
      }
    }
  };

  const canToggleTeamDetails = (side: 'home' | 'away') => {
    if (match.status === 'change_proposed') return false;
    if (complianceHeld && !isAssigner) return false;
    // Scheduler can set either side.
    if (isAssigner) return true;
    // Referee (MO) can set either side — only in the Referee/CMO lens.
    if (isOfficialView && mySlot === 'mo' && myAssignment?.userId) return true;
    // Team Admin may only confirm their own club’s side.
    if (side === 'home' && isHomeAdmin) return true;
    if (side === 'away' && isAwayAdmin) return true;
    return false;
  };

  const toggleTeamDetails = (side: 'home' | 'away') => {
    if (!canToggleTeamDetails(side)) return;
    const confirmed =
      side === 'home' ? Boolean(match.homeConfirmedAt) : Boolean(match.awayConfirmedAt);
    store.setTeamDetailsConfirmed(match.id, side, !confirmed);
  };

  const emailSubject = `${teamNames ? formatTeamDisplayLabel(teamNames.home) : match.homeTeamName} vs ${teamNames ? formatTeamDisplayLabel(teamNames.away) : match.awayTeamName} — ${formatMatchKickoff(match.kickoffAt, orgTz)}`;

  const emailsForScope = (scope: EmailScope): string[] => {
    if (scope === 'teams') return teamEmails;
    if (scope === 'crew') return crewEmails;
    return uniqueEmails([...teamEmails, ...crewEmails]);
  };

  const openEmailModal = (preset: EmailScope = 'both') => {
    setEmailScope(preset);
    setEmailError('');
    setShowEmailMatch(true);
  };

  const confirmEmailMatch = () => {
    const all = emailsForScope(emailScope);
    const me = currentUser.email.trim().toLowerCase();
    const withoutSelf = all.filter((e) => e.toLowerCase() !== me);
    // Prefer others when present; allow self-only (dual-role assigner on crew).
    const emails = withoutSelf.length > 0 ? withoutSelf : all;
    if (emails.length === 0) {
      setEmailError(
        'No profile emails found for that selection. Officials must have an email on their MatchReadyTX profile (Google/Apple sign-in).',
      );
      return;
    }
    if (!openGroupMailto(emails, emailSubject)) {
      setEmailError('Could not open your email app.');
      return;
    }
    setShowEmailMatch(false);
  };

  const openDecline = () => {
    setDeclineMode('decline');
    setReason('');
    setShowDecline(true);
  };

  const openWithdraw = () => {
    setDeclineMode('withdraw');
    setReason('');
    setShowDecline(true);
  };

  const confirmDecline = async () => {
    if (!mySlot || !reason.trim() || !match) return;
    setSelfServiceBusy(true);
    store.officialUnavailable(
      match.id,
      mySlot,
      reason,
      declineMode === 'withdraw'
        ? 'released'
        : match.status === 'needs_reconfirmation'
          ? 'unavailable_on_change'
          : 'declined',
      myAssignment?.id,
    );
    const ok = await persistSelfServiceIfLive({
      matchId: match.id,
      action: 'decline',
      slot: mySlot,
      assignmentId: myAssignment?.id,
      reason: reason.trim() || undefined,
    });
    setSelfServiceBusy(false);
    if (!ok) return;
    setShowDecline(false);
    setReason('');
    navigate(-1);
  };

  const acceptAppointment = async () => {
    if (!mySlot || !match || selfServiceBusy || !currentUser) return;
    setSelfServiceBusy(true);
    store.confirmCrewSlot(match.id, mySlot, myAssignment?.id);
    const ok = await persistSelfServiceIfLive({
      matchId: match.id,
      action: 'confirm',
      slot: mySlot,
      assignmentId: myAssignment?.id,
    });
    if (ok) {
      await fulfillRaiseHandsOnAssignmentConfirm({
        store,
        dataMode,
        matchId: match.id,
        confirmedUserId: currentUser.uid,
      });
    }
    setSelfServiceBusy(false);
  };

  const openProposeModal = () => {
    setProposeKickoff(toDatetimeLocalValue(match.kickoffAt));
    setProposeVenueName(match.venueName ?? '');
    setProposeVenueAddress(match.venueAddress ?? '');
    setShowProposeModal(true);
  };

  const submitProposeChange = () => {
    if (!canProposeChange) return;
    const teamId = isHomeAdmin ? match.homeTeamId : match.awayTeamId;
    const fields: {
      kickoffAt?: string;
      venueName?: string;
      venueAddress?: string;
    } = {};
    if (proposeKickoff) {
      const kickoffAt = new Date(proposeKickoff).toISOString();
      if (Number.isNaN(new Date(proposeKickoff).getTime())) return;
      if (kickoffAt !== match.kickoffAt) fields.kickoffAt = kickoffAt;
    }
    const venueName = proposeVenueName.trim();
    const venueAddress = proposeVenueAddress.trim();
    if (venueName && venueName !== (match.venueName ?? '')) {
      fields.venueName = venueName;
    }
    if (venueAddress !== (match.venueAddress ?? '')) {
      fields.venueAddress = venueAddress;
    }
    if (
      !fields.kickoffAt &&
      fields.venueName === undefined &&
      fields.venueAddress === undefined
    ) {
      return;
    }
    store.proposeChange(match.id, teamId, fields, currentUser.uid);
    setShowProposeModal(false);
  };

  const openDenyProposal = (mode: 'team' | 'assigner' = 'team') => {
    if (!pendingProposal) return;
    setDenyProposalId(pendingProposal.id);
    setDenyProposalReason('');
    setDenyProposalMode(mode);
    setDenyRequireReconfirm(
      mode === 'assigner' && Boolean(pendingProposal.kickoffAt),
    );
    setShowDenyProposal(true);
  };

  const closeDenyProposal = () => {
    setShowDenyProposal(false);
    setDenyProposalReason('');
    setDenyProposalId(null);
    setDenyProposalMode('team');
    setDenyRequireReconfirm(true);
  };

  const confirmDenyProposal = () => {
    const proposalId = denyProposalId ?? pendingProposal?.id;
    const reason =
      denyProposalReason.trim() ||
      (
        document.getElementById(
          'deny-proposal-reason',
        ) as HTMLTextAreaElement | null
      )?.value?.trim() ||
      '';
    if (!proposalId || !reason) return;
    if (denyProposalMode === 'assigner') {
      store.dismissProposalAsAssigner(proposalId, currentUser.uid, reason, {
        requireOfficialsReconfirm: denyRequireReconfirm,
      });
    } else {
      store.denyProposalOtherTeam(proposalId, currentUser.uid, reason);
    }
    closeDenyProposal();
  };

  const confirmAssignerAction = () => {
    if (!assignerConfirm) return;
    switch (assignerConfirm) {
      case 'alert_coverage':
        store.sendCoverageAlert(match.id);
        setCoverageAlertSent(true);
        break;
      case 'cancel': {
        store.cancelOrPostpone(match.id, 'cancel');
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveMatchWorkflowInFirestore(
            defaultOrgId(),
            cancelMatch(match),
          ).catch((err) => {
            console.error('saveMatchWorkflowInFirestore failed', err);
            window.alert(
              err instanceof Error
                ? `Updated locally, but save failed: ${err.message}`
                : 'Updated locally, but save failed.',
            );
          });
        }
        break;
      }
      case 'postpone': {
        store.cancelOrPostpone(match.id, 'postpone');
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveMatchWorkflowInFirestore(
            defaultOrgId(),
            postponeMatch(match),
          ).catch((err) => {
            console.error('saveMatchWorkflowInFirestore failed', err);
            window.alert(
              err instanceof Error
                ? `Updated locally, but save failed: ${err.message}`
                : 'Updated locally, but save failed.',
            );
          });
        }
        break;
      }
      case 'played_forfeit': {
        store.setMatchFlags(match.id, { playedForfeit: true });
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveMatchPlayedForfeitInFirestore(
            defaultOrgId(),
            match.id,
            true,
          ).catch((err) => {
            console.error('saveMatchPlayedForfeitInFirestore failed', err);
            window.alert(
              err instanceof Error
                ? `Updated locally, but save failed: ${err.message}`
                : 'Updated locally, but save failed.',
            );
          });
        }
        break;
      }
      case 'clear_played_forfeit': {
        store.setMatchFlags(match.id, { playedForfeit: false });
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveMatchPlayedForfeitInFirestore(
            defaultOrgId(),
            match.id,
            false,
          ).catch((err) => {
            console.error('saveMatchPlayedForfeitInFirestore failed', err);
            window.alert(
              err instanceof Error
                ? `Updated locally, but save failed: ${err.message}`
                : 'Updated locally, but save failed.',
            );
          });
        }
        break;
      }
      case 'clear_forfeit': {
        store.clearMatchForfeit(match.id);
        if (dataMode === 'live' && isFirebaseConfigured) {
          void clearMatchForfeitInFirestore(defaultOrgId(), match.id).catch(
            (err) => {
              console.error('clearMatchForfeitInFirestore failed', err);
              window.alert(
                err instanceof Error
                  ? `Updated locally, but save failed: ${err.message}`
                  : 'Updated locally, but save failed.',
              );
            },
          );
        }
        break;
      }
      case 'reactivate': {
        store.reactivateMatch(match.id);
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveMatchWorkflowInFirestore(
            defaultOrgId(),
            reactivateMatch(match),
          ).catch((err) => {
            console.error('saveMatchWorkflowInFirestore failed', err);
            window.alert(
              err instanceof Error
                ? `Updated locally, but save failed: ${err.message}`
                : 'Updated locally, but save failed.',
            );
          });
        }
        break;
      }
      case 'remove_compliance_hold': {
        store.clearComplianceHold(match.id);
        if (dataMode === 'live' && isFirebaseConfigured) {
          void saveComplianceHoldInFirestore(defaultOrgId(), match.id, null)
            .then(() =>
              notifyComplianceHoldChange({
                match,
                users: state.users,
                timeZone: orgTz,
                locked: false,
                message: '',
              }),
            )
            .catch((err) => {
              console.error('clearComplianceHold failed', err);
              window.alert(
                err instanceof Error
                  ? `Updated locally, but save failed: ${err.message}`
                  : 'Updated locally, but save failed.',
              );
            });
        }
        break;
      }
    }
    setAssignerConfirm(null);
  };

  const confirmComplianceHold = () => {
    const message = complianceHoldDraft.trim();
    const hold = applyComplianceHold(match, currentUser, message).complianceHold;
    store.setComplianceHold(match.id, message);
    if (dataMode === 'live' && isFirebaseConfigured && hold) {
      void saveComplianceHoldInFirestore(defaultOrgId(), match.id, hold)
        .then(() =>
          notifyComplianceHoldChange({
            match: { ...match, complianceHold: hold },
            users: state.users,
            timeZone: orgTz,
            locked: true,
            message: hold.message,
          }),
        )
        .catch((err) => {
          console.error('setComplianceHold failed', err);
          window.alert(
            err instanceof Error
              ? `Updated locally, but save failed: ${err.message}`
              : 'Updated locally, but save failed.',
          );
        });
    }
    setShowComplianceHoldModal(false);
  };

  const onAssignerMenuAction = (action: AssignerMenuAction) => {
    if (action === 'edit_details') {
      beginDetailsEdit();
      return;
    }
    if (action === 'change_status') {
      setShowMatchStatusActions(true);
      return;
    }
    if (action === 'forfeit') {
      setShowForfeitModal(true);
      return;
    }
    if (action === 'compliance_hold') {
      setComplianceHoldDraft(defaultComplianceHoldMessage(match, currentUser));
      setShowComplianceHoldModal(true);
      return;
    }
    setAssignerConfirm(action);
  };

  const saveMatchForfeit = (input: {
    forfeitTeamId: string;
    homeScore: number;
    awayScore: number;
  }) => {
    store.recordMatchForfeit(match.id, input);
    if (dataMode === 'live' && isFirebaseConfigured) {
      void saveMatchForfeitInFirestore(
        defaultOrgId(),
        applyMatchForfeitOutcome(match, input),
      ).catch((err) => {
        console.error('saveMatchForfeitInFirestore failed', err);
        window.alert(
          err instanceof Error
            ? `Updated locally, but save failed: ${err.message}`
            : 'Updated locally, but save failed.',
        );
      });
    }
  };

  const showAcceptDecline = Boolean(
    isOfficialView && needsOfficialConfirm && mySlot,
  );

  const canWithdrawFromAppointment =
    isOfficialView &&
    Boolean(mySlot) &&
    myAssignment?.userId === currentUser.uid &&
    myAssignment?.status === 'confirmed' &&
    !showAcceptDecline &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed';

  const hasFixedOfficialAction =
    !showComplianceLockedView &&
    (showAcceptDecline ||
      canWithdrawFromAppointment ||
      (showRaiseHandCard && !raiseHandLocked));

  const crewReportLinks = matchDetailHeaderReportLinks(
    match,
    currentUser.uid,
    state.matchReports,
    state.cardReports,
  );
  const crewReportActions: {
    kind: 'match' | 'coaching' | 'card';
    label: string;
    to?: string;
    unavailableLabel?: string;
  }[] = [];
  const addCrewReportAction = (
    kind: 'match' | 'coaching' | 'card',
    fallbackLabel: string,
    unavailableLabel: string,
  ) => {
    const available = crewReportLinks.find((link) => link.kind === kind);
    crewReportActions.push(
      available ?? {
        kind,
        label: fallbackLabel,
        unavailableLabel,
      },
    );
  };
  const hasCrewMatchReportRole =
    mySlot === 'mo' || mySlot === 'ar1' || mySlot === 'ar2';
  if (isAssigner || (isOfficialView && hasCrewMatchReportRole)) {
    addCrewReportAction(
      'match',
      'Match report',
      'Match report unavailable until the reporting window opens',
    );
  }
  if (isAssigner || (isOfficialView && mySlot === 'mo')) {
    addCrewReportAction(
      'card',
      'Card report',
      'Card report unavailable until kickoff',
    );
  }
  if (isOfficialView && mySlot === 'cmo') {
    addCrewReportAction(
      'coaching',
      'Coaching report',
      'Coaching report unavailable until the reporting window opens',
    );
  }
  for (const link of crewReportLinks) {
    if (!crewReportActions.some((action) => action.kind === link.kind)) {
      crewReportActions.push(link);
    }
  }
  const showCrewReports =
    showCrewReportStatuses || crewReportActions.length > 0;
  const submitRequest = async () => {
    if (!canSubmitRequest || !currentUser || !match) return;

    if (pendingRequest) {
      const ok = store.updateGameRequest(
        pendingRequest.id,
        currentUser.uid,
        {
          preferredSlots: requestSelectedSlots,
          note: requestNote.trim() || undefined,
        },
      );
      if (!ok) return;

      if (dataMode === 'live' && isFirebaseConfigured) {
        try {
          await patchGameRequestContentInFirestore(
            defaultOrgId(),
            match.id,
            pendingRequest.id,
            {
              preferredSlots: requestSelectedSlots,
              note: requestNote.trim() || undefined,
            },
          );
        } catch (err) {
          console.error('Raise-hand update failed', err);
          window.alert(
            err instanceof Error
              ? err.message
              : 'Could not update your request. Try again.',
          );
          return;
        }
      }

      setRequestEditing(false);
      setRequestToast(true);
      return;
    }

    const reqId = store.requestGame(
      match.id,
      currentUser.uid,
      requestSelectedSlots,
      requestNote.trim() || undefined,
    );
    if (!reqId) return;

    if (dataMode === 'live' && isFirebaseConfigured) {
      const created = store.getState().requests.find((r) => r.id === reqId);
      if (created) {
        try {
          await createGameRequestInFirestore(defaultOrgId(), match.id, created);
          const withInterest = store
            .getState()
            .matches.find((m) => m.id === match.id);
          if (withInterest) {
            await saveMatchRaiseHandInterest(defaultOrgId(), withInterest);
          }
        } catch (err) {
          console.error('Raise-hand request failed', err);
          store.withdrawRequest(reqId, currentUser.uid);
          window.alert(
            err instanceof Error
              ? err.message
              : 'Could not save your request. Try again.',
          );
          return;
        }
      }
    }

    setRequestSelectedSlots([]);
    setRequestNote('');
    setRequestToast(true);
    window.requestAnimationFrame(() => {
      titleRowRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <div
      className={`rs-detail${
        hasFixedOfficialAction ? ' rs-detail--has-fixed-action' : ''
      }${isAssigner ? ' rs-detail--has-mobile-action' : ''}`}
    >
      <div className="rs-detail__title-row" ref={titleRowRef}>
        <Title headingLevel="h1" className="rs-detail__title">
          <span className="rs-detail__home">
            <span className="rs-detail__ha">(H)</span>{' '}
            {teamNames ? (
              <TeamDisplayName label={teamNames.home} />
            ) : (
              match.homeTeamName
            )}
          </span>
          <span className="rs-detail__vs">vs</span>
          <span className="rs-detail__away">
            <span className="rs-detail__ha">(A)</span>{' '}
            {teamNames ? (
              <TeamDisplayName label={teamNames.away} />
            ) : (
              match.awayTeamName
            )}
          </span>
        </Title>
        {!detailsDraft && isAssigner && (
          <div className="rs-detail__title-actions">
            <div className="rs-detail__desktop-action-menu">
              <MatchAssignerMenu
                match={match}
                canAlertCoverage={canAlertCoverage}
                coverageAlertLabel={
                  coverageAlertSent ? 'Resend alert' : 'Alert refs'
                }
                onAction={onAssignerMenuAction}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={
          showComplianceLockedView
            ? 'rs-detail__hold-wrap rs-detail__hold-wrap--locked'
            : 'rs-detail__hold-wrap'
        }
      >
        {showComplianceLockedView && match.complianceHold ? (
          <ComplianceHoldOverlay
            hold={match.complianceHold}
            eventTitle={match.title}
            fixtureLine={complianceHoldFixtureLine(match, orgTz, {
              home: teamNames
                ? formatTeamDisplayLabel(teamNames.home)
                : match.homeTeamName,
              away: teamNames
                ? formatTeamDisplayLabel(teamNames.away)
                : match.awayTeamName,
            })}
            variant="detail"
          />
        ) : null}
        <div
          className="rs-detail__hold-underlay"
          aria-hidden={showComplianceLockedView || undefined}
        >
      {complianceHeld && isAssigner ? (
        <Alert
          className="rs-detail__compliance-banner"
          variant="warning"
          title="Compliance hold active"
          isInline
        >
          Teams and officials cannot confirm or change this match until you
          remove the hold from the match menu.
        </Alert>
      ) : null}

      {!detailsDraft && <div className="rs-label-row rs-detail__status-row">
        {match.status !== 'crew_pending' && (
          <span
            className={`rs-pill${
              match.status === 'cancelled' || match.status === 'postponed'
                ? ' rs-pill--urgent'
                : ''
            }`}
          >
            {statusLabel(
              pendingProposal
                ? 'change_proposed'
                : match.status === 'change_proposed'
                  ? 'pending_team_review'
                  : match.status,
            )}
          </span>
        )}
        {match.playedForfeit ? (
          <span className="rs-pill rs-pill--urgent">Played forfeit</span>
        ) : null}
        {match.forfeitTeamId ? (
          <span className="rs-pill rs-pill--urgent">
            Forfeit —{' '}
            {match.forfeitTeamId === match.homeTeamId
              ? (teamNames ? formatTeamDisplayLabel(teamNames.home) : match.homeTeamName)
              : (teamNames ? formatTeamDisplayLabel(teamNames.away) : match.awayTeamName)}
          </span>
        ) : null}
        {shouldShowCrewStatusChips(match) &&
          crewStatusChipsForMatch(match).map((chip) => (
            <span
              key={chip.slot}
              className={crewChipClass(chip.tone)}
              title={
                chip.tone === 'ok'
                  ? `${chip.label} confirmed`
                  : chip.tone === 'warn'
                    ? `${chip.label} assigned — awaiting confirm`
                    : `${chip.label} not assigned`
              }
            >
              {chip.label}
            </span>
          ))}
        {pendingRequest && (
          <span className="rs-pill">Request pending</span>
        )}
        {mySlot && needsOfficialConfirm && (
          <span className="rs-pill rs-pill--urgent">Needs your confirm</span>
        )}
      </div>}

      {pendingProposal && (
        <section
          className="rs-detail-card rs-detail-card--proposal"
          aria-labelledby="proposal-heading"
        >
          <div className="rs-detail-card__head">
            <h3 id="proposal-heading" className="rs-detail-section__label">
              Change Proposed
            </h3>
            <span className="rs-pill rs-pill--urgent">Review</span>
          </div>
          <p className="rs-detail-note">
            Proposed by{' '}
            <strong>
              {proposalTeamName(pendingProposal.proposedByTeamId)}
            </strong>
            {pendingProposal.proposedByName
              ? ` (${pendingProposal.proposedByName})`
              : ''}
            . The other team must accept before this becomes the schedule.
            {isAssigner
              ? ' Apply updates the match and Sheet for everyone (you don’t need in-app team accept if you confirmed offline). Deny closes this proposal without Sheet write-back — use when you already applied offline, and optionally require officials to reconfirm. Acknowledge only dismisses this from your queue.'
              : ''}
          </p>
          <div className="rs-proposal-compare">
            {(pendingProposal.kickoffAt ||
              pendingProposal.previousKickoffAt ||
              match.kickoffAt) && (
              <div className="rs-proposal-compare__field">
                <span className="rs-proposal-compare__field-label">When</span>
                <div className="rs-proposal-compare__grid">
                  <div className="rs-proposal-compare__col">
                    <span className="rs-proposal-compare__eyebrow">Current</span>
                    <span className="rs-proposal-compare__value">
                      {formatMatchKickoff(
                        pendingProposal.previousKickoffAt ?? match.kickoffAt,
                        orgTz,
                      )}
                    </span>
                  </div>
                  <div
                    className={`rs-proposal-compare__col${
                      pendingProposal.kickoffAt
                        ? ' rs-proposal-compare__col--proposed'
                        : ''
                    }`}
                  >
                    <span className="rs-proposal-compare__eyebrow">
                      Proposed
                    </span>
                    <span className="rs-proposal-compare__value">
                      {pendingProposal.kickoffAt
                        ? formatMatchKickoff(pendingProposal.kickoffAt, orgTz)
                        : 'No change'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="rs-proposal-compare__field">
              <span className="rs-proposal-compare__field-label">Where</span>
              <div className="rs-proposal-compare__grid">
                <div className="rs-proposal-compare__col">
                  <span className="rs-proposal-compare__eyebrow">Current</span>
                  <span className="rs-proposal-compare__value">
                    {formatProposalVenue(
                      pendingProposal.previousVenueName ?? match.venueName,
                      pendingProposal.previousVenueAddress ??
                        match.venueAddress,
                    ) ?? '—'}
                  </span>
                </div>
                <div
                  className={`rs-proposal-compare__col${
                    pendingProposal.venueName != null ||
                    pendingProposal.venueAddress != null
                      ? ' rs-proposal-compare__col--proposed'
                      : ''
                  }`}
                >
                  <span className="rs-proposal-compare__eyebrow">Proposed</span>
                  <span className="rs-proposal-compare__value">
                    {pendingProposal.venueName != null ||
                    pendingProposal.venueAddress != null
                      ? formatProposalVenue(
                          pendingProposal.venueName ??
                            pendingProposal.previousVenueName ??
                            match.venueName,
                          pendingProposal.venueAddress ??
                            pendingProposal.previousVenueAddress ??
                            match.venueAddress,
                        ) ?? '—'
                      : 'No change'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <ul className="rs-proposal-activity">
            <li>
              Proposed
              {pendingProposal.proposedByName
                ? ` by ${pendingProposal.proposedByName}`
                : ''}{' '}
              · {formatActivityAt(pendingProposal.createdAt)}
            </li>
            {pendingProposal.otherTeamAcceptedAt && (
              <li>
                Accepted by{' '}
                {pendingProposal.otherTeamAcceptedByName ?? 'other team'} ·{' '}
                {formatActivityAt(pendingProposal.otherTeamAcceptedAt)}
              </li>
            )}
            {pendingProposal.assignerAckAt && (
              <li>
                Scheduler acknowledged
                {pendingProposal.assignerAckByName
                  ? ` by ${pendingProposal.assignerAckByName}`
                  : ''}{' '}
                · {formatActivityAt(pendingProposal.assignerAckAt)}
              </li>
            )}
          </ul>
          {(isHomeAdmin || isAwayAdmin) &&
            !pendingProposal.otherTeamAcceptedAt &&
            pendingProposal.proposedByTeamId !==
              (isHomeAdmin ? match.homeTeamId : match.awayTeamId) && (
              <div className="rs-detail-inline-actions">
                <Button
                  variant="primary"
                  onClick={() =>
                    store.acceptProposalOtherTeam(
                      pendingProposal.id,
                      currentUser.uid,
                    )
                  }
                >
                  Accept change
                </Button>
                <Button
                  variant="link"
                  isDanger
                  onClick={() => openDenyProposal('team')}
                >
                  Deny
                </Button>
              </div>
            )}
          {(isHomeAdmin || isAwayAdmin) &&
            pendingProposal.proposedByTeamId ===
              (isHomeAdmin ? match.homeTeamId : match.awayTeamId) &&
            !pendingProposal.otherTeamAcceptedAt && (
              <p className="rs-detail-note">
                Waiting on the other team to accept or deny.
              </p>
            )}
          {isAssigner && pendingProposal.status === 'pending' && (
            <div className="rs-detail-inline-actions">
              <Button
                variant="primary"
                onClick={() =>
                  store.applyProposalAsAssigner(
                    pendingProposal.id,
                    currentUser.uid,
                  )
                }
              >
                Apply change
              </Button>
              <Button
                variant="link"
                isDanger
                onClick={() => openDenyProposal('assigner')}
              >
                Deny change
              </Button>
              {!pendingProposal.assignerAckAt && (
                <Button
                  variant="link"
                  onClick={() =>
                    store.acknowledgeProposal(
                      pendingProposal.id,
                      currentUser.uid,
                    )
                  }
                >
                  Acknowledge only
                </Button>
              )}
            </div>
          )}
          {isAssigner &&
            pendingProposal.status === 'pending' &&
            pendingProposal.assignerAckAt && (
              <p className="rs-detail-note">
                You acknowledged this proposal. Apply change when you’re ready to
                update the match and Sheet, or deny if you already handled it
                offline.
              </p>
            )}
          {isAssigner && state.org.sheetSyncError && (
            <p className="rs-detail-note" role="alert">
              Sheet write-back / sync issue: {state.org.sheetSyncError}
            </p>
          )}
        </section>
      )}

      {!pendingProposal &&
        deniedProposal &&
        (isAssigner || isHomeAdmin || isAwayAdmin) && (
          <section
            className="rs-detail-card rs-detail-card--proposal-denied"
            aria-labelledby="proposal-denied-heading"
          >
            <div className="rs-detail-card__head">
              <h3
                id="proposal-denied-heading"
                className="rs-detail-section__label"
              >
                {deniedProposal.status === 'withdrawn'
                  ? 'Change dismissed'
                  : 'Change denied'}
              </h3>
              <span className="rs-pill rs-pill--urgent">
                {deniedProposal.status === 'withdrawn' ? 'Dismissed' : 'Denied'}
              </span>
            </div>
            <p className="rs-detail-note">
              A proposal from{' '}
              <strong>
                {proposalTeamName(deniedProposal.proposedByTeamId)}
              </strong>{' '}
              was{' '}
              {deniedProposal.status === 'withdrawn'
                ? 'dismissed by the scheduler'
                : 'denied'}
              . Schedule facts were not changed by this action.
            </p>
            {deniedProposal.denyReason && (
              <blockquote className="rs-proposal-deny-reason">
                {deniedProposal.denyReason}
              </blockquote>
            )}
            <ul className="rs-proposal-activity">
              <li>
                Proposed
                {deniedProposal.proposedByName
                  ? ` by ${deniedProposal.proposedByName}`
                  : ''}{' '}
                · {formatActivityAt(deniedProposal.createdAt)}
              </li>
              {deniedProposal.otherTeamDeniedAt && (
                <li>
                  Denied by{' '}
                  {deniedProposal.otherTeamDeniedByName ?? 'other team'} ·{' '}
                  {formatActivityAt(deniedProposal.otherTeamDeniedAt)}
                </li>
              )}
              {deniedProposal.status === 'withdrawn' &&
                deniedProposal.assignerAckAt && (
                  <li>
                    Dismissed
                    {deniedProposal.assignerAckByName
                      ? ` by ${deniedProposal.assignerAckByName}`
                      : ' by scheduler'}{' '}
                    · {formatActivityAt(deniedProposal.assignerAckAt)}
                  </li>
                )}
            </ul>
          </section>
        )}

      {!pendingProposal &&
        acceptedProposal &&
        (isHomeAdmin || isAwayAdmin) &&
        !(
          isAssigner &&
          assignerAckProposal?.id === acceptedProposal.id &&
          assignerAckProposal.status === 'approved'
        ) && (
          <section className="rs-detail-card rs-detail-card--proposal-ack">
            <div className="rs-detail-card__head">
              <h3 className="rs-detail-section__label">Change accepted</h3>
              <span className="rs-pill rs-pill--ok">Applied</span>
            </div>
            <p className="rs-detail-note">
              The proposed schedule change is now on the match sheet.
              Officials may need to reconfirm.
            </p>
            <ul className="rs-proposal-activity">
              <li>
                Proposed
                {acceptedProposal.proposedByName
                  ? ` by ${acceptedProposal.proposedByName}`
                  : ''}{' '}
                · {formatActivityAt(acceptedProposal.createdAt)}
              </li>
              {acceptedProposal.otherTeamAcceptedAt && (
                <li>
                  Accepted by{' '}
                  {acceptedProposal.otherTeamAcceptedByName ?? 'other team'} ·{' '}
                  {formatActivityAt(acceptedProposal.otherTeamAcceptedAt)}
                </li>
              )}
              {acceptedProposal.assignerAckAt && (
                <li>
                  Scheduler acknowledged
                  {acceptedProposal.assignerAckByName
                    ? ` by ${acceptedProposal.assignerAckByName}`
                    : ''}{' '}
                  · {formatActivityAt(acceptedProposal.assignerAckAt)}
                </li>
              )}
            </ul>
          </section>
        )}

      {!pendingProposal &&
        isAssigner &&
        assignerAckProposal &&
        assignerAckProposal.status === 'approved' && (
          <section className="rs-detail-card rs-detail-card--proposal-ack">
            <div className="rs-detail-card__head">
              <h3 className="rs-detail-section__label">Schedule updated</h3>
              <span className="rs-pill rs-pill--warn">Ack needed</span>
            </div>
            <p className="rs-detail-note">
              {proposalTeamName(assignerAckProposal.proposedByTeamId)} proposed
              a change that the other team accepted. Officials must reconfirm
              appointments. Apply to update the match and Sheet, or acknowledge
              only when you’ve seen it.
            </p>
            <ul className="rs-proposal-activity">
              <li>
                Proposed
                {assignerAckProposal.proposedByName
                  ? ` by ${assignerAckProposal.proposedByName}`
                  : ''}{' '}
                · {formatActivityAt(assignerAckProposal.createdAt)}
              </li>
              {assignerAckProposal.otherTeamAcceptedAt && (
                <li>
                  Accepted by{' '}
                  {assignerAckProposal.otherTeamAcceptedByName ?? 'other team'}{' '}
                  · {formatActivityAt(assignerAckProposal.otherTeamAcceptedAt)}
                </li>
              )}
            </ul>
            <Button
              variant="secondary"
              onClick={() =>
                store.acknowledgeProposal(
                  assignerAckProposal.id,
                  currentUser.uid,
                )
              }
            >
              Acknowledge (seen)
            </Button>
          </section>
        )}

      {isOfficial &&
        match.status === 'needs_reconfirmation' &&
        mySlot &&
        myAssignment &&
        myAssignment.status !== 'confirmed' &&
        myAssignment.userId === currentUser.uid && (
          <section className="rs-detail-card rs-detail-card--proposal-ack">
            <div className="rs-detail-card__head">
              <h3 className="rs-detail-section__label">
                Reconfirm appointment
              </h3>
              <span className="rs-pill rs-pill--urgent">Action</span>
            </div>
            <p className="rs-detail-note">
              Schedule details changed. Confirm you can still work this match,
              or decline so the slot can be reassigned.
            </p>
          </section>
        )}

      {detailsDraft ? (
        <section
          className="rs-detail-card rs-detail-editor"
          aria-labelledby="edit-details-heading"
        >
          <div className="rs-detail-card__head">
            <h2 id="edit-details-heading" className="rs-detail-section__label">
              Edit match details
            </h2>
            <span className="rs-detail-editor__mode">Unsaved draft</span>
          </div>
          <p className="rs-detail-note">
            These settings describe the match. Schedule changes to kickoff or
            venue use the separate proposal workflow.
          </p>

          <FormGroup fieldId="match-event-title" label="Event or tournament name">
            <TextInput
              id="match-event-title"
              value={detailsDraft.title}
              onChange={(_e, value) =>
                setDetailsDraft((draft) =>
                  draft ? { ...draft, title: value } : draft,
                )
              }
              placeholder="Optional grouping name"
            />
            <FormHelperText>
              Groups tournament matches and coach feedback.
            </FormHelperText>
          </FormGroup>

          <div className="rs-detail-editor__group">
            <h3 className="rs-detail-section__sublabel">Classification</h3>
            <MatchDivisionPickers
              division={detailsDraft.division}
              tierOptions={tierOptions}
              onChange={(division) =>
                setDetailsDraft((draft) =>
                  draft ? { ...draft, division } : draft,
                )
              }
            />
          </div>

          {showMatchEconomics && (
            <div className="rs-detail-editor__group">
              <h3 className="rs-detail-section__sublabel">Match fees</h3>
              <div className="rs-detail-editor__fees">
                {matchRoles.map((slot) => (
                  <FormGroup
                    key={slot}
                    fieldId={`match-fee-${slot}`}
                    label={REQUESTABLE_SLOT_LABELS[slot]}
                  >
                    <TextInput
                      id={`match-fee-${slot}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={detailsDraft.fees[slot] ?? ''}
                      onChange={(_event, value) =>
                        setDetailsDraft((draft) =>
                          draft
                            ? {
                                ...draft,
                                fees: { ...draft.fees, [slot]: value },
                              }
                            : draft,
                        )
                      }
                      aria-label={`${REQUESTABLE_SLOT_LABELS[slot]} fee in dollars`}
                    />
                  </FormGroup>
                ))}
              </div>
              <FormHelperText>
                Dollar amount paid for each assigned role.
              </FormHelperText>
            </div>
          )}

          <div className="rs-detail-editor__group">
            <h3 className="rs-detail-section__sublabel">Travel support</h3>
            <div className="rs-detail-editor__checks">
              <Checkbox
                id="match-flight-provided"
                label="Flight provided"
                isChecked={detailsDraft.flightProvided}
                onChange={(_event, checked) =>
                  setDetailsDraft((draft) =>
                    draft ? { ...draft, flightProvided: checked } : draft,
                  )
                }
              />
              <Checkbox
                id="match-lodging-provided"
                label="Lodging provided"
                isChecked={detailsDraft.housingProvided}
                onChange={(_event, checked) =>
                  setDetailsDraft((draft) =>
                    draft ? { ...draft, housingProvided: checked } : draft,
                  )
                }
              />
            </div>
          </div>

          <FormGroup fieldId="match-notes" label="Match notes">
            <TextArea
              id="match-notes"
              value={detailsDraft.notes}
              onChange={(_event, value) =>
                setDetailsDraft((draft) =>
                  draft ? { ...draft, notes: value } : draft,
                )
              }
              rows={3}
              placeholder="Parking, arrival notes, organizer details…"
            />
          </FormGroup>

          {detailsDraft.division.eventType === 'tournament' && (
            <FormGroup fieldId="match-schedule-url" label="Tournament schedule link">
              <TextInput
                id="match-schedule-url"
                type="url"
                value={detailsDraft.scheduleUrl}
                onChange={(_event, value) => {
                  setDetailsDraft((draft) =>
                    draft ? { ...draft, scheduleUrl: value } : draft,
                  );
                  setScheduleUrlError('');
                }}
                placeholder="https://drive.google.com/file/d/…/view"
                validated={scheduleUrlError ? 'error' : 'default'}
                aria-describedby={
                  scheduleUrlError ? 'match-schedule-url-error' : undefined
                }
              />
              <FormHelperText>
                Use a link that teams and officials have permission to open.
              </FormHelperText>
              {scheduleUrlError ? (
                <p
                  id="match-schedule-url-error"
                  className="rs-detail-note rs-detail-note--error"
                  role="alert"
                >
                  {scheduleUrlError}
                </p>
              ) : null}
            </FormGroup>
          )}

          {detailsSaveError ? (
            <Alert
              variant="danger"
              isInline
              title="Event details were not saved"
            >
              {detailsSaveError}
            </Alert>
          ) : null}

          <div className="rs-detail-editor__actions">
            <Button
              variant="secondary"
              onClick={requestCloseDetailsEdit}
              isDisabled={detailsSaveState === 'saving'}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void saveDetails()}
              isDisabled={!detailsDirty || detailsSaveState === 'saving'}
            >
              {detailsSaveState === 'saving' ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rs-detail-card" aria-labelledby="event-info-heading">
          <div className="rs-detail-card__head">
            <h2 id="event-info-heading" className="rs-detail-section__label">
              Match details
            </h2>
            <div className="rs-detail-card__actions">
              {canProposeChange ? (
                <Button
                  variant="link"
                  isInline
                  className="rs-detail-card__action"
                  onClick={openProposeModal}
                >
                  Propose change
                </Button>
              ) : null}
              {showTournamentSchedule && match.scheduleUrl ? (
                <Button
                  variant="link"
                  isInline
                  className="rs-detail-card__action"
                  onClick={() =>
                    window.open(
                      match.scheduleUrl,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  View schedule
                </Button>
              ) : null}
            </div>
          </div>
          <div className="rs-detail-meta">
            {match.title?.trim() ? (
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Event</span>
                <div className="rs-detail-meta__value">
                  <span>{match.title.trim()}</span>
                </div>
              </div>
            ) : null}
            <div className="rs-detail-meta__row">
              <span className="rs-detail-meta__label">When</span>
              <div className="rs-detail-meta__value">
                <span>{formatMatchKickoff(match.kickoffAt, orgTz)}</span>
              </div>
            </div>
            <div className="rs-detail-meta__row">
              <span className="rs-detail-meta__label">Where</span>
              <div className="rs-detail-meta__value">
                {whereMapsUrl ? (
                  <a
                    className="rs-detail-meta__maps"
                    href={whereMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {whereText}
                  </a>
                ) : (
                  <span>{whereText}</span>
                )}
              </div>
            </div>
            <div className="rs-detail-meta__row">
              <span className="rs-detail-meta__label">Classification</span>
              <div className="rs-detail-meta__value">
                <span>{divisionSummaryLabels.join(' · ')}</span>
              </div>
            </div>
            {isOfficialView && matchHasCalendarTime(match) && (
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Calendar</span>
                <div className="rs-detail-meta__value">
                  <button
                    type="button"
                    className="rs-detail-meta__maps"
                    onClick={() =>
                      downloadMatchIcs(match, matchAppUrl(match.id))
                    }
                  >
                    Add to calendar
                  </button>
                </div>
              </div>
            )}
            {showMatchEconomics && showFees && (
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Match fees</span>
                <div className="rs-detail-meta__value">
                  <span className="rs-detail-fees">
                    {feeParts
                      .map(
                        (part) =>
                          `${part.label} $${part.amount.toLocaleString()}`,
                      )
                      .join(' · ')}
                  </span>
                </div>
              </div>
            )}
            {showMatchEconomics && (
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Travel</span>
                <div className="rs-detail-meta__value">
                  <span>
                    {match.flightProvided && match.housingProvided
                      ? 'Flight and lodging provided'
                      : match.flightProvided
                        ? 'Flight provided; lodging not provided'
                        : match.housingProvided
                          ? 'Lodging provided; flight not provided'
                          : 'Flight and lodging not provided'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {match.notes?.trim() ? (
            <div className="rs-detail-additional">
              <h3 className="rs-detail-section__sublabel">Match notes</h3>
              <p className="rs-detail-additional__body">{match.notes.trim()}</p>
            </div>
          ) : isAssigner ? (
            <p className="rs-detail-additional__empty">No match notes.</p>
          ) : null}
        </section>
      )}

      {!detailsDraft && <>
      <section className="rs-detail-card" aria-labelledby="teams-heading">
        <div className="rs-detail-card__head">
          <h2 id="teams-heading" className="rs-detail-section__label">
            Teams
          </h2>
          <Button
            variant="link"
            isInline
            className="rs-detail-card__action"
            onClick={() => openEmailModal('teams')}
          >
            Email teams
          </Button>
        </div>
        {(isAssigner ||
          Boolean(mySlot === 'mo' && myAssignment?.userId) ||
          isHomeAdmin ||
          isAwayAdmin) &&
          match.status !== 'change_proposed' && (
          <p className="rs-detail-note">
            {isHomeAdmin || isAwayAdmin
              ? 'Tap your team’s confirmation status to update it.'
              : isAssigner
                ? 'Tap a confirmation status to record or clear it.'
                : 'As Match Official, tap a confirmation status to update it.'}
          </p>
        )}
        {waitingOnOtherTeam && otherTeamName && (
          <p className="rs-detail-note">
            You’ve confirmed. Waiting on {otherTeamName} to confirm.
          </p>
        )}
        <ul className="rs-detail-people">
          <li>
            <div className="rs-detail-people__row--team">
              <button
                type="button"
                className="rs-detail-people__team-main"
                onClick={() => openTeamContact('home')}
                aria-label={`Contact ${teamNames ? formatTeamDisplayLabel(teamNames.home) : match.homeTeamName}`}
              >
                <span className="rs-detail-people__slot">Home</span>
                <span className="rs-detail-people__name">
                  {teamNames ? (
                    <TeamDisplayName label={teamNames.home} />
                  ) : (
                    match.homeTeamName
                  )}
                </span>
              </button>
              {(() => {
                const chip = teamConfirmChip(
                  match,
                  Boolean(match.homeConfirmedAt),
                  Boolean(pendingProposal),
                );
                return canToggleTeamDetails('home') ? (
                  <button
                    type="button"
                    className="rs-detail-people__confirm-action"
                    onClick={() => toggleTeamDetails('home')}
                    aria-pressed={Boolean(match.homeConfirmedAt)}
                    aria-label={`Home confirmation: ${chip.label}. Tap to toggle.`}
                  >
                    <span
                      className={`rs-pill rs-detail-people__confirm${
                        chip.tone === 'ok'
                          ? ' rs-pill--ok'
                          : ' rs-pill--urgent'
                      }`}
                    >
                      {chip.label}
                    </span>
                  </button>
                ) : (
                  <span
                    className={`rs-pill rs-detail-people__confirm${
                      chip.tone === 'ok' ? ' rs-pill--ok' : ' rs-pill--urgent'
                    }`}
                  >
                    {chip.label}
                  </span>
                );
              })()}
            </div>
          </li>
          <li>
            <div className="rs-detail-people__row--team">
              <button
                type="button"
                className="rs-detail-people__team-main"
                onClick={() => openTeamContact('away')}
                aria-label={`Contact ${teamNames ? formatTeamDisplayLabel(teamNames.away) : match.awayTeamName}`}
              >
                <span className="rs-detail-people__slot">Away</span>
                <span className="rs-detail-people__name">
                  {teamNames ? (
                    <TeamDisplayName label={teamNames.away} />
                  ) : (
                    match.awayTeamName
                  )}
                </span>
              </button>
              {(() => {
                const chip = teamConfirmChip(
                  match,
                  Boolean(match.awayConfirmedAt),
                  Boolean(pendingProposal),
                );
                return canToggleTeamDetails('away') ? (
                  <button
                    type="button"
                    className="rs-detail-people__confirm-action"
                    onClick={() => toggleTeamDetails('away')}
                    aria-pressed={Boolean(match.awayConfirmedAt)}
                    aria-label={`Away confirmation: ${chip.label}. Tap to toggle.`}
                  >
                    <span
                      className={`rs-pill rs-detail-people__confirm${
                        chip.tone === 'ok'
                          ? ' rs-pill--ok'
                          : ' rs-pill--urgent'
                      }`}
                    >
                      {chip.label}
                    </span>
                  </button>
                ) : (
                  <span
                    className={`rs-pill rs-detail-people__confirm${
                      chip.tone === 'ok' ? ' rs-pill--ok' : ' rs-pill--urgent'
                    }`}
                  >
                    {chip.label}
                  </span>
                );
              })()}
            </div>
          </li>
        </ul>
      </section>

      {isOfficialView &&
        mySlot &&
        myAssignment?.status === 'pending_internal' && (
        <p className="rs-detail-note">
          Tentatively assigned as {REQUESTABLE_SLOT_LABELS[mySlot]} — confirmation opens
          after both teams confirm match facts.
        </p>
      )}

      <section className="rs-detail-card" aria-labelledby="crew-heading">
        <div className="rs-detail-card__head">
          <h2 id="crew-heading" className="rs-detail-section__label">
            {showCrewReports ? 'Crew & reports' : 'Crew'}
            <span className="rs-detail-section__count">
              {crewCoverage.filled} of {crewCoverage.total} filled
            </span>
          </h2>
          <div className="rs-detail-card__actions">
            {crewVisible && (
              <Button
                variant="link"
                isInline
                className="rs-detail-card__action"
                onClick={() => openEmailModal('crew')}
              >
                Email crew
              </Button>
            )}
            {isAssigner && (
              <Button
                variant={crewManaging ? 'secondary' : 'link'}
                isInline={!crewManaging}
                className="rs-detail-card__action"
                onClick={() => setCrewManaging((managing) => !managing)}
              >
                {crewManaging ? 'Done' : 'Manage crew'}
              </Button>
            )}
          </div>
        </div>
        {crewManaging && (
          <p className="rs-detail-note" role="status">
            Crew management is active. Select a row to assign or replace an
            official.
          </p>
        )}
        {showCrewReportStatuses && (
          <p className="rs-detail-note">
            Match and coaching reports affect payout. Select a status to open
            or file that report.
          </p>
        )}
        {crewReportActions.length > 0 && (
          <div
            className="rs-detail-crew-report-actions"
            aria-label="Report actions"
          >
            {crewReportActions.map((action) => (
              <Button
                key={action.kind}
                variant="secondary"
                isDisabled={!action.to}
                aria-label={action.unavailableLabel ?? action.label}
                onClick={
                  action.to
                    ? () =>
                        navigate(action.to!, {
                          state: backState({
                            to: `/matches/${match.id}`,
                            label: 'Match',
                          }),
                        })
                    : undefined
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        {crewVisible ? (
          <>
            <ul className="rs-detail-people">
              {matchRoles.flatMap((slot) => {
                const isCmo = slot === 'cmo';
                const blocks: {
                  key: string;
                  blockId: string;
                  userId?: string;
                  userName?: string;
                  status: string;
                  notifyLine?: string | null;
                  assignmentId?: string;
                  cmoId?: string;
                  cmoUserId?: string;
                }[] = isCmo
                  ? (match.cmo ?? []).map((c, i) => {
                      const view = cmoAsAssignment(c);
                      return {
                        key: c.id ?? `cmo-${c.userId ?? i}`,
                        blockId: c.id ?? `cmo-${i}`,
                        userId: c.userId,
                        userName: c.userName,
                        status: c.userId
                          ? crewSlotStatusLabelForAssignment(view)
                          : 'Open',
                        notifyLine:
                          c.userId && shouldShowAssignmentNotifyLine(view)
                            ? assignmentEmailNotifyLine(view, orgTz)
                            : null,
                        cmoId: c.id,
                        cmoUserId: c.userId,
                      };
                    })
                  : crewBlocks(match.crew[slot]).map((a) => ({
                      key: a.id,
                      blockId: a.id,
                      userId: a.userId,
                      userName: a.userName,
                      status: a.userId
                        ? crewSlotStatusLabelForAssignment(a)
                        : 'Open',
                      notifyLine:
                        a.userId && shouldShowAssignmentNotifyLine(a)
                          ? assignmentEmailNotifyLine(a, orgTz)
                          : null,
                      assignmentId: a.id,
                    }));

                const rows =
                  blocks.length > 0
                    ? blocks
                    : [
                        {
                          key: `${slot}-open`,
                          blockId: '',
                          status: 'Open',
                        } as (typeof blocks)[number],
                      ];

                return rows.map((b) => {
                  const filled = Boolean(b.userId);
                  const pickTarget: CrewPickTarget = isCmo
                    ? {
                        slot,
                        userId: b.userId,
                        cmoId: b.cmoId,
                        cmoUserId: b.cmoUserId,
                      }
                    : {
                        slot,
                        userId: b.userId,
                        assignmentId: b.assignmentId,
                      };
                  const rowLabel = crewManaging
                    ? filled
                      ? `Replace ${b.userName ?? 'official'} (${REQUESTABLE_SLOT_LABELS[slot]})`
                      : `Assign ${REQUESTABLE_SLOT_LABELS[slot]}`
                    : filled
                      ? `View ${b.userName ?? 'official'}'s profile (${REQUESTABLE_SLOT_LABELS[slot]})`
                      : `${REQUESTABLE_SLOT_LABELS[slot]} open`;
                  const showRowReports =
                    showCrewReportStatuses &&
                    filled &&
                    Boolean(b.userId) &&
                    slot !== 'no4';

                  const canRemove =
                    crewManaging &&
                    Boolean(b.blockId) &&
                    !(
                      slot === 'mo' &&
                      crewBlocks(match.crew.mo).length <= 1 &&
                      !filled
                    );

                  return (
                    <li key={b.key} className="rs-detail-people__item">
                      {showRowReports && b.userId ? (
                        <div className="rs-detail-people__row rs-detail-people__row--static rs-detail-people__row--reports">
                          <button
                            type="button"
                            className="rs-detail-people__profile"
                            onClick={() => onCrewRowActivate(pickTarget)}
                            aria-label={rowLabel}
                          >
                            <span className="rs-detail-people__slot">
                              {REQUESTABLE_SLOT_SHORT[slot]}
                            </span>
                            <span className="rs-detail-people__main">
                              <span className="rs-detail-people__name">
                                {b.userName ?? 'Official'}
                              </span>
                              {'notifyLine' in b && b.notifyLine ? (
                                <span className="rs-detail-people__notified">
                                  {b.notifyLine}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          <CrewReportStatusPills
                            match={match}
                            slot={slot}
                            officialId={b.userId}
                            officialName={b.userName ?? 'Official'}
                            users={state.users}
                            matchReports={state.matchReports}
                            cardReports={state.cardReports}
                          />
                        </div>
                      ) : crewManaging || filled ? (
                        <button
                          type="button"
                          className="rs-detail-people__row"
                          onClick={() => onCrewRowActivate(pickTarget)}
                          aria-label={rowLabel}
                        >
                          <span className="rs-detail-people__slot">
                            {REQUESTABLE_SLOT_SHORT[slot]}
                          </span>
                          <span className="rs-detail-people__main">
                            <span
                              className={`rs-detail-people__name${
                                filled ? '' : ' rs-detail-people__name--muted'
                              }`}
                            >
                              {filled ? (b.userName ?? 'Official') : 'Open'}
                            </span>
                            {'notifyLine' in b && b.notifyLine ? (
                              <span className="rs-detail-people__notified">
                                {b.notifyLine}
                              </span>
                            ) : null}
                          </span>
                          <span className="rs-detail-people__status">
                            <span>{b.status}</span>
                          </span>
                        </button>
                      ) : (
                        <div className="rs-detail-people__row rs-detail-people__row--static">
                          <span className="rs-detail-people__slot">
                            {REQUESTABLE_SLOT_SHORT[slot]}
                          </span>
                          <span className="rs-detail-people__name rs-detail-people__name--muted">
                            Open
                          </span>
                          <span className="rs-detail-people__status">Open</span>
                        </div>
                      )}
                      {crewManaging && filled && b.userId && (
                        <button
                          type="button"
                          className="rs-detail-people__resend"
                          aria-label={`Resend assignment email to ${b.userName ?? 'official'}`}
                          title="Resend MatchReadyTX assignment email"
                          disabled={
                            resendEmailByKey[
                              resendEmailKey(slot, b.userId, b.blockId)
                            ] === 'sending'
                          }
                          onClick={() => {
                            resendToOfficial(slot, b.userId!, b.blockId);
                          }}
                        >
                          {resendEmailByKey[
                            resendEmailKey(slot, b.userId, b.blockId)
                          ] === 'sent'
                            ? 'Sent'
                            : 'Resend email'}
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          className="rs-detail-people__remove"
                          aria-label={
                            filled
                              ? `Clear ${b.userName ?? 'official'} from ${REQUESTABLE_SLOT_LABELS[slot]}`
                              : `Remove ${REQUESTABLE_SLOT_LABELS[slot]} block`
                          }
                          onClick={() =>
                            requestRemoveBlock(
                              slot,
                              b.blockId,
                              filled,
                              b.userId,
                            )
                          }
                        >
                          {filled ? 'Clear' : 'Remove role'}
                        </button>
                      )}
                    </li>
                  );
                });
              })}
            </ul>
            {crewManaging && dataMode === 'live' && isFirebaseConfigured && (
              <p className="rs-detail-note">
                Assignment changes save immediately and may notify the selected
                official. Clearing an official leaves the role open.
              </p>
            )}
            {crewManaging && (
              <FormSelect
                className="rs-crew-add"
                id="add-crew-role"
                value=""
                aria-label="Add crew role"
                onChange={(_, v) => {
                  if (!v) return;
                  store.addCrewRole(match.id, v as RequestableSlot);
                  if (dataMode === 'live' && isFirebaseConfigured) {
                    const next = store
                      .getState()
                      .matches.find((m) => m.id === match.id);
                    if (next) {
                      void saveMatchCrewAssignment(defaultOrgId(), next).catch(
                        (err) =>
                          console.error('Failed to save added crew role', err),
                      );
                    }
                  }
                }}
              >
                <FormSelectOption value="" label="Add role…" />
                {addableRoles.map((role) => (
                  <FormSelectOption
                    key={role}
                    value={role}
                    label={REQUESTABLE_SLOT_LABELS[role]}
                  />
                ))}
              </FormSelect>
            )}
          </>
        ) : (
          <>
            <p className="rs-detail-note">
              {teamFacingCrewShapeLabel(match)}. Names stay hidden until the
              Match Official confirms.
            </p>
            <ul className="rs-detail-people">
              {matchRoles.map((slot) => {
                const isCmo = slot === 'cmo';
                const { fill, status } = isCmo
                  ? teamFacingCmoFill(match)
                  : teamFacingCrewRoleFill(match.crew[slot]);
                return (
                  <li key={slot}>
                    <div className="rs-detail-people__row rs-detail-people__row--static">
                      <span className="rs-detail-people__slot">
                        {REQUESTABLE_SLOT_SHORT[slot]}
                      </span>
                      <span
                        className={`rs-detail-people__name${
                          fill === 'Open' ? ' rs-detail-people__name--muted' : ''
                        }`}
                      >
                        {fill}
                      </span>
                      <span className="rs-detail-people__status">{status}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {isAssigner && (
        <MatchCrewReportStatusPanel
          match={match}
          users={state.users}
          matchReports={state.matchReports}
          cardReports={state.cardReports}
        />
      )}

      {isAssigner && (
        <section className="rs-detail-card">
          <details className="rs-detail-tools rs-match-history-details">
            <summary id="history-heading">Assignment history</summary>
            {assignmentHistory.length === 0 ? (
              <p className="rs-match-card__meta">
                No assignment history on this match yet.
              </p>
            ) : (
              <ul className="rs-history-list">
                {assignmentHistory.map(({ slot, entry }) => (
                  <li key={entry.id}>
                    <strong>
                      {REQUESTABLE_SLOT_LABELS[slot]} ·{' '}
                      {entry.action.replace(/_/g, ' ')}
                    </strong>
                    <div className="rs-match-card__meta">
                      {entry.userName} · {new Date(entry.at).toLocaleString()}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details className="rs-detail-tools rs-match-history-details">
            <summary id="raise-hand-interest-heading">
              Raise-hand interest
            </summary>
            {raiseHandInterest.length === 0 ? (
              <p className="rs-match-card__meta">
                No raise-hand volunteers recorded on this match yet.
              </p>
            ) : (
              <ul className="rs-history-list">
                {raiseHandInterest.map((row) => (
                  <li key={row.requestId}>
                    <strong>
                      {row.userName} · {formatRaiseHandInterestSlots(row)}
                    </strong>
                    <div className="rs-match-card__meta">
                      {raiseHandInterestStatusLabel(row)} ·{' '}
                      {new Date(row.requestedAt).toLocaleString()}
                      {row.resolvedAt
                        ? ` · closed ${new Date(row.resolvedAt).toLocaleString()}`
                        : ''}
                      {row.declineReason ? ` · ${row.declineReason}` : ''}
                      {row.note ? ` · “${row.note}”` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </section>
      )}

      </>}

      {showRaiseHandCard && (
        <section
          className={`rs-detail-card rs-raise-hand-card${
            raiseHandLocked ? ' rs-raise-hand-card--locked' : ''
          }`}
          aria-labelledby="raise-hand-heading"
          ref={requestSectionRef}
        >
          <div className="rs-raise-hand-card__body">
            <h3 id="raise-hand-heading" className="rs-detail-section__label rs-raise-hand-heading">
              <span>Raise hand</span>
              {pendingRequest && (
                <span className="rs-pill rs-pill--warn">Pending</span>
              )}
            </h3>
            <FormGroup
              label="Select roles you're open to"
              isRequired
              fieldId="request-role"
            >
              <div
                className="rs-slot-picker"
                role="group"
                aria-label="Select roles you're open to"
              >
                {requestSlots.map((s) => {
                  const selected = requestSelectedSlots.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      disabled={raiseHandLocked}
                      className={`rs-filter-chip${
                        selected ? ' rs-filter-chip--selected' : ''
                      }`}
                      onClick={() => {
                        if (raiseHandLocked) return;
                        setRequestSelectedSlots((prev) =>
                          selected
                            ? prev.filter((slot) => slot !== s)
                            : [...prev, s],
                        );
                      }}
                    >
                      {REQUESTABLE_SLOT_SHORT[s]}
                    </button>
                  );
                })}
              </div>
              {requestSlots.length === 0 && (
                <p className="rs-detail-note">No open roles on this match.</p>
              )}
            </FormGroup>
            <FormGroup label="Note (optional)" fieldId="request-note">
              <TextArea
                id="request-note"
                value={requestNote}
                onChange={(_, v) => setRequestNote(v)}
                rows={2}
                resizeOrientation="vertical"
                isDisabled={raiseHandLocked}
              />
            </FormGroup>
          </div>
          {raiseHandLocked && pendingRequest && (
            <div className="rs-raise-hand-card__overlay">
              <Button
                variant="primary"
                onClick={() => {
                  setRequestSelectedSlots(
                    gameRequestPreferredSlots(pendingRequest).filter((s) =>
                      requestSlots.includes(s),
                    ),
                  );
                  setRequestEditing(true);
                }}
              >
                Edit request
              </Button>
            </div>
          )}
        </section>
      )}
        </div>
      </div>

      {!showComplianceLockedView && showAcceptDecline && mySlot && (
        <div className="rs-detail-sticky rs-detail-sticky--split">
          <Button
            variant="primary"
            className="rs-detail-sticky__half"
            isLoading={selfServiceBusy}
            isDisabled={selfServiceBusy}
            onClick={() => void acceptAppointment()}
          >
            {match.status === 'needs_reconfirmation'
              ? 'Confirm new details'
              : 'Accept Appointment'}
          </Button>
          <Button
            variant="secondary"
            className="rs-detail-sticky__half"
            isDisabled={selfServiceBusy}
            onClick={() => openDecline()}
          >
            {match.status === 'needs_reconfirmation'
              ? 'Can’t attend'
              : 'Decline Appointment'}
          </Button>
        </div>
      )}

      {!showComplianceLockedView && canWithdrawFromAppointment && mySlot && (
        <div className="rs-detail-sticky">
          <Button
            variant="danger"
            isBlock
            isLoading={selfServiceBusy}
            isDisabled={selfServiceBusy}
            onClick={() => openWithdraw()}
          >
            Withdraw from appointment
          </Button>
        </div>
      )}

      {!showComplianceLockedView && showRaiseHandCard && !raiseHandLocked && (
        <div className="rs-detail-sticky">
          <Button
            variant="primary"
            isBlock
            isDisabled={!canSubmitRequest}
            className={
              canSubmitRequest
                ? undefined
                : 'rs-detail-sticky__submit--disabled'
            }
            onClick={() => void submitRequest()}
          >
            {pendingRequest ? 'Update request' : 'Submit request'}
          </Button>
        </div>
      )}

      {isAssigner && !detailsDraft && (
        <div className="rs-detail__mobile-action-bar">
          <MatchAssignerMenu
            match={match}
            canAlertCoverage={canAlertCoverage}
            coverageAlertLabel={
              coverageAlertSent ? 'Resend alert' : 'Alert refs'
            }
            onAction={onAssignerMenuAction}
            presentation="bottom-bar"
          />
        </div>
      )}

      {isAssigner && detailsDraft && (
        <div
          className="rs-detail__mobile-edit-bar"
          aria-label="Edit details actions"
        >
          <Button
            variant="secondary"
            onClick={requestCloseDetailsEdit}
            isDisabled={detailsSaveState === 'saving'}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void saveDetails()}
            isDisabled={!detailsDirty || detailsSaveState === 'saving'}
          >
            {detailsSaveState === 'saving' ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}

      <Modal
        variant={ModalVariant.small}
        isOpen={showDiscardDetails}
        onClose={() => setShowDiscardDetails(false)}
        aria-labelledby="discard-details-title"
        aria-describedby="discard-details-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="discard-details-title" size="lg">
            Discard unsaved changes?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="discard-details-desc" className="rs-modal-lede">
            Your event detail changes have not been saved.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDiscardDetails(false)}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={closeDetailsEdit}>
            Discard changes
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showDecline}
        onClose={() => setShowDecline(false)}
        aria-labelledby="decline-appointment-title"
        aria-describedby="decline-appointment-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="decline-appointment-title" size="lg">
            {declineMode === 'withdraw'
              ? 'Withdraw from appointment?'
              : 'Decline appointment?'}
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="decline-appointment-desc" className="rs-modal-lede">
            {declineMode === 'withdraw'
              ? "You already accepted this game. Let the assigner know why you can't work it — your slot will open for reassignment."
              : "Let the assigner know why you can't take this game."}
          </p>
          <FormGroup label="Reason" isRequired fieldId="decline-reason">
            <TextArea
              id="decline-reason"
              value={reason}
              onChange={(_, v) => setReason(v)}
              rows={3}
              aria-required
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setShowDecline(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isDisabled={!reason.trim() || selfServiceBusy}
            isLoading={selfServiceBusy}
            onClick={() => void confirmDecline()}
          >
            {declineMode === 'withdraw'
              ? 'Confirm withdraw'
              : 'Confirm decline'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(personContact)}
        onClose={() => setPersonContact(null)}
        aria-labelledby="person-contact-title"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="person-contact-title" size="lg">
            {personContact?.name ?? 'Contact'}
          </Title>
        </ModalHeader>
        <ModalBody>
          {personContact && (
            <>
              {personContact.subtitle && (
                <p className="rs-detail-contact__subtitle">
                  {personContact.subtitle}
                </p>
              )}
              <dl className="rs-detail-contact">
                <div className="rs-detail-contact__row">
                  <dt>Phone</dt>
                  <dd>
                    {personContact.phones.length > 0 ? (
                      personContact.phones.map((p) => (
                        <a key={p} href={`tel:${p.replace(/\s/g, '')}`}>
                          {p}
                        </a>
                      ))
                    ) : (
                      <span className="rs-detail-contact__empty">Not listed</span>
                    )}
                  </dd>
                </div>
                <div className="rs-detail-contact__row">
                  <dt>Email</dt>
                  <dd>
                    {personContact.emails.length > 0 ? (
                      personContact.emails.map((e) => (
                        <a key={e} href={`mailto:${e}`}>
                          {e}
                        </a>
                      ))
                    ) : (
                      <span className="rs-detail-contact__empty">Not listed</span>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setPersonContact(null)}>
            Done
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={Boolean(pickTarget)}
        onClose={() => setPickTarget(null)}
        aria-labelledby="pick-official-title"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="pick-official-title" size="lg">
            {pickTarget
              ? `Assign ${REQUESTABLE_SLOT_LABELS[pickTarget.slot]}`
              : 'Assign official'}
          </Title>
        </ModalHeader>
        <ModalBody>
          <p className="rs-official-picker__match-blurb">
            {formatAssignMatchBlurb(match, orgTz)}
          </p>
          <OfficialAssignPicker
            officials={officials}
            matches={state.matches}
            teams={state.teams}
            availability={state.availability}
            timeZone={orgTz}
            kickoffAt={match.kickoffAt}
            matchId={match.id}
            match={match}
            territoryCities={state.org.territoryCities ?? []}
            requests={state.requests}
            currentUserId={currentPickUserId}
            hideHint
            onPick={pickOfficial}
            onPickOutsideAppointment={
              pickTarget && isCrewSlot(pickTarget.slot)
                ? pickOutsideAppointment
                : undefined
            }
            outsideAppointmentSlot={
              pickTarget && isCrewSlot(pickTarget.slot)
                ? pickTarget.slot
                : undefined
            }
          />
        </ModalBody>
        <ModalFooter>
          {currentPickUserId &&
            (pickTarget?.assignmentId ||
              pickTarget?.cmoUserId ||
              pickTarget?.cmoId) && (
            <Button type="button" variant="danger" onClick={clearPickSlot}>
              Clear
            </Button>
          )}
          {isAssigner &&
            pickTarget &&
            currentPickUserId &&
            !isOutsideAppointmentUserId(currentPickUserId) &&
            ((dataMode === 'live' && isFirebaseConfigured) ||
              dataMode === 'demo') && (
            <Button
              type="button"
              variant="secondary"
              isDisabled={
                pickTarget.assignmentId
                  ? resendEmailByKey[
                      resendEmailKey(
                        pickTarget.slot,
                        currentPickUserId,
                        pickTarget.assignmentId,
                      )
                    ] === 'sending'
                  : false
              }
              onClick={resendAssignmentEmail}
            >
              {pickTarget.assignmentId &&
              resendEmailByKey[
                resendEmailKey(
                  pickTarget.slot,
                  currentPickUserId,
                  pickTarget.assignmentId,
                )
              ] === 'sending'
                ? 'Sending…'
                : pickTarget.assignmentId &&
                    resendEmailByKey[
                      resendEmailKey(
                        pickTarget.slot,
                        currentPickUserId,
                        pickTarget.assignmentId,
                      )
                    ] === 'sent'
                  ? 'Email sent'
                  : 'Resend email'}
            </Button>
          )}
          {currentPickUserId &&
            pickTarget &&
            pickTarget.slot !== 'cmo' &&
            !isOutsideAppointmentUserId(currentPickUserId) && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                const slot = pickTarget.slot as CrewSlot;
                const assignment = crewPeople(match.crew[slot]).find(
                  (a) => a.id === pickTarget.assignmentId,
                );
                setPickTarget(null);
                if (currentPickUserId && officialQuickLook) {
                  officialQuickLook.openOfficial(currentPickUserId, {
                    matchBack: { to: `/matches/${match.id}`, label: 'Match' },
                  });
                } else if (assignment) {
                  openCrewContact(slot, assignment);
                }
              }}
            >
              View profile
            </Button>
          )}
          {currentPickUserId && pickTarget?.slot === 'cmo' && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                const cmo = (match.cmo ?? []).find(
                  (c) => c.userId === pickTarget.cmoUserId,
                );
                setPickTarget(null);
                if (currentPickUserId && officialQuickLook) {
                  officialQuickLook.openOfficial(currentPickUserId, {
                    matchBack: { to: `/matches/${match.id}`, label: 'Match' },
                  });
                } else if (cmo) {
                  openCmoContactRow(cmo);
                }
              }}
            >
              View profile
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            onClick={() => setPickTarget(null)}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showDenyProposal}
        onClose={closeDenyProposal}
        aria-labelledby="deny-proposal-title"
        aria-describedby="deny-proposal-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="deny-proposal-title" size="lg">
            Deny this change?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="deny-proposal-desc" className="rs-modal-lede">
            {denyProposalMode === 'assigner'
              ? 'Use this when you already updated the Sheet offline, or when the change should not proceed. A message is required for the proposing team.'
              : 'Tell the proposing team why you can’t accept these details. A message is required.'}
          </p>
          <form
            id="deny-proposal-form"
            onSubmit={(e) => {
              e.preventDefault();
              confirmDenyProposal();
            }}
          >
            <FormGroup
              label="Message"
              isRequired
              fieldId="deny-proposal-reason"
            >
              <TextArea
                id="deny-proposal-reason"
                value={denyProposalReason}
                onChange={(_e, v) => setDenyProposalReason(v)}
                rows={3}
                isRequired
                aria-required
                placeholder={
                  denyProposalMode === 'assigner'
                    ? 'e.g. Kickoff moved to 7:00 PM — please reconfirm.'
                    : undefined
                }
              />
            </FormGroup>
            {denyProposalMode === 'assigner' && (
              <FormGroup fieldId="deny-require-reconfirm">
                <Checkbox
                  id="deny-require-reconfirm"
                  label="Require officials to reconfirm"
                  isChecked={denyRequireReconfirm}
                  onChange={(_e, checked) => setDenyRequireReconfirm(checked)}
                />
                <FormHelperText>
                  Holds confirmed appointments and sends your message to the
                  assigned crew.
                </FormHelperText>
              </FormGroup>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="link" onClick={closeDenyProposal}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="deny-proposal-form"
            variant="danger"
            isDisabled={!denyProposalReason.trim()}
          >
            Deny change
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        aria-labelledby="propose-change-title"
        aria-describedby="propose-change-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="propose-change-title" size="lg">
            Propose a change
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="propose-change-desc" className="rs-modal-lede">
            Suggest a new kickoff and/or venue. The other team and scheduler
            must accept before it becomes official.
          </p>
          <FormGroup label="Kickoff" fieldId="propose-kickoff">
            <IconDateInput
              id="propose-kickoff"
              type="datetime-local"
              value={proposeKickoff}
              onChange={(_, v) => setProposeKickoff(v)}
              aria-label="Proposed kickoff date and time"
            />
          </FormGroup>
          <FormGroup label="Venue" fieldId="propose-venue-name">
            <TextInput
              id="propose-venue-name"
              value={proposeVenueName}
              onChange={(_, v) => setProposeVenueName(v)}
              aria-label="Proposed venue name"
              placeholder="Field or complex name"
            />
          </FormGroup>
          <FormGroup label="Address" fieldId="propose-venue-address">
            <TextInput
              id="propose-venue-address"
              value={proposeVenueAddress}
              onChange={(_, v) => setProposeVenueAddress(v)}
              aria-label="Proposed venue address"
              placeholder="City, ST"
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowProposeModal(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={submitProposeChange}
            isDisabled={
              !proposeKickoff &&
              !proposeVenueName.trim() &&
              !proposeVenueAddress.trim()
            }
          >
            Submit proposal
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showEmailMatch}
        onClose={() => setShowEmailMatch(false)}
        aria-labelledby="email-match-title"
        aria-describedby="email-match-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="email-match-title" size="lg">
            Email match contacts
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="email-match-desc" className="rs-modal-lede">
            Opens your default email app with recipients filled in (To). Choose
            who to include. This is not the MatchReadyTX assignment email — use{' '}
            <strong>Resend</strong> next to a crew name for that.
          </p>
          <div
            className="rs-detail-email-scope"
            role="radiogroup"
            aria-label="Recipients"
          >
            <Radio
              id="email-scope-teams"
              name="email-scope"
              label={`Teams only (${teamEmails.length})`}
              isChecked={emailScope === 'teams'}
              onChange={() => {
                setEmailScope('teams');
                setEmailError('');
              }}
            />
            <Radio
              id="email-scope-crew"
              name="email-scope"
              label={`Crew only (${crewEmails.length})`}
              isChecked={emailScope === 'crew'}
              onChange={() => {
                setEmailScope('crew');
                setEmailError('');
              }}
            />
            <Radio
              id="email-scope-both"
              name="email-scope"
              label={`Both (${uniqueEmails([...teamEmails, ...crewEmails]).length})`}
              isChecked={emailScope === 'both'}
              onChange={() => {
                setEmailScope('both');
                setEmailError('');
              }}
            />
          </div>
          {emailError && (
            <p className="rs-detail-note rs-detail-note--error" role="alert">
              {emailError}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setShowEmailMatch(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmEmailMatch}>
            Open email
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showMatchStatusActions}
        onClose={() => setShowMatchStatusActions(false)}
        aria-labelledby="match-status-actions-title"
        aria-describedby="match-status-actions-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="match-status-actions-title" size="lg">
            Change match status
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="match-status-actions-desc" className="rs-modal-lede">
            Choose how this match should be recorded. You’ll review the change
            before it is applied.
          </p>
          <div className="rs-match-status-actions">
            <Button
              variant="secondary"
              isBlock
              onClick={() => {
                setShowMatchStatusActions(false);
                onAssignerMenuAction(
                  match.playedForfeit
                    ? 'clear_played_forfeit'
                    : 'played_forfeit',
                );
              }}
            >
              {match.playedForfeit
                ? 'Clear played forfeit'
                : 'Played forfeit'}
            </Button>
            <Button
              variant="secondary"
              isBlock
              onClick={() => {
                setShowMatchStatusActions(false);
                onAssignerMenuAction('postpone');
              }}
            >
              Postpone match
            </Button>
            <Button
              variant="secondary"
              isBlock
              onClick={() => {
                setShowMatchStatusActions(false);
                onAssignerMenuAction(
                  match.forfeitTeamId ? 'clear_forfeit' : 'forfeit',
                );
              }}
            >
              {match.forfeitTeamId ? 'Clear forfeit' : 'Forfeit'}
            </Button>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="link"
            onClick={() => setShowMatchStatusActions(false)}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={assignerConfirm != null}
        onClose={() => setAssignerConfirm(null)}
        aria-labelledby="assigner-action-title"
        aria-describedby="assigner-action-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="assigner-action-title" size="lg">
            {assignerConfirm === 'alert_coverage'
              ? coverageAlertSent
                ? 'Resend coverage alert?'
                : 'Alert officials?'
              : assignerConfirm === 'remove_compliance_hold'
                ? 'Remove compliance hold?'
              : assignerConfirm === 'cancel'
                ? 'Cancel this match?'
                : assignerConfirm === 'postpone'
                  ? 'Postpone this match?'
                  : assignerConfirm === 'played_forfeit'
                    ? 'Mark as played forfeit?'
                    : assignerConfirm === 'clear_played_forfeit'
                      ? 'Clear played forfeit?'
                      : assignerConfirm === 'clear_forfeit'
                        ? 'Clear forfeit?'
                        : 'Reactivate this match?'}
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="assigner-action-desc" className="rs-modal-lede">
            {assignerConfirm === 'alert_coverage'
              ? 'Send a coverage alert to officials who may be available for open roles on this match.'
              : assignerConfirm === 'remove_compliance_hold'
                ? 'Teams and officials will be able to confirm and take action on this match again.'
              : assignerConfirm === 'cancel'
                ? 'The match will be marked cancelled. You can reactivate it later from the match menu if this was a mistake.'
                : assignerConfirm === 'postpone'
                  ? 'The match will be marked postponed. Team confirmations are cleared and assigned officials are held until teams reconfirm.'
                  : assignerConfirm === 'played_forfeit'
                    ? 'The match was played, but the result will not count in league standings (like a scrimmage). Officials should still enter the score and file match reports.'
                    : assignerConfirm === 'clear_played_forfeit'
                      ? 'The match will count in league standings again when a score is recorded.'
                      : assignerConfirm === 'clear_forfeit'
                        ? 'The forfeit label will be removed. Scores already entered will stay unless you change them.'
                        : match.status === 'postponed'
                        ? 'The match returns to the schedule as needs reconfirmation. Teams and officials must confirm again.'
                        : 'The match returns to the schedule at the appropriate workflow step based on current confirmations and crew.'}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setAssignerConfirm(null)}>
            Keep as is
          </Button>
          <Button
            variant={
              assignerConfirm === 'cancel' ? 'danger' : 'primary'
            }
            onClick={confirmAssignerAction}
          >
            {assignerConfirm === 'alert_coverage'
              ? coverageAlertSent
                ? 'Resend alert'
                : 'Send alert'
              : assignerConfirm === 'remove_compliance_hold'
                ? 'Remove hold'
              : assignerConfirm === 'cancel'
                ? 'Cancel match'
                : assignerConfirm === 'postpone'
                  ? 'Postpone match'
                  : assignerConfirm === 'played_forfeit'
                    ? 'Mark played forfeit'
                  : assignerConfirm === 'clear_played_forfeit'
                    ? 'Clear played forfeit'
                    : assignerConfirm === 'clear_forfeit'
                      ? 'Clear forfeit'
                      : 'Reactivate match'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.medium}
        isOpen={showComplianceHoldModal}
        onClose={() => setShowComplianceHoldModal(false)}
        aria-labelledby="compliance-hold-modal-title"
        aria-describedby="compliance-hold-modal-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="compliance-hold-modal-title" size="lg">
            Lock match until teams are compliant?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="compliance-hold-modal-desc" className="rs-modal-lede">
            Crew assignments stay in place. Teams and officials cannot confirm
            or change this match until you remove the hold.
          </p>
          <FormGroup label="Message to crew and team admins" fieldId="compliance-hold-message">
            <TextArea
              id="compliance-hold-message"
              value={complianceHoldDraft}
              onChange={(_, v) => setComplianceHoldDraft(v)}
              rows={18}
              resizeOrientation="vertical"
              aria-label="Compliance hold message"
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setShowComplianceHoldModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmComplianceHold}
            isDisabled={!complianceHoldDraft.trim()}
          >
            Lock match
          </Button>
        </ModalFooter>
      </Modal>

      <MatchForfeitModal
        match={match}
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        onSave={saveMatchForfeit}
      />

      {requestToast && (
        <div className="rs-update-toast" role="status">
          <Alert
            variant="success"
            isInline
            isPlain
            title="Match successfully requested"
          />
        </div>
      )}
      {detailsSaved && (
        <div className="rs-update-toast" role="status">
          <Alert
            variant="success"
            isInline
            isPlain
            title="Event details updated"
          />
        </div>
      )}
    </div>
  );
}
