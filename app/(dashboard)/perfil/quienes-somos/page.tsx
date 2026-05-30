'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { tenantConfig } from '@/config';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { cn } from '@/lib/utils';
import type { TenantContactInfo } from '@/lib/supabase/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES = ['es', 'en'] as const;
type Locale = typeof LOCALES[number];

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] as const;
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const KNOWN_SOCIAL_KEYS = ['instagram', 'twitter', 'x', 'facebook', 'youtube', 'tiktok', 'pinterest', 'whatsapp'];

const turndown = new TurndownService();

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactEntry = Omit<TenantContactInfo, 'created_at' | 'updated_at'> & {
  _isNew?: boolean;
  _deleted?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIconKey(label: string): string {
  const key = label.toLowerCase().trim();
  return KNOWN_SOCIAL_KEYS.includes(key) ? key : 'link';
}

async function fetchMarkdownFromStorage(tenantSlug: string, locale: string): Promise<string | null> {
  const supabase = createClient();
  const path = `tenants/${tenantSlug}/${locale}/quienes-somos.md`;
  const { data } = supabase.storage.from('content').getPublicUrl(path);
  if (!data?.publicUrl) return null;
  try {
    const res = await fetch(data.publicUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function probeExistingImage(tenantSlug: string): Promise<{ url: string; ext: string } | null> {
  const supabase = createClient();
  const folder = `tenants/${tenantSlug}`;
  const { data: files, error } = await supabase.storage
    .from('content')
    .list(folder, { search: 'quienes-somos-image' });

  if (error || !files || files.length === 0) return null;

  const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] as const;
  for (const ext of EXTENSIONS) {
    const match = files.find((f) => f.name === `quienes-somos-image.${ext}`);
    if (match) {
      const { data } = supabase.storage
        .from('content')
        .getPublicUrl(`${folder}/quienes-somos-image.${ext}`);
      return { url: data.publicUrl, ext };
    }
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuienesSomosEditorPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const t = useTranslations('quienesSomos');
  const queryClient = useQueryClient();
  const supabase = createClient();

  // ── Guard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace('/perfil');
    }
  }, [user, router]);

  // ── Locale selector ───────────────────────────────────────────────────────
  const [locale, setLocale] = useState<Locale>('es');

  // ── Rich text editor ──────────────────────────────────────────────────────
  const [editorHtml, setEditorHtml] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingContent(true);
    setContentError(null);
    fetchMarkdownFromStorage(tenantConfig.id, locale).then((md) => {
      if (md) {
        const html = marked.parse(md) as string;
        setEditorHtml(html);
      } else {
        setEditorHtml('');
      }
      setLoadingContent(false);
    });
  }, [locale]);

  async function handleSaveContent() {
    setSavingContent(true);
    setContentError(null);
    try {
      const markdown = turndown.turndown(editorHtml);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const path = `tenants/${tenantConfig.id}/${locale}/quienes-somos.md`;
      const { error } = await supabase.storage.from('content').upload(path, blob, {
        upsert: true,
        contentType: 'text/markdown',
      });
      if (error) throw error;
      toast.success(t('editor_exito'));
    } catch {
      const msg = t('editor_error');
      setContentError(msg);
      toast.error(msg);
    } finally {
      setSavingContent(false);
    }
  }

  // ── Hero image ────────────────────────────────────────────────────────────
  const [existingImage, setExistingImage] = useState<{ url: string; ext: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    probeExistingImage(tenantConfig.id).then((result) => {
      setExistingImage(result);
    });
  }, []);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);

    if (!ACCEPTED_MIME.includes(file.type)) {
      setImageError(t('editor_imagen_error_tipo'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(t('editor_imagen_error_tamaño'));
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    setUploadingImage(true);
    try {
      // Delete old file if extension differs
      if (existingImage && existingImage.ext !== ext) {
        const oldPath = `tenants/${tenantConfig.id}/quienes-somos-image.${existingImage.ext}`;
        await supabase.storage.from('content').remove([oldPath]);
      }
      const newPath = `tenants/${tenantConfig.id}/quienes-somos-image.${ext}`;
      const { error } = await supabase.storage.from('content').upload(newPath, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('content').getPublicUrl(newPath);
      setExistingImage({ url: data.publicUrl, ext });
      setImagePreview(URL.createObjectURL(file));
      toast.success(t('editor_exito'));
    } catch {
      setImageError(t('editor_imagen_error_upload'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Contact info ──────────────────────────────────────────────────────────
  const { data: contactData, isLoading: contactLoading } = useQuery({
    queryKey: ['who-we-are-contacts-editor', tenantConfig.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_contact_info')
        .select('*')
        .eq('tenant_slug', tenantConfig.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as TenantContactInfo[];
    },
    staleTime: 0,
  });

  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [savingContacts, setSavingContacts] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contactData) {
      setContacts(contactData.map((c) => ({ ...c })));
    }
  }, [contactData]);

  function addContact() {
    const newEntry: ContactEntry = {
      id: `new-${Date.now()}`,
      tenant_slug: tenantConfig.id,
      type: 'social',
      label: '',
      value: '',
      url: '',
      icon_key: 'link',
      sort_order: contacts.length + 1,
      _isNew: true,
    };
    setContacts((prev) => [...prev, newEntry]);
  }

  function updateContact(id: string, field: keyof ContactEntry, value: string) {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };
        if (field === 'label') {
          updated.icon_key = getIconKey(value);
          // Auto-detect type from label
          const lv = value.toLowerCase().trim();
          if (lv === 'whatsapp') updated.type = 'whatsapp';
          else if (lv === 'email' || lv === 'correo') updated.type = 'email';
          else updated.type = 'social';
        }
        return updated;
      })
    );
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}-${field}`];
      return next;
    });
  }

  function deleteContact(id: string) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, _deleted: true } : c))
    );
  }

  function moveContact(id: string, direction: 'up' | 'down') {
    const visible = contacts.filter((c) => !c._deleted);
    const idx = visible.findIndex((c) => c.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === visible.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newVisible = [...visible];
    [newVisible[idx], newVisible[swapIdx]] = [newVisible[swapIdx], newVisible[idx]];
    const reordered = newVisible.map((c, i) => ({ ...c, sort_order: i + 1 }));
    const deleted = contacts.filter((c) => c._deleted);
    setContacts([...reordered, ...deleted]);
  }

  async function handleSaveContacts() {
    const visible = contacts.filter((c) => !c._deleted);
    const errors: Record<string, string> = {};
    visible.forEach((c) => {
      if (!c.label.trim()) errors[`${c.id}-label`] = t('editor_contacto_error_validacion');
      if (!c.value.trim()) errors[`${c.id}-value`] = t('editor_contacto_error_validacion');
      if (!c.url.trim()) errors[`${c.id}-url`] = t('editor_contacto_error_validacion');
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSavingContacts(true);
    setContactError(null);
    try {
      const toDelete = contacts.filter((c) => c._deleted && !c._isNew).map((c) => c.id);
      if (toDelete.length > 0) {
        const { error } = await supabase.from('tenant_contact_info').delete().in('id', toDelete);
        if (error) throw error;
      }

      const toUpsert = visible.map((c, i) => ({
        id: c._isNew ? undefined : c.id,
        tenant_slug: tenantConfig.id,
        type: c.type,
        label: c.label.trim(),
        value: c.value.trim(),
        url: c.url.trim(),
        icon_key: c.icon_key,
        sort_order: i + 1,
      }));

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('tenant_contact_info').upsert(
          toUpsert.map((u) => (u.id ? u : { ...u, id: undefined })),
          { onConflict: 'id' }
        );
        if (error) throw error;
      }

      toast.success(t('editor_exito'));
      queryClient.invalidateQueries({ queryKey: ['who-we-are-contacts-editor'] });
      queryClient.invalidateQueries({ queryKey: ['who-we-are-contact-info'] });
    } catch {
      const msg = t('editor_contacto_error_guardar');
      setContactError(msg);
      toast.error(msg);
    } finally {
      setSavingContacts(false);
    }
  }

  // ── Guard render ──────────────────────────────────────────────────────────
  if (!user || user.rol !== 'admin') return null;

  const visibleContacts = contacts.filter((c) => !c._deleted);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('editor_titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('editor_subtitulo')}</p>
        </div>
      </div>

      {/* Locale selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('editor_locale_label')}:</span>
        {LOCALES.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            className={cn(
              'rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium transition-colors',
              locale === loc
                ? 'border-[var(--color-brand-gold)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
            )}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Rich text editor section */}
      <div className="space-y-4 pb-8 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('editor_contenido_titulo')}</h2>
        {loadingContent ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-[var(--color-brand-gold)]" />
          </div>
        ) : (
          <RichTextEditor content={editorHtml} onChange={setEditorHtml} />
        )}
        {contentError && <p className="text-xs text-[var(--color-error)]">{contentError}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveContent}
            disabled={savingContent || loadingContent}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingContent ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {savingContent ? t('editor_guardando') : t('editor_guardar')}
          </button>
        </div>
      </div>

      {/* Hero image section */}
      <div className="space-y-4 pb-8 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-[var(--color-brand-gold)]" />
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('editor_imagen_titulo')}</h2>
        </div>
        {(imagePreview ?? existingImage?.url) && (
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">{t('editor_imagen_preview')}</p>
            <img
              src={imagePreview ?? existingImage!.url}
              alt=""
              style={{ maxWidth: 300, maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
            />
          </div>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME.join(',')}
            onChange={handleImageChange}
            className="hidden"
            id="hero-image-input"
          />
          <label
            htmlFor="hero-image-input"
            className={cn(
              'inline-flex items-center gap-2 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)] transition-colors',
              uploadingImage && 'opacity-50 pointer-events-none',
            )}
          >
            {uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            {t('editor_imagen_subir')}
          </label>
        </div>
        {imageError && <p className="text-xs text-[var(--color-error)]">{imageError}</p>}
      </div>

      {/* Contact info section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('editor_contacto_titulo')}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Agrega WhatsApp, correos e Instagram. El tipo se detecta automáticamente por el nombre.
          </p>
        </div>
        {contactLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-[var(--color-brand-gold)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {visibleContacts.map((entry, idx) => (
              <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                {/* Row header: order controls + type badge + delete */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveContact(entry.id, 'up')}
                      disabled={idx === 0}
                      className="flex size-7 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-30 transition-colors"
                      title="Mover arriba"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveContact(entry.id, 'down')}
                      disabled={idx === visibleContacts.length - 1}
                      className="flex size-7 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-30 transition-colors"
                      title="Mover abajo"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <span className="ml-1 text-xs text-[var(--color-text-muted)] capitalize px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)]">
                      {entry.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteContact(entry.id)}
                    className="flex size-7 items-center justify-center rounded text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Label / Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Nombre o red social
                    </label>
                    <input
                      type="text"
                      value={entry.label}
                      onChange={(e) => updateContact(entry.id, 'label', e.target.value)}
                      placeholder="Ej: Instagram, WhatsApp, Correo, Estefanía…"
                      className={inputCls}
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Escribe &quot;Instagram&quot;, &quot;WhatsApp&quot; o &quot;email&quot; para auto-detectar el ícono
                    </p>
                    {fieldErrors[`${entry.id}-label`] && (
                      <p className="text-xs text-[var(--color-error)]">{fieldErrors[`${entry.id}-label`]}</p>
                    )}
                  </div>

                  {/* Value */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {entry.type === 'whatsapp' ? 'Número de teléfono' : entry.type === 'email' ? 'Dirección de correo' : 'Usuario o handle'}
                    </label>
                    <input
                      type="text"
                      value={entry.value}
                      onChange={(e) => updateContact(entry.id, 'value', e.target.value)}
                      placeholder={
                        entry.type === 'whatsapp' ? '+56 9 1234 5678' :
                        entry.type === 'email' ? 'correo@ejemplo.com' :
                        '@usuario'
                      }
                      className={inputCls}
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Texto que se muestra al usuario
                    </p>
                    {fieldErrors[`${entry.id}-value`] && (
                      <p className="text-xs text-[var(--color-error)]">{fieldErrors[`${entry.id}-value`]}</p>
                    )}
                  </div>

                  {/* URL */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Enlace (URL)
                    </label>
                    <input
                      type="text"
                      value={entry.url}
                      onChange={(e) => updateContact(entry.id, 'url', e.target.value)}
                      placeholder={
                        entry.type === 'whatsapp' ? 'https://wa.me/56912345678' :
                        entry.type === 'email' ? 'mailto:correo@ejemplo.com' :
                        'https://instagram.com/usuario'
                      }
                      className={inputCls}
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Adónde lleva el clic. WhatsApp: https://wa.me/56… · Email: mailto:… · Redes: URL del perfil
                    </p>
                    {fieldErrors[`${entry.id}-url`] && (
                      <p className="text-xs text-[var(--color-error)]">{fieldErrors[`${entry.id}-url`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addContact}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-strong)] px-4 py-3 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)] transition-colors w-full justify-center"
            >
              <Plus className="size-4" />
              {t('editor_contacto_agregar')}
            </button>
          </div>
        )}
        {contactError && <p className="text-xs text-[var(--color-error)]">{contactError}</p>}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveContacts}
            disabled={savingContacts || contactLoading}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingContacts ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {savingContacts ? t('editor_guardando') : t('editor_contacto_guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
