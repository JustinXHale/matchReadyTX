import { describe, expect, it } from 'vitest';
import { refereeContactEmails } from '@/domain/members';
import type { UserProfile } from '@/domain/types';

function user(
  uid: string,
  roles: UserProfile['roles'],
  email: string,
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    uid,
    firstName: 'Test',
    lastName: 'Official',
    displayName: 'Test Official',
    email,
    phone: '',
    smsOptIn: false,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles,
    teamIds: [],
    profileComplete: true,
    ...overrides,
  };
}

describe('refereeContactEmails', () => {
  it('returns deduplicated preferred addresses for officials only', () => {
    const emails = refereeContactEmails([
      user('official-contact', ['official'], 'signin@example.com', {
        contactEmailSameAsSignIn: false,
        contactEmail: 'preferred@example.com',
      }),
      user('official-incomplete', ['official'], 'new@example.com', {
        profileComplete: false,
      }),
      user('official-duplicate', ['official'], 'PREFERRED@example.com'),
      user('cmo-only', ['cmo'], 'cmo@example.com'),
      user('invalid', ['official'], 'not-an-email'),
    ]);

    expect(emails).toEqual(['preferred@example.com', 'new@example.com']);
  });
});
