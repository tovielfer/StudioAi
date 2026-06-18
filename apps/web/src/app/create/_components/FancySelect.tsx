'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = {
  value: string;
  label: string;
  /** Compact text shown on the closed trigger; the full label is shown when open. */
  shortLabel?: string;
  icon?: React.ReactNode;
};

/**
 * Draws a small rectangle scaled to the given "W:H" ratio, used to visualise
 * aspect-ratio options next to their labels.
 */
export function AspectRatioIcon({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return null;
  const box = 18;
  const max = 16;
  const rw = w >= h ? max : (max * w) / h;
  const rh = h >= w ? max : (max * h) / w;
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      className="shrink-0 opacity-70"
      aria-hidden="true"
    >
      <rect
        x={(box - rw) / 2}
        y={(box - rh) / 2}
        width={rw}
        height={rh}
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function FancySelect({
  value,
  options,
  onChange,
  placeholder = 'בחר...',
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; right: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => setPortalTarget(document.body), []);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
        minWidth: rect.width,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center justify-between gap-3 rounded-lg border bg-surface-card px-4 py-2.5 text-right text-white transition-colors focus:outline-none ${
          open
            ? 'border-transparent ring-2 ring-brand-500'
            : 'border-surface-border hover:border-brand-500/60'
        }`}
      >
        <span className={`flex items-center gap-2 truncate whitespace-nowrap ${selected ? '' : 'text-gray-500'}`}>
          {selected?.icon}
          <span className="truncate">
            {selected ? selected.shortLabel ?? selected.label : placeholder}
          </span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-brand-400' : 'text-gray-400 group-hover:text-brand-400'
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        portalTarget &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuStyle.top,
              right: menuStyle.right,
              minWidth: menuStyle.minWidth,
              maxWidth: 'calc(100vw - 2rem)',
              width: 'max-content',
            }}
            className="fancy-select-menu z-[120] max-h-72 overflow-y-auto rounded-xl border border-surface-border bg-surface-card p-1.5 shadow-2xl shadow-black/50"
            dir="rtl"
            role="listbox"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors ${
                    active
                      ? 'bg-brand-600/20 text-brand-300'
                      : 'text-gray-200 hover:bg-surface-border'
                  }`}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {opt.icon}
                    {opt.label}
                  </span>
                  {active && (
                    <svg
                      className="h-4 w-4 shrink-0 text-brand-400"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5 10l3.5 3.5L15 6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          portalTarget,
        )}
    </>
  );
}
