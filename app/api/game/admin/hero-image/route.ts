import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { isHeroImageMime, HERO_IMAGE_MAX_BYTES } from '@/lib/comunidad/game-config';

// POST: validate and upload the game hero image (multipart/form-data, field
// "file"). Accepts transparent-friendly formats (PNG/WebP/SVG). Persists the
// resulting path into game_settings.hero_image_path. Returns { image_path }.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  }

  if (!isHeroImageMime(file.type)) {
    return NextResponse.json({ error: 'INVALID_FORMAT' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > HERO_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'TOO_LARGE' }, { status: 400 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'svg';
  const path = `${tenantConfig.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from('game-hero')
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadError.message }, { status: 500 });
  }

  // Persist the path in settings (single source of truth for the hero image).
  const { error: updateError } = await admin
    .from('game_settings')
    .update({ hero_image_path: path })
    .eq('tenant', tenantConfig.id);

  if (updateError) {
    return NextResponse.json({ error: 'ERROR_DB', message: updateError.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from('game-hero').getPublicUrl(path);

  return NextResponse.json({ image_path: path, public_url: pub.publicUrl });
}

// DELETE: remove the hero image (clears hero_image_path).
export async function DELETE() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { error } = await admin
    .from('game_settings')
    .update({ hero_image_path: null })
    .eq('tenant', tenantConfig.id);

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
