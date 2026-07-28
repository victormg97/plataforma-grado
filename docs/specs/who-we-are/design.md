# Technical Design Document

## Overview

The "Who We Are" (¿Quiénes Somos?) feature adds a self-contained reusable component (`WhoWeAre`) that renders a trigger button and a large animated modal. The modal displays tenant identity content (Markdown from Supabase Storage), an optional hero image, and a contact column sourced from a new `tenant_contact_info` database table. The component is placed on the Login page and the Information/Privacy page. An admin-only editor at `/perfil/quienes-somos` allows content management from the UI.

---

## Components and Interfaces

### WhoWeAre Component
```typescript
interface WhoWeAreProps {
  tenantSlug: string;
  locale: string;
}
```

### WhoWeAreModal Component
```typescript
interface WhoWeAreModalProps {
  tenantSlug: string;
  locale: string;
  markdown: string;
  onClose: () => void;
}
```

### ContactColumn Component
```typescript
interface ContactColumnProps {
  entries: TenantContactInfo[];
  onClose?: () => void;
}
```

### RichTextEditor Component
```typescript
interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
}
```

### useWhoWeAreContent Hook
```typescript
function useWhoWeAreContent(tenantSlug: string, locale: string): {
  markdown: string | null;
  status: 'loading' | 'resolved' | 'not_found';
}
```

### useHeroImage Hook
```typescript
function useHeroImage(tenantSlug: string): {
  url: string | null;
  found: boolean;
}
```

### useContactInfo Hook
```typescript
function useContactInfo(tenantSlug: string): {
  entries: TenantContactInfo[];
}
```

---

## Data Models

### tenant_contact_info Table
```typescript
type TenantContactInfo = {
  id: string;
  tenant_slug: string;
  type: 'whatsapp' | 'email' | 'social';
  label: string;
  value: string;
  url: string;
  icon_key: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
```

### Social Icon Map
```typescript
const SOCIAL_ICON_MAP: Record<string, React.ComponentType> = {
  instagram: SiInstagram,
  twitter: SiX,
  facebook: SiFacebook,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  tiktok: SiTiktok,
  pinterest: SiPinterest,
  whatsapp: SiWhatsapp,
};
```

---

## Error Handling

- **Content resolution timeout**: `AbortController` with 10s timeout. On abort, treat as failure → render nothing.
- **Hero image probe failure**: Any fetch error → treat as "not found" → render without left column. No error shown to user.
- **Contact info fetch failure**: Return empty array. No error shown to user. Empty state rendered silently.
- **Admin editor save failure**: Display inline error message + sonner toast. Do not navigate away.
- **Admin editor image upload failure**: Display error message indicating upload failed and previous image preserved. Do not navigate away.
- **Admin editor contact save failure**: Display error message. Do not navigate away.
- **File validation failure**: Client-side rejection before upload. Show specific reason (unsupported type or file too large).

---

## Architecture

### Component Tree

```
WhoWeAre/
  index.tsx              ← self-contained component (button + modal)
  WhoWeAreModal.tsx      ← animated modal (desktop 3-col / mobile stacked)
  ContactColumn.tsx      ← right column: social/whatsapp/email entries
  HeroImage.tsx          ← left column: optional hero image
  hooks/
    useWhoWeAreContent.ts  ← React Query: resolve markdown from Storage
    useHeroImage.ts        ← React Query: probe hero image extensions
    useContactInfo.ts      ← React Query: fetch tenant_contact_info rows
```

```
components/common/RichTextEditor/
  index.tsx              ← extracted from NotaEditor (HTML in/out)
  components/
    EditorToolbar.tsx    ← moved from notas/NotaEditor/components/
    ToolbarButton.tsx    ← moved from notas/NotaEditor/components/
    Divider.tsx          ← moved from notas/NotaEditor/components/
```

```
app/(dashboard)/perfil/quienes-somos/
  page.tsx               ← Admin_Editor page (client component)
```

---

## Data Flow

### Content Resolution (Requirement 1)

```
WhoWeAre mounts
  → useWhoWeAreContent(tenantSlug, locale)
      → fetch Storage: content/tenants/{slug}/{locale}/quienes-somos.md
          ✓ found → return { markdown, status: 'resolved' }
          ✗ not found / error → fetch Storage: content/tenants/{slug}/es/quienes-somos.md
              ✓ found → return { markdown, status: 'resolved' }
              ✗ not found / error → return { markdown: null, status: 'not_found' }
      → 10s AbortController timeout → treat as failure
  → status === 'loading' → render nothing
  → status === 'resolved' → render trigger button
  → status === 'not_found' → render nothing
```

