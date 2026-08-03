'use client';

export type ToastType = 'success' | 'error';

export interface ToastState {
  type: ToastType;
  message: string;
}

// Shared floating toast used across the app (send-email, delete, recreate…), so
// every transient confirmation looks and animates identically.
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const success = toast.type === 'success';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
      <div
        className={`toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-md ${
          success
            ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50'
            : 'border-red-400/30 bg-red-500/15 text-red-50'
        }`}
        role="status"
        aria-live="polite"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            success
              ? 'bg-emerald-500/25 text-emerald-200'
              : 'bg-red-500/25 text-red-200'
          }`}
        >
          {success ? <CheckIcon /> : <AlertIcon />}
        </span>
        <span className="text-sm font-semibold leading-5">{toast.message}</span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
