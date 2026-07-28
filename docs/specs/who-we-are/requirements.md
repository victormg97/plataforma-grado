# Requirements Document

## Introduction

The **"Who We Are" (¿Quiénes Somos?)** feature adds a reusable, self-contained component that displays a branded modal presenting the tenant's identity, story, and contact information. The modal is accessible from two locations: the Login page (next to the theme toggle) and the Information/Privacy page (below the Privacy Policy section). An admin-only editor inside the Edit Profile view allows administrators to create and manage the content directly from the UI.

Content is stored as Markdown files in Supabase Storage, organized by tenant and locale. Contact information is stored in a new `tenant_contact_info` database table. The modal is designed to be large, elegant, and fully responsive, using the tenant's brand colors and the project's existing animation library (framer-motion).

## Glossary

- **WhoWeAre_Component**: The self-contained reusable component that encapsulates the button trigger and the modal. Receives `tenantSlug` and `locale` as props and handles its own data fetching.
- **WhoWeAre_Modal**: The large, animated modal dialog rendered by the WhoWeAre_Component. Contains three columns on desktop (hero image, markdown content, contact section) and a stacked layout on mobile.
- **Content_Resolver**: The logic within WhoWeAre_Component that determines which Markdown file to load from Supabase Storage, following the locale-then-Spanish fallback priority.
- **Contact_Column**: The right column of the WhoWeAre_Modal that displays social network links, WhatsApp entries, and email entries sourced from the `tenant_contact_info` table.
- **Admin_Editor**: The admin-only section within the Edit Profile view that allows administrators to create and edit the WhoWeAre content, hero image, and contact info entries.
- **RichTextEditor**: The shared rich text editor component (extracted from the existing `NotaEditor`) located at `components/common/RichTextEditor`. Used by both Class Notes and the Admin_Editor.
- **ExternalLinkModal**: The existing external-link confirmation component at `components/common/ExternalLinkModal.tsx` that intercepts outbound navigation.
- **tenant_contact_info**: The new Supabase database table that stores contact and social network entries per tenant.
- **icon_key**: A string identifier that maps a social network label to a specific brand icon from the `react-icons/si` library (e.g., `"instagram"`, `"whatsapp"`). Unrecognized labels use a generic link icon.
- **Tenant_Slug**: The unique identifier for a tenant (e.g., `"pregunta-estrategica"`), used to construct Supabase Storage paths.
- **Locale**: The active language code (`"es"` or `"en"`), used to select the correct Markdown file.

---

## Requirements

### Requirement 1: Content Resolution from Supabase Storage

**User Story:** As a visitor or logged-in user, I want the "Who We Are" button to appear only when content is available for my tenant, so that the UI never shows a broken or empty modal.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Component mounts, THE Content_Resolver SHALL attempt to fetch the Markdown file at `content/tenants/{tenantSlug}/{locale}/quienes-somos.md` from Supabase Storage.
2. IF the locale-specific file returns a storage-object-not-found response or any fetch error (network error, server error), THEN THE Content_Resolver SHALL attempt to fetch the Spanish fallback at `content/tenants/{tenantSlug}/es/quienes-somos.md`.
3. IF both the locale-specific fetch and the Spanish fallback fetch return a storage-object-not-found response or any fetch error, THEN THE WhoWeAre_Component SHALL not render the trigger button.
4. WHEN the Content_Resolver successfully resolves a Markdown file (either locale-specific or Spanish fallback), THE WhoWeAre_Component SHALL render the trigger button.
5. THE Content_Resolver SHALL resolve files in the following priority order: (1) locale-specific file, (2) Spanish fallback — no other order is permitted.
6. WHILE the Content_Resolver has not yet completed resolution (loading state), THE WhoWeAre_Component SHALL not render the trigger button.
7. IF the Content_Resolver has not completed within 10 seconds, THEN THE Content_Resolver SHALL treat the attempt as a failure and THE WhoWeAre_Component SHALL not render the trigger button.

---

### Requirement 2: Hero Image Resolution

