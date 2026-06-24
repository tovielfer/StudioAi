'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, Generation, ModelOption } from '@/lib/api';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { translateError } from '@/lib/he';

import { CreateForm, ReferenceImage, MAX_REFERENCES } from './CreateForm';
import { RecentCreations } from './RecentCreations';
import { PanelLeftIcon, PanelRightIcon } from './icons';

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
  const initialQuality =
    initialModel.qualities.find((q) => q.id === 'auto')?.id ??
    initialModel.qualities[0]?.id ??
    'auto';
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(initialModel.id);
  const [size, setSize] = useState(initialModel.sizes[0]?.id ?? '1:1');
  const [quality, setQuality] = useState(initialQuality);
  const [resolution, setResolution] = useState(initialModel.resolutions[0]?.id ?? '1K');
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentGen, setCurrentGen] = useState<Generation | null>(null);
  const [error, setError] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [formOnLeft, setFormOnLeft] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('createFormOnLeft') === 'true';
  });

  const toggleFormSide = () => {
    setFormOnLeft((prev) => {
      const next = !prev;
      localStorage.setItem('createFormOnLeft', String(next));
      window.dispatchEvent(new CustomEvent('formSideChange', { detail: next }));
      return next;
    });
  };

  // On desktop the right column is its own scroll container, so the infinite
  // scroll sentinel must observe it; on mobile the whole page scrolls (root null).
  const [recentScrollEl, setRecentScrollEl] = useState<HTMLDivElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Depend on the user id (not the whole user object) so that refreshing
  // credits — which replaces the user object — does not reset the list.
  const userId = user?.id;
  const fetchRecent = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      userId
        ? api.getUserGenerations(userId, {
            type: generationType,
            limit,
            offset,
          })
        : Promise.resolve({ items: [] as Generation[], total: 0 }),
    [userId, generationType],
  );

  const {
    items: recentItems,
    setItems: setRecentGenerations,
    loading: recentLoading,
    loadingMore: recentLoadingMore,
    hasMore: recentHasMore,
    sentinelRef: recentSentinelRef,
    reload: reloadRecent,
  } = useInfiniteList<Generation>(fetchRecent, {
    pageSize: 24,
    root: isDesktop ? recentScrollEl : null,
  });

  // Failed generations are hidden in the create view but still paginated by the
  // server, so we filter them out only when rendering.
  const recentGenerations = recentItems.filter((g) => g.status !== 'failed');

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
      const MAX_SIZE = 7 * 1024 * 1024;
      const valid = files.filter((f) => f.size <= MAX_SIZE);
      const skipped = files.filter((f) => f.size > MAX_SIZE);

      if (skipped.length > 0) {
        setError(
          skipped.length === 1
            ? `"${skipped[0].name}" גדולה מ-7MB ולא נוספה`
            : `${skipped.length} תמונות גדולות מ-7MB ולא נוספו`,
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

  const clearReferences = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setReferences([]);
  }, []);

  const reuseGeneration = useCallback(
    (gen: Generation) => {
      setPrompt(gen.prompt);
      clearReferences();
      const urls = (gen.referenceImageUrls ?? []).filter(Boolean).slice(0, MAX_REFERENCES);
      setReferences(
        urls.map((url) => ({
          id: `url-${Date.now()}-${url}`,
          previewUrl: url,
          sourceUrl: url,
        })),
      );
      setError('');
    },
    [clearReferences],
  );

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
    if (def && def.sizes.length > 0 && !def.sizes.find((s) => s.id === size)) {
      setSize(def.sizes[0].id);
    }
    if (def) {
      const qualOptions = def.qualities;
      if (qualOptions.length === 0) setQuality('auto');
      else if (!qualOptions.find((q) => q.id === quality)) {
        setQuality(qualOptions.find((q) => q.id === 'auto')?.id ?? qualOptions[0].id);
      }
    }
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
        if (gen.status === 'done') reloadRecent();
      }
    },
    [refreshCredits, reloadRecent, setRecentGenerations],
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
    <div className="max-w-[1920px] mx-auto px-6 sm:px-8 py-10 lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col lg:overflow-hidden">
      <div className="flex items-center justify-between mb-8 lg:shrink-0">
        <h1 className="text-3xl font-bold">{title}</h1>
        <button
          onClick={toggleFormSide}
          title={formOnLeft ? 'העבר טופס לימין' : 'העבר טופס לשמאל'}
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
        >
          {formOnLeft ? <PanelRightIcon /> : <PanelLeftIcon />}
          <span>{formOnLeft ? 'טופס לימין' : 'טופס לשמאל'}</span>
        </button>
      </div>

      <div className={`flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:items-stretch ${formOnLeft ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <div className="lg:h-full lg:min-h-0 lg:w-[380px] lg:shrink-0">
          <CreateForm
            prompt={prompt}
            setPrompt={setPrompt}
            onClearPrompt={() => setPrompt('')}
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

        <div
          ref={setRecentScrollEl}
          className="space-y-4 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1"
        >
          <RecentCreations
            generations={recentGenerations}
            loading={recentLoading}
            activeGenId={currentGen?.id ?? null}
            onUseReference={addReferenceUrl}
            onReuse={reuseGeneration}
            type={generationType}
          />

          {!recentLoading && recentHasMore && (
            <div ref={recentSentinelRef} className="h-px" />
          )}

          {recentLoadingMore && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
