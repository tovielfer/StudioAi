'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import {
  AdminCreditTransaction,
  AdminCreditTransactionSummary,
  CreditTransactionDirection,
  api,
} from '@/lib/api';
import { AdminShell } from '../admin-shell';

const PAGE_SIZE = 50;

type Filters = {
  search: string;
  direction: CreditTransactionDirection | '';
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  search: '',
  direction: '',
  from: '',
  to: '',
};

const EMPTY_SUMMARY: AdminCreditTransactionSummary = {
  issued: 0,
  spent: 0,
  net: 0,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatReason(reason: string) {
  if (reason === 'admin_add') return 'הוספה ידנית';
  if (reason.startsWith('purchase:order:')) return 'רכישת קרדיטים';
  if (reason.startsWith('generation:')) return 'חיוב על יצירה';
  if (reason.startsWith('refund:failed:')) return 'החזר על יצירה שנכשלה';
  return reason;
}

function StatCard({
  label,
  value,
  tone = 'brand',
}: {
  label: string;
  value: number;
  tone?: 'brand' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green-700'
      : tone === 'red'
        ? 'text-red-700'
        : 'text-brand-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${toneClass}`}>
        {value.toLocaleString('he-IL')}
      </p>
    </div>
  );
}

export default function AdminCreditTransactionsPage() {
  return (
    <AdminGuard>
      <AdminCreditTransactionsContent />
    </AdminGuard>
  );
}

function AdminCreditTransactionsContent() {
  const [items, setItems] = useState<AdminCreditTransaction[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCreditTransactions({
        search: filters.search || undefined,
        direction: filters.direction || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setSummary(res.summary);
      setTotal(res.total);
      setMessage(null);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'שגיאה בטעינת תנועות הקרדיטים',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOffset(0);
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);

  return (
    <AdminShell
      eyebrow="ניהול קרדיטים"
      title="תנועות קרדיטים"
      description="מעקב מרוכז אחרי כל הקרדיטים שנוספו, נוצלו או הוחזרו למשתמשים."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="קרדיטים שנוספו" value={summary.issued} tone="green" />
          <StatCard label="קרדיטים שנוצלו" value={summary.spent} tone="red" />
          <StatCard label="נטו" value={summary.net} />
        </section>

        <section className="admin-card">
          <form
            onSubmit={applyFilters}
            className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_180px_160px_160px_auto_auto]"
          >
            <input
              value={draftFilters.search}
              onChange={(e) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: e.target.value,
                }))
              }
              className="admin-field"
              placeholder="חיפוש לפי אימייל או סיבה"
            />
            <select
              value={draftFilters.direction}
              onChange={(e) =>
                setDraftFilters((current) => ({
                  ...current,
                  direction: e.target.value as Filters['direction'],
                }))
              }
              className="admin-field"
            >
              <option value="">כל התנועות</option>
              <option value="credit">זיכויים בלבד</option>
              <option value="debit">חיובים בלבד</option>
            </select>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(e) =>
                setDraftFilters((current) => ({
                  ...current,
                  from: e.target.value,
                }))
              }
              className="admin-field"
              aria-label="מתאריך"
            />
            <input
              type="date"
              value={draftFilters.to}
              onChange={(e) =>
                setDraftFilters((current) => ({
                  ...current,
                  to: e.target.value,
                }))
              }
              className="admin-field"
              aria-label="עד תאריך"
            />
            <button type="submit" className="btn-primary">
              סינון
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              ניקוי
            </button>
          </form>
        </section>

        <section className="admin-card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">
                יומן תנועות
              </h2>
              <p className="text-sm text-gray-500">
                {total.toLocaleString('he-IL')} תנועות נמצאו
              </p>
            </div>
            <div className="text-sm text-gray-500">
              מציג {pageStart.toLocaleString('he-IL')}-
              {pageEnd.toLocaleString('he-IL')} מתוך{' '}
              {total.toLocaleString('he-IL')}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              אין תנועות קרדיטים להצגה
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">תאריך</th>
                    <th className="py-3 pe-3 text-right">משתמש</th>
                    <th className="py-3 pe-3 text-right">סוג</th>
                    <th className="py-3 pe-3 text-right">כמות</th>
                    <th className="py-3 text-right">סיבה</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((tx) => {
                    const isCredit = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="border-b border-gray-100">
                        <td className="py-3 pe-3 text-gray-500">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="py-3 pe-3">
                          <div className="font-medium text-gray-950">
                            {tx.userEmail ?? 'משתמש ללא אימייל'}
                          </div>
                          <div className="text-xs text-gray-400">{tx.userId}</div>
                        </td>
                        <td className="py-3 pe-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              isCredit
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isCredit ? 'זיכוי' : 'חיוב'}
                          </span>
                        </td>
                        <td
                          className={`py-3 pe-3 text-base font-semibold ${
                            isCredit ? 'text-green-700' : 'text-red-700'
                          }`}
                          dir="ltr"
                        >
                          {isCredit ? '+' : ''}
                          {tx.amount.toLocaleString('he-IL')}
                        </td>
                        <td className="py-3 text-gray-800">
                          <div className="font-medium">{formatReason(tx.reason)}</div>
                          <div className="mt-1 text-xs text-gray-400">
                            {tx.reason}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              disabled={offset === 0 || loading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              הקודם
            </button>
            <button
              type="button"
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              disabled={offset + items.length >= total || loading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              הבא
            </button>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
