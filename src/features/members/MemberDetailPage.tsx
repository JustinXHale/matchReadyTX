import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  fanFavoriteLabel,
  formatMemberAddress,
  formatMemberJoinedAt,
  memberListName,
  memberSlotLabel,
  pastMatchesForMember,
  rolePillsForMember,
  teamNamesForUser,
  upcomingMatchesForMember,
} from '@/domain/members';
import {
  formatHomeAddress,
  syncDisplayName,
  syncHomeAddressLine,
} from '@/domain/profile';
import {
  APPAREL_SIZES,
  ASSESSED_LEVEL_MAX,
  ASSESSED_LEVEL_MIN,
  type Role,
  type UserProfile,
} from '@/domain/types';
import {
  conferenceTeamOptions,
  scheduleTeamEntries,
  teamConferenceLabel,
} from '@/domain/teams';
import { submittedCmoReportsAboutOfficial, type MatchReport } from '@/domain/reports';
import type { CoachFeedback } from '@/domain/coachFeedback';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  deleteOrgMemberAccount,
  dismissAssessedLevelRequest,
  saveAssessedLevel,
  saveAssignerMemberProfile,
} from '@/services/orgMembers';
import {
  subscribePublishedCoachFeedbackForOfficial,
  subscribeSubmittedCmoForOfficial,
} from '@/services/orgData';
import { useAppBack, type BackNav } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';
import {
  ConferenceTeamPicker,
} from '@/ui/ConferenceTeamPicker';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';
import { UserAvatar } from '@/ui/UserAvatar';
import { AvailabilityMonthCalendar } from '@/features/availability/AvailabilityMonthCalendar';
import { OfficialInsightsPanel } from '@/features/scheduler/OfficialInsightsPanel';
import {
  CmoPublicReportRow,
  PublishedTeamFeedbackRow,
} from '@/features/members/OfficialPublicReports';

function formatBirthdayLabel(birthday: string | undefined): string | null {
  const raw = birthday?.slice(0, 10) ?? '';
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FALLBACK_BACK: BackNav = { to: '/about/members', label: 'Members' };

type EditDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  smsOptIn: boolean | null;
  homeStreet: string;
  homeUnit: string;
  homeCity: string;
  homeRegion: string;
  homePostalCode: string;
  birthday: string;
  roleOfficial: boolean;
  roleTeamAdmin: boolean;
  roleCmo: boolean;
  roleAssigner: boolean;
  roleReportAnalytics: boolean;
  roleFan: boolean;
  refereeLevel: string;
  levelUnknown: boolean;
  teamIds: string[];
  refereeingSince: string;
  jerseySize: string;
  shortsSize: string;
};

type EditFieldKey =
  | 'firstName'
  | 'lastName'
  | 'roles'
  | 'phone'
  | 'birthday'
  | 'teamIds'
  | 'homeStreet'
  | 'homeCity'
  | 'homeRegion'
  | 'homePostalCode'
  | 'refereeLevel'
  | 'refereeingSince'
  | 'jerseySize'
  | 'shortsSize';

function validateMemberEditDraft(
  draft: EditDraft,
  hasAssignableClubs: boolean,
): { message: string; fields: EditFieldKey[] } | null {
  const fields: EditFieldKey[] = [];
  const push = (field: EditFieldKey) => {
    if (!fields.includes(field)) fields.push(field);
  };

  if (!draft.firstName.trim()) push('firstName');
  if (!draft.lastName.trim()) push('lastName');
  if (!draft.firstName.trim() || !draft.lastName.trim()) {
    return {
      message: 'First and last name are required.',
      fields,
    };
  }

  const hasRole =
    draft.roleOfficial ||
    draft.roleTeamAdmin ||
    draft.roleCmo ||
    draft.roleAssigner ||
    draft.roleReportAnalytics ||
    draft.roleFan;
  if (!hasRole) {
    return { message: 'Pick at least one role.', fields: ['roles'] };
  }

  const fanOnly =
    draft.roleFan &&
    !draft.roleOfficial &&
    !draft.roleTeamAdmin &&
    !draft.roleCmo &&
    !draft.roleAssigner &&
    !draft.roleReportAnalytics;

  if (!fanOnly && !draft.phone.trim()) push('phone');

  const needsRef = draft.roleOfficial || draft.roleCmo;
  if (needsRef && !draft.birthday.trim()) push('birthday');

  if (
    draft.roleTeamAdmin &&
    hasAssignableClubs &&
    draft.teamIds.length === 0
  ) {
    push('teamIds');
  }

  if (needsRef) {
    if (!draft.homeStreet.trim()) push('homeStreet');
    if (!draft.homeCity.trim()) push('homeCity');
    if (!draft.homeRegion.trim()) push('homeRegion');
    if (!draft.homePostalCode.trim()) push('homePostalCode');
    if (!draft.levelUnknown) {
      const n = Number(draft.refereeLevel);
      if (!Number.isFinite(n) || n < 1 || n > 20) push('refereeLevel');
    }
    const year = draft.refereeingSince.trim();
    const yearNum = Number(year);
    const thisYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(year) || yearNum < 1950 || yearNum > thisYear) {
      push('refereeingSince');
    }
    if (!draft.jerseySize.trim()) push('jerseySize');
    if (!draft.shortsSize.trim()) push('shortsSize');
  }

  if (fields.length === 0) return null;

  let message = 'Fix the highlighted fields below.';
  if (fields.includes('phone')) message = 'Phone is required.';
  else if (fields.includes('birthday')) {
    message = 'Birthday is required for Referee / CMO.';
  } else if (fields.includes('teamIds')) {
    message = 'Pick at least one club for Team Admin.';
  } else if (
    fields.includes('homeStreet') ||
    fields.includes('homeCity') ||
    fields.includes('homeRegion') ||
    fields.includes('homePostalCode')
  ) {
    message = 'Street, city, state, and ZIP are required for Referee/CMO.';
  } else if (fields.includes('refereeLevel')) {
    message = 'Referee level must be 1–20, or mark “I don’t know”.';
  } else if (fields.includes('refereeingSince')) {
    message = `Year started refereeing must be 1950–${new Date().getFullYear()}.`;
  } else if (fields.includes('jerseySize') || fields.includes('shortsSize')) {
    message = 'Jersey and shorts size are required for Referee/CMO.';
  }

  return { message, fields };
}

