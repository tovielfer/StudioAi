'use client';

import { Suspense, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { api, ModelOption } from '@/lib/api';
import { CreateWorkspace } from './_components/CreateWorkspace';

export default function CreatePage() {
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .getModels('image')
      .then(setModels)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <AuthGuard>
      <Suspense fallback={null}>
        {models && models.length > 0 ? (
          <CreateWorkspace
            title="יצירת תמונה"
            models={models}
            generationType="image"
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
