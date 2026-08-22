import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FormGroup,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_COMMENT_BLOCKS,
  COACH_FEEDBACK_CRITERION_HINTS,
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
  COACH_FEEDBACK_SCALE_LEGEND,
  appendCoachFeedbackEdit,
  coachFeedbackDocId,
  existingCoachFeedback,
  formatMatchScore,
  isMatchEligibleForCoachFeedback,
  matchOfficialForFeedback,
  reportingTeamIdForUser,
  validateCoachFeedbackScales,
  type CoachFeedback,
  type CoachFeedbackCommentKey,
  type CoachFeedbackEditAction,
  type CoachFeedbackScaleKey,
  type CoachFeedbackScaleValue,
  type CoachFeedbackStatus,
} from '@/domain/coachFeedback';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  saveCoachFeedbackInFirestore,
} from '@/services/orgData';
import { MatchListRow } from '@/ui/MatchListRow';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';
import { UserAvatar } from '@/ui/UserAvatar';

const COMMENT_BLOCKS: {
  key: CoachFeedbackCommentKey;
  label: string;
  rows: number;
  placeholder?: string;
}[] = COACH_FEEDBACK_COMMENT_BLOCKS.map((block) => {
  if (block.key === 'otherCrewFeedback') {
    return {
      ...block,
      rows: 2,
      placeholder: 'AR, No.4, or other crew notes',
    };
  }
  if (block.key === 'videoNotes') {
    return {
      ...block,
      rows: 2,
      placeholder: 'Timestamps for issues in the video',
    };
  }
  if (block.key === 'otherFeedback') {
    return { ...block, rows: 2 };
  }
  return { ...block, rows: 3 };
});

function hydrateFromExisting(
  existing: CoachFeedback | undefined,
  userPhone: string,
): {
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>;
  commentsOnScores: string;
  areasDoneWell: string;
  areasToImprove: string;
  otherFeedback: string;
  otherCrewFeedback: string;
  videoLink: string;
  videoNotes: string;
  clubRole: string;
  phone: string;
  contactAboutReport: boolean;
  commentOpen: Record<CoachFeedbackCommentKey, boolean>;
} {
  const commentsOnScores = existing?.commentsOnScores ?? '';
  const areasDoneWell = existing?.areasDoneWell ?? '';
  const areasToImprove = existing?.areasToImprove ?? '';
  const otherFeedback = existing?.otherFeedback ?? '';
  const otherCrewFeedback = existing?.otherCrewFeedback ?? '';
  const videoNotes = existing?.videoNotes ?? '';
  return {
    scales: existing?.scales ?? {},
    commentsOnScores,
    areasDoneWell,
    areasToImprove,
    otherFeedback,
    otherCrewFeedback,
    videoLink: existing?.videoLink ?? '',
    videoNotes,
    clubRole: existing?.clubRole ?? '',
    phone: existing?.submitterPhone ?? userPhone,
    contactAboutReport: existing?.contactAboutReport === true,
    commentOpen: {
      commentsOnScores: Boolean(commentsOnScores),
      areasDoneWell: Boolean(areasDoneWell),
      areasToImprove: Boolean(areasToImprove),
      otherFeedback: Boolean(otherFeedback),
      otherCrewFeedback: Boolean(otherCrewFeedback),
      videoNotes: Boolean(videoNotes),
    },
  };
}

