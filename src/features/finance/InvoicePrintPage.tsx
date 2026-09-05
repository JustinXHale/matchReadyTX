import { useNavigate, useParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  groupInvoiceLinesForPrint,
  invoiceGrandTotal,
  invoiceSubtotal,
  invoiceSurchargeAmount,
} from '@/domain/invoiceBuilder';
import { formatMatchKickoffDate } from '@/domain/matchTime';
import { formatMoney } from '@/features/finance/financeFormat';
import { BrandLogo } from '@/ui/BrandLogo';

export function InvoicePrintPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { state } = useApp();
  const invoice = state.conferenceInvoices.find((i) => i.id === invoiceId);
  const editHref = useAppHref(`/finance/invoices/${invoiceId ?? ''}`);
  const listHref = useAppHref('/finance/invoices');

  if (!invoice) {
    return (
      <div className="rs-stack">
        <p className="rs-match-card__meta">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate(listHref)}>
          Back to invoices
        </Button>
      </div>
    );
  }

  const groups = groupInvoiceLinesForPrint(invoice.lineItems);
  const sub = invoiceSubtotal(invoice.lineItems);
  const surcharge = invoiceSurchargeAmount(sub, invoice.surchargePercent);
  const grand = invoiceGrandTotal(
    invoice.lineItems,
    invoice.surchargePercent,
    invoice.discountAmount,
  );

  return (
    <div className="rs-stack">
      <div className="rs-finance-no-print rs-actions">
        <Button variant="link" onClick={() => navigate(editHref)}>
          Edit invoice
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>

      <article className="rs-finance-print">
        <header className="rs-finance-print__header">
          <div>
            <BrandLogo />
            <Title headingLevel="h1" size="2xl">
              Invoice
            </Title>
          </div>
          <div>
            <p className="rs-match-card__meta">
              <strong>Invoice Number:</strong> {invoice.invoiceNumber}
            </p>
            <p className="rs-match-card__meta">
              <strong>Date of Issue:</strong> {invoice.issueDate}
            </p>
            <p className="rs-match-card__meta">
              <strong>Due Date:</strong> {invoice.dueDate}
            </p>
          </div>
        </header>

        <section className="rs-stack">
          <Title headingLevel="h2" size="md">
            Bill to
          </Title>
          <p className="rs-match-card__title">{invoice.billToCompetition}</p>
          <p className="rs-match-card__meta">{invoice.billToEmail}</p>
          <p className="rs-match-card__meta">
            Period: {invoice.periodStart} – {invoice.periodEnd}
          </p>
        </section>

        <table className="rs-finance-print__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Match — Tier</th>
              <th>Position(s)</th>
              <th className="rs-finance-print__num">Cost</th>
              <th className="rs-finance-print__num">Mileage</th>
              <th className="rs-finance-print__num">Sub-total</th>
              <th className="rs-finance-print__num">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.lines.map((line, lineIndex) => (
                <tr key={`${group.matchId}-${line.slot}-${lineIndex}`}>
                  {lineIndex === 0 && (
                    <>
                      <td rowSpan={group.lines.length}>
                        {formatMatchKickoffDate(
                          group.kickoffAt,
                          state.org.timezone,
                          {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </td>
                      <td rowSpan={group.lines.length}>{group.matchLabel}</td>
                    </>
                  )}
                  <td>{line.positionLabel}</td>
                  <td className="rs-finance-print__num">
                    {formatMoney(line.unitCost)}
                    {line.count > 1 ? ` × ${line.count}` : ''}
                  </td>
                  <td className="rs-finance-print__num">
                    {line.mileageAmount > 0
                      ? formatMoney(line.mileageAmount)
                      : '—'}
                  </td>
                  <td className="rs-finance-print__num">
                    {formatMoney(line.lineSubtotal)}
                  </td>
                  {lineIndex === 0 && (
                    <td
                      className="rs-finance-print__num"
                      rowSpan={group.lines.length}
                    >
                      {formatMoney(group.matchSubtotal)}
                    </td>
                  )}
                </tr>
              )),
            )}
          </tbody>
        </table>

        <div className="rs-finance-print__totals">
          <table>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td>{formatMoney(sub)}</td>
              </tr>
              <tr>
                <td>Surcharge ({invoice.surchargePercent}%)</td>
                <td>{formatMoney(surcharge)}</td>
              </tr>
              <tr>
                <td>Discount</td>
                <td>{formatMoney(invoice.discountAmount)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Grand total</strong>
                </td>
                <td>
                  <strong>{formatMoney(grand)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
