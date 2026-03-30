import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRolRedirectPath } from '@/lib/auth/helpers';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile) {
      redirect(getRolRedirectPath(profile.rol));
    }
  }

  redirect('/login');
}
