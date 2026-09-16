import { describe, expect, it } from 'vitest';
import { effectiveContactEmail, isUsableContactEmail } from '@/domain/contactEmail';

describe('contactEmail', () => {
  it('defaults to sign-in email when same-as-sign-in is unset', () => {
    expect(
      effectiveContactEmail({
        email: 'relay@privaterelay.appleid.com',
      }),
    ).toBe('relay@privaterelay.appleid.com');
  });

  it('uses contact email when user opts out of sign-in email', () => {
    expect(
      effectiveContactEmail({
        email: 'relay@privaterelay.appleid.com',
        contactEmailSameAsSignIn: false,
        contactEmail: 'coach@yahoo.com',
      }),
    ).toBe('coach@yahoo.com');
  });

  it('falls back to sign-in when custom contact is blank', () => {
    expect(
      effectiveContactEmail({
        email: 'signin@example.com',
        contactEmailSameAsSignIn: false,
        contactEmail: '',
      }),
    ).toBe('signin@example.com');
  });

  it('validates contact email shape', () => {
    expect(isUsableContactEmail('coach@yahoo.com')).toBe(true);
    expect(isUsableContactEmail('not-an-email')).toBe(false);
  });
});
