import { describe, expect, it } from 'vitest';
import { isMissingRedirectStateError } from '@/services/auth';

describe('isMissingRedirectStateError', () => {
  it('detects Firebase redirect state loss', () => {
    expect(
      isMissingRedirectStateError(
        new Error(
          'Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible or accidentally cleared.',
        ),
      ),
    ).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isMissingRedirectStateError(new Error('auth/popup-blocked'))).toBe(
      false,
    );
  });
});
