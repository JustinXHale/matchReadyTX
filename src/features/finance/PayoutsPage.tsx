import { useMemo, useState } from 'react';
import {
  Button,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { formatMatchKickoff } from '@/domain/matchTime';
import {
  buildAssignmentPayableRows,
  formatPayableMatchLabel,
  readinessLabel,
  slotLabel,
  type PaymentReadinessStatus,
} from '@/domain/paymentReadiness';
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/domain/types';
import {
  formatMoney,
  readinessPillClass,
} from '@/features/finance/financeFormat';
import { RsDateField } from '@/ui/RsDateField';

const STATUS_OPTIONS: { value: PaymentReadinessStatus | 'all'; label: string }[] =
  [
    { value: 'all', label: 'All statuses' },
    { value: 'reports_pending', label: 'Reports pending' },
    { value: 'ready_to_pay', label: 'Ready to pay' },
    { value: 'paid', label: 'Paid' },
  ];

type PayoutDraft = {
  method: PaymentMethod;
  contact: string;
  payoutFee: number;
  mileagePay: number;
};

function rowDraft(
  row: ReturnType<typeof buildAssignmentPayableRows>[number],
  drafts: Record<string, PayoutDraft>,
): PayoutDraft {
  const saved = drafts[row.id];
  if (saved) return saved;
  return {
    method: (row.payment?.paymentMethod ?? 'zelle') as PaymentMethod,
    contact: row.payment?.paymentContact ?? row.defaultPaymentContact ?? '',
    payoutFee: row.payment?.payoutFee ?? row.payoutFee,
    mileagePay: row.payment?.mileagePay ?? row.mileagePay,
  };
}

export function PayoutsPage() {
  const { state, currentUser, store, dataMode } = useApp();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [statusFilter, setStatusFilter] = useState<PaymentReadinessStatus | 'all'>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PayoutDraft>>({});

  const rows = useMemo(
    () =>
      buildAssignmentPayableRows(
        state.matches,
        state.users,
        state.matchReports,
        state.cardReports,
        state.officialPayments,
        state.org,
        { periodStart, periodEnd },
      ),
    [
      state.matches,
      state.users,
      state.matchReports,
      state.cardReports,
      state.officialPayments,
      state.org,
      periodStart,
      periodEnd,
    ],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.readiness !== statusFilter) return false;
      if (!q) return true;
      return (
        r.officialName.toLowerCase().includes(q) ||
        formatPayableMatchLabel(r).toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, search]);

  const readyTotal = useMemo(
    () =>
      filtered
        .filter((r) => r.readiness === 'ready_to_pay')
        .reduce((s, r) => {
          const draft = rowDraft(r, drafts);
          return s + draft.payoutFee + draft.mileagePay;
        }, 0),
    [filtered, drafts],
  );

  const patchDraft = (id: string, row: (typeof rows)[number], patch: Partial<PayoutDraft>) => {
    setDrafts((prev) => {
      const base = rowDraft(row, prev);
      return {
        ...prev,
        [id]: { ...base, ...patch },
      };
    });
  };

  const parseAmount = (raw: string, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const markPaid = async (row: (typeof rows)[number]) => {
    const draft = rowDraft(row, drafts);
    if (!draft.contact.trim()) return;
    setBusyId(row.id);
    try {
      await store.markOfficialPaid({
        rowId: row.id,
        matchId: row.matchId,
        officialId: row.officialId,
        slot: row.slot,
        kickoffAt: row.kickoffAt,
        payoutFee: draft.payoutFee,
        mileagePay: draft.mileagePay,
        paymentMethod: draft.method,
        paymentContact: draft.contact.trim(),
        paidByUserId: currentUser?.uid,
        paidByName: currentUser?.displayName,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Official payouts
      </Title>
      <p className="rs-match-card__meta">
        Reports must be submitted before an assignment is ready to pay. Expect
        submissions by Sunday evening; batch payments go out Monday morning.
      </p>

      <div className="rs-filter-bar rs-finance-filter-bar">
        <div className="rs-filter-bar__row">
          <label className="rs-filter-field rs-filter-field--date">
            <span className="rs-filter-field__label">From</span>
            <RsDateField
              id="finance-payout-from"
              aria-label="From"
              value={periodStart}
              onChange={(v) => setPeriodStart(v ?? periodStart)}
            />
          </label>
          <label className="rs-filter-field rs-filter-field--date">
            <span className="rs-filter-field__label">To</span>
            <RsDateField
              id="finance-payout-to"
              aria-label="To"
              value={periodEnd}
              onChange={(v) => setPeriodEnd(v ?? periodEnd)}
            />
          </label>
          <label className="rs-filter-field rs-filter-field--select">
            <span className="rs-filter-field__label">Status</span>
            <FormSelect
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(_, v) =>
                setStatusFilter(v as PaymentReadinessStatus | 'all')
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <FormSelectOption key={o.value} value={o.value} label={o.label} />
              ))}
            </FormSelect>
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Search</span>
            <TextInput
              aria-label="Search official or match"
              value={search}
              onChange={(_, v) => setSearch(v)}
              placeholder="Official or match"
            />
          </label>
        </div>
      </div>

      <div className="rs-insights-stat-grid">
        <div className="rs-insights-stat-card rs-insights-stat-card--static">
          <span className="rs-insights-stat-card__title">Ready to pay</span>
          <span className="rs-insights-stat-card__count">
            {formatMoney(readyTotal)}
          </span>
        </div>
        <div className="rs-insights-stat-card rs-insights-stat-card--static">
          <span className="rs-insights-stat-card__title">Assignments shown</span>
          <span className="rs-insights-stat-card__count">{filtered.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rs-match-card__meta">No assignments in this range.</p>
      ) : (
        <ul className="rs-stack">
          {filtered.map((row) => {
            const draft = rowDraft(row, drafts);
            const displayFee =
              row.readiness === 'paid' && row.payment
                ? row.payment.payoutFee
                : row.payoutFee;
            const displayMileage =
              row.readiness === 'paid' && row.payment
                ? row.payment.mileagePay
                : row.mileagePay;
            return (
              <li
                key={row.id}
                className={`rs-finance-panel${row.readiness === 'paid' ? ' rs-finance-panel--muted' : ''}`}
              >
                <div className="rs-finance-panel__head">
                  <div className="rs-finance-panel__title">
                    <strong>{row.officialName}</strong>
                    <span className="rs-pill">{slotLabel(row.slot)}</span>
                    <span className={readinessPillClass(row.readiness)}>
                      {readinessLabel(row.readiness)}
                    </span>
                  </div>
                </div>
                <p className="rs-match-card__title">{formatPayableMatchLabel(row)}</p>
                <p className="rs-match-card__meta">
                  {row.officialHomeCity ? `${row.officialHomeCity} · ` : ''}
                  {formatMatchKickoff(row.kickoffAt, state.org.timezone)}
                  {' · '}
                  Fee {formatMoney(displayFee)}
                  {displayMileage > 0
                    ? ` · Mileage ${formatMoney(displayMileage)}`
                    : ''}
                </p>
                {!row.matchReportSubmitted && row.readiness !== 'not_played' && (
                  <p className="rs-match-card__meta">Match report missing</p>
                )}
                {row.cardReportRequired && !row.cardReportSubmitted && (
                  <p className="rs-match-card__meta">Card report missing</p>
                )}
                {row.readiness === 'ready_to_pay' && (
                  <div className="rs-finance-panel__form rs-finance-payout-form">
                    <div className="rs-filter-bar__row rs-finance-payout-form__amount-row">
                      <label className="rs-filter-field rs-filter-field--amount">
                        <span className="rs-filter-field__label">Payment ($)</span>
                        <TextInput
                          aria-label="Payment amount"
                          type="number"
                          step="0.01"
                          value={String(draft.payoutFee)}
                          onChange={(_, v) =>
                            patchDraft(row.id, row, {
                              payoutFee: parseAmount(v, draft.payoutFee),
                            })
                          }
                        />
                      </label>
                      <label className="rs-filter-field rs-filter-field--amount">
                        <span className="rs-filter-field__label">Mileage ($)</span>
                        <TextInput
                          aria-label="Mileage amount"
                          type="number"
                          step="0.01"
                          value={String(draft.mileagePay)}
                          onChange={(_, v) =>
                            patchDraft(row.id, row, {
                              mileagePay: parseAmount(v, draft.mileagePay),
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="rs-filter-bar__row rs-finance-payout-form__pay-row">
                      <label className="rs-filter-field rs-filter-field--method">
                        <span className="rs-filter-field__label">Payment method</span>
                        <FormSelect
                          aria-label="Payment method"
                          value={draft.method}
                          onChange={(_, v) =>
                            patchDraft(row.id, row, { method: v as PaymentMethod })
                          }
                        >
                          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
                            (m) => (
                              <FormSelectOption
                                key={m}
                                value={m}
                                label={PAYMENT_METHOD_LABELS[m]}
                              />
                            ),
                          )}
                        </FormSelect>
                      </label>
                      <label className="rs-filter-field rs-filter-field--contact">
                        <span className="rs-filter-field__label">
                          Pay to (email or phone)
                        </span>
                        <TextInput
                          aria-label="Payment contact"
                          value={draft.contact}
                          onChange={(_, v) =>
                            patchDraft(row.id, row, { contact: v })
                          }
                        />
                      </label>
                    </div>
                    <div className="rs-actions">
                      <Button
                        variant="primary"
                        isDisabled={!draft.contact.trim() || busyId === row.id}
                        onClick={() => void markPaid(row)}
                      >
                        Mark paid
                      </Button>
                    </div>
                  </div>
                )}
                {row.readiness === 'paid' && row.payment && (
                  <p className="rs-match-card__meta">
                    Paid {formatMoney(row.payment.payoutFee)}
                    {row.payment.mileagePay > 0
                      ? ` + ${formatMoney(row.payment.mileagePay)} mileage`
                      : ''}{' '}
                    via{' '}
                    {row.payment.paymentMethod
                      ? PAYMENT_METHOD_LABELS[row.payment.paymentMethod]
                      : '—'}{' '}
                    to {row.payment.paymentContact ?? '—'}
                    {row.payment.paidAt
                      ? ` · ${formatMatchKickoff(row.payment.paidAt, state.org.timezone)}`
                      : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dataMode === 'demo' && (
        <p className="rs-match-card__meta">
          Demo mode — payments stay in the showcase only. Statuses update when
          officials submit reports (Referee lens) or you mark a ready assignment
          paid below. Sample rows: Finance demo — paid / ready / reports pending.
        </p>
      )}
    </div>
  );
}
