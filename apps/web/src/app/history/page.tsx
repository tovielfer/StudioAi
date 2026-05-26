'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/he';

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}

function HistoryContent() {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .getUserGenerations(user.id, {
        type: filter || undefined,
        limit: 50,
      })
      .then((res) => {
        setGenerations(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [user, filter]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">היסטוריה</h1>
          <p className="text-gray-400 mt-1">{total} יצירות בסך הכל</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">כל הסוגים</option>
          <option value="image">תמונות</option>
          <option value="video">וידאו</option>
          <option value="upscale">הגדלה</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : generations.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400">לא נמצאו יצירות</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <div key={gen.id} className="card p-3 group">
              <div className="aspect-square bg-surface rounded-lg overflow-hidden mb-3 relative">
                {gen.resultUrl && gen.status === 'done' ? (
                  <img
                    src={gen.resultUrl}
                    alt={gen.prompt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                    {STATUS_LABELS[gen.status] ?? gen.status}
                  </div>
                )}
              </div>
              <p className="text-sm truncate text-gray-300" title={gen.prompt}>
                {gen.prompt}
              </p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>
                  {new Date(gen.createdAt).toLocaleDateString('he-IL')}
                </span>
                <span>{gen.creditCost} קרד&apos;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
