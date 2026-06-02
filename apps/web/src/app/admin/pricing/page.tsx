'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import {
  AdminGeneration,
  AdminPricingRule,
  PricingRuleAuditLog,
  PricingRuleMetrics,
  api,
} from '@/lib/api';
import { AdminShell } from '../admin-shell';

type GroupBy = 'model' | 'provider' | 'type' | 'full';

const PAGE_SIZE = 50;

const EMPTY_METRICS: PricingRuleMetrics = {
  generationCount: 0,
  doneCount: 0,
  failedCount: 0,
  totalCredits: 0,
  avgCredits: 0,
  totalActualCostUsd: 0,
  avgActualCostUsd: 0,
  estimatedGrossUsd: 0,
  estimatedMarginUsd: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalInputImageTokens: 0,
  totalOutputImageTokens: 0,
};

function fmt(n: number) {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function fmtUsd(n: number | null | undefined) {
  if (typeof n !== 'number') return '—';
  return `$${n.toFixed(4)}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function ruleLabel(rule: AdminPricingRule) {
  if (rule.isModelDefault) return `${rule.provider ?? 'כללי'}/${rule.model ?? rule.type} - ברירת מחדל`;
  return [
    rule.provider,
    rule.model,
    rule.size,
    rule.resolution,
    rule.quality,
  ]
    .filter(Boolean)
    .join(' / ');
}

function groupKey(rule: AdminPricingRule, groupBy: GroupBy) {
  if (groupBy === 'provider') return rule.provider ?? 'כללי';
  if (groupBy === 'type') return rule.type;
  if (groupBy === 'full') return rule.id;
  return `${rule.provider ?? 'כללי'} / ${rule.model ?? rule.type}`;
}

function addMetrics(items: PricingRuleMetrics[]) {
  const total = items.reduce(
    (acc, item) => ({
      generationCount: acc.generationCount + item.generationCount,
      doneCount: acc.doneCount + item.doneCount,
      failedCount: acc.failedCount + item.failedCount,
      totalCredits: acc.totalCredits + item.totalCredits,
      avgCredits: 0,
      totalActualCostUsd: acc.totalActualCostUsd + item.totalActualCostUsd,
      avgActualCostUsd: 0,
      estimatedGrossUsd: acc.estimatedGrossUsd + item.estimatedGrossUsd,
      estimatedMarginUsd: acc.estimatedMarginUsd + item.estimatedMarginUsd,
      totalInputTokens: acc.totalInputTokens + item.totalInputTokens,
      totalOutputTokens: acc.totalOutputTokens + item.totalOutputTokens,
      totalInputImageTokens:
        acc.totalInputImageTokens + item.totalInputImageTokens,
      totalOutputImageTokens:
        acc.totalOutputImageTokens + item.totalOutputImageTokens,
    }),
    { ...EMPTY_METRICS },
  );

  total.avgCredits =
    total.generationCount > 0 ? total.totalCredits / total.generationCount : 0;
  total.avgActualCostUsd =
    total.generationCount > 0
      ? total.totalActualCostUsd / total.generationCount
      : 0;
  return total;
}

export default function AdminPricingPage() {
  return (
    <AdminGuard>
      <AdminPricingContent />
    </AdminGuard>
  );
}

function AdminPricingContent() {
  const [rules, setRules] = useState<AdminPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('model');
  const [providerFilter, setProviderFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<AdminPricingRule | null>(null);
  const [detailsRule, setDetailsRule] = useState<AdminPricingRule | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRules(await api.getAdminPricingRules());
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שגיאה בטעינת מחירון');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rules.filter((rule) => {
        if (!showInactive && !rule.isActive) return false;
        if (providerFilter && rule.provider !== providerFilter) return false;
        if (typeFilter && rule.type !== typeFilter) return false;
        if (
          modelFilter &&
          !(rule.model ?? '').toLowerCase().includes(modelFilter.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [modelFilter, providerFilter, rules, showInactive, typeFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, AdminPricingRule[]>();
    for (const rule of filtered) {
      const key = groupKey(rule, groupBy);
      map.set(key, [...(map.get(key) ?? []), rule]);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      items,
      metrics: addMetrics(items.map((item) => item.metrics)),
    }));
  }, [filtered, groupBy]);

  const providers = [...new Set(rules.map((rule) => rule.provider).filter(Boolean))];
  const types = [...new Set(rules.map((rule) => rule.type))];
  const totalMetrics = addMetrics(filtered.map((rule) => rule.metrics));

  return (
    <AdminShell
      eyebrow="ניהול מחירון"
      title="מחירון קרדיטים"
      description="ניהול מחירי קרדיטים לצד שימוש בפועל, עלות ספק, טוקנים ופער משוער."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="שורות מחירון" value={fmt(filtered.length)} />
          <StatCard label="יצירות" value={fmt(totalMetrics.generationCount)} />
          <StatCard label="קרדיטים שנגבו" value={fmt(totalMetrics.totalCredits)} accent />
          <StatCard label="עלות ספק בפועל" value={fmtUsd(totalMetrics.totalActualCostUsd)} />
          <StatCard label="פער משוער" value={fmtUsd(totalMetrics.estimatedMarginUsd)} />
        </div>

        <section className="admin-card">
          <div className="grid gap-3 md:grid-cols-6">
            <select
              className="admin-field"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="model">קיבוץ לפי מודל</option>
              <option value="provider">קיבוץ לפי ספק</option>
              <option value="type">קיבוץ לפי סוג</option>
              <option value="full">קומבינציות מלאות</option>
            </select>
            <select
              className="admin-field"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="">כל הספקים</option>
              {providers.map((provider) => (
                <option key={provider} value={provider ?? ''}>
                  {provider}
                </option>
              ))}
            </select>
            <select
              className="admin-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">כל הסוגים</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              className="admin-field md:col-span-2"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="חיפוש מודל"
            />
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              הצגת לא פעילים
            </label>
          </div>
        </section>

        <section className="admin-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">מחירון</h2>
              <p className="text-sm text-gray-500">
                {groups.length.toLocaleString('he-IL')} קבוצות
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              רענון
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">קבוצה</th>
                    <th className="py-3 pe-3 text-right">שורות</th>
                    <th className="py-3 pe-3 text-right">יצירות</th>
                    <th className="py-3 pe-3 text-right">עלות ספק</th>
                    <th className="py-3 pe-3 text-right">קרדיטים</th>
                    <th className="py-3 pe-3 text-right">פער משוער</th>
                    <th className="py-3 pe-3 text-right">טוקנים</th>
                    <th className="py-3 text-right">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isExpanded = expanded[group.key] ?? groupBy === 'full';
                    const primaryRule = group.items[0];
                    return (
                      <Fragment key={group.key}>
                        <tr className="border-b border-gray-100">
                          <td className="py-3 pe-3 font-semibold text-gray-950">
                            {group.key}
                          </td>
                          <td className="py-3 pe-3 text-gray-600">
                            {group.items.length.toLocaleString('he-IL')}
                          </td>
                          <td className="py-3 pe-3 text-gray-900">
                            {fmt(group.metrics.generationCount)}
                          </td>
                          <td className="py-3 pe-3 text-gray-900">
                            {fmtUsd(group.metrics.totalActualCostUsd)}
                          </td>
                          <td className="py-3 pe-3 font-semibold text-brand-700">
                            {fmt(group.metrics.totalCredits)}
                          </td>
                          <td className="py-3 pe-3 text-gray-900">
                            {fmtUsd(group.metrics.estimatedMarginUsd)}
                          </td>
                          <td className="py-3 pe-3 text-gray-600">
                            input {fmt(group.metrics.totalInputTokens)} · output{' '}
                            {fmt(group.metrics.totalOutputTokens)}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              {groupBy !== 'full' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpanded((value) => ({
                                      ...value,
                                      [group.key]: !isExpanded,
                                    }))
                                  }
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  {isExpanded ? 'סגירה' : 'פתיחה'}
                                </button>
                              )}
                              {primaryRule && (
                                <button
                                  type="button"
                                  onClick={() => setDetailsRule(primaryRule)}
                                  className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                                >
                                  פירוט
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded &&
                          group.items.map((rule) => (
                            <RuleRow
                              key={rule.id}
                              rule={rule}
                              onEdit={setEditing}
                              onDetails={setDetailsRule}
                            />
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <EditRuleModal
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {detailsRule && (
        <RuleDetailsModal
          rule={detailsRule}
          onClose={() => setDetailsRule(null)}
        />
      )}
    </AdminShell>
  );
}

function RuleRow({
  rule,
  onEdit,
  onDetails,
}: {
  rule: AdminPricingRule;
  onEdit: (rule: AdminPricingRule) => void;
  onDetails: (rule: AdminPricingRule) => void;
}) {
  return (
    <tr className="border-b border-gray-100 bg-gray-50/60 align-top">
      <td className="py-3 pe-3 ps-6 text-gray-800">{ruleLabel(rule)}</td>
      <td className="py-3 pe-3 text-xs text-gray-500">
        {rule.isModelDefault ? 'ברירת מחדל' : 'קומבינציה'}
        {!rule.isActive && <span className="ms-2 text-red-600">לא פעיל</span>}
      </td>
      <td className="py-3 pe-3 text-gray-700">{fmt(rule.metrics.generationCount)}</td>
      <td className="py-3 pe-3 text-gray-700">{fmtUsd(rule.metrics.totalActualCostUsd)}</td>
      <td className="py-3 pe-3">
        <div className="font-semibold text-brand-700">
          {rule.creditCostOverride ?? rule.calculatedCredits}
        </div>
        <div className="text-xs text-gray-500">
          חישוב {rule.calculatedCredits} · עם מקור {rule.referenceCalculatedCredits}
        </div>
      </td>
      <td className="py-3 pe-3 text-gray-700">{fmtUsd(rule.metrics.estimatedMarginUsd)}</td>
      <td className="py-3 pe-3 text-xs text-gray-500">
        img in {fmt(rule.metrics.totalInputImageTokens)} · img out{' '}
        {fmt(rule.metrics.totalOutputImageTokens)}
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(rule)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
          >
            עריכה
          </button>
          <button
            type="button"
            onClick={() => onDetails(rule)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            פירוט
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: AdminPricingRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [baseUsd, setBaseUsd] = useState(String(rule.baseUsd));
  const [referenceImageUsd, setReferenceImageUsd] = useState(
    String(rule.referenceImageUsd),
  );
  const [margin, setMargin] = useState(String(rule.margin));
  const [creditCostOverride, setCreditCostOverride] = useState(
    rule.creditCostOverride === null ? '' : String(rule.creditCostOverride),
  );
  const [isActive, setIsActive] = useState(rule.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedUsd =
    (Number(baseUsd || 0) + Number(referenceImageUsd || 0)) *
    Number(margin || 0);
  const calculatedCredits = Math.ceil(calculatedUsd * 100);
  const finalCredits =
    creditCostOverride.trim() === ''
      ? calculatedCredits
      : Number(creditCostOverride);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateAdminPricingRule(rule.id, {
        baseUsd: Number(baseUsd),
        referenceImageUsd: Number(referenceImageUsd),
        margin: Number(margin),
        creditCostOverride:
          creditCostOverride.trim() === '' ? null : Number(creditCostOverride),
        isActive,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="admin-card w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">עריכת מחיר</h2>
            <p className="mt-1 text-sm text-gray-500">{ruleLabel(rule)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            סגור
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="עלות ספק ($)" value={baseUsd} onChange={setBaseUsd} />
          <NumberField
            label="תוספת תמונת מקור ($)"
            value={referenceImageUsd}
            onChange={setReferenceImageUsd}
          />
          <NumberField label="מרווח" value={margin} onChange={setMargin} />
          <NumberField
            label="Override קרדיטים סופי"
            value={creditCostOverride}
            onChange={setCreditCostOverride}
            placeholder="ריק = חישוב אוטומטי"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          מחיר פעיל
        </label>

        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          <div>עלות מחושבת עם מקור: {fmtUsd(calculatedUsd)}</div>
          <div className="mt-1 font-semibold">
            קרדיטים שייגבו: {Number.isFinite(finalCredits) ? finalCredits : '—'}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
      </span>
      <input
        className="admin-field w-full"
        type="number"
        min="0"
        step="0.0001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function RuleDetailsModal({
  rule,
  onClose,
}: {
  rule: AdminPricingRule;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AdminGeneration[]>([]);
  const [audit, setAudit] = useState<PricingRuleAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAdminPricingRuleGenerations(rule.id, { limit: PAGE_SIZE }),
      api.getAdminPricingRuleAuditLog(rule.id),
    ])
      .then(([generations, logs]) => {
        setItems(generations.items);
        setTotal(generations.total);
        setAudit(logs);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת פירוט'),
      )
      .finally(() => setLoading(false));
  }, [rule.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="admin-card max-h-[90vh] w-full max-w-6xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">פירוט מחירון</h2>
            <p className="mt-1 text-sm text-gray-500">{ruleLabel(rule)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            סגור
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 font-semibold text-gray-950">
                יצירות ({total.toLocaleString('he-IL')})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="py-2 pe-3 text-right">תאריך</th>
                      <th className="py-2 pe-3 text-right">משתמש</th>
                      <th className="py-2 pe-3 text-right">סטטוס</th>
                      <th className="py-2 pe-3 text-right">קרדיטים</th>
                      <th className="py-2 pe-3 text-right">עלות ספק</th>
                      <th className="py-2 text-right">טוקנים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pe-3 text-gray-500">
                          {fmtDate(item.createdAt)}
                        </td>
                        <td className="py-2 pe-3 text-gray-700">
                          {item.userEmail ?? item.userId}
                        </td>
                        <td className="py-2 pe-3 text-gray-700">{item.status}</td>
                        <td className="py-2 pe-3 font-semibold text-brand-700">
                          {item.creditCost}
                        </td>
                        <td className="py-2 pe-3 text-gray-700">
                          {fmtUsd(item.actualCostUsd)}
                        </td>
                        <td className="py-2 text-gray-500">
                          {fmt(item.tokensUsed?.total_tokens ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-950">לוג שינויים</h3>
              {audit.length === 0 ? (
                <p className="text-sm text-gray-500">אין שינויים מתועדים</p>
              ) : (
                <div className="space-y-2">
                  {audit.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
                    >
                      <div className="font-medium text-gray-950">
                        {log.field}: {log.oldValue ?? '—'} → {log.newValue ?? '—'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {fmtDate(log.createdAt)}
                        {log.adminUserId ? ` · ${log.adminUserId}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
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
      <p className="text-xs font-semibold text-gray-500">{label}</p>
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
