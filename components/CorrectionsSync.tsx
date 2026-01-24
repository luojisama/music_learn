'use client';

import { useEffect } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';

export function CorrectionsSync() {
  const syncCorrections = useLibraryStore(state => state.syncCorrections);

  useEffect(() => {
    syncCorrections();
  }, [syncCorrections]);

  return null;
}
