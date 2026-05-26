'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/he';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    done: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, refreshCredits } = useAuth();
  const [recent, setRecent] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    refreshCredits();
    api
      .getUserGenerations(user.id, { limit: 6 })
      .then((res) => setRecent(res.items))
      .finally(() => setLoading(false));
  }, [user, refreshCredits]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">לוח בקרה</h1>
          <p className="text-gray-400 mt-1">שלום, {user?.email}</p>
        </div>
        <Link href="/create" className="btn-primary">
          + יצירת תמונה
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="card">
          <p className="text-sm text-gray-400">יתרת קרדיטים</p>
          <p className="text-3xl font-bold mt-1 text-brand-400">
            {user?.credits ?? 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">תמונה רגילה</p>
          <p className="text-3xl font-bold mt-1">5</p>
          <p className="text-xs text-gray-500">קרדיטים לתמונה</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">תמונת HD</p>
          <p className="text-3xl font-bold mt-1">10</p>
          <p className="text-xs text-gray-500">קרדיטים לתמונה</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">יצירות אחרונות</h2>
          <Link href="/history" className="text-sm text-brand-400 hover:underline">
            הצג הכל
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 mb-4">עדיין אין יצירות</p>
            <Link href="/create" className="btn-primary">
              צור את התמונה הראשונה שלך
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recent.map((gen) => (
              <div key={gen.id} className="card p-3">
                <div className="aspect-square bg-surface rounded-lg overflow-hidden mb-3">
                  {gen.resultUrl && gen.status === 'done' ? (
                    <img
                      src={gen.resultUrl}
                      alt={gen.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      {gen.status === 'processing' || gen.status === 'pending' ? (
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        '—'
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm truncate text-gray-300">{gen.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <StatusBadge status={gen.status} />
                  <span className="text-xs text-gray-500">{gen.model}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
