'use client';

import { useEffect, useState } from 'react';
import { api, Generation } from '@/lib/api';
import { translateError } from '@/lib/he';
import { Toast, type ToastState } from '@/components/Toast';

export type DeleteToastState = ToastState;

// Shared logic for the "delete this creation" action. Holds the item pending
// confirmation, the in-flight id (for spinner/disabled state) and an
// auto-dismissing toast, so every gallery behaves identically. Pass an
// `onDeleted(id)` callback to remove the item from the local list on success.
export function useDeleteGeneration(onDeleted?: (id: string) => void) {
  const [pendingDelete, setPendingDelete] = useState<Generation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<DeleteToastState | null>(null);

  const requestDelete = (generation: Generation) => {
    if (deletingId) return;
    setPendingDelete(generation);
  };

  const cancelDelete = () => {
    if (deletingId) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return;
    const { id } = pendingDelete;
    setDeletingId(id);
    setToast(null);
    try {
      await api.deleteGeneration(id);
      onDeleted?.(id);
      setToast({ type: 'success', message: 'היצירה נמחקה' });
      setPendingDelete(null);
    } catch (err) {
      setToast({
        type: 'error',
        message:
          err instanceof Error ? translateError(err.message) : 'מחיקת היצירה נכשלה',
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    pendingDelete,
    deletingId,
    toast,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}

export function DeleteToast({ toast }: { toast: DeleteToastState | null }) {
  return <Toast toast={toast} />;
}

export function DeleteConfirmDialog({
  generation,
  deleting,
  onConfirm,
  onCancel,
}: {
  generation: Generation | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!generation) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="card w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">מחיקת יצירה</h2>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          היצירה תוסר מהרשימה שלך ולא תופיע יותר. לא ניתן לשחזר אותה. להמשיך?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? <DeleteSpinnerIcon /> : <TrashIcon />}
            {deleting ? 'מוחק...' : 'מחיקה'}
          </button>
        </div>
      </div>
    </div>
  );
}

// A creation can be deleted only once it has reached a terminal state — an
// in-progress job would just resurface (and the API rejects it anyway).
export function canDeleteGeneration(generation: Generation) {
  return (
    generation.status === 'done' ||
    generation.status === 'failed' ||
    generation.status === 'cancelled'
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function DeleteSpinnerIcon() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
