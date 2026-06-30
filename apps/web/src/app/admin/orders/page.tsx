'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { api, Order, OrderStatus } from '@/lib/api';
import { AdminShell } from '../admin-shell';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AdminOrdersPage() {
  return (
    <AdminGuard>
      <AdminOrdersContent />
    </AdminGuard>
  );
}

function AdminOrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api.getAdminOrders(statusFilter || undefined));
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שגיאה בטעינת הזמנות');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    order: Order,
    action: 'approve' | 'reject',
  ) => {
    setActingId(order.id);
    setMessage(null);
    try {
      if (action === 'approve') {
        await api.approveAdminOrder(order.id);
        setMessage(
          `אושרה רכישת ${order.credits.toLocaleString('he-IL')} קרדיטים ל-${order.userEmail ?? order.userId}`,
        );
      } else {
        await api.rejectAdminOrder(order.id);
        setMessage('ההזמנה נדחתה');
      }
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'הפעולה נכשלה');
    } finally {
      setActingId(null);
    }
  };

  const totalPending = useMemo(
    () => orders.filter((o) => o.status === 'pending').length,
    [orders],
  );

  return (
    <AdminShell
      eyebrow="ניהול רכישות"
      title="הזמנות קרדיטים"
      description="אישור או דחייה של בקשות רכישת חבילות. אישור מזכה את המשתמש בקרדיטים."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="admin-card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">הזמנות</h2>
              <p className="text-sm text-gray-500">
                {statusFilter === 'pending'
                  ? `${totalPending.toLocaleString('he-IL')} ממתינות לאישור`
                  : `${orders.length.toLocaleString('he-IL')} הזמנות`}
              </p>
            </div>
            <select
              className="admin-field md:w-56"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
            >
              <option value="pending">ממתינות</option>
              <option value="approved">אושרו</option>
              <option value="rejected">נדחו</option>
              <option value="">הכל</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-gray-500">אין הזמנות להצגה</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">תאריך</th>
                    <th className="py-3 pe-3 text-right">משתמש</th>
                    <th className="py-3 pe-3 text-right">חבילה</th>
                    <th className="py-3 pe-3 text-right">מחיר</th>
                    <th className="py-3 pe-3 text-right">קרדיטים</th>
                    <th className="py-3 pe-3 text-right">סטטוס</th>
                    <th className="py-3 text-right">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100">
                      <td className="py-3 pe-3 text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-3 pe-3 text-gray-800">
                        {order.userEmail ?? order.userId}
                      </td>
                      <td className="py-3 pe-3 text-gray-800">
                        {order.packageName}
                      </td>
                      <td className="py-3 pe-3 text-gray-800">₪{order.priceIls}</td>
                      <td className="py-3 pe-3 font-semibold text-brand-700">
                        {order.credits.toLocaleString('he-IL')}
                      </td>
                      <td className="py-3 pe-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="py-3">
                        {order.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => act(order, 'approve')}
                              disabled={actingId !== null}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                            >
                              אישור
                            </button>
                            <button
                              type="button"
                              onClick={() => act(order, 'reject')}
                              disabled={actingId !== null}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              דחייה
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {order.decidedAt ? formatDate(order.decidedAt) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
