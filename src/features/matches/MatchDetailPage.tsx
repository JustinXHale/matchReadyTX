import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Button,
  Title,
  TextArea,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
} from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import { ROLE_HOME, useApp } from '@/app/AppContext';
import { statusLabel } from '@/domain/matchTransitions';
import {
  crewChipClass,
  crewStatusChipsForMatch,
  shouldShowCrewStatusChips,
} from '@/domain/crewChips';
import {
  formatDistanceMi,
  matchEconomicsForUser,
  matchFeeBreakdown,
} from '@/domain/economics';
import {
  CREW_SLOT_LABELS,
  CREW_SLOTS,
  REQUESTABLE_SLOT_LABELS,
  REQUESTABLE_SLOT_SHORT,
  assignmentForUser,
  crewBlocks,
  crewPeople,
  crewSlotStatusLabel,
  genderLabel,
  hasRefereeLensRole,
  isCrewSlot,
  isCrewVisibleToTeams,
  rolesNeededForMatch,
  teamFacingCmoFill,
  teamFacingCrewRoleFill,
  teamFacingCrewShapeLabel,
  type CrewAssignment,
  type CrewSlot,
  type HistoryEntry,
  type Match,
  type RequestableSlot,
  type Team,
  type UserProfile,
} from '@/domain/types';
import { namedOfficialsNeedingAvailability } from '@/domain/crew';
import { availableCrewRolesToAdd, roleHasAssignee } from '@/domain/crewSize';
import { UserAvatar } from '@/ui/UserAvatar';
import { IconDateInput } from '@/ui/IconDateInput';
import {
  canOfficialRequestMatch,
  isPendingRequestActive,
  openRequestSlots,
  pendingRequestForUser,
} from '@/domain/requests';
import { openGroupMailto, uniqueEmails } from '@/services/mailto';
import { mapsDirectionsUrl } from '@/services/maps';
import { persistCrewAssignmentAndEmail, persistCrewUnassignmentAndEmail, resendCrewAssignmentEmail } from '@/services/liveAssignment';
import { defaultOrgId, createGameRequestInFirestore, saveMatchCrewAssignment } from '@/services/orgData';
import { isFirebaseConfigured } from '@/services/firebase';
import { backState, readBackNav } from '@/nav/backNav';
import {
  availabilitySortRank,
  availabilityStatusLabel,
  kickoffAvailabilityStatus,
} from '@/domain/availability';
import {
  matchDetailHeaderReportLinks,
  matchDetailReportActions,
} from '@/features/referee/reports/reportLinks';

type CrewPickTarget = {
  slot: RequestableSlot;
  /** Fee-crew block id (empty or filled). */
  assignmentId?: string;
  /** CMO block id (empty or filled). */
  cmoId?: string;
  /** Filled CMO userId (contact / clear). */
  cmoUserId?: string;
};

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

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
      ...admins.map((a) => a.email),
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
    emails: uniqueEmails(user?.email ? [user.email] : []),
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
    emails: uniqueEmails(user?.email ? [user.email] : []),
    phones: uniqueEmails(user?.phone ? [user.phone] : []),
  };
}

