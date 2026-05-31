'use client';

import { ModelOption, User } from '@/lib/api';

export type ReferenceImage = {
  id: string;
  previewUrl: string;
  file?: File;
  sourceUrl?: string;
  objectUrl?: boolean;
};

export const MAX_REFERENCES = 5;

export function CreateForm({
  prompt,
  setPrompt,
  model,
  handleModelChange,
  models,
  size,
  setSize,
  quality,
  setQuality,
  selectedModel,
  references,
  removeReference,
  isDragOver,
  setIsDragOver,
  handleReferenceDrop,
  handleReferenceChange,
  cost,
  costLoading,
  costError,
  user,
  generating,
  onGenerate,
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  model: string;
  handleModelChange: (v: string) => void;
  models: ModelOption[];
  size: string;
  setSize: (v: string) => void;
  quality: string;
  setQuality: (v: string) => void;
  selectedModel: ModelOption;
  references: ReferenceImage[];
  removeReference: (i: number) => void;
  isDragOver: boolean;
  setIsDragOver: (v: boolean) => void;
  handleReferenceDrop: (e: React.DragEvent) => void;
  handleReferenceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cost: number | null;
  costLoading: boolean;
  costError: string;
  user: User | null;
  generating: boolean;
  onGenerate: () => void;
  error: string;
}) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">תיאור (Prompt)</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="input-field min-h-[120px] resize-y"
          placeholder="תאר את התמונה שברצונך ליצור..."
          maxLength={2000}
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">מודל</label>
        <select value={model} onChange={(e) => handleModelChange(e.target.value)} className="input-field">
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">גודל</label>
          <select value={size} onChange={(e) => setSize(e.target.value)} className="input-field">
            {selectedModel.sizes.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">איכות</label>
          <select value={quality} onChange={(e) => setQuality(e.target.value)} className="input-field">
            {selectedModel.qualities.map((q) => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reference drop zone — accepts files from disk AND URLs from gallery */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isDragOver) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleReferenceDrop}
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
          isDragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border'
        }`}
      >
        <label className="block text-sm text-gray-400 mb-1">
          תמונות השראה (אופציונלי, עד {MAX_REFERENCES})
        </label>
        <p className="text-xs text-gray-500 mb-2">
          גררו תמונה מהמחשב או מהיצירות האחרונות לכאן
        </p>
        {references.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {references.map((ref, i) => (
              <div key={ref.id} className="relative group">
                <img
                  src={ref.previewUrl}
                  alt={`תמונת השראה ${i + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-surface-border"
                />
                <button
                  type="button"
                  onClick={() => removeReference(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center leading-none transition-colors"
                  aria-label="הסר תמונה"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {references.length < MAX_REFERENCES && (
          <>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleReferenceChange}
              className="input-field file:me-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-600 file:text-white file:text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">כל תמונה עד 20MB</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-gray-400">
          עלות:{' '}
          <span className="text-brand-400 font-medium">
            {costLoading ? 'מחשב...' : cost !== null ? `${cost} קרדיטים` : costError || 'לא זמין'}
          </span>
          {' · '}יתרה: {user?.credits ?? 0}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating || cost === null || (user?.credits ?? 0) < (cost ?? 0)}
          className="btn-primary"
        >
          {generating ? 'יוצרת...' : 'יצירה'}
        </button>
      </div>
    </div>
  );
}
