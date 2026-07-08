'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import { api, CreditPackage, Order, OrderStatus } from '@/lib/api';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'ממתין לתשלום',
  approved: 'שולם',
  rejected: 'נדחה',
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const SUMIT_COMPANY_ID = process.env.NEXT_PUBLIC_SUMIT_COMPANY_ID;
const SUMIT_API_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUMIT_API_PUBLIC_KEY;
const SUMIT_CONFIGURED = Boolean(SUMIT_COMPANY_ID && SUMIT_API_PUBLIC_KEY);

interface SumitTokenizeResponse {
  Status: number;
  UserErrorMessage?: string | null;
  TechnicalErrorDetails?: string | null;
  Data?: { SingleUseToken?: string };
}

interface SumitBindOptions {
  CompanyID: number | string;
  APIPublicKey: string;
  FormSelector?: string;
  ResponseLanguage?: string;
  ResponseCallback?: (response: SumitTokenizeResponse) => void;
}

declare global {
  interface Window {
    OfficeGuy?: {
      Payments?: {
        BindFormSubmit: (opts: SumitBindOptions) => void;
      };
    };
    jQuery?: unknown;
  }
}

/** Loads a script once and resolves when ready (deduped by src). */
const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (scriptCache.has(src)) return scriptCache.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}

/** payments.js expects jQuery on the page, then we bind the card form to it. */
async function ensureSumitLoaded(): Promise<void> {
  if (!window.jQuery) {
    await loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
  }
  await loadScript('https://app.sumit.co.il/scripts/payments.js');
}

export default function BuyPage() {
  return (
    <AuthGuard>
      <BuyContent />
    </AuthGuard>
  );
}

