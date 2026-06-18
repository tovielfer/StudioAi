'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminCostStat, AdminGeneration, api } from '@/lib/api';
import { AdminShell } from '../admin-shell';

const MODAL_LIMIT = 100;

const TYPE_LABELS: Record<string, string> = {
  image: 'תמונה',
  video: 'וידאו',
  upscale: 'הגדלה',
};

const QUALITY_LABELS: Record<string, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
  auto: 'אוטומטי',
  fast: 'מהיר',
  standard: 'רגיל',
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

type CostFilters = {
  type: string;
  provider: string;
  model: string;
  quality: string;
  size: string;
  resolution: string;
  reference: string;
};

const EMPTY_FILTERS: CostFilters = {
  type: '',
  provider: '',
  model: '',
  quality: '',
  size: '',
  resolution: '',
  reference: '',
};

function fmt(n: number) {
  return n.toLocaleString('he-IL');
}

function fmtUsd(n: number | null | undefined) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `$${n.toFixed(4)}`;
}

function fmtAvg(n: number, count: number) {
  return count > 0 ? fmtUsd(n / count) : '—';
}

function avgWithCount(avg: number, count: number) {
  return count > 0 ? `${fmtUsd(avg)} (${fmt(count)} תמונות)` : '—';
}

function label(value: string | null | undefined, fallback = 'לא מוגדר') {
  return value || fallback;
}

function typeLabel(value: string) {
  return TYPE_LABELS[value] ?? value;
}

function providerLabel(value: string) {
  return PROVIDER_LABELS[value] ?? value;
}

function qualityLabel(value: string | null) {
  if (!value) return '—';
  return QUALITY_LABELS[value] ?? value;
}

function hasReference(generation: AdminGeneration) {
  return Boolean(generation.referenceImageUrls?.length);
}

function matchesFilters(stat: AdminCostStat, filters: CostFilters) {
  if (filters.type && stat.type !== filters.type) return false;
  if (filters.provider && stat.provider !== filters.provider) return false;
  if (filters.model && stat.model !== filters.model) return false;
  if (filters.quality && stat.quality !== filters.quality) return false;
  if (filters.size && stat.size !== filters.size) return false;
  if (filters.resolution && stat.resolution !== filters.resolution) return false;
  if (filters.reference === 'with' && !stat.hasReference) return false;
  if (filters.reference === 'without' && stat.hasReference) return false;
  return true;
}

function uniqueSorted<T extends string>(values: T[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'he'),
  );
}

function sumStats(stats: AdminCostStat[]) {
  const count = stats.reduce((sum, stat) => sum + stat.count, 0);
  const costedCount = stats.reduce((sum, stat) => sum + stat.costedCount, 0);
  const missingCostCount = stats.reduce(
    (sum, stat) => sum + stat.missingCostCount,
    0,
  );
  const refCount = stats.reduce((sum, stat) => sum + stat.refCount, 0);
  const totalCostUsd = stats.reduce((sum, stat) => sum + stat.totalCostUsd, 0);

  return { count, costedCount, missingCostCount, refCount, totalCostUsd };
}

export default function CostAnalysisPage() {
  return (
    <AdminGuard>
      <CostAnalysisContent />
    </AdminGuard>
  );
}

