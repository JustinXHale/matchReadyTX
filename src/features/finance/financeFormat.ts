import type { ConferenceInvoiceStatus } from '@/domain/types';
import type { PaymentReadinessStatus } from '@/domain/paymentReadiness';

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function readinessPillClass(status: PaymentReadinessStatus): string {
  switch (status) {
    case 'ready_to_pay':
      return 'rs-pill rs-pill--ok';
    case 'reports_pending':
      return 'rs-pill rs-pill--warn';
    case 'paid':
      return 'rs-pill rs-pill--quiet';
    default:
      return 'rs-pill';
  }
}

export function invoiceStatusPillClass(status: ConferenceInvoiceStatus): string {
  return status === 'finalized'
    ? 'rs-pill rs-pill--ok'
    : 'rs-pill rs-pill--warn';
}
