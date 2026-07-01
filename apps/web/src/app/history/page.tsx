'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { FancySelect } from '@/app/create/_components/FancySelect';
import { useSendGenerationEmail, EmailToast } from '@/components/SendEmail';
import { useAuth } from '@/lib/auth-context';
import { api, Generation } from '@/lib/api';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { translateError } from '@/lib/he';
import {
  useDeleteGeneration,
  DeleteConfirmDialog,
  DeleteToast,
} from '@/components/DeleteGeneration';
import { GenerationCard } from '@/components/generation/GenerationCard';
import { GenerationDetailsModal } from '@/components/generation/GenerationDetailsModal';
import { Toast } from '@/components/Toast';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'כל הסוגים' },
  { value: 'image', label: 'תמונות' },
  { value: 'video', label: 'וידאו' },
  { value: 'upscale', label: 'הגדלות' },
];

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}

function HistoryContent() {
  const { user } = useAuth();
  const [selectedGeneration, setSelectedGeneration] =
    useState<Generation | null>(null);
  const [filter, setFilter] = useState<string>('');
  const { sendingId, toast, sendEmail } = useSendGenerationEmail();

  const fetchPage = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      user
        ? api.getUserGenerations(user.id, {
            type: filter || undefined,
            limit,
            offset,
          })
        : Promise.resolve({ items: [] as Generation[], total: 0 }),
    [user, filter],
  );

  const {
    items: generations,
    setItems: setGenerations,
    total,
    setTotal,
    loading,
    loadingMore,
    hasMore,
    sentinelRef,
    reload,
  } = useInfiniteList<Generation>(fetchPage, { pageSize: 24 });

  const {
    pendingDelete,
    deletingId,
    toast: deleteToast,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useDeleteGeneration((id) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedGeneration((current) => (current?.id === id ? null : current));
  });

  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [recreateMsg, setRecreateMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // The recreate action in history retries immediately (the credits were already
  // refunded on failure), then reloads the list to surface the new generation.
  const handleRecreate = useCallback(
    async (gen: Generation) => {
      if (recreatingId) return;
      setRecreatingId(gen.id);
      setRecreateMsg(null);
      try {
        await api.recreateGeneration(gen);
        setRecreateMsg({ type: 'success', text: 'היצירה נשלחה מחדש' });
        setSelectedGeneration(null);
        reload();
      } catch (err) {
        setRecreateMsg({
          type: 'error',
          text:
            err instanceof Error ? translateError(err.message) : 'היצירה מחדש נכשלה',
        });
      } finally {
        setRecreatingId(null);
      }
    },
    [recreatingId, reload],
  );

  useEffect(() => {
    if (!recreateMsg) return;
    const timer = setTimeout(() => setRecreateMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [recreateMsg]);

  const getEditHref = (generation: Generation) => {
    const params = new URLSearchParams({ prompt: generation.prompt });
    if (generation.type !== 'video') {
      params.set('reference', generation.resultUrl ?? '');
    }
    return `${generation.type === 'video' ? '/create-video' : '/create'}?${params.toString()}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">היסטוריה</h1>
          <p className="text-gray-400 mt-1">{total} יצירות בסך הכל</p>
        </div>
        <div className="w-40">
          <FancySelect
            value={filter}
            options={TYPE_FILTER_OPTIONS}
            onChange={setFilter}
            placeholder="כל הסוגים"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : generations.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400">לא נמצאו יצירות</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              onSelect={setSelectedGeneration}
              getEditHref={getEditHref}
              onRecreate={handleRecreate}
              onSendEmail={sendEmail}
              sendingEmail={sendingId === gen.id}
              onDelete={requestDelete}
              deleting={deletingId === gen.id}
            />
          ))}
        </div>
      )}

      {!loading && hasMore && <div ref={sentinelRef} className="h-px" />}

      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedGeneration && (
        <GenerationDetailsModal
          generation={selectedGeneration}
          getEditHref={getEditHref}
          onClose={() => setSelectedGeneration(null)}
          onSendEmail={sendEmail}
          sendingEmail={sendingId === selectedGeneration.id}
          onRecreate={handleRecreate}
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

      <Toast
        toast={
          recreateMsg
            ? { type: recreateMsg.type, message: recreateMsg.text }
            : null
        }
      />

      <EmailToast toast={toast} />
    </div>
  );
}
