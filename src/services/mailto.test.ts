import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  emailsClipboardText,
  gmailComposeFromMailto,
  groupBccMailtoHref,
  openGroupBccMailto,
  openGroupMailto,
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

describe('gmailComposeFromMailto', () => {
  it('wraps mailto in Gmail’s protocol-handler bridge URL', () => {
    const mailto = 'mailto:a%40b.com?subject=Hi';
    expect(gmailComposeFromMailto(mailto)).toBe(
      `https://mail.google.com/mail/?extsrc=mailto&url=${encodeURIComponent(mailto)}`,
    );
  });
});

describe('emailsClipboardText', () => {
  it('returns null when empty', () => {
    expect(emailsClipboardText([])).toBeNull();
  });

  it('deduplicates and joins with comma+space for paste', () => {
    expect(
      emailsClipboardText([
        'a@example.com',
        'A@example.com',
        'b@example.com',
      ]),
    ).toBe('a@example.com, b@example.com');
  });
});

describe('openGroupMailto launch', () => {
  const open = vi.fn();

  beforeEach(() => {
    open.mockReset();
    open.mockReturnValue({} as Window);
    vi.stubGlobal('open', open);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens Gmail compose in a new tab instead of location.href mailto', () => {
    expect(openGroupMailto(['a@example.com'], 'Kickoff')).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith('https://mail.google.com/mail/?extsrc=mailto&url=')).toBe(
      true,
    );
    expect(decodeURIComponent(url.split('url=')[1])).toContain(
      'mailto:a%40example.com',
    );
    expect(open.mock.calls[0][1]).toBe('_blank');
  });
});
