import { useNavigate } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { invoiceGrandTotal } from '@/domain/invoiceBuilder';
import type { ConferenceInvoice } from '@/domain/types';
import {
  formatMoney,
  invoiceStatusPillClass,
} from '@/features/finance/financeFormat';

function InvoiceListItem({ inv }: { inv: ConferenceInvoice }) {
  const navigate = useNavigate();
  const editHref = useAppHref(`/finance/invoices/${inv.id}`);
  const printHref = useAppHref(`/finance/invoices/${inv.id}/print`);
  const total = invoiceGrandTotal(
    inv.lineItems,
    inv.surchargePercent,
    inv.discountAmount,
  );

  return (
    <li className="rs-finance-panel">
      <div className="rs-finance-panel__head">
        <div className="rs-finance-panel__title">
          <strong>{inv.invoiceNumber}</strong>
          <span className={invoiceStatusPillClass(inv.status)}>
            {inv.status === 'finalized' ? 'Finalized' : 'Draft'}
          </span>
        </div>
        <div className="rs-finance-panel__actions">
          <Button variant="secondary" onClick={() => navigate(editHref)}>
            {inv.status === 'draft' ? 'Edit' : 'View'}
          </Button>
          <Button variant="link" onClick={() => navigate(printHref)}>
            Print
          </Button>
        </div>
      </div>
      <p className="rs-match-card__title">{inv.billToCompetition}</p>
      <p className="rs-match-card__meta">
        {inv.periodStart} – {inv.periodEnd} · {formatMoney(total)}
      </p>
    </li>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { state } = useApp();
  const newHref = useAppHref('/finance/invoices/new');
  const invoices = [...state.conferenceInvoices].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="rs-stack">
      <div className="rs-matches-header">
        <Title headingLevel="h1" size="lg">
          Conference invoices
        </Title>
        <Button variant="primary" onClick={() => navigate(newHref)}>
          New invoice
        </Button>
      </div>
      <p className="rs-match-card__meta">
        Bill Lonestar Men or Women monthly. Invoice rates can differ from
        official payout amounts.
      </p>

      {invoices.length === 0 ? (
        <p className="rs-match-card__meta">No invoices yet.</p>
      ) : (
        <ul className="rs-stack">
          {invoices.map((inv) => (
            <InvoiceListItem key={inv.id} inv={inv} />
          ))}
        </ul>
      )}
    </div>
  );
}
