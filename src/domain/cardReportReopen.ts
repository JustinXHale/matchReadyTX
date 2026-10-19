import type { CardReportReopenRequest } from '@/domain/types';

export function pendingCardReportReopenRequests(
  requests: CardReportReopenRequest[],
): CardReportReopenRequest[] {
  return requests.filter((r) => r.status === 'pending');
}

export function pendingReopenForReport(
  requests: CardReportReopenRequest[],
  reportId: string,
): CardReportReopenRequest | undefined {
  return requests.find(
    (r) => r.reportId === reportId && r.status === 'pending',
  );
}

export function latestReopenForReport(
  requests: CardReportReopenRequest[],
  reportId: string,
): CardReportReopenRequest | undefined {
  const forReport = requests
    .filter((r) => r.reportId === reportId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return forReport[0];
}

export function validateReopenRequestReason(reason: string): string | null {
  const t = reason.trim();
  if (!t) return 'Please explain why you need to reopen this report.';
  if (t.length > 2000) return 'Reason is too long (max 2000 characters).';
  return null;
}

export function validateDenyReason(reason: string): string | null {
  const t = reason.trim();
  if (!t) return 'A deny reason is required.';
  if (t.length > 2000) return 'Reason is too long (max 2000 characters).';
  return null;
}
