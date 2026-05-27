'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { api, User } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AdminShell } from '../admin-shell';

const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsersContent />
    </AdminGuard>
  );
}

function AdminUsersContent() {
  const { refreshCredits } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState(25);
  const [creditReason, setCreditReason] = useState('admin_add');
  const [loading, setLoading] = useState(true);
  const [savingCredits, setSavingCredits] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const res = await api.getAdminUsers({
      search: userSearch || undefined,
      limit: PAGE_SIZE,
    });
    setUsers(res.items);
    setUsersTotal(res.total);
  }, [userSearch]);

  useEffect(() => {
    setLoading(true);
    loadUsers()
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [loadUsers]);

  async function addCredits(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!creditUserId) return;

    setSavingCredits(true);
    setMessage(null);
    try {
      const res = await api.addAdminCredits(
        creditUserId,
        creditAmount,
        creditReason || undefined,
      );
      setMessage(`הקרדיטים עודכנו. יתרה חדשה: ${res.credits}`);
      await Promise.all([loadUsers(), refreshCredits()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'עדכון הקרדיטים נכשל');
    } finally {
      setSavingCredits(false);
    }
  }

  return (
    <AdminShell
      eyebrow="ניהול משתמשים"
      title="משתמשים"
      description="חיפוש משתמשים, בדיקת יתרות והוספת קרדיטים לחשבון."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="admin-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">רשימת משתמשים</h2>
              <p className="text-sm text-gray-500">
                {usersTotal.toLocaleString('he-IL')} משתמשים
              </p>
            </div>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="admin-field md:w-72"
              placeholder="חיפוש לפי אימייל"
            />
          </div>

          <form onSubmit={addCredits} className="grid md:grid-cols-4 gap-3 mb-6">
            <select
              value={creditUserId}
              onChange={(e) => setCreditUserId(e.target.value)}
              className="admin-field"
            >
              <option value="">בחירת משתמש</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              className="admin-field"
              placeholder="כמות קרדיטים"
            />
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="admin-field"
              placeholder="סיבה"
            />
            <button
              type="submit"
              disabled={!creditUserId || savingCredits}
              className="btn-primary disabled:opacity-50"
            >
              {savingCredits ? 'מעדכן...' : 'הוספת קרדיטים'}
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-right py-3">אימייל</th>
                    <th className="text-right py-3">תפקיד</th>
                    <th className="text-right py-3">קרדיטים</th>
                    <th className="text-right py-3">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100">
                      <td className="py-3 font-medium text-gray-950">{user.email}</td>
                      <td className="py-3 text-gray-600">{user.role}</td>
                      <td className="py-3 text-gray-950">{user.credits}</td>
                      <td className="py-3 text-gray-500">
                        {user.createdAt ? formatDate(user.createdAt) : '-'}
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
