'use client';

import { useState } from 'react';
import { Generation } from '@/lib/api';
import { useSendGenerationEmail, EmailToast } from '@/components/SendEmail';
import {
  useDeleteGeneration,
  DeleteConfirmDialog,
  DeleteToast,
} from '@/components/DeleteGeneration';
import { GenerationCard } from './GenerationCard';
import { GenerationDetailsModal } from './GenerationDetailsModal';

export function RecentCreations({
  generations,
  loading,
  activeGenId,
  onUseReference,
  onReuse,
  onDeleted,
  type = 'image',
}: {
  generations: Generation[];
  loading: boolean;
  activeGenId: string | null;
  onUseReference: (url: string) => void;
  onReuse: (gen: Generation) => void;
  onDeleted?: (id: string) => void;
  type?: 'image' | 'video';
}) {
  const [selected, setSelected] = useState<Generation | null>(null);
  const { sendingId, toast, sendEmail } = useSendGenerationEmail();
  const {
    pendingDelete,
    deletingId,
    toast: deleteToast,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useDeleteGeneration((id) => {
    onDeleted?.(id);
    setSelected((current) => (current?.id === id ? null : current));
  });
  const isVideo = type === 'video';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">היצירות האחרונות</h2>
          <p className="text-sm text-gray-500">
            {isVideo
              ? 'הסרטונים שנוצרו במסך הווידאו'
              : 'גררו תמונה לאזור ההשראה כדי להשתמש בה כרפרנס'}
          </p>
        </div>
        {generations.length > 0 && (
          <span className="text-xs text-gray-500">{generations.length} יצירות</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          עדיין אין יצירות — לחץ על &quot;יצירה&quot; כדי להתחיל
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {generations.map((gen) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              isActive={gen.id === activeGenId}
              onUseReference={onUseReference}
              onReuse={onReuse}
              onSelect={setSelected}
              onSendEmail={sendEmail}
              sendingEmail={sendingId === gen.id}
              onDelete={requestDelete}
              deleting={deletingId === gen.id}
            />
          ))}
        </div>
      )}

      {selected && (
        <GenerationDetailsModal
          generation={selected}
          onUseReference={onUseReference}
          onReuse={onReuse}
          onClose={() => setSelected(null)}
          onSendEmail={sendEmail}
          sendingEmail={sendingId === selected.id}
          onDelete={requestDelete}
          deleting={deletingId === selected.id}
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
