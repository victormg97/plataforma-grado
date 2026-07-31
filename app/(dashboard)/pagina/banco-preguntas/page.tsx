'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { QuestionForm } from '@/components/question-bank/QuestionForm';
import { QuestionList } from '@/components/question-bank/QuestionList';
import type { QbCategory, QbTag } from '@/lib/supabase/types';

type Tab = 'agregar' | 'guardadas';

export default function BancoPreguntasPage() {
  const t = useTranslations('bancoPreguntas');
  const router = useRouter();
  const { user } = useUser();

  // Use local state for tabs instead of URL params to avoid
  // Next.js router transitions blocking when heavy components re-render.
  const [tab, setTab] = useState<Tab>('agregar');
  const [editId, setEditId] = useState<string | null>(null);

  // Guard: only admin
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, router]);

  // Check feature flag
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['qb-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/question-bank/settings');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user,
  });

  // Load categories and tags for the form
  const { data: categories = [] } = useQuery<QbCategory[]>({
    queryKey: ['qb-categories'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/question-bank/categories');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'admin',
  });

  const { data: tags = [] } = useQuery<QbTag[]>({
    queryKey: ['qb-tags'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/question-bank/tags');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'admin',
  });

  // Prefetch first page of questions so it loads instantly on tab switch
  const queryClient = useQueryClient();
  useEffect(() => {
    if (user?.rol === 'admin') {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '20');
      queryClient.prefetchQuery({
        queryKey: ['qb-questions', params.toString()],
        staleTime: 30_000,
        queryFn: async () => {
          const res = await fetch(`/api/question-bank/questions?${params.toString()}`);
          if (!res.ok) throw new Error();
          return res.json();
        },
      });
    }
  }, [user, queryClient]);

  // Redirect if feature disabled
  useEffect(() => {
    if (!settingsLoading && settings && !settings.question_bank_enabled) {
      router.replace('/pagina');
    }
  }, [settings, settingsLoading, router]);

  if (!user || user.rol !== 'admin') return null;
  if (settingsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }
  if (!settings?.question_bank_enabled) return null;

  // If editId is set, show form in edit mode
  const showForm = tab === 'agregar' || !!editId;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'agregar', label: t('tab_agregar') },
    { key: 'guardadas', label: t('tab_guardadas') },
  ];

  return (
    <div>
      <button
        onClick={() => router.push('/pagina')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>

      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
      />

      {/* Tabs */}
      <div className="mt-[var(--space-lg)] flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t2) => (
          <button
            key={t2.key}
            onClick={() => { setTab(t2.key); setEditId(null); }}
            className={`min-h-[44px] px-4 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              (t2.key === 'agregar' && showForm) || (t2.key === 'guardadas' && !showForm)
                ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t2.label}
          </button>
        ))}
      </div>

      <div className="mt-[var(--space-lg)]">
        {showForm ? (
          <QuestionForm
            categories={categories}
            tags={tags}
            editId={editId}
            onSaved={() => { setTab('guardadas'); setEditId(null); }}
          />
        ) : (
          <QuestionList
            categories={categories}
            tags={tags}
            onEdit={(id) => { setEditId(id); setTab('agregar'); }}
          />
        )}
      </div>
    </div>
  );
}