function draftFromUser(user: UserProfile): EditDraft {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
    smsOptIn: user.smsOptIn,
    homeStreet: user.homeStreet ?? '',
    homeUnit: user.homeUnit ?? '',
    homeCity: user.homeCity ?? '',
    homeRegion: user.homeRegion ?? '',
    homePostalCode: user.homePostalCode ?? '',
    birthday: user.birthday?.slice(0, 10) ?? '',
    roleOfficial: user.roles.includes('official'),
    roleTeamAdmin: user.roles.includes('teamAdmin'),
    roleCmo: user.roles.includes('cmo'),
    roleAssigner: user.roles.includes('assigner'),
    roleReportAnalytics: user.roles.includes('reportAnalytics'),
    roleFan: user.roles.includes('fan'),
    refereeLevel: user.refereeLevel != null ? String(user.refereeLevel) : '',
    levelUnknown:
      (user.roles.includes('official') || user.roles.includes('cmo')) &&
      user.refereeLevel == null,
    teamIds: [...user.teamIds],
    refereeingSince: (() => {
      const raw = user.refereeingSince?.trim() ?? '';
      const y = raw.slice(0, 4);
      return /^\d{4}$/.test(y) ? y : '';
    })(),
    jerseySize: user.jerseySize ?? '',
    shortsSize: user.shortsSize ?? '',
  };
}

/**
 * Member profile — contact, teams, games, schedule.
 * Home address only when viewing as Scheduler (assigner lens).
 */