**User Story:** As a visitor or logged-in user, I want the modal to optionally display a hero image when one is available, so that the tenant's visual identity is reinforced.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Modal opens, THE WhoWeAre_Component SHALL probe for the hero image in Supabase Storage by checking each extension in the following order: `jpg`, `jpeg`, `png`, `webp`, `gif`, `svg` — using the path `content/tenants/{tenantSlug}/quienes-somos-image.{ext}` — and SHALL use the first extension for which a file is found.
2. IF the hero image exists, THEN THE WhoWeAre_Modal SHALL render a left image column displaying the hero image using `object-fit: cover` to fill the column height without distortion.
3. IF no hero image is found for any of the probed extensions, or if any fetch error occurs during probing, THEN THE WhoWeAre_Modal SHALL render without the left image column, and the center and right columns SHALL expand to fill the available space.
4. IF a fetch error occurs while probing for the hero image, THEN THE WhoWeAre_Modal SHALL treat the error as "image not found" and proceed without the left image column — no error message SHALL be shown to the user.

---

### Requirement 3: WhoWeAre Button — Login Page Placement

**User Story:** As a visitor on the Login page, I want to access the "Who We Are" modal from a clearly visible button, so that I can learn about the organization before logging in.

#### Acceptance Criteria

1. WHEN the Content_Resolver successfully resolves content for the current tenant and locale, THE Login_Page SHALL render the WhoWeAre_Component trigger button to the left of the light/dark mode toggle in the top-right corner.
2. WHILE the Content_Resolver has not yet resolved (loading state), THE Login_Page SHALL not render the WhoWeAre_Component trigger button.
3. IF the Content_Resolver fails to resolve content (file not found or fetch error), THEN THE Login_Page SHALL not render the WhoWeAre_Component trigger button and SHALL not display any fallback or error state in its place.
4. THE WhoWeAre_Component trigger button on the Login page SHALL apply the CSS classes `opacity-50 hover:opacity-100 transition-opacity` to match the visual style of the existing theme toggle button.
5. THE WhoWeAre_Component trigger button SHALL have an accessible label (e.g., `aria-label`) that identifies its purpose in the active locale language.

---

### Requirement 4: WhoWeAre Button — Information Page Placement

**User Story:** As a logged-in user on the Information/Privacy page, I want to access the "Who We Are" modal from a button below the Privacy Policy section, so that I can learn about the organization in context.

#### Acceptance Criteria

1. WHEN the Content_Resolver successfully resolves content for the current tenant and locale, THE Information_Page SHALL render the WhoWeAre_Component trigger button directly below the last element of the Privacy Policy section, separated by a vertical gap of `var(--space-lg)`, within the same page content column.
2. IF the Content_Resolver does not resolve content or if content resolution fails for any reason, THEN THE Information_Page SHALL not render the WhoWeAre_Component trigger button and SHALL not display any fallback message or error state in its place.
3. BECAUSE the Information_Page is a server component, content resolution completes before the page renders — THE Information_Page SHALL not display any intermediate loading state for the WhoWeAre_Component trigger button.

---

### Requirement 5: WhoWeAre Modal — Desktop Layout

**User Story:** As a desktop user, I want the "Who We Are" modal to display a rich, three-column layout, so that I can read the content, see the hero image, and access contact information simultaneously.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Modal opens on a desktop viewport (≥ 768px), THE WhoWeAre_Modal SHALL render a three-column layout: left column (optional hero image), center column (Markdown content), right column (Contact_Column).
2. WHEN the WhoWeAre_Modal opens on a viewport smaller than 768px, THE WhoWeAre_Modal SHALL use the mobile layout defined in Requirement 6.
3. WHEN the WhoWeAre_Modal is open on a desktop viewport (≥ 768px), THE WhoWeAre_Modal SHALL occupy at least 80% of the viewport width and at least 80% of the viewport height.
4. WHEN the Markdown content in the center column exceeds the available column height, THE center column SHALL be independently scrollable without affecting the other columns.
5. THE WhoWeAre_Modal SHALL render Markdown content that includes any Unicode character or emoji without substitution, replacement, or display error.
6. THE WhoWeAre_Modal SHALL reference only CSS variables for all color values — specifically `--color-accent`, `--color-bg`, `--color-text-primary`, and any other color tokens defined in the project — and SHALL not contain any hardcoded hex, rgb, or named color values.
7. THE WhoWeAre_Modal SHALL apply `var(--font-display)` to all heading elements (`h1`–`h6`) and `var(--font-body)` to all body text elements within the modal.
8. THE WhoWeAre_Modal SHALL include a visible close control (button or icon) that dismisses the modal when activated.

