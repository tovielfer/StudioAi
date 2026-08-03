'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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

/** How each non-successful order status is shown in the issues table. */
const ISSUE_BADGES: Record<string, { label: string; className: string }> = {
  failed: { label: 'נכשל בתשלום', className: 'bg-red-100 text-red-800' },
  pending: { label: 'נתקע / ננטש לפני תשלום', className: 'bg-amber-100 text-amber-800' },
  rejected: { label: 'נדחה', className: 'bg-gray-200 text-gray-700' },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatIls(value: number) {
  return `₪${value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

// The chart buckets purchases by Israel calendar day. We compute the day key in
// Asia/Jerusalem explicitly (not the viewer's local timezone) so the bars and
// the click-to-drill breakdown always agree with the backend, regardless of
// where the admin is browsing from.
const IL_TIME_ZONE = 'Asia/Jerusalem';
const ilDayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Returns the 'YYYY-MM-DD' Israel-local day for a given instant. */
function ilDayKey(date: Date) {
  return ilDayKeyFormatter.format(date);
}

type ChartPoint = { key: string; label: string; revenue: number; count: number };

/** Builds a zero-filled per-day series for the last `days` days (Israel time). */
function buildChartData(summary: OrdersSummary | null): ChartPoint[] {
  if (!summary) return [];
  const byDate = new Map(summary.series.map((s) => [s.date, s]));
  const out: ChartPoint[] = [];
  // Anchor at the current Israel calendar day, then walk back day-by-day using
  // a UTC-noon anchor so DST transitions can't duplicate or skip a day.
  const [y, m, d] = ilDayKey(new Date()).split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  for (let i = summary.days - 1; i >= 0; i--) {
    const day = new Date(anchor);
    day.setUTCDate(day.getUTCDate() - i);
    const mm = String(day.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(day.getUTCDate()).padStart(2, '0');
    const key = `${day.getUTCFullYear()}-${mm}-${dd}`;
    const entry = byDate.get(key);
    out.push({
      key,
      label: `${dd}.${mm}`,
      revenue: entry?.revenue ?? 0,
      count: entry?.count ?? 0,
    });
  }
  return out;
}

/** Israel-local YYYY-MM-DD key for an order, matching the chart's day buckets. */
function orderDayKey(order: Order) {
  return ilDayKey(new Date(order.decidedAt || order.createdAt));
}

/** Custom tooltip showing both revenue and purchase count for a day. */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
    >
      <p className="font-semibold text-gray-900">{point.label}</p>
      <p className="mt-1 text-brand-700">{formatIls(point.revenue)}</p>
      <p className="text-gray-500">
        {point.count.toLocaleString('he-IL')} רכישות
      </p>
      {point.count > 0 && (
        <p className="mt-1 text-gray-400">לחצו לפירוט הרכישות</p>
      )}
    </div>
  );
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
  // Everything that isn't a completed purchase belongs here: failed charges,
  // abandoned/"stuck" pending attempts, and rejected orders — so nothing is
  // silently hidden from the admin.
  const issueOrders = useMemo(
    () => orders.filter((o) => o.status !== 'approved'),
    [orders],
  );

  const chartData = useMemo(() => buildChartData(summary), [summary]);

  // Selecting a bar drills into that day's purchases, grouped by package/price
  // so the admin sees "how many purchases of how much each".
  const dayBreakdown = useMemo(() => {
    if (!selectedDay) return null;
    const dayOrders = successOrders.filter((o) => orderDayKey(o) === selectedDay);
    const groups = new Map<
      string,
      { packageName: string; priceIls: number; count: number }
    >();
    for (const order of dayOrders) {
      const groupKey = `${order.packageName}|${order.priceIls}`;
      const existing = groups.get(groupKey);
      if (existing) existing.count += 1;
      else
        groups.set(groupKey, {
          packageName: order.packageName,
          priceIls: order.priceIls,
          count: 1,
        });
    }
    const rows = Array.from(groups.values()).sort(
      (a, b) => b.priceIls * b.count - a.priceIls * a.count,
    );
    const totalRevenue = dayOrders.reduce((sum, o) => sum + o.priceIls, 0);
    const label =
      chartData.find((p) => p.key === selectedDay)?.label ?? selectedDay;
    return { rows, totalRevenue, totalCount: dayOrders.length, label };
  }, [selectedDay, successOrders, chartData]);

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
              <p className="text-sm text-gray-500">
                סכום הרכישות המוצלחות לפי יום · לחצו על עמודה לפירוט הרכישות
              </p>
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
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 8, bottom: 0, left: 8 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₪${v}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
                  content={<ChartTooltip />}
                />
                <Bar
                  dataKey="revenue"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                  cursor="pointer"
                  onClick={(data: unknown) => {
                    const point = data as ChartPoint | undefined;
                    if (point?.key) {
                      setSelectedDay((curr) =>
                        curr === point.key ? null : point.key,
                      );
                    }
                  }}
                >
                  {chartData.map((point) => (
                    <Cell
                      key={point.key}
                      fill={point.key === selectedDay ? '#5b21b6' : '#7c3aed'}
                    />
                  ))}
                  {chartData.length <= 14 && (
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      formatter={(value) =>
                        Number(value) > 0 ? formatIls(Number(value)) : ''
                      }
                      style={{ fill: '#4b5563', fontSize: 10, fontWeight: 600 }}
                    />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {dayBreakdown && (
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    רכישות בתאריך {dayBreakdown.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dayBreakdown.totalCount.toLocaleString('he-IL')} רכישות ·{' '}
                    {formatIls(dayBreakdown.totalRevenue)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  סגירה
                </button>
              </div>
              {dayBreakdown.rows.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">
                  אין רכישות מוצלחות ביום זה
                </p>
              ) : (
                <ul className="space-y-2">
                  {dayBreakdown.rows.map((row) => (
                    <li
                      key={`${row.packageName}-${row.priceIls}`}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-gray-800">
                        {row.count.toLocaleString('he-IL')} × {row.packageName}
                      </span>
                      <span className="text-gray-500">
                        {formatIls(row.priceIls)} כל אחת ·{' '}
                        <span className="font-semibold text-brand-700">
                          {formatIls(row.priceIls * row.count)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
            const badge = ISSUE_BADGES[order.status] ?? {
              label: order.status,
              className: 'bg-gray-100 text-gray-600',
            };
            return (
              <tr key={order.id} className="border-b border-gray-100 align-top">
                <td className="py-3 pe-3 text-gray-500">
                  {formatDate(order.failedAt || order.decidedAt || order.createdAt)}
                </td>
                <td className="py-3 pe-3 text-gray-800">
                  {order.userEmail ?? order.userId}
                </td>
                <td className="py-3 pe-3 text-gray-800">{order.packageName}</td>
                <td className="py-3 pe-3 text-gray-800">₪{order.priceIls}</td>
                <td className="py-3 pe-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {order.status === 'failed' && order.failureReason && (
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