export function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    state,
    store,
    isAssignerView,
    isOfficialView,
    roleView,
    dataMode,
  } = useApp();
  const match = state.matches.find((m) => m.id === id);
  const back = readBackNav(location.state);
  const goBack = () => {
    if (back) {
      navigate(
        back.to,
        back.state !== undefined ? { state: back.state } : undefined,
      );
      return;
    }
    navigate(ROLE_HOME[roleView]);
  };
  const backLabel = back ? `Back to ${back.label}` : 'Back';
  const [reason, setReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [declineMode, setDeclineMode] = useState<'assignment' | 't72'>(
    'assignment',
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
  const [pickTarget, setPickTarget] = useState<CrewPickTarget | null>(null);
  const [pickSearch, setPickSearch] = useState('');
  const [pickLevelFilter, setPickLevelFilter] = useState<number | null>(null);
  const [resendEmailState, setResendEmailState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle');
  const [removeBlockTarget, setRemoveBlockTarget] = useState<{
    role: RequestableSlot;
    blockId: string;
  } | null>(null);
  const [coverageAlertSent, setCoverageAlertSent] = useState(false);
  const [requestSlot, setRequestSlot] = useState<RequestableSlot | ''>('');
  const [requestNote, setRequestNote] = useState('');
  const requestSectionRef = useRef<HTMLElement | null>(null);

  const officials = useMemo(
    () =>
      state.users
        .filter((u) => hasRefereeLensRole(u.roles))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [state.users],
  );

  const assignmentHistory = useMemo(() => {
    if (!match) return [] as { slot: CrewSlot; entry: HistoryEntry }[];
    const rows: { slot: CrewSlot; entry: HistoryEntry }[] = [];
    for (const slot of CREW_SLOTS) {
      for (const assignment of match.crew[slot] ?? []) {
        for (const entry of assignment.history) {
          rows.push({ slot, entry });
        }
      }
    }
    return rows.sort(
      (a, b) =>
        new Date(b.entry.at).getTime() - new Date(a.entry.at).getTime(),
    );
  }, [match]);

  const teamEmails = useMemo(() => {
    if (!match) return [];
    return uniqueEmails([
      ...resolveTeamContact(
        match.homeTeamId,
        match.homeTeamName,
        state.teams,
        state.users,
      ).emails,
      ...resolveTeamContact(
        match.awayTeamId,
        match.awayTeamName,
        state.teams,
        state.users,
      ).emails,
    ]);
  }, [match, state.teams, state.users]);

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
    setRequestSlot('');
    setRequestNote('');
    setProposeKickoff(match?.kickoffAt ? toDatetimeLocalValue(match.kickoffAt) : '');
    setProposeVenueName(match?.venueName ?? '');
    setProposeVenueAddress(match?.venueAddress ?? '');
    setShowProposeModal(false);
  }, [match?.id, match?.kickoffAt, match?.venueName, match?.venueAddress]);

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

  if (!currentUser || !match) {
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={goBack}
        >
          ← {backLabel}
        </button>
        <p>Match not found.</p>
      </div>
    );
  }

  const isAssigner = isAssignerView;
  const isHomeAdmin =
    currentUser.roles.includes('teamAdmin') &&
    currentUser.teamIds.includes(match.homeTeamId);
  const isAwayAdmin =
    currentUser.roles.includes('teamAdmin') &&
    currentUser.teamIds.includes(match.awayTeamId);
  const myHit = assignmentForUser(match, currentUser.uid);
  const mySlot =
    myHit && myHit.slot !== 'cmo' ? (myHit.slot as CrewSlot) : undefined;
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
    return latest?.status === 'rejected_by_other_team' ? latest : undefined;
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
    match.status !== 'cancelled' &&
    match.status !== 'postponed' &&
    match.status !== 'draft' &&
    match.status !== 'change_proposed';
  const needsAvail =
    mySlot != null &&
    namedOfficialsNeedingAvailability(match).includes(mySlot);
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

  const needsOfficialConfirm =
    isOfficialView &&
    Boolean(mySlot) &&
    (myAssignment?.status === 'official' ||
      myAssignment?.status === 'held' ||
      myAssignment?.status === 'pending_internal' ||
      needsAvail ||
      (match.status === 'needs_reconfirmation' &&
        myAssignment?.status !== 'confirmed'));

  const needsTeamConfirm =
    (isHomeAdmin || isAwayAdmin) &&
    match.status !== 'cancelled' &&
    match.status !== 'postponed' &&
    match.status !== 'draft' &&
    match.status !== 'change_proposed' &&
    ((isHomeAdmin && !match.homeConfirmedAt) ||
      (isAwayAdmin && !match.awayConfirmedAt));

  const myTeamConfirmed =
    (isHomeAdmin && Boolean(match.homeConfirmedAt)) ||
    (isAwayAdmin && Boolean(match.awayConfirmedAt));
  const otherTeamName = isHomeAdmin
    ? match.awayTeamName
    : isAwayAdmin
      ? match.homeTeamName
      : null;
  const waitingOnOtherTeam =
    Boolean(myTeamConfirmed) &&
    ((isHomeAdmin && !match.awayConfirmedAt) ||
      (isAwayAdmin && !match.homeConfirmedAt));

  const needsT72Team =
    match.status === 't72_team_pending' && (isHomeAdmin || isAwayAdmin);
  const needsT72Official =
    isOfficialView &&
    match.status === 't72_officials_pending' &&
    Boolean(mySlot);

  const feeParts =
    isAssigner ? matchFeeBreakdown(match, state.org) : [];
  const showFees = feeParts.length > 0;
  const matchRoles = rolesNeededForMatch(match);
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

  const openTeamContact = (side: 'home' | 'away') => {
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const teamName = side === 'home' ? match.homeTeamName : match.awayTeamName;
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

  const openCrewPick = (target: CrewPickTarget) => {
    setPickSearch('');
    setPickLevelFilter(null);
    setResendEmailState('idle');
    setPickTarget(target);
  };

  const onCrewRowActivate = (target: CrewPickTarget) => {
    if (isAssigner) {
      openCrewPick(target);
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
      if (dataMode === 'live' && isFirebaseConfigured) {
        const next = store.getState().matches.find((m) => m.id === match.id);
        if (next) {
          void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
            console.error('Failed to save CMO assignment', err),
          );
        }
      }
    } else {
      store.assignCrew(match.id, slot, userId, false, pickTarget.assignmentId);
      if (dataMode === 'live' && isFirebaseConfigured) {
        const next = store.getState().matches.find((m) => m.id === match.id);
        if (next) {
          void persistCrewAssignmentAndEmail({
            match: next,
            slot,
            userId,
          }).catch((err) => {
            console.error('Failed to save/email assignment', err);
            window.alert(
              err instanceof Error
                ? `Assigned locally, but email/save failed: ${err.message}`
                : 'Assigned locally, but email/save failed. Check the console.',
            );
          });
        }
      }
    }
    setPickTarget(null);
  };

  const resendAssignmentEmail = () => {
    if (!pickTarget || !currentPickUserId) return;
    void resendToOfficial(pickTarget.slot, currentPickUserId);
  };

  const resendToOfficial = (slot: RequestableSlot, userId: string) => {
    if (dataMode !== 'live' || !isFirebaseConfigured) {
      window.alert('Resend email is only available in Live mode.');
      return;
    }
    setResendEmailState('sending');
    void resendCrewAssignmentEmail({
      match,
      slot,
      userId,
    })
      .then(() => setResendEmailState('sent'))
      .catch((err) => {
        console.error('Failed to resend assignment email', err);
        setResendEmailState('error');
        window.alert(
          err instanceof Error
            ? `Could not resend email: ${err.message}`
            : 'Could not resend email. Check the console.',
        );
      });
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

    if (slot === 'cmo') store.clearCmo(match.id, cmoUserId, cmoId);
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
    setPickTarget(null);
  };

  const addableRoles = availableCrewRolesToAdd(match);
  const refereeLevels = (() => {
    const levels = new Set<number>();
    for (const o of officials) {
      if (o.refereeLevel != null) levels.add(o.refereeLevel);
    }
    return [...levels].sort((a, b) => a - b);
  })();
  const pickQuery = pickSearch.trim().toLowerCase();
  const pickFeeSlot: CrewSlot =
    pickTarget && pickTarget.slot !== 'cmo' ? pickTarget.slot : 'mo';
  const orgTz = state.org.timezone || 'America/Chicago';
  const filteredOfficials = officials
    .filter((o) => {
      if (pickLevelFilter != null && o.refereeLevel !== pickLevelFilter) {
        return false;
      }
      if (!pickQuery) return true;
      return `${o.displayName} ${o.refereeLevel ?? ''}`
        .toLowerCase()
        .includes(pickQuery);
    })
    .map((o) => {
      const availStatus = kickoffAvailabilityStatus(
        state.availability,
        o.uid,
        match.kickoffAt,
        orgTz,
      );
      return {
        official: o,
        availStatus,
        roundTripMiles: matchEconomicsForUser(
          match,
          state.org,
          o,
          pickFeeSlot,
        ).roundTripMiles,
      };
    })
    .sort((a, b) => {
      const availCmp =
        availabilitySortRank(a.availStatus) -
        availabilitySortRank(b.availStatus);
      if (availCmp !== 0) return availCmp;
      if (a.roundTripMiles != null && b.roundTripMiles != null) {
        return a.roundTripMiles - b.roundTripMiles;
      }
      if (a.roundTripMiles != null) return -1;
      if (b.roundTripMiles != null) return 1;
      return a.official.displayName.localeCompare(b.official.displayName);
    });

  const requestRemoveBlock = (
    role: RequestableSlot,
    blockId: string,
    hasPerson: boolean,
  ) => {
    if (hasPerson) {
      setRemoveBlockTarget({ role, blockId });
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

  const confirmRemoveBlock = () => {
    if (!removeBlockTarget) return;
    const { role, blockId } = removeBlockTarget;
    const removedUserId =
      role === 'cmo'
        ? (match.cmo ?? []).find((c) => c.id === blockId)?.userId
        : crewPeople(match.crew[role]).find((a) => a.id === blockId)?.userId;

    store.removeCrewRole(match.id, role, blockId);
    setRemoveBlockTarget(null);
    if (dataMode === 'live' && isFirebaseConfigured) {
      const next = store.getState().matches.find((m) => m.id === match.id);
      if (next && removedUserId) {
        void persistCrewUnassignmentAndEmail({
          match: next,
          slot: role,
          userId: removedUserId,
        }).catch((err) => {
          console.error('Failed to save/email unassignment', err);
          window.alert(
            err instanceof Error
              ? `Removed locally, but email/save failed: ${err.message}`
              : 'Removed locally, but email/save failed. Check the console.',
          );
        });
      } else if (next) {
        void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
          console.error('Failed to save removed crew block', err),
        );
      }
    }
  };

  const setSlotFee = (slot: RequestableSlot, raw: string) => {
    if (!isCrewSlot(slot) && slot !== 'cmo') return;
    const trimmed = raw.trim();
    const nextOverride = { ...(match.feeOverride ?? {}) };
    if (trimmed === '') {
      delete nextOverride[slot === 'cmo' ? 'cmo' : slot];
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) return;
      if (slot === 'cmo') nextOverride.cmo = n;
      else nextOverride[slot] = n;
    }
    store.setMatchFlags(match.id, {
      feeOverride: Object.keys(nextOverride).length ? nextOverride : undefined,
    });
  };

  const canToggleTeamDetails = (side: 'home' | 'away') => {
    if (match.status === 'change_proposed') return false;
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

  const emailSubject = `${match.homeTeamName} vs ${match.awayTeamName} — ${formatWhen(match.kickoffAt)}`;

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

  const openDecline = (mode: 'assignment' | 't72') => {
    setDeclineMode(mode);
    setReason('');
    setShowDecline(true);
  };

  const confirmDecline = () => {
    if (!mySlot || !reason.trim()) return;
    if (declineMode === 't72') {
      store.answerT72Official(match.id, mySlot, 'no', reason);
    } else {
      store.officialUnavailable(
        match.id,
        mySlot,
        reason,
        match.status === 'needs_reconfirmation'
          ? 'unavailable_on_change'
          : 'declined',
        myAssignment?.id,
      );
    }
    setShowDecline(false);
    setReason('');
    navigate(-1);
  };

  const acceptAppointment = () => {
    if (!mySlot) return;
    store.confirmCrewSlot(match.id, mySlot, myAssignment?.id);
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

  const openDenyProposal = () => {
    if (!pendingProposal) return;
    setDenyProposalId(pendingProposal.id);
    setDenyProposalReason('');
    setShowDenyProposal(true);
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
    store.denyProposalOtherTeam(proposalId, currentUser.uid, reason);
    setShowDenyProposal(false);
    setDenyProposalReason('');
    setDenyProposalId(null);
  };

  const stickyPrimary = (() => {
    if (needsOfficialConfirm && mySlot) {
      return null; // Accept / Decline split bar below
    }
    if (needsTeamConfirm) {
      return {
        label: 'Confirm details',
        onClick: () =>
          store.confirmMatchTeam(match.id, isHomeAdmin ? 'home' : 'away'),
      };
    }
    if (needsT72Team) {
      return {
        label: 'Yes — still on',
        onClick: () =>
          store.answerT72Team(match.id, isHomeAdmin ? 'home' : 'away', 'yes'),
      };
    }
    if (needsT72Official && mySlot) {
      return {
        label: 'Yes — still attending',
        onClick: () => store.answerT72Official(match.id, mySlot, 'yes'),
      };
    }
    return null;
  })();

  const showAcceptDecline = Boolean(needsOfficialConfirm && mySlot);
  const canSubmitRequest =
    canRequest &&
    Boolean(requestSlot) &&
    requestSlots.includes(requestSlot as RequestableSlot);

  const reportActions = matchDetailReportActions(
    match,
    currentUser.uid,
    state.matchReports,
    state.cardReports,
  );
  const headerReportLinks = matchDetailHeaderReportLinks(
    match,
    currentUser.uid,
    state.matchReports,
    state.cardReports,
  );
  const showReportSticky =
    Boolean(reportActions.primary) &&
    !showAcceptDecline &&
    !canRequest &&
    !stickyPrimary;

  const submitRequest = async () => {
    if (!requestSlot || !canSubmitRequest || !currentUser || !match) return;
    const reqId = store.requestGame(
      match.id,
      currentUser.uid,
      requestSlot,
      requestNote.trim() || undefined,
    );
    if (!reqId) return;

    if (dataMode === 'live' && isFirebaseConfigured) {
      const created = store.getState().requests.find((r) => r.id === reqId);
      if (created) {
        try {
          await createGameRequestInFirestore(defaultOrgId(), match.id, created);
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

    setRequestSlot('');
    setRequestNote('');
  };

  return (
    <div className="rs-detail">
      <button
        type="button"
        className="rs-detail__back"
        onClick={goBack}
      >
        ← {backLabel}
      </button>

      <div className="rs-detail__title-row">
        <Title headingLevel="h2" className="rs-detail__title">
          <span className="rs-detail__home">{match.homeTeamName}</span>
          <span className="rs-detail__vs">vs</span>
          <span className="rs-detail__away">{match.awayTeamName}</span>
        </Title>
        <div className="rs-detail__title-actions">
          {headerReportLinks.map((link) => (
            <Button
              key={link.to + link.label}
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(link.to, {
                  state: backState({
                    to: `/matches/${match.id}`,
                    label: 'Match',
                  }),
                })
              }
            >
              {link.label}
            </Button>
          ))}
          {isAssigner && (
            <>
              {canAlertCoverage && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    store.sendCoverageAlert(match.id);
                    setCoverageAlertSent(true);
                  }}
                >
                  {coverageAlertSent ? 'Resend alert' : 'Alert refs'}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                isDanger
                onClick={() => store.cancelOrPostpone(match.id, 'cancel')}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => store.cancelOrPostpone(match.id, 'postpone')}
              >
                Postpone
              </Button>
            </>
          )}
        </div>
      </div>

      {isAssigner ? (
        <div className="rs-detail__top-chips" aria-label="Match division">
          <div
            className="rs-slot-picker"
            role="radiogroup"
            aria-label="Match gender"
          >
            {(['men', 'women'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={match.gender === g}
                className={`rs-filter-chip${
                  match.gender === g ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() =>
                  store.setMatchFlags(match.id, { gender: g })
                }
              >
                {genderLabel(g)}
              </button>
            ))}
          </div>
          <div
            className="rs-slot-picker"
            role="radiogroup"
            aria-label="Match level"
          >
            {state.org.matchLevels.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={match.level === l}
                className={`rs-filter-chip${
                  match.level === l ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() => store.setMatchFlags(match.id, { level: l })}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rs-label-row rs-detail__game-chips"
          aria-label="Game type"
        >
          <span className="rs-pill rs-pill--ink">
            {genderLabel(match.gender)}
          </span>
          <span className="rs-pill rs-pill--ink">{match.level}</span>
        </div>
      )}

      <div className="rs-label-row">
        {match.status !== 'crew_pending' && (
          <span className="rs-pill">
            {statusLabel(
              pendingProposal
                ? 'change_proposed'
                : match.status === 'change_proposed'
                  ? 'pending_team_review'
                  : match.status,
            )}
          </span>
        )}
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
      </div>

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
            Scheduler acknowledge is for awareness only.
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
                      {formatWhen(
                        pendingProposal.previousKickoffAt ?? match.kickoffAt,
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
                        ? formatWhen(pendingProposal.kickoffAt)
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
                <Button variant="link" isDanger onClick={openDenyProposal}>
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
          {isAssigner && !pendingProposal.assignerAckAt && (
            <div className="rs-detail-inline-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  store.acknowledgeProposal(
                    pendingProposal.id,
                    currentUser.uid,
                  )
                }
              >
                Acknowledge (seen)
              </Button>
            </div>
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
                Change denied
              </h3>
              <span className="rs-pill rs-pill--urgent">Denied</span>
            </div>
            <p className="rs-detail-note">
              A proposal from{' '}
              <strong>
                {proposalTeamName(deniedProposal.proposedByTeamId)}
              </strong>{' '}
              was denied. Schedule facts were not changed.
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
              appointments. Acknowledge when you’ve seen it — this is not a
              blocker.
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

      <section className="rs-detail-card" aria-labelledby="event-info-heading">
        <h3 id="event-info-heading" className="rs-detail-section__label">
          Event information
        </h3>
        <div className="rs-detail-meta">
          <div className="rs-detail-meta__row">
            <span className="rs-detail-meta__label">When</span>
            <div className="rs-detail-meta__value">
              <span>{formatWhen(match.kickoffAt)}</span>
              {canProposeChange && (
                <button
                  type="button"
                  className="rs-detail-meta__edit"
                  onClick={openProposeModal}
                  aria-label="Propose a time change"
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden />
                </button>
              )}
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
              {canProposeChange && (
                <button
                  type="button"
                  className="rs-detail-meta__edit"
                  onClick={openProposeModal}
                  aria-label="Propose a venue change"
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden />
                </button>
              )}
            </div>
          </div>
          {isAssigner && (
            <>
              {showFees && (
                <div className="rs-detail-meta__row rs-detail-meta__row--fees">
                  <span className="rs-detail-meta__label">Match fee</span>
                  <div className="rs-detail-fee-edit">
                  {matchRoles
                    .filter((r) => r === 'cmo' || isCrewSlot(r))
                    .map((slot) => {
                      const key = slot === 'cmo' ? 'cmo' : slot;
                      const def =
                        slot === 'cmo'
                          ? (state.org.defaultFees.cmo ?? 0)
                          : state.org.defaultFees[slot];
                      const override = match.feeOverride?.[key];
                      return (
                        <label key={slot} className="rs-detail-fee-edit__field">
                          <span>{REQUESTABLE_SLOT_SHORT[slot]}</span>
                          <TextInput
                            type="number"
                            min={0}
                            step={1}
                            value={
                              override != null ? String(override) : String(def)
                            }
                            aria-label={`${REQUESTABLE_SLOT_LABELS[slot]} fee`}
                            onChange={(_, v) => setSlotFee(slot, v)}
                          />
                        </label>
                      );
                    })}
                </div>
              </div>
              )}
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Flight</span>
                <div
                  className="rs-slot-picker"
                  role="radiogroup"
                  aria-label="Flight provided"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={match.flightProvided}
                    className={`rs-filter-chip${
                      match.flightProvided ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() =>
                      store.setMatchFlags(match.id, { flightProvided: true })
                    }
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!match.flightProvided}
                    className={`rs-filter-chip${
                      !match.flightProvided ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() =>
                      store.setMatchFlags(match.id, { flightProvided: false })
                    }
                  >
                    Disabled
                  </button>
                </div>
              </div>
              <div className="rs-detail-meta__row">
                <span className="rs-detail-meta__label">Housing</span>
                <div
                  className="rs-slot-picker"
                  role="radiogroup"
                  aria-label="Housing provided"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={match.housingProvided}
                    className={`rs-filter-chip${
                      match.housingProvided ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() =>
                      store.setMatchFlags(match.id, { housingProvided: true })
                    }
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!match.housingProvided}
                    className={`rs-filter-chip${
                      !match.housingProvided ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() =>
                      store.setMatchFlags(match.id, { housingProvided: false })
                    }
                  >
                    Disabled
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rs-detail-additional">
          <h4 className="rs-detail-section__sublabel">Additional info</h4>
          {isAssigner || isHomeAdmin ? (
            <TextArea
              id="match-notes"
              value={match.notes ?? ''}
              onChange={(_, v) =>
                store.setMatchFlags(match.id, { notes: v || undefined })
              }
              rows={3}
              placeholder="Parking, arrival notes, organizer details…"
              aria-label="Additional info"
            />
          ) : match.notes?.trim() ? (
            <p className="rs-detail-additional__body">{match.notes.trim()}</p>
          ) : (
            <p className="rs-detail-additional__empty">None</p>
          )}
        </div>
      </section>

      <section className="rs-detail-card" aria-labelledby="teams-heading">
        <div className="rs-detail-card__head">
          <h3 id="teams-heading" className="rs-detail-section__label">
            Teams
          </h3>
          <Button
            variant="link"
            isInline
            className="rs-detail-card__action"
            onClick={() => openEmailModal('teams')}
          >
            Email
          </Button>
        </div>
        {(isAssigner ||
          Boolean(mySlot === 'mo' && myAssignment?.userId) ||
          isHomeAdmin ||
          isAwayAdmin) &&
          match.status !== 'change_proposed' && (
          <p className="rs-detail-note">
            {isHomeAdmin || isAwayAdmin
              ? 'Tap your team’s status to confirm kickoff details, or use Confirm details below.'
              : 'Tap a status chip to mark details confirmed (e.g. after an email) or clear it.'}
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
                aria-label={`Contact ${match.homeTeamName}`}
              >
                <span className="rs-detail-people__slot">Home</span>
                <span className="rs-detail-people__name">
                  {match.homeTeamName}
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
                    className={`rs-pill rs-detail-people__confirm${
                      chip.tone === 'ok' ? ' rs-pill--ok' : ' rs-pill--urgent'
                    }`}
                    onClick={() => toggleTeamDetails('home')}
                    aria-pressed={Boolean(match.homeConfirmedAt)}
                    aria-label={`Home — ${chip.label}. Tap to toggle.`}
                  >
                    {chip.label}
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
                aria-label={`Contact ${match.awayTeamName}`}
              >
                <span className="rs-detail-people__slot">Away</span>
                <span className="rs-detail-people__name">
                  {match.awayTeamName}
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
                    className={`rs-pill rs-detail-people__confirm${
                      chip.tone === 'ok' ? ' rs-pill--ok' : ' rs-pill--urgent'
                    }`}
                    onClick={() => toggleTeamDetails('away')}
                    aria-pressed={Boolean(match.awayConfirmedAt)}
                    aria-label={`Away — ${chip.label}. Tap to toggle.`}
                  >
                    {chip.label}
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
          Tentatively assigned as {CREW_SLOT_LABELS[mySlot]} — confirmation opens
          after both teams confirm match facts.
        </p>
      )}

      <section className="rs-detail-card" aria-labelledby="crew-heading">
        <div className="rs-detail-card__head">
          <h3 id="crew-heading" className="rs-detail-section__label">
            Crew
          </h3>
          {crewVisible && (
            <Button
              variant="link"
              isInline
              className="rs-detail-card__action"
              onClick={() => openEmailModal('crew')}
            >
              Email
            </Button>
          )}
        </div>
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
                  assignmentId?: string;
                  cmoId?: string;
                  cmoUserId?: string;
                }[] = isCmo
                  ? (match.cmo ?? []).map((c, i) => ({
                      key: c.id ?? `cmo-${c.userId ?? i}`,
                      blockId: c.id ?? `cmo-${i}`,
                      userId: c.userId,
                      userName: c.userName,
                      status: c.userId ? 'Assigned' : 'Open',
                      cmoId: c.id,
                      cmoUserId: c.userId,
                    }))
                  : crewBlocks(match.crew[slot]).map((a) => ({
                      key: a.id,
                      blockId: a.id,
                      userId: a.userId,
                      userName: a.userName,
                      status: a.userId
                        ? crewSlotStatusLabel(a.status)
                        : 'Open',
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
                        cmoId: b.cmoId,
                        cmoUserId: b.cmoUserId,
                      }
                    : { slot, assignmentId: b.assignmentId };
                  const rowLabel = isAssigner
                    ? filled
                      ? `Assign ${b.userName ?? 'official'} (${REQUESTABLE_SLOT_LABELS[slot]})`
                      : `Assign ${REQUESTABLE_SLOT_LABELS[slot]}`
                    : filled
                      ? `Contact ${b.userName ?? 'official'} (${REQUESTABLE_SLOT_LABELS[slot]})`
                      : `${REQUESTABLE_SLOT_LABELS[slot]} open`;

                  const canRemove =
                    isAssigner &&
                    Boolean(b.blockId) &&
                    !(
                      slot === 'mo' &&
                      crewBlocks(match.crew.mo).length <= 1 &&
                      !filled
                    );

                  return (
                    <li key={b.key} className="rs-detail-people__item">
                      {isAssigner || filled ? (
                        <button
                          type="button"
                          className="rs-detail-people__row"
                          onClick={() =>
                            isAssigner
                              ? openCrewPick(pickTarget)
                              : onCrewRowActivate(pickTarget)
                          }
                          aria-label={rowLabel}
                        >
                          <span className="rs-detail-people__slot">
                            {REQUESTABLE_SLOT_SHORT[slot]}
                          </span>
                          <span
                            className={`rs-detail-people__name${
                              filled ? '' : ' rs-detail-people__name--muted'
                            }`}
                          >
                            {filled ? (b.userName ?? 'Official') : 'Open'}
                          </span>
                          <span className="rs-detail-people__status">
                            {b.status}
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
                      {isAssigner && filled && b.userId && (
                        <button
                          type="button"
                          className="rs-detail-people__resend"
                          aria-label={`Resend assignment email to ${b.userName ?? 'official'}`}
                          title="Resend MatchReadyTX assignment email"
                          disabled={resendEmailState === 'sending'}
                          onClick={() => {
                            setResendEmailState('idle');
                            resendToOfficial(slot, b.userId!);
                          }}
                        >
                          Resend
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          className="rs-detail-people__remove"
                          aria-label={`Remove ${REQUESTABLE_SLOT_LABELS[slot]} block`}
                          onClick={() =>
                            requestRemoveBlock(slot, b.blockId, filled)
                          }
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                });
              })}
            </ul>
            {isAssigner && dataMode === 'live' && isFirebaseConfigured && (
              <p className="rs-detail-note">
                Tap a name to reassign, or <strong>Resend</strong> to email that
                official the MatchReadyTX assignment again. The Crew{' '}
                <strong>Email</strong> button opens your mail app (mailto), not
                Resend.
              </p>
            )}
            {isAssigner && (
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
        <section className="rs-detail-card" aria-labelledby="history-heading">
          <h3 id="history-heading" className="rs-detail-section__label">
            Assignment history
          </h3>
          {assignmentHistory.length === 0 ? (
            <p className="rs-match-card__meta">
              No assignment history on this match yet.
            </p>
          ) : (
            <ul className="rs-history-list">
              {assignmentHistory.map(({ slot, entry }) => (
                <li key={entry.id}>
                  <strong>
                    {CREW_SLOT_LABELS[slot]} · {entry.action.replace(/_/g, ' ')}
                  </strong>
                  <div className="rs-match-card__meta">
                    {entry.userName} · {new Date(entry.at).toLocaleString()}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canRequest && (
        <section
          className="rs-detail-card"
          aria-labelledby="raise-hand-heading"
          ref={requestSectionRef}
        >
          <h3 id="raise-hand-heading" className="rs-detail-section__label">
            Raise hand
          </h3>
          <FormGroup label="Select one role" isRequired fieldId="request-role">
            <div
              className="rs-slot-picker"
              role="radiogroup"
              aria-label="Select one role"
            >
              {requestSlots.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={requestSlot === s}
                  className={`rs-filter-chip${requestSlot === s ? ' rs-filter-chip--selected' : ''}`}
                  onClick={() => setRequestSlot(s)}
                >
                  {REQUESTABLE_SLOT_SHORT[s]}
                </button>
              ))}
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
            />
          </FormGroup>
        </section>
      )}

      {needsT72Team && (
        <div className="rs-detail-secondary">
          <Button
            variant="link"
            isDanger
            onClick={() =>
              store.answerT72Team(match.id, isHomeAdmin ? 'home' : 'away', 'no')
            }
          >
            No — match not on
          </Button>
        </div>
      )}

      {needsT72Official && mySlot && (
        <div className="rs-detail-secondary">
          <Button
            variant="link"
            isDanger
            onClick={() => openDecline('t72')}
          >
            Can&apos;t attend
          </Button>
        </div>
      )}

      {isAssigner && (
        <details className="rs-detail-tools">
          <summary>Assigner tools</summary>
          <p className="rs-detail-note">
            T-72 is the 72-hour reconfirm before kickoff (teams, then officials).
            Use this only to demo that flow.
          </p>
          <Button variant="secondary" onClick={() => store.startT72(match.id)}>
            Start T-72 reconfirm
          </Button>
        </details>
      )}

      {showAcceptDecline && mySlot && (
        <div className="rs-detail-sticky rs-detail-sticky--split">
          <Button
            variant="primary"
            className="rs-detail-sticky__half"
            onClick={acceptAppointment}
          >
            {match.status === 'needs_reconfirmation'
              ? 'Confirm new details'
              : 'Accept Appointment'}
          </Button>
          <Button
            variant="secondary"
            className="rs-detail-sticky__half"
            onClick={() => openDecline('assignment')}
          >
            {match.status === 'needs_reconfirmation'
              ? 'Can’t attend'
              : 'Decline Appointment'}
          </Button>
        </div>
      )}

      {canRequest && (
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
            {canSubmitRequest ? 'Submit request' : 'Select one role'}
          </Button>
        </div>
      )}

      {stickyPrimary && (
        <div className="rs-detail-sticky">
          <Button variant="primary" isBlock onClick={stickyPrimary.onClick}>
            {stickyPrimary.label}
          </Button>
        </div>
      )}

      {showReportSticky && reportActions.primary && (
        <div className="rs-detail-sticky">
          <Button
            variant="primary"
            isBlock
            onClick={() =>
              navigate(reportActions.primary!.to, {
                state: backState({
                  to: `/matches/${match.id}`,
                  label: 'Match',
                }),
              })
            }
          >
            {reportActions.primary.label}
          </Button>
          {reportActions.cardLink && (
            <Button
              variant="link"
              isBlock
              onClick={() =>
                navigate(reportActions.cardLink!.to, {
                  state: backState({
                    to: `/matches/${match.id}`,
                    label: 'Match',
                  }),
                })
              }
            >
              {reportActions.cardLink.label}
            </Button>
          )}
        </div>
      )}

      {!showReportSticky &&
        reportActions.cardLink &&
        !showAcceptDecline &&
        !canRequest &&
        !stickyPrimary && (
          <div className="rs-detail-sticky">
            <Button
              variant={
                reportActions.cardLink.nudge ? 'primary' : 'secondary'
              }
              isBlock
              onClick={() =>
                navigate(reportActions.cardLink!.to, {
                  state: backState({
                    to: `/matches/${match.id}`,
                    label: 'Match',
                  }),
                })
              }
            >
              {reportActions.cardLink.label}
            </Button>
          </div>
        )}

      <Modal
        variant={ModalVariant.small}
        isOpen={showDecline}
        onClose={() => setShowDecline(false)}
        aria-labelledby="decline-appointment-title"
        aria-describedby="decline-appointment-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="decline-appointment-title" size="lg">
            Decline appointment?
          </Title>
        </ModalHeader>
        <ModalBody>
          <p id="decline-appointment-desc" className="rs-modal-lede">
            Let the assigner know why you can&apos;t take this game.
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
            isDisabled={!reason.trim()}
            onClick={confirmDecline}
          >
            Confirm decline
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
          <p className="rs-official-picker__hint">
            Sorted closest first. Distance is round-trip (for mileage pay).
          </p>
          <div className="rs-official-picker__filters">
            <TextInput
              type="search"
              value={pickSearch}
              placeholder="Search name"
              aria-label="Search officials"
              onChange={(_, v) => setPickSearch(v)}
            />
            {refereeLevels.length > 0 && (
              <div
                className="rs-slot-picker"
                role="radiogroup"
                aria-label="Filter by referee level"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={pickLevelFilter == null}
                  className={`rs-filter-chip${
                    pickLevelFilter == null ? ' rs-filter-chip--selected' : ''
                  }`}
                  onClick={() => setPickLevelFilter(null)}
                >
                  All levels
                </button>
                {refereeLevels.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    role="radio"
                    aria-checked={pickLevelFilter === lv}
                    className={`rs-filter-chip${
                      pickLevelFilter === lv ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() =>
                      setPickLevelFilter(pickLevelFilter === lv ? null : lv)
                    }
                  >
                    Level {lv}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filteredOfficials.length === 0 ? (
            <p className="rs-match-card__meta">No officials match.</p>
          ) : (
            <ul className="rs-official-picker">
              {filteredOfficials.map(
                ({ official: o, roundTripMiles, availStatus }) => {
                const isCurrent = currentPickUserId === o.uid;
                const availLabel = availabilityStatusLabel(availStatus);
                const distLabel = formatDistanceMi(roundTripMiles);
                return (
                  <li key={o.uid}>
                    <button
                      type="button"
                      className={`rs-official-picker__row${
                        isCurrent ? ' rs-official-picker__row--current' : ''
                      }`}
                      onClick={() => pickOfficial(o.uid)}
                    >
                      <span className="rs-official-picker__identity">
                        <UserAvatar user={o} size="sm" />
                        <span className="rs-official-picker__main">
                          <span className="rs-official-picker__name">
                            {o.displayName}
                            {o.refereeLevel != null
                              ? ` (${o.refereeLevel})`
                              : ''}
                          </span>
                          <span
                            className={`rs-official-picker__dist${
                              roundTripMiles == null
                                ? ' rs-official-picker__dist--unknown'
                                : ''
                            }`}
                          >
                            {roundTripMiles != null
                              ? `${distLabel} RT`
                              : distLabel}
                          </span>
                        </span>
                      </span>
                      <span className="rs-official-picker__meta">
                        {isCurrent ? 'Current' : availLabel}
                      </span>
                    </button>
                  </li>
                );
              },
              )}
            </ul>
          )}
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
            currentPickUserId &&
            dataMode === 'live' &&
            isFirebaseConfigured && (
            <Button
              type="button"
              variant="secondary"
              isDisabled={resendEmailState === 'sending'}
              onClick={resendAssignmentEmail}
            >
              {resendEmailState === 'sending'
                ? 'Sending…'
                : resendEmailState === 'sent'
                  ? 'Email sent'
                  : 'Resend email'}
            </Button>
          )}
          {currentPickUserId && pickTarget && pickTarget.slot !== 'cmo' && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                const slot = pickTarget.slot as CrewSlot;
                const assignment = crewPeople(match.crew[slot]).find(
                  (a) => a.id === pickTarget.assignmentId,
                );
                setPickTarget(null);
                if (assignment) openCrewContact(slot, assignment);
              }}
            >
              Contact
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
                if (cmo) openCmoContactRow(cmo);
              }}
            >
              Contact
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
        isOpen={Boolean(removeBlockTarget)}
        onClose={() => setRemoveBlockTarget(null)}
        aria-labelledby="remove-role-title"
        aria-describedby="remove-role-desc"
      >
        <ModalHeader>
          <Title headingLevel="h2" id="remove-role-title" size="lg">
            Remove role block?
          </Title>
        </ModalHeader>
        <ModalBody>
          {removeBlockTarget && (
            <p id="remove-role-desc" className="rs-modal-lede">
              Remove this{' '}
              <strong>
                {REQUESTABLE_SLOT_LABELS[removeBlockTarget.role]}
              </strong>{' '}
              block
              {roleHasAssignee(match, removeBlockTarget.role)
                ? ' and clear the assigned official'
                : ''}
              ?
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="link"
            onClick={() => setRemoveBlockTarget(null)}
          >
            Keep
          </Button>
          <Button type="button" variant="danger" onClick={confirmRemoveBlock}>
            Remove
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={showDenyProposal}
        onClose={() => {
          setShowDenyProposal(false);
          setDenyProposalId(null);
          setDenyProposalReason('');
        }}
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
            Tell the proposing team why you can&apos;t accept these details.
            A message is required.
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
              />
            </FormGroup>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setShowDenyProposal(false);
              setDenyProposalId(null);
              setDenyProposalReason('');
            }}
          >
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
    </div>
  );
}
