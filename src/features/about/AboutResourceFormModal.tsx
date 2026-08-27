import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  Modal,
  ModalBody,
  ModalFooter,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { MeetingResource } from '@/domain/types';
import {
  validateMeetingResourceInput,
  type MeetingResourceInput,
} from '@/features/about/meetingResources';

type AboutResourceFormModalProps = {
  isOpen: boolean;
  initial?: MeetingResource | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (input: MeetingResourceInput, resourceId?: string) => void | Promise<void>;
};

function inputFromResource(resource: MeetingResource | null | undefined): MeetingResourceInput {
  if (!resource) {
    return {
      title: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      recordingUrl: '',
      slidesUrl: '',
    };
  }
  return {
    title: resource.title,
    date: resource.date,
    description: resource.description ?? '',
    recordingUrl: resource.recordingUrl ?? '',
    slidesUrl: resource.slidesUrl ?? '',
  };
}

export function AboutResourceFormModal({
  isOpen,
  initial,
  busy = false,
  onClose,
  onSave,
}: AboutResourceFormModalProps) {
  const [form, setForm] = useState<MeetingResourceInput>(() => inputFromResource(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(inputFromResource(initial));
    setError(null);
  }, [isOpen, initial]);

  const submit = () => {
    const validated = validateMeetingResourceInput(form);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setError(null);
    void onSave(validated.value, initial?.id);
  };

  return (
    <Modal
      variant="small"
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="rs-resource-form-title"
    >
      <ModalBody>
        <Form>
          <h2 id="rs-resource-form-title" className="pf-v6-c-title pf-m-h2">
            {initial ? 'Edit resource' : 'Add resource'}
          </h2>
          <FormGroup label="Title" isRequired fieldId="resource-title">
            <TextInput
              id="resource-title"
              value={form.title}
              onChange={(_e, v) => setForm((f) => ({ ...f, title: v }))}
              isDisabled={busy}
            />
          </FormGroup>
          <FormGroup label="Meeting date" isRequired fieldId="resource-date">
            <TextInput
              id="resource-date"
              type="date"
              value={form.date}
              onChange={(_e, v) => setForm((f) => ({ ...f, date: v }))}
              isDisabled={busy}
            />
          </FormGroup>
          <FormGroup label="Description" fieldId="resource-description">
            <TextArea
              id="resource-description"
              value={form.description ?? ''}
              onChange={(_e, v) => setForm((f) => ({ ...f, description: v }))}
              isDisabled={busy}
              resizeOrientation="vertical"
            />
          </FormGroup>
          <FormGroup label="Recording link" fieldId="resource-recording">
            <TextInput
              id="resource-recording"
              type="url"
              value={form.recordingUrl ?? ''}
              onChange={(_e, v) => setForm((f) => ({ ...f, recordingUrl: v }))}
              isDisabled={busy}
              placeholder="https://drive.google.com/file/d/…/view"
            />
            <FormHelperText>
              Google Drive file link from Meet recording
            </FormHelperText>
          </FormGroup>
          <FormGroup label="Slides link" fieldId="resource-slides">
            <TextInput
              id="resource-slides"
              type="url"
              value={form.slidesUrl ?? ''}
              onChange={(_e, v) => setForm((f) => ({ ...f, slidesUrl: v }))}
              isDisabled={busy}
              placeholder="https://docs.google.com/presentation/d/…/edit"
            />
            <FormHelperText>
              Google Slides or PDF on Drive (anyone with link)
            </FormHelperText>
          </FormGroup>
          {error ? (
            <p className="rs-signin__note" role="alert">
              {error}
            </p>
          ) : null}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={submit} isDisabled={busy}>
          {initial ? 'Save changes' : 'Add resource'}
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={busy}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
