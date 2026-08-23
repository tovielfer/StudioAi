'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useSendGenerationEmail, EmailToast } from '@/components/SendEmail';
import {
  useDeleteGeneration,
  DeleteConfirmDialog,
  DeleteToast,
} from '@/components/DeleteGeneration';
import { GenerationCard } from '@/components/generation/GenerationCard';
import { GenerationDetailsModal } from '@/components/generation/GenerationDetailsModal';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, refreshCredits } = useAuth();
  const [recent, setRecent] = useState<Generation[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const { sendingId, toast, sendEmail } = useSendGenerationEmail();

  const {
    pendingDelete,
    deletingId,
    toast: deleteToast,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useDeleteGeneration((id) => {
    setRecent((prev) => prev.filter((g) => g.id !== id));
    setSelectedGeneration((current) => (current?.id === id ? null : current));
  });

  useEffect(() => {
    if (!user) return;
    refreshCredits();
    // Failed/cancelled creations are hidden from the dashboard — it only surfaces
    // successful (and still in-progress) work.
    api
      .getUserGenerations(user.id, {
        excludeStatus: 'failed,cancelled',
        limit: 6,
      })
      .then((res) => setRecent(res.items))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getEditHref = (generation: Generation) => {
    const params = new URLSearchParams({ prompt: generation.prompt });
    if (generation.type !== 'video') {
      params.set('reference', generation.resultUrl ?? '');
    }
    return `${generation.type === 'video' ? '/create-video' : '/create'}?${params.toString()}`;
  };

  return (
    <div className="relative max-w-6xl mx-auto px-4 py-10">
      <div className="glow-orb -top-10 right-0 h-64 w-64 bg-brand-700/25" />

      <div className="relative flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">דף הבית</h1>
          <p className="text-gray-400 mt-1">שלום, {user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/create" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon />
            תמונה חדשה
          </Link>
          <Link href="/create-video" className="btn-secondary inline-flex items-center gap-2">
            <PlusIcon />
            סרטון חדש
          </Link>
          <Link href="/mcp" className="btn-secondary inline-flex items-center gap-2">
            חיבור ל-Claude
          </Link>
        </div>
      </div>

      <div className="relative grid md:grid-cols-3 gap-6 mb-10">
        <div className="relative overflow-hidden rounded-xl border border-brand-700/40 bg-gradient-to-br from-brand-900/50 to-surface-card p-6">
          <div className="glow-orb -bottom-12 -left-6 h-32 w-32 bg-brand-600/40" />
          <div className="relative flex items-center gap-2 text-sm text-brand-200">
            <CreditIcon />
            יתרת קרדיטים
          </div>
          <p className="relative text-4xl font-bold mt-2 gradient-text">
            {user?.credits ?? 0}
          </p>
        </div>
        <div className="card-interactive md:col-span-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-400">צריכים עוד קרדיטים?</p>
            <p className="text-lg font-semibold mt-1">
              בחרו חבילה והמשיכו ליצור בלי הפסקה
            </p>
          </div>
          <Link href="/buy" className="btn-primary whitespace-nowrap">
            לרכישת קרדיטים
          </Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">יצירות אחרונות</h2>
          <Link href="/history" className="text-sm text-brand-400 hover:underline">
            הצג הכל
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 mb-4">עדיין אין יצירות</p>
            <Link href="/create" className="btn-primary">
              צור את התמונה הראשונה שלך
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recent.map((gen) => (
              <GenerationCard
                key={gen.id}
                gen={gen}
                onSelect={setSelectedGeneration}
                getEditHref={getEditHref}
                onSendEmail={sendEmail}
                sendingEmail={sendingId === gen.id}
                onDelete={requestDelete}
                deleting={deletingId === gen.id}
                footer="status"
              />
            ))}
          </div>
        )}
      </div>

      {selectedGeneration && (
        <GenerationDetailsModal
          generation={selectedGeneration}
          getEditHref={getEditHref}
          onClose={() => setSelectedGeneration(null)}
          onSendEmail={sendEmail}
          sendingEmail={sendingId === selectedGeneration.id}
          onDelete={requestDelete}
          deleting={deletingId === selectedGeneration.id}
        />
      )}

      <DeleteConfirmDialog
        generation={pendingDelete}
        deleting={Boolean(deletingId)}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <DeleteToast toast={deleteToast} />
      <EmailToast toast={toast} />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CreditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
