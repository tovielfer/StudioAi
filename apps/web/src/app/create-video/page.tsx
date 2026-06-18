'use client';

import { Suspense, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { api, ModelOption } from '@/lib/api';
import { CreateWorkspace } from '../create/_components/CreateWorkspace';

export default function CreateVideoPage() {
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .getModels('video')
      .then(setModels)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <AuthGuard>
      <Suspense fallback={null}>
        {models && models.length > 0 ? (
          <CreateWorkspace
            title="יצירת סרטון"
            models={models}
            generationType="video"
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 py-10 text-gray-400">
            {loadError ? 'לא ניתן לטעון את רשימת המודלים כרגע' : 'טוען...'}
          </div>
        )}
      </Suspense>
    </AuthGuard>
  );
}
