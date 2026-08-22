/**
 * Reveal vive ahora en `components/common/Reveal` para poder reutilizarse fuera
 * del landing (por ejemplo en las vistas por tenant del dashboard). Este módulo
 * se mantiene como re-export para no tocar los imports existentes del landing.
 */
export { Reveal } from '@/components/common/Reveal';
