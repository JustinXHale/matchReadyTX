/**
 * Open a compose window with recipients filled in.
 *
 * Chrome installed PWAs (and sometimes regular tabs) silently ignore
 * `window.location.href = "mailto:..."`, even when Gmail is the registered
 * protocol handler. We open Gmail's own mailto bridge URL instead — the same
 * destination Chrome uses when mailto works — in a new tab.
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

/** Gmail handler URL equivalent of a mailto: href (Chrome registerProtocolHandler). */
export function gmailComposeFromMailto(mailtoHref: string): string {
  return `https://mail.google.com/mail/?extsrc=mailto&url=${encodeURIComponent(mailtoHref)}`;
}

function launchMailHref(mailtoHref: string): boolean {
  const url = gmailComposeFromMailto(mailtoHref);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup blocked — same-tab fallback (user can use Back).
    window.location.assign(url);
  }
  return true;
}

/** Opens compose with one or more addresses in To. */
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
  return launchMailHref(`mailto:${to}${params}`);
}

/**
 * Opens compose with recipients hidden in BCC.
 * Use for society-wide messages so members never see one another's addresses.
 */
export function openGroupBccMailto(
  emails: string[],
  subject?: string,
): boolean {
  const href = groupBccMailtoHref(emails, subject);
  if (!href) return false;
  return launchMailHref(href);
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

/** Comma-separated addresses for pasting into a mail app’s To/Bcc field. */
export function emailsClipboardText(emails: string[]): string | null {
  const list = uniqueEmails(emails);
  if (list.length === 0) return null;
  return list.join(', ');
}

/** Copy addresses to the clipboard. Returns false if empty or write failed. */
export async function copyEmailsToClipboard(
  emails: string[],
): Promise<boolean> {
  const text = emailsClipboardText(emails);
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
