import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { isSvg } from '@/lib/comunidad/badge-image';
import {
  QUIZ_ICON_BUCKET,
  QUIZ_ICON_IMAGE_MAX_BYTES,
  isQuizIconImageMime,
} from '@/lib/comunidad/quiz-display';

// POST: upload a custom subject/category icon (multipart, field "file").
// PNG / WebP / SVG up to 1 MB. Only uploads; the path is persisted when the
// admin saves the item (PUT /api/game/admin/quiz-config).
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const svg = isSvg(file.type, bytes);
  if (!svg && !isQuizIconImageMime(file.type)) {
    return NextResponse.json({ error: 'INVALID_FORMAT' }, { status: 400 });
  }
  if (bytes.length > QUIZ_ICON_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'TOO_LARGE' }, { status: 400 });
  }

  const ext = svg ? 'svg' : file.type === 'image/webp' ? 'webp' : 'png';
  const contentType = svg ? 'image/svg+xml' : file.type;
  const path = `${tenantConfig.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(QUIZ_ICON_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });

  if (error) {
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: error.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(QUIZ_ICON_BUCKET).getPublicUrl(path);
  return NextResponse.json({ image_path: path, public_url: pub.publicUrl });
}

// DELETE ?path=: discard an uploaded image that was never saved (editor
// cancelled). Only paths inside this tenant's folder.
export async function DELETE(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const path = new URL(req.url).searchParams.get('path') ?? '';
  if (!/^[\w-]+\/[\w-]+\.(png|webp|svg)$/.test(path) || !path.startsWith(`${tenantConfig.id}/`)) {
    return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
  }

  await createAdminClient().storage.from(QUIZ_ICON_BUCKET).remove([path]);
  return NextResponse.json({ ok: true });
}
