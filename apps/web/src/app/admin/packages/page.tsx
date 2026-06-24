'use client';

import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { api, CreditPackage } from '@/lib/api';
import { AdminShell } from '../admin-shell';

export default function AdminPackagesPage() {
  return (
    <AdminGuard>
      <AdminPackagesContent />
    </AdminGuard>
  );
}

function AdminPackagesContent() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CreditPackage | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPackages(await api.getAdminPackages());
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שגיאה בטעינת חבילות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const perCredit = (pkg: CreditPackage) =>
    pkg.credits > 0 ? pkg.priceIls / pkg.credits : 0;

  return (
    <AdminShell
      eyebrow="ניהול חבילות"
      title="חבילות קרדיטים"
      description="הגדרת חבילות הרכישה. חבילה גדולה יותר אמורה לתת יותר קרדיטים לשקל."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="admin-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-950">חבילות</h2>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              חבילה חדשה
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-3 pe-3 text-right">סדר</th>
                    <th className="py-3 pe-3 text-right">שם</th>
                    <th className="py-3 pe-3 text-right">מחיר</th>
                    <th className="py-3 pe-3 text-right">קרדיטים</th>
                    <th className="py-3 pe-3 text-right">לקרדיט</th>
                    <th className="py-3 pe-3 text-right">תג</th>
                    <th className="py-3 pe-3 text-right">פעיל</th>
                    <th className="py-3 text-right">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-gray-100">
                      <td className="py-3 pe-3 text-gray-500">{pkg.sortOrder}</td>
                      <td className="py-3 pe-3 font-medium text-gray-950">
                        {pkg.name}
                      </td>
                      <td className="py-3 pe-3 text-gray-800">₪{pkg.priceIls}</td>
                      <td className="py-3 pe-3 font-semibold text-brand-700">
                        {pkg.credits.toLocaleString('he-IL')}
                      </td>
                      <td className="py-3 pe-3 text-gray-600">
                        ₪{perCredit(pkg).toFixed(3)}
                      </td>
                      <td className="py-3 pe-3 text-gray-600">{pkg.badge ?? '—'}</td>
                      <td className="py-3 pe-3">
                        {pkg.isActive ? (
                          <span className="text-green-700">פעיל</span>
                        ) : (
                          <span className="text-gray-400">כבוי</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setEditing(pkg)}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
                        >
                          עריכה
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {(editing || creating) && (
        <PackageModal
          pkg={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
          }}
        />
      )}
    </AdminShell>
  );
}

function PackageModal({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: CreditPackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(pkg?.name ?? '');
  const [priceIls, setPriceIls] = useState(String(pkg?.priceIls ?? ''));
  const [credits, setCredits] = useState(String(pkg?.credits ?? ''));
  const [badge, setBadge] = useState(pkg?.badge ?? '');
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(pkg?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        priceIls: Number(priceIls),
        credits: Number(credits),
        badge: badge.trim() === '' ? null : badge.trim(),
        isActive,
        sortOrder: Number(sortOrder),
      };
      if (pkg) {
        await api.updateAdminPackage(pkg.id, payload);
      } else {
        await api.createAdminPackage(payload);
      }
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
        className="admin-card w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-2xl font-bold text-gray-950">
          {pkg ? 'עריכת חבילה' : 'חבילה חדשה'}
        </h2>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="שם">
            <input
              className="admin-field w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="תג (אופציונלי)">
            <input
              className="admin-field w-full"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="הכי משתלם"
            />
          </Field>
          <Field label="מחיר (₪)">
            <input
              className="admin-field w-full"
              type="number"
              min="0"
              step="0.01"
              value={priceIls}
              onChange={(e) => setPriceIls(e.target.value)}
            />
          </Field>
          <Field label="קרדיטים">
            <input
              className="admin-field w-full"
              type="number"
              min="1"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </Field>
          <Field label="סדר תצוגה">
            <input
              className="admin-field w-full"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          חבילה פעילה
        </label>

        {Number(priceIls) > 0 && Number(credits) > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            ₪{(Number(priceIls) / Number(credits)).toFixed(3)} לקרדיט
          </p>
        )}

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
