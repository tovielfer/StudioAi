'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminGuard } from '@/components/AdminGuard';
import { api, Order, OrdersSummary } from '@/lib/api';
import { AdminShell } from '../admin-shell';

const RANGE_OPTIONS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 ימים' },
  { days: 30, label: '30 יום' },
  { days: 90, label: '90 יום' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatIls(value: number) {
  return `₪${value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

/** Builds a zero-filled per-day series for the last `days` days. */
function buildChartData(summary: OrdersSummary | null) {
  if (!summary) return [] as Array<{ label: string; revenue: number }>;
  const byDate = new Map(summary.series.map((s) => [s.date, s.revenue]));
  const out: Array<{ label: string; revenue: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = summary.days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      label: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
      revenue: byDate.get(key) ?? 0,
    });
  }
  return out;
}

export default function AdminOrdersPage() {
  return (
    <AdminGuard>
      <AdminOrdersContent />
    </AdminGuard>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand-700">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function AdminOrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [tab, setTab] = useState<'success' | 'issues'>('success');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api.getAdminOrders());
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שגיאה בטעינת רכישות');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (days: number) => {
    try {
      setSummary(await api.getAdminOrdersSummary(days));
    } catch {
      // A summary failure shouldn't block the tables.
    }
  }, []);

  useEffect(() => {
    loadOrders();
    // Opening the page counts as "seeing" the new purchases → clears the badge.
    api.markAdminOrdersSeen().catch(() => {});
  }, [loadOrders]);

  useEffect(() => {
    loadSummary(rangeDays);
  }, [rangeDays, loadSummary]);

  const successOrders = useMemo(
    () => orders.filter((o) => o.status === 'approved'),
    [orders],
  );
  const issueOrders = useMemo(
    () => orders.filter((o) => o.status === 'failed' || o.status === 'pending'),
    [orders],
  );

  const chartData = useMemo(() => buildChartData(summary), [summary]);

  return (
    <AdminShell
      eyebrow="ניהול רכישות"
      title="רכישות ומכירות"
      description="סקירת הכנסות, רכישות מוצלחות ותקלות בתשלום. התשלום מתבצע אוטומטית — אין צורך לאשר ידנית."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-3">
          <StatCard label="סה״כ הכנסה" value={formatIls(summary?.totalRevenue ?? 0)} />
          <StatCard
            label="מספר רכישות"
            value={(summary?.totalOrders ?? 0).toLocaleString('he-IL')}
          />
          <StatCard
            label="ממוצע לרכישה"
            value={formatIls(summary?.avgOrder ?? 0)}
          />
        </section>

        <section className="admin-card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">הכנסה לאורך זמן</h2>
              <p className="text-sm text-gray-500">סכום הרכישות המוצלחות לפי יום</p>
            </div>
            <div className="flex gap-2">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setRangeDays(opt.days)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    rangeDays === opt.days
                      ? 'bg-brand-600 text-white'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={48}
                  tickFormatter={(v: number) => `₪${v}`}
                />
                <Tooltip
                  formatter={(value) => [formatIls(Number(value)), 'הכנסה']}
                  labelStyle={{ direction: 'rtl' }}
                  contentStyle={{ fontSize: 12, borderRadius: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-card">
          <div className="mb-4 flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('success')}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'success'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              רכישות מוצלחות ({successOrders.length.toLocaleString('he-IL')})
            </button>
            <button
              type="button"
              onClick={() => setTab('issues')}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'issues'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              תקלות ולא הושלמו ({issueOrders.length.toLocaleString('he-IL')})
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : tab === 'success' ? (
            <SuccessTable orders={successOrders} />
          ) : (
            <IssuesTable orders={issueOrders} />
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function SuccessTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-gray-500">אין רכישות להצגה</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="border-b border-gray-200 text-gray-500">
          <tr>
            <th className="py-3 pe-3 text-right">תאריך</th>
            <th className="py-3 pe-3 text-right">משתמש</th>
            <th className="py-3 pe-3 text-right">חבילה</th>
            <th className="py-3 pe-3 text-right">מחיר</th>
            <th className="py-3 pe-3 text-right">קרדיטים</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-gray-100">
              <td className="py-3 pe-3 text-gray-500">
                {formatDate(order.decidedAt || order.createdAt)}
              </td>
              <td className="py-3 pe-3 text-gray-800">
                {order.userEmail ?? order.userId}
              </td>
              <td className="py-3 pe-3 text-gray-800">{order.packageName}</td>
              <td className="py-3 pe-3 text-gray-800">₪{order.priceIls}</td>
              <td className="py-3 pe-3 font-semibold text-brand-700">
                {order.credits.toLocaleString('he-IL')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuesTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-gray-500">אין תקלות — הכול תקין</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-gray-200 text-gray-500">
          <tr>
            <th className="py-3 pe-3 text-right">תאריך</th>
            <th className="py-3 pe-3 text-right">משתמש</th>
            <th className="py-3 pe-3 text-right">חבילה</th>
            <th className="py-3 pe-3 text-right">מחיר</th>
            <th className="py-3 pe-3 text-right">מה קרה</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const failed = order.status === 'failed';
            return (
              <tr key={order.id} className="border-b border-gray-100 align-top">
                <td className="py-3 pe-3 text-gray-500">
                  {formatDate(order.failedAt || order.createdAt)}
                </td>
                <td className="py-3 pe-3 text-gray-800">
                  {order.userEmail ?? order.userId}
                </td>
                <td className="py-3 pe-3 text-gray-800">{order.packageName}</td>
                <td className="py-3 pe-3 text-gray-800">₪{order.priceIls}</td>
                <td className="py-3 pe-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      failed
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {failed ? 'נכשל בתשלום' : 'ננטש לפני תשלום'}
                  </span>
                  {failed && order.failureReason && (
                    <p className="mt-1 text-xs text-red-700">{order.failureReason}</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
