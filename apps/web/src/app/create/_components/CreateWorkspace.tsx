'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, Generation, ModelOption } from '@/lib/api';
import { translateError } from '@/lib/he';

import { CreateForm, ReferenceImage, MAX_REFERENCES } from './CreateForm';
import { CurrentGenPreview } from './CurrentGenPreview';
import { RecentCreations } from './RecentCreations';

type CreateWorkspaceProps = {
  title: string;
  models: ModelOption[];
  generationType: 'image' | 'video';
};

export function CreateWorkspace({
  title,
  models,
  generationType,
}: CreateWorkspaceProps) {
  const { user, refreshCredits } = useAuth();
  const searchParams = useSearchParams();
  const initializedFromParams = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);

  const initialModel = models[0];
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(initialModel.id);
  const [size, setSize] = useState(initialModel.sizes[0]?.id ?? '1:1');
  const [quality, setQuality] = useState(initialModel.qualities[0]?.id ?? 'standard');
  const [resolution, setResolution] = useState(initialModel.resolutions[0]?.id ?? '1K');
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentGen, setCurrentGen] = useState<Generation | null>(null);
  const [error, setError] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedModel = models.find((m) => m.id === model) ?? initialModel;
  const hasReference = references.length > 0;

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
      if (imageFiles.length > 0) {
        addReferenceFiles(imageFiles);
        return;
      }
    }
    const url =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain');
    if (url) addReferenceUrl(url);
  };

  const loadRecent = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getUserGenerations(user.id, {
        type: generationType,
        limit: 50,
      });
      setRecentGenerations(res.items.filter((g) => g.status !== 'failed'));
    } catch {
      // keep existing list on error
    } finally {
      setRecentLoading(false);
    }
  }, [user, generationType]);

  useEffect(() => {
    setRecentLoading(true);
    loadRecent();
  }, [loadRecent]);

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

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const def = models.find((m) => m.id === newModel);
    if (def && !def.sizes.find((s) => s.id === size)) setSize(def.sizes[0].id);
    if (def && !def.qualities.find((q) => q.id === quality)) setQuality(def.qualities[0].id);
    if (def) {
      const resOptions = def.resolutions;
      if (resOptions.length === 0) setResolution('1K');
      else if (!resOptions.find((r) => r.id === resolution)) setResolution(resOptions[0].id);
    }
  };

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
        resolution,
        hasReference,
        type: generationType,
      })
      .then((p) => {
        if (!cancelled) setCost(p.credits);
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
  }, [selectedModel.provider, selectedModel.id, size, quality, resolution, hasReference, generationType]);

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
        refreshCredits();
        if (gen.status === 'done') loadRecent();
      }
    },
    [refreshCredits, loadRecent],
  );

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
    setSubmitting(true);
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
        type: generationType,
        size,
        quality,
        resolution,
        provider: selectedModel.provider,
        referenceImageUrls,
      });

      setCurrentGen(gen);
      setRecentGenerations((prev) => [gen, ...prev.filter((g) => g.id !== gen.id)]);
      setPrompt('');
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      setReferences([]);
      setIsDragOver(false);
      refreshCredits();
      pollGeneration(gen.id);
      setSubmitting(false);
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Generation failed'));
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">{title}</h1>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 lg:sticky lg:top-4">
          <CreateForm
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            handleModelChange={handleModelChange}
            models={models}
            size={size}
            setSize={setSize}
            quality={quality}
            setQuality={setQuality}
            resolution={resolution}
            setResolution={setResolution}
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
            submitting={submitting}
            onGenerate={handleGenerate}
            error={error}
          />
        </div>

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
            type={generationType}
          />
        </div>
      </div>
    </div>
  );
}
