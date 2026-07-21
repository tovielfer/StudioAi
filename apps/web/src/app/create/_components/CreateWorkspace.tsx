'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, Generation, ModelOption } from '@/lib/api';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { translateError } from '@/lib/he';

import { Tooltip } from '@/components/Tooltip';
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
    initialModel.qualities.find((q) => q.id === 'medium')?.id ??
    initialModel.qualities[0]?.id ??
    'auto';
  // Images default to a 16:9 (landscape) aspect ratio when the model offers it,
  // falling back to the model's first available size otherwise.
  const initialSize =
    (generationType === 'image'
      ? initialModel.sizes.find((s) => s.id === '9:16')?.id
      : undefined) ??
    initialModel.sizes[0]?.id ??
    '1:1';
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(initialModel.id);
  const [size, setSize] = useState(initialSize);
  const [quality, setQuality] = useState(initialQuality);
  const [resolution, setResolution] = useState(initialModel.resolutions[0]?.id ?? '1K');
  const [duration, setDuration] = useState(initialModel.durations?.[0]?.id ?? '5');
  const [generateAudio, setGenerateAudio] = useState(false);
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

  // Failed and cancelled generations are shown here too (with their error and a
  // "create again" action) — they are no longer hidden from the create view.
  const recentGenerations = recentItems;

  const selectedModel = models.find((m) => m.id === model) ?? initialModel;
  const isVideo = generationType === 'video';
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

  // Video uses two ordered slots: index 0 = start frame, index 1 = end frame.
  const setReferenceSlotFile = useCallback((index: number, file: File) => {
    const MAX_SIZE = 7 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`"${file.name}" גדולה מ-7MB ולא נוספה`);
      return;
    }
    setError('');
    const previewUrl = URL.createObjectURL(file);
    objectUrlsRef.current.push(previewUrl);
    setReferences((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old?.objectUrl) {
        URL.revokeObjectURL(old.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (u) => u !== old.previewUrl,
        );
      }
      next[index] = {
        id: `slot-${index}-${crypto.randomUUID()}`,
        previewUrl,
        file,
        objectUrl: true,
      };
      return next;
    });
  }, []);

  const removeReferenceSlot = useCallback((index: number) => {
    setReferences((prev) => {
      const next = [...prev];
      // Removing the start frame also drops the end frame (an end frame is
      // meaningless without a start), keeping slot order intact.
      const lastIndex = index === 0 ? next.length - 1 : index;
      for (let i = lastIndex; i >= index; i--) {
        const removed = next[i];
        if (removed?.objectUrl) {
          URL.revokeObjectURL(removed.previewUrl);
          objectUrlsRef.current = objectUrlsRef.current.filter(
            (u) => u !== removed.previewUrl,
          );
        }
        next.splice(i, 1);
      }
      return next;
    });
  }, []);

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
        setQuality(qualOptions.find((q) => q.id === 'medium')?.id ?? qualOptions[0].id);
      }
    }
    if (def) {
      const resOptions = def.resolutions;
      if (resOptions.length === 0) setResolution('1K');
      else if (!resOptions.find((r) => r.id === resolution)) {
        // Prefer a balanced default (720p) when the model exposes it.
        setResolution(
          resOptions.find((r) => r.id === '720p')?.id ?? resOptions[0].id,
        );
      }
    }
    if (def) {
      const durOptions = def.durations ?? [];
      if (durOptions.length > 0 && !durOptions.find((d) => d.id === duration)) {
        setDuration(durOptions[0].id);
      }
      if (!def.supportsAudio) setGenerateAudio(false);
      // Seedance 2.0 (all variants) generates audio at no extra cost, default on.
      else if (newModel.startsWith('seedance-v2')) setGenerateAudio(true);
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
        ...(isVideo
          ? {
              durationSeconds: Number(duration),
              generateAudio: selectedModel.supportsAudio ? generateAudio : false,
            }
          : {}),
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
  }, [selectedModel.provider, selectedModel.id, selectedModel.supportsAudio, size, quality, resolution, hasReference, generationType, isVideo, duration, generateAudio]);

  const pollGeneration = useCallback(
    async (id: string) => {
      const gen = await api.getGeneration(id);
      setCurrentGen(gen);
      setRecentGenerations((prev) => {
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

  // "Create again": instead of charging immediately, copy every parameter of the
  // original generation (prompt, model, size, references, …) into the form and
  // let the user review and press "create" themselves. No credits are spent
  // until they approve.
  const fillFormFromGeneration = useCallback(
    (gen: Generation) => {
      setError('');
      setPrompt(gen.prompt);

      const def = models.find((m) => m.id === gen.model);
      if (def) {
        setModel(def.id);
        if (gen.size && def.sizes.some((s) => s.id === gen.size)) {
          setSize(gen.size);
        }
        if (gen.quality && def.qualities.some((q) => q.id === gen.quality)) {
          setQuality(gen.quality);
        }
        if (
          gen.resolution &&
          def.resolutions.some((r) => r.id === gen.resolution)
        ) {
          setResolution(gen.resolution);
        }
        if (
          gen.durationSeconds != null &&
          def.durations?.some((d) => d.id === String(gen.durationSeconds))
        ) {
          setDuration(String(gen.durationSeconds));
        }
        setGenerateAudio(def.supportsAudio ? Boolean(gen.generateAudio) : false);
      }

      // Replace any current references with the original reference images.
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      const urls = (gen.referenceImageUrls ?? []).slice(0, MAX_REFERENCES);
      setReferences(
        urls.map((url, i) => ({
          id: `url-${Date.now()}-${i}-${url}`,
          previewUrl: url,
          sourceUrl: url,
        })),
      );

      // Bring the form into view so it's clear the user needs to approve.
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [models],
  );

  // Immediate "create again" for failed/cancelled items: start a brand-new
  // generation reusing every original parameter and surface it live, without
  // touching the form (the user already got their credits back and just wants a
  // retry).
  const recreateNow = useCallback(
    async (gen: Generation) => {
      if (submitting) return;
      setError('');
      setSubmitting(true);
      setCurrentGen(null);
      try {
        const created = await api.recreateGeneration(gen);
        setCurrentGen(created);
        setRecentGenerations((prev) => [
          created,
          ...prev.filter((g) => g.id !== created.id),
        ]);
        refreshCredits();
        pollGeneration(created.id);
      } catch (err) {
        setError(
          translateError(err instanceof Error ? err.message : 'Generation failed'),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, refreshCredits, pollGeneration, setRecentGenerations],
  );

  // "Create again" has two modes: a failed/cancelled generation is retried
  // immediately, while a successful one only pre-fills the form for the user to
  // review and approve.
  const handleReuse = useCallback(
    (gen: Generation) => {
      if (gen.status === 'failed' || gen.status === 'cancelled') {
        recreateNow(gen);
      } else {
        fillFormFromGeneration(gen);
      }
    },
    [recreateNow, fillFormFromGeneration],
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
      // Resolve references in order (slot 0 = start frame, slot 1 = end frame
      // for video), uploading files as needed so the index mapping is preserved.
      const orderedRefs = references.filter(Boolean);
      const resolvedUrls = await Promise.all(
        orderedRefs.map(async (r) => {
          if (r.sourceUrl) return r.sourceUrl;
          if (r.file) return (await api.uploadReference(r.file)).url;
          return null;
        }),
      );
      const cleanUrls = resolvedUrls.filter((u): u is string => Boolean(u));
      const referenceImageUrls = cleanUrls.length > 0 ? cleanUrls : undefined;

      const gen = await api.createGeneration({
        prompt: prompt.trim(),
        model: selectedModel.id,
        type: generationType,
        size,
        quality,
        resolution,
        provider: selectedModel.provider,
        referenceImageUrls,
        ...(isVideo
          ? {
              durationSeconds: Number(duration),
              generateAudio: selectedModel.supportsAudio ? generateAudio : false,
            }
          : {}),
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
        <Tooltip
          label={formOnLeft ? 'העבר טופס לימין' : 'העבר טופס לשמאל'}
          className="hidden lg:inline-flex"
        >
          <button
            onClick={toggleFormSide}
            aria-label={formOnLeft ? 'העבר טופס לימין' : 'העבר טופס לשמאל'}
            className="icon-button"
          >
            {formOnLeft ? <PanelRightIcon /> : <PanelLeftIcon />}
          </button>
        </Tooltip>
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
            duration={duration}
            setDuration={setDuration}
            generateAudio={generateAudio}
            setGenerateAudio={setGenerateAudio}
            isVideo={isVideo}
            selectedModel={selectedModel}
            references={references}
            removeReference={removeReference}
            setReferenceSlotFile={setReferenceSlotFile}
            removeReferenceSlot={removeReferenceSlot}
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
            onReuse={handleReuse}
            onDeleted={(id) =>
              setRecentGenerations((prev) => prev.filter((g) => g.id !== id))
            }
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
