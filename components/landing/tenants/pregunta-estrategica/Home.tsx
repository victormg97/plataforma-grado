import { resolveAsset } from '../../shared/resolveAsset';
import { Shell } from './Shell';
import { Hero } from './Hero';
import { Features } from './Features';
import { Programas } from './Programas';
import { Tutorias } from './Tutorias';
import { Planes } from './Planes';
import { SobreNosotras } from './SobreNosotras';
import { Contacto } from './Contacto';
import type { LandingProps } from '../../types';

/**
 * Página principal del landing de "pregunta-estrategica".
 * Ensambla todas las secciones en una sola vista con scroll continuo:
 * Hero → Features → Programas → Tutorías → Planes → Sobre Nosotras → Contacto.
 */
export default async function Home(props: LandingProps) {
  // Resuelve en el servidor cuál variante de cada imagen existe.
  const heroImage = resolveAsset('/tenants/pregunta-estrategica/landing/hero');
  const sobreNosotrasImage = resolveAsset('/tenants/pregunta-estrategica/landing/sobre-nosotras');
  const tutoriasImage = resolveAsset('/tenants/pregunta-estrategica/landing/tutorias');
  const lectorImage = resolveAsset('/tenants/pregunta-estrategica/landing/programa-lector');

  return (
    <Shell {...props}>
      <Hero imageSrc={heroImage} />
      <Features />
      <Programas lectorImageSrc={lectorImage} />
      <Tutorias imageSrc={tutoriasImage} />
      <Planes />
      <SobreNosotras imageSrc={sobreNosotrasImage} />
      <Contacto />
    </Shell>
  );
}