---

### Requirement 6: WhoWeAre Modal — Mobile Layout

**User Story:** As a mobile user, I want the "Who We Are" modal to prioritize readability and provide a way to access the contact section, so that I can use the modal comfortably on a small screen.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Modal opens on a mobile viewport (< 768px), THE WhoWeAre_Modal SHALL render the center column (Markdown content) as the primary visible content, occupying the full available width minus any decorative image strip.
2. WHEN the WhoWeAre_Modal opens on a mobile viewport and a hero image exists, THE WhoWeAre_Modal SHALL render the left hero image column as a decorative strip with a maximum width of 48px.
3. WHEN the WhoWeAre_Modal opens on a mobile viewport, THE Contact_Column SHALL be closed (not visible) by default.
4. THE WhoWeAre_Modal SHALL render a toggle button at the bottom of the mobile layout that is visible only on mobile viewports (< 768px). The button SHALL reflect the current open/closed state of the Contact_Column (e.g., different label or icon for each state) and SHALL toggle the Contact_Column in and out with an upward slide animation using framer-motion.
5. WHEN the Contact_Column is open on mobile, THE WhoWeAre_Modal SHALL display a close/back control rendered within the Contact_Column itself, so that it scrolls with the content and is never obscured by other elements.

---

### Requirement 7: WhoWeAre Modal — Animation

**User Story:** As a user, I want the modal to open and close with a smooth animation, so that the experience feels polished and elegant.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Modal opens, THE WhoWeAre_Modal SHALL animate its entrance using framer-motion with an `opacity` transition from 0 to 1 combined with a `scale` transition from 0.95 to 1, over a duration of 200ms using an `easeOut` easing function. THE modal SHALL be wrapped in an `AnimatePresence` component to enable exit animations.
2. WHEN the WhoWeAre_Modal closes, THE WhoWeAre_Modal SHALL animate its exit using framer-motion with an `opacity` transition from 1 to 0 combined with a `scale` transition from 1 to 0.95, over a duration of 150ms using an `easeIn` easing function.
3. WHEN the Contact_Column is toggled on mobile, THE WhoWeAre_Modal SHALL animate the Contact_Column sliding upward into view (open) or downward out of view (close) using framer-motion with a `y` transition over a duration of 250ms using an `easeInOut` easing function.

---

### Requirement 8: Contact Column — Data and Display

**User Story:** As a user viewing the "Who We Are" modal, I want to see the tenant's contact information with branded social icons, so that I can easily reach out through my preferred channel.

#### Acceptance Criteria

