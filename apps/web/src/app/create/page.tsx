'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  MODELS,
  Generation,
} from '@/lib/api';
import { translateError } from '@/lib/he';

export default function CreatePage() {
  return (
    <AuthGuard>
      <CreateContent />
    </AuthGuard>
  );
}

function CreateContent() {
  const { user, refreshCredits } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState('1:1');
  const [quality, setQuality] = useState('standard');
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [currentGen, setCurrentGen] = useState<Generation | null>(null);
  const [error, setError] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const hasReference = referenceFiles.length > 0;
  const MAX_REFERENCES = 5;

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const newModelDef = MODELS.find((m) => m.id === newModel);
    if (newModelDef && !newModelDef.sizes.find((s) => s.id === size)) {
      setSize(newModelDef.sizes[0].id);
    }
    if (newModelDef && !newModelDef.qualities.find((q) => q.id === quality)) {
      setQuality(newModelDef.qualities[0].id);
    }
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const MAX_SIZE = 20 * 1024 * 1024;
    const valid = selected.filter((f) => f.size <= MAX_SIZE);
    const skipped = selected.filter((f) => f.size > MAX_SIZE);

    if (skipped.length > 0) {
      setError(
        skipped.length === 1
          ? `"${skipped[0].name}" גדולה מ-20MB ולא נוספה`
          : `${skipped.length} תמונות גדולות מ-20MB ולא נוספו`,
      );
    } else {
      setError('');
    }

    if (valid.length === 0) {
      e.target.value = '';
      return;
    }

    const remaining = MAX_REFERENCES - referenceFiles.length;
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length === 0) {
      setError(`ניתן להעלות עד ${MAX_REFERENCES} תמונות השראה`);
      e.target.value = '';
      return;
    }

    setReferenceFiles((prev) => [...prev, ...toAdd]);
    setReferencePreviews((prev) => [
      ...prev,
      ...toAdd.map((f) => URL.createObjectURL(f)),
    ]);
    e.target.value = '';
  };

  const removeReference = (index: number) => {
    setReferencePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const pollGeneration = useCallback(async (id: string) => {
    const gen = await api.getGeneration(id);
    setCurrentGen(gen);
    if (gen.status === 'pending' || gen.status === 'processing') {
      setTimeout(() => pollGeneration(id), 2000);
    } else {
      setGenerating(false);
      refreshCredits();
    }
  }, [refreshCredits]);

  useEffect(() => {
    let cancelled = false;

    setCostLoading(true);
    setCostError('');

    api.getGenerationCostPreview({
      provider: selectedModel.provider,
      model: selectedModel.id,
      size,
      quality,
      hasReference,
    })
      .then((preview) => {
        if (!cancelled) setCost(preview.credits);
      })
      .catch(() => {
        if (!cancelled) {
          setCost(null);
          setCostError('לא ניתן לחשב את העלות כרגע');
        }
      })
      .finally(() => {
        if (!cancelled) setCostLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel.provider, selectedModel.id, size, quality, hasReference]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(translateError('Please enter a prompt'));
      return;
    }

    if (cost === null) {
      setError('לא ניתן ליצור לפני חישוב העלות');
      return;
    }

    setError('');
    setGenerating(true);
    setCurrentGen(null);

    try {
      let referenceImageUrls: string[] | undefined;
      if (referenceFiles.length > 0) {
        const uploads = await Promise.all(
          referenceFiles.map((f) => api.uploadReference(f)),
        );
        referenceImageUrls = uploads.map((u) => u.url);
      }

      const gen = await api.createGeneration({
        prompt: prompt.trim(),
        model: selectedModel.id,
        size,
        quality,
        provider: selectedModel.provider,
        referenceImageUrls,
      });

      setCurrentGen(gen);
      refreshCredits();
      pollGeneration(gen.id);
    } catch (err) {
      setError(
        translateError(
          err instanceof Error ? err.message : 'Generation failed',
        ),
      );
      setGenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      referencePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">יצירת תמונה</h1>

      <div className="grid lg:grid-cols-2 gap-8">
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
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="input-field"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">גודל</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="input-field"
              >
                {selectedModel.sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">איכות</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="input-field"
              >
                {selectedModel.qualities.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              תמונות השראה (אופציונלי, עד {MAX_REFERENCES})
            </label>
            {referencePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {referencePreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={src}
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
            {referenceFiles.length < MAX_REFERENCES && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReferenceChange}
                  className="input-field file:me-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-600 file:text-white file:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">כל תמונה חייבת להיות עד 20MB</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-400">
              עלות:{' '}
              <span className="text-brand-400 font-medium">
                {costLoading
                  ? 'מחשב...'
                  : cost !== null
                    ? `${cost} קרדיטים`
                    : costError || 'לא זמין'}
              </span>
              {' · '}
              יתרה: {user?.credits ?? 0}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || cost === null || (user?.credits ?? 0) < cost}
              className="btn-primary"
            >
              {generating ? 'יוצר...' : 'יצירה'}
            </button>
          </div>
        </div>

        <div className="card flex flex-col">
          <h2 className="text-lg font-semibold mb-4">תצוגה מקדימה</h2>
          <div className="flex-1 aspect-square bg-surface rounded-lg overflow-hidden flex items-center justify-center">
            {currentGen?.resultUrl && currentGen.status === 'done' ? (
              <img
                src={currentGen.resultUrl}
                alt={currentGen.prompt}
                className="w-full h-full object-contain"
              />
            ) : generating ? (
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-sm">
                  {currentGen?.status === 'processing'
                    ? 'ה-AI יוצר את התמונה שלך...'
                    : 'ממתין בתור לעיבוד...'}
                </p>
              </div>
            ) : currentGen?.status === 'failed' ? (
              <div className="text-center text-red-400 px-4">
                <p className="font-medium">היצירה נכשלה</p>
                <p className="text-sm mt-1">{currentGen.errorMessage}</p>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">
                התמונה שתיווצר תופיע כאן
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
