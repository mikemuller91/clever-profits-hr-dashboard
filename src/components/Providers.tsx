'use client';

import { ReactNode } from 'react';
import { CandidatesProvider } from '@/context/CandidatesContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <CandidatesProvider>
      {children}
    </CandidatesProvider>
  );
}