function CostAnalysisContent() {
  const [stats, setStats] = useState<AdminCostStat[]>([]);
  const [filters, setFilters] = useState<CostFilters>(EMPTY_FILTERS);
  const [selectedStat, setSelectedStat] = useState<AdminCostStat | null>(null);
  const [modalGenerations, setModalGenerations] = useState<AdminGeneration[]>([]);
  const [modalTotal, setModalTotal] = useState(0);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const costStats = await api.getAdminCostStats();

        if (!cancelled) {
          setStats(costStats);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'שגיאה בטעינת העלויות');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => ({
      types: uniqueSorted(stats.map((stat) => stat.type)),
      providers: uniqueSorted(stats.map((stat) => stat.provider)),
      models: uniqueSorted(stats.map((stat) => stat.model)),
      qualities: uniqueSorted(stats.map((stat) => stat.quality)),
      sizes: uniqueSorted(stats.map((stat) => stat.size)),
      resolutions: uniqueSorted(stats.map((stat) => stat.resolution)),
    }),
    [stats],
  );

  const filteredStats = useMemo(
    () => stats.filter((stat) => matchesFilters(stat, filters)),
    [filters, stats],
  );

  const totals = useMemo(() => sumStats(filteredStats), [filteredStats]);

  function updateFilter(key: keyof CostFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function openGenerationsModal(stat: AdminCostStat) {
    setSelectedStat(stat);
    setModalGenerations([]);
    setModalTotal(0);
    setModalError(null);
    setModalLoading(true);

    try {
      const res = await api.getAdminGenerations({
        status: 'done',
        type: stat.type,
        provider: stat.provider,
        model: stat.model,
        quality: stat.quality,
        size: stat.size,
        resolution: stat.resolution,
        hasReference: stat.hasReference,
        limit: MODAL_LIMIT,
      });
      setModalGenerations(res.items);
      setModalTotal(res.total);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : 'שגיאה בטעינת היצירות');
    } finally {
      setModalLoading(false);
    }
  }

  function closeGenerationsModal() {
    setSelectedStat(null);
    setModalGenerations([]);
    setModalTotal(0);
    setModalError(null);
    setModalLoading(false);
  }

  return (
    <AdminShell
      eyebrow="עלויות בפועל"
      title="כמה התמונות עלו לנו"
      description="דוח פשוט לפי עלות ספק אמיתית בדולרים, עם פירוק לפי סוג, ספק, מודל, איכות וגודל."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="יצירות שהושלמו" value={fmt(totals.count)} />
          <StatCard
            label="כמה עלה לנו בפועל"
            value={fmtUsd(totals.totalCostUsd)}
            accent
          />
          <StatCard
            label="ממוצע לתמונה"
            value={fmtAvg(totals.totalCostUsd, totals.costedCount)}
          />
          <StatCard label="תמונות מקור" value={fmt(totals.refCount)} />
          <StatCard
            label="חסר נתון עלות"
            value={fmt(totals.missingCostCount)}
            muted={totals.missingCostCount === 0}
          />
        </div>

        <section className="admin-card space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">סינון הדוח</h2>
              <p className="text-sm text-gray-500">
                הסיכום מחושב על כל היצירות שהושלמו, לא רק על הטבלה למטה.
              </p>
            </div>
            <button
              type="button"
              className="self-start rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              איפוס סינון
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <FilterSelect
              label="סוג"
              value={filters.type}
              onChange={(value) => updateFilter('type', value)}
              options={filterOptions.types.map((value) => ({
                value,
                label: typeLabel(value),
              }))}
            />
            <FilterSelect
              label="ספק"
              value={filters.provider}
              onChange={(value) => updateFilter('provider', value)}
              options={filterOptions.providers.map((value) => ({
                value,
                label: providerLabel(value),
              }))}
            />
            <FilterSelect
              label="מודל"
              value={filters.model}
              onChange={(value) => updateFilter('model', value)}
              options={filterOptions.models.map((value) => ({
                value,
                label: value,
              }))}
            />
            <FilterSelect
              label="איכות"
              value={filters.quality}
              onChange={(value) => updateFilter('quality', value)}
              options={filterOptions.qualities.map((value) => ({
                value,
                label: qualityLabel(value),
              }))}
            />
            <FilterSelect
              label="גודל"
              value={filters.size}
              onChange={(value) => updateFilter('size', value)}
              options={filterOptions.sizes.map((value) => ({
                value,
                label: value,
              }))}
            />
            <FilterSelect
              label="רזולוציה"
              value={filters.resolution}
              onChange={(value) => updateFilter('resolution', value)}
              options={filterOptions.resolutions.map((value) => ({
                value,
                label: value,
              }))}
            />
            <FilterSelect
              label="תמונת מקור"
              value={filters.reference}
              onChange={(value) => updateFilter('reference', value)}
              options={[
                { value: 'with', label: 'עם תמונת מקור' },
                { value: 'without', label: 'בלי תמונת מקור' },
              ]}
            />
          </div>
        </section>

        <section className="admin-card">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">
                פירוק לפי כל הסוגים
              </h2>
              <p className="text-sm text-gray-500">
                כל שורה היא קומבינציה של סוג, ספק, מודל, איכות, גודל, רזולוציה
                ותמונת מקור.
              </p>
            </div>
            <p className="text-sm text-gray-500">
              {fmt(filteredStats.length)} שורות סיכום
            </p>
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredStats.length === 0 ? (
            <EmptyState>אין נתוני עלות שמתאימים לסינון הנוכחי.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">סוג</th>
                    <th className="py-3 pe-3 text-right">ספק</th>
                    <th className="py-3 pe-3 text-right">מודל</th>
                    <th className="py-3 pe-3 text-right">איכות</th>
                    <th className="py-3 pe-3 text-right">גודל</th>
                    <th className="py-3 pe-3 text-right">רזולוציה</th>
                    <th className="py-3 pe-3 text-right">מקור</th>
                    <th className="py-3 pe-3 text-right">תמונות מקור</th>
                    <th className="py-3 pe-3 text-right">כמות</th>
                    <th className="py-3 pe-3 text-right">סה״כ עלות</th>
                    <th className="py-3 pe-3 text-right">ממוצע</th>
                    <th className="py-3 pe-3 text-right">מחיר מקסימום</th>
                    <th className="py-3 pe-3 text-right">טווח מחירים</th>
                    <th className="py-3 text-right">חסר עלות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((stat) => (
                    <tr
                      key={[
                        stat.type,
                        stat.provider,
                        stat.model,
                        stat.quality,
                        stat.size,
                        stat.resolution,
                        stat.hasReference ? 'ref' : 'no-ref',
                      ].join('|')}
                      className="cursor-pointer border-b border-gray-100 align-top hover:bg-brand-50/60"
                      role="button"
                      tabIndex={0}
                      onClick={() => openGenerationsModal(stat)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openGenerationsModal(stat);
                        }
                      }}
                    >
                      <td className="py-3 pe-3 font-medium text-gray-950">
                        {typeLabel(stat.type)}
                      </td>
                      <td className="py-3 pe-3 text-gray-700">
                        {providerLabel(stat.provider)}
                      </td>
                      <td className="py-3 pe-3 text-gray-700">
                        {label(stat.model)}
                      </td>
                      <td className="py-3 pe-3 text-gray-700">
                        {qualityLabel(stat.quality)}
                      </td>
                      <td className="py-3 pe-3 text-gray-700">
                        {label(stat.size)}
                      </td>
                      <td className="py-3 pe-3 text-gray-700">
                        {label(stat.resolution)}
                      </td>
                      <td className="py-3 pe-3">
                        <ReferenceBadge hasReference={stat.hasReference} />
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-700">
                        {fmt(stat.refCount)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-700">
                        {fmt(stat.count)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-700">
                        {fmtUsd(stat.totalCostUsd)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums font-semibold text-gray-950 ">
                        {avgWithCount(stat.avgCostUsd, stat.costedCount)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-600">
                        {fmtUsd(stat.maxCostUsd)}
                      </td>
                      <td className="py-3 pe-3 tabular-nums text-gray-600">
                        {stat.minCostUsd === null && stat.maxCostUsd === null
                          ? '—'
                          : `${fmtUsd(stat.minCostUsd)} - ${fmtUsd(stat.maxCostUsd)}`}
                      </td>
                      <td className="py-3 tabular-nums text-gray-700">
                        {stat.missingCostCount > 0 ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            {fmt(stat.missingCostCount)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-sm text-gray-500">
          לחצי על שורת סיכום כדי לראות את היצירות ששייכות אליה.
        </p>
      </div>

      {selectedStat && (
        <GenerationsModal
          stat={selectedStat}
          generations={modalGenerations}
          total={modalTotal}
          loading={modalLoading}
          error={modalError}
          onClose={closeGenerationsModal}
        />
      )}
    </AdminShell>
  );
}

function GenerationsModal({
  stat,
  generations,
  total,
  loading,
  error,
  onClose,
}: {
  stat: AdminCostStat;
  generations: AdminGeneration[];
  total: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-600">
              יצירות לפי שורת הסיכום
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950">
              {typeLabel(stat.type)} · {providerLabel(stat.provider)} ·{' '}
              {label(stat.model)}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {qualityLabel(stat.quality)} · {label(stat.size)} ·{' '}
              {label(stat.resolution)} ·{' '}
              {stat.hasReference ? 'עם תמונת מקור' : 'בלי תמונת מקור'}
            </p>
          </div>
          <button
            type="button"
            className="self-start rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            סגירה
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-5 md:grid-cols-5">
          <MiniStat label="כמות בשורה" value={fmt(stat.count)} />
          <MiniStat label="סה״כ עלות" value={fmtUsd(stat.totalCostUsd)} />
          <MiniStat
            label="ממוצע לתמונה"
            value={avgWithCount(stat.avgCostUsd, stat.costedCount)}
          />
          <MiniStat label="מחיר מקסימום" value={fmtUsd(stat.maxCostUsd)} />
          <MiniStat
            label="טווח מחירים"
            value={
              stat.minCostUsd === null && stat.maxCostUsd === null
                ? '—'
                : `${fmtUsd(stat.minCostUsd)} - ${fmtUsd(stat.maxCostUsd)}`
            }
          />
          <MiniStat label="תמונות מקור" value={fmt(stat.refCount)} />
        </div>

        <div className="max-h-[55vh] overflow-auto p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : generations.length === 0 ? (
            <EmptyState>לא נמצאו יצירות לשורה הזו.</EmptyState>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-500">
                מוצגות {fmt(generations.length)} מתוך {fmt(total)}
                {total > MODAL_LIMIT ? ` הראשונות` : ''}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="py-3 pe-3 text-right">תאריך</th>
                      <th className="py-3 pe-3 text-right">משתמש</th>
                      <th className="py-3 pe-3 text-right">מודל</th>
                      <th className="py-3 pe-3 text-right">איכות/גודל</th>
                      <th className="py-3 pe-3 text-right">תמונות מקור</th>
                      <th className="py-3 pe-3 text-right">עלות בפועל</th>
                      <th className="py-3 text-right">פרומפט</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generations.map((generation) => (
                      <tr
                        key={generation.id}
                        className="border-b border-gray-100 align-top hover:bg-gray-50"
                      >
                        <td className="py-3 pe-3 whitespace-nowrap text-xs text-gray-500">
                          {new Date(generation.createdAt).toLocaleString(
                            'he-IL',
                            {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            },
                          )}
                        </td>
                        <td className="py-3 pe-3 max-w-[160px] truncate text-gray-700">
                          {generation.userEmail ?? generation.userId}
                        </td>
                        <td className="py-3 pe-3 text-gray-700">
                          <span className="font-medium">
                            {providerLabel(generation.provider)}
                          </span>
                          <br />
                          <span className="text-xs text-gray-500">
                            {generation.model}
                          </span>
                        </td>
                        <td className="py-3 pe-3 text-gray-700">
                          {qualityLabel(generation.quality)} · {generation.size}{' '}
                          · {generation.resolution}
                        </td>
                        <td className="py-3 pe-3 tabular-nums text-gray-700">
                          {fmt(generation.referenceImageUrls?.length ?? 0)}
                        </td>
                        <td className="py-3 pe-3 tabular-nums font-semibold text-gray-950">
                          {fmtUsd(generation.actualCostUsd)}
                        </td>
                        <td className="py-3 max-w-sm text-xs text-gray-600">
                          <span className="line-clamp-2">
                            {generation.prompt}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-gray-950">
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
      </span>
      <select
        className="admin-field w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">הכל</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReferenceBadge({ hasReference }: { hasReference: boolean }) {
  return hasReference ? (
    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
      עם תמונת מקור
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
      בלי תמונת מקור
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? 'border-brand-200 bg-brand-50'
          : muted
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-200 bg-white'
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
          accent ? 'text-brand-800' : muted ? 'text-gray-600' : 'text-gray-950'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="border-t border-gray-100 py-12 text-center text-gray-500">
      {children}
    </div>
  );
}
