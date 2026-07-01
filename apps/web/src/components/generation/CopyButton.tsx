'use client';

import { useEffect, useRef, useState } from 'react';
import { CopyIcon, CheckIcon } from './icons';

export function CopyButton({
  text,
  label = '',
  copiedLabel = 'הועתק!',
  className = 'btn-secondary inline-flex items-center gap-2 text-sm',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore copy failures silently
    }
  };

  return (
    <button type="button" onClick={handleCopy} className={className} title={label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? copiedLabel : label}
    </button>
  );
}
