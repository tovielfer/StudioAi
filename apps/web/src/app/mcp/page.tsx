'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { CopyButton } from '@/components/generation/CopyButton';
import { api, ApiTokenInfo } from '@/lib/api';

const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:3002/mcp';

export default function McpPage() {
  return (
    <AuthGuard>
      <McpContent />
    </AuthGuard>
  );
}

function McpContent() {
  const [info, setInfo] = useState<ApiTokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    api
      .getApiTokenInfo()
      .then(setInfo)
      .catch(() => setError('טעינת מצב הטוקן נכשלה'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createApiToken();
      setNewToken(res.token);
      setInfo({
        hasToken: true,
        prefix: res.prefix,
        createdAt: res.createdAt,
      });
      setConfirmRevoke(false);
    } catch {
      setError('יצירת הטוקן נכשלה, נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.revokeApiToken();
      setInfo({ hasToken: false, prefix: null, createdAt: null });
      setNewToken(null);
      setConfirmRevoke(false);
    } catch {
      setError('ביטול הטוקן נכשל, נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto px-4 py-10" dir="rtl">
      <div className="glow-orb -top-10 right-0 h-64 w-64 bg-brand-700/25" />

      <div className="relative mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-brand-400 hover:underline"
        >
          ← חזרה לדף הבית
        </Link>
        <h1 className="text-3xl font-bold mt-3">חיבור ל-Claude (MCP)</h1>
        <p className="text-gray-400 mt-2 leading-relaxed">
          חברו את החשבון שלכם ל-Claude (או לכל כלי שתומך ב-MCP) כדי שיצור עבורכם
          תמונות וסרטונים בשפה חופשית. כל יצירה מנכה קרדיטים מהחשבון שלכם, בדיוק
          כמו באתר.
        </p>
      </div>

      {error && (
        <div className="relative mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Step 1: server URL */}
      <section className="relative card mb-6">
        <h2 className="text-lg font-semibold mb-1">1. כתובת השרת</h2>
        <p className="text-sm text-gray-400 mb-3">
          זו הכתובת שמדביקים ב-Claude כשמוסיפים חיבור (Connector) חדש.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-brand-200">
            {MCP_URL}
          </code>
          <CopyButton text={MCP_URL} label="העתקה" />
        </div>
      </section>

      {/* Step 2: token */}
      <section className="relative card mb-6">
        <h2 className="text-lg font-semibold mb-1">2. הטוקן האישי שלכם</h2>
        <p className="text-sm text-gray-400 mb-3">
          הטוקן מזהה אתכם. שמרו אותו בסוד — כל מי שמחזיק בו יכול ליצור על חשבון
          הקרדיטים שלכם. אפשר לבטל וליצור חדש בכל רגע.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : newToken ? (
          <div className="rounded-lg border border-brand-500/40 bg-brand-900/30 p-4">
            <p className="text-sm text-brand-200 mb-2 font-medium">
              העתיקו את הטוקן עכשיו — הוא מוצג פעם אחת בלבד ולא ניתן לשחזור.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 break-all rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-sm text-white">
                {newToken}
              </code>
              <CopyButton text={newToken} label="העתקה" />
            </div>
          </div>
        ) : info?.hasToken ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-300">
                  יש טוקן פעיל:{' '}
                  <code className="text-brand-200">{info.prefix}</code>
                </p>
                {info.createdAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    נוצר בתאריך{' '}
                    {new Date(info.createdAt).toLocaleDateString('he-IL')}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              אם איבדתם את הטוקן, צרו חדש (הישן יפסיק לעבוד מיד).
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            עדיין לא יצרתם טוקן. לחצו על הכפתור למטה כדי ליצור אחד.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="btn-primary disabled:opacity-60"
          >
            {info?.hasToken ? 'צור טוקן חדש' : 'צור טוקן'}
          </button>

          {info?.hasToken &&
            (confirmRevoke ? (
              <>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={busy}
                  className="btn-secondary text-red-300 disabled:opacity-60"
                >
                  לביטול, לחצו שוב
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  disabled={busy}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                disabled={busy}
                className="btn-secondary text-red-300 disabled:opacity-60"
              >
                בטל טוקן
              </button>
            ))}
        </div>
      </section>

      {/* Step 3: instructions */}
      <section className="relative card">
        <h2 className="text-lg font-semibold mb-3">3. חיבור מתוך Claude</h2>
        <ol className="list-decimal pr-5 space-y-2 text-sm text-gray-300 leading-relaxed">
          <li>ב-Claude, פתחו הגדרות והוסיפו Connector / MCP server חדש.</li>
          <li>
            בשדה הכתובת הדביקו את כתובת השרת מסעיף 1.
          </li>
          <li>
            בהרשאה (Authorization) הזינו:{' '}
            <code className="text-brand-200">Bearer &lt;הטוקן שלכם&gt;</code>
          </li>
          <li>
            שמרו, ואז פשוט בקשו מ-Claude, למשל: &quot;צור סרטון של 5 שניות ביחס
            16:9 של זריחה מעל הים&quot;.
          </li>
        </ol>
        <p className="text-xs text-gray-500 mt-4">
          טיפ: אפשר לבקש מ-Claude &quot;בדוק כמה קרדיטים נשארו לי&quot; או
          &quot;הצג את היצירות האחרונות שלי&quot;.
        </p>
      </section>
    </div>
  );
}
