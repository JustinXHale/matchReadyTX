/**
 * Open the device mail app with recipients in To.
 * Works in browser and installed PWAs (hands off to the default mail client).
 */

export function uniqueEmails(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Opens the default mail app with one or more addresses in To. */
export function openGroupMailto(
  emails: string[],
  subject?: string,
): boolean {
  const list = uniqueEmails(emails);
  if (list.length === 0) return false;
  const to = list.map(encodeURIComponent).join(',');
  const params = subject?.trim()
    ? `?subject=${encodeURIComponent(subject.trim())}`
    : '';
  window.location.href = `mailto:${to}${params}`;
  return true;
}

/**
 * Opens the default mail app with recipients hidden in BCC.
 * Use for society-wide messages so members never see one another's addresses.
 */
export function openGroupBccMailto(
  emails: string[],
  subject?: string,
): boolean {
  const href = groupBccMailtoHref(emails, subject);
  if (!href) return false;
  window.location.href = href;
  return true;
}

/** Build a privacy-safe group email link without changing browser location. */
export function groupBccMailtoHref(
  emails: string[],
  subject?: string,
): string | null {
  const list = uniqueEmails(emails);
  if (list.length === 0) return null;
  const bcc = list.map(encodeURIComponent).join(',');
  const subjectParam = subject?.trim()
    ? `&subject=${encodeURIComponent(subject.trim())}`
    : '';
  return `mailto:?bcc=${bcc}${subjectParam}`;
}