### Hero Image Resolution (Requirement 2)

```
WhoWeAreModal opens
  → useHeroImage(tenantSlug)
      → probe extensions in order: jpg, jpeg, png, webp, gif, svg
      → for each: supabase.storage.from('content').getPublicUrl(path)
          then HEAD request to check existence
      → first 200 → return { url, found: true }
      → all fail / error → return { url: null, found: false }
  → found → render left image column (object-fit: cover)
  → not found → render without left column (center + right expand)
```

### Contact Info (Requirement 8)

```
WhoWeAreModal opens
  → useContactInfo(tenantSlug)
      → supabase.from('tenant_contact_info')
          .select('*')
          .eq('tenant_slug', tenantSlug)
          .order('sort_order', { ascending: true })
      → returns entries[]
  → render ContactColumn with entries
  → empty / error → render empty state (no error shown)
```

---

## Database

### New Table: `tenant_contact_info`

Migration file: `supabase/migrations/055_tenant_contact_info.sql`

```sql
CREATE TABLE public.tenant_contact_info (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  type        text NOT NULL CHECK (type IN ('whatsapp', 'email', 'social')),
  label       text NOT NULL,
  value       text NOT NULL,
  url         text NOT NULL,
  icon_key    text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- updated_at trigger (follows project pattern)
CREATE OR REPLACE FUNCTION update_tenant_contact_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenant_contact_info_updated_at
  BEFORE UPDATE ON public.tenant_contact_info
  FOR EACH ROW EXECUTE FUNCTION update_tenant_contact_info_updated_at();

-- RLS
ALTER TABLE public.tenant_contact_info ENABLE ROW LEVEL SECURITY;

-- Public SELECT (anon + authenticated)
CREATE POLICY "tenant_contact_info_select_public"
  ON public.tenant_contact_info FOR SELECT
  USING (true);

-- Admin-only write
CREATE POLICY "tenant_contact_info_write_admin"
  ON public.tenant_contact_info FOR ALL
  USING (
    (SELECT get_user_rol()) = 'admin'
  )
  WITH CHECK (
    (SELECT get_user_rol()) = 'admin'
  );
```

### TypeScript Types (manual addition to `lib/supabase/types.ts`)

```typescript
tenant_contact_info: {
  Row: {
    id: string
    tenant_slug: string
    type: 'whatsapp' | 'email' | 'social'
    label: string
    value: string
    url: string
    icon_key: string | null
    sort_order: number
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    tenant_slug: string
    type: 'whatsapp' | 'email' | 'social'
    label: string
    value: string
    url: string
    icon_key?: string | null
    sort_order?: number
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    tenant_slug?: string
    type?: 'whatsapp' | 'email' | 'social'
    label?: string
    value?: string
    url?: string
    icon_key?: string | null
    sort_order?: number
    created_at?: string
    updated_at?: string
  }
}
```

Also add convenience alias at the bottom of `types.ts`:
```typescript
export type TenantContactInfo = Tables<'tenant_contact_info'>;
```

---

## Supabase Storage