1. WHEN the WhoWeAre_Modal opens, THE Contact_Column SHALL fetch contact entries from the `tenant_contact_info` table filtered by `tenant_slug` equal to the current tenant's slug.
2. THE Contact_Column SHALL display entries in ascending order of the `sort_order` column.
3. WHEN a contact entry has a `type` of `"social"` and its `label` (case-insensitive) matches a known social network name (e.g., `"instagram"`, `"twitter"`, `"facebook"`, `"linkedin"`, `"youtube"`, `"tiktok"`, `"pinterest"`), THE Contact_Column SHALL display the corresponding icon from `react-icons/si` in that icon's default brand color as defined by the library, alongside the entry's `value` field as display text, both wrapped in a link using the entry's `url` field.
4. WHEN a contact entry has a `type` of `"whatsapp"`, THE Contact_Column SHALL display the WhatsApp brand icon from `react-icons/si` in its default brand color, the stored `value` field as display text, and SHALL use the stored `url` field as the link href.
5. WHEN a contact entry has a `type` of `"email"`, THE Contact_Column SHALL display an email icon and render the entry as a link using the stored `url` field (which is a `mailto:` URI) with the stored `value` field as display text.
6. WHEN a contact entry has a `type` of `"social"` and its `label` does not match any known social network name (case-insensitive), THE Contact_Column SHALL display a generic external link icon alongside the entry's `value` field, using the entry's `url` field as the link href.
7. WHEN a user clicks any non-`mailto:` link in the Contact_Column, THE Contact_Column SHALL intercept the navigation and display the ExternalLinkModal confirmation dialog before opening the URL in a new tab. `mailto:` links SHALL open directly without interception.
8. IF the fetch of `tenant_contact_info` returns zero entries or fails, THEN THE Contact_Column SHALL render an empty state (no entries shown) without displaying an error message to the user.

---

### Requirement 9: Database — tenant_contact_info Table

**User Story:** As a developer, I want a well-structured database table for tenant contact information, so that the Contact_Column can reliably fetch and display entries.

#### Acceptance Criteria

1. THE System SHALL create a `tenant_contact_info` table in the Supabase database with the following columns: `id` (UUID, primary key, default `gen_random_uuid()`), `tenant_slug` (text, not null), `type` (text, not null, with a CHECK constraint limiting values to `'whatsapp'`, `'email'`, `'social'`), `label` (text, not null), `value` (text, not null), `url` (text, not null), `icon_key` (text, nullable), `sort_order` (integer, not null, default 0), `created_at` (timestamptz, default `now()`), `updated_at` (timestamptz, default `now()`). THE table SHALL also include a trigger that automatically sets `updated_at` to `now()` on every UPDATE, following the project's existing trigger pattern.
2. THE System SHALL enable Row Level Security on `tenant_contact_info` and create a policy that allows SELECT for all roles including unauthenticated (`anon`) users. THE table SHALL be created and RLS enabled before this policy is applied.
3. THE System SHALL create a Row Level Security policy on `tenant_contact_info` that restricts INSERT, UPDATE, and DELETE to authenticated users whose JWT claims include the `admin` role. THE table SHALL exist and RLS SHALL be enabled before this policy is created.
4. THE System SHALL seed the `tenant_contact_info` table for the `pregunta-estrategica` tenant with the following entries and explicit `sort_order` values: (1) sort_order=1, type=`whatsapp`, label=`Estefanía Montalbán`, value=`+56933178853`, url=`https://wa.me/56933178853`; (2) sort_order=2, type=`whatsapp`, label=`Camila Ogalde`, value=`+56951250444`, url=`https://wa.me/56951250444`; (3) sort_order=3, type=`email`, label=`Correo`, value=`preguntaestrategica@gmail.com`, url=`mailto:preguntaestrategica@gmail.com`; (4) sort_order=4, type=`social`, label=`Instagram`, value=`@preguntaestrategica`, url=`https://instagram.com/preguntaestrategica`.
5. THE System SHALL produce a standalone migration `.sql` file at `supabase/migrations/055_tenant_contact_info.sql` that contains the table creation, RLS enablement, both policies, and the `updated_at` trigger — and can be applied to any tenant database without modification.
6. THE System SHALL manually add `tenant_contact_info` type definitions to `lib/supabase/types.ts` without using auto-generation. The definitions SHALL include `Row`, `Insert`, and `Update` shapes that match all columns defined in Criterion 1.

---

### Requirement 10: Admin Editor — Access and Navigation

**User Story:** As an administrator, I want a dedicated "Who We Are" editor section in my Edit Profile view, so that I can manage the content without needing direct database or storage access.

#### Acceptance Criteria

