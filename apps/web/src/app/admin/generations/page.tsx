'use client';

import { useCallback, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminGeneration, api } from '@/lib/api';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { STATUS_LABELS } from '@/lib/he';
import { AdminShell } from '../admin-shell';
import { AdminGenerationCard } from './_components/AdminGenerationCard';
import { AdminGenerationModal } from './_components/AdminGenerationModal';

const PAGE_SIZE = 25;

type ViewMode = 'table' | 'cards';

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatTokens(value: number | undefined) {
  return typeof value === 'number' ? value.toLocaleString('he-IL') : '-';
}

function formatUsd(value: number | null | undefined) {
  return typeof value === 'number' ? `$${value.toFixed(4)}` : '-';
}

export default function AdminGenerationsPage() {
  return (
    <AdminGuard>
      <AdminGenerationsContent />
    </AdminGuard>
  );
}

function AdminGenerationsContent() {
  const [generationSearch, setGenerationSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [onlyDeleted, setOnlyDeleted] = useState(false);
  const [view, setView] = useState<ViewMode>('cards');
  const [selected, setSelected] = useState<AdminGeneration | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPage = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      api.getAdminGenerations({
        search: generationSearch || undefined,
        status: statusFilter || undefined,
        onlyDeleted: onlyDeleted || undefined,
        limit,
        offset,
      }),
    [generationSearch, statusFilter, onlyDeleted],
  );

  const {
    items: generations,
    setItems: setGenerations,
    total: generationsTotal,
    setTotal: setGenerationsTotal,
    loading,
    loadingMore,
    hasMore,
    error: message,
    sentinelRef,
  } = useInfiniteList<AdminGeneration>(fetchPage, { pageSize: PAGE_SIZE });

  const handleGenerationUpdated = useCallback(
    (updated: AdminGeneration) => {
      setGenerations((prev) =>
        prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
      );
      setSelected((curr) =>
        curr && curr.id === updated.id ? { ...curr, ...updated } : curr,
      );
    },
    [setGenerations],
  );

  const removeGenerations = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setGenerations((prev) => prev.filter((g) => !idSet.has(g.id)));
      setGenerationsTotal((prev) => Math.max(0, prev - ids.length));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [setGenerations, setGenerationsTotal],
  );

  const toggleSelect = useCallback((gen: AdminGeneration) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gen.id)) next.delete(gen.id);
      else next.add(gen.id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (bulkDeleting || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (
      !window.confirm(
        `למחוק לצמיתות ${ids.length} יצירות? הפעולה תסיר את הרשומות ואת הקבצים המאוחסנים ואינה הפיכה.`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setActionError(null);
    try {
      const res = await api.hardDeleteAdminGenerations(ids);
      removeGenerations(res.ids ?? ids);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'מחיקת היצירות נכשלה',
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleting, selectedIds, removeGenerations]);

  return (
    <AdminShell
      eyebrow="ניהול יצירות"
      title="יצירות"
      description="טבלת מעקב מסודרת עם עלות טוקנים ונתוני tokensUsed לכל יצירה."
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
              <h2 className="text-xl font-semibold text-gray-950">טבלת יצירות</h2>
              <p className="text-sm text-gray-500">
                {generationsTotal.toLocaleString('he-IL')} יצירות
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === 'table'
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  טבלה
                </button>
                <button
                  type="button"
                  onClick={() => setView('cards')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === 'cards'
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  כרטיסים
                </button>
              </div>
              <input
                value={generationSearch}
                onChange={(e) => setGenerationSearch(e.target.value)}
                className="admin-field md:w-72"
                placeholder="חיפוש לפי אימייל או פרומפט"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-field md:w-44"
              >
                <option value="">כל הסטטוסים</option>
                <option value="pending">ממתין</option>
                <option value="processing">בעיבוד</option>
                <option value="done">הושלם</option>
                <option value="failed">נכשל</option>
                <option value="cancelled">בוטל</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setOnlyDeleted((v) => !v);
                  setSelectedIds(new Set());
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  onlyDeleted
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                מחוקות בלבד
              </button>
            </div>
          </div>

          {(selectedIds.size > 0 || actionError) && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-red-800">
                {selectedIds.size > 0
                  ? `נבחרו ${selectedIds.size} יצירות למחיקה לצמיתות`
                  : null}
                {actionError && (
                  <span className="block font-medium">{actionError}</span>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    נקה בחירה
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {bulkDeleting
                      ? 'מוחק...'
                      : `מחק לצמיתות (${selectedIds.size})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : view === 'cards' ? (
            generations.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                לא נמצאו יצירות לפי הסינון הנוכחי
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {generations.map((generation) => (
                  <AdminGenerationCard
                    key={generation.id}
                    gen={generation}
                    onSelect={setSelected}
                    selectable
                    selected={selectedIds.has(generation.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="w-10 py-3 pe-2" aria-label="בחירה" />
                    <th className="text-right py-3 pe-4">משתמש</th>
                    <th className="text-right py-3 pe-4">פרומפט</th>
                    <th className="text-right py-3 pe-4">סטטוס</th>
                    <th className="text-right py-3 pe-4">מודל</th>
                    <th className="text-right py-3 pe-4">עלות טוקנים</th>
                    <th className="text-right py-3 pe-4">עלות בפועל ($)</th>
                    <th className="text-right py-3 pe-4">tokensUsed</th>
                    <th className="text-right py-3 pe-4">יחס תמונה</th>
                    <th className="text-right py-3 pe-4">רזולוציה</th>
                    <th className="text-right py-3 pe-4">איכות יצירה</th>
                    <th className="text-right py-3 pe-4">תמונת מקור</th>
                    <th className="text-right py-3 pe-4">תוצאה</th>
                    <th className="text-right py-3">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((generation) => (
                    <tr
                      key={generation.id}
                      className="border-b border-gray-100 align-top hover:bg-gray-50"
                    >
                      <td className="py-3 pe-2 text-center">
                        {generation.deletedAt && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(generation.id)}
                            onChange={() => toggleSelect(generation)}
                            className="h-4 w-4 cursor-pointer accent-red-600"
                            aria-label="בחר יצירה למחיקה לצמיתות"
                          />
                        )}
                      </td>
                      <td className="py-3 pe-4 font-medium text-gray-950">
                        <div className="flex items-center gap-2">
                          <span>{generation.userEmail ?? generation.userId}</span>
                          {generation.deletedAt && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              נמחקה
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pe-4 max-w-xs text-gray-700">
                        <span className="line-clamp-2">{generation.prompt}</span>
                      </td>
                      <td className="py-3 pe-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {STATUS_LABELS[generation.status] ?? generation.status}
                        </span>
                      </td>
                      <td className="py-3 pe-4 text-gray-600">
                        {generation.provider}/{generation.model}
                      </td>
                      <td className="py-3 pe-4">
                        <span className="inline-flex min-w-16 justify-center rounded-lg bg-brand-50 px-3 py-1.5 font-bold text-brand-800">
                          {generation.creditCost.toLocaleString('he-IL')}
                        </span>
                      </td>
                      <td className="py-3 pe-4 font-medium text-gray-900">
                        {formatUsd(generation.actualCostUsd)}
                      </td>
                      <td className="py-3 pe-4 text-gray-700">
                        <div className="font-semibold text-gray-950">
                          {formatTokens(generation.tokensUsed?.total_tokens)}
                        </div>
                        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                          <div>
                            input {formatTokens(generation.tokensUsed?.input_tokens)} · output{' '}
                            {formatTokens(generation.tokensUsed?.output_tokens)}
                          </div>
                          <div>
                            input text{' '}
                            {formatTokens(generation.tokensUsed?.input_tokens_details?.text_tokens)} · image{' '}
                            {formatTokens(generation.tokensUsed?.input_tokens_details?.image_tokens)}
                          </div>
                          <div>
                            output text{' '}
                            {formatTokens(generation.tokensUsed?.output_tokens_details?.text_tokens)} · image{' '}
                            {formatTokens(generation.tokensUsed?.output_tokens_details?.image_tokens)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pe-4 text-gray-600">{generation.size}</td>
                      <td className="py-3 pe-4 text-gray-600">
                        {generation.resolution}
                      </td>
                      <td className="py-3 pe-4 text-gray-600">
                        {generation.quality}
                      </td>
                      <td className="py-3 pe-4">
                        {generation.referenceImageUrls?.[0] ? (
                          <a
                            href={generation.referenceImageUrls[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-brand-700 hover:underline"
                          >
                            <img
                              src={generation.referenceImageUrls[0]}
                              alt="תמונת מקור"
                              className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                            />
                            פתיחה
                          </a>
                        ) : (
                          <span className="text-gray-400">אין</span>
                        )}
                      </td>
                      <td className="py-3 pe-4">
                        {generation.resultUrl ? (
                          <a
                            href={generation.resultUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            פתיחה
                          </a>
                        ) : (
                          <span className="text-gray-400">אין</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {formatDate(generation.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {generations.length === 0 && (
                <div className="border-t border-gray-100 py-12 text-center text-gray-500">
                  לא נמצאו יצירות לפי הסינון הנוכחי
                </div>
              )}
            </div>
          )}

          {!loading && hasMore && <div ref={sentinelRef} className="h-px" />}

          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </section>
      </div>

      {selected && (
        <AdminGenerationModal
          generation={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleGenerationUpdated}
          onDeleted={(id) => removeGenerations([id])}
        />
      )}
    </AdminShell>
  );
}
