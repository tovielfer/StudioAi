'use client';

import { useState } from 'react';
import { Generation } from '@/lib/api';
import { GenerationCard } from './GenerationCard';
import { GenerationDetailsModal } from './GenerationDetailsModal';

export function RecentCreations({
  generations,
  loading,
  activeGenId,
  onUseReference,
  onReuse,
  type = 'image',
}: {
  generations: Generation[];
  loading: boolean;
  activeGenId: string | null;
  onUseReference: (url: string) => void;
  onReuse: (gen: Generation) => void;
  type?: 'image' | 'video';
}) {
  const [selected, setSelected] = useState<Generation | null>(null);
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
          עדיין אין יצירות — לחצי על &quot;יצירה&quot; כדי להתחיל
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
        />
      )}
    </div>
  );
}
