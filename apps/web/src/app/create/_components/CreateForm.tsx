'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

function AudioIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="m17 9 4 6m0-6-4 6" />
      )}
    </svg>
  );
}

function VideoFrameSlot({
  label,
  reference,
  disabled = false,
  onFile,
  onRemove,
}: {
  label: string;
  reference?: ReferenceImage;
  disabled?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith('image/'),
    );
    if (file) onFile(file);
  };

  return (
    <div className="flex-1 min-w-0">
      <label className="mb-1.5 block text-sm text-gray-400">
        {label}
        <span className="text-gray-600"> · אופציונלי</span>
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex h-24 items-center justify-center rounded-lg border border-dashed transition-colors ${
          dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border'
        } ${disabled ? 'opacity-40' : ''}`}
      >
        {reference ? (
          <>
            <img
              src={reference.previewUrl}
              alt={label}
              className="h-full w-full rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white transition-colors hover:bg-red-600"
              aria-label="הסר תמונה"
            >
              ×
            </button>
          </>
        ) : (
          <label
            className={`flex h-full w-full flex-col items-center justify-center gap-1 text-gray-500 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-brand-300'
            }`}
          >
            <PlusIcon />
            <span className="text-[11px] leading-none">
              {disabled ? 'הוסיפו תמונת התחלה' : 'הוספה'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}

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
  duration,
  setDuration,
  generateAudio,
  setGenerateAudio,
  isVideo,
  selectedModel,
  references,
  removeReference,
  setReferenceSlotFile,
  removeReferenceSlot,
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
  duration: string;
  setDuration: (v: string) => void;
  generateAudio: boolean;
  setGenerateAudio: (v: boolean) => void;
  isVideo: boolean;
  selectedModel: ModelOption;
  references: ReferenceImage[];
  removeReference: (i: number) => void;
  setReferenceSlotFile: (index: number, file: File) => void;
  removeReferenceSlot: (index: number) => void;
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
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  // Seedance reference-to-video takes multiple reference images (referenced in
  // the prompt as [Image1]…) rather than ordered start/end frames.
  const isReferenceMode = selectedModel.id === 'seedance-v2-ref';

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

      <div className="flex flex-col lg:flex-1 lg:min-h-[180px]">
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
            הרחב
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

      <div className="lg:shrink-0">
        <label className="block text-sm text-gray-400 mb-1.5">מודל</label>
        <FancySelect
          value={model}
          onChange={handleModelChange}
          options={models.map((m) => ({ value: m.id, label: `${m.name} ` }))}
        />
      </div>

      {!isVideo && (
        <div className="flex flex-nowrap gap-3 lg:shrink-0">
          {selectedModel.sizes.length > 1 && (
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-gray-400 mb-1.5">יחס תמונה</label>
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
              <label className="block text-sm text-gray-400 mb-1.5">רזולוציה</label>
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
              <label className="block text-sm text-gray-400 mb-1.5">איכות יצירה</label>
              <FancySelect
                value={quality}
                onChange={setQuality}
                options={selectedModel.qualities.map((q) => ({ value: q.id, label: q.label }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Video controls — compact row: aspect, clip length and audio toggle. */}
      {isVideo && (
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {selectedModel.sizes.length > 1 && (
            <div className="w-28">
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
            <div className="w-28">
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
          {(selectedModel.durations?.length ?? 0) > 1 && (
            <div className="w-24">
              <FancySelect
                value={duration}
                onChange={setDuration}
                options={(selectedModel.durations ?? []).map((d) => ({
                  value: d.id,
                  label: d.label,
                  shortLabel: `${d.id} ש׳`,
                }))}
              />
            </div>
          )}
          {selectedModel.supportsAudio && (
            <button
              type="button"
              role="switch"
              aria-checked={generateAudio}
              title={generateAudio ? 'אודיו פעיל — לחצו לכיבוי' : 'אודיו כבוי — לחצו להפעלה'}
              onClick={() => setGenerateAudio(!generateAudio)}
              className={`inline-flex h-[42px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                generateAudio
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-surface-border bg-surface-card text-gray-500 hover:text-gray-300'
              }`}
            >
              <AudioIcon on={generateAudio} />
            </button>
          )}
        </div>
      )}

      {/* Reference images. Standard video uses two ordered slots (start/end
          frame); reference-to-video and images use a multi-image drop zone. */}
      {isVideo && !isReferenceMode ? (
        <div className="flex flex-nowrap gap-3 lg:shrink-0">
          <VideoFrameSlot
            label="תמונת התחלה"
            reference={references[0]}
            onFile={(file) => setReferenceSlotFile(0, file)}
            onRemove={() => removeReferenceSlot(0)}
          />
          <VideoFrameSlot
            label="תמונת סיום"
            reference={references[1]}
            disabled={!references[0]}
            onFile={(file) => setReferenceSlotFile(1, file)}
            onRemove={() => removeReferenceSlot(1)}
          />
        </div>
      ) : (
        <div className="lg:shrink-0">
          <label className="mb-1.5 block text-sm text-gray-400">
            {isReferenceMode ? 'תמונות ייחוס' : 'תמונות השראה'}
            <span className="text-gray-600"> · אופציונלי</span>
          </label>
          {isReferenceMode && (
            <p className="mb-1.5 text-[11px] leading-snug text-gray-500">
              הוסיפו עד {MAX_REFERENCES} תמונות והפנו אליהן בפרומפט עם ‎[Image1]‎,‏ ‎[Image2]‎ וכך הלאה.
            </p>
          )}
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
      )}

      <div className="flex items-center justify-between pt-2 lg:shrink-0">
        <div className="text-sm text-gray-400">
          עלות:{' '}
          <span className="text-brand-400 font-medium">
            {costLoading ? (
              <span className="inline-flex items-center align-middle">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <span className="sr-only">מחשב עלות</span>
              </span>
            ) : cost !== null ? (
              `${cost} קרדיטים`
            ) : (
              costError || 'לא זמין'
            )}
          </span>
          {' · '}יתרה: {user?.credits ?? 0}
          <Link
            href="/buy"
            className="mr-2 inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-300 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            קניית קרדיטים
          </Link>
        </div>
        <button
          onClick={onGenerate}
          disabled={prompt.trim().length === 0 || submitting || cost === null || (user?.credits ?? 0) < (cost ?? 0)}
          className="btn-primary"
        >
          {submitting ? 'שולח...' : isVideo ? 'צור' : 'יצירה'}
        </button>
      </div>
    </div>
  );
}
