import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  createDraftInvoice,
  invoiceGrandTotal,
  invoiceSubtotal,
  invoiceSurchargeAmount,
  recalcLineSubtotal,
  refreshInvoiceTotals,
} from '@/domain/invoiceBuilder';
import { defaultInvoiceFees } from '@/domain/economics';
import type { ConferenceInvoice, FeeTable } from '@/domain/types';
import {
  defaultOrgId,
  saveConferenceInvoiceInFirestore,
} from '@/services/orgData';
import { formatMoney } from '@/features/finance/financeFormat';
import { RsDateField } from '@/ui/RsDateField';

function newInvoiceId(): string {
  return `inv_${Date.now()}`;
}

export function InvoiceEditorPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const isNew = invoiceId === 'new';
  const { state, store, dataMode } = useApp();
  const navigate = useNavigate();
  const listHref = useAppHref('/finance/invoices');
  const org = state.org;
  const competitions = org.competitions?.length
    ? org.competitions
    : ['Lonestar Men', 'Lonestar Women'];

  const existing = !isNew
    ? state.conferenceInvoices.find((i) => i.id === invoiceId)
    : undefined;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [invoice, setInvoice] = useState<ConferenceInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setInvoice(existing);
      return;
    }
    if (isNew) {
      const competition = competitions[0] ?? 'Lonestar Men';
      setInvoice(
        createDraftInvoice(org, state.matches, state.users, {
          id: newInvoiceId(),
          periodStart: monthStart,
          periodEnd: today,
          billToCompetition: competition,
          billToEmail: org.financeBillToEmails?.[competition] ?? '',
          invoiceRates: defaultInvoiceFees(org),
        }),
      );
    }
  }, [existing, isNew, org, state.matches, state.users, competitions, monthStart, today]);

  const totals = useMemo(() => {
    if (!invoice) return null;
    const sub = invoiceSubtotal(invoice.lineItems);
    const surcharge = invoiceSurchargeAmount(sub, invoice.surchargePercent);
    const grand = invoiceGrandTotal(
      invoice.lineItems,
      invoice.surchargePercent,
      invoice.discountAmount,
    );
    return { sub, surcharge, grand };
  }, [invoice]);

  if (!invoice) {
    return <p className="rs-match-card__meta">Loading…</p>;
  }

  const readOnly = invoice.status === 'finalized';
  const printHref = useAppHref(`/finance/invoices/${invoice.id}/print`);

  const patchInvoice = (patch: Partial<ConferenceInvoice>) => {
    setInvoice((prev) => (prev ? refreshInvoiceTotals({ ...prev, ...patch }) : prev));
  };

  const patchRates = (slot: keyof FeeTable, value: number) => {
    patchInvoice({
      defaultInvoiceRates: {
        ...invoice.defaultInvoiceRates,
        [slot]: value,
      },
    });
  };

  const regenerateLines = () => {
    const next = createDraftInvoice(org, state.matches, state.users, {
      id: invoice.id,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      billToCompetition: invoice.billToCompetition,
      billToEmail: invoice.billToEmail,
      invoiceRates: invoice.defaultInvoiceRates,
      surchargePercent: invoice.surchargePercent,
      discountAmount: invoice.discountAmount,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
    });
    setInvoice({ ...next, createdAt: invoice.createdAt });
  };

  const patchLine = (
    index: number,
    patch: Partial<(typeof invoice.lineItems)[number]>,
  ) => {
    const lineItems = invoice.lineItems.map((line, i) =>
      i === index ? recalcLineSubtotal({ ...line, ...patch }) : line,
    );
    patchInvoice({ lineItems });
  };

  const save = async (finalize: boolean) => {
    setSaving(true);
    setError(null);
    const next: ConferenceInvoice = refreshInvoiceTotals({
      ...invoice,
      status: finalize ? 'finalized' : 'draft',
      updatedAt: new Date().toISOString(),
    });
    try {
      if (dataMode === 'live') {
        await saveConferenceInvoiceInFirestore(defaultOrgId(), next);
      } else {
        store.saveConferenceInvoice(next);
      }
      navigate(listHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        {isNew ? 'New invoice' : `Invoice ${invoice.invoiceNumber}`}
      </Title>

      <div className="rs-finance-panel">
        <Title headingLevel="h2" size="lg">
          Invoice details
        </Title>
        <div className="rs-filter-bar rs-finance-filter-bar">
          <div className="rs-filter-bar__row">
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Invoice number</span>
              <TextInput
                aria-label="Invoice number"
                value={invoice.invoiceNumber}
                isDisabled={readOnly}
                onChange={(_, v) => patchInvoice({ invoiceNumber: v })}
              />
            </label>
            <label className="rs-filter-field rs-filter-field--date">
              <span className="rs-filter-field__label">Date of issue</span>
              <RsDateField
                id="inv-issue"
                aria-label="Date of issue"
                value={invoice.issueDate}
                onChange={(v) => patchInvoice({ issueDate: v ?? invoice.issueDate })}
              />
            </label>
            <label className="rs-filter-field rs-filter-field--date">
              <span className="rs-filter-field__label">Due date</span>
              <RsDateField
                id="inv-due"
                aria-label="Due date"
                value={invoice.dueDate}
                onChange={(v) => patchInvoice({ dueDate: v ?? invoice.dueDate })}
              />
            </label>
          </div>
          <div className="rs-filter-bar__row">
            <label className="rs-filter-field rs-filter-field--select">
              <span className="rs-filter-field__label">Bill to</span>
              <FormSelect
                aria-label="Bill to competition"
                value={invoice.billToCompetition}
                isDisabled={readOnly}
                onChange={(_, v) => {
                  patchInvoice({
                    billToCompetition: v,
                    billToEmail: org.financeBillToEmails?.[v] ?? invoice.billToEmail,
                  });
                }}
              >
                {competitions.map((c) => (
                  <FormSelectOption key={c} value={c} label={c} />
                ))}
              </FormSelect>
            </label>
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Bill-to email</span>
              <TextInput
                aria-label="Bill to email"
                value={invoice.billToEmail}
                isDisabled={readOnly}
                onChange={(_, v) => patchInvoice({ billToEmail: v })}
              />
            </label>
          </div>
          <div className="rs-filter-bar__row">
            <label className="rs-filter-field rs-filter-field--date">
              <span className="rs-filter-field__label">Period from</span>
              <RsDateField
                id="inv-period-start"
                aria-label="Period from"
                value={invoice.periodStart}
                onChange={(v) =>
                  patchInvoice({ periodStart: v ?? invoice.periodStart })
                }
              />
            </label>
            <label className="rs-filter-field rs-filter-field--date">
              <span className="rs-filter-field__label">Period to</span>
              <RsDateField
                id="inv-period-end"
                aria-label="Period to"
                value={invoice.periodEnd}
                onChange={(v) => patchInvoice({ periodEnd: v ?? invoice.periodEnd })}
              />
            </label>
            {!readOnly && (
              <div className="rs-filter-field">
                <span className="rs-filter-field__label">&nbsp;</span>
                <Button variant="secondary" onClick={regenerateLines}>
                  Regenerate lines
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rs-finance-panel">
        <Title headingLevel="h2" size="lg">
          Default invoice rates
        </Title>
        <div className="rs-filter-bar rs-finance-filter-bar">
          <div className="rs-filter-bar__row rs-finance-rates-row">
            {(['mo', 'ar1', 'ar2', 'cmo'] as const).map((slot) => (
              <label key={slot} className="rs-filter-field">
                <span className="rs-filter-field__label">{slot.toUpperCase()}</span>
                <TextInput
                  aria-label={`Rate ${slot}`}
                  type="number"
                  value={String(invoice.defaultInvoiceRates[slot] ?? 0)}
                  isDisabled={readOnly}
                  onChange={(_, v) => patchRates(slot, Number(v))}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <Title headingLevel="h2" size="lg">
        Line items
      </Title>
      {invoice.lineItems.length === 0 ? (
        <p className="rs-match-card__meta">
          No played matches in this period for {invoice.billToCompetition}.
        </p>
      ) : (
        <ul className="rs-stack">
          {invoice.lineItems.map((line, index) => (
            <li
              key={`${line.matchId}-${line.slot}-${index}`}
              className="rs-finance-panel"
            >
              <p className="rs-match-card__title">{line.matchLabel}</p>
              <p className="rs-match-card__meta">{line.positionLabel}</p>
              <div className="rs-filter-bar__row">
                <label className="rs-filter-field">
                  <span className="rs-filter-field__label">Unit cost</span>
                  <TextInput
                    aria-label="Unit cost"
                    type="number"
                    value={String(line.unitCost)}
                    isDisabled={readOnly}
                    onChange={(_, v) =>
                      patchLine(index, { unitCost: Number(v) })
                    }
                  />
                </label>
                <label className="rs-filter-field">
                  <span className="rs-filter-field__label">Mileage ($)</span>
                  <TextInput
                    aria-label="Mileage amount"
                    type="number"
                    value={String(line.mileageAmount)}
                    isDisabled={readOnly}
                    onChange={(_, v) =>
                      patchLine(index, { mileageAmount: Number(v) })
                    }
                  />
                </label>
                <label className="rs-filter-field">
                  <span className="rs-filter-field__label">Subtotal</span>
                  <TextInput
                    aria-label="Line subtotal"
                    value={formatMoney(line.lineSubtotal)}
                    readOnly
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rs-finance-panel">
        <Title headingLevel="h2" size="lg">
          Adjustments
        </Title>
        <div className="rs-filter-bar rs-finance-filter-bar">
          <div className="rs-filter-bar__row">
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Surcharge (%)</span>
              <TextInput
                aria-label="Surcharge percent"
                type="number"
                value={String(invoice.surchargePercent)}
                isDisabled={readOnly}
                onChange={(_, v) =>
                  patchInvoice({ surchargePercent: Number(v) })
                }
              />
            </label>
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Discount ($)</span>
              <TextInput
                aria-label="Discount amount"
                type="number"
                value={String(invoice.discountAmount)}
                isDisabled={readOnly}
                onChange={(_, v) =>
                  patchInvoice({ discountAmount: Number(v) })
                }
              />
            </label>
          </div>
        </div>
      </div>

      {totals && (
        <div className="rs-insights-stat-grid">
          <div className="rs-insights-stat-card rs-insights-stat-card--static">
            <span className="rs-insights-stat-card__title">Subtotal</span>
            <span className="rs-insights-stat-card__count">
              {formatMoney(totals.sub)}
            </span>
          </div>
          <div className="rs-insights-stat-card rs-insights-stat-card--static">
            <span className="rs-insights-stat-card__title">Surcharge</span>
            <span className="rs-insights-stat-card__count">
              {formatMoney(totals.surcharge)}
            </span>
          </div>
          <div className="rs-insights-stat-card rs-insights-stat-card--static">
            <span className="rs-insights-stat-card__title">Grand total</span>
            <span className="rs-insights-stat-card__count">
              {formatMoney(totals.grand)}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}

      <div className="rs-actions">
        <Button variant="link" onClick={() => navigate(listHref)}>
          Back to list
        </Button>
        <Button variant="secondary" onClick={() => navigate(printHref)}>
          Print preview
        </Button>
        {!readOnly && (
          <>
            <Button
              variant="secondary"
              isDisabled={saving}
              onClick={() => void save(false)}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              isDisabled={saving}
              onClick={() => void save(true)}
            >
              Finalize
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
