import { Suspense } from 'react';
import { ClaseDetailView } from '@/components/horarios/ClaseDetailView';

export default function ProfesorClasePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <ClaseDetailView rol="profesor" />
    </Suspense>
  );
}
