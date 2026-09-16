/** Email for notifications / Contacts matching — mirrors src/domain/contactEmail.ts */
export function effectiveContactEmailFromUserData(
  data: Record<string, unknown> | undefined,
): string {
  if (!data) return '';
  const signIn = String(data.email ?? '').trim();
  if (data.contactEmailSameAsSignIn === false) {
    const contact = String(data.contactEmail ?? '').trim();
    return contact || signIn;
  }
  return signIn;
}
