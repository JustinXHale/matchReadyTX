import { useMemo, useState } from 'react';
import { Button, EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCirclePlay, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '@/app/AppContext';
import { AboutResourceFormModal } from '@/features/about/AboutResourceFormModal';
import {
  formatMeetingResourceDate,
  meetingResourceIsVisible,
  meetingResourcesNewestFirst,
  type MeetingResourceInput,
} from '@/features/about/meetingResources';
import type { MeetingResource } from '@/domain/types';
import {
  defaultOrgId,
  deleteMeetingResourceInFirestore,
  saveMeetingResourceInFirestore,
} from '@/services/orgData';

export function AboutResourcesPage() {
  const { state, hasAssignerRole, isDemoShowcase } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingResource | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasAssignerRole && !isDemoShowcase;

  const resources = useMemo(
    () =>
      meetingResourcesNewestFirst(state.meetingResources).filter(
        meetingResourceIsVisible,
      ),
    [state.meetingResources],
  );

  const openAdd = () => {
    setEditing(null);
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (resource: MeetingResource) => {
    setEditing(resource);
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
  };

  const onSave = async (input: MeetingResourceInput, resourceId?: string) => {
    if (!canManage) return;
    setBusy(true);
    setActionError(null);
    try {
      await saveMeetingResourceInFirestore(defaultOrgId(), input, resourceId);
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not save resource.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (resource: MeetingResource) => {
    if (!canManage) return;
    const ok = window.confirm(`Remove “${resource.title}” from Resources?`);
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteMeetingResourceInFirestore(defaultOrgId(), resource.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete resource.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack rs-about rs-about-resources">
      <header className="rs-about-hero rs-about-hero--with-action">
        <div className="rs-about-hero__copy">
          <Title headingLevel="h1">Resources</Title>
          <p>
            Recordings and slide decks from society meetings and training
            sessions. Links open in Google Drive or Slides — nothing is stored
            in the app.
          </p>
        </div>
        {canManage ? (
          <Button variant="secondary" onClick={openAdd} isDisabled={busy}>
            Add resource
          </Button>
        ) : null}
      </header>

      {actionError ? (
        <p className="rs-signin__note" role="alert">
          {actionError}
        </p>
      ) : null}

      {resources.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {canManage
              ? 'No resources yet. Add a meeting recording or slide deck link.'
              : 'Meeting recordings and slides will appear here as they are published.'}
          </EmptyStateBody>
          {canManage ? (
            <Button variant="primary" onClick={openAdd} isDisabled={busy}>
              Add resource
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <ul className="rs-about-resources__list">
          {resources.map((item) => {
            const hasRecording = Boolean(item.recordingUrl);
            const hasSlides = Boolean(item.slidesUrl);

            return (
              <li key={item.id} className="rs-about-resource">
                <div className="rs-about-resource__body">
                  <p className="rs-about-resource__date">
                    {formatMeetingResourceDate(item.date)}
                  </p>
                  <h2 className="rs-about-resource__title">{item.title}</h2>
                  {item.description ? (
                    <p className="rs-about-resource__desc">{item.description}</p>
                  ) : null}
                </div>
                <div className="rs-about-resource__actions">
                  {hasRecording ? (
                    <a
                      className="rs-about-resource__link"
                      href={item.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FontAwesomeIcon icon={faCirclePlay} aria-hidden />
                      Watch recording
                    </a>
                  ) : null}
                  {hasSlides ? (
                    <a
                      className="rs-about-resource__link rs-about-resource__link--secondary"
                      href={item.slidesUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FontAwesomeIcon icon={faFileLines} aria-hidden />
                      View slides
                    </a>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="rs-about-resource__manage">
                    <Button
                      variant="link"
                      isInline
                      onClick={() => openEdit(item)}
                      isDisabled={busy}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="link"
                      isInline
                      isDanger
                      onClick={() => void onDelete(item)}
                      isDisabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AboutResourceFormModal
        isOpen={formOpen}
        initial={editing}
        busy={busy}
        onClose={closeForm}
        onSave={onSave}
      />
    </div>
  );
}
