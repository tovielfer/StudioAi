'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminCreditTransaction, AdminUsersSort, api, User } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AdminShell } from '../admin-shell';

const PAGE_SIZE = 25;

type ViewMode = 'cards' | 'table';

const SORT_OPTIONS: { value: AdminUsersSort; label: string }[] = [
  { value: 'newest', label: 'הצטרפו לאחרונה' },
  { value: 'oldest', label: 'הוותיקים ביותר' },
  { value: 'generations', label: 'הכי הרבה יצירות' },
  { value: 'credits', label: 'הכי הרבה קרדיטים' },
  { value: 'email', label: 'אימייל (א׳–ת׳)' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function initials(user: User) {
  const base = user.nickname?.trim() || user.email;
  return base.slice(0, 2).toUpperCase();
}

function parseCreditAmount(value: string) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount !== 0 ? amount : null;
}

function formatReason(reason: string) {
  if (reason === 'admin_add') return 'הוספה ידנית';
  if (reason === 'admin_deduct') return 'הורדה ידנית';
  if (reason.startsWith('purchase:order:')) return 'רכישת קרדיטים';
  if (reason.startsWith('generation:')) return 'חיוב על יצירה';
  if (reason.startsWith('refund:failed:')) return 'החזר על יצירה שנכשלה';
  if (reason.startsWith('refund:cancelled:')) return 'החזר על יצירה שבוטלה';
  return reason;
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
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [sort, setSort] = useState<AdminUsersSort>('newest');

  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditReason, setCreditReason] = useState('admin_add');

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingCredits, setSavingCredits] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState('25');
  const [quickSaving, setQuickSaving] = useState(false);

  const [transactionsUser, setTransactionsUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<AdminCreditTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsMessage, setTransactionsMessage] = useState<string | null>(
    null,
  );

  const usersRef = useRef<User[]>([]);
  usersRef.current = users;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = users.length < usersTotal;

  // Debounce the search input so we don't fire a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = useCallback(
    async (offset: number) => {
      return api.getAdminUsers({
        search: query || undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      });
    },
    [query, sort],
  );

  // Reset and load the first page whenever the search query changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetchPage(0)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.items);
        setUsersTotal(res.total);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(usersRef.current.length);
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...res.items.filter((u) => !seen.has(u.id))];
      });
      setUsersTotal(res.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage]);

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  const applyCredits = useCallback(
    async (userId: string, amount: number, reason?: string) => {
      const res = await api.addAdminCredits(userId, amount, reason || undefined);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credits: res.credits } : u)),
      );
      await refreshCredits();
      return res.credits;
    },
    [refreshCredits],
  );

  async function addCredits(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = parseCreditAmount(creditAmount);
    if (!creditUserId || amount === null) return;

    setSavingCredits(true);
    setMessage(null);
    try {
      const credits = await applyCredits(
        creditUserId,
        amount,
        creditReason || (amount < 0 ? 'admin_deduct' : 'admin_add'),
      );
      setMessage(`הקרדיטים עודכנו. יתרה חדשה: ${credits}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'עדכון הקרדיטים נכשל');
    } finally {
      setSavingCredits(false);
    }
  }

  function openQuickAdd(user: User) {
    setQuickAddId(user.id);
    setQuickAmount('25');
  }

  function cancelQuickAdd() {
    setQuickAddId(null);
  }

  async function quickAddCredits(user: User) {
    const amount = parseCreditAmount(quickAmount);
    if (amount === null) return;
    setQuickSaving(true);
    setMessage(null);
    try {
      const credits = await applyCredits(
        user.id,
        amount,
        amount < 0 ? 'admin_deduct' : 'admin_add',
      );
      const label = user.nickname || user.email;
      const action = amount > 0 ? 'נוספו' : 'הורדו';
      setMessage(
        `${action} ${Math.abs(amount)} קרדיטים ל-${label}. יתרה חדשה: ${credits}`,
      );
      cancelQuickAdd();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'עדכון הקרדיטים נכשל');
    } finally {
      setQuickSaving(false);
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditingValue(user.nickname ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue('');
  }

  async function saveNickname(userId: string) {
    setSavingNickname(true);
    setMessage(null);
    try {
      const updated = await api.updateAdminUser(userId, {
        nickname: editingValue.trim() || null,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, nickname: updated.nickname } : u,
        ),
      );
      cancelEdit();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'שמירת הכינוי נכשלה');
    } finally {
      setSavingNickname(false);
    }
  }

  async function openTransactions(user: User) {
    setTransactionsUser(user);
    setTransactions([]);
    setTransactionsTotal(0);
    setTransactionsMessage(null);
    setTransactionsLoading(true);

    try {
      const res = await api.getAdminCreditTransactions({
        userId: user.id,
        limit: 50,
        offset: 0,
      });
      setTransactions(res.items);
      setTransactionsTotal(res.total);
    } catch (err) {
      setTransactionsMessage(
        err instanceof Error ? err.message : 'טעינת התנועות נכשלה',
      );
    } finally {
      setTransactionsLoading(false);
    }
  }

  function closeTransactions() {
    setTransactionsUser(null);
    setTransactions([]);
    setTransactionsTotal(0);
    setTransactionsMessage(null);
  }

  const creditAmountValue = parseCreditAmount(creditAmount);
  const quickAmountValue = parseCreditAmount(quickAmount);

  return (
    <AdminShell
      eyebrow="ניהול משתמשים"
      title="משתמשים"
      description="חיפוש משתמשים, הוספת כינוי, בדיקת יתרות ועדכון קרדיטים בחשבון."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {message}
          </div>
        )}

        <section className="admin-card">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-950">
                  רשימת משתמשים
                </h2>
                <p className="text-sm text-gray-500">
                  {usersTotal.toLocaleString('he-IL')} משתמשים · מוצגים{' '}
                  {users.length.toLocaleString('he-IL')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="shrink-0">מיון:</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as AdminUsersSort)}
                    className="admin-field !py-1.5 !w-auto"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setView('cards')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      view === 'cards'
                        ? 'bg-white text-gray-950 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    כרטיסיות
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('table')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      view === 'table'
                        ? 'bg-white text-gray-950 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    טבלה
                  </button>
                </div>
              </div>
            </div>

            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="admin-field"
              placeholder="חיפוש לפי אימייל או כינוי"
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
                  {user.nickname ? `${user.nickname} · ${user.email}` : user.email}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="admin-field"
              placeholder="כמות קרדיטים, למשל 25 או ‎-25"
            />
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="admin-field"
              placeholder="סיבה"
            />
            <button
              type="submit"
              disabled={!creditUserId || creditAmountValue === null || savingCredits}
              className="btn-primary disabled:opacity-50"
            >
              {savingCredits ? 'מעדכן...' : 'עדכון קרדיטים'}
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              לא נמצאו משתמשים
            </div>
          ) : view === 'cards' ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`rounded-lg border p-2.5 transition-all hover:shadow-sm ${
                    user.emailVerified === false
                      ? 'border-amber-300 bg-amber-50/70 hover:border-amber-400'
                      : 'border-gray-200 hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        user.emailVerified === false
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {initials(user)}
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveNickname(user.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="admin-field !py-0.5 !px-2 text-xs"
                            placeholder="כינוי"
                          />
                          <button
                            type="button"
                            onClick={() => void saveNickname(user.id)}
                            disabled={savingNickname}
                            className="text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-gray-950">
                            {user.nickname || 'ללא כינוי'}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            title="עריכת כינוי"
                            className="text-xs text-brand-600 hover:text-brand-800 shrink-0"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                      <p
                        className="truncate text-xs text-gray-500"
                        title={
                          user.createdAt
                            ? `${user.email} · נוצר ${formatDate(user.createdAt)}`
                            : user.email
                        }
                      >
                        {user.email}
                      </p>
                      {user.emailVerified === false && (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          מייל לא אומת
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        user.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                    <div className="rounded-md bg-white/70 py-1">
                      <div className="text-sm font-semibold text-gray-950">
                        {(user.generationsCount ?? 0).toLocaleString('he-IL')}
                      </div>
                      <div className="text-[10px] text-gray-500">יצירות</div>
                    </div>
                    <div className="rounded-md bg-white/70 py-1">
                      <div className="text-sm font-semibold text-gray-950">
                        {user.credits.toLocaleString('he-IL')}
                      </div>
                      <div className="text-[10px] text-gray-500">קרדיטים</div>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-1.5">
                    {quickAddId === user.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="-?[0-9]*"
                          autoFocus
                          value={quickAmount}
                          onChange={(e) => setQuickAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void quickAddCredits(user);
                            if (e.key === 'Escape') cancelQuickAdd();
                          }}
                          className="admin-field !py-1 !px-2 text-xs w-full"
                        />
                        <button
                          type="button"
                          onClick={() => void quickAddCredits(user)}
                          disabled={quickAmountValue === null || quickSaving}
                          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-50"
                        >
                          {quickSaving ? '...' : 'עדכן'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelQuickAdd}
                          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                        >
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openQuickAdd(user)}
                        className="min-w-0 flex-1 rounded-md border border-dashed border-gray-300 py-1 text-xs text-gray-600 transition-colors hover:border-brand-400 hover:text-brand-700"
                      >
                        עדכון קרדיטים
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openTransactions(user)}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                    >
                      תנועות
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-right py-3">כינוי</th>
                    <th className="text-right py-3">אימייל</th>
                    <th className="text-right py-3">אימות</th>
                    <th className="text-right py-3">תפקיד</th>
                    <th className="text-right py-3">יצירות</th>
                    <th className="text-right py-3">קרדיטים</th>
                    <th className="text-right py-3">נוצר</th>
                    <th className="text-right py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-100 ${
                        user.emailVerified === false ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="py-3 font-medium text-gray-950">
                        {editingId === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveNickname(user.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="admin-field !py-1 !px-2 text-sm w-40"
                              placeholder="כינוי"
                            />
                            <button
                              type="button"
                              onClick={() => void saveNickname(user.id)}
                              disabled={savingNickname}
                              className="text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50"
                            >
                              שמירה
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              ביטול
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-700">
                            {user.nickname || '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-950">{user.email}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.emailVerified === false
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {user.emailVerified === false ? 'לא אומת' : 'אומת'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">
                        {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                      </td>
                      <td className="py-3 text-gray-700">
                        {(user.generationsCount ?? 0).toLocaleString('he-IL')}
                      </td>
                      <td className="py-3 text-gray-950">{user.credits}</td>
                      <td className="py-3 text-gray-500">
                        {user.createdAt ? formatDate(user.createdAt) : '-'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {editingId !== user.id && (
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="text-xs text-brand-600 hover:text-brand-800"
                            >
                              עריכת כינוי
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void openTransactions(user)}
                            className="text-xs text-brand-600 hover:text-brand-800"
                          >
                            תנועות
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Infinite scroll sentinel + loading indicator */}
          {!loading && hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && (
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
          {!loading && !hasMore && users.length > 0 && (
            <p className="pt-6 text-center text-xs text-gray-400">
              הצגת כל המשתמשים
            </p>
          )}
        </section>

        {transactionsUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-950">
                    תנועות קרדיטים
                  </h3>
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {transactionsUser.nickname || transactionsUser.email} ·{' '}
                    {transactionsTotal.toLocaleString('he-IL')} תנועות
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTransactions}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                >
                  סגירה
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-5">
                {transactionsMessage && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {transactionsMessage}
                  </div>
                )}

                {transactionsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">
                    אין תנועות קרדיטים למשתמש הזה
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="border-b border-gray-200 text-gray-500">
                        <tr>
                          <th className="py-2 pe-3 text-right">תאריך</th>
                          <th className="py-2 pe-3 text-right">סוג</th>
                          <th className="py-2 pe-3 text-right">כמות</th>
                          <th className="py-2 text-right">סיבה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => {
                          const isCredit = tx.amount > 0;
                          return (
                            <tr key={tx.id} className="border-b border-gray-100">
                              <td className="py-3 pe-3 text-gray-500">
                                {formatDate(tx.createdAt)}
                              </td>
                              <td className="py-3 pe-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isCredit
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {isCredit ? 'זיכוי' : 'חיוב'}
                                </span>
                              </td>
                              <td
                                className={`py-3 pe-3 text-base font-semibold ${
                                  isCredit ? 'text-green-700' : 'text-red-700'
                                }`}
                                dir="ltr"
                              >
                                {isCredit ? '+' : ''}
                                {tx.amount.toLocaleString('he-IL')}
                              </td>
                              <td className="py-3 text-gray-800">
                                <div className="font-medium">
                                  {formatReason(tx.reason)}
                                </div>
                                <div className="mt-1 text-xs text-gray-400">
                                  {tx.reason}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
