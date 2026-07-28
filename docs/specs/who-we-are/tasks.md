# Implementation Plan: Who We Are (¿Quiénes Somos?)

## Overview

Full implementation of the WhoWeAre feature: database migration, shared RichTextEditor extraction, self-contained WhoWeAre component with animated modal, Login and Privacy page integrations, admin-only editor, and build verification.

## Tasks

- [x] 1. Database migration and TypeScript types
  - Create `supabase/migrations/055_tenant_contact_info.sql` with the `tenant_contact_info` table, CHECK constraint on `type` (`'whatsapp'`, `'email'`, `'social'`), `updated_at` trigger following the project's existing trigger pattern, RLS enablement, public SELECT policy (anon + authenticated), and admin-only write policy using `get_user_rol()` to avoid RLS recursion.
  - Apply the migration to the Supabase database via MCP (`mcp_supabase_apply_migration`).
  - Add `tenant_contact_info` `Row`, `Insert`, and `Update` type shapes manually to `lib/supabase/types.ts` inside the `Tables` object, and add `export type TenantContactInfo = Tables<'tenant_contact_info'>;` alias at the bottom.
  - Seed the `tenant_contact_info` table for the `pregunta-estrategica` tenant with the four entries (sort_order 1–4: two whatsapp, one email, one social/Instagram) via `mcp_supabase_execute_sql`.
  - Add the seed INSERT statements to `supabase/seeds/pregunta-estrategica.sql` so they are reproducible.

- [x] 2. Install new dependencies
  - Add `react-icons` (^5.5.0), `turndown` (^7.2.0), and `marked` (^15.0.0) to `dependencies` in `package.json`.
  - Add `@types/turndown` to `devDependencies`.
  - Run `npm install` in the `cta-graduados` directory to install the packages.

- [x] 3. Add i18n keys to both message files
  - Add the `quienesSomos` namespace to `messages/es.json` with all keys defined in the design document (Spanish values): `boton_aria`, `modal_cerrar`, `contacto_titulo`, `contacto_toggle_abrir`, `contacto_toggle_cerrar`, `contacto_volver`, `editor_titulo`, `editor_subtitulo`, `editor_locale_label`, `editor_contenido_titulo`, `editor_imagen_titulo`, `editor_imagen_preview`, `editor_imagen_subir`, `editor_imagen_error_tipo`, `editor_imagen_error_tamaño`, `editor_imagen_error_upload`, `editor_contacto_titulo`, `editor_contacto_agregar`, `editor_contacto_label`, `editor_contacto_value`, `editor_contacto_url`, `editor_contacto_tipo`, `editor_contacto_guardar`, `editor_contacto_error_guardar`, `editor_contacto_error_validacion`, `editor_guardar`, `editor_guardando`, `editor_exito`, `editor_error`, `perfil_titulo`, `perfil_subtitulo`, `perfil_boton`.
  - Add the same `quienesSomos` namespace to `messages/en.json` with English values.
  - Both files must be updated in the same task before any UI component renders the new strings.

- [x] 4. Extract shared RichTextEditor component
  - Create `components/common/RichTextEditor/components/EditorToolbar.tsx` — copy from `components/notas/NotaEditor/components/EditorToolbar.tsx` (keep the original in place for now).
  - Create `components/common/RichTextEditor/components/ToolbarButton.tsx` — copy from `components/notas/NotaEditor/components/ToolbarButton.tsx`.
  - Create `components/common/RichTextEditor/components/Divider.tsx` — copy from `components/notas/NotaEditor/components/Divider.tsx`.
  - Create `components/common/RichTextEditor/index.tsx` with the Tiptap editor setup (StarterKit, Placeholder, Link, TextAlign, Table extensions, IndentExtension), accepting props `{ content?: string; placeholder?: string; onChange?: (html: string) => void; readOnly?: boolean }`. The component accepts and produces HTML strings.
  - Update `components/notas/NotaEditor/index.tsx` to import `RichTextEditor` from `@/components/common/RichTextEditor` and use it internally, keeping the existing submit/cancel action bar and `LinkModal` wrapper intact. Remove the duplicated Tiptap setup from `NotaEditor`.
  - Verify no TypeScript errors and no broken imports in the Class Notes feature after the refactor.

