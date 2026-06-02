'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { VIDEO_MODELS } from '@/lib/api';
import { CreateWorkspace } from '../create/_components/CreateWorkspace';

export default function CreateVideoPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <CreateWorkspace
          title="יצירת סרטון"
          models={VIDEO_MODELS}
          generationType="video"
        />
      </Suspense>
    </AuthGuard>
  );
}