All content lives in the existing `content` bucket (or a new public bucket if it doesn't exist). Paths:

| Asset | Path |
|---|---|
| Markdown (locale) | `content/tenants/{slug}/{locale}/quienes-somos.md` |
| Markdown (fallback) | `content/tenants/{slug}/es/quienes-somos.md` |
| Hero image | `content/tenants/{slug}/quienes-somos-image.{ext}` |

The bucket must have a public SELECT policy so unauthenticated users on the Login page can read content. Uploads (admin editor) use the authenticated Supabase client.

---

## Component Design

### `WhoWeAre` (index.tsx)

**Props:**
```typescript
interface WhoWeAreProps {
  tenantSlug: string;
  locale: string;
}
```

**Behavior:**
- Calls `useWhoWeAreContent(tenantSlug, locale)` internally.
- While loading → renders `null`.
- On failure → renders `null`.
- On success → renders trigger button + `<WhoWeAreModal>` (conditionally mounted via `isOpen` state).
- Trigger button: `aria-label` from i18n, `opacity-50 hover:opacity-100 transition-opacity` classes (matches auth layout ThemeToggle style).
- Modal state managed locally with `useState<boolean>`.

### `WhoWeAreModal`

**Props:**
```typescript
interface WhoWeAreModalProps {
  tenantSlug: string;
  locale: string;
  markdown: string;
  onClose: () => void;
}
```

**Animation (framer-motion):**
- Wrapped in `AnimatePresence` at the `WhoWeAre` level.
- Backdrop: `motion.div` with `opacity: 0→1` (200ms easeOut).
- Modal panel: `motion.div` with `opacity: 0→1` + `scale: 0.95→1` (200ms easeOut on enter, 150ms easeIn on exit).
- Uses `m.div` from `framer-motion` (project uses `LazyMotion` + `domAnimation` via `MotionProvider`).

**Desktop layout (≥768px):**
```
┌─────────────────────────────────────────────────────────┐
│ [X close]                                               │
├──────────────┬──────────────────────┬───────────────────┤
│  Hero Image  │  Markdown Content    │  Contact Column   │
│  (optional)  │  (scrollable)        │  (social/wa/email)│
│  object-cover│                      │                   │
└──────────────┴──────────────────────┴───────────────────┘
```
- Modal: `w-[90vw] max-w-5xl h-[85vh]` (≥80% viewport).
- Left column: `w-64 shrink-0` (hidden if no image).
- Center column: `flex-1 overflow-y-auto`.
- Right column: `w-64 shrink-0 overflow-y-auto`.
- All colors via CSS variables. Headings use `var(--font-display)`, body uses `var(--font-body)`.

**Mobile layout (<768px):**
- Left image: decorative strip `max-w-[48px]` or hidden if no image.
- Center column: full width minus strip.
- Contact column: hidden by default, toggled via bottom button.
- Toggle button: visible only on mobile, reflects open/closed state (different label/icon).
- Contact column slide animation: `motion.div` with `y: 100%→0` (open) / `y: 0→100%` (close), 250ms easeInOut.
- Close/back control rendered inside the Contact column itself.

### `ContactColumn`

**Icon mapping (react-icons/si):**
```typescript
const SOCIAL_ICON_MAP: Record<string, React.ComponentType> = {
  instagram: SiInstagram,
  twitter: SiX,        // X (formerly Twitter)
  facebook: SiFacebook,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  tiktok: SiTiktok,
  pinterest: SiPinterest,
  whatsapp: SiWhatsapp,
};
```

**Link interception:**
- All non-`mailto:` links → intercept click → show `ExternalLinkModal` → on confirm open in new tab.
- `mailto:` links → open directly (no interception).

**Entry rendering:**
- `type === 'social'` + known label → brand icon (default color from react-icons) + `value` text + link via `url`.
- `type === 'social'` + unknown label → `ExternalLink` (lucide) icon + `value` text + link via `url`.
- `type === 'whatsapp'` → `SiWhatsapp` icon + `value` text + link via `url`.
- `type === 'email'` → `Mail` (lucide) icon + `value` text + `mailto:` link via `url`.

### `RichTextEditor` (shared extraction)

Extracted from `components/notas/NotaEditor/index.tsx`. The extraction:
1. Creates `components/common/RichTextEditor/index.tsx` with the same Tiptap setup.
2. Moves `EditorToolbar`, `ToolbarButton`, `Divider` to `components/common/RichTextEditor/components/`.
3. `NotaEditor` becomes a thin wrapper that imports `RichTextEditor` and adds the submit/cancel action bar and `LinkModal`.
4. `RichTextEditor` accepts and produces HTML strings. Markdown↔HTML conversion is the caller's responsibility (Admin_Editor uses `turndown` for HTML→Markdown and `marked` or `react-markdown` for Markdown→HTML preview).

**`RichTextEditor` props:**
```typescript
interface RichTextEditorProps {
  content?: string;          // initial HTML
  placeholder?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
}
```

---

## Page Integrations

### Login Page (`app/(auth)/login/page.tsx`)

The `AuthLayout` (`app/(auth)/layout.tsx`) currently renders:
```tsx
<div className="absolute right-4 top-4 opacity-50 hover:opacity-100 transition-opacity">
  <ThemeToggle />
</div>
```

The `WhoWeAre` button is added to the left of `ThemeToggle` inside the same absolute container:
```tsx
<div className="absolute right-4 top-4 flex items-center gap-2">
  <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
  <div className="opacity-50 hover:opacity-100 transition-opacity">
    <ThemeToggle />
  </div>
</div>
```

Since `AuthLayout` is a Server Component, `locale` is obtained via `await getLocale()`. `WhoWeAre` is a Client Component that handles its own loading state — the layout renders it unconditionally and the component renders `null` until content resolves.

### Information/Privacy Page (`app/privacidad/page.tsx`)

Currently a Server Component. The `WhoWeAre` button is added below the `MarkdownRenderer`:
```tsx
// Server component resolves content before render
const hasWhoWeAreContent = await checkWhoWeAreContent(tenantConfig.id, locale);

return (
  <div className="container-app py-12 max-w-2xl mx-auto">
    <BackButton className="mb-6" />
    <MarkdownRenderer content={content} />
    {hasWhoWeAreContent && (
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <WhoWeAreClientWrapper tenantSlug={tenantConfig.id} locale={locale} />
      </div>
    )}
  </div>
);
```

Since the page is a Server Component, content resolution happens server-side via a helper function that calls the Supabase server client. No loading state is shown. `WhoWeAreClientWrapper` is a thin `'use client'` wrapper that renders the `WhoWeAre` component (which is already a client component).

### Edit Profile Page (`app/(dashboard)/perfil/page.tsx`)

The existing `PerfilPage` is a Client Component. The "Email Templates" section currently uses the `Field` sub-component which centers the button relative to the label only. The fix wraps both title and subtitle in a container and centers the button relative to the whole container.

New "Who We Are" section added after the Email Templates section, visible only when `rol === 'admin'`:

```tsx
{isAdmin && (
  <div className="flex items-center justify-between gap-6 py-4 border-b border-[var(--color-border)]">
    <div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('quienes_somos_titulo')}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
        {t('quienes_somos_subtitulo')}
      </p>
    </div>
    <button onClick={() => router.push('/perfil/quienes-somos')} ...>
      {t('quienes_somos_boton')}
    </button>
  </div>
)}
```

---

## Admin Editor (`app/(dashboard)/perfil/quienes-somos/page.tsx`)

Client Component. Guarded: redirects non-admin users back to `/perfil`.

**Sections:**

1. **Header** — back button + title + subtitle.

2. **Locale selector** — `es` / `en` tabs. On change: fetch markdown from Storage for new locale, populate editor.

3. **Rich text editor section** — uses `RichTextEditor`. On load: fetch `content/tenants/{slug}/{locale}/quienes-somos.md` from Storage, convert Markdown→HTML via `marked`, populate editor. On save: convert HTML→Markdown via `turndown`, upload to Storage.

4. **Hero image section** — visually separated by a divider + labeled heading.
   - On load: probe Storage for existing image (same extension order as modal).
   - If found: show preview (max 300×200px, aspect ratio preserved).
   - File input: accepts `image/jpeg,image/png,image/webp,image/gif,image/svg+xml`.
   - Client-side validation: MIME type check + 5 MB size limit before upload.
   - On upload: if new extension ≠ old extension, delete old file first, then upload new.
   - Error states: unsupported type, file too large, upload failure.

5. **Contact info section** — editable list of `tenant_contact_info` rows.
   - On load: fetch all rows for current tenant via React Query.
   - Add entry: appends new row with empty fields + `type` selector.
   - Label change: auto-assigns `icon_key` (known social → brand key, unknown → `'link'`).
   - Reorder: up/down arrow buttons update `sort_order`.
   - Delete: removes from local state immediately.
   - Save: upsert all rows (delete removed, insert new, update modified) via Supabase client.
   - Validation: non-empty `label`, `value`, `url` before save.
   - Error handling: display error message, do not navigate away.

**Data fetching pattern:**
```typescript
// React Query for contact info
const { data: contacts } = useQuery({
  queryKey: ['who-we-are-contacts', tenantSlug],
  queryFn: () => supabase.from('tenant_contact_info')
    .select('*').eq('tenant_slug', tenantSlug).order('sort_order'),
  staleTime: 0,
});
```

---

## i18n Keys

New namespace `quienesSomos` added to both `messages/es.json` and `messages/en.json`:

```json
"quienesSomos": {
  "boton_aria": "¿Quiénes somos?",
  "modal_cerrar": "Cerrar",
  "contacto_titulo": "Contacto",
  "contacto_toggle_abrir": "Ver contacto",
  "contacto_toggle_cerrar": "Cerrar contacto",
  "contacto_volver": "Volver",
  "editor_titulo": "¿Quiénes Somos?",
  "editor_subtitulo": "Edita el contenido, imagen y datos de contacto del modal",
  "editor_locale_label": "Idioma",
  "editor_contenido_titulo": "Contenido",
  "editor_imagen_titulo": "Imagen de portada",
  "editor_imagen_preview": "Vista previa actual",
  "editor_imagen_subir": "Subir imagen",
  "editor_imagen_error_tipo": "Tipo de archivo no permitido",
  "editor_imagen_error_tamaño": "La imagen no puede superar 5 MB",
  "editor_imagen_error_upload": "Error al subir la imagen. La imagen anterior se conserva.",
  "editor_contacto_titulo": "Información de contacto",
  "editor_contacto_agregar": "Agregar entrada",
  "editor_contacto_label": "Nombre / Red",
  "editor_contacto_value": "Valor (usuario o teléfono)",
  "editor_contacto_url": "URL",
  "editor_contacto_tipo": "Tipo",
  "editor_contacto_guardar": "Guardar contacto",
  "editor_contacto_error_guardar": "Error al guardar. Intenta nuevamente.",
  "editor_contacto_error_validacion": "Todos los campos son requeridos",
  "editor_guardar": "Guardar contenido",
  "editor_guardando": "Guardando...",
  "editor_exito": "Contenido guardado correctamente",
  "editor_error": "Error al guardar. Intenta nuevamente.",
  "perfil_titulo": "¿Quiénes Somos?",
  "perfil_subtitulo": "Edita el contenido del modal de presentación",
  "perfil_boton": "Editar contenido"
}
```

---

## Dependencies

### New dependency: `react-icons`

Add to `package.json`:
```json
"react-icons": "^5.5.0"
```

Used for: `react-icons/si` (Simple Icons — brand icons for social networks).

### Existing dependencies used

- `framer-motion` ^12 — already installed, used via `LazyMotion` + `domAnimation`.
- `react-markdown` + `remark-gfm` — already installed, used in `MarkdownRenderer`.
- `@tiptap/*` — already installed, used in `NotaEditor` (to be extracted).
- `@supabase/supabase-js` — already installed, used for Storage and DB queries.
- `@tanstack/react-query` — already installed, used for all data fetching.
- `next-intl` — already installed, used for i18n.
- `lucide-react` — already installed, used for generic icons.

### Markdown conversion in Admin Editor

The Admin Editor needs to convert between HTML (Tiptap output) and Markdown (Storage format). Use:
- `marked` (HTML→Markdown is not its purpose; use `turndown` instead)
- `turndown` for HTML→Markdown (server-side upload)
- `marked` for Markdown→HTML (initial load into editor)

Both are lightweight and do not require additional configuration. Add to `package.json`:
```json
"turndown": "^7.2.0",
"marked": "^15.0.0"
```

(Note: `react-markdown` is already used for rendering; `marked` is only needed for the admin editor's load path. If `marked` is already available transitively, verify before adding.)

---

## File Structure Summary

### New files
```
components/common/WhoWeAre/
  index.tsx
  WhoWeAreModal.tsx
  ContactColumn.tsx
  HeroImage.tsx
  hooks/
    useWhoWeAreContent.ts
    useHeroImage.ts
    useContactInfo.ts

components/common/RichTextEditor/
  index.tsx
  components/
    EditorToolbar.tsx
    ToolbarButton.tsx
    Divider.tsx

app/(dashboard)/perfil/quienes-somos/
  page.tsx

supabase/migrations/
  055_tenant_contact_info.sql

supabase/seeds/
  (seed data added to pregunta-estrategica.sql)
```

### Modified files
```
app/(auth)/layout.tsx                    ← add WhoWeAre button left of ThemeToggle
app/privacidad/page.tsx                  ← add WhoWeAre button below MarkdownRenderer
app/(dashboard)/perfil/page.tsx          ← add Who We Are section + fix Email Templates alignment
components/notas/NotaEditor/index.tsx    ← refactor to use shared RichTextEditor
lib/supabase/types.ts                    ← add tenant_contact_info types manually
messages/es.json                         ← add quienesSomos namespace
messages/en.json                         ← add quienesSomos namespace
package.json                             ← add react-icons, turndown, marked
```

---

## Security Considerations

- `tenant_contact_info` SELECT is public (anon) — required for Login page (unauthenticated).
- INSERT/UPDATE/DELETE restricted to `admin` role via RLS using `get_user_rol()` (existing SECURITY DEFINER function, avoids RLS recursion — see migration 016).
- Storage uploads in Admin Editor use the authenticated Supabase client (session cookie). The `content` bucket must allow authenticated uploads for admin users.
- File MIME type validation is client-side only (UX guard). Storage bucket policies provide the server-side enforcement.
- No PII is stored in `tenant_contact_info` beyond what the admin explicitly enters.

---

## Build Verification

After full implementation:
1. `npx tsc --noEmit` — zero TypeScript errors.
2. `npm run build` — clean production build.

Key TypeScript considerations:
- `react-icons/si` exports are typed — no `@types/react-icons` needed.
- `turndown` requires `@types/turndown` (add to devDependencies).
- `marked` is typed in its own package.
- All new components use strict TypeScript with explicit prop interfaces.
