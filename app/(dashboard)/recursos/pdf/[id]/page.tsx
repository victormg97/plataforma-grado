import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PDFViewerPage } from '@/components/recursos/PDFViewer/PDFViewerPage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecursoPDFPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  return (
    <div className="-mt-4 -mb-[var(--container-padding)]">
      <PDFViewerPage
        recursoId={id}
        rol={profile.rol as 'admin' | 'profesor' | 'alumno' | 'lector'}
      />
    </div>
  );
}
