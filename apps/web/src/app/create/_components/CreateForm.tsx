'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModelOption, User } from '@/lib/api';
import { AspectRatioIcon, FancySelect } from './FancySelect';
import { EditIcon, PlusIcon } from './icons';

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
  onClearPrompt,
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
  onClearPrompt: () => void;
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
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  return (
    <div className="flex flex-col gap-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-1">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="block text-sm text-gray-400">תיאור (Prompt)</label>
          <div className="flex items-center gap-3">
            {prompt.length > 0 && (
              <button
                type="button"
                onClick={onClearPrompt}
                className="text-xs text-gray-500 transition-colors hover:text-red-400"
                title="נקה את הפרומפט"
              >
                נקה
              </button>
            )}
            <span className="text-xs text-gray-500">{prompt.length}/2000</span>
          </div>
        </div>
        <div className="relative flex-1 lg:min-h-[120px]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="input-field h-40 w-full resize-none overflow-y-auto leading-7 overscroll-contain pb-9 lg:h-full"
            placeholder={isVideo ? 'תארו את תנועת הווידאו שברצונכם ליצור...' : 'תארו את התמונה שברצונכם ליצור...'}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={() => setIsPromptExpanded(true)}
            title="עריכה נוחה בחלון גדול"
            aria-label="עריכה נוחה בחלון גדול"
            className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-surface/80 px-2 py-1 text-xs text-gray-400 backdrop-blur transition-colors hover:text-brand-300"
          >
            <EditIcon />
            עריכה נוחה
          </button>
        </div>
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
        <FancySelect
          value={model}
          onChange={handleModelChange}
          options={models.map((m) => ({ value: m.id, label: `${m.name} (${m.provider})` }))}
        />
      </div>

      <div className="flex flex-nowrap gap-3">
        {selectedModel.sizes.length > 1 && (
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-400 mb-1.5">יחס</label>
            <FancySelect
              value={size}
              onChange={setSize}
              options={selectedModel.sizes.map((s) => ({
                value: s.id,
                label: s.label,
                shortLabel: s.id,
                icon: <AspectRatioIcon ratio={s.id} />,
              }))}
            />
          </div>
        )}
        {selectedModel.resolutions.length > 1 && (
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-400 mb-1.5">רזולציה</label>
            <FancySelect
              value={resolution}
              onChange={setResolution}
              options={selectedModel.resolutions.map((r) => ({
                value: r.id,
                label: r.label,
                shortLabel: r.id,
              }))}
            />
          </div>
        )}
        {selectedModel.qualities.length > 1 && (
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-400 mb-1.5">איכות</label>
            <FancySelect
              value={quality}
              onChange={setQuality}
              options={selectedModel.qualities.map((q) => ({ value: q.id, label: q.label }))}
            />
          </div>
        )}
      </div>

      {/* Reference drop zone — accepts files from disk AND URLs from gallery */}
      <div>
        <label className="mb-1.5 block text-sm text-gray-400">
          {isVideo ? 'תמונת התחלה' : 'תמונות השראה'}
          <span className="text-gray-600"> · אופציונלי</span>
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); if (!isDragOver) setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleReferenceDrop}
          className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 transition-colors ${
            isDragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border'
          }`}
        >
          {references.map((ref, i) => (
            <div key={ref.id} className="relative group">
              <img
                src={ref.previewUrl}
                alt={`תמונת השראה ${i + 1}`}
                className="h-16 w-16 rounded-md border border-surface-border object-cover"
              />
              <button
                type="button"
                onClick={() => removeReference(i)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white transition-colors hover:bg-red-600"
                aria-label="הסר תמונה"
              >
                ×
              </button>
            </div>
          ))}
          {references.length < MAX_REFERENCES && (
            <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-surface-border text-gray-500 transition-colors hover:border-brand-500/60 hover:text-brand-300">
              <PlusIcon />
              <span className="text-[11px] leading-none">הוספה</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleReferenceChange}
                className="hidden"
              />
            </label>
          )}
          {references.length === 0 && (
            <span className="px-1 text-xs text-gray-500">גררו תמונה לכאן או לחצו על +</span>
          )}
        </div>
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
