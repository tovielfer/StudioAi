'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  resolution,
  setResolution,
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
  submitting,
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
  resolution: string;
  setResolution: (v: string) => void;
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
  submitting: boolean;
  onGenerate: () => void;
  error: string;
}) {
  const isVideo = selectedModel.type === 'video';
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    const field = promptRef.current;
    if (!field) return;

    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 420)}px`;
  }, [prompt]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="block text-sm text-gray-400">תיאור (Prompt)</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPromptExpanded((value) => !value)}
              className="text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              עריכה נוחה
            </button>
            <span className="text-xs text-gray-500">{prompt.length}/2000</span>
          </div>
        </div>
        <textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="input-field min-h-[180px] max-h-[420px] resize-y overflow-y-auto leading-7 overscroll-contain"
          placeholder={isVideo ? 'תארו את תנועת הווידאו שברצונכם ליצור...' : 'תארו את התמונה שברצונכם ליצור...'}
          maxLength={2000}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          לפרומפט ארוך במיוחד אפשר לפתוח עריכה נוחה בחלון גדול.
        </p>
      </div>

      {isPromptExpanded && portalTarget && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-3xl rounded-2xl border border-surface-border bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-surface-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">עריכת פרומפט</h2>
                <p className="text-xs text-gray-500">{prompt.length}/2000 תווים</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptExpanded(false)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-300 hover:bg-surface"
              >
                סגור
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="input-field h-[60vh] min-h-[320px] resize-none overflow-y-auto leading-7"
                placeholder={isVideo ? 'תארו את תנועת הווידאו שברצונכם ליצור...' : 'תארו את התמונה שברצונכם ליצור...'}
                maxLength={2000}
                autoFocus
              />
            </div>
          </div>
        </div>,
        portalTarget,
      )}

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
        {selectedModel.sizes.length > 1 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">יחס</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="input-field">
              {selectedModel.sizes.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
        {selectedModel.resolutions.length > 1 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">רזולציה</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input-field">
              {selectedModel.resolutions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
        {selectedModel.qualities.length > 1 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">איכות</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} className="input-field">
              {selectedModel.qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.label}</option>
              ))}
            </select>
          </div>
        )}
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
          {isVideo ? 'תמונת התחלה לווידאו' : 'תמונות השראה'} (אופציונלי, עד {MAX_REFERENCES})
        </label>
        <p className="text-xs text-gray-500 mb-2">
          {isVideo
            ? 'אפשר ליצור מטקסט בלבד, או לגרור תמונה כדי להנפיש אותה'
            : 'גררו תמונה מהמחשב או מהיצירות האחרונות לכאן'}
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
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleReferenceChange}
              className="input-field file:me-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-600 file:text-white file:text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">כל תמונה עד 7MB</p>
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
          disabled={submitting || cost === null || (user?.credits ?? 0) < (cost ?? 0)}
          className="btn-primary"
        >
          {submitting ? 'שולחת...' : isVideo ? 'יצירת וידאו' : 'יצירה'}
        </button>
      </div>
    </div>
  );
}
