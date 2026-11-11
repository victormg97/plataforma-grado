/** Visual variants of the alumno profile card per account status. */

export type AlumnoStatus = 'pendiente' | 'bloqueado' | 'graduado' | 'activo';

export interface EstiloEstado {
  /** Classes of the card container. */
  tarjeta: string;
  /** Classes of the banner strip (gradient, theme aware). */
  banner: string;
  /** Classes added to the avatar. */
  avatar: string;
}

export const ESTILO_ESTADO: Record<AlumnoStatus, EstiloEstado> = {
  activo: {
    tarjeta: 'border-[var(--color-border)] hover:shadow-[var(--shadow-gold)]',
    banner:
      'bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.30),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--color-brand-gold)_75%,white),color-mix(in_srgb,var(--color-brand-gold)_40%,white))] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.08),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--color-brand-gold)_55%,black),color-mix(in_srgb,var(--color-brand-gold)_20%,black))]',
    avatar: 'ring-4 ring-[var(--color-bg)]',
  },
  graduado: {
    tarjeta:
      'border-[var(--color-brand-gold)]/60 shadow-[0_0_22px_color-mix(in_srgb,var(--color-brand-gold)_28%,transparent)] hover:shadow-[0_0_30px_color-mix(in_srgb,var(--color-brand-gold)_42%,transparent)]',
    banner:
      'bg-[linear-gradient(120deg,var(--color-brand-gold),var(--color-brand-gold-light),var(--color-brand-gold))] dark:bg-[linear-gradient(120deg,color-mix(in_srgb,var(--color-brand-gold)_75%,black),var(--color-brand-gold),color-mix(in_srgb,var(--color-brand-gold)_75%,black))]',
    avatar: 'ring-4 ring-[var(--color-brand-gold)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-brand-gold)_55%,transparent)]',
  },
  bloqueado: {
    tarjeta: 'border-[var(--color-error)]/40 bg-[var(--color-bg-secondary)] hover:shadow-[var(--shadow-sm)]',
    banner:
      'bg-[repeating-linear-gradient(135deg,var(--color-bg-elevated),var(--color-bg-elevated)_10px,var(--color-border)_10px,var(--color-border)_20px)]',
    avatar: 'ring-4 ring-[var(--color-bg)] grayscale',
  },
  pendiente: {
    tarjeta: 'border-dashed border-[var(--color-accent-border)] hover:shadow-[var(--shadow-sm)]',
    banner:
      'bg-[radial-gradient(var(--color-accent-border)_1px,transparent_1px)] [background-size:12px_12px] bg-[var(--color-accent-soft)]',
    avatar: 'ring-4 ring-[var(--color-bg)] opacity-90',
  },
};
