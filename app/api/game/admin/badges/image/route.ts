import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import {
  validateBadgeImage,
  BADGE_IMAGE_DEFAULT_MAX_BYTES,
  BADGE_IMAGE_DEFAULT_RECOMMENDED_PX,
} from '@/lib/comunidad/badge-image';

// POST: validate and upload a badge image (multipart/form-data, field "file").
// Returns { image_path, warning? }. Validation params come from game_settings.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load per-tenant validation params (fall back to defaults).
  const { data: settings } = await admin
    .from('game_settings')
    .select('badge_image_max_bytes, badge_image_recommended_px')
    .eq('tenant', tenantConfig.id)
    .maybeSingle();

  const maxBytes = settings?.badge_image_max_bytes ?? BADGE_IMAGE_DEFAULT_MAX_BYTES;
  const recommendedPx = settings?.badge_image_recommended_px ?? BADGE_IMAGE_DEFAULT_RECOMMENDED_PX;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validateBadgeImage(file.type, bytes, maxBytes, recommendedPx);

  if (!result.ok) {
    return NextResponse.json({ error: result.errorCode ?? 'INVALID_FORMAT' }, { status: 400 });
  }

  const ext = file.type === 'image/png' ? 'png' : 'svg';
  const path = `${tenantConfig.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from('game-badges')
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadError.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from('game-badges').getPublicUrl(path);

  return NextResponse.json({
    image_path: path,
    public_url: pub.publicUrl,
    warning: result.warning ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
  });
}