function BuyContent() {
  const { user, refreshCredits, refreshUser } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payPkg, setPayPkg] = useState<CreditPackage | null>(null);
  // 'saved' shows the one-tap saved-card modal; 'new' shows the full card form.
  const [payMode, setPayMode] = useState<'saved' | 'new'>('new');

  const load = async () => {
    try {
      const [pkgs, myOrders] = await Promise.all([
        api.getPackages(),
        api.getMyOrders(),
      ]);
      setPackages(pkgs);
      setOrders(myOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Sync the saved-card state from the server (login response omits it).
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const buy = async (pkg: CreditPackage) => {
    setMessage(null);
    setError(null);

    // With a gateway, just open the payment form. The order is created only when
    // the user actually submits payment, so opening the form never leaves a
    // stray "pending" row in the purchases list. If the user already has a saved
    // card, open the one-tap saved-card modal instead of the full form.
    if (SUMIT_CONFIGURED) {
      setPayMode(user?.hasSavedCard ? 'saved' : 'new');
      setPayPkg(pkg);
      return;
    }

    // No gateway configured — fall back to the manual-approval request flow.
    setSubmittingId(pkg.id);
    try {
      await api.createOrder(pkg.id);
      setMessage(
        `הבקשה לרכישת "${pkg.name}" נשלחה. לאחר אישור התשלום הקרדיטים ייכנסו ליתרה שלך.`,
      );
      await Promise.all([load(), refreshCredits()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הבקשה');
    } finally {
      setSubmittingId(null);
    }
  };

  const onPaid = async () => {
    setPayPkg(null);
    setMessage('התשלום בוצע בהצלחה! הקרדיטים נכנסו ליתרה שלך.');
    // refreshUser picks up a newly-saved card so the next buy is one-tap.
    await Promise.all([load(), refreshCredits(), refreshUser()]);
  };

  // In gateway mode a "pending" order is just an unfinished/abandoned payment
  // attempt — don't surface those as purchases. In manual-approval mode pending
  // means "awaiting admin", so keep showing them.
  const visibleOrders = SUMIT_CONFIGURED
    ? orders.filter((o) => o.status !== 'pending')
    : orders;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">קניית קרדיטים</h1>
        {/* <p className="text-gray-400 mt-1">
          משלמים רק על מה שיוצרים — בלי מנוי ובלי תפוגה. ככל שהחבילה גדולה יותר,
          המחיר לקרדיט זול יותר.
        </p> */}
        <p className="text-sm text-gray-500 mt-2">
          היתרה הנוכחית שלך:{' '}
          <span className="text-brand-400 font-semibold">
            {user?.credits ?? 0} קרדיטים
          </span>
        </p>
      </div>

      {message && (
        <div className="card mb-6 border border-green-500/30 bg-green-500/10 text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="card mb-6 border border-red-500/30 bg-red-500/10 text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`card flex flex-col ${
                  pkg.badge ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                {pkg.badge && (
                  <span className="self-start mb-2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                    {pkg.badge}
                  </span>
                )}
                <h3 className="text-lg font-semibold">{pkg.name}</h3>
                <div className="text-3xl font-bold my-2">₪{pkg.priceIls}</div>
                <p className="text-brand-400 text-sm">
                  {pkg.credits.toLocaleString('he-IL')} קרדיטים
                </p>
                <button
                  type="button"
                  onClick={() => buy(pkg)}
                  disabled={submittingId !== null}
                  className="btn-primary mt-5 w-full disabled:opacity-50"
                >
                  {submittingId === pkg.id ? 'רגע...' : 'רכישה'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">הרכישות שלי</h2>
            {visibleOrders.length === 0 ? (
              <p className="text-gray-500">עדיין אין רכישות.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 border-b border-surface-border">
                    <tr>
                      <th className="py-2 text-right">תאריך</th>
                      <th className="py-2 text-right">חבילה</th>
                      <th className="py-2 text-right">מחיר</th>
                      <th className="py-2 text-right">קרדיטים</th>
                      <th className="py-2 text-right">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id} className="border-b border-surface-border/50">
                        <td className="py-2 text-gray-400">
                          {new Date(order.createdAt).toLocaleString('he-IL', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2">{order.packageName}</td>
                        <td className="py-2">₪{order.priceIls}</td>
                        <td className="py-2">
                          {order.credits.toLocaleString('he-IL')}
                        </td>
                        <td className="py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}
                          >
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {payPkg && payMode === 'saved' && (
        <SavedCardModal
          pkg={payPkg}
          last4={user?.savedCardLast4 ?? null}
          brand={user?.savedCardBrand ?? null}
          onClose={() => setPayPkg(null)}
          onPaid={onPaid}
          onUseAnotherCard={() => setPayMode('new')}
        />
      )}

      {payPkg && payMode === 'new' && (
        <PaymentModal
          pkg={payPkg}
          onClose={() => setPayPkg(null)}
          onPaid={onPaid}
        />
      )}
    </div>
  );
}

function SavedCardModal({
  pkg,
  last4,
  brand,
  onClose,
  onPaid,
  onUseAnotherCard,
}: {
  pkg: CreditPackage;
  last4: string | null;
  brand: string | null;
  onClose: () => void;
  onPaid: () => void;
  onUseAnotherCard: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chargingRef = useRef(false);

  const pay = async () => {
    if (chargingRef.current) return;
    chargingRef.current = true;
    setError(null);
    setProcessing(true);
    try {
      const order = await api.createOrder(pkg.id);
      await api.payOrderSaved(order.id);
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'התשלום נכשל. נסה שוב.');
      setProcessing(false);
      chargingRef.current = false;
    }
  };

  const cardLabel = last4
    ? `${brand ? `${brand} ` : ''}•••• ${last4}`
    : 'הכרטיס השמור שלך';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pay-overlay-in">
      <div className="pay-modal-in w-full max-w-md relative rounded-2xl border border-surface-border bg-surface-card shadow-2xl shadow-black/50">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-gray-300 transition-colors hover:bg-black/40 hover:text-white disabled:opacity-40"
          aria-label="סגירה"
        >
          ✕
        </button>

        <div className="relative rounded-t-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 pt-6 pb-5 text-white">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="text-xl font-bold">תשלום מהיר</h2>
          </div>
          <p className="mt-1 text-sm text-white/80">שלם בכרטיס השמור בלחיצה אחת</p>
        </div>

        <div className="mt-4 px-6">
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-lg shadow-black/30">
            <div>
              <p className="font-semibold text-white">{pkg.name}</p>
              <p className="text-xs text-brand-400">
                {pkg.credits.toLocaleString('he-IL')} קרדיטים
              </p>
            </div>
            <div className="text-2xl font-bold text-white">₪{pkg.priceIls}</div>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mb-4 flex items-center gap-3 rounded-lg border border-surface-border bg-surface px-4 py-3">
            <svg
              className="h-5 w-5 text-brand-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span className="font-medium tracking-wide text-white">
              {cardLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={pay}
            disabled={processing}
            className="btn-primary w-full disabled:opacity-50"
          >
            {processing ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                מעבד תשלום...
              </span>
            ) : (
              `שלם ₪${pkg.priceIls}`
            )}
          </button>

          <button
            type="button"
            onClick={onUseAnotherCard}
            disabled={processing}
            className="mt-3 w-full text-center text-sm text-brand-400 transition-colors hover:text-brand-300 disabled:opacity-40"
          >
            תשלום בכרטיס אחר
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  pkg,
  onClose,
  onPaid,
}: {
  pkg: CreditPackage;
  onClose: () => void;
  onPaid: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const chargingRef = useRef(false);
  const chargeRef = useRef<(token: string) => void>(() => {});
  // The order is created lazily on the first charge attempt and reused on
  // retries, so opening the form creates nothing and retries never duplicate it.
  const orderIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true);
  // Read at charge time from a ref so toggling the checkbox doesn't rebind the
  // payments.js form (which is set up once in the effect below).
  const saveCardRef = useRef(true);
  saveCardRef.current = saveCard;

  useEffect(() => {
    let cancelled = false;

    const charge = async (token: string) => {
      if (chargingRef.current) return;
      chargingRef.current = true;
      try {
        if (!orderIdRef.current) {
          const order = await api.createOrder(pkg.id);
          orderIdRef.current = order.id;
        }
        await api.payOrder(orderIdRef.current, token, saveCardRef.current);
        onPaid();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'התשלום נכשל. נסה שוב.');
        setProcessing(false);
        chargingRef.current = false;
        // The single-use token is now spent — clear it so a retry re-tokenizes.
        const tokenInput = formRef.current?.querySelector(
          '#og-token',
        ) as HTMLInputElement | null;
        if (tokenInput) tokenInput.value = '';
      }
    };
    chargeRef.current = charge;

    const form = formRef.current;
    const onSubmit = () => {
      // payments.js prevents the native submit; this only flips the UI into its
      // processing state once tokenization actually starts.
      setError(null);
      setProcessing(true);
      chargingRef.current = false;
    };

    ensureSumitLoaded()
      .then(() => {
        if (cancelled) return;
        // payments.js binds to form[data-og=form]; on submit it reads the
        // [data-og=*] fields, tokenizes the card against SUMIT (card data never
        // hits our server) and returns the SingleUseToken via ResponseCallback.
        window.OfficeGuy?.Payments?.BindFormSubmit({
          CompanyID: SUMIT_COMPANY_ID as string,
          APIPublicKey: SUMIT_API_PUBLIC_KEY as string,
          FormSelector: '#og-pay-form',
          ResponseLanguage: 'he-IL',
          ResponseCallback: (resp) => {
            const token = resp?.Data?.SingleUseToken;
            if (resp?.Status === 0 && token) {
              chargeRef.current(token);
            } else {
              setError(
                resp?.UserErrorMessage ||
                  resp?.TechnicalErrorDetails ||
                  'התשלום נדחה. בדוק את פרטי הכרטיס ונסי שוב.',
              );
              setProcessing(false);
            }
          },
        });
        form?.addEventListener('submit', onSubmit);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('טעינת טופס התשלום נכשלה. רענן ונסה שוב.');
      });

    return () => {
      cancelled = true;
      form?.removeEventListener('submit', onSubmit);
    };
  }, [pkg.id, onPaid]);

  const inputClass =
    'w-full rounded-lg bg-surface border border-surface-border px-3.5 py-2.5 text-base font-medium text-white tracking-wide placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pay-overlay-in">
      <div className="pay-modal-in w-full max-w-md relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-surface-border bg-surface-card shadow-2xl shadow-black/50">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-gray-300 transition-colors hover:bg-black/40 hover:text-white disabled:opacity-40"
          aria-label="סגירה"
        >
          ✕
        </button>

        {/* Gradient header with secure-payment badge */}
        <div className="relative rounded-t-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 pt-6 pb-5 text-white">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="text-xl font-bold">תשלום מאובטח</h2>
          </div>
          <p className="mt-1 text-sm text-white/80">
            התשלום מעובד באמצעות SUMIT בתקן PCI
          </p>
        </div>

        {/* Order summary card */}
        <div className="mt-4 px-6">
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface px-4 py-3 shadow-lg shadow-black/30">
            <div>
              <p className="font-semibold text-white">{pkg.name}</p>
              <p className="text-xs text-brand-400">
                {pkg.credits.toLocaleString('he-IL')} קרדיטים
              </p>
            </div>
            <div className="text-2xl font-bold text-white">
              ₪{pkg.priceIls}
            </div>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6">

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* action/target route any native submit into a throwaway iframe — a
            safety net so the SPA never navigates if binding ever fails. */}
        <form
          id="og-pay-form"
          ref={formRef}
          data-og="form"
          action="about:blank"
          target="og-payment-sink"
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              מספר כרטיס
            </label>
            <input
              data-og="cardnumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">חודש</label>
              <input
                data-og="expirationmonth"
                inputMode="numeric"
                autoComplete="cc-exp-month"
                placeholder="MM"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">שנה</label>
              <input
                data-og="expirationyear"
                inputMode="numeric"
                autoComplete="cc-exp-year"
                placeholder="YY"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">CVV</label>
              <input
                data-og="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              ת"ז בעל הכרטיס
            </label>
            <input
              data-og="citizenid"
              inputMode="numeric"
              placeholder="000000000"
              className={inputClass}
            />
          </div>

          <input type="hidden" name="og-token" id="og-token" />
          <div className="og-errors text-sm text-red-300" />

          <label className="flex items-center gap-2 pt-1 text-sm text-gray-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border bg-surface text-brand-600 focus:ring-brand-500"
            />
            שמור את הכרטיס לרכישות הבאות
          </label>

          <button
            type="submit"
            disabled={!ready || processing}
            className="btn-primary w-full disabled:opacity-50"
          >
            {processing ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                מעבד תשלום...
              </span>
            ) : ready ? (
              `שלם ₪${pkg.priceIls}`
            ) : (
              'טוען...'
            )}
          </button>
        </form>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          פרטי הכרטיס מוצפנים ואינם נשמרים אצלנו.
        </p>

        <iframe
          title="og-payment-sink"
          name="og-payment-sink"
          className="hidden"
        />
        </div>
      </div>
    </div>
  );
}
