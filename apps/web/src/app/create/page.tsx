'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/lib/auth-context';
import { api, MODELS, Generation } from '@/lib/api';
import { translateError } from '@/lib/he';

import { CreateForm, ReferenceImage, MAX_REFERENCES } from './_components/CreateForm';
import { CurrentGenPreview } from './_components/CurrentGenPreview';
import { RecentCreations } from './_components/RecentCreations';

export default function CreatePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <CreateContent />
      </Suspense>
    </AuthGuard>
  );
}

function CreateContent() {
  const { user, refreshCredits } = useAuth();
  const searchParams = useSearchParams();
  const initializedFromParams = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState('1:1');
  const [quality, setQuality] = useState('standard');
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [currentGen, setCurrentGen] = useState<Generation | null>(null);
  const [error, setError] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const hasReference = references.length > 0;

  // ── Reference helpers ──────────────────────────────────────────────────────

  const addReferenceUrl = useCallback(
    (url: string) => {
      if (references.some((r) => r.sourceUrl === url)) return;
      if (references.length >= MAX_REFERENCES) {
        setError(`ניתן להעלות עד ${MAX_REFERENCES} תמונות השראה`);
        return;
      }
      setReferences((prev) => [
        ...prev,
        { id: `url-${Date.now()}-${url}`, previewUrl: url, sourceUrl: url },
      ]);
    },
    [references],
  );

  const addReferenceFiles = useCallback(
    (files: File[]) => {
      const MAX_SIZE = 20 * 1024 * 1024;
      const valid = files.filter((f) => f.size <= MAX_SIZE);
      const skipped = files.filter((f) => f.size > MAX_SIZE);

      if (skipped.length > 0) {
        setError(
          skipped.length === 1
            ? `"${skipped[0].name}" גדולה מ-20MB ולא נוספה`
            : `${skipped.length} תמונות גדולות מ-20MB ולא נוספו`,
        );
      } else {
        setError('');
      }

      if (valid.length === 0) return;

      const remaining = MAX_REFERENCES - references.length;
      const toAdd = valid.slice(0, remaining);
      if (toAdd.length === 0) {
        setError(`ניתן להעלות עד ${MAX_REFERENCES} תמונות השראה`);
        return;
      }

      const newRefs = toAdd.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(previewUrl);
        return {
          id: `file-${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          previewUrl,
          file,
          objectUrl: true as const,
        };
      });
      setReferences((prev) => [...prev, ...newRefs]);
    },
    [references],
  );

  const removeReference = (index: number) => {
    setReferences((prev) => {
      const removed = prev[index];
      if (removed?.objectUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (u) => u !== removed.previewUrl,
        );
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addReferenceFiles(files);
    e.target.value = '';
  };

  const handleReferenceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (imageFiles.length > 0) { addReferenceFiles(imageFiles); return; }
    }
    const url =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain');
    if (url) addReferenceUrl(url);
  };

  // ── Recent generations ─────────────────────────────────────────────────────

  const loadRecent = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getUserGenerations(user.id, { type: 'image', limit: 50 });
      setRecentGenerations(res.items.filter((g) => g.status !== 'failed'));
    } catch {
      // keep existing list on error
    } finally {
      setRecentLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setRecentLoading(true);
    loadRecent();
  }, [loadRecent]);

  // ── URL params (edit-from-history flow) ───────────────────────────────────

  useEffect(() => {
    if (initializedFromParams.current) return;
    initializedFromParams.current = true;
    searchParams
      .getAll('reference')
      .filter(Boolean)
      .slice(0, MAX_REFERENCES)
      .forEach(addReferenceUrl);
    const promptParam = searchParams.get('prompt');
    if (promptParam) setPrompt(promptParam);
  }, [addReferenceUrl, searchParams]);

  // ── Model change ───────────────────────────────────────────────────────────

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const def = MODELS.find((m) => m.id === newModel);
    if (def && !def.sizes.find((s) => s.id === size)) setSize(def.sizes[0].id);
    if (def && !def.qualities.find((q) => q.id === quality)) setQuality(def.qualities[0].id);
  };

  // ── Cost preview ───────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setCostLoading(true);
    setCostError('');
    api
      .getGenerationCostPreview({
        provider: selectedModel.provider,
        model: selectedModel.id,
        size,
        quality,
        hasReference,
      })
      .then((p) => { if (!cancelled) setCost(p.credits); })
      .catch(() => {
        if (!cancelled) { setCost(null); setCostError('לא ניתן לחשב את העלות כרגע'); }
      })
      .finally(() => { if (!cancelled) setCostLoading(false); });
    return () => { cancelled = true; };
  }, [selectedModel.provider, selectedModel.id, size, quality, hasReference]);

  // ── Polling ────────────────────────────────────────────────────────────────

  const pollGeneration = useCallback(
    async (id: string) => {
      const gen = await api.getGeneration(id);
      setCurrentGen(gen);
      setRecentGenerations((prev) => {
        if (gen.status === 'failed') return prev.filter((g) => g.id !== id);
        const idx = prev.findIndex((g) => g.id === id);
        if (idx === -1) return [gen, ...prev];
        const next = [...prev];
        next[idx] = gen;
        return next;
      });
      if (gen.status === 'pending' || gen.status === 'processing') {
        setTimeout(() => pollGeneration(id), 2000);
      } else {
        setGenerating(false);
        refreshCredits();
        if (gen.status === 'done') loadRecent();
      }
    },
    [refreshCredits, loadRecent],
  );

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError(translateError('Please enter a prompt')); return; }
    if (cost === null) { setError('לא ניתן ליצור לפני חישוב העלות'); return; }

    setError('');
    setGenerating(true);
    setCurrentGen(null);

    try {
      const existingUrls = references.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u));
      const files = references.map((r) => r.file).filter((f): f is File => Boolean(f));
      let referenceImageUrls = existingUrls.length > 0 ? existingUrls : undefined;

      if (files.length > 0) {
        const uploads = await Promise.all(files.map((f) => api.uploadReference(f)));
        referenceImageUrls = [...(referenceImageUrls ?? []), ...uploads.map((u) => u.url)];
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
      setRecentGenerations((prev) => [gen, ...prev.filter((g) => g.id !== gen.id)]);
      refreshCredits();
      pollGeneration(gen.id);
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Generation failed'));
      setGenerating(false);
    }
  };

  // ── Cleanup object URLs ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">יצירת תמונה</h1>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Left 1/3 — form, sticky */}
        <div className="lg:col-span-1 lg:sticky lg:top-4">
          <CreateForm
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            handleModelChange={handleModelChange}
            models={MODELS}
            size={size}
            setSize={setSize}
            quality={quality}
            setQuality={setQuality}
            selectedModel={selectedModel}
            references={references}
            removeReference={removeReference}
            isDragOver={isDragOver}
            setIsDragOver={setIsDragOver}
            handleReferenceDrop={handleReferenceDrop}
            handleReferenceChange={handleReferenceChange}
            cost={cost}
            costLoading={costLoading}
            costError={costError}
            user={user}
            generating={generating}
            onGenerate={handleGenerate}
            error={error}
          />
        </div>

        {/* Right 2/3 — preview of current generation + grid */}
        <div className="lg:col-span-2 space-y-4">
          {currentGen && (
            <CurrentGenPreview
              gen={currentGen}
              onUseReference={addReferenceUrl}
              onDismiss={() => setCurrentGen(null)}
            />
          )}
          <RecentCreations
            generations={recentGenerations}
            loading={recentLoading}
            activeGenId={currentGen?.id ?? null}
            onUseReference={addReferenceUrl}
          />
        </div>
      </div>
    </div>
  );
}
