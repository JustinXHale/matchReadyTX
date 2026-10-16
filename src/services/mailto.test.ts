import { describe, expect, it } from 'vitest';
import {
  groupBccMailtoHref,
  openGroupBccMailto,
} from '@/services/mailto';

describe('openGroupBccMailto', () => {
  it('does nothing without recipients', () => {
    expect(openGroupBccMailto([])).toBe(false);
  });

  it('deduplicates recipients and keeps every address in BCC', () => {
    expect(
      groupBccMailtoHref(
        ['first@example.com', 'FIRST@example.com', 'second@example.com'],
        'Referee update',
      ),
    ).toBe(
      'mailto:?bcc=first%40example.com,second%40example.com&subject=Referee%20update',
    );
  });
});