- [x] 5. Build WhoWeAre React Query hooks
  - Create `components/common/WhoWeAre/hooks/useWhoWeAreContent.ts` — React Query hook that fetches `content/tenants/{tenantSlug}/{locale}/quienes-somos.md` from Supabase Storage, falls back to `es` locale on any error, returns `{ markdown: string | null, status: 'loading' | 'resolved' | 'not_found' }`. Implements a 10-second AbortController timeout that treats the attempt as failure on abort.
  - Create `components/common/WhoWeAre/hooks/useHeroImage.ts` — React Query hook that probes Supabase Storage for `content/tenants/{tenantSlug}/quienes-somos-image.{ext}` in order `jpg, jpeg, png, webp, gif, svg`, returns `{ url: string | null, found: boolean }`. Treats any fetch error as "not found".
  - Create `components/common/WhoWeAre/hooks/useContactInfo.ts` — React Query hook that queries `tenant_contact_info` filtered by `tenant_slug`, ordered by `sort_order` ascending. Returns empty array on error (no error thrown to UI).

- [x] 6. Build WhoWeAre modal sub-components
  - Create `components/common/WhoWeAre/HeroImage.tsx` — renders the left image column using `<img>` with `object-fit: cover` filling the column height. Accepts `{ url: string }`.
  - Create `components/common/WhoWeAre/ContactColumn.tsx` — renders the contact entries list. Implements the icon mapping for `react-icons/si` (instagram, twitter/x, facebook, linkedin, youtube, tiktok, pinterest, whatsapp). Uses `ExternalLinkModal` for all non-`mailto:` link clicks. `mailto:` links open directly without interception. Accepts `{ entries: TenantContactInfo[]; onClose?: () => void }`. Renders empty state silently when entries is empty.

- [x] 7. Build WhoWeAreModal
  - Create `components/common/WhoWeAre/WhoWeAreModal.tsx`.
  - Desktop layout (≥768px): three-column grid — left (HeroImage, optional, hidden if no image), center (MarkdownRenderer, independently scrollable), right (ContactColumn). Modal occupies `w-[90vw] max-w-5xl h-[85vh]`. All colors via CSS variables only. Headings use `var(--font-display)`, body uses `var(--font-body)`. Visible close button (X icon) that calls `onClose`.
  - Mobile layout (<768px): hero image as decorative strip (max-width 48px) or hidden if no image, center column full width, Contact column hidden by default. Toggle button at bottom (mobile only) with open/closed state label/icon. Contact column slide animation using `m.div` from framer-motion with `y` transition (250ms easeInOut). Close/back control rendered inside the Contact column itself.
  - Modal entrance animation: `opacity 0→1` + `scale 0.95→1`, 200ms easeOut. Exit: `opacity 1→0` + `scale 1→0.95`, 150ms easeIn. Uses `m.div` (project uses `LazyMotion` + `domAnimation` via `MotionProvider`).
  - Calls `useHeroImage` and `useContactInfo` hooks internally.

- [x] 8. Build WhoWeAre entry component
  - Create `components/common/WhoWeAre/index.tsx`.
  - Accepts `{ tenantSlug: string; locale: string }`.
  - Calls `useWhoWeAreContent` internally.
  - Renders `null` while loading or on failure (not_found).
  - On success: renders trigger button with `aria-label` from `quienesSomos.boton_aria` i18n key, styled with `opacity-50 hover:opacity-100 transition-opacity` (matches auth layout ThemeToggle style).
  - Manages `isOpen` state locally. Renders `<WhoWeAreModal>` inside `AnimatePresence` when open.

- [x] 9. Integrate WhoWeAre into Login page
  - Modify `app/(auth)/layout.tsx` to make it `async`, add `await getLocale()`, and render `<WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />` to the left of the `ThemeToggle` inside the top-right absolute container.
  - The existing `opacity-50 hover:opacity-100 transition-opacity` wrapper around `ThemeToggle` stays. The `WhoWeAre` component handles its own opacity styling internally.

- [x] 10. Integrate WhoWeAre into Information/Privacy page
  - Modify `app/privacidad/page.tsx` to add a server-side content check: call the Supabase server client to probe Storage for `content/tenants/{tenantConfig.id}/{locale}/quienes-somos.md` (with `es` fallback). If content exists, render a client wrapper component below `<MarkdownRenderer>` separated by `var(--space-lg)` top margin.
  - Create `app/privacidad/WhoWeAreSection.tsx` as a thin `'use client'` wrapper that renders `<WhoWeAre tenantSlug={...} locale={...} />` (needed because `WhoWeAre` is a client component inside a server page).
  - No loading state is shown (server component resolves before render).

