import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
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
import { useApp } from '@/app/AppContext';
import {
  availabilityForUser,
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
import { APPAREL_SIZES, type Role, type UserProfile } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  deleteOrgMemberAccount,
  saveAssessedLevel,
  saveAssignerMemberProfile,
} from '@/services/orgMembers';
import { readBackNav, type BackNav } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';
import { UserAvatar } from '@/ui/UserAvatar';

const FALLBACK_BACK: BackNav = { to: '/members', label: 'Members' };

function formatRange(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart);
  const end = new Date(isoEnd);
  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const t0 = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const t1 = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} · ${t0}–${t1}`;
}

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
  roleFan: boolean;
  refereeLevel: string;
  levelUnknown: boolean;
  refereeingSince: string;
  jerseySize: string;
  shortsSize: string;
};

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
    roleFan: user.roles.includes('fan'),
    refereeLevel: user.refereeLevel != null ? String(user.refereeLevel) : '',
    levelUnknown:
      (user.roles.includes('official') || user.roles.includes('cmo')) &&
      user.refereeLevel == null,
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
  const { state, hasAssignerRole, isAssignerView, store, currentUser } =
    useApp();
  const back = readBackNav(location.state) ?? FALLBACK_BACK;
  const goBack = () =>
    navigate(back.to, back.state !== undefined ? { state: back.state } : undefined);
  const backLabel = `Back to ${back.label}`;
  /** Address / availability: must be acting as Scheduler, not merely hold the role. */
  const canSeeAssignerPii = isAssignerView && hasAssignerRole;
  const canManage = isAssignerView && hasAssignerRole;

  const user = useMemo(
    () => state.users.find((u) => u.uid === userId) ?? null,
    [state.users, userId],
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

  const availability = useMemo(
    () => (user ? availabilityForUser(state.availability, user.uid) : []),
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
  }, [user?.uid]);

  const listName = user ? memberListName(user) : '';
  const joinedLabel =
    user && canSeeAssignerPii
      ? formatMemberJoinedAt(user.joinedAt)
      : null;

  const matchBack: BackNav | undefined = user
    ? {
        to: `/members/${user.uid}`,
        label: listName,
        state: location.state,
      }
    : undefined;

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
  const isTeamAdmin = user.roles.includes('teamAdmin');
  const isFan = user.roles.includes('fan');
  const fanFavorite = isFan ? fanFavoriteLabel(user, state.teams) : null;
  const isSelf = currentUser?.uid === user.uid;
  const canDelete = canManage && !isSelf;

  const onSaveAssessedLevel = () => {
    const trimmed = assessedDraft.trim();
    let next: number | undefined;
    if (!trimmed) {
      next = undefined;
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 1 || n > 20) {
        setAssessedError('Enter a level from 1–20, or leave blank to clear.');
        return;
      }
      next = n;
    }
    setAssessedError(null);
    store.updateProfile(user.uid, { assessedLevel: next });
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
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditDraft(null);
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editDraft) return;
    const firstName = editDraft.firstName.trim();
    const lastName = editDraft.lastName.trim();
    if (!firstName || !lastName) {
      setEditError('First and last name are required.');
      return;
    }
    const roles: Role[] = [];
    if (editDraft.roleOfficial) roles.push('official');
    if (editDraft.roleTeamAdmin) roles.push('teamAdmin');
    if (editDraft.roleCmo) roles.push('cmo');
    if (editDraft.roleAssigner) roles.push('assigner');
    if (editDraft.roleFan) roles.push('fan');
    if (roles.length === 0) {
      setEditError('Pick at least one role.');
      return;
    }

    const fanOnly =
      editDraft.roleFan &&
      !editDraft.roleOfficial &&
      !editDraft.roleTeamAdmin &&
      !editDraft.roleCmo &&
      !editDraft.roleAssigner;

    if (!fanOnly && !editDraft.phone.trim()) {
      setEditError('Phone is required.');
      return;
    }

    const needsRef =
      editDraft.roleOfficial || editDraft.roleCmo;
    let refereeLevel: number | undefined;
    if (needsRef) {
      if (
        !editDraft.homeStreet.trim() ||
        !editDraft.homeCity.trim() ||
        !editDraft.homeRegion.trim() ||
        !editDraft.homePostalCode.trim()
      ) {
        setEditError('Street, city, state, and ZIP are required for Referee/CMO.');
        return;
      }
      if (!editDraft.levelUnknown) {
        const n = Number(editDraft.refereeLevel);
        if (!Number.isFinite(n) || n < 1 || n > 20) {
          setEditError('Referee level must be 1–20, or mark “I don’t know”.');
          return;
        }
        refereeLevel = n;
      }
    }

    let next: UserProfile = {
      ...user,
      firstName,
      lastName,
      phone: fanOnly ? '' : editDraft.phone.trim(),
      smsOptIn: false,
      birthday: fanOnly
        ? undefined
        : editDraft.birthday.trim() || undefined,
      roles,
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
        navigate('/members', { replace: true });
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
  };

  return (
    <div className="rs-stack">
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
              {user.refereeLevel != null && (
                <span className="rs-pill">Level {user.refereeLevel}</span>
              )}
              {user.assessedLevel != null && (
                <span className="rs-pill">Assessed {user.assessedLevel}</span>
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
        <h2 id="member-contact" className="rs-detail-section__label">
          Contact
        </h2>
        <dl className="rs-member-dl">
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
          {isOfficialLens && (
            <div>
              <dt>Assessed Level</dt>
              <dd>
                {user.assessedLevel != null
                  ? user.assessedLevel
                  : 'Not assessed'}
                {user.refereeLevel != null && (
                  <span className="rs-member-dl__hint">
                    {' '}
                    · self-reported {user.refereeLevel}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {canManage && isOfficialLens && (
        <section className="rs-detail-card" aria-labelledby="member-assessed">
          <h2 id="member-assessed" className="rs-detail-section__label">
            Set Assessed Level
          </h2>
          <p className="rs-detail-note">
            Society / CMO grade shown read-only on the official’s profile.
          </p>
          <FormGroup label="Assessed Level" fieldId="member-assessed-input">
            <TextInput
              id="member-assessed-input"
              type="number"
              min={1}
              max={20}
              value={assessedDraft}
              onChange={(_, v) => {
                setAssessedDraft(v);
                setAssessedSaved(false);
                setAssessedError(null);
              }}
              placeholder="1–20, blank to clear"
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

      {canManage && (
        <section className="rs-detail-card" aria-labelledby="member-manage">
          <h2 id="member-manage" className="rs-detail-section__label">
            Manage member
          </h2>

          {!editing ? (
            <div className="rs-actions">
              <Button variant="secondary" onClick={startEdit}>
                Edit member info
              </Button>
              <Button
                variant="danger"
                isDisabled={!canDelete}
                onClick={() => {
                  setRemoveError(null);
                  setRemoveOpen(true);
                }}
              >
                Delete from MatchReadyTX
              </Button>
            </div>
          ) : editDraft ? (
            <div className="rs-stack">
              <div className="rs-form-row rs-form-row--2">
                <FormGroup label="First name" isRequired>
                  <TextInput
                    value={editDraft.firstName}
                    onChange={(_, v) => patchDraft({ firstName: v })}
                  />
                </FormGroup>
                <FormGroup label="Last name" isRequired>
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
                {!(
                  editDraft.roleFan &&
                  !editDraft.roleOfficial &&
                  !editDraft.roleTeamAdmin &&
                  !editDraft.roleCmo &&
                  !editDraft.roleAssigner
                ) && (
                  <FormGroup label="Phone" isRequired>
                    <TextInput
                      type="tel"
                      value={editDraft.phone}
                      onChange={(_, v) => patchDraft({ phone: v })}
                    />
                  </FormGroup>
                )}
              </div>
              <FormGroup label="Roles" isRequired>
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
                    onChange={(_, v) => patchDraft({ roleTeamAdmin: v })}
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
                </div>
              </FormGroup>
              <FormGroup label="Birthday">
                <TextInput
                  type="date"
                  value={editDraft.birthday}
                  onChange={(_, v) => patchDraft({ birthday: v })}
                />
              </FormGroup>

              {(editDraft.roleOfficial || editDraft.roleCmo) && (
                <>
                  <div className="rs-form-row rs-form-row--2">
                    <FormGroup label="Street address" isRequired>
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
                    <FormGroup label="City" isRequired>
                      <TextInput
                        value={editDraft.homeCity}
                        onChange={(_, v) => patchDraft({ homeCity: v })}
                      />
                    </FormGroup>
                    <FormGroup label="State" isRequired>
                      <TextInput
                        value={editDraft.homeRegion}
                        onChange={(_, v) => patchDraft({ homeRegion: v })}
                      />
                    </FormGroup>
                    <FormGroup label="ZIP" isRequired>
                      <TextInput
                        value={editDraft.homePostalCode}
                        onChange={(_, v) => patchDraft({ homePostalCode: v })}
                      />
                    </FormGroup>
                  </div>
                  <FormGroup label="Self-reported referee level">
                    <TextInput
                      type="number"
                      min={1}
                      max={20}
                      value={editDraft.levelUnknown ? '' : editDraft.refereeLevel}
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
                  <FormGroup label="Year started refereeing">
                    <TextInput
                      type="number"
                      value={editDraft.refereeingSince}
                      onChange={(_, v) =>
                        patchDraft({
                          refereeingSince: v.replace(/\D/g, '').slice(0, 4),
                        })
                      }
                    />
                  </FormGroup>
                  <FormGroup label="Jersey size">
                    <div className="rs-onboard__sizes" role="group">
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
                  <FormGroup label="Shorts size">
                    <div className="rs-onboard__sizes" role="group">
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

              <div className="rs-actions">
                <Button
                  variant="primary"
                  isLoading={editSaving}
                  isDisabled={editSaving}
                  onClick={saveEdit}
                >
                  Save changes
                </Button>
                <Button
                  variant="link"
                  isDisabled={editSaving}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {editSaved && !editing && (
            <p className="rs-match-card__meta" role="status">
              Member info saved.
            </p>
          )}
          {editError && (
            <p className="rs-match-card__meta" role="alert">
              {editError}
            </p>
          )}
          <p className="rs-detail-note pf-v6-u-mt-sm">
            Delete removes them from this society, deletes their profile data,
            and removes their Firebase Auth account so they must sign up again.
          </p>
          {isSelf && (
            <p className="rs-match-card__meta">
              You can’t delete yourself.
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
          <section className="rs-detail-card" aria-labelledby="member-upcoming">
            <h2 id="member-upcoming" className="rs-detail-section__label">
              Upcoming schedule
            </h2>
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
          </section>

          {canSeeAssignerPii && availability.length > 0 && (
            <section
              className="rs-detail-card"
              aria-labelledby="member-availability"
            >
              <h2 id="member-availability" className="rs-detail-section__label">
                Availability
              </h2>
              <ul className="rs-member-availability">
                {availability.map((r) => (
                  <li key={r.id}>
                    <span
                      className={`rs-pill${
                        r.kind === 'blocked' ? ' rs-pill--urgent' : ' rs-pill--ok'
                      }`}
                    >
                      {r.kind === 'blocked' ? 'Blocked' : 'Available'}
                    </span>{' '}
                    {formatRange(r.startAt, r.endAt)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rs-detail-card" aria-labelledby="member-history">
            <h2 id="member-history" className="rs-detail-section__label">
              Games worked
            </h2>
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
          </section>
        </>
      )}
    </div>
  );
}