export function MemberDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, hasAssignerRole, isAssignerView, hasInsightsAccess, dataMode, store, currentUser } =
    useApp();
  const memberHref = useAppHref(`/about/members/${userId ?? ''}`);
  const timeZone = state.org.timezone || 'America/Chicago';
  const availNow = new Date();
  const { goBack, backLabel } = useAppBack(FALLBACK_BACK);
  /** Address / availability: must be acting as Scheduler, not merely hold the role. */
  const canSeeAssignerPii = isAssignerView && hasAssignerRole;
  const canManage = isAssignerView && hasAssignerRole;

  const user = useMemo(
    () => state.users.find((u) => u.uid === userId) ?? null,
    [state.users, userId],
  );

  const assignableTeams = useMemo(
    () => scheduleTeamEntries(state.matches, state.teams),
    [state.matches, state.teams],
  );

  const teams = useMemo(
    () => (user ? teamNamesForUser(user, state.teams) : []),
    [user, state.teams],
  );

  const upcoming = useMemo(
    () => (user ? upcomingMatchesForMember(state.matches, user.uid) : []),
    [user, state.matches],
  );

  const past = useMemo(
    () => (user ? pastMatchesForMember(state.matches, user.uid) : []),
    [user, state.matches],
  );

  const [fetchedCmo, setFetchedCmo] = useState<MatchReport[]>([]);
  const [fetchedFeedback, setFetchedFeedback] = useState<CoachFeedback[]>([]);

  const publicCmoReports = useMemo(() => {
    if (!userId) return [];
    if (hasInsightsAccess || dataMode !== 'live') {
      return submittedCmoReportsAboutOfficial(
        state.matchReports,
        state.matches,
        userId,
      );
    }
    return [...fetchedCmo].sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    );
  }, [
    userId,
    hasInsightsAccess,
    dataMode,
    state.matchReports,
    state.matches,
    fetchedCmo,
  ]);

  const publishedTeamFeedback = useMemo(() => {
    if (!userId) return [];
    const fromStore = state.coachFeedback.filter(
      (f) =>
        f.officialUserId === userId &&
        f.status === 'submitted' &&
        f.publicOnProfile === true,
    );
    if (hasInsightsAccess || dataMode !== 'live') return fromStore;
    const byId = new Map<string, CoachFeedback>();
    for (const f of [...fromStore, ...fetchedFeedback]) byId.set(f.id, f);
    return [...byId.values()].sort(
      (a, b) =>
        new Date(b.submittedAt ?? b.createdAt).getTime() -
        new Date(a.submittedAt ?? a.createdAt).getTime(),
    );
  }, [
    userId,
    hasInsightsAccess,
    dataMode,
    state.coachFeedback,
    fetchedFeedback,
  ]);

  const userAvailRanges = useMemo(
    () =>
      user ? state.availability.filter((r) => r.userId === user.uid) : [],
    [user, state.availability],
  );

  const [assessedDraft, setAssessedDraft] = useState('');
  const [assessedSaved, setAssessedSaved] = useState(false);
  const [assessedError, setAssessedError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldKey[]>([]);
  const [editErrorToast, setEditErrorToast] = useState(false);
  const [availYear, setAvailYear] = useState(availNow.getFullYear());
  const [availMonth, setAvailMonth] = useState(availNow.getMonth() + 1);
  const [officialTab, setOfficialTab] = useState<'profile' | 'insights'>('profile');

  useEffect(() => {
    if (!user) return;
    setAssessedDraft(
      user.assessedLevel != null ? String(user.assessedLevel) : '',
    );
    setAssessedSaved(false);
    setAssessedError(null);
  }, [user?.uid, user?.assessedLevel]);

  useEffect(() => {
    setEditing(false);
    setEditDraft(null);
    setEditSaved(false);
    setEditError(null);
    setEditFieldErrors([]);
    setEditErrorToast(false);
    setOfficialTab('profile');
  }, [user?.uid]);

  useEffect(() => {
    if (!editErrorToast) return;
    const id = window.setTimeout(() => setEditErrorToast(false), 5000);
    return () => window.clearTimeout(id);
  }, [editErrorToast]);

  useEffect(() => {
    if (!userId) return;
    if (dataMode !== 'live' || !isFirebaseConfigured || hasInsightsAccess) {
      setFetchedCmo([]);
      setFetchedFeedback([]);
      return;
    }
    const orgId = defaultOrgId();
    const unsubCmo = subscribeSubmittedCmoForOfficial(
      orgId,
      userId,
      setFetchedCmo,
    );
    const unsubFb = subscribePublishedCoachFeedbackForOfficial(
      orgId,
      userId,
      setFetchedFeedback,
    );
    return () => {
      unsubCmo();
      unsubFb();
    };
  }, [userId, dataMode, hasInsightsAccess]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash !== 'cmo-reports' && hash !== 'team-feedback') return;
    setOfficialTab('profile');
  }, [location.hash, userId]);

  useEffect(() => {
    if (officialTab !== 'profile') return;
    const hash = location.hash.replace('#', '');
    if (hash !== 'cmo-reports' && hash !== 'team-feedback') return;
    const el = document.getElementById(hash);
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [
    officialTab,
    location.hash,
    userId,
    publicCmoReports.length,
    publishedTeamFeedback.length,
  ]);

  const listName = user ? memberListName(user) : '';
  const joinedLabel =
    user && canSeeAssignerPii
      ? formatMemberJoinedAt(user.joinedAt)
      : null;

  const matchBack: BackNav | undefined = user
    ? {
        to: `/about/members/${user.uid}`,
        label: listName,
        state: location.state,
      }
    : undefined;

  const teamPickerOptions = useMemo(
    () => conferenceTeamOptions(state.teams),
    [state.matches, state.teams],
  );

  if (!user) {
    return (
      <div className="rs-stack">
        <button type="button" className="rs-detail__back" onClick={goBack}>
          ← {backLabel}
        </button>
        <EmptyState titleText="Member not found" headingLevel="h3">
          <EmptyStateBody>That member is not in this org.</EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  const address = canSeeAssignerPii ? formatMemberAddress(user) : null;
  const pills = rolePillsForMember(user.roles);
  const isOfficialLens =
    user.roles.includes('official') || user.roles.includes('cmo');
  const showsRefereeProfileFields =
    editDraft != null
      ? editDraft.roleOfficial || editDraft.roleCmo
      : isOfficialLens;
  const isTeamAdmin = user.roles.includes('teamAdmin');
  const isFan = user.roles.includes('fan');
  const fanFavorite = isFan ? fanFavoriteLabel(user, state.teams) : null;
  const isSelf = currentUser?.uid === user.uid;
  const canDelete = canManage && !isSelf;
  const memberFanOnly =
    isFan &&
    !user.roles.includes('official') &&
    !user.roles.includes('teamAdmin') &&
    !user.roles.includes('cmo') &&
    !user.roles.includes('assigner') &&
    !user.roles.includes('reportAnalytics');
  const birthdayLabel = formatBirthdayLabel(user.birthday);

  const editFanOnly =
    Boolean(editDraft) &&
    editDraft!.roleFan &&
    !editDraft!.roleOfficial &&
    !editDraft!.roleTeamAdmin &&
    !editDraft!.roleCmo &&
    !editDraft!.roleAssigner &&
    !editDraft!.roleReportAnalytics;

  const onApproveRequestedLevel = () => {
    const requested = user.requestedAssessedLevel;
    if (requested == null) return;
    setAssessedDraft(String(requested));
    setAssessedError(null);
    store.updateProfile(user.uid, {
      assessedLevel: requested,
      requestedAssessedLevel: undefined,
    });
    if (isFirebaseConfigured && !user.uid.startsWith('u_')) {
      void saveAssessedLevel(user.uid, requested)
        .then(() => setAssessedSaved(true))
        .catch((err) => {
          setAssessedError(
            err instanceof Error ? err.message : 'Could not approve level.',
          );
        });
    } else {
      setAssessedSaved(true);
    }
  };

  const onDismissLevelRequest = () => {
    setAssessedError(null);
    store.updateProfile(user.uid, { requestedAssessedLevel: undefined });
    if (isFirebaseConfigured && !user.uid.startsWith('u_')) {
      void dismissAssessedLevelRequest(user.uid).catch((err) => {
        setAssessedError(
          err instanceof Error ? err.message : 'Could not dismiss request.',
        );
      });
    }
  };

  const onSaveAssessedLevel = () => {
    const trimmed = assessedDraft.trim();
    let next: number | undefined;
    if (!trimmed) {
      next = undefined;
    } else {
      const n = Number(trimmed);
      if (
        !Number.isFinite(n) ||
        n < ASSESSED_LEVEL_MIN ||
        n > ASSESSED_LEVEL_MAX
      ) {
        setAssessedError(
          `Enter a level from ${ASSESSED_LEVEL_MIN}–${ASSESSED_LEVEL_MAX}, or leave blank to clear.`,
        );
        return;
      }
      next = n;
    }
    setAssessedError(null);
    store.updateProfile(user.uid, {
      assessedLevel: next,
      requestedAssessedLevel: undefined,
    });
    if (isFirebaseConfigured && !user.uid.startsWith('u_')) {
      void saveAssessedLevel(user.uid, next)
        .then(() => setAssessedSaved(true))
        .catch((err) => {
          setAssessedError(
            err instanceof Error ? err.message : 'Could not save assessed level.',
          );
        });
    } else {
      setAssessedSaved(true);
    }
  };

  const startEdit = () => {
    setEditDraft(draftFromUser(user));
    setEditing(true);
    setEditSaved(false);
    setEditError(null);
    setEditFieldErrors([]);
    setEditErrorToast(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditDraft(null);
    setEditError(null);
    setEditFieldErrors([]);
    setEditErrorToast(false);
  };

  const fieldHasError = (field: EditFieldKey) => editFieldErrors.includes(field);
  const fieldErrorClass = (field: EditFieldKey) =>
    fieldHasError(field) ? 'rs-form-field--error' : undefined;

  const saveEdit = () => {
    if (!editDraft) return;
    const validation = validateMemberEditDraft(
      editDraft,
      teamPickerOptions.length > 0,
    );
    if (validation) {
      setEditFieldErrors(validation.fields);
      setEditError(validation.message);
      setEditErrorToast(true);
      return;
    }
    setEditFieldErrors([]);
    setEditErrorToast(false);

    const firstName = editDraft.firstName.trim();
    const lastName = editDraft.lastName.trim();
    const roles: Role[] = [];
    if (editDraft.roleOfficial) roles.push('official');
    if (editDraft.roleTeamAdmin) roles.push('teamAdmin');
    if (editDraft.roleCmo) roles.push('cmo');
    if (editDraft.roleAssigner) roles.push('assigner');
    if (editDraft.roleReportAnalytics) roles.push('reportAnalytics');
    if (editDraft.roleFan) roles.push('fan');

    const fanOnly =
      editDraft.roleFan &&
      !editDraft.roleOfficial &&
      !editDraft.roleTeamAdmin &&
      !editDraft.roleCmo &&
      !editDraft.roleAssigner &&
      !editDraft.roleReportAnalytics;

    const needsRef = editDraft.roleOfficial || editDraft.roleCmo;
    let refereeLevel: number | undefined;
    if (needsRef && !editDraft.levelUnknown) {
      refereeLevel = Number(editDraft.refereeLevel);
    }

    let next: UserProfile = {
      ...user,
      firstName,
      lastName,
      phone: fanOnly ? '' : editDraft.phone.trim(),
      smsOptIn: false,
      birthday: needsRef
        ? editDraft.birthday.trim() || undefined
        : user.birthday,
      roles,
      teamIds: editDraft.roleTeamAdmin ? [...editDraft.teamIds] : [],
      homeStreet: needsRef ? editDraft.homeStreet.trim() : '',
      homeUnit: needsRef
        ? editDraft.homeUnit.trim() || undefined
        : undefined,
      homeCity: needsRef ? editDraft.homeCity.trim() : '',
      homeRegion: needsRef ? editDraft.homeRegion.trim() : '',
      homePostalCode: needsRef ? editDraft.homePostalCode.trim() : '',
      homeAddress: needsRef
        ? formatHomeAddress({
            homeStreet: editDraft.homeStreet,
            homeUnit: editDraft.homeUnit || undefined,
            homeCity: editDraft.homeCity,
            homeRegion: editDraft.homeRegion,
            homePostalCode: editDraft.homePostalCode,
          })
        : '',
      refereeLevel: needsRef ? refereeLevel : undefined,
      refereeingSince: needsRef
        ? editDraft.refereeingSince.trim() || undefined
        : undefined,
      jerseySize: needsRef
        ? (editDraft.jerseySize as UserProfile['jerseySize']) || undefined
        : undefined,
      shortsSize: needsRef
        ? (editDraft.shortsSize as UserProfile['shortsSize']) || undefined
        : undefined,
      assessedLevel: needsRef ? user.assessedLevel : undefined,
      requestedAssessedLevel: needsRef
        ? user.requestedAssessedLevel
        : undefined,
    };
    next = syncDisplayName(next);
    if (needsRef) next = syncHomeAddressLine(next);

    setEditSaving(true);
    setEditError(null);
    void (async () => {
      try {
        store.updateProfile(user.uid, next);
        if (isFirebaseConfigured && !user.uid.startsWith('u_')) {
          await saveAssignerMemberProfile(defaultOrgId(), {
            ...store.getState().users.find((u) => u.uid === user.uid)!,
            ...next,
          });
        }
        setEditSaved(true);
        setEditing(false);
        setEditDraft(null);
      } catch (err) {
        setEditError(
          err instanceof Error ? err.message : 'Could not save member.',
        );
      } finally {
        setEditSaving(false);
      }
    })();
  };

  const confirmDelete = () => {
    setRemoving(true);
    setRemoveError(null);
    void (async () => {
      try {
        if (isFirebaseConfigured && !user.uid.startsWith('u_')) {
          await deleteOrgMemberAccount(defaultOrgId(), user.uid);
        }
        store.removeUserLocally(user.uid);
        setRemoveOpen(false);
        navigate('/about/members', { replace: true });
      } catch (err) {
        setRemoveError(
          err instanceof Error ? err.message : 'Could not delete member.',
        );
      } finally {
        setRemoving(false);
      }
    })();
  };

  const patchDraft = (partial: Partial<EditDraft>) => {
    setEditDraft((d) => (d ? { ...d, ...partial } : d));
    setEditSaved(false);
    setEditError(null);
    const cleared = Object.keys(partial) as EditFieldKey[];
    if (cleared.length > 0) {
      setEditFieldErrors((prev) =>
        prev.filter((field) => !cleared.includes(field)),
      );
    }
  };

  return (
    <div
      className={`rs-stack rs-member-page${
        editing ? ' rs-member-page--editing' : ''
      }`}
    >
      <button type="button" className="rs-detail__back" onClick={goBack}>
        ← {backLabel}
      </button>

      <section className="rs-detail-card rs-member-hero" aria-labelledby="member-name">
        <div className="rs-member-hero__head">
          <UserAvatar user={user} size="md" />
          <div>
            <Title headingLevel="h1" size="lg" id="member-name">
              {listName}
            </Title>
            <div className="rs-label-row" aria-label="Roles">
              {pills.map((p) => (
                <span key={p} className="rs-pill rs-pill--ink">
                  {p}
                </span>
              ))}
              {canManage && !user.profileComplete && (
                <span className="rs-pill">Incomplete</span>
              )}
              {user.assessedLevel != null && (
                <span className="rs-pill">Assessed {user.assessedLevel}</span>
              )}
              {user.assessedLevel == null && user.refereeLevel != null && (
                <span className="rs-pill">
                  Self-assessed lvl {user.refereeLevel}
                </span>
              )}
            </div>
            {joinedLabel ? (
              <p className="rs-match-card__meta">Joined {joinedLabel}</p>
            ) : null}
            {fanFavorite ? (
              <p className="rs-match-card__meta">Favorite: {fanFavorite}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rs-detail-card" aria-labelledby="member-contact">
        <div className="rs-detail-card__head">
          <h2 id="member-contact" className="rs-detail-section__label">
            Contact
          </h2>
          {canManage && !editing && (
            <Button
              variant="link"
              className="rs-detail-card__action"
              onClick={startEdit}
            >
              Edit info
            </Button>
          )}
        </div>

        {!editing ? (
          <>
            <dl className="rs-member-dl">
              <div>
                <dt>Name</dt>
                <dd>{listName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </dd>
              </div>
              {user.phone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${user.phone}`}>{user.phone}</a>
                  </dd>
                </div>
              ) : null}
              {canSeeAssignerPii && (
                <div>
                  <dt>Address</dt>
                  <dd>{address ?? '—'}</dd>
                </div>
              )}
              {!memberFanOnly && birthdayLabel && (
                <div>
                  <dt>Birthday</dt>
                  <dd>{birthdayLabel}</dd>
                </div>
              )}
              {isOfficialLens && user.refereeingSince && (
                <div>
                  <dt>Started</dt>
                  <dd>{user.refereeingSince}</dd>
                </div>
              )}
              {isOfficialLens && user.jerseySize && (
                <div>
                  <dt>Jersey</dt>
                  <dd>{user.jerseySize}</dd>
                </div>
              )}
              {isOfficialLens && user.shortsSize && (
                <div>
                  <dt>Shorts</dt>
                  <dd>{user.shortsSize}</dd>
                </div>
              )}
              {isOfficialLens && (
                <div>
                  <dt>Assessed Level</dt>
                  <dd>
                    {user.assessedLevel != null
                      ? user.assessedLevel
                      : 'Not assessed'}
                    {user.assessedLevel == null && user.refereeLevel != null && (
                      <span className="rs-member-dl__hint">
                        {' '}
                        · self-assessed lvl {user.refereeLevel}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {editSaved && (
              <p className="rs-match-card__meta" role="status">
                Member info saved.
              </p>
            )}
            {editError && !editing && (
              <p className="rs-match-card__meta" role="alert">
                {editError}
              </p>
            )}
          </>
        ) : editDraft ? (
          <div className="rs-stack rs-member-edit">
            <div className="rs-form-row rs-form-row--2">
              <FormGroup
                label="First name"
                isRequired
                className={fieldErrorClass('firstName')}
              >
                <TextInput
                  value={editDraft.firstName}
                  onChange={(_, v) => patchDraft({ firstName: v })}
                />
              </FormGroup>
              <FormGroup
                label="Last name"
                isRequired
                className={fieldErrorClass('lastName')}
              >
                <TextInput
                  value={editDraft.lastName}
                  onChange={(_, v) => patchDraft({ lastName: v })}
                />
              </FormGroup>
            </div>
            <div className="rs-form-row rs-form-row--2">
              <FormGroup label="Email">
                <TextInput value={user.email} isDisabled readOnly />
              </FormGroup>
              {!editFanOnly && (
                <FormGroup
                  label="Phone"
                  isRequired
                  className={fieldErrorClass('phone')}
                >
                  <TextInput
                    type="tel"
                    value={editDraft.phone}
                    onChange={(_, v) => patchDraft({ phone: v })}
                  />
                </FormGroup>
              )}
            </div>
            <FormGroup
              label="Roles"
              isRequired
              className={fieldErrorClass('roles')}
            >
              <div className="rs-onboarding__roles">
                <Checkbox
                  id="member-role-official"
                  label="Referee"
                  isChecked={editDraft.roleOfficial}
                  onChange={(_, v) => patchDraft({ roleOfficial: v })}
                />
                <Checkbox
                  id="member-role-team"
                  label="Team Admin"
                  isChecked={editDraft.roleTeamAdmin}
                  onChange={(_, v) =>
                    patchDraft({
                      roleTeamAdmin: v,
                      teamIds: v ? editDraft.teamIds : [],
                    })
                  }
                />
                <Checkbox
                  id="member-role-cmo"
                  label="CMO"
                  isChecked={editDraft.roleCmo}
                  onChange={(_, v) => patchDraft({ roleCmo: v })}
                />
                <Checkbox
                  id="member-role-fan"
                  label="Fan"
                  isChecked={editDraft.roleFan}
                  onChange={(_, v) => patchDraft({ roleFan: v })}
                />
                <Checkbox
                  id="member-role-assigner"
                  label="Scheduler"
                  isChecked={editDraft.roleAssigner}
                  onChange={(_, v) => patchDraft({ roleAssigner: v })}
                />
                <Checkbox
                  id="member-role-insights"
                  label="Insights access"
                  isChecked={editDraft.roleReportAnalytics}
                  onChange={(_, v) =>
                    patchDraft({ roleReportAnalytics: v })
                  }
                />
              </div>
            </FormGroup>
            {editDraft.roleTeamAdmin && (
              <FormGroup
                label="Clubs they manage"
                isRequired
                className={fieldErrorClass('teamIds')}
              >
                {assignableTeams.length === 0 ? (
                  <p className="rs-match-card__meta">
                    Sync the schedule first to list clubs.
                  </p>
                ) : (
                  <div className="rs-stack">
                  <div
                    className={
                      fieldHasError('teamIds')
                        ? 'rs-form-field--error'
                        : undefined
                    }
                  >
                    <ConferenceTeamPicker
                      options={teamPickerOptions}
                      selectedIds={editDraft.teamIds}
                      onChange={(teamIds) => patchDraft({ teamIds })}
                      ariaLabel="Assign clubs by conference"
                    />
                  </div>
                    {editDraft.teamIds.length > 0 && (
                      <div
                        className="rs-filter-chips"
                        role="group"
                        aria-label="Assigned clubs"
                      >
                        {editDraft.teamIds.map((id) => {
                          const entry = assignableTeams.find(
                            (t) => t.team.id === id,
                          );
                          const label = entry
                            ? `${entry.team.name} (${teamConferenceLabel(entry.competitions, entry.team)})`
                            : id;
                          return (
                            <button
                              key={id}
                              type="button"
                              className="rs-filter-chip rs-filter-chip--selected"
                              onClick={() =>
                                patchDraft({
                                  teamIds: editDraft.teamIds.filter(
                                    (tid) => tid !== id,
                                  ),
                                })
                              }
                              title="Remove club"
                            >
                              {label} ×
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <p className="rs-match-card__meta pf-v6-u-mt-sm">
                  Direct assignment — no link request needed.
                </p>
              </FormGroup>
            )}
            {showsRefereeProfileFields && (
              <FormGroup
                label="Birthday"
                isRequired
                className={fieldErrorClass('birthday')}
              >
                <TextInput
                  type="date"
                  value={editDraft.birthday}
                  onChange={(_, v) => patchDraft({ birthday: v })}
                />
              </FormGroup>
            )}
            {showsRefereeProfileFields && (
              <>
                <div className="rs-form-row rs-form-row--2">
                  <FormGroup
                    label="Street address"
                    isRequired
                    className={fieldErrorClass('homeStreet')}
                  >
                    <TextInput
                      value={editDraft.homeStreet}
                      onChange={(_, v) => patchDraft({ homeStreet: v })}
                    />
                  </FormGroup>
                  <FormGroup label="Apt / suite / unit">
                    <TextInput
                      value={editDraft.homeUnit}
                      onChange={(_, v) => patchDraft({ homeUnit: v })}
                    />
                  </FormGroup>
                </div>
                <div className="rs-form-row rs-form-row--3">
                  <FormGroup
                    label="City"
                    isRequired
                    className={fieldErrorClass('homeCity')}
                  >
                    <TextInput
                      value={editDraft.homeCity}
                      onChange={(_, v) => patchDraft({ homeCity: v })}
                    />
                  </FormGroup>
                  <FormGroup
                    label="State"
                    isRequired
                    className={fieldErrorClass('homeRegion')}
                  >
                    <TextInput
                      value={editDraft.homeRegion}
                      onChange={(_, v) => patchDraft({ homeRegion: v })}
                    />
                  </FormGroup>
                  <FormGroup
                    label="ZIP"
                    isRequired
                    className={fieldErrorClass('homePostalCode')}
                  >
                    <TextInput
                      value={editDraft.homePostalCode}
                      onChange={(_, v) => patchDraft({ homePostalCode: v })}
                    />
                  </FormGroup>
                </div>
                <FormGroup
                  label="Self-reported referee level"
                  className={fieldErrorClass('refereeLevel')}
                >
                  <TextInput
                    type="number"
                    min={1}
                    max={20}
                    value={
                      editDraft.levelUnknown ? '' : editDraft.refereeLevel
                    }
                    isDisabled={editDraft.levelUnknown}
                    onChange={(_, v) =>
                      patchDraft({ levelUnknown: false, refereeLevel: v })
                    }
                  />
                  <Checkbox
                    id="member-level-unknown"
                    className="pf-v6-u-mt-sm"
                    label="I don’t know"
                    isChecked={editDraft.levelUnknown}
                    onChange={(_, v) =>
                      patchDraft({
                        levelUnknown: v,
                        refereeLevel: v ? '' : editDraft.refereeLevel,
                      })
                    }
                  />
                </FormGroup>
                <FormGroup
                  label="Year started refereeing"
                  isRequired
                  className={fieldErrorClass('refereeingSince')}
                >
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={new Date().getFullYear()}
                    value={editDraft.refereeingSince}
                    onChange={(_, v) =>
                      patchDraft({
                        refereeingSince: v.replace(/\D/g, '').slice(0, 4),
                      })
                    }
                    placeholder="e.g. 2018"
                  />
                </FormGroup>
                <FormGroup
                  label="Jersey size"
                  isRequired
                  className={fieldErrorClass('jerseySize')}
                >
                  <div
                    className="rs-onboard__sizes"
                    role="group"
                    aria-label="Jersey size"
                  >
                    {APPAREL_SIZES.map((s) => (
                      <button
                        key={`mj-${s}`}
                        type="button"
                        className={`rs-onboard__size${
                          editDraft.jerseySize === s
                            ? ' rs-onboard__size--selected'
                            : ''
                        }`}
                        onClick={() => patchDraft({ jerseySize: s })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FormGroup>
                <FormGroup
                  label="Shorts size"
                  isRequired
                  className={fieldErrorClass('shortsSize')}
                >
                  <div
                    className="rs-onboard__sizes"
                    role="group"
                    aria-label="Shorts size"
                  >
                    {APPAREL_SIZES.map((s) => (
                      <button
                        key={`ms-${s}`}
                        type="button"
                        className={`rs-onboard__size${
                          editDraft.shortsSize === s
                            ? ' rs-onboard__size--selected'
                            : ''
                        }`}
                        onClick={() => patchDraft({ shortsSize: s })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FormGroup>
              </>
            )}
            {editError && (
              <p className="rs-form-error-banner" role="alert">
                {editError}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {canManage && showsRefereeProfileFields && (
        <section className="rs-detail-card" aria-labelledby="member-assessed">
          <h2 id="member-assessed" className="rs-detail-section__label">
            Set Assessed Level
          </h2>
          <p className="rs-detail-note">
            Society / CMO grade — only schedulers set this. Officials may
            request a level from their profile.
          </p>
          <RefereeLevelChart
            className="pf-v6-u-mb-md"
            caption="Tap chart to compare competencies by level."
          />
          {user.requestedAssessedLevel != null && (
            <div className="rs-actions pf-v6-u-mb-md">
              <p className="rs-match-card__meta" role="status">
                Requested assessed level:{' '}
                <strong>{user.requestedAssessedLevel}</strong>
              </p>
              <Button variant="primary" onClick={onApproveRequestedLevel}>
                Approve level {user.requestedAssessedLevel}
              </Button>
              <Button variant="link" onClick={onDismissLevelRequest}>
                Dismiss request
              </Button>
            </div>
          )}
          <FormGroup label="Assessed Level" fieldId="member-assessed-input">
            <TextInput
              id="member-assessed-input"
              type="number"
              min={ASSESSED_LEVEL_MIN}
              max={ASSESSED_LEVEL_MAX}
              value={assessedDraft}
              onChange={(_, v) => {
                setAssessedDraft(v);
                setAssessedSaved(false);
                setAssessedError(null);
              }}
              placeholder={`${ASSESSED_LEVEL_MIN}–${ASSESSED_LEVEL_MAX}, blank to clear`}
            />
          </FormGroup>
          <Button variant="secondary" onClick={onSaveAssessedLevel}>
            Save assessed level
          </Button>
          {assessedSaved && (
            <p className="rs-match-card__meta" role="status">
              Saved.
            </p>
          )}
          {assessedError && (
            <p className="rs-match-card__meta" role="alert">
              {assessedError}
            </p>
          )}
        </section>
      )}

      <Modal
        isOpen={removeOpen}
        onClose={() => !removing && setRemoveOpen(false)}
        aria-labelledby="remove-member-title"
        aria-describedby="remove-member-desc"
      >
        <ModalHeader
          title="Delete from MatchReadyTX?"
          labelId="remove-member-title"
        />
        <ModalBody className="rs-form-stack">
          <p id="remove-member-desc" className="rs-modal-lede">
            Permanently delete <strong>{listName}</strong>? This removes
            their society membership, profile, and Firebase login. They will
            need to sign in again to rejoin.
          </p>
          {removeError && (
            <p className="rs-match-card__meta" role="alert">
              {removeError}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            isLoading={removing}
            isDisabled={removing}
            onClick={confirmDelete}
          >
            Delete permanently
          </Button>
          <Button
            variant="link"
            isDisabled={removing}
            onClick={() => setRemoveOpen(false)}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {isTeamAdmin && (
        <section className="rs-detail-card" aria-labelledby="member-teams">
          <h2 id="member-teams" className="rs-detail-section__label">
            Teams
          </h2>
          {teams.length === 0 ? (
            <p className="rs-detail-note">No teams linked.</p>
          ) : (
            <ul className="rs-member-teams">
              {teams.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isOfficialLens && (
        <>
          {canSeeAssignerPii && user.roles.includes('official') && (
            <nav className="rs-inline-tabs" aria-label="Official profile">
              <button
                type="button"
                className={
                  officialTab === 'profile'
                    ? 'rs-inline-tabs__tab active'
                    : 'rs-inline-tabs__tab'
                }
                aria-current={officialTab === 'profile' ? 'page' : undefined}
                onClick={() => setOfficialTab('profile')}
              >
                Profile
              </button>
              <button
                type="button"
                className={
                  officialTab === 'insights'
                    ? 'rs-inline-tabs__tab active'
                    : 'rs-inline-tabs__tab'
                }
                aria-current={officialTab === 'insights' ? 'page' : undefined}
                onClick={() => setOfficialTab('insights')}
              >
                Insights
              </button>
            </nav>
          )}

          {officialTab === 'insights' &&
          canSeeAssignerPii &&
          user.roles.includes('official') ? (
            <section
              className="rs-detail-card"
              aria-labelledby="member-official-insights"
            >
              <h2
                id="member-official-insights"
                className="rs-detail-section__label"
              >
                Referee insights
              </h2>
              <OfficialInsightsPanel userId={user.uid} />
            </section>
          ) : (
            <>
          <section className="rs-detail-card rs-member-collapse-wrap">
            <details className="rs-detail-tools rs-member-collapse" open>
              <summary>Upcoming schedule</summary>
              {upcoming.length === 0 ? (
                <p className="rs-detail-note">No upcoming appointments.</p>
              ) : (
                <ul className="rs-list">
                  {upcoming.map((m) => (
                    <li key={m.id}>
                      <MatchListRow
                        match={m}
                        to={`/matches/${m.id}`}
                        showTime
                        back={matchBack}
                        meta={
                          <span className="rs-list-row__hint">
                            {memberSlotLabel(m, user.uid) ?? 'Crew'}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>

          <section className="rs-detail-card rs-member-collapse-wrap">
            <details
              id="cmo-reports"
              className="rs-detail-tools rs-member-collapse"
            >
              <summary>
                CMO coaching reports
                {publicCmoReports.length > 0
                  ? ` (${publicCmoReports.length})`
                  : ''}
              </summary>
              {publicCmoReports.length === 0 ? (
                <p className="rs-detail-note">
                  No submitted CMO coaching reports on file.
                </p>
              ) : (
                <ul className="rs-list">
                  {publicCmoReports.map((report) => (
                    <li key={report.id}>
                      <CmoPublicReportRow
                        report={report}
                        matches={state.matches}
                        users={state.users}
                        to={`${memberHref}/cmo/${report.id}`}
                        back={{
                          to: `${memberHref}#cmo-reports`,
                          label: listName,
                          state: location.state,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>

          <section className="rs-detail-card rs-member-collapse-wrap">
            <details
              id="team-feedback"
              className="rs-detail-tools rs-member-collapse"
            >
              <summary>
                Team feedback
                {publishedTeamFeedback.length > 0
                  ? ` (${publishedTeamFeedback.length})`
                  : ''}
              </summary>
              {publishedTeamFeedback.length === 0 ? (
                <p className="rs-detail-note">
                  No published team feedback on this profile yet.
                </p>
              ) : (
                <ul className="rs-list">
                  {publishedTeamFeedback.map((feedback) => (
                    <li key={feedback.id}>
                      <PublishedTeamFeedbackRow
                        feedback={feedback}
                        matches={state.matches}
                        to={`${memberHref}/feedback/${feedback.id}`}
                        back={{
                          to: `${memberHref}#team-feedback`,
                          label: listName,
                          state: location.state,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>

          {canSeeAssignerPii && (
            <section
              className="rs-detail-card"
              aria-labelledby="member-availability"
            >
              <h2 id="member-availability" className="rs-detail-section__label">
                Availability
              </h2>
              <AvailabilityMonthCalendar
                ranges={userAvailRanges}
                userId={user.uid}
                timeZone={timeZone}
                year={availYear}
                month={availMonth}
                onMonthChange={(y, m) => {
                  setAvailYear(y);
                  setAvailMonth(m);
                }}
                readOnly
                showLegend
              />
            </section>
          )}

          <section className="rs-detail-card rs-member-collapse-wrap">
            <details className="rs-detail-tools rs-member-collapse">
              <summary>Matches officiated</summary>
              {past.length === 0 ? (
                <p className="rs-detail-note">No completed games on file yet.</p>
              ) : (
                <ul className="rs-list">
                  {past.map((m) => (
                    <li key={m.id}>
                      <MatchListRow
                        match={m}
                        to={`/matches/${m.id}`}
                        showTime
                        back={matchBack}
                        meta={
                          <span className="rs-list-row__hint">
                            {memberSlotLabel(m, user.uid) ?? 'Crew'}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>
            </>
          )}
        </>
      )}

      {canManage && (
        <div className="rs-member-delete">
          {canDelete ? (
            <button
              type="button"
              className="rs-member-delete__link"
              onClick={() => {
                setRemoveError(null);
                setRemoveOpen(true);
              }}
            >
              Delete from MatchReadyTX
            </button>
          ) : (
            <p className="rs-match-card__meta">You can’t delete yourself.</p>
          )}
          {canDelete && (
            <p className="rs-member-delete__hint">
              Removes society membership, profile data, and Firebase login.
            </p>
          )}
        </div>
      )}

      {editing && (
        <div className="rs-detail-sticky rs-detail-sticky--split">
          <Button
            variant="primary"
            className="rs-detail-sticky__half"
            isLoading={editSaving}
            isDisabled={editSaving}
            onClick={saveEdit}
          >
            Save changes
          </Button>
          <Button
            variant="link"
            className="rs-detail-sticky__half"
            isDisabled={editSaving}
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        </div>
      )}

      {editErrorToast && editError && (
        <div
          className="rs-update-toast rs-update-toast--error"
          role="alert"
        >
          <Alert variant="danger" isInline isPlain title={editError} />
        </div>
      )}
    </div>
  );
}
