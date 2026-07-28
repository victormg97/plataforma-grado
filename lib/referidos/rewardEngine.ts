// lib/referidos/rewardEngine.ts
import type {
  ReferralRewardRule,
  RewardContext,
  RewardsApplied,
  SingleReward,
  VolumePeriod,
} from './types'

/** Returns a human-readable description of a reward */
function describeReward(rule: ReferralRewardRule): string {
  if (rule.reward_type === 'fixed_amount') {
    return `$${rule.reward_value.toLocaleString('es-CL')} de descuento por ${rule.duration_cycles} ciclo(s)`
  }
  if (rule.reward_type === 'percentage') {
    return `${rule.reward_value}% de descuento por ${rule.duration_cycles} ciclo(s)`
  }
  if (rule.reward_type === 'free_session') {
    return 'Sesión gratuita'
  }
  return rule.volume_reward_description ?? 'Premio especial'
}

/** Returns the count to use for volume comparison based on the rule period */
function getPeriodCount(period: VolumePeriod | null, ctx: RewardContext): number {
  if (period === 'weekly') return ctx.referrerWeeklyCount
  if (period === 'quarterly') return ctx.referrerQuarterlyCount
  return ctx.referrerMonthlyCount // default: monthly
}

/**
 * Calculates all rewards that apply given the active rules and context.
 * Pure function — no side effects, fully testable.
 *
 * @param rules - Active reward rules for the tenant (should be pre-filtered is_active=true)
 * @param context - Context about the current referral event
 * @returns A RewardsApplied object ready to be stored in referral_usages.rewards_applied
 */
export function calculateRewards(
  rules: ReferralRewardRule[],
  context: RewardContext,
): RewardsApplied {
  const rewards: SingleReward[] = []
  let volumeGoalReached = false
  let volumeRewardDescription: string | undefined

  if (!context.isNewReferral) {
    return {
      rewards: [],
      volume_goal_reached: false,
      applied_at: new Date().toISOString(),
    }
  }

  const activeRules = rules.filter((r) => r.is_active)

  for (const rule of activeRules) {
    if (rule.rule_type === 'referred_new') {
      // Reward for the new user who registered with the code
      rewards.push({
        target: 'referred',
        type: rule.reward_type,
        value: rule.reward_value,
        duration_cycles: rule.duration_cycles,
        pack_size: rule.pack_size,
        description: describeReward(rule),
      })
    }

    if (rule.rule_type === 'referrer') {
      // Reward for the user who shared the code
      rewards.push({
        target: 'referrer',
        type: rule.reward_type,
        value: rule.reward_value,
        duration_cycles: rule.duration_cycles,
        pack_size: rule.pack_size,
        description: describeReward(rule),
      })
    }

    if (rule.rule_type === 'volume_goal' && rule.volume_target !== null) {
      const count = getPeriodCount(rule.volume_period, context)
      // The new referral tips the count over the target
      if (count + 1 >= rule.volume_target) {
        volumeGoalReached = true
        volumeRewardDescription = rule.volume_reward_description ?? undefined
      }
    }
  }

  return {
    rewards,
    volume_goal_reached: volumeGoalReached,
    volume_reward_description: volumeRewardDescription,
    applied_at: new Date().toISOString(),
  }
}

/**
 * Returns the effective max discount cap from all rules.
 * Useful for display in admin UI.
 */
export function getMaxDiscountCap(rules: ReferralRewardRule[]): number {
  return rules
    .filter((r) => r.is_active && r.max_discount_per_cycle > 0)
    .reduce((max, r) => Math.max(max, r.max_discount_per_cycle), 0)
}
