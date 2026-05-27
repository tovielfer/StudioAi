'use client';

import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminStats, api } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/he';
import { AdminShell } from './admin-shell';

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
    <div className="admin-card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1 text-brand-700">
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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getAdminStats()
      .then(setStats)
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = stats?.generationsByStatus ?? {};

  return (
    <AdminShell
      eyebrow="ניהול מערכת"
      title="ממשק ניהול"
      description="סקירה מהירה של משתמשים, קרדיטים וסטטוס היצירות במערכת."
    >
      {message && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-6">
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

              <div className="admin-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-950">
                      מצב יצירות
                    </h2>
                    <p className="text-sm text-gray-500">
                      חלוקה לפי סטטוסים פעילים במערכת
                    </p>
                  </div>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  {['pending', 'processing', 'done', 'failed'].map((status) => (
                    <div
                      key={status}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                    >
                      <p className="text-sm text-gray-500">
                        {STATUS_LABELS[status] ?? status}
                      </p>
                      <p className="text-2xl font-semibold mt-1 text-gray-950">
                        {(statusCounts[status] ?? 0).toLocaleString('he-IL')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
        </div>
      )}
    </AdminShell>
  );
}
