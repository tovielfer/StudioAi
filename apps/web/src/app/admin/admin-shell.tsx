'use client';

import { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

export function AdminShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-gray-950">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-l from-brand-50 via-white to-slate-50 px-6 py-7">
            <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {description}
            </p>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <AdminNav />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
