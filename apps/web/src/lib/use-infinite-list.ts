'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Page<T> = { items: T[]; total: number };

type FetchPage<T> = (params: {
  limit: number;
  offset: number;
}) => Promise<Page<T>>;

/**
 * Generic offset-based infinite scroll. The list resets and reloads the first
 * page whenever `fetchPage` changes identity (i.e. when filters change), so the
 * caller should wrap `fetchPage` in useCallback with its filter dependencies.
 *
 * `root` is the scroll container the sentinel lives inside; pass `null` (the
 * default) when the page itself scrolls in the viewport.
 */
export function useInfiniteList<T>(
  fetchPage: FetchPage<T>,
  options?: { pageSize?: number; root?: Element | null },
) {
  const pageSize = options?.pageSize ?? 24;
  const root = options?.root ?? null;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  // Mirrors `items` so reset/loadMore can decide whether to show a loading
  // state without depending on `items` (which would change their identity).
  const itemsRef = useRef<T[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  // Bumped on every reset so in-flight responses from a previous filter are
  // ignored instead of being appended to the new list.
  const epochRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (busyRef.current || doneRef.current) return;
    busyRef.current = true;
    const epoch = epochRef.current;
    const isFirst = offsetRef.current === 0;
    // Only show the blocking loading state when there is nothing on screen yet.
    // On a reload (filters change / explicit reload) we keep the previous items
    // visible until the new first page arrives, avoiding a flicker.
    if (isFirst) {
      if (itemsRef.current.length === 0) setLoading(true);
    } else setLoadingMore(true);

    try {
      const res = await fetchPage({ limit: pageSize, offset: offsetRef.current });
      if (epoch !== epochRef.current) return;
      setTotal(res.total);
      setItems((prev) => (isFirst ? res.items : [...prev, ...res.items]));
      offsetRef.current += res.items.length;
      const reachedEnd =
        res.items.length < pageSize || offsetRef.current >= res.total;
      doneRef.current = reachedEnd;
      setHasMore(!reachedEnd);
      setError(null);
    } catch (err) {
      if (epoch !== epochRef.current) return;
      setError(err instanceof Error ? err.message : 'load failed');
    } finally {
      if (epoch === epochRef.current) {
        busyRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [fetchPage, pageSize]);

  const reset = useCallback(() => {
    epochRef.current += 1;
    offsetRef.current = 0;
    doneRef.current = false;
    busyRef.current = false;
    setHasMore(true);
    // loadMore decides whether to flip `loading` (only when the list is empty),
    // so a reload with existing items swaps content in place without a flicker.
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    reset();
  }, [reset]);

  // Re-runs when the sentinel mounts/unmounts (tracked via items.length &
  // loading) and when the list grows, so the observer always points at the live
  // sentinel and re-evaluates whether it is still in view (filling short lists).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root, rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, root, hasMore, loading, items.length]);

  return {
    items,
    setItems,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    sentinelRef,
    reload: reset,
  };
}