1. WHEN the Edit_Profile_Page finishes loading the authenticated user's profile and the user's role is exactly `admin`, THE Edit_Profile_Page SHALL render a "Who We Are" section alongside the existing "Email Templates" section.
2. THE "Who We Are" section SHALL render a section title, a subtitle describing its purpose, and a button centered within the section container. The button SHALL navigate to `/perfil/quienes-somos` when activated.
3. IF the authenticated user's role is not `admin` (including `profesor`, `alumno`, or any other role), THEN THE Edit_Profile_Page SHALL not render the "Who We Are" section.
4. IF the user's admin status cannot be confirmed due to an authentication failure or system error, THEN THE Edit_Profile_Page SHALL not render the "Who We Are" section.
5. THE Edit_Profile_Page SHALL render the "Email Templates" section such that the button's horizontal center axis aligns with the horizontal center axis of the section container (which contains both the title and subtitle), not just the title element alone.

---

### Requirement 11: Admin Editor — Rich Text Content Editing

**User Story:** As an administrator, I want to edit the "Who We Are" Markdown content using the same rich text editor used for Class Notes, so that I have a consistent and familiar editing experience.

#### Acceptance Criteria

1. THE System SHALL extract the existing `NotaEditor` component into a shared `RichTextEditor` component at `components/common/RichTextEditor/index.tsx`. The `RichTextEditor` component SHALL accept and produce HTML string content; conversion between HTML and Markdown is the responsibility of the calling component.
2. THE extraction of `RichTextEditor` SHALL be completed before updating Class_Notes to use the shared component. WHEN the extraction is complete, THE Class_Notes feature SHALL import and use the shared `RichTextEditor` component from `components/common/RichTextEditor`.
3. THE Admin_Editor SHALL import and use the shared `RichTextEditor` component from `components/common/RichTextEditor`.
4. THE Admin_Editor SHALL display a locale selector with at minimum `es` and `en` options. WHEN the admin changes the selected locale, THE Admin_Editor SHALL fetch and display the Markdown content for the newly selected locale from Supabase Storage, replacing the current editor content.
5. WHEN the Admin_Editor loads, IF existing Markdown content is present in Supabase Storage for the currently selected locale, THEN THE Admin_Editor SHALL fetch and display that content in the editor. IF no content exists for the selected locale, THEN THE Admin_Editor SHALL display an empty editor ready for new input.
6. WHEN the admin submits the editor form, THE Admin_Editor SHALL upload (create or overwrite) the Markdown content to Supabase Storage at `content/tenants/{tenantSlug}/{locale}/quienes-somos.md` for the current tenant and selected locale.
7. IF the upload to Supabase Storage fails for any reason (network error, storage error, permission error), THEN THE Admin_Editor SHALL display a descriptive error message and SHALL not navigate away from the editor.

---

### Requirement 12: Admin Editor — Hero Image Management

**User Story:** As an administrator, I want to upload and preview the hero image for the "Who We Are" modal, so that I can control the visual identity displayed to users.

#### Acceptance Criteria

