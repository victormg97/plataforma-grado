import type { TenantConfigInput } from '../schema';

const config: TenantConfigInput = {
  id: 'pregunta-estrategica',
  nombre: 'Pregunta Estratégica',
  descripcion: 'Preparación para el Examen de Grado',
  emailDomain: 'preguntaestrategica.cl',
  // Dominio verificado en Resend (subdominio). El from de los correos sale desde aquí.
  emailFrom: 'no-reply@contacto.preguntaestrategica.cl',
  terminoPrueba: { singular: 'Interrogación', plural: 'Interrogaciones' },
  quienesSomosLabel: 'Sobre Nosotras',
  logoLight: '/tenants/pregunta-estrategica/logo-light.png',
  logoDark: '/tenants/pregunta-estrategica/logo-dark.png',
  sidebarLight: '/tenants/pregunta-estrategica/sidebar-light.png',
  sidebarDark: '/tenants/pregunta-estrategica/sidebar-dark.png',
  propietarios: [
    {
      nombre: 'Estefanía Montalbán Pino',
      email: 'Preguntaestrategica@gmail.com',
    },
    {
      nombre: 'Camila Ogalde Fonck',
      email: 'Preguntaestrategica@gmail.com',
    },
  ],
  theme: {
    colorAccent: '#6B1C3A',          // Burdeo oscuro (letras PE del logo)
    colorAccentLight: '#C4899E',     // Rosa suave (degradado del círculo)
    colorAccentForeground: '#FFFFFF', // Texto blanco sobre burdeo
    colorBg: '#FDF8F6',             // Fondo crema rosado muy suave (del fondo del logo light)
    colorBgSecondary: '#F5EDED',    // Fondo secundario rosa pálido
    colorSectionAlt: '#EFE0E2',     // Fondo alternativo de secciones (rosa malva un poco más saturado)
    colorCard: '#FFF5F3',           // Cards rosa crema suave (no blanco puro)
    colorInput: '#FFF0ED',          // Inputs rosa pálido cálido (armoniza con burdeo)
    colorPopover: '#FFF0ED',        // Dropdown lists mismo tono
    colorTextPrimary: '#2D1A1A',    // Texto oscuro con tinte cálido
    colorBorder: '#E8D5D5',         // Bordes rosa pálido
    dark: {
      colorBg: '#1A0E12',           // Fondo dark con tinte burdeo
      colorBgSecondary: '#2A1820',  // Fondo secundario dark
      colorSectionAlt: '#33202A',   // Fondo alternativo de secciones dark (vino un poco más claro)
      colorCard: '#241520',         // Cards dark con tinte vino
      colorInput: '#2E1A24',        // Inputs un poco más claros que cards en dark
      colorTextPrimary: '#F5E8EC',  // Texto claro rosado
      colorBorder: '#3D2530',       // Bordes dark
    },
  },
  fonts: {
    display: 'Playfair Display',    // Serif elegante (similar al estilo del logo)
    body: 'DM Sans',
  },
  metadata: {
    favicon: '/tenants/pregunta-estrategica/favicon.ico',
  },
  landingPage: {
    habilitado: true,
    // El usuario logeado puede ver el landing (con su sesión y botón "Ir a la plataforma")
    // en vez de ser redirigido directamente al dashboard.
    usuarioLogeadoVeLanding: true,
  },
};

export default config;
