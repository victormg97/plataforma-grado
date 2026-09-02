import { createClient } from '@/lib/supabase/client';

/** Resolves the public URL of a badge image stored in the game-badges bucket. */
export function badgeImageUrl(path: string | null): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from('game-badges').getPublicUrl(path);
  return data.publicUrl ?? null;
}
