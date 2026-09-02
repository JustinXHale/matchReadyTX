export const PUBLIC_CONTACT_EMAIL = 'justinxhale@gmail.com';

/** Prefilled when users tap the footer contact link. */
export const PUBLIC_CONTACT_EMAIL_SUBJECT = 'match ready ATX';

export function publicContactMailto(): string {
  const params = new URLSearchParams({ subject: PUBLIC_CONTACT_EMAIL_SUBJECT });
  return `mailto:${PUBLIC_CONTACT_EMAIL}?${params.toString()}`;
}
