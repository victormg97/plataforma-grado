import type { ReferralRewardRule, ReferralUsageEnriched, VolumePeriod } from './types'

/**
 * Valores por defecto del programa de referidos.
 *
 * Se usan cuando el tenant todavía no ha configurado reglas de recompensa
 * (`referral_reward_rules`) del tipo `fixed_amount`. Corresponden al diseño
 * aprobado del programa "Comunidad Estratégica".
 */
export const DEFAULT_PROGRAM_BENEFITS = {
  /** Descuento que recibe quien comparte el código, por cada referido. */
  referrerAmount: 5000,
  /** Descuento que recibe el nuevo referido al registrarse. */
  referredAmount: 5000,
  /** Cantidad de ciclos (meses) durante los que aplica el beneficio. */
  durationCycles: 3,
  /** Tope máximo acumulable por ciclo para quien comparte. */
  maxAccumulated: 20000,
} as const

/** Cantidad máxima de niveles que se dibujan en la barra de acumulación. */
const MAX_TIERS = 6

export interface BenefitTier {
  /** Cantidad de referidos necesarios para alcanzar el nivel. */
  referrals: number
  /** Descuento acumulado al alcanzar el nivel. */
  amount: number
}

export interface VolumeGoalBenefit {
  /** Cantidad de referidos necesarios en el período. */
  target: number
  period: VolumePeriod
  /** Descripción del premio, tal como la configuró el administrador. */
  description: string | null
}

export interface ReferralProgramBenefits {
  referrerAmount: number
  referredAmount: number
  durationCycles: number
  maxAccumulated: number
  /** Niveles de acumulación, de menor a mayor. */
  tiers: BenefitTier[]
  /** Premio por meta de volumen, si el tenant lo tiene configurado. */
  volumeGoal: VolumeGoalBenefit | null
}

/**
 * Devuelve el valor solo si es un número positivo; si no, `undefined`.
 *
 * Las columnas `numeric` de Postgres pueden llegar como string según el
 * serializador, así que se normaliza antes de comparar.
 */
function positive(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Deriva los montos y niveles del programa de referidos a partir de las reglas
 * de recompensa configuradas por el administrador, con fallback a los valores
 * por defecto del programa.
 *
 * - `referrer`     → descuento de quien comparte, duración y tope acumulable.
 * - `referred_new` → descuento del nuevo referido.
 *
 * Los niveles se calculan como `tope / descuento por referido` (acotado a
 * {@link MAX_TIERS}), de modo que la barra de acumulación siempre refleja la
 * configuración real del tenant.
 */
export function deriveProgramBenefits(
  rules: ReferralRewardRule[] = []
): ReferralProgramBenefits {
  const active = rules.filter((r) => r.is_active)
  const fixed = active.filter((r) => r.reward_type === 'fixed_amount')
  const referrerRule = fixed.find((r) => r.rule_type === 'referrer')
  const referredRule = fixed.find((r) => r.rule_type === 'referred_new')

  const referrerAmount =
    positive(referrerRule?.reward_value) ?? DEFAULT_PROGRAM_BENEFITS.referrerAmount
  const referredAmount =
    positive(referredRule?.reward_value) ?? DEFAULT_PROGRAM_BENEFITS.referredAmount
  const durationCycles =
    positive(referrerRule?.duration_cycles) ??
    positive(referredRule?.duration_cycles) ??
    DEFAULT_PROGRAM_BENEFITS.durationCycles
  const maxAccumulated =
    positive(referrerRule?.max_discount_per_cycle) ??
    DEFAULT_PROGRAM_BENEFITS.maxAccumulated

  const tierCount = Math.min(
    MAX_TIERS,
    Math.max(1, Math.floor(maxAccumulated / referrerAmount))
  )

  const tiers: BenefitTier[] = Array.from({ length: tierCount }, (_, i) => ({
    referrals: i + 1,
    amount: referrerAmount * (i + 1),
  }))

  // Premio por meta de volumen (ej. "al 5º referido del mes, 1 sesión gratis").
  const volumeRule = active.find((r) => r.rule_type === 'volume_goal')
  const volumeTarget = positive(volumeRule?.volume_target)
  const volumeGoal: VolumeGoalBenefit | null =
    volumeRule && volumeTarget
      ? {
          target: volumeTarget,
          period: volumeRule.volume_period ?? 'monthly',
          description: volumeRule.volume_reward_description,
        }
      : null

  return {
    referrerAmount,
    referredAmount,
    durationCycles,
    maxAccumulated: tiers[tiers.length - 1].amount,
    tiers,
    volumeGoal,
  }
}

/**
 * Cuenta los referidos del usuario en el mes calendario actual.
 *
 * Excluye el propio registro del usuario (cuando fue él quien usó un código),
 * igual que hace `RecompensasCard`.
 */
export function countReferralsThisMonth(
  usages: ReferralUsageEnriched[] = [],
  userId: string
): number {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  return usages.filter((u) => {
    if (u.referred_user_id === userId) return false
    const used = new Date(u.used_at)
    return used.getMonth() === month && used.getFullYear() === year
  }).length
}

/** Formatea un monto en pesos chilenos: `5000` → `"$5.000"`. */
export function formatCLP(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CL')}`
}