function YesNoToggle({
  id,
  label,
  open,
  onChange,
}: {
  id: string;
  label: string;
  open: boolean;
  onChange: (open: boolean) => void;
}) {
  return (
    <div className="rs-coach-fb-toggle" role="group" aria-labelledby={`${id}-label`}>
      <div className="rs-coach-fb-toggle__label" id={`${id}-label`}>
        {label}
      </div>
      <div className="rs-coach-fb-toggle__btns">
        <button
          type="button"
          className={`rs-filter-chip${open ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={open}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`rs-filter-chip${!open ? ' rs-filter-chip--selected' : ''}`}
          aria-pressed={!open}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function CoachFeedbackFormPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode, refresh } = useApp();
  const navigate = useNavigate();
  const reportListHref = useAppHref('/team-admin/report');

  const match = state.matches.find((m) => m.id === matchId);

  const context = useMemo(() => {
    if (!currentUser || !match) return null;
    if (!isMatchEligibleForCoachFeedback(match, currentUser)) return null;
    const reportingTeamId = reportingTeamIdForUser(match, currentUser);
    if (!reportingTeamId) return null;
    const mo = matchOfficialForFeedback(match);
    if (!mo) return null;
    const reportingTeamName =
      reportingTeamId === match.homeTeamId
        ? match.homeTeamName
        : match.awayTeamName;
    const existing = existingCoachFeedback(
      state.coachFeedback,
      match.id,
      reportingTeamId,
    );
    return { reportingTeamId, reportingTeamName, mo, existing };
  }, [currentUser, match, state.coachFeedback]);

  const existing = context?.existing;
  const userPhone = currentUser?.phone ?? '';

  const initial = hydrateFromExisting(existing, userPhone);
  const [scales, setScales] = useState(initial.scales);
  const [commentsOnScores, setCommentsOnScores] = useState(
    initial.commentsOnScores,
  );
  const [areasDoneWell, setAreasDoneWell] = useState(initial.areasDoneWell);
  const [areasToImprove, setAreasToImprove] = useState(initial.areasToImprove);
  const [otherFeedback, setOtherFeedback] = useState(initial.otherFeedback);
  const [otherCrewFeedback, setOtherCrewFeedback] = useState(
    initial.otherCrewFeedback,
  );
  const [videoLink, setVideoLink] = useState(initial.videoLink);
  const [videoNotes, setVideoNotes] = useState(initial.videoNotes);
  const [clubRole, setClubRole] = useState(initial.clubRole);
  const [phone, setPhone] = useState(initial.phone);
  const [contactAboutReport, setContactAboutReport] = useState(
    initial.contactAboutReport,
  );
  const [commentOpen, setCommentOpen] = useState(initial.commentOpen);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const hydratedKey = useRef<string | null>(null);

  const commentValues: Record<CoachFeedbackCommentKey, string> = {
    commentsOnScores,
    areasDoneWell,
    areasToImprove,
    otherFeedback,
    otherCrewFeedback,
    videoNotes,
  };
  const commentSetters: Record<CoachFeedbackCommentKey, (v: string) => void> = {
    commentsOnScores: setCommentsOnScores,
    areasDoneWell: setAreasDoneWell,
    areasToImprove: setAreasToImprove,
    otherFeedback: setOtherFeedback,
    otherCrewFeedback: setOtherCrewFeedback,
    videoNotes: setVideoNotes,
  };

  useEffect(() => {
    const key = existing
      ? `${existing.id}:${existing.updatedAt}`
      : match
        ? `new:${match.id}`
        : null;
    if (!key || hydratedKey.current === key) return;
    if (
      hydratedKey.current != null &&
      hydratedKey.current.startsWith(`new:`) &&
      key.startsWith(`new:`)
    ) {
      return;
    }
    const next = hydrateFromExisting(existing, userPhone);
    setScales(next.scales);
    setCommentsOnScores(next.commentsOnScores);
    setAreasDoneWell(next.areasDoneWell);
    setAreasToImprove(next.areasToImprove);
    setOtherFeedback(next.otherFeedback);
    setOtherCrewFeedback(next.otherCrewFeedback);
    setVideoLink(next.videoLink);
    setVideoNotes(next.videoNotes);
    setClubRole(next.clubRole);
    setPhone(next.phone);
    setContactAboutReport(next.contactAboutReport);
    setCommentOpen(next.commentOpen);
    hydratedKey.current = key;
  }, [existing, match, userPhone]);

  if (!currentUser) return null;

  if (!match || !context) {
    return (
      <div className="rs-stack">
        <Button
          variant="link"
          className="rs-detail__back"
          onClick={() => navigate(reportListHref)}
        >
          ← Referee Feedback
        </Button>
        <Title headingLevel="h2" size="lg">
          Feedback not available
        </Title>
        <p className="rs-match-card__meta">
          This match is not eligible for referee feedback, or you are not a
          Team Admin for either side.
        </p>
      </div>
    );
  }

  const { reportingTeamId, reportingTeamName, mo } = context;
  const officialProfile = state.users.find((u) => u.uid === mo.userId);

  const buildFeedback = (
    status: CoachFeedbackStatus,
    action: CoachFeedbackEditAction,
  ): CoachFeedback => {
    const now = new Date().toISOString();
    const edit = {
      at: now,
      byUserId: currentUser.uid,
      byName: currentUser.displayName,
      action,
    };
    const textOrUndef = (open: boolean, value: string) =>
      open && value.trim() ? value.trim() : undefined;

    return {
      id: coachFeedbackDocId(match.id, reportingTeamId),
      orgId: dataMode === 'live' ? defaultOrgId() : state.org.id,
      matchId: match.id,
      slot: 'mo',
      officialUserId: mo.userId,
      officialName: mo.userName,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      kickoffAt: match.kickoffAt,
      competition: match.competition,
      level: match.level,
      score: formatMatchScore(match),
      scales,
      commentsOnScores: textOrUndef(
        commentOpen.commentsOnScores,
        commentsOnScores,
      ),
      areasDoneWell: textOrUndef(commentOpen.areasDoneWell, areasDoneWell),
      areasToImprove: textOrUndef(commentOpen.areasToImprove, areasToImprove),
      otherFeedback: textOrUndef(commentOpen.otherFeedback, otherFeedback),
      otherCrewFeedback: textOrUndef(
        commentOpen.otherCrewFeedback,
        otherCrewFeedback,
      ),
      videoLink: videoLink.trim() || undefined,
      videoNotes: textOrUndef(commentOpen.videoNotes, videoNotes),
      submitterUserId: currentUser.uid,
      submitterName: currentUser.displayName,
      submitterEmail: currentUser.email,
      submitterPhone: phone.trim() || undefined,
      clubRole: clubRole.trim(),
      contactAboutReport,
      reportingTeamId,
      reportingTeamName,
      status,
      submittedAt:
        status === 'submitted'
          ? (existing?.submittedAt ?? now)
          : existing?.submittedAt,
      edits: appendCoachFeedbackEdit(existing?.edits, edit),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const persist = async (feedback: CoachFeedback) => {
    if (dataMode === 'live' && isFirebaseConfigured) {
      await saveCoachFeedbackInFirestore(defaultOrgId(), feedback);
      store.upsertCoachFeedbackLocal(feedback);
    } else {
      const id = store.saveCoachFeedback(feedback);
      if (!id) {
        throw new Error('Could not save feedback. Check your club access.');
      }
    }
    refresh();
  };

  const onSave = async () => {
    setError(null);
    if (!clubRole.trim()) {
      setError('Enter your role within the club.');
      return;
    }
    setBusy('save');
    try {
      // Keep published reports published on Save; otherwise draft.
      const status: CoachFeedbackStatus =
        existing?.status === 'submitted' ? 'submitted' : 'draft';
      await persist(buildFeedback(status, 'save'));
      navigate(reportListHref);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save feedback.',
      );
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!clubRole.trim()) {
      setError('Enter your role within the club.');
      return;
    }
    if (!validateCoachFeedbackScales(scales)) {
      setError('Rate every criterion (1–5 or N/A).');
      return;
    }

    setBusy('submit');
    try {
      await persist(buildFeedback('submitted', 'submit'));
      navigate(reportListHref);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not submit feedback.',
      );
    } finally {
      setBusy(null);
    }
  };

  const title =
    existing?.status === 'submitted'
      ? 'Edit referee feedback'
      : existing?.status === 'draft'
        ? 'Continue referee feedback'
        : 'Referee feedback';

  return (
    <div className="rs-stack">
      <Button
        variant="link"
        className="rs-detail__back"
        onClick={() => navigate(reportListHref)}
      >
        ← Referee Feedback
      </Button>
      <Title headingLevel="h1" size="lg">
        {title}
      </Title>

      <section className="rs-detail-card rs-coach-fb-subject" aria-labelledby="cf-mo">
        <h2 id="cf-mo" className="rs-detail-section__label">
          Match Official being rated
        </h2>
        <div className="rs-coach-fb-subject__person">
          <UserAvatar
            user={
              officialProfile ?? {
                displayName: mo.userName,
                firstName: '',
                lastName: '',
              }
            }
            size="md"
          />
          <div>
            <p className="rs-coach-fb-subject__name">{mo.userName}</p>
            <p className="rs-match-card__meta">
              Feedback from {reportingTeamName}
            </p>
          </div>
        </div>
      </section>

      <MatchListRow match={match} />

      <div className="rs-form-stack">
        <h2 className="rs-detail-section__label">Your details</h2>
        <p className="rs-match-card__meta">
          Gray fields are from your signed-in profile (not the Match Official).
          The Scheduler uses these to follow up with you.
        </p>
        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="Your name" fieldId="cf-name">
            <TextInput
              id="cf-name"
              value={currentUser.displayName}
              isDisabled
            />
          </FormGroup>
          <FormGroup label="Your club role" fieldId="cf-role" isRequired>
            <TextInput
              id="cf-role"
              value={clubRole}
              onChange={(_e, v) => setClubRole(v)}
              placeholder="Head Coach, Captain…"
            />
          </FormGroup>
        </div>
        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="Your phone" fieldId="cf-phone">
            <TextInput
              id="cf-phone"
              value={phone}
              onChange={(_e, v) => setPhone(v)}
            />
          </FormGroup>
          <FormGroup label="Your email" fieldId="cf-email">
            <TextInput
              id="cf-email"
              value={currentUser.email}
              isDisabled
            />
          </FormGroup>
        </div>
        <YesNoToggle
          id="cf-contact-about"
          label="Would you like to be contacted about this report?"
          open={contactAboutReport}
          onChange={setContactAboutReport}
        />

        <FormGroup label="Video link" fieldId="cf-video">
          <p className="rs-match-card__meta rs-coach-fb-video-hint">
            Having video makes it easier for us to review.
          </p>
          <TextInput
            id="cf-video"
            value={videoLink}
            onChange={(_e, v) => setVideoLink(v)}
            placeholder="https://…"
          />
        </FormGroup>

        <section className="rs-detail-card rs-coach-fb-ratings" aria-labelledby="cf-ratings">
          <h2 id="cf-ratings" className="rs-detail-section__label">
            Performance ratings
          </h2>
          <p className="rs-match-card__meta rs-coach-fb-scale-legend">
            {COACH_FEEDBACK_SCALE_LEGEND}
          </p>

          {COACH_FEEDBACK_SCALE_KEYS.map((key) => (
            <div key={key} className="rs-coach-fb-criterion">
              <div className="rs-coach-fb-criterion__head">
                <span className="rs-coach-fb-criterion__title">
                  {COACH_FEEDBACK_CRITERION_LABELS[key]}
                </span>
                <p className="rs-coach-fb-criterion__hint">
                  {COACH_FEEDBACK_CRITERION_HINTS[key]}
                </p>
              </div>
              <ScaleRatingCards
                name={`cf-scale-${key}`}
                value={scales[key]}
                onChange={(v) =>
                  setScales((prev) => ({
                    ...prev,
                    [key]: v,
                  }))
                }
                ariaLabel={COACH_FEEDBACK_CRITERION_LABELS[key]}
              />
            </div>
          ))}
        </section>

        {COMMENT_BLOCKS.map((block) => {
          const open = commentOpen[block.key];
          return (
            <div key={block.key} className="rs-coach-fb-comment-block">
              <YesNoToggle
                id={`cf-open-${block.key}`}
                label={block.label}
                open={open}
                onChange={(next) => {
                  setCommentOpen((prev) => ({ ...prev, [block.key]: next }));
                  if (!next) commentSetters[block.key]('');
                }}
              />
              {open && (
                <TextArea
                  id={`cf-${block.key}`}
                  value={commentValues[block.key]}
                  onChange={(_e, v) => commentSetters[block.key](v)}
                  rows={block.rows}
                  placeholder={block.placeholder}
                  aria-label={block.label}
                />
              )}
            </div>
          );
        })}

        {existing && existing.edits.length > 0 && (
          <p className="rs-match-card__meta">
            {existing.edits.length} save
            {existing.edits.length === 1 ? '' : 's'} on record
            {existing.submittedAt
              ? ` · First submitted ${new Date(existing.submittedAt).toLocaleString()}`
              : ''}
            {existing.updatedAt
              ? ` · Last updated ${new Date(existing.updatedAt).toLocaleString()}`
              : ''}
          </p>
        )}

        {error && <Alert variant="danger" title={error} isInline />}

        <div className="rs-actions">
          <Button
            variant="primary"
            onClick={() => void onSubmit()}
            isDisabled={busy != null}
            isLoading={busy === 'submit'}
          >
            {existing?.status === 'submitted' ? 'Update & submit' : 'Submit'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onSave()}
            isDisabled={busy != null}
            isLoading={busy === 'save'}
          >
            Save
          </Button>
          <Button
            variant="link"
            onClick={() => navigate(reportListHref)}
            isDisabled={busy != null}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
