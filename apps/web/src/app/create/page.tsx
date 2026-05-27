'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  MODELS,
  estimateCost,
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
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [currentGen, setCurrentGen] = useState<Generation | null>(null);
  const [error, setError] = useState('');

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const cost = estimateCost(quality, !!referenceFile);

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
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(translateError('Reference image must be under 5MB'));
      return;
    }
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
    setError('');
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(translateError('Please enter a prompt'));
      return;
    }

    setError('');
    setGenerating(true);
    setCurrentGen(null);

    try {
      let referenceImageUrl: string | undefined;
      if (referenceFile) {
        const upload = await api.uploadReference(referenceFile);
        referenceImageUrl = upload.url;
      }

      const gen = await api.createGeneration({
        prompt: prompt.trim(),
        model: selectedModel.id,
        size,
        quality,
        provider: selectedModel.provider,
        referenceImageUrl,
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
      if (referencePreview) URL.revokeObjectURL(referencePreview);
    };
  }, [referencePreview]);

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
                    {q.label} ({q.credits} קרדיטים)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              תמונת השראה (אופציונלי, +5 קרדיטים)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleReferenceChange}
              className="input-field file:me-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-600 file:text-white file:text-sm"
            />
            {referencePreview && (
              <img
                src={referencePreview}
                alt="תמונת השראה"
                className="mt-3 w-24 h-24 object-cover rounded-lg border border-surface-border"
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-400">
              עלות: <span className="text-brand-400 font-medium">{cost} קרדיטים</span>
              {' · '}
              יתרה: {user?.credits ?? 0}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || (user?.credits ?? 0) < cost}
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
