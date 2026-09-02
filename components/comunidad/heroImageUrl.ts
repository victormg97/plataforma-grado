import { createClient } from '@/lib/supabase/client';

/** Resolves the public URL of the game hero image (game-hero bucket). */
export function heroImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from('game-hero').getPublicUrl(path);
  return data.publicUrl ?? null;
}
