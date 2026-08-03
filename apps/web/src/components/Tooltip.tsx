'use client';

import { ReactNode } from 'react';

type TooltipPlacement = 'top' | 'bottom';

export function Tooltip({
  label,
  placement = 'bottom',
  children,
  className = '',
}: {
  label: string;
  placement?: TooltipPlacement;
  children: ReactNode;
  className?: string;
}) {
  const isTop = placement === 'top';

  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md',
          'bg-gray-950/95 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg',
          'ring-1 ring-white/10 backdrop-blur-sm transition-all duration-150 group-hover/tt:opacity-100',
          isTop
            ? 'bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0'
            : 'top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0',
        ].join(' ')}
      >
        {label}
        <span
          className={[
            'absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-gray-950/95 ring-1 ring-white/10',
            isTop ? '-bottom-1' : '-top-1',
          ].join(' ')}
        />
      </span>
    </span>
  );
}
