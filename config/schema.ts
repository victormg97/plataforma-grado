import { z } from 'zod';

// ─── Schema Version ──────────────────────────────────────────────────────────
export const CURRENT_SCHEMA_VERSION = 1;

// ─── Custom Validators ───────────────────────────────────────────────────────
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato #RRGGBB');

const kebabCaseSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Debe ser kebab-case (ej: mi-academia)');

const relativePathSchema = z
  .string()
  .startsWith('/', 'Debe ser una ruta relativa que inicie con /');

// ─── Sub-Schemas ─────────────────────────────────────────────────────────────

const redesSocialesSchema = z.object({
  instagram: z.url().optional(),
  facebook: z.url().optional(),
  linkedin: z.url().optional(),
  whatsapp: z.string().optional(),
});

const ownerSchema = z.object({
  nombre: z.string().min(1, 'Nombre del propietario es requerido'),
  email: z.email('Email debe tener formato válido'),
  telefono: z.string().optional().default(''),
  redesSociales: redesSocialesSchema.optional().default({}),
});

const themeSchema = z.object({
  colorAccent: hexColorSchema,
  colorAccentLight: hexColorSchema,
  colorAccentForeground: hexColorSchema.optional(), // Texto sobre el color accent (ej: blanco sobre azul)
  colorBg: hexColorSchema.optional(),
  colorBgSecondary: hexColorSchema.optional(),
  colorCard: hexColorSchema.optional(), // Fondo de cards (si se quiere diferente al fondo principal)
  colorInput: hexColorSchema.optional(), // Fondo de inputs, selects, búsquedas (diferenciarlo del fondo)
  colorPopover: hexColorSchema.optional(), // Fondo de dropdown lists / popovers (default: colorCard)
  colorTextPrimary: hexColorSchema.optional(),
  colorBorder: hexColorSchema.optional(),
  dark: z
    .object({
      colorBg: hexColorSchema.optional(),
      colorBgSecondary: hexColorSchema.optional(),
      colorCard: hexColorSchema.optional(),
      colorInput: hexColorSchema.optional(),
      colorPopover: hexColorSchema.optional(),
      colorTextPrimary: hexColorSchema.optional(),
      colorBorder: hexColorSchema.optional(),
    })
    .optional(),
});

const fontsSchema = z.object({
  display: z.string().optional().default('Playfair Display'),
  body: z.string().optional().default('DM Sans'),
});

const metadataSchema = z.object({
  ogImage: relativePathSchema.optional(),
  favicon: relativePathSchema.optional(),
});

// ─── Main Tenant Config Schema ───────────────────────────────────────────────

export const tenantConfigSchema = z.object({
  id: kebabCaseSchema,
  nombre: z.string().min(1, 'Nombre de la aplicación es requerido'),
  descripcion: z.string().min(1, 'Descripción es requerida'),
  emailDomain: z.string().min(1, 'Dominio de correo es requerido'),
  terminoPrueba: z.object({
    singular: z.string().min(1),
    plural: z.string().min(1),
  }).optional().default({ singular: 'Prueba', plural: 'Pruebas' }),
  logoLight: relativePathSchema,
  logoDark: relativePathSchema,
  // Logos opcionales específicos del sidebar (variaciones del logo principal).
  // Si no se definen, el sidebar usa logoLight/logoDark.
  sidebarLight: relativePathSchema.optional(),
  sidebarDark: relativePathSchema.optional(),
  propietarios: z.array(ownerSchema).min(1, 'Se requiere al menos un propietario'),
  theme: themeSchema,
  fonts: fontsSchema.optional().default({ display: 'Playfair Display', body: 'DM Sans' }),
  metadata: metadataSchema.optional().default({}),
});

// ─── Exported Types ──────────────────────────────────────────────────────────

/** Tipo de salida (después de aplicar defaults por Zod) */
export type TenantConfig = z.infer<typeof tenantConfigSchema>;

/** Tipo de entrada (lo que se escribe en los archivos de configuración) */
export type TenantConfigInput = z.input<typeof tenantConfigSchema>;
