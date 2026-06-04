import { redirect } from 'next/navigation';

/**
 * Página raíz del lector — redirige directamente a recursos compartidos,
 * que es la única sección disponible para este rol.
 */
export default function LectorPage() {
  redirect('/lector/recursos');
}
