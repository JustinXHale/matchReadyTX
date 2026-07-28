import type { Team, UserProfile } from './types';

export type ContactRow = {
  teamName: string;
  email: string;
  phone?: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Apply Contacts-tab rows onto teams (match by name, create if missing). */
export function applyContactRowsToTeams(
  teams: Team[],
  rows: ContactRow[],
  newId: () => string,
): Team[] {
  let next = [...teams];
  for (const row of rows) {
    const name = row.teamName.trim();
    const email = normalizeEmail(row.email);
    if (!name || !email) continue;
    const idx = next.findIndex(
      (t) => t.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (idx < 0) {
      next.push({
        id: newId(),
        name,
        contactEmails: [email],
        contactPhones: row.phone?.trim() ? [row.phone.trim()] : undefined,
      });
      continue;
    }
    const t = next[idx]!;
    const emails = new Set(t.contactEmails.map(normalizeEmail));
    emails.add(email);
    const phones = new Set(t.contactPhones ?? []);
    if (row.phone?.trim()) phones.add(row.phone.trim());
    next[idx] = {
      ...t,
      contactEmails: [...emails],
      contactPhones: phones.size ? [...phones] : undefined,
    };
  }
  return next;
}

/** Link teamAdmin users to teams whose contactEmails include their email. */
export function linkTeamAdminsByEmail(
  users: UserProfile[],
  teams: Team[],
): UserProfile[] {
  const emailToTeamIds = new Map<string, string[]>();
  for (const t of teams) {
    for (const raw of t.contactEmails) {
      const e = normalizeEmail(raw);
      if (!e) continue;
      const list = emailToTeamIds.get(e) ?? [];
      if (!list.includes(t.id)) list.push(t.id);
      emailToTeamIds.set(e, list);
    }
  }

  return users.map((u) => {
    if (!u.roles.includes('teamAdmin')) return u;
    const linked = emailToTeamIds.get(normalizeEmail(u.email)) ?? [];
    if (linked.length === 0) return u;
    const teamIds = [...u.teamIds];
    let changed = false;
    for (const id of linked) {
      if (!teamIds.includes(id)) {
        teamIds.push(id);
        changed = true;
      }
    }
    return changed ? { ...u, teamIds } : u;
  });
}

/** Parse demo paste: `Team Name, email@x.com, +1555…` per line. */
export function parseContactsPaste(text: string): ContactRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        teamName: parts[0] ?? '',
        email: parts[1] ?? '',
        phone: parts[2] || undefined,
      };
    })
    .filter((r) => r.teamName && r.email);
}
