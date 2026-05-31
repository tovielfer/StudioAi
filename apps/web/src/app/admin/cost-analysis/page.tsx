'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminGeneration, api } from '@/lib/api';
import { AdminShell } from '../admin-shell';

const PAGE_SIZE = 50;

const QUALITY_LABELS: Record<string, string> = {
  fast: 'Fast',
  standard: 'Standard',
  hd: 'HD',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  replicate: 'Replicate',
  fal: 'Fal.ai',
  stability: 'Stability AI',
  mock: 'Mock',
};

function fmt(n: number) {
  return n.toLocaleString('he-IL');
}

function fmtTok(n: number | undefined) {
  if (n === undefined || n === null) return '—';
  return fmt(n);
}

export default function CostAnalysisPage() {
  return (
    <AdminGuard>
      <CostAnalysisContent />
    </AdminGuard>
  );
}

function CostAnalysisContent() {
  const [generations, setGenerations] = useState<AdminGeneration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [providerFilter, setProviderFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('done');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminGenerations({
        status: statusFilter || undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setGenerations(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [providerFilter, qualityFilter, statusFilter, search, offset]);

  useEffect(() => {
    setOffset(0);
  }, [providerFilter, qualityFilter, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = providerFilter
    ? generations.filter((g) => g.provider === providerFilter)
    : generations;

  const filteredByQ = qualityFilter
    ? filtered.filter((g) => g.quality === qualityFilter)
    : filtered;

  const totalCredits = filteredByQ.reduce((s, g) => s + (g.creditCost ?? 0), 0);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <AdminShell
      eyebrow="ניתוח עלויות"
      title="היסטוריית יצירות"
      description="כל יצירה בנפרד — קרדיטים, טוקנים, מודל, גודל ואיכות."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* ── Summary strip ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="סה״כ יצירות (כל המסד)" value={fmt(total)} />
          <StatCard
            label={`סה״כ קרדיטים (${filteredByQ.length} בדף)`}
            value={fmt(totalCredits)}
            accent
          />
          <StatCard
            label="יצירות בדף"
            value={`${filteredByQ.length} / ${fmt(total)}`}
          />
        </div>

        {/* ── Filters ───────────────────────────────────────── */}
        <div className="admin-card flex flex-wrap items-end gap-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              סטטוס
            </label>
            <select
              className="admin-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">הכל</option>
              <option value="done">הושלם</option>
              <option value="failed">נכשל</option>
              <option value="pending">ממתין</option>
              <option value="processing">בעיבוד</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              פרובידר (צד לקוח)
            </label>
            <select
              className="admin-field"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="">הכל</option>
              {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              איכות (צד לקוח)
            </label>
            <select
              className="admin-field"
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
            >
              <option value="">הכל</option>
              <option value="fast">Fast</option>
              <option value="standard">Standard</option>
              <option value="hd">HD</option>
            </select>
          </div>

          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              חיפוש (אימייל / פרומפט)
            </label>
            <input
              className="admin-field w-full"
              placeholder="חפשי..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Main table ────────────────────────────────────── */}
        <section className="admin-card">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-semibold text-gray-950">
                יצירות
              </h2>
              <span className="text-sm text-gray-500">
                עמוד {currentPage} מתוך {totalPages || 1}
              </span>
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                ← הקודם
              </button>
              <button
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                הבא →
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">תאריך</th>
                    <th className="py-3 pe-3 text-right">משתמש</th>
                    <th className="py-3 pe-3 text-right">מודל</th>
                    <th className="py-3 pe-3 text-right">גודל</th>
                    <th className="py-3 pe-3 text-right">איכות</th>
                    <th className="py-3 pe-3 text-right">פרומפט</th>
                    <th className="py-3 pe-3 text-right">כמות תמונות מקור</th>
                    <th className="py-3 pe-3 text-right">input tok</th>
                    <th className="py-3 pe-3 text-right">output tok</th>
                    <th className="py-3 pe-3 text-right">in img tok</th>
                    <th className="py-3 text-right">out img tok</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByQ.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-gray-100 align-top hover:bg-gray-50"
                    >
                      <td className="py-3 pe-3 whitespace-nowrap text-gray-500 text-xs">
                        {new Date(g.createdAt).toLocaleString('he-IL', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 pe-3 text-gray-700 text-xs max-w-[120px] truncate">
                        {g.userEmail ?? g.userId}
                      </td>
                      <td className="py-3 pe-3 text-gray-700 whitespace-nowrap">
                        <span className="font-medium">
                          {PROVIDER_LABELS[g.provider] ?? g.provider}
                        </span>
                        <br />
                        <span className="text-xs text-gray-400">{g.model}</span>
                      </td>
                      <td className="py-3 pe-3 text-gray-600 whitespace-nowrap">
                        {g.size}
                      </td>
                      <td className="py-3 pe-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {QUALITY_LABELS[g.quality] ?? g.quality}
                        </span>
                      </td>
                      <td className="py-3 pe-3 max-w-[180px]">
                        <span className="line-clamp-2 text-gray-700 text-xs">
                          {g.prompt}
                        </span>
                      </td>
                      <td className="py-3 pe-3 text-center">
                        {g.referenceImageUrls?.length ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                            {g.referenceImageUrls.length}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-600 text-xs">
                        {fmtTok(g.tokensUsed?.input_tokens)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-600 text-xs">
                        {fmtTok(g.tokensUsed?.output_tokens)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-600 text-xs">
                        {fmtTok(g.tokensUsed?.input_tokens_details?.image_tokens)}
                      </td>
                      <td className="py-3 tabular-nums text-gray-600 text-xs">
                        {fmtTok(g.tokensUsed?.output_tokens_details?.image_tokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredByQ.length === 0 && !loading && (
                <div className="border-t border-gray-100 py-12 text-center text-gray-500">
                  לא נמצאו יצירות
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-brand-200 bg-brand-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p
        className={`text-xs font-semibold ${
          accent ? 'text-brand-600' : 'text-gray-500'
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          accent ? 'text-brand-800' : 'text-gray-950'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
