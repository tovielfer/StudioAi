'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import {
  AdminGeneration,
  AdminStats,
  api,
  User,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { STATUS_LABELS } from '@/lib/he';

const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold mt-1 text-brand-400">
        {value.toLocaleString('he-IL')}
      </p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}

function AdminContent() {
  const { refreshCredits } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [generations, setGenerations] = useState<AdminGeneration[]>([]);
  const [generationsTotal, setGenerationsTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [generationSearch, setGenerationSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState(25);
  const [creditReason, setCreditReason] = useState('admin_add');
  const [loading, setLoading] = useState(true);
  const [savingCredits, setSavingCredits] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const nextStats = await api.getAdminStats();
    setStats(nextStats);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await api.getAdminUsers({
      search: userSearch || undefined,
      limit: PAGE_SIZE,
    });
    setUsers(res.items);
    setUsersTotal(res.total);
  }, [userSearch]);

  const loadGenerations = useCallback(async () => {
    const res = await api.getAdminGenerations({
      search: generationSearch || undefined,
      status: statusFilter || undefined,
      limit: PAGE_SIZE,
    });
    setGenerations(res.items);
    setGenerationsTotal(res.total);
  }, [generationSearch, statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadGenerations()])
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [loadStats, loadUsers, loadGenerations]);

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
      await Promise.all([loadStats(), loadUsers(), refreshCredits()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'עדכון הקרדיטים נכשל');
    } finally {
      setSavingCredits(false);
    }
  }

  const statusCounts = stats?.generationsByStatus ?? {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ממשק ניהול</h1>
        <p className="text-gray-400 mt-1">
          ניהול משתמשים, קרדיטים ויצירות במערכת
        </p>
      </div>

      {message && (
        <div className="card mb-6 border-brand-500/40 text-sm text-gray-200">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="grid md:grid-cols-4 gap-6">
              <StatCard label="משתמשים" value={stats?.usersTotal ?? 0} />
              <StatCard label="יצירות" value={stats?.generationsTotal ?? 0} />
              <StatCard
                label="קרדיטים שנוספו"
                value={stats?.creditsIssued ?? 0}
              />
              <StatCard
                label="קרדיטים שנוצלו"
                value={stats?.creditsSpent ?? 0}
              />
            </div>
            <div className="grid md:grid-cols-4 gap-4 mt-4">
              {['pending', 'processing', 'done', 'failed'].map((status) => (
                <div key={status} className="card py-4">
                  <p className="text-sm text-gray-400">
                    {STATUS_LABELS[status] ?? status}
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    {(statusCounts[status] ?? 0).toLocaleString('he-IL')}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">משתמשים</h2>
                <p className="text-sm text-gray-400">
                  {usersTotal.toLocaleString('he-IL')} משתמשים
                </p>
              </div>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input-field md:w-72"
                placeholder="חיפוש לפי אימייל"
              />
            </div>

            <form onSubmit={addCredits} className="grid md:grid-cols-4 gap-3 mb-6">
              <select
                value={creditUserId}
                onChange={(e) => setCreditUserId(e.target.value)}
                className="input-field"
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
                className="input-field"
                placeholder="כמות קרדיטים"
              />
              <input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="input-field"
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400 border-b border-surface-border">
                  <tr>
                    <th className="text-right py-3">אימייל</th>
                    <th className="text-right py-3">תפקיד</th>
                    <th className="text-right py-3">קרדיטים</th>
                    <th className="text-right py-3">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-surface-border/60">
                      <td className="py-3">{user.email}</td>
                      <td className="py-3">{user.role}</td>
                      <td className="py-3">{user.credits}</td>
                      <td className="py-3 text-gray-400">
                        {user.createdAt ? formatDate(user.createdAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">יצירות</h2>
                <p className="text-sm text-gray-400">
                  {generationsTotal.toLocaleString('he-IL')} יצירות
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  value={generationSearch}
                  onChange={(e) => setGenerationSearch(e.target.value)}
                  className="input-field md:w-72"
                  placeholder="חיפוש לפי אימייל או פרומפט"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field md:w-44"
                >
                  <option value="">כל הסטטוסים</option>
                  <option value="pending">ממתין</option>
                  <option value="processing">בעיבוד</option>
                  <option value="done">הושלם</option>
                  <option value="failed">נכשל</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400 border-b border-surface-border">
                  <tr>
                    <th className="text-right py-3">משתמש</th>
                    <th className="text-right py-3">פרומפט</th>
                    <th className="text-right py-3">סטטוס</th>
                    <th className="text-right py-3">מודל</th>
                    <th className="text-right py-3">קרדיטים</th>
                    <th className="text-right py-3">תוצאה</th>
                    <th className="text-right py-3">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((generation) => (
                    <tr
                      key={generation.id}
                      className="border-b border-surface-border/60 align-top"
                    >
                      <td className="py-3 text-gray-300">
                        {generation.userEmail ?? generation.userId}
                      </td>
                      <td className="py-3 max-w-xs">
                        <span className="line-clamp-2">{generation.prompt}</span>
                      </td>
                      <td className="py-3">
                        {STATUS_LABELS[generation.status] ?? generation.status}
                      </td>
                      <td className="py-3 text-gray-400">
                        {generation.provider}/{generation.model}
                      </td>
                      <td className="py-3">{generation.creditCost}</td>
                      <td className="py-3">
                        {generation.resultUrl ? (
                          <a
                            href={generation.resultUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-400 hover:underline"
                          >
                            פתיחה
                          </a>
                        ) : (
                          <span className="text-gray-500">אין</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-400">
                        {formatDate(generation.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
