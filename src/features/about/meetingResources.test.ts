import { describe, expect, it } from 'vitest';
import {
  formatMeetingResourceDate,
  meetingResourcesNewestFirst,
  validateMeetingResourceInput,
} from '@/features/about/meetingResources';
import type { MeetingResource } from '@/domain/types';

describe('meetingResources', () => {
  const sample: MeetingResource[] = [
    {
      id: 'older',
      title: 'Older call',
      date: '2025-11-01',
      recordingUrl: 'https://drive.google.com/file/d/a/view',
    },
    {
      id: 'newer',
      title: 'Newer call',
      date: '2026-02-10',
      slidesUrl: 'https://docs.google.com/presentation/d/x/edit',
    },
  ];

  it('sorts newest first', () => {
    expect(meetingResourcesNewestFirst(sample).map((r) => r.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('formats ISO dates for display', () => {
    expect(formatMeetingResourceDate('2026-02-10')).toMatch(/Feb/);
    expect(formatMeetingResourceDate('not-a-date')).toBe('not-a-date');
  });

  it('requires at least one https link', () => {
    expect(
      validateMeetingResourceInput({
        title: 'Call',
        date: '2026-02-10',
      }).ok,
    ).toBe(false);
    expect(
      validateMeetingResourceInput({
        title: 'Call',
        date: '2026-02-10',
        recordingUrl: 'https://drive.google.com/file/d/a/view',
      }).ok,
    ).toBe(true);
  });
});
