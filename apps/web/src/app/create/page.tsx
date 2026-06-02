'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { IMAGE_MODELS } from '@/lib/api';
import { CreateWorkspace } from './_components/CreateWorkspace';

export default function CreatePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <CreateWorkspace
          title="יצירת תמונה"
          models={IMAGE_MODELS}
          generationType="image"
        />
      </Suspense>
    </AuthGuard>
  );
}