- [x] 11. Update Edit Profile page — alignment fix and Who We Are section
  - In `app/(dashboard)/perfil/page.tsx`, fix the "Email Templates" button alignment: restructure the layout so the button's horizontal center axis aligns with the center of the container holding both the title and subtitle (not just the title). Use a flex container with the title+subtitle block and the button as siblings.
  - Add a new "Who We Are" section (visible only when `rol === 'admin'`) with the same layout pattern: title (`quienesSomos.perfil_titulo`), subtitle (`quienesSomos.perfil_subtitulo`), and a button (`quienesSomos.perfil_boton`) that navigates to `/perfil/quienes-somos`. The button is centered relative to the full section container (title + subtitle).
  - The section is not rendered for `profesor`, `alumno`, or when role cannot be confirmed.

- [x] 12. Build Admin Editor page
  - Create `app/(dashboard)/perfil/quienes-somos/page.tsx` as a `'use client'` component.
  - On mount: check `user.rol === 'admin'` from `useUserStore`. If not admin, redirect to `/perfil`.
  - **Header**: back button (navigates to `/perfil`) + title (`quienesSomos.editor_titulo`) + subtitle (`quienesSomos.editor_subtitulo`).
  - **Locale selector**: `es` / `en` tab buttons. On change: fetch markdown from Storage for new locale, convert Markdown→HTML via `marked`, populate `RichTextEditor`. If not found: empty editor.
  - **Rich text editor section**: uses `RichTextEditor` from `@/components/common/RichTextEditor`. On load: fetch `content/tenants/{slug}/{locale}/quienes-somos.md`, convert Markdown→HTML via `marked`. Save button: convert HTML→Markdown via `turndown`, upload to Storage via `supabase.storage.from('content').upload(path, blob, { upsert: true, contentType: 'text/markdown' })`. On upload failure: show error toast + inline error, do not navigate away.
  - **Hero image section**: visually separated by a `<hr>` divider and labeled heading (`quienesSomos.editor_imagen_titulo`). On load: probe Storage for existing image (same extension order: jpg, jpeg, png, webp, gif, svg). If found: show `<img>` preview (max 300×200px, `object-fit: contain`). File input: `accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"`. Client-side validation: MIME type check + 5 MB size limit before upload. On upload: if new extension ≠ old extension, delete old file first. On failure: show error message, preserve previous image.
  - **Contact info section**: labeled heading (`quienesSomos.editor_contacto_titulo`) + editable list. On load: `useQuery` for `tenant_contact_info` rows for current tenant. Each row shows `type` selector (whatsapp/email/social), `label` input, `value` input, `url` input, up/down reorder buttons, delete button. Add entry button appends new empty row. Label change auto-assigns `icon_key` (known social network name → brand key, unknown → `'link'`). Save button: validate all fields non-empty (show field-level error if not), then upsert via Supabase client (delete removed rows by id, insert new rows, update modified rows). On failure: show error message, do not navigate away.

- [x] 13. Build verification
  - Run `npx tsc --noEmit` in `cta-graduados/`. Fix all TypeScript errors until zero remain.
  - Run `npm run build` in `cta-graduados/`. Fix all build errors until the build succeeds cleanly.
  - Common issues to check: `@types/turndown` in devDependencies, `react-icons/si` import paths, `m.div` vs `motion.div` with `LazyMotion`, server/client component boundary violations, missing `'use client'` directives on components that use hooks or browser APIs.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "3"] },
    { "wave": 2, "tasks": ["4", "5"] },
    { "wave": 3, "tasks": ["6"] },
    { "wave": 4, "tasks": ["7", "11"] },
    { "wave": 5, "tasks": ["8", "12"] },
    { "wave": 6, "tasks": ["9", "10"] },
    { "wave": 7, "tasks": ["13"] }
  ]
}
```

## Notes

- The `content` Supabase Storage bucket must have a public SELECT policy for unauthenticated users (Login page reads content before auth). Verify this exists or create it as part of Task 1.
- The `marked` package is used only for Markdown→HTML conversion in the Admin Editor load path. `react-markdown` (already installed) handles rendering in the modal.
- `turndown` converts Tiptap HTML output back to Markdown for Storage. The default configuration is sufficient; no custom rules needed.
- The `WhoWeAre` component uses `m.div` (not `motion.div`) because the project wraps the app in `LazyMotion` with `domAnimation` features. Using `motion.div` would load the full framer-motion bundle.
- The `pregunta-estrategica` tenant already has content files at `content/tenants/pregunta-estrategica/en/quienes-somos.md` (visible in the open editor files). The seed data in Task 1 adds the contact info rows to match.