1. THE Admin_Editor SHALL include a separate image upload section with a visible section boundary (such as a divider or border) and a labeled section heading, visually distinct from the rich text editor section.
2. IF an existing hero image is present in Supabase Storage for the current tenant, THEN THE Admin_Editor SHALL display a preview of that image (maximum display size 300×200px, aspect ratio preserved) before any changes are made. The preview SHALL persist until the admin selects a new file.
3. WHEN the admin uploads a new image, THE Admin_Editor SHALL upload the file to Supabase Storage at `content/tenants/{tenantSlug}/quienes-somos-image.{ext}` where `{ext}` matches the uploaded file's extension. IF the new image has a different extension than the existing image, THE Admin_Editor SHALL delete the old file from storage before uploading the new one.
4. THE Admin_Editor SHALL accept files with the following MIME types only: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`. Files with any other MIME type SHALL be rejected client-side before any upload is initiated.
5. IF the admin selects a file with an unsupported MIME type or a file exceeding 5 MB, THEN THE Admin_Editor SHALL display an error message indicating the specific reason for rejection (unsupported type or file too large) and SHALL not initiate any upload.
6. IF the upload to Supabase Storage fails due to a network error or storage error, THEN THE Admin_Editor SHALL display an error message indicating that the upload failed and the previous image (if any) has been preserved, and SHALL not navigate away from the editor.

---

### Requirement 13: Admin Editor — Contact Info Management

**User Story:** As an administrator, I want to manage the contact information entries displayed in the "Who We Are" modal, so that I can keep the tenant's contact details up to date.

#### Acceptance Criteria

1. WHEN the Admin_Editor loads, THE Admin_Editor SHALL fetch and display all existing `tenant_contact_info` rows for the current tenant, showing each entry's `label`, `value`, `url`, and `type` fields in an editable list.
2. THE Admin_Editor SHALL allow the admin to add new contact entries with no limit on quantity, including multiple entries of the same network type. Each new entry SHALL have a `type` field constrained to one of: `"whatsapp"`, `"email"`, `"social"`.
3. WHEN the admin changes the `label` field value of any entry, THE Admin_Editor SHALL automatically assign the `icon_key` value: if the label matches a known social network name (case-insensitive), the correct brand `icon_key` SHALL be assigned; if the label does not match any known social network name, a generic link `icon_key` SHALL be assigned. This assignment SHALL occur for all entries simultaneously within the same editing session.
4. THE Admin_Editor SHALL allow the admin to reorder entries using up/down controls or drag-and-drop, updating the `sort_order` field of affected entries accordingly.
5. THE Admin_Editor SHALL allow the admin to delete individual contact entries. Deletion SHALL be reflected immediately in the UI before the admin saves.
6. WHEN the admin saves contact info changes, THE Admin_Editor SHALL persist all additions, modifications, reorderings, and deletions to the `tenant_contact_info` table in Supabase. IF the save operation fails, THE Admin_Editor SHALL display an error message and SHALL not navigate away.
7. WHEN the admin attempts to save, THE Admin_Editor SHALL validate that each entry has non-empty `label`, `value`, and `url` fields. IF any entry fails validation, THE Admin_Editor SHALL display a field-level error message and SHALL not submit the save operation.

---

### Requirement 14: Reusability and Architecture

**User Story:** As a developer, I want the WhoWeAre feature to follow the project's established architectural patterns, so that the codebase remains maintainable and consistent.

#### Acceptance Criteria

1. THE WhoWeAre_Component SHALL be a single self-contained reusable component that receives `tenantSlug` (string) and `locale` (string) as props and manages all data fetching internally using React Query hooks — no pre-fetched data SHALL be required as props.
2. THE WhoWeAre_Component SHALL be located at `components/common/WhoWeAre/` following the project's component directory convention.
3. THE RichTextEditor shared component SHALL be located at `components/common/RichTextEditor/index.tsx` and export a `RichTextEditor` named export.
4. THE Admin_Editor view SHALL be located at `app/(dashboard)/perfil/quienes-somos/page.tsx`.
5. THE System SHALL add all new UI strings to both `messages/es.json` and `messages/en.json` before any new UI string is rendered in the application — both files SHALL contain the required keys at the time the feature is deployed.
6. THE System SHALL use CSS variables for all colors, fonts, and spacing values (e.g., `var(--color-brand-gold)`, `var(--color-bg)`, `var(--font-display)`, `var(--space-lg)`) and SHALL not contain any hardcoded hex, rgb, named color, font family string, or pixel spacing value in component styles.

---

### Requirement 15: Build Verification

**User Story:** As a developer, I want the full implementation to pass TypeScript type checking and the production build, so that the feature is production-ready.

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed in the project root after the full implementation is complete, THE System SHALL produce zero TypeScript errors.
2. WHEN `npm run build` is executed in the project root after the full implementation is complete, THE System SHALL complete successfully with no build errors.
3. IF any TypeScript errors or build errors exist at the time the implementation is submitted, THEN THE System SHALL fix all such errors before the implementation is considered complete.
4. THE System SHALL add `react-icons` to `package.json` as a dependency before any component imports from `react-icons/si`, so that the TypeScript compiler and build process can resolve the module.
