import type { MeetingResource } from '@/domain/types';

export type MeetingResourceInput = {
  title: string;
  date: string;
  description?: string;
  recordingUrl?: string;
  slidesUrl?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function trimOptional(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateMeetingResourceInput(
  input: MeetingResourceInput,
): { ok: true; value: MeetingResourceInput } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Title is required.' };
  if (title.length > 200) {
    return { ok: false, error: 'Title must be 200 characters or fewer.' };
  }

  const date = input.date.trim();
  if (!ISO_DATE.test(date)) {
    return { ok: false, error: 'Date must be YYYY-MM-DD.' };
  }

  const description = trimOptional(input.description);
  if (description && description.length > 500) {
    return { ok: false, error: 'Description must be 500 characters or fewer.' };
  }

  const recordingUrl = trimOptional(input.recordingUrl);
  const slidesUrl = trimOptional(input.slidesUrl);
  if (!recordingUrl && !slidesUrl) {
    return {
      ok: false,
      error: 'Add a recording link, slides link, or both.',
    };
  }
  if (recordingUrl && (!isHttpsUrl(recordingUrl) || recordingUrl.length > 500)) {
    return { ok: false, error: 'Recording link must be a valid https URL.' };
  }
  if (slidesUrl && (!isHttpsUrl(slidesUrl) || slidesUrl.length > 500)) {
    return { ok: false, error: 'Slides link must be a valid https URL.' };
  }

  return {
    ok: true,
    value: { title, date, description, recordingUrl, slidesUrl },
  };
}

export function meetingResourcesNewestFirst(
  items: MeetingResource[],
): MeetingResource[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatMeetingResourceDate(isoDate: string): string {
  const parsed = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parsed) return isoDate;
  const d = new Date(
    Number(parsed[1]),
    Number(parsed[2]) - 1,
    Number(parsed[3]),
  );
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function meetingResourceIsVisible(resource: MeetingResource): boolean {
  return Boolean(resource.recordingUrl?.trim() || resource.slidesUrl?.trim());
}
